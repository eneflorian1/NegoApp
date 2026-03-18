/**
 * OlxSession — OLX cookie-based session management
 * 
 * Logs into OLX once, saves session cookies to disk.
 * Subsequent scraping sessions inject these cookies to appear authenticated.
 * 
 * Flow:
 * 1. login(email, password) → opens browser, fills form, saves cookies
 * 2. getCookies() → reads saved cookies for injection via page.setCookie()
 * 3. isValid() → checks if saved session is still alive (not expired)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { StealthBrowser, sleep } from './stealth-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, '..', '..', 'data', 'olx_session.json');

// OLX login page selectors (verified via browser inspection)
const SELECTORS = {
  emailInput: '#username',
  passwordInput: '#password',
  loginButton: '#Login',
  cookieConsent: '#onetrust-accept-btn-handler',
};

class OlxSession {
  /**
   * Login to OLX and save session cookies to disk
   * @param {string} email - OLX account email
   * @param {string} password - OLX account password
   * @returns {{ success: boolean, cookieCount: number, error?: string }}
   */
  static async login(email, password) {
    if (!email || !password) {
      return { success: false, cookieCount: 0, error: 'Email and password are required' };
    }

    const browser = new StealthBrowser();
    try {
      console.log('[OlxSession] Launching browser for login...');
      await browser.launch(null, { headless: 'new' });

      // Navigate to login page
      console.log('[OlxSession] Navigating to OLX login page...');
      await browser.page.goto('https://www.olx.ro/cont/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await sleep(2000, 3000);

      // Close cookie consent if present
      try {
        const consent = await browser.page.$(SELECTORS.cookieConsent);
        if (consent) {
          await consent.click();
          await sleep(1000, 1500);
          console.log('[OlxSession] Cookie consent dismissed');
        }
      } catch (e) { /* no consent popup */ }

      // Wait for login form
      await browser.page.waitForSelector(SELECTORS.emailInput, { timeout: 10000 });
      console.log('[OlxSession] Login form found');

      // Type email (human-like speed)
      await browser.page.click(SELECTORS.emailInput);
      await sleep(200, 400);
      await browser.page.type(SELECTORS.emailInput, email, { delay: 80 + Math.random() * 60 });
      await sleep(500, 800);

      // Type password
      await browser.page.click(SELECTORS.passwordInput);
      await sleep(200, 400);
      await browser.page.type(SELECTORS.passwordInput, password, { delay: 80 + Math.random() * 60 });
      await sleep(500, 1000);

      // Click login button
      console.log('[OlxSession] Submitting login...');
      await browser.page.click(SELECTORS.loginButton);

      // Wait for navigation (successful login redirects away from /cont/)
      try {
        await browser.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      } catch (e) {
        // May not navigate — check if we're still on the login page
      }
      await sleep(2000, 3000);

      // Check if login was successful
      const currentUrl = browser.page.url();
      const isStillOnLogin = currentUrl.includes('/cont/') || currentUrl.includes('/login');

      // Also check for error messages on the page
      const errorText = await browser.page.evaluate(() => {
        const errorEls = document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"]');
        for (const el of errorEls) {
          const text = el.textContent.trim();
          if (text.length > 0 && text.length < 200) return text;
        }
        return null;
      });

      if (errorText) {
        console.error(`[OlxSession] Login error: ${errorText}`);
        return { success: false, cookieCount: 0, error: `OLX login error: ${errorText}` };
      }

      if (isStillOnLogin) {
        // Could be a CAPTCHA or slow redirect — try waiting more
        await sleep(3000, 5000);
        const urlAfterWait = browser.page.url();
        if (urlAfterWait.includes('/cont/') || urlAfterWait.includes('/login')) {
          console.error('[OlxSession] Login failed — still on login page');
          await browser.screenshot(join(__dirname, '..', '..', 'data', 'olx_login_failed.png'));
          return { success: false, cookieCount: 0, error: 'Login failed - still on login page (possible CAPTCHA or wrong credentials)' };
        }
      }

      // Extract and save cookies
      const cookies = await browser.page.cookies();
      console.log(`[OlxSession] Login successful! Extracted ${cookies.length} cookies`);

      // Save to disk
      const sessionData = {
        cookies,
        loginDate: new Date().toISOString(),
        email: email.replace(/(.{2}).+(@.+)/, '$1***$2'), // Masked for logs
        userAgent: await browser.page.evaluate(() => navigator.userAgent),
      };

      // Ensure data dir exists
      const dataDir = dirname(SESSION_FILE);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
      console.log(`[OlxSession] Session saved to ${SESSION_FILE}`);

      return { success: true, cookieCount: cookies.length };

    } catch (error) {
      console.error(`[OlxSession] Login failed: ${error.message}`);
      return { success: false, cookieCount: 0, error: error.message };
    } finally {
      await browser.close();
    }
  }

  /**
   * Get saved cookies for injection into a browser page
   * @returns {Array|null} Cookie array ready for page.setCookie(), or null if no session
   */
  static getCookies() {
    if (!existsSync(SESSION_FILE)) {
      console.log('[OlxSession] No saved session found');
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
      if (!data.cookies || !Array.isArray(data.cookies)) {
        return null;
      }

      // Filter out expired cookies
      const now = Date.now() / 1000; // cookies use epoch seconds
      const validCookies = data.cookies.filter(c => {
        if (c.expires && c.expires > 0 && c.expires < now) return false;
        return true;
      });

      if (validCookies.length === 0) {
        console.log('[OlxSession] All cookies expired');
        return null;
      }

      return validCookies;
    } catch (e) {
      console.error(`[OlxSession] Error reading session: ${e.message}`);
      return null;
    }
  }

  /**
   * Check if the saved session is still valid (cookies exist and not all expired)
   * @returns {{ valid: boolean, cookieCount: number, loginDate: string|null, expiresAt: string|null }}
   */
  static isValid() {
    if (!existsSync(SESSION_FILE)) {
      return { valid: false, cookieCount: 0, loginDate: null, expiresAt: null };
    }

    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
      const cookies = data.cookies || [];
      const now = Date.now() / 1000;

      // Find the earliest-expiring important cookie (session/auth cookies)
      const authCookies = cookies.filter(c =>
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('ssid')
      );

      const relevantCookies = authCookies.length > 0 ? authCookies : cookies;
      const validCookies = relevantCookies.filter(c => {
        if (c.expires && c.expires > 0 && c.expires < now) return false;
        return true;
      });

      // Find earliest expiry for reporting
      const expiringCookies = validCookies
        .filter(c => c.expires && c.expires > 0)
        .sort((a, b) => a.expires - b.expires);

      const earliestExpiry = expiringCookies.length > 0
        ? new Date(expiringCookies[0].expires * 1000).toISOString()
        : null;

      return {
        valid: validCookies.length > 0,
        cookieCount: validCookies.length,
        loginDate: data.loginDate || null,
        expiresAt: earliestExpiry,
      };
    } catch (e) {
      return { valid: false, cookieCount: 0, loginDate: null, expiresAt: null };
    }
  }

  /**
   * Delete saved session
   */
  static clear() {
    if (existsSync(SESSION_FILE)) {
      unlinkSync(SESSION_FILE);
      console.log('[OlxSession] Session cleared');
    }
  }
}

export default OlxSession;
