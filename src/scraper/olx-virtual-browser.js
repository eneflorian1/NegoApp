/**
 * OlxVirtualBrowser — Remote-controlled Puppeteer session
 *
 * Server opens a real Chrome browser navigated to OLX login.
 * Frontend streams screenshots and sends click/type commands.
 * When login succeeds, cookies are saved automatically.
 */

import { StealthBrowser, sleep } from './stealth-browser.js';
import OlxSession from './olx-session.js';
import { randomBytes } from 'crypto';

// Active sessions by id
const sessions = new Map();

// Kill idle sessions after 5 minutes
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Browser viewport (must match screenshot coordinate math)
const VP_W = 1280;
const VP_H = 720;

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

    await this.browser.page.goto('https://www.olx.ro/cont/', {
      waitUntil: 'networkidle2',
      timeout: 35000,
    });
    await sleep(1500);

    // Dismiss cookie consent if present
    try {
      const btn = await this.browser.page.$('#onetrust-accept-btn-handler');
      if (btn) { await btn.click(); await sleep(700); }
    } catch {}

    this.status = 'ready';
    this._bump();
  }

  /** Returns current page as base64 JPEG. Returns null if busy. */
  async screenshot() {
    if (!this.browser?.page || this.status === 'closed') return null;
    if (this._screenshotBusy) return null;
    this._screenshotBusy = true;
    try {
      const buf = await this.browser.page.screenshot({ type: 'jpeg', quality: 65 });
      return buf.toString('base64');
    } catch {
      return null;
    } finally {
      this._screenshotBusy = false;
    }
  }

  /**
   * Click at position (x, y) within a display area of size (displayW x displayH).
   * Coordinates are mapped to the browser's VP_W x VP_H viewport.
   */
  async click(x, y, displayW, displayH) {
    if (!this.browser?.page || this.status === 'closed') return;
    const bx = Math.round((x / displayW) * VP_W);
    const by = Math.round((y / displayH) * VP_H);
    await this.browser.page.mouse.click(bx, by);
    await sleep(500);
    this._bump();
    await this._detectLogin();
  }

  /** Type text into the currently focused element */
  async type(text) {
    if (!this.browser?.page || this.status === 'closed') return;
    await this.browser.page.keyboard.type(text, { delay: 45 });
    await sleep(200);
    this._bump();
  }

  /** Press a special key (Enter, Backspace, Tab, etc.) */
  async pressKey(key) {
    if (!this.browser?.page || this.status === 'closed') return;
    await this.browser.page.keyboard.press(key);
    await sleep(400);
    this._bump();
    await this._detectLogin();
  }

  /** Check if we landed on a post-login page and capture cookies */
  async _detectLogin() {
    try {
      const url = this.browser.page.url();
      const onLoginPage =
        url.includes('login.olx') ||
        url.includes('/cont/') ||
        url.includes('/login');

      if (!onLoginPage) {
        const cookies = await this.browser.page.cookies();
        if (cookies.length > 5) {
          OlxSession._saveCookies(cookies, 'virtual-browser');
          console.log(`[VirtualBrowser] Login detected — ${cookies.length} cookies saved`);
          this.status = 'loggedIn';
          // Keep browser alive briefly so UI can show success screenshot
          setTimeout(() => this.close(), 4000);
          return true;
        }
      }
    } catch {}
    return false;
  }

  /** Reset idle timer */
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
    console.log(`[VirtualBrowser] Session ${this.id} closed`);
  }
}

/** Create and register a new virtual browser session */
export async function createVirtualSession() {
  const session = new VirtualSession();
  sessions.set(session.id, session);
  return session;
}

/** Retrieve an existing session by id */
export function getVirtualSession(id) {
  return sessions.get(id) || null;
}
