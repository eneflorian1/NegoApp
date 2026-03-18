/**
 * Session Routes — /api/session
 * Manages OLX session login and status
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import OlxSession from '../scraper/olx-session.js';

export default function createSessionRoutes() {
  const router = Router();
  router.use(requireAuth);

  // Track active login to prevent concurrent logins
  let loginInProgress = false;

  /**
   * POST /api/session/olx/login
   * Body: { email, password }
   * Triggers OLX login and saves session cookies
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
   * GET /api/session/olx/status
   * Returns session validity info
   */
  router.get('/session/olx/status', (req, res) => {
    const status = OlxSession.isValid();
    res.json(status);
  });

  return router;
}
