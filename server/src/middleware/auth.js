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
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
