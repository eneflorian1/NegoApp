/**
 * Auth Routes — /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/me
 */
import { Router } from 'express';
import { createUser, findUserByUsername, findUserById } from '../db/models/User.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import ConfigRepo from '../db/models/Config.js';

const COOKIE_OPTS = { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' };

export default function createAuthRoutes() {
  const router = Router();

  router.post('/auth/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    try {
      const user = await createUser(username, password, email);
      // Init default config for new user
      await ConfigRepo.initUser(user._id.toString());
      const token = generateToken(user);
      res.cookie('token', token, COOKIE_OPTS);
      res.json({ ok: true, username: user.username, id: user._id });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Username already taken' });
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
      const user = await findUserByUsername(username);
      if (!user || !(await user.checkPassword(password))) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      // Ensure config exists for this user
      await ConfigRepo.initUser(user._id.toString());
      const token = generateToken(user);
      res.cookie('token', token, COOKIE_OPTS);
      res.json({ ok: true, username: user.username, id: user._id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await findUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ id: user._id, username: user.username, email: user.email });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
