/**
 * StealthBrowser - Puppeteer with anti-detection measures
 * 
 * Creates browser instances that resist fingerprinting:
 * - puppeteer-extra-plugin-stealth (evades common bot detections)
 * - Proxy integration per session
 * - Human-like behavior helpers (random delays, scrolling)
 * - Cookie/session persistence per identity
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Random delay between min and max ms
function sleep(min, max) {
  const ms = max ? Math.floor(Math.random() * (max - min) + min) : min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

class StealthBrowser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.proxy = null;
  }

  /**
   * Launch a stealth browser with proxy
   * @param {object} proxy - Proxy config: { host, port, protocol }
   * @param {object} options - Additional launch options
   */
  async launch(proxy = null, options = {}) {
    this.proxy = proxy;

    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1366,768',
    ];

    // Linux VPS without display server: Chrome needs GPU-disable flags
    if (process.platform === 'linux' && !process.env.DISPLAY) {
      args.push(
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        '--ozone-platform=headless',
      );
    }

    if (proxy) {
      args.push(`--proxy-server=${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`);
    }

    this.browser = await puppeteer.launch({
      headless: 'new',
      args,
      defaultViewport: {
        width: 1366,
        height: 768,
      },
      ...options,
    });

    this.page = await this.browser.newPage();

    // Set realistic user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Set realistic headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    // Override webdriver property
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Override chrome detection
      window.chrome = { runtime: {} };
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    return this;
  }

  /**
   * Inject cookies into the browser page (for authenticated sessions)
   * Must be called AFTER launch() and BEFORE goto()
   * @param {Array} cookies - Array of cookie objects from page.cookies()
   */
  async injectCookies(cookies) {
    if (!this.page || !cookies || cookies.length === 0) return;
    await this.page.setCookie(...cookies);
    console.log(`[StealthBrowser] Injected ${cookies.length} cookies`);
  }

  /**
   * Navigate to URL with human-like behavior
   */
  async goto(url, options = {}) {
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
      ...options,
    });

    // Wait a bit like a human would
    await sleep(1000, 2500);

    // Handle common popups (cookie consent, surveys)
    await this._handlePopups();

    return this.page;
  }

  /**
   * Close common popups on OLX and other sites
   */
  async _handlePopups() {
    const popupSelectors = [
      // OLX cookie consent
      '#onetrust-accept-btn-handler',
      // OLX survey popup close button
      '._close',
      'button[class*="close"]',
      // Generic cookie banners
      '[data-testid="cookie-accept"]',
      '.cookie-consent-accept',
    ];

    for (const selector of popupSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          });
          if (isVisible) {
            await element.click();
            await sleep(500, 1000);
          }
        }
      } catch (e) {
        // Popup not found or already closed, continue
      }
    }
  }

  /**
   * Scroll the page naturally (simulates reading)
   */
  async humanScroll(scrolls = 3) {
    for (let i = 0; i < scrolls; i++) {
      const scrollAmount = Math.floor(Math.random() * 300) + 200;
      await this.page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);
      await sleep(800, 2000);
    }
  }

  /**
   * Click an element with human-like behavior (random offset, delay)
   */
  async humanClick(selector) {
    const element = await this.page.waitForSelector(selector, { timeout: 10000 });
    if (!element) throw new Error(`Element not found: ${selector}`);

    // Get element bounding box
    const box = await element.boundingBox();
    if (!box) throw new Error(`Element not visible: ${selector}`);

    // Click at random position within the element
    const x = box.x + Math.random() * box.width;
    const y = box.y + Math.random() * box.height;

    // Move mouse to element first (more human-like)
    await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
    await sleep(100, 300);
    await this.page.mouse.click(x, y);
    await sleep(300, 800);

    return element;
  }

  /**
   * Extract text from a selector
   */
  async getText(selector) {
    try {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.evaluate(el => el.textContent.trim());
    } catch {
      return null;
    }
  }

  /**
   * Wait for element and extract its text
   */
  async waitAndGetText(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return await this.getText(selector);
    } catch {
      return null;
    }
  }

  /**
   * Get the current page URL
   */
  getUrl() {
    return this.page.url();
  }

  /**
   * Take a screenshot (for debugging)
   */
  async screenshot(path) {
    await this.page.screenshot({ path, fullPage: false });
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

export { StealthBrowser, sleep };
