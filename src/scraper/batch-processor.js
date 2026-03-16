/**
 * BatchProcessor — Processes multiple listings with proxy rotation and rate limiting
 * 
 * Input:  Array of listing URLs (from CategoryScraper)
 * Output: Array of reveal results with phone numbers
 * 
 * Features:
 * - Rotates through IPv6 proxies (max 3 reveals per proxy per session)
 * - Configurable delay between reveals (default: 45-90 seconds)
 * - Progress tracking: emits events for UI updates
 * - Resume capability: saves progress to disk, can continue after restart
 * - Respects platform rate limits from domain strategy
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import PhoneRevealer from './phone-revealer.js';
import DomainStrategy from './domain-strategy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_DIR = join(__dirname, '..', '..', 'data', 'batch-progress');

class BatchProcessor extends EventEmitter {
  /**
   * @param {ProxyManager} proxyManager
   * @param {DomainStrategy} domainStrategy - injected domain strategy instance
   * @param {object} options
   */
  constructor(proxyManager, domainStrategy, options = {}) {
    super();
    this.proxyManager = proxyManager;
    this.domainStrategy = domainStrategy || new DomainStrategy();

    this.options = {
      maxRevealsPerProxy: options.maxRevealsPerProxy ?? 3,
      delayMinMs: options.delayMinMs ?? (options.delayBetweenRevealsMs?.[0] ?? 45000),
      delayMaxMs: options.delayMaxMs ?? (options.delayBetweenRevealsMs?.[1] ?? 90000),
      maxConcurrent: options.maxConcurrent ?? 1,
      useProxy: options.useProxy ?? true,
      headless: options.headless ?? true,
      debugScreenshots: options.debugScreenshots ?? false,
      retryFailedOnce: options.retryFailedOnce ?? false,
    };

    // Runtime state
    this.batchId = null;
    this.isRunning = false;
    this.isPaused = false;
    this.shouldAbort = false;
    this._lastResult = null;

    // Proxy usage tracking per batch
    this.proxyUsage = new Map(); // proxyId -> revealCount

    // Ensure progress dir exists
    if (!existsSync(PROGRESS_DIR)) {
      mkdirSync(PROGRESS_DIR, { recursive: true });
    }
  }

  /**
   * Process a batch of listing URLs
   * 
   * @param {Array<{url: string, title?: string, price?: string}>} listings - Listings to process
   * @param {object} batchOptions
   * @param {string} batchOptions.batchId       - Unique batch ID (for resume). Auto-generated if not set.
   * @param {string} batchOptions.domain        - Domain hint (e.g. "olx.ro") for strategy lookup
   * @param {number} batchOptions.maxListings   - Max listings to process (default: all)
   * @returns {Promise<BatchResult>}
   */
  async process(listings, batchOptions = {}) {
    if (this.isRunning) {
      throw new Error('Batch already running. Pause or abort before starting a new one.');
    }

    this.batchId = batchOptions.batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.isRunning = true;
    this.isPaused = false;
    this.shouldAbort = false;
    this.proxyUsage.clear();

    const domain = batchOptions.domain || this._extractDomain(listings[0]?.url);
    const strategy = this.domainStrategy.load(domain);
    const maxListings = batchOptions.maxListings || listings.length;
    const toProcess = listings.slice(0, maxListings);

    // Check for existing progress (resume support)
    const progress = this._loadProgress(this.batchId);
    const completedUrls = new Set(progress.completed.map(r => r.url));
    const remaining = toProcess.filter(l => !completedUrls.has(l.url));

    const result = {
      batchId: this.batchId,
      domain,
      totalListings: toProcess.length,
      completed: [...progress.completed],
      failed: [...progress.failed],
      skipped: [],
      startedAt: progress.startedAt || new Date().toISOString(),
      finishedAt: null,
      aborted: false,
    };

    this.emit('batch:start', {
      batchId: this.batchId,
      total: toProcess.length,
      remaining: remaining.length,
      resumed: progress.completed.length > 0,
    });

    console.log(`\n[Batch] ═══════════════════════════════════════════════`);
    console.log(`[Batch] ID: ${this.batchId}`);
    console.log(`[Batch] Domain: ${domain}`);
    console.log(`[Batch] Total: ${toProcess.length} | Remaining: ${remaining.length}`);
    console.log(`[Batch] Proxy: ${this.options.useProxy ? `${this.proxyManager.availableCount} available` : 'disabled'}`);
    console.log(`[Batch] Delay: ${this.options.delayMinMs / 1000}s - ${this.options.delayMaxMs / 1000}s`);
    if (strategy) {
      console.log(`[Batch] Strategy: v${strategy.version} (${(strategy.successRate * 100).toFixed(0)}% success)`);
      if (strategy.rateLimit) {
        console.log(`[Batch] Rate limit: max ${strategy.rateLimit.maxRevealsPerSession} per session, ${strategy.rateLimit.delayBetweenMs / 1000}s min delay`);
      }
    }
    console.log(`[Batch] ═══════════════════════════════════════════════\n`);

    // Respect strategy rate limits if stricter than our defaults
    let effectiveDelayMin = this.options.delayMinMs;
    let effectiveDelayMax = this.options.delayMaxMs;
    if (strategy?.rateLimit?.delayBetweenMs) {
      effectiveDelayMin = Math.max(effectiveDelayMin, strategy.rateLimit.delayBetweenMs);
      effectiveDelayMax = Math.max(effectiveDelayMax, strategy.rateLimit.delayBetweenMs * 1.5);
    }

    // ─── Main processing loop ───────────────────────────────────────────
    for (let i = 0; i < remaining.length; i++) {
      // Check abort
      if (this.shouldAbort) {
        console.log(`[Batch] Aborted at ${i}/${remaining.length}`);
        result.aborted = true;
        break;
      }

      // Check pause — spin-wait until resumed
      while (this.isPaused) {
        await this._sleep(1000);
        if (this.shouldAbort) break;
      }
      if (this.shouldAbort) {
        result.aborted = true;
        break;
      }

      const listing = remaining[i];
      const listingIndex = result.completed.length + result.failed.length + 1;
      const totalToProcess = toProcess.length;

      console.log(`[Batch] [${listingIndex}/${totalToProcess}] Processing: ${listing.url}`);
      this.emit('batch:item_start', {
        batchId: this.batchId,
        index: listingIndex,
        total: totalToProcess,
        listing,
      });

      // Select proxy (rotate when usage limit reached)
      let proxy = null;
      if (this.options.useProxy) {
        proxy = this._getNextProxy();
        if (!proxy) {
          console.warn(`[Batch] No proxies available — skipping ${listing.url}`);
          result.skipped.push({ ...listing, reason: 'no_proxy_available' });
          this.emit('batch:item_skip', { batchId: this.batchId, listing, reason: 'no_proxy_available' });
          continue;
        }
      }

      // Run reveal
      try {
        const revealer = new PhoneRevealer(proxy ? { getRandom: () => proxy } : null);
        const revealResult = await revealer.revealPhone(listing.url, {
          headless: this.options.headless,
          debugScreenshot: this.options.debugScreenshots,
        });

        // Track proxy usage
        if (proxy) {
          const usage = (this.proxyUsage.get(proxy.id) || 0) + 1;
          this.proxyUsage.set(proxy.id, usage);
        }

        // Update domain strategy success rate
        this.domainStrategy.updateSuccessRate(domain, revealResult.success);

        if (revealResult.success) {
          const item = {
            url: listing.url,
            title: listing.title || revealResult.listing?.title || null,
            price: listing.price || revealResult.listing?.price || null,
            phone: revealResult.phone,
            listing: revealResult.listing,
            proxy: revealResult.proxy,
            timing: revealResult.timing,
          };
          result.completed.push(item);
          console.log(`[Batch] ✅ ${revealResult.phone} — "${item.title}" (${revealResult.timing?.totalMs}ms)`);

          this.emit('batch:item_success', {
            batchId: this.batchId,
            index: listingIndex,
            total: totalToProcess,
            item,
          });
        } else {
          const failItem = {
            url: listing.url,
            title: listing.title || null,
            error: revealResult.error,
            proxy: revealResult.proxy,
          };
          result.failed.push(failItem);
          console.log(`[Batch] ❌ Failed: ${revealResult.error}`);

          this.emit('batch:item_fail', {
            batchId: this.batchId,
            index: listingIndex,
            total: totalToProcess,
            item: failItem,
          });
        }
      } catch (err) {
        const failItem = { url: listing.url, title: listing.title || null, error: err.message };
        result.failed.push(failItem);
        console.error(`[Batch] ❌ Exception: ${err.message}`);

        this.emit('batch:item_fail', {
          batchId: this.batchId,
          index: listingIndex,
          total: totalToProcess,
          item: failItem,
        });
      }

      // Save progress after each item
      this._saveProgress(this.batchId, result);
      this._lastResult = result;

      this.emit('batch:progress', {
        batchId: this.batchId,
        processed: result.completed.length + result.failed.length,
        total: totalToProcess,
        successCount: result.completed.length,
        failCount: result.failed.length,
        percent: Math.round(((result.completed.length + result.failed.length) / totalToProcess) * 100),
      });

      // Delay before next reveal (unless last item)
      if (i < remaining.length - 1 && !this.shouldAbort) {
        const delay = this._randomDelay(effectiveDelayMin, effectiveDelayMax);
        console.log(`[Batch] Waiting ${(delay / 1000).toFixed(0)}s before next reveal...`);
        this.emit('batch:waiting', { batchId: this.batchId, delayMs: delay });

        const waited = await this._interruptibleSleep(delay);
        if (!waited) {
          // Was interrupted by abort
          if (this.shouldAbort) {
            result.aborted = true;
            break;
          }
        }
      }
    }

    // ─── Finalize ───────────────────────────────────────────────────────
    result.finishedAt = new Date().toISOString();
    this._saveProgress(this.batchId, result);
    this.isRunning = false;

    const successRate = result.completed.length > 0
      ? Math.round((result.completed.length / (result.completed.length + result.failed.length)) * 100)
      : 0;

    console.log(`\n[Batch] ═══════════════════════════════════════════════`);
    console.log(`[Batch] DONE ${result.aborted ? '(ABORTED)' : ''}`);
    console.log(`[Batch] Completed: ${result.completed.length} | Failed: ${result.failed.length} | Skipped: ${result.skipped.length}`);
    console.log(`[Batch] Success rate: ${successRate}%`);
    console.log(`[Batch] Phones found: ${result.completed.map(r => r.phone).join(', ') || 'none'}`);
    console.log(`[Batch] ═══════════════════════════════════════════════\n`);

    this.emit('batch:done', {
      batchId: this.batchId,
      completed: result.completed.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
      successRate,
      aborted: result.aborted,
    });

    return result;
  }

  // ─── Status methods (called by server.js) ────────────────────────────

  getProgress() {
    if (!this._lastResult) {
      return {
        running: this.isRunning,
        paused: this.isPaused,
        batchId: this.batchId,
        completed: 0,
        failed: 0,
        total: 0,
        percentComplete: 0,
        success: 0,
      };
    }
    const total = this._lastResult.totalListings || 0;
    const completed = (this._lastResult.completed?.length || 0) + (this._lastResult.failed?.length || 0);
    return {
      running: this.isRunning,
      paused: this.isPaused,
      batchId: this.batchId,
      completed: this._lastResult.completed?.length || 0,
      failed: this._lastResult.failed?.length || 0,
      total,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
      success: this._lastResult.completed?.length || 0,
    };
  }

  getResults() {
    return this._lastResult?.completed || [];
  }

  stop() {
    this.abort();
  }

  // ─── Control methods ──────────────────────────────────────────────────

  pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    console.log(`[Batch] Paused`);
    this.emit('batch:paused', { batchId: this.batchId });
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    console.log(`[Batch] Resumed`);
    this.emit('batch:resumed', { batchId: this.batchId });
  }

  abort() {
    this.shouldAbort = true;
    this.isPaused = false; // Unblock pause loop so abort can take effect
    console.log(`[Batch] Abort requested`);
    this.emit('batch:abort_requested', { batchId: this.batchId });
  }

  /**
   * Resume a previously interrupted batch
   * @param {string} batchId
   * @param {Array} originalListings - The full original listing array
   * @returns {Promise<BatchResult>}
   */
  async resumeBatch(batchId, originalListings, batchOptions = {}) {
    return this.process(originalListings, { ...batchOptions, batchId });
  }

  // ─── Proxy rotation ───────────────────────────────────────────────────

  /**
   * Get next proxy, rotating when usage limit reached.
   * Returns null if all proxies are exhausted.
   */
  _getNextProxy() {
    const maxUsage = this.options.maxRevealsPerProxy;

    try {
      // Try to get a proxy that hasn't hit its limit
      const available = [];
      for (let i = 0; i < this.proxyManager.totalCount; i++) {
        const proxy = this.proxyManager.getByIndex(i);
        if (!proxy || proxy.blocked) continue;
        const usage = this.proxyUsage.get(proxy.id) || 0;
        if (usage < maxUsage) {
          available.push(proxy);
        }
      }

      if (available.length === 0) {
        // All proxies hit their limit — reset counters and try again
        console.log(`[Batch] All proxies hit ${maxUsage} reveals — resetting counters`);
        this.proxyUsage.clear();
        return this.proxyManager.getNext();
      }

      // Pick least-used among available
      available.sort((a, b) => (this.proxyUsage.get(a.id) || 0) - (this.proxyUsage.get(b.id) || 0));
      const chosen = available[0];
      chosen.lastUsed = Date.now();
      chosen.usageCount = (chosen.usageCount || 0) + 1;
      return chosen;
    } catch (err) {
      console.warn(`[Batch] Proxy selection error: ${err.message}`);
      return null;
    }
  }

  // ─── Progress persistence ─────────────────────────────────────────────

  _saveProgress(batchId, result) {
    try {
      const file = join(PROGRESS_DIR, `${batchId}.json`);
      writeFileSync(file, JSON.stringify(result, null, 2));
    } catch (err) {
      console.warn(`[Batch] Failed to save progress: ${err.message}`);
    }
  }

  _loadProgress(batchId) {
    const file = join(PROGRESS_DIR, `${batchId}.json`);
    if (!existsSync(file)) {
      return { completed: [], failed: [], startedAt: null };
    }
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      console.log(`[Batch] Resuming from saved progress: ${data.completed?.length || 0} completed, ${data.failed?.length || 0} failed`);
      return {
        completed: data.completed || [],
        failed: data.failed || [],
        startedAt: data.startedAt || null,
      };
    } catch {
      return { completed: [], failed: [], startedAt: null };
    }
  }

  /**
   * List all saved batch progress files
   */
  static listSavedBatches() {
    if (!existsSync(PROGRESS_DIR)) return [];
    return readdirSync(PROGRESS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(readFileSync(join(PROGRESS_DIR, f), 'utf-8'));
          return {
            batchId: data.batchId,
            domain: data.domain,
            completed: data.completed?.length || 0,
            failed: data.failed?.length || 0,
            total: data.totalListings || 0,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
            aborted: data.aborted || false,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  _randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sleep that can be interrupted by abort
   * Returns true if completed naturally, false if interrupted
   */
  async _interruptibleSleep(totalMs) {
    const interval = 1000; // Check every 1s
    let elapsed = 0;
    while (elapsed < totalMs) {
      if (this.shouldAbort || this.isPaused) return false;
      await this._sleep(Math.min(interval, totalMs - elapsed));
      elapsed += interval;
    }
    return true;
  }

  _extractDomain(url) {
    if (!url) return 'unknown';
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
}

export default BatchProcessor;
