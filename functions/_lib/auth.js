import { HttpError } from './http.js';
import { signToken, verifyToken } from './jwt.js';
import { fetchRepositoryPermission, getValidAccessToken } from './github.js';
import {
  deleteMembership,
  findRepoForUser,
  findUserByGithubId,
  updateMembership,
} from './queries.js';

// Staleness threshold for GitHub permission refresh (1 day)
const ROLE_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const SESSION_SECONDS = 30 * 24 * 60 * 60;

export const createSessionToken = (user, secret) =>
  signToken({ githubId: Number(user.github_id), username: user.username }, secret, SESSION_SECONDS);

const bearerToken = (request) => request.headers.get('authorization')?.split(' ')[1];

async function loadUser(context, token) {
  const { githubId } = await verifyToken(token, context.env.SESSION_SECRET);
  return findUserByGithubId(context.db, githubId);
}

/** The request's GitHub token, refreshed only by the routes that call GitHub. */
export const githubToken = (context) => getValidAccessToken(context.env, context.user);

export async function authenticate(context) {
  const token = bearerToken(context.request);

  if (!token) {
    throw new HttpError(401, 'Authentication required');
  }

  let user;
  try {
    user = await loadUser(context, token);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, 'Invalid or expired token', { details: error.message });
  }

  if (!user) {
    throw new HttpError(401, 'User not found');
  }

  context.user = user;
}

/** Attach the user if the token is good, and carry on as a visitor if it isn't. */
export async function optionalAuth(context) {
  const token = bearerToken(context.request);
  if (!token) return;

  try {
    context.user = (await loadUser(context, token)) ?? undefined;
  } catch {
    // An invalid token doesn't stop someone reading a public dashboard
  }
}

const loadRepo = (context) =>
  findRepoForUser(context.db, context.params.owner, context.params.repo, context.user?.id ?? 0);

/**
 * The user's role on a repository, refreshed from GitHub once it's a day old.
 * If GitHub says they've lost access, they're removed from the repository. If GitHub
 * can't be reached, the role we already have stands.
 */
export async function resolveRole(context, repo) {
  if (!repo.role || !Number(repo.is_github)) {
    return repo.role;
  }

  if (Date.now() - Number(repo.last_synced ?? 0) <= ROLE_STALE_THRESHOLD_MS) {
    return repo.role;
  }

  try {
    const permission = await fetchRepositoryPermission(
      await githubToken(context),
      repo.owner,
      repo.name
    );

    if (permission === null) {
      await deleteMembership(context.db, context.user.id, repo.id);
      return null;
    }

    const role = permission === 'ADMIN' ? 'admin' : 'member';
    repo.last_synced = Date.now();
    await updateMembership(context.db, context.user.id, repo.id, role, repo.last_synced);
    return role;
  } catch (error) {
    console.warn(`[Auth] Failed to refresh role from GitHub, using cached: ${error.message}`);
    return repo.role;
  }
}

/** Requires the user to have the repository saved. Use after authenticate. */
export async function requireRepositoryAccess(context) {
  const repo = await loadRepo(context);

  if (!repo?.role) {
    throw new HttpError(403, 'Access denied', {
      message: 'You do not have access to this repository',
    });
  }

  context.repo = repo;
}

/** Requires the user to be an admin of the repository. Use after authenticate. */
export async function requireRepositoryAdmin(context) {
  const repo = await loadRepo(context);

  if (!repo) {
    throw new HttpError(404, 'Repository not found');
  }

  if ((await resolveRole(context, repo)) !== 'admin') {
    throw new HttpError(403, 'Admin access required', {
      message: 'You must have admin permissions on this repository to access settings',
    });
  }

  context.repo = repo;
}

/** Allows repository members, and anyone at all if its metrics are public. */
export async function requireRepositoryAccessOrPublic(context) {
  const repo = await loadRepo(context);

  if (!repo || (!repo.role && !Number(repo.metrics_public))) {
    // Return 404 to not reveal existence of private repos
    throw new HttpError(404, 'Not found', {
      message: 'Repository not found or metrics are not public',
    });
  }

  context.repo = repo;
}
