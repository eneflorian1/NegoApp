/**
 * CategoryScraper — Extracts all listing URLs from a marketplace category page
 * 
 * Uses domain strategy (cached selectors) to navigate category pages,
 * extract listing cards, and handle pagination automatically.
 * 
 * Input:  Category URL (e.g., https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/)
 * Output: Array of { url, title, price, thumbnail } for each listing found
 * 
 * Depends on: DomainStrategy, StealthBrowser
 */

import DomainStrategy from './domain-strategy.js';
import { StealthBrowser, sleep, killZombieChrome } from './stealth-browser.js';

class CategoryScraper {
  constructor(options = {}) {
    this.domainStrategy = options.domainStrategy || new DomainStrategy();
    this.siteIntelligence = options.siteIntelligence || null;
    this.proxyManager = options.proxyManager || null;
    this.options = {
      maxPages: options.maxPages || 5,
      maxListings: options.maxListings || 200,
      delayBetweenPages: options.delayBetweenPages || [2000, 4000], // [min, max] ms
      headless: options.headless !== false,
      ...options,
    };
    this.shouldAbort = false;
  }

  /**
   * Stop the current scraping process
   */
  stop() {
    this.shouldAbort = true;
    console.log('[CategoryScraper] Stop requested');
  }

  /**
   * Scrape listings from a category URL
   * @param {string} categoryUrl - Full category page URL
   * @param {object} opts - Override options per call
   * @returns {{ listings: Array, pagesScraped: number, domain: string }}
   */
  async scrape(categoryUrl, opts = {}) {
    const maxPages = opts.maxPages || this.options.maxPages;
    const maxListings = opts.maxListings || this.options.maxListings;

    // Detect domain
    const urlObj = new URL(categoryUrl);
    const domain = urlObj.hostname.replace('www.', '');

    // Load strategy
    const strategy = this.domainStrategy.load(domain);
    if (!strategy) {
      throw new Error(`No strategy found for ${domain}. Run SiteIntelligence.discover() first or add a manual strategy.`);
    }

    const selectors = strategy.categorySelectors;
    if (!selectors || !selectors.listingCard) {
      throw new Error(`Strategy for ${domain} has no categorySelectors. Cannot scrape.`);
    }

    console.log(`[CategoryScraper] ${domain}: ${maxListings} listings from max ${maxPages} pages`);

    // Kill any zombie Chrome from previous crashes before launching
    killZombieChrome();

    const browser = new StealthBrowser();
    const allListings = [];
    let pagesScraped = 0;
    let currentUrl = categoryUrl;

    try {
      await browser.launch(null, { headless: this.options.headless ? 'new' : false });

      while (pagesScraped < maxPages && allListings.length < maxListings) {
        if (this.shouldAbort) {
          console.log('[CategoryScraper] Scrape aborted by user');
          break;
        }

        console.log(`[CategoryScraper] Page ${pagesScraped + 1}/${maxPages}: ${currentUrl}`);

        await browser.goto(currentUrl, { waitUntil: 'domcontentloaded' });
        await sleep(1000, 2000);

        // Extract listing cards from this page
        const pageListings = await this._extractListings(browser, selectors, domain);
        console.log(`[CategoryScraper] Found ${pageListings.length} listings on page ${pagesScraped + 1}`);

        if (pageListings.length === 0) {
          console.log(`[CategoryScraper] No listings found, stopping pagination`);
          break;
        }

        // Deduplicate by URL
        for (const listing of pageListings) {
          if (allListings.length >= maxListings) break;
          const isDuplicate = allListings.some(l => l.url === listing.url);
          if (!isDuplicate) {
            allListings.push(listing);
          }
        }

        pagesScraped++;

        // Check for next page
        if (pagesScraped < maxPages && allListings.length < maxListings) {
          const nextUrl = await this._getNextPageUrl(browser, selectors, currentUrl, pagesScraped);
          if (!nextUrl) {
            console.log(`[CategoryScraper] No next page found, stopping`);
            break;
          }
          currentUrl = nextUrl;

          // Human-like delay between pages
          const [minDelay, maxDelay] = this.options.delayBetweenPages;
          await sleep(minDelay, maxDelay);
        }
      }
    } finally {
      await browser.close();
    }

    console.log(`[CategoryScraper] Done. ${allListings.length} listings from ${pagesScraped} pages`);

    return {
      listings: allListings,
      pagesScraped,
      domain,
      totalFound: allListings.length,
      scrapedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract listing data from the current page
   */
  async _extractListings(browser, selectors, domain) {
    const listings = await browser.page.evaluate((sel, dom) => {
      const cards = document.querySelectorAll(sel.listingCard);
      const results = [];

      for (const card of cards) {
        try {
          // Extract link
          let linkEl = sel.listingLink
            ? card.querySelector(sel.listingLink.replace(sel.listingCard + ' ', ''))
            : card.querySelector('a[href]');
          // Fallback: if listingLink selector includes the card itself, try direct
          if (!linkEl) linkEl = card.querySelector('a[href]');
          if (!linkEl && card.tagName === 'A') linkEl = card;

          const href = linkEl?.href;
          if (!href || href === '#') continue;

          // Skip promoted/ad links that go to external sites
          try {
            const linkUrl = new URL(href);
            if (!linkUrl.hostname.includes(dom)) continue;
          } catch { continue; }

          // Extract title
          const titleEl = card.querySelector('h6, h4, h3, h2, [class*="title"], [data-testid*="title"]');
          const title = titleEl?.textContent?.trim() || '';

          // Extract price
          const priceEl = card.querySelector('[data-testid*="price"], [class*="price"], .price');
          const priceText = priceEl?.textContent?.trim() || '';

          // Extract thumbnail
          const imgEl = card.querySelector('img[src]');
          const thumbnail = imgEl?.src || null;

          // Extract location if available
          const locEl = card.querySelector('[class*="location"], [data-testid*="location"]');
          const location = locEl?.textContent?.trim() || '';

          results.push({
            url: href,
            title,
            price: priceText,
            thumbnail,
            location,
          });
        } catch (e) {
          // Skip malformed cards
        }
      }

      return results;
    }, selectors, domain);

    // Normalize URLs
    return listings.map(l => ({
      ...l,
      url: l.url.startsWith('http') ? l.url : `https://www.${domain}${l.url}`,
      domain,
      scrapedAt: new Date().toISOString(),
    }));
  }

  /**
   * Find the next page URL using various pagination strategies
   */
  async _getNextPageUrl(browser, selectors, currentUrl, currentPage) {
    // Strategy 1: Next page button/link
    if (selectors.nextPage) {
      const nextUrl = await browser.page.evaluate((sel) => {
        const nextBtn = document.querySelector(sel);
        if (!nextBtn) return null;

        // Check if it's a link
        if (nextBtn.tagName === 'A' && nextBtn.href) return nextBtn.href;

        // Check parent link
        const parentLink = nextBtn.closest('a[href]');
        if (parentLink) return parentLink.href;

        // It's a button — check if clicking navigates (we'll handle this separately)
        return '__CLICK_NEEDED__';
      }, selectors.nextPage);

      if (nextUrl && nextUrl !== '__CLICK_NEEDED__') {
        return nextUrl;
      }

      if (nextUrl === '__CLICK_NEEDED__') {
        // Click the next button and return the new URL after navigation
        try {
          await browser.page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (btn) btn.click();
          }, selectors.nextPage);
          await sleep(2000, 3000);
          const newUrl = browser.page.url();
          if (newUrl !== currentUrl) return newUrl;
        } catch (e) {
          console.log(`[CategoryScraper] Next button click failed: ${e.message}`);
        }
      }
    }

    // Strategy 2: URL pattern-based pagination (page=N)
    const urlObj = new URL(currentUrl);
    const pageParam = urlObj.searchParams.get('page');
    if (pageParam !== null) {
      urlObj.searchParams.set('page', String(Number(pageParam) + 1));
      return urlObj.toString();
    }

    // Strategy 3: Try appending page parameter
    // Many OLX category pages use ?page=N
    urlObj.searchParams.set('page', String(currentPage + 1));
    return urlObj.toString();
  }
}

export default CategoryScraper;
