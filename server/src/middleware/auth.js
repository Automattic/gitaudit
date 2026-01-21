import jwt from 'jsonwebtoken';
import { userQueries, repoQueries } from '../db/queries.js';

// Staleness threshold for GitHub permission refresh (1 day)
const ROLE_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Get user's role for a repository with staleness check for GitHub repos.
 * For GitHub repos, if the cached role is stale (>1 day), refreshes from GitHub API.
 * If the user has lost all access, removes their entry from user_repositories.
 * For custom repos, returns the cached role directly (no refresh needed).
 * @returns {Promise<string|null>} Role ('admin' or 'member') or null if no access
 */
async function getUserRoleWithRefresh(userId, repoRecord, accessToken) {
  const userRepo = repoQueries.getUserRoleAndSync.get(userId, repoRecord.id);

  if (!userRepo) {
    return null;
  }

  // For custom repos (is_github = 0), no refresh needed
  if (!repoRecord.is_github) {
    return userRepo.role;
  }

  // For GitHub repos, check if the cached role is stale
  const lastSynced = userRepo.last_synced ? new Date(userRepo.last_synced).getTime() : 0;
  const isStale = Date.now() - lastSynced > ROLE_STALE_THRESHOLD_MS;

  if (isStale) {
    // Refresh from GitHub API
    try {
      const { checkRepositoryPermission } = await import('../services/github.js');
      const permission = await checkRepositoryPermission(accessToken, repoRecord.owner, repoRecord.name);

      if (permission === null) {
        // User lost all access - remove entry from user_repositories
        repoQueries.deleteByUserAndId.run(repoRecord.id, userId);
        console.log(
          `[Auth] Removed stale entry: user ${userId} lost access to ${repoRecord.owner}/${repoRecord.name}`
        );
        return null; // Signal no access
      }

      // User still has access - update role based on permission level
      const newRole = permission === 'ADMIN' ? 'admin' : 'member';
      repoQueries.updateUserRoleAndSync.run(newRole, new Date().toISOString(), userId, repoRecord.id);

      console.log(
        `[Auth] Refreshed stale role for user ${userId} on ${repoRecord.owner}/${repoRecord.name}: ${newRole} (permission: ${permission})`
      );

      return newRole;
    } catch (error) {
      // If GitHub API fails, fall back to cached role
      console.warn(
        `[Auth] Failed to refresh role from GitHub, using cached: ${error.message}`
      );
      return userRepo.role;
    }
  }

  return userRepo.role;
}

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
 * Uses cached role from user_repositories table with staleness refresh for GitHub repos.
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
    const repoRecord = repoQueries.findByOwnerAndName.get(owner, repo);

    if (!repoRecord) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Get role with staleness refresh for GitHub repos
    const role = await getUserRoleWithRefresh(req.user.id, repoRecord, req.user.accessToken);

    if (role === 'admin') {
      req.repoRecord = repoRecord;
      console.log(
        `[Auth] User ${req.user.username} granted admin access to ${owner}/${repo} (role: ${role})`
      );
      return next();
    }

    console.warn(
      `[Auth] User ${req.user.username} denied admin access to ${owner}/${repo} (role: ${role || 'none'})`
    );
    return res.status(403).json({
      error: 'Admin access required',
      message: 'You must have admin permissions on this repository to access settings',
    });
  } catch (error) {
    console.error('[Auth] Error checking repository admin permission:', error);
    return res.status(500).json({
      error: 'Failed to verify permissions',
      message: 'Unable to verify your repository permissions. Please try again.',
    });
  }
}

/**
 * Middleware to verify user has read access to the repository
 * Checks if the user has the repository saved in their account (user_repositories table)
 * Must be used AFTER authenticateToken middleware
 * Expects req.params to contain owner and repo
 */
export function requireRepositoryAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { owner, repo } = req.params;

  if (!owner || !repo) {
    console.error('[Auth] Missing owner or repo in request params');
    return res.status(400).json({ error: 'Repository owner and name are required' });
  }

  const hasAccess = repoQueries.checkIfSaved.get(req.user.id, owner, repo);

  if (!hasAccess) {
    console.warn(`[Auth] User ${req.user.username} denied access to ${owner}/${repo}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have access to this repository',
    });
  }

  next();
}

/**
 * Optional authentication middleware
 * If token is present, validates it and attaches user to req
 * If no token, continues without user (req.user will be undefined)
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided - continue without user
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    const user = userQueries.findByGithubId.get(decoded.githubId);

    if (user) {
      req.user = {
        id: user.id,
        githubId: user.github_id,
        username: user.username,
        accessToken: user.access_token,
      };
    }
    // If user not found, just continue without user
    next();
  } catch {
    // Invalid token - continue without user (don't fail the request)
    next();
  }
}

/**
 * Middleware to allow access if user is authenticated with repo access OR repo has public metrics enabled
 * Sets req.isPublicAccess = true if accessing via public metrics (no auth)
 * Sets req.publicRepo with the repository data
 */
export function requireRepositoryAccessOrPublic(req, res, next) {
  const { owner, repo } = req.params;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Repository owner and name are required' });
  }

  // If user is authenticated, check they have access
  if (req.user) {
    const hasAccess = repoQueries.checkIfSaved.get(req.user.id, owner, repo);
    if (hasAccess) {
      req.isPublicAccess = false;
      req.publicRepo = repoQueries.findByOwnerAndName.get(owner, repo);
      return next();
    }
  }

  // No auth or no access - check if repo is public
  const repository = repoQueries.findByOwnerAndName.get(owner, repo);

  if (!repository || !repository.metrics_public) {
    // Return 404 to not reveal existence of private repos
    return res.status(404).json({
      error: 'Not found',
      message: 'Repository not found or metrics are not public',
    });
  }

  // Public access granted
  req.isPublicAccess = true;
  req.publicRepo = repository;
  next();
}
