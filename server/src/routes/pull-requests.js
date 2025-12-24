import express from 'express';
import { authenticateToken, requireRepositoryAdmin } from '../middleware/auth.js';
import { repoQueries, prQueries, prAnalysisQueries, settingsQueries } from '../db/queries.js';
import { loadRepoSettings, getDefaultSettings } from '../services/settings.js';
import { analyzeStalePRs } from '../services/analyzers/stale-prs.js';
import { queueJob } from '../services/job-queue.js';

const router = express.Router({ mergeParams: true });

// Get PRs with scores
router.get('/', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  // Extract query parameters
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 20;
  const scoreType = req.query.scoreType || 'stale-prs';
  const level = req.query.level || 'all';
  const search = req.query.search || '';

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Load repo's settings
    const allSettings = loadRepoSettings(repo.id);

    // Ensure stalePRs settings exist (fallback to defaults if not)
    if (!allSettings.stalePRs) {
      const defaults = getDefaultSettings();
      allSettings.stalePRs = defaults.stalePRs;
    }

    // Get all open PRs
    const prs = prQueries.findOpenByRepo.all(repo.id);

    // Analyze with stale PR analyzer
    const { prs: analyzedPRs, totalItems, totalPages, stats } =
      analyzeStalePRs(prs, allSettings.stalePRs, {
        page,
        per_page: perPage,
        search,
        level
      });

    // Format response
    const formattedPRs = analyzedPRs.map(pr => ({
      id: pr.id,
      githubId: pr.github_id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      draft: pr.draft,
      labels: JSON.parse(pr.labels || '[]'),
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
      commentsCount: pr.comments_count,
      assignees: JSON.parse(pr.assignees || '[]'),
      reviewers: JSON.parse(pr.reviewers || '[]'),
      reviewDecision: pr.review_decision,
      mergeableState: pr.mergeable_state,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      authorLogin: pr.author_login,
      authorAssociation: pr.author_association,
      url: `https://github.com/${owner}/${repoName}/pull/${pr.number}`,
      score: pr.score,
      metadata: pr.metadata
    }));

    res.json({
      prs: formattedPRs,
      totalItems,
      totalPages,
      stats,
      thresholds: allSettings.stalePRs.thresholds,
      fetchStatus: repo.status || 'not_started'
    });
  } catch (error) {
    console.error('Error analyzing PRs:', error);
    res.status(500).json({ error: 'Failed to analyze PRs' });
  }
});

// Get repo's stale PR settings (or defaults)
router.get('/settings', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const allSettings = loadRepoSettings(repo.id);

    res.json({
      stalePRs: allSettings.stalePRs
    });
  } catch (error) {
    console.error('Error fetching PR settings:', error);
    res.status(500).json({ error: 'Failed to fetch PR settings' });
  }
});

// Update repo's stale PR settings
router.put('/settings', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;
  const { stalePRs } = req.body;

  try {
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Load existing settings
    const existingSettings = loadRepoSettings(repo.id);

    // Merge with new stalePRs settings
    const updatedSettings = {
      ...existingSettings,
      stalePRs: stalePRs || existingSettings.stalePRs
    };

    // Save to database
    settingsQueries.upsert.run(
      repo.id,
      JSON.stringify(updatedSettings)
    );

    res.json({
      message: 'PR settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating PR settings:', error);
    res.status(500).json({ error: 'Failed to update PR settings' });
  }
});

// Refresh single PR
router.post('/:prNumber/refresh', authenticateToken, async (req, res) => {
  const { owner, repo: repoName, prNumber } = req.params;

  try {
    // Get repository
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Queue the refresh job
    queueJob({
      type: 'single-pr-refresh',
      repoId: repo.id,
      userId: req.user.id,
      args: { prNumber: parseInt(prNumber, 10) },
      priority: 100,
    });

    res.json({
      message: 'PR refresh queued successfully',
      repoId: repo.id,
      prNumber: parseInt(prNumber, 10),
    });
  } catch (error) {
    console.error('[API] Failed to queue single PR refresh:', error);
    res.status(500).json({
      error: 'Failed to queue PR refresh',
      details: error.message
    });
  }
});

export default router;
