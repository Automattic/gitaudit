import express from 'express';
import { authenticateToken, requireRepositoryAdmin } from '../middleware/auth.js';
import { repoQueries, userQueries, transaction } from '../db/queries.js';

const router = express.Router({ mergeParams: true });

/**
 * GET /api/repos/:owner/:repo/collaborators
 * List all collaborators for a repository (admin only)
 * Only works for custom (non-GitHub) repos
 */
router.get('/', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Only supported for non-GitHub repos
    if (repo.is_github) {
      return res.status(400).json({
        error: 'Not supported',
        message: 'Collaborators are managed through GitHub for GitHub repositories',
      });
    }

    const collaborators = repoQueries.findCollaboratorsByRepoId.all(repo.id);

    res.json({
      collaborators: collaborators.map(c => ({
        userId: c.user_id,
        username: c.username,
        githubId: c.github_id,
        role: c.role,
        dateAdded: c.date_added,
      })),
    });
  } catch (error) {
    console.error('[API] Failed to fetch collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

/**
 * POST /api/repos/:owner/:repo/collaborators
 * Add a collaborator to a repository (admin only)
 * Body: { username: string, role: 'admin' | 'member' }
 * Only works for custom (non-GitHub) repos
 */
router.post('/', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;
  const { username, role = 'member' } = req.body;

  try {
    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be "admin" or "member"',
      });
    }

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (repo.is_github) {
      return res.status(400).json({
        error: 'Not supported',
        message: 'Use GitHub to manage collaborators for GitHub repositories',
      });
    }

    // Find the user by username (must have logged in via OAuth)
    const targetUser = userQueries.findByUsername.get(username);

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `User "${username}" has not logged into this application yet. They must log in with GitHub OAuth before being added as a collaborator.`,
      });
    }

    // Check if already a collaborator
    const existing = repoQueries.getUserRoleAndSync.get(targetUser.id, repo.id);

    if (existing) {
      return res.status(409).json({
        error: 'Already a collaborator',
        message: `User "${username}" is already a collaborator on this repository`,
      });
    }

    // Add the collaborator (null last_synced for custom repos)
    repoQueries.addUserRepoWithRole.run(targetUser.id, repo.id, role, null);

    console.log(
      `[API] User ${req.user.username} added ${username} as ${role} to ${owner}/${repoName}`
    );

    res.status(201).json({
      username: targetUser.username,
      userId: targetUser.id,
      role: role,
    });
  } catch (error) {
    console.error('[API] Failed to add collaborator:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

/**
 * PATCH /api/repos/:owner/:repo/collaborators/:username
 * Update a collaborator's role (admin only)
 * Body: { role: 'admin' | 'member' }
 * Only works for custom (non-GitHub) repos
 */
router.patch('/:username', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName, username } = req.params;
  const { role } = req.body;

  try {
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be "admin" or "member"',
      });
    }

    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (repo.is_github) {
      return res.status(400).json({ error: 'Not supported for GitHub repositories' });
    }

    const targetUser = userQueries.findByUsername.get(username);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = repoQueries.getUserRoleAndSync.get(targetUser.id, repo.id);

    if (!existing) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    // Prevent demoting the last admin
    if (existing.role === 'admin' && role === 'member') {
      const adminCount = repoQueries.countAdminsByRepoId.get(repo.id);
      if (adminCount.count <= 1) {
        return res.status(400).json({
          error: 'Cannot demote last admin',
          message: 'There must be at least one admin. Promote another user to admin first.',
        });
      }
    }

    // Update the role (keep last_synced as null for custom repos)
    repoQueries.updateUserRoleAndSync.run(role, null, targetUser.id, repo.id);

    console.log(
      `[API] User ${req.user.username} updated ${username} role to ${role} in ${owner}/${repoName}`
    );

    res.json({
      username: targetUser.username,
      role: role,
    });
  } catch (error) {
    console.error('[API] Failed to update collaborator:', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

/**
 * DELETE /api/repos/:owner/:repo/collaborators/:username
 * Remove a collaborator (admin only)
 * Only works for custom (non-GitHub) repos
 */
router.delete('/:username', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName, username } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (repo.is_github) {
      return res.status(400).json({ error: 'Not supported for GitHub repositories' });
    }

    const targetUser = userQueries.findByUsername.get(username);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = repoQueries.getUserRoleAndSync.get(targetUser.id, repo.id);

    if (!existing) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    // Prevent removing the last admin
    if (existing.role === 'admin') {
      const adminCount = repoQueries.countAdminsByRepoId.get(repo.id);
      if (adminCount.count <= 1) {
        return res.status(400).json({
          error: 'Cannot remove last admin',
          message: 'There must be at least one admin. Promote another user to admin first.',
        });
      }
    }

    // Remove from user_repositories
    repoQueries.deleteByUserAndId.run(repo.id, targetUser.id);

    console.log(
      `[API] User ${req.user.username} removed ${username} from ${owner}/${repoName}`
    );

    res.status(204).send();
  } catch (error) {
    console.error('[API] Failed to remove collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

export default router;
