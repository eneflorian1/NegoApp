/**
 * Session Routes — /api/session
 * Manages OLX session login, import, and status
 */
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import OlxSession from '../scraper/olx-session.js';
import { createVirtualSession, getVirtualSession } from '../scraper/olx-virtual-browser.js';

// One-time tokens for browser cookie drop (token → { createdAt })
const grabTokens = new Map();
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export default function createSessionRoutes() {
  const router = Router();

  // ── Public endpoint: receive cookies from user's browser (OLX domain) ────
  // No auth required — validated via one-time token instead
  router.post('/session/olx/cookie-drop', (req, res) => {
    const { token, cookies } = req.body;
    if (!token || !cookies) {
      return res.status(400).json({ success: false, error: 'Token and cookies are required' });
    }
    const entry = grabTokens.get(token);
    if (!entry) {
      return res.status(403).json({ success: false, error: 'Token invalid or expired' });
    }
    // Single-use: delete immediately
    grabTokens.delete(token);

    if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
      return res.status(403).json({ success: false, error: 'Token expired' });
    }

    try {
      const result = OlxSession.importCookies(cookies);
      console.log(`[CookieDrop] ✅ Received ${result.cookieCount || 0} cookies from user browser`);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── All remaining endpoints require auth ──────────────────────────────────
  router.use(requireAuth);

  /**
   * POST /api/session/olx/grab-token
   * Generates a one-time token for the cookie-drop script
   */
  router.post('/session/olx/grab-token', (req, res) => {
    // Clean expired tokens
    const now = Date.now();
    for (const [t, v] of grabTokens) {
      if (now - v.createdAt > TOKEN_TTL_MS) grabTokens.delete(t);
    }
    const token = randomBytes(24).toString('hex');
    grabTokens.set(token, { createdAt: now });
    res.json({ token });
  });

  let loginInProgress = false;

  /**
   * POST /api/session/olx/login
   * Body: { email, password }
   */
  router.post('/session/olx/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (loginInProgress) {
      return res.status(429).json({ error: 'Login already in progress. Please wait.' });
    }

    loginInProgress = true;
    try {
      console.log(`[API] OLX login requested for ${email.replace(/(.{2}).+(@.+)/, '$1***$2')}`);
      const result = await OlxSession.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      loginInProgress = false;
    }
  });

  /**
   * POST /api/session/olx/import
   * Body: { cookies: "cookie string or JSON array" }
   * Manual cookie import from user's browser
   */
  router.post('/session/olx/import', (req, res) => {
    const { cookies } = req.body;
    if (!cookies || typeof cookies !== 'string' || cookies.trim().length === 0) {
      return res.status(400).json({ error: 'Cookie string is required' });
    }

    try {
      const result = OlxSession.importCookies(cookies);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/session/olx/status
   */
  router.get('/session/olx/status', (req, res) => {
    const status = OlxSession.isValid();
    res.json(status);
  });

  // ── Virtual Browser Endpoints ──────────────────────────────────────────────

  /**
   * POST /api/session/olx/vb/start
   * Launches a headless Chrome, navigates to OLX login. Returns sessionId + first screenshot.
   */
  router.post('/session/olx/vb/start', async (req, res) => {
    try {
      const session = await createVirtualSession();
      await session.start();
      const screenshot = await session.screenshot();
      res.json({ sessionId: session.id, screenshot, status: session.status });
    } catch (error) {
      console.error('[VB] start error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/session/olx/vb/:id/screenshot
   * Returns the latest screenshot of the virtual browser.
   */
  router.get('/session/olx/vb/:id/screenshot', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
    const screenshot = await session.screenshot();
    res.json({ screenshot, status: session.status });
  });

  /**
   * POST /api/session/olx/vb/:id/click
   * Body: { x, y, displayW, displayH }
   */
  router.post('/session/olx/vb/:id/click', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
    const { x, y, displayW, displayH } = req.body;
    try {
      await session.click(x, y, displayW, displayH);
      const screenshot = await session.screenshot();
      res.json({ screenshot, status: session.status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/session/olx/vb/:id/type
   * Body: { text }
   */
  router.post('/session/olx/vb/:id/type', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
    try {
      await session.type(req.body.text || '');
      const screenshot = await session.screenshot();
      res.json({ screenshot, status: session.status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/session/olx/vb/:id/key
   * Body: { key } — e.g. "Enter", "Tab", "Backspace"
   */
  router.post('/session/olx/vb/:id/key', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
    try {
      await session.pressKey(req.body.key || 'Enter');
      const screenshot = await session.screenshot();
      res.json({ screenshot, status: session.status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/session/olx/vb/:id/autofill
   * Body: { email, password }
   * Puppeteer fills and submits the OLX login form automatically.
   */
  router.post('/session/olx/vb/:id/autofill', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
      const result = await session.autofill(email, password);
      const screenshot = await session.screenshot();
      res.json({ ...result, screenshot, status: session.status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/session/olx/vb/:id/scroll
   * Body: { deltaY } — positive = down, negative = up
   */
  router.post('/session/olx/vb/:id/scroll', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session expired or not found' });
    try {
      await session.scroll(req.body.deltaY || 300);
      const screenshot = await session.screenshot();
      res.json({ screenshot, status: session.status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/session/olx/vb/:id/close
   */
  router.post('/session/olx/vb/:id/close', async (req, res) => {
    const session = getVirtualSession(req.params.id);
    if (session) await session.close();
    res.json({ ok: true });
  });

  return router;
}
