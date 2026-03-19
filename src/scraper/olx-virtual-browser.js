/**
 * OlxVirtualBrowser — Remote-controlled Puppeteer session
 *
 * Server opens Chrome → OLX login page.
 * Frontend streams screenshots; autofill fills credentials automatically.
 * Manual click/scroll available for CAPTCHA or unexpected flows.
 */

import { StealthBrowser, sleep } from './stealth-browser.js';
import OlxSession from './olx-session.js';
import { randomBytes } from 'crypto';

const sessions = new Map();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Wider viewport so CAPTCHA modals fit
const VP_W = 1280;
const VP_H = 900;

const SELECTORS = {
  email: '#username',
  password: '#password',
  loginBtn: '#Login',
  cookieConsent: '#onetrust-accept-btn-handler',
};

class VirtualSession {
  constructor() {
    this.id = randomBytes(8).toString('hex');
    this.browser = new StealthBrowser();
    this.status = 'starting'; // starting | ready | loggedIn | closed
    this._screenshotBusy = false;
    this._timer = null;
  }

  async start() {
    await this.browser.launch(null, { headless: 'new' });
    await this.browser.page.setViewport({ width: VP_W, height: VP_H });

    // Listen for new pages (Google popup, etc.)
    this.browser.browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        const newPage = await target.page();
        if (newPage) {
          await sleep(800);
          // Switch active page to the new popup
          this.browser.page = newPage;
          await newPage.setViewport({ width: VP_W, height: VP_H });
          console.log(`[VirtualBrowser] Switched to new page: ${newPage.url()}`);
        }
      }
    });

    await this.browser.page.goto('https://www.olx.ro/cont/', {
      waitUntil: 'networkidle2',
      timeout: 35000,
    });
    await sleep(1500);

    try {
      const btn = await this.browser.page.$(SELECTORS.cookieConsent);
      if (btn) { await btn.click(); await sleep(700); }
    } catch {}

    this.status = 'ready';
    this._bump();
  }

  /** Returns current page screenshot as base64 JPEG. Returns null if busy. */
  async screenshot() {
    if (!this.browser?.page || this.status === 'closed') return null;
    if (this._screenshotBusy) return null;
    this._screenshotBusy = true;
    try {
      const buf = await this.browser.page.screenshot({ type: 'jpeg', quality: 70 });
      return buf.toString('base64');
    } catch {
      return null;
    } finally {
      this._screenshotBusy = false;
    }
  }

  /**
   * Auto-fill email + password and submit.
   * Puppeteer does the typing — user doesn't need to interact with fields.
   */
  async autofill(email, password) {
    if (!this.browser?.page || this.status === 'closed') return { ok: false, error: 'Browser closed' };
    this._bump();
    try {
      // Make sure we're on the login page
      const url = this.browser.page.url();
      if (!url.includes('login.olx') && !url.includes('/cont/') && !url.includes('/login')) {
        return { ok: false, error: 'Nu suntem pe pagina de login' };
      }

      // Click + clear + fill email
      await this.browser.page.waitForSelector(SELECTORS.email, { timeout: 8000 });
      await this.browser.page.click(SELECTORS.email, { clickCount: 3 });
      await sleep(200);
      await this.browser.page.type(SELECTORS.email, email, { delay: 50 });
      await this.browser.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) ['input', 'change', 'blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
      }, SELECTORS.email);
      await sleep(500);

      // Click + clear + fill password
      await this.browser.page.click(SELECTORS.password, { clickCount: 3 });
      await sleep(200);
      await this.browser.page.type(SELECTORS.password, password, { delay: 50 });
      await this.browser.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) ['input', 'change', 'blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
      }, SELECTORS.password);
      await sleep(1000);

      // Wait for Login button to enable (max 8s)
      let enabled = false;
      for (let i = 0; i < 16; i++) {
        enabled = await this.browser.page.evaluate((sel) => {
          const btn = document.querySelector(sel);
          return btn ? !btn.disabled : false;
        }, SELECTORS.loginBtn);
        if (enabled) break;
        await sleep(500);
      }

      if (!enabled) {
        return { ok: false, error: 'Butonul Login nu s-a activat. Verifică email-ul și parola.' };
      }

      await this.browser.page.click(SELECTORS.loginBtn);
      await sleep(1500);
      await this._detectLogin();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Click at (x, y) relative to displayed image of size (displayW x displayH).
   * Mapped to browser viewport coordinates.
   */
  async click(x, y, displayW, displayH) {
    if (!this.browser?.page || this.status === 'closed') return;
    const bx = Math.round((x / displayW) * VP_W);
    const by = Math.round((y / displayH) * VP_H);
    await this.browser.page.mouse.click(bx, by);
    await sleep(600);
    this._bump();
    await this._detectLogin();
  }

  /** Type text into the currently focused browser element */
  async type(text) {
    if (!this.browser?.page || this.status === 'closed') return;
    await this.browser.page.keyboard.type(text, { delay: 45 });
    await sleep(200);
    this._bump();
  }

  /** Press a special key */
  async pressKey(key) {
    if (!this.browser?.page || this.status === 'closed') return;
    await this.browser.page.keyboard.press(key);
    await sleep(400);
    this._bump();
    await this._detectLogin();
  }

  /** Scroll the page by deltaY pixels */
  async scroll(deltaY) {
    if (!this.browser?.page || this.status === 'closed') return;
    await this.browser.page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), deltaY);
    await sleep(500);
    this._bump();
  }

  /** Check if login succeeded and capture cookies */
  async _detectLogin() {
    try {
      const url = this.browser.page.url();
      const onLoginPage =
        url.includes('login.olx') ||
        url.includes('/cont/') ||
        url.includes('/login') ||
        url.includes('accounts.google') ||
        url.includes('captcha');

      if (!onLoginPage) {
        // Try to collect cookies from all open pages
        const pages = await this.browser.browser.pages();
        let allCookies = [];
        for (const p of pages) {
          try {
            const c = await p.cookies();
            allCookies = [...allCookies, ...c];
          } catch {}
        }
        // Deduplicate by name
        const seen = new Set();
        const cookies = allCookies.filter(c => {
          if (seen.has(c.name)) return false;
          seen.add(c.name);
          return true;
        });

        if (cookies.length > 5) {
          OlxSession._saveCookies(cookies, 'virtual-browser');
          console.log(`[VirtualBrowser] ✅ Login detected — ${cookies.length} cookies saved`);
          this.status = 'loggedIn';
          setTimeout(() => this.close(), 4000);
          return true;
        }
      }
    } catch {}
    return false;
  }

  _bump() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      console.log(`[VirtualBrowser] Session ${this.id} timed out`);
      this.close();
    }, IDLE_TIMEOUT_MS);
  }

  async close() {
    if (this.status === 'closed') return;
    this.status = 'closed';
    if (this._timer) clearTimeout(this._timer);
    sessions.delete(this.id);
    try { await this.browser.close(); } catch {}
  }
}

export async function createVirtualSession() {
  const session = new VirtualSession();
  sessions.set(session.id, session);
  return session;
}

export function getVirtualSession(id) {
  return sessions.get(id) || null;
}
