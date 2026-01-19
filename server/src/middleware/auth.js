import jwt from 'jsonwebtoken';
import { userQueries, repoQueries } from '../db/queries.js';

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

/**
 * Middleware to verify user has admin permission for the repository
 * Must be used AFTER authenticateToken middleware
 * Expects req.params to contain owner and repo
 */
export async function requireRepositoryAdmin(req, res, next) {
  // Ensure user is authenticated first
  if (!req.user || !req.user.accessToken) {
    console.error('[Auth] requireRepositoryAdmin called without authenticated user');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { owner, repo } = req.params;

  // Validate required parameters
  if (!owner || !repo) {
    console.error('[Auth] Missing owner or repo in request params');
    return res.status(400).json({ error: 'Repository owner and name are required' });
  }

  try {
    // First check if this is a non-GitHub repo
    const repoRecord = repoQueries.findByOwnerAndName.get(owner, repo);

    if (repoRecord && !repoRecord.is_github) {
      // For non-GitHub repos, the owner (which is the user's username) has admin access
      const hasAdminPermission = repoRecord.owner === req.user.username;

      if (!hasAdminPermission) {
        console.warn(
          `[Auth] User ${req.user.username} denied admin access to local repo ${owner}/${repo}`
        );
        return res.status(403).json({
          error: 'Admin access required',
          message: 'You must be the owner of this repository to access settings',
        });
      }

      console.log(
        `[Auth] User ${req.user.username} granted admin access to local repo ${owner}/${repo}`
      );
      return next();
    }

    // For GitHub repos, check permission via GitHub API
    const { checkRepositoryAdminPermission } = await import('../services/github.js');

    const hasAdminPermission = await checkRepositoryAdminPermission(
      req.user.accessToken,
      owner,
      repo
    );

    if (!hasAdminPermission) {
      console.warn(
        `[Auth] User ${req.user.username} denied admin access to ${owner}/${repo}`
      );
      return res.status(403).json({
        error: 'Admin access required',
        message: 'You must have admin permissions on this repository to access settings',
      });
    }

    // User has admin permission, proceed
    console.log(
      `[Auth] User ${req.user.username} granted admin access to ${owner}/${repo}`
    );
    next();
  } catch (error) {
    console.error('[Auth] Error checking repository admin permission:', error);
    return res.status(500).json({
      error: 'Failed to verify permissions',
      message: 'Unable to verify your repository permissions. Please try again.',
    });
  }
}
