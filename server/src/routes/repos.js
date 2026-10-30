import express from 'express';
import { authenticateToken, requireRepositoryAdmin, requireRepositoryAccess, getUserRoleWithRefresh } from '../middleware/auth.js';
import { searchGitHubRepositories, fetchUserRepositories, checkRepositoryAdminPermission } from '../services/github.js';
import { repoQueries, transaction } from '../db/queries.js';
import { toSqliteDateTime } from '../utils/dates.js';

const router = express.Router();

// Get user's SAVED repositories (from database)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const repos = repoQueries.findAllByUser.all(req.user.id);

    // Format response
    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      fullName: `${repo.owner}/${repo.name}`,
      description: repo.description,
      stars: repo.stars,
      language: repo.language,
      languageColor: repo.language_color,
      updatedAt: repo.updated_at,
      isPrivate: Boolean(repo.is_private),
      isGithub: Boolean(repo.is_github ?? true),
      url: repo.url || null,
    }));

    res.json({ repos: formattedRepos });
  } catch (error) {
    console.error('Error fetching saved repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get user's accessible repositories from GitHub (for browsing)
router.get('/browse', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;

    // Fetch user's repositories from GitHub
    const result = await fetchUserRepositories(req.user.accessToken, limit);

    res.json({ repos: result.nodes });
  } catch (error) {
    console.error('Error fetching accessible repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Search GitHub for repositories
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 3) {
      return res.status(400).json({ error: 'Search query must be at least 3 characters' });
    }

    // Call GitHub search API
    const results = await searchGitHubRepositories(req.user.accessToken, q);

    res.json({ repos: results });
  } catch (error) {
    console.error('Error searching repositories:', error);
    res.status(500).json({ error: 'Failed to search repositories' });
  }
});

// Save a repository to user's list
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { owner, name, githubId, description, stars, language, languageColor, updatedAt, isPrivate } = req.body;

    if (!owner || !name || !githubId) {
      return res.status(400).json({ error: 'Missing required fields: owner, name, githubId' });
    }

    // Convert GitHub's ISO 8601 date to SQLite format for consistency
    const sqliteUpdatedAt = updatedAt ? toSqliteDateTime(updatedAt) : null;

    // Check GitHub permission to determine role
    const isAdmin = await checkRepositoryAdminPermission(req.user.accessToken, owner, name);
    const role = isAdmin ? 'admin' : 'member';
    const lastSynced = new Date().toISOString();

    // Use transaction to save repo and link to user atomically
    const { metrics_token: _metricsToken, ...repo } = transaction(() => {
      // First, insert or update the repository
      const savedRepo = repoQueries.saveRepo.get(
        owner,
        name,
        githubId,
        description || null,
        stars || 0,
        language || null,
        languageColor || null,
        sqliteUpdatedAt,
        isPrivate ? 1 : 0
      );

      // Then, link the user to the repository with role and last_synced
      repoQueries.addUserRepoWithRole.run(req.user.id, savedRepo.id, role, lastSynced);

      return savedRepo;
    })();

    res.json({ repo, role });
  } catch (error) {
    console.error('Error saving repository:', error);
    res.status(500).json({ error: 'Failed to save repository' });
  }
});

// Create a local (non-GitHub) repository
router.post('/local', authenticateToken, async (req, res) => {
  try {
    const { name, url, description } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Missing required fields: name, url' });
    }

    // Use the authenticated user's username as the owner for URL routing consistency
    const owner = req.user.username;

    // Use transaction to create repo and link to user atomically
    const repo = transaction(() => {
      // Create the local repository
      const createdRepo = repoQueries.createLocalRepo.get(
        owner,
        name,
        description || null,
        url
      );

      // Link the user to the repository with admin role (creator is always admin)
      // last_synced is null for custom repos (no GitHub sync needed)
      repoQueries.addUserRepoWithRole.run(req.user.id, createdRepo.id, 'admin', null);

      return createdRepo;
    })();

    // Format response
    res.json({
      repo: {
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        fullName: `${repo.owner}/${repo.name}`,
        description: repo.description,
        url: repo.url,
        isGithub: false,
        stars: 0,
        language: null,
        languageColor: null,
        updatedAt: null,
        isPrivate: false,
      },
      role: 'admin'
    });
  } catch (error) {
    console.error('Error creating local repository:', error);
    res.status(500).json({ error: 'Failed to create local repository' });
  }
});

// Update a custom (non-GitHub) repository's info
router.patch('/:owner/:repo', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;
  const { url, description } = req.body;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Only allow updates to non-GitHub repos
    if (repo.is_github) {
      return res.status(400).json({
        error: 'Cannot update GitHub repository info. Repository data is synced from GitHub.'
      });
    }

    // Validate URL is not empty (use provided url, or fall back to existing)
    const finalUrl = url !== undefined ? url : repo.url;
    if (!finalUrl || finalUrl.trim() === '') {
      return res.status(400).json({
        error: 'Repository URL is required'
      });
    }

    // Update the repository
    const updatedRepo = repoQueries.updateLocalRepo.get(
      url ?? repo.url,
      description ?? repo.description,
      repo.id
    );

    if (!updatedRepo) {
      return res.status(500).json({ error: 'Failed to update repository' });
    }

    res.json({
      repo: {
        id: updatedRepo.id,
        name: updatedRepo.name,
        owner: updatedRepo.owner,
        fullName: `${updatedRepo.owner}/${updatedRepo.name}`,
        description: updatedRepo.description,
        url: updatedRepo.url,
        isGithub: false,
      }
    });
  } catch (error) {
    console.error('Error updating custom repository:', error);
    res.status(500).json({ error: 'Failed to update repository' });
  }
});

// Check user's permission level for a repository
// Returns the cached role from user_repositories table
router.get('/:owner/:repo/permission', authenticateToken, requireRepositoryAccess, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repoRecord = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repoRecord) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Get the user's role with staleness refresh for GitHub repos
    const role = await getUserRoleWithRefresh(req.user.id, repoRecord, req.user.accessToken);

    if (role === null) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You no longer have access to this repository',
      });
    }

    const isAdmin = role === 'admin';
    const userRepo = repoQueries.getUserRoleAndSync.get(req.user.id, repoRecord.id);

    res.json({
      permission: isAdmin ? 'ADMIN' : 'READ',
      role,
      isAdmin,
      isGithub: Boolean(repoRecord.is_github),
      lastSynced: userRepo?.last_synced || null,
    });
  } catch (error) {
    console.error('[API] Failed to check repository permission:', error);
    res.status(500).json({
      error: 'Failed to check repository permission',
      details: error.message
    });
  }
});

// Full repository deletion (admin only)
// Deletes the repository and all associated data (metrics, data points, collaborators)
router.delete('/:owner/:repo/full', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Delete from repositories table - cascades to all related data
    repoQueries.deleteById.run(repo.id);

    console.log(`[API] Repository ${owner}/${repoName} fully deleted by user ${req.user.username}`);

    res.json({
      success: true,
      message: 'Repository and all associated data deleted'
    });
  } catch (error) {
    console.error('Error deleting repository:', error);
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

export default router;
