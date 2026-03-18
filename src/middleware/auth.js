/**
 * Auth Middleware — JWT via httpOnly cookie or Authorization header
 */
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'negoapp-secret-change-in-production';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}
