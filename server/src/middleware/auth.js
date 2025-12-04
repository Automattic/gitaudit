import jwt from 'jsonwebtoken';
import { userQueries } from '../db/queries.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);

    // Get user from database
    const user = userQueries.findByGithubId.get(decoded.githubId);

    if (!user) {
      console.error('[Auth] User not found in database for githubId:', decoded.githubId);
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user and token to request
    req.user = {
      id: user.id,
      githubId: user.github_id,
      username: user.username,
      accessToken: user.access_token,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.error('[Auth] JWT token expired at:', error.expiredAt);
    } else if (error.name === 'JsonWebTokenError') {
      console.error('[Auth] JWT verification failed:', error.message);
    } else {
      console.error('[Auth] Token verification error:', error.message);
    }
    return res.status(403).json({ error: 'Invalid or expired token', details: error.message });
  }
}
