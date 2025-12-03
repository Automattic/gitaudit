import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { fetchRepositoryIssues } from '../services/github.js';
import { repoQueries, issueQueries, analysisQueries, transaction, settingsQueries } from '../db/queries.js';
import { getDefaultSettings, validateSettings, loadRepoSettings } from '../services/settings.js';

const router = express.Router({ mergeParams: true });

// Helper to get or create repository in DB
async function getOrCreateRepo(owner, name, accessToken) {
  let repo = repoQueries.findByOwnerAndName.get(owner, name);

  if (!repo) {
    // Fetch repo info from GitHub to get the database ID
    const { graphql } = await import('@octokit/graphql');
    const client = graphql.defaults({
      headers: { authorization: `token ${accessToken}` },
    });

    const result = await client(`
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          databaseId
        }
      }
    `, { owner, name });

    repo = repoQueries.create.get(owner, name, result.repository.databaseId);
  }

  return repo;
}

// Fetch issues from GitHub
router.post('/fetch', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    // Check if repository is saved by this user (Option 1 validation)
    const savedRepo = repoQueries.checkIfSaved.get(req.user.id, owner, repoName);

    if (!savedRepo) {
      return res.status(403).json({
        error: 'Repository not saved. Please add this repository to your list first.'
      });
    }

    // Get or create repository record
    const repo = await getOrCreateRepo(owner, repoName, req.user.accessToken);

    // Update status to in_progress
    repoQueries.updateFetchStatus.run('in_progress', repo.id);

    // Queue issue fetch job
    const { queueIssueFetch } = await import('../services/jobQueue.js');
    await queueIssueFetch({
      repoId: repo.id,
      owner,
      repoName,
      accessToken: req.user.accessToken,
    });

    res.json({
      message: 'Issue fetch queued',
      repoId: repo.id,
    });
  } catch (error) {
    console.error('Error queueing issue fetch:', error);
    res.status(500).json({ error: 'Failed to queue issue fetch' });
  }
});

// Get cache status
router.get('/status', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.json({
        hasCachedData: false,
        status: 'not_started',
      });
    }

    const issueCount = issueQueries.countByRepo.get(repo.id);

    res.json({
      hasCachedData: issueCount.count > 0,
      status: repo.fetch_status,
      lastFetched: repo.last_fetched,
      issueCount: issueCount.count,
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({ error: 'Failed to get cache status' });
  }
});

// Refresh issues
router.post('/refresh', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  console.log(`[API] Refresh request received for ${owner}/${repoName}`);

  try {
    const repo = await getOrCreateRepo(owner, repoName, req.user.accessToken);

    console.log(`[API] Repository found/created: ${repo.id}, updating status to in_progress`);

    // Update status to in_progress
    repoQueries.updateFetchStatus.run('in_progress', repo.id);

    // Queue issue fetch job
    const { queueIssueFetch } = await import('../services/jobQueue.js');
    console.log(`[API] Calling queueIssueFetch for ${owner}/${repoName}`);
    await queueIssueFetch({
      repoId: repo.id,
      owner,
      repoName,
      accessToken: req.user.accessToken,
    });

    console.log(`[API] Job queued successfully for ${owner}/${repoName}`);

    res.json({
      message: 'Issue refresh queued',
      repoId: repo.id,
    });
  } catch (error) {
    console.error(`[API] Error queueing issue refresh for ${owner}/${repoName}:`, error);
    res.status(500).json({ error: 'Failed to queue issue refresh' });
  }
});

// Get sentiment analysis status
router.get('/sentiment/status', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Count analyzed issues
    const totalIssues = issueQueries.countByRepo.get(repo.id).count;
    const analyzedIssues = analysisQueries.countByRepoAndType.get(repo.id, 'sentiment').count;

    const { getQueueStatus } = await import('../services/jobQueue.js');
    const queueStatus = getQueueStatus();

    res.json({
      totalIssues,
      analyzedIssues,
      progress: totalIssues > 0 ? (analyzedIssues / totalIssues) * 100 : 0,
      isProcessing: queueStatus.isProcessing,
      queueLength: queueStatus.queueLength,
    });
  } catch (error) {
    console.error('Error getting sentiment status:', error);
    res.status(500).json({ error: 'Failed to get sentiment status' });
  }
});

// Get important bugs
router.get('/important-bugs', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  // Extract query parameters
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 20;
  const priorityLevel = req.query.priority || 'all';
  const search = req.query.search || '';

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Load repo's settings
    const settings = loadRepoSettings(repo.id);

    // Get all open issues
    const issues = issueQueries.findOpenByRepo.all(repo.id);

    // Analyze and score bugs with user's settings, pagination, and search
    const { analyzeImportantBugs } = await import('../services/analyzers/important-bugs.js');
    const { bugs, totalItems, totalPages, stats } = analyzeImportantBugs(
      issues,
      settings,
      { page, perPage, priorityLevel, search }
    );

    // Format response
    const formattedBugs = bugs.map(bug => ({
      id: bug.id,
      githubId: bug.github_id,
      number: bug.number,
      title: bug.title,
      body: bug.body,
      state: bug.state,
      labels: JSON.parse(bug.labels || '[]'),
      createdAt: bug.created_at,
      updatedAt: bug.updated_at,
      commentsCount: bug.comments_count,
      assignees: JSON.parse(bug.assignees || '[]'),
      milestone: bug.milestone,
      score: bug.score,
      scoreMetadata: bug.scoreMetadata,
      url: `https://github.com/${owner}/${repoName}/issues/${bug.number}`,
    }));

    res.json({
      bugs: formattedBugs,
      totalItems,
      totalPages,
      stats,
      thresholds: settings.thresholds, // Include for UI display
    });
  } catch (error) {
    console.error('Error analyzing important bugs:', error);
    res.status(500).json({ error: 'Failed to analyze important bugs' });
  }
});

// Get repo's scoring settings (or defaults)
router.get('/settings', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const settings = loadRepoSettings(repo.id);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Save repo's scoring settings
router.put('/settings', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const settings = req.body;

    // Validate settings
    const validation = validateSettings(settings);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid settings',
        details: validation.errors,
      });
    }

    // Save settings
    const result = settingsQueries.upsert.get(repo.id, JSON.stringify(settings));
    res.json(JSON.parse(result.settings));
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Reset repo's settings to defaults
router.delete('/settings', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Delete custom settings (will fallback to defaults)
    settingsQueries.deleteByRepoId.run(repo.id);

    // Return default settings
    res.json(getDefaultSettings());
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

export default router;
