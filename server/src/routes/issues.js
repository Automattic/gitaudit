import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { fetchRepositoryIssues } from '../services/github.js';
import { repoQueries, issueQueries, analysisQueries, transaction, settingsQueries } from '../db/queries.js';
import { getDefaultSettings, validateSettings, loadRepoSettings } from '../services/settings.js';
import { queueIssueFetch, queueSingleIssueRefresh, getQueueStatus } from '../services/job-queue.js';
import { graphql } from '@octokit/graphql';
import { analyzeIssuesWithAllScores } from '../services/analyzers/unified.js';

const router = express.Router({ mergeParams: true });

// Helper to get or create repository in DB
async function getOrCreateRepo(owner, name, accessToken) {
  let repo = repoQueries.findByOwnerAndName.get(owner, name);

  if (!repo) {
    // Fetch repo info from GitHub to get the database ID
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

// Refresh issues
router.post('/refresh', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = await getOrCreateRepo(owner, repoName, req.user.accessToken);

    // Update status to in_progress
    repoQueries.updateFetchStatus.run('in_progress', repo.id);

    // Queue issue fetch job
    await queueIssueFetch({
      repoId: repo.id,
      owner,
      repoName,
      accessToken: req.user.accessToken,
    });

    res.json({
      message: 'Issue refresh queued',
      repoId: repo.id,
    });
  } catch (error) {
    console.error(`[API] Error queueing issue refresh for ${owner}/${repoName}:`, error);
    res.status(500).json({ error: 'Failed to queue issue refresh' });
  }
});

// Refresh single issue
router.post('/:issueNumber/refresh', authenticateToken, async (req, res) => {
  const { owner, repo: repoName, issueNumber } = req.params;

  try {
    // Get or create repository
    const repo = await getOrCreateRepo(owner, repoName, req.user.accessToken);

    // Queue the refresh job
    await queueSingleIssueRefresh({
      repoId: repo.id,
      issueNumber: parseInt(issueNumber, 10),
      accessToken: req.user.accessToken,
    });

    res.json({
      message: 'Issue refresh queued successfully',
      repoId: repo.id,
      issueNumber: parseInt(issueNumber, 10),
    });
  } catch (error) {
    console.error('[API] Failed to queue single issue refresh:', error);
    res.status(500).json({
      error: 'Failed to queue issue refresh',
      details: error.message
    });
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

// Get distinct labels for a repository
router.get('/labels', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const issues = issueQueries.findOpenByRepo.all(repo.id);
    const uniqueLabels = new Set();

    issues.forEach(issue => {
      const labels = JSON.parse(issue.labels || '[]');
      labels.forEach(label => uniqueLabels.add(label));
    });

    res.json({
      labels: Array.from(uniqueLabels).sort()
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

// Unified endpoint for all issues with scores
router.get('/', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  // Extract query parameters
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 20;
  const scoreType = req.query.scoreType || 'all';
  const sortBy = req.query.sortBy || null;
  const priority = req.query.priority || 'all';
  const level = req.query.level || 'all';
  const search = req.query.search || '';
  const issueType = req.query.issueType || 'all';
  const labels = req.query.labels
    ? (Array.isArray(req.query.labels) ? req.query.labels : [req.query.labels])
    : [];

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Load repo's settings (both importantBugs, staleIssues, and communityHealth)
    const allSettings = loadRepoSettings(repo.id);

    // Get all open issues
    const issues = issueQueries.findOpenByRepo.all(repo.id);

    // Get maintainer logins from database for community health scoring
    let maintainerLogins = [];
    if (scoreType === 'all' || scoreType === 'communityHealth') {
      if (repo.maintainer_logins) {
        try {
          maintainerLogins = JSON.parse(repo.maintainer_logins);
        } catch (error) {
          console.error('[Community Health] Failed to parse maintainer_logins from database:', error.message);
        }
      }
    }

    // Analyze with unified analyzer
    const { issues: analyzedIssues, totalItems, totalPages, thresholds } =
      analyzeIssuesWithAllScores(issues, allSettings, {
        page, perPage, scoreType, sortBy, priority, level, search, issueType, maintainerLogins, labels
      });

    // Format response
    const formattedIssues = analyzedIssues.map(issue => ({
      id: issue.id,
      githubId: issue.github_id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: JSON.parse(issue.labels || '[]'),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      commentsCount: issue.comments_count,
      assignees: JSON.parse(issue.assignees || '[]'),
      milestone: issue.milestone,
      url: `https://github.com/${owner}/${repoName}/issues/${issue.number}`,
      scores: issue.scores // Includes all score types with metadata
    }));

    res.json({
      issues: formattedIssues,
      totalItems,
      totalPages,
      thresholds,
      fetchStatus: repo.fetch_status || 'not_started'
    });
  } catch (error) {
    console.error('Error analyzing issues:', error);
    res.status(500).json({ error: 'Failed to analyze issues' });
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
