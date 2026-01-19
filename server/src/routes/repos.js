import express from 'express';
import { authenticateToken, requireRepositoryAdmin } from '../middleware/auth.js';
import { searchGitHubRepositories, fetchUserRepositories } from '../services/github.js';
import { repoQueries, issueQueries, analysisQueries, prQueries, transaction } from '../db/queries.js';
import { toSqliteDateTime } from '../utils/dates.js';
import { getCurrentJobForRepo, queueJob } from '../services/job-queue.js';

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

// Unified fetch endpoint - schedules both issue and PR fetching
router.post('/:owner/:repo/fetch', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    // Check if repository is saved by this user
    const savedRepo = repoQueries.checkIfSaved.get(req.user.id, owner, repoName);

    if (!savedRepo) {
      return res.status(403).json({
        error: 'Repository not saved. Please add this repository to your list first.'
      });
    }

    // Get repository record (must exist since it's saved)
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Queue both issue-fetch and pr-fetch jobs
    queueJob({
      type: 'issue-fetch',
      repoId: repo.id,
      userId: req.user.id,
      args: {},
      priority: 50,
    });

    queueJob({
      type: 'pr-fetch',
      repoId: repo.id,
      userId: req.user.id,
      args: {},
      priority: 50,
    });

    res.json({
      message: 'Data fetch queued (issues and PRs)',
      repoId: repo.id,
    });
  } catch (error) {
    console.error('Error queueing data fetch:', error);
    res.status(500).json({ error: 'Failed to queue data fetch' });
  }
});

// Get repository status (for polling background jobs)
router.get('/:owner/:repo/status', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.json({
        hasCachedData: false,
        hasCachedPRs: false,
        status: 'not_started',
        currentJob: null,
        sentiment: { totalIssues: 0, analyzedIssues: 0, progress: 0 }
      });
    }

    const issueCount = issueQueries.countByRepo.get(repo.id);
    const prCount = prQueries.countByRepo.get(repo.id);
    const analyzedIssues = analysisQueries.countByRepoAndType.get(repo.id, 'sentiment');
    const currentJob = getCurrentJobForRepo(repo.id);

    res.json({
      hasCachedData: issueCount.count > 0,
      hasCachedPRs: prCount.count > 0,
      status: repo.status,
      lastFetched: repo.last_fetched,
      lastPRFetched: repo.last_pr_fetched,
      issueCount: issueCount.count,
      prCount: prCount.count,
      currentJob: currentJob,
      sentiment: {
        totalIssues: issueCount.count,
        analyzedIssues: analyzedIssues.count,
        progress: issueCount.count > 0 ? (analyzedIssues.count / issueCount.count) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Error getting repository status:', error);
    res.status(500).json({ error: 'Failed to get repository status' });
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

    // Use transaction to save repo and link to user atomically
    const repo = transaction(() => {
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

      // Then, link the user to the repository
      repoQueries.addUserRepo.run(req.user.id, savedRepo.id);

      return savedRepo;
    })();

    res.json({ repo });
  } catch (error) {
    console.error('Error saving repository:', error);
    res.status(500).json({ error: 'Failed to save repository' });
  }
});

// Remove a saved repository
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    repoQueries.deleteByUserAndId.run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting repository:', error);
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

// Check user's permission level for a repository
router.get('/:owner/:repo/permission', authenticateToken, async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const { checkRepositoryAdminPermission } = await import('../services/github.js');

    const isAdmin = await checkRepositoryAdminPermission(
      req.user.accessToken,
      owner,
      repo
    );

    res.json({
      permission: isAdmin ? 'ADMIN' : 'READ',
      isAdmin
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
// Deletes the repository and all associated data (issues, PRs, settings, etc.)
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
