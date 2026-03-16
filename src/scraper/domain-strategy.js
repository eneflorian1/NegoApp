/**
 * DomainStrategy — Manages cached extraction strategies per domain
 * 
 * Strategies are stored as JSON files in data/strategies/
 * Each strategy contains selectors, reveal approaches, and rate limits
 * that have been proven to work for a specific marketplace domain.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STRATEGIES_DIR = join(__dirname, '..', '..', 'data', 'strategies');

class DomainStrategy {
  constructor() {
    // Ensure strategies directory exists
    if (!existsSync(STRATEGIES_DIR)) {
      mkdirSync(STRATEGIES_DIR, { recursive: true });
    }
  }

  /**
   * Load a cached strategy for a domain
   * @param {string} domain - e.g. "olx.ro"
   * @returns {object|null} Strategy object or null if not found
   */
  load(domain) {
    const filePath = join(STRATEGIES_DIR, `${domain}.json`);
    if (!existsSync(filePath)) return null;

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      console.log(`[Strategy] Loaded cached strategy for ${domain} (v${data.version}, success: ${(data.successRate * 100).toFixed(0)}%)`);
      return data;
    } catch (err) {
      console.error(`[Strategy] Failed to load strategy for ${domain}:`, err.message);
      return null;
    }
  }

  /**
   * Save a strategy for a domain
   * @param {string} domain
   * @param {object} strategy
   */
  save(domain, strategy) {
    const filePath = join(STRATEGIES_DIR, `${domain}.json`);
    strategy.lastUpdated = new Date().toISOString().split('T')[0];
    writeFileSync(filePath, JSON.stringify(strategy, null, 2));
    console.log(`[Strategy] Saved strategy for ${domain}`);
  }

  /**
   * Update success rate tracking
   * @param {string} domain
   * @param {boolean} success - whether the last operation was successful
   */
  updateSuccessRate(domain, success) {
    const strategy = this.load(domain);
    if (!strategy) return;

    // Exponential moving average
    const alpha = 0.1;
    strategy.successRate = strategy.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;

    // Invalidate strategy if success rate drops below 50%
    if (strategy.successRate < 0.5) {
      strategy.status = 'degraded';
      console.warn(`[Strategy] ${domain} strategy degraded (success rate: ${(strategy.successRate * 100).toFixed(0)}%)`);
    }

    this.save(domain, strategy);
  }

  /**
   * List all known domains with their strategies
   * @returns {Array<{domain: string, status: string, successRate: number}>}
   */
  listAll() {
    if (!existsSync(STRATEGIES_DIR)) return [];

    const files = readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json'));

    return files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(STRATEGIES_DIR, f), 'utf-8'));
        return {
          domain: data.domain,
          status: data.status || 'active',
          successRate: data.successRate,
          version: data.version,
          lastUpdated: data.lastUpdated,
        };
      } catch {
        return { domain: f.replace('.json', ''), status: 'error', successRate: 0 };
      }
    });
  }
}

export default DomainStrategy;
