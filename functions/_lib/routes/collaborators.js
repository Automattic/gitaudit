import { authenticate, requireRepositoryAdmin } from '../auth.js';
import { HttpError, json, noContent, readJson } from '../http.js';
import {
  addCollaborator,
  countAdmins,
  deleteMembership,
  findCollaborators,
  findMembership,
  findUserByUsername,
  updateMembership,
} from '../queries.js';

const BASE = '/api/repos/:owner/:repo/collaborators';

const isValidRole = (role) => ['admin', 'member'].includes(role);

const invalidRole = () =>
  new HttpError(400, 'Invalid role', { message: 'Role must be "admin" or "member"' });

// Collaborators are managed through GitHub for GitHub repositories
function requireCustomRepo({ repo }) {
  if (Number(repo.is_github)) {
    throw new HttpError(400, 'Not supported', {
      message: 'Collaborators are managed through GitHub for GitHub repositories',
    });
  }
}

async function findTarget({ db, params, repo }) {
  const user = await findUserByUsername(db, params.username);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const membership = await findMembership(db, user.id, repo.id);
  if (!membership) {
    throw new HttpError(404, 'Collaborator not found');
  }

  return { user, membership };
}

async function requireAnotherAdmin({ db, repo }, error) {
  if ((await countAdmins(db, repo.id)) <= 1) {
    throw new HttpError(400, error, {
      message: 'There must be at least one admin. Promote another user to admin first.',
    });
  }
}

export function collaboratorRoutes(router) {
  // List all collaborators for a repository
  router.get(BASE, authenticate, requireRepositoryAdmin, requireCustomRepo, async ({ db, repo }) =>
    json({
      collaborators: (await findCollaborators(db, repo.id)).map((collaborator) => ({
        userId: collaborator.user_id,
        username: collaborator.username,
        githubId: Number(collaborator.github_id),
        role: collaborator.role,
        dateAdded: new Date(Number(collaborator.date_added)).toISOString(),
      })),
    })
  );

  // Add a collaborator to a repository
  router.post(BASE, authenticate, requireRepositoryAdmin, requireCustomRepo, async ({ db, request, repo }) => {
    const { username, role = 'member' } = await readJson(request);

    if (!isValidRole(role)) throw invalidRole();

    if (!username || typeof username !== 'string') {
      throw new HttpError(400, 'Username is required');
    }

    // Find the user by username (must have logged in via OAuth)
    const user = await findUserByUsername(db, username);

    if (!user) {
      throw new HttpError(404, 'User not found', {
        message: `User "${username}" has not logged into this application yet. They must log in with GitHub OAuth before being added as a collaborator.`,
      });
    }

    if (await findMembership(db, user.id, repo.id)) {
      throw new HttpError(409, 'Already a collaborator', {
        message: `User "${username}" is already a collaborator on this repository`,
      });
    }

    await addCollaborator(db, user.id, repo.id, role);
    return json({ username: user.username, userId: user.id, role }, 201);
  });

  // Update a collaborator's role
  router.patch(`${BASE}/:username`, authenticate, requireRepositoryAdmin, requireCustomRepo, async (context) => {
    const { role } = await readJson(context.request);

    if (!isValidRole(role)) throw invalidRole();

    const { user, membership } = await findTarget(context);

    // Prevent demoting the last admin
    if (membership.role === 'admin' && role === 'member') {
      await requireAnotherAdmin(context, 'Cannot demote last admin');
    }

    await updateMembership(context.db, user.id, context.repo.id, role, null);
    return json({ username: user.username, role });
  });

  // Remove a collaborator
  router.delete(`${BASE}/:username`, authenticate, requireRepositoryAdmin, requireCustomRepo, async (context) => {
    const { user, membership } = await findTarget(context);

    // Prevent removing the last admin
    if (membership.role === 'admin') {
      await requireAnotherAdmin(context, 'Cannot remove last admin');
    }

    await deleteMembership(context.db, user.id, context.repo.id);
    return noContent();
  });
}
