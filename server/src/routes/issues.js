import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { repoQueries, issueQueries, analysisQueries, settingsQueries } from '../db/queries.js';
import { getDefaultSettings, validateSettings, loadRepoSettings, maskApiKey, mergeSettingsPreservingApiKey, API_KEY_SENTINEL } from '../services/settings.js';
import { queueJob, getQueueStatus } from '../services/job-queue.js';
import { analyzeIssuesWithAllScores } from '../services/analyzers/unified.js';

const router = express.Router({ mergeParams: true });

// Refresh single issue
router.post('/:issueNumber/refresh', authenticateToken, async (req, res) => {
  const { owner, repo: repoName, issueNumber } = req.params;

  try {
    // Get repository
    const repo = repoQueries.findByOwnerAndName.get(owner, repoName);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Queue the refresh job
    queueJob({
      type: 'single-issue-refresh',
      repoId: repo.id,
      userId: req.user.id,
      args: { issueNumber: parseInt(issueNumber, 10) },
      priority: 100,
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

    // Load repo's settings (bugs, stale, community, and features)
    const allSettings = loadRepoSettings(repo.id);

    // Get all open issues
    const issues = issueQueries.findOpenByRepo.all(repo.id);

    // Get maintainer logins from database for community health scoring
    let maintainerLogins = [];
    if (scoreType === 'all' || scoreType === 'community') {
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
        page, perPage, scoreType, sortBy, level, search, issueType, maintainerLogins, labels
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
      fetchStatus: repo.status || 'not_started'
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

    // Mask the API key before sending to client
    const maskedSettings = maskApiKey(settings);

    res.json(maskedSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Validate LLM API key with a test call
router.post('/settings/validate-llm', authenticateToken, async (req, res) => {
  const { owner, repo: repoName } = req.params;
  const { provider, apiKey, model } = req.body;

  try {
    // Validate inputs
    if (!provider || !['anthropic', 'openai'].includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider. Must be "anthropic" or "openai"'
      });
    }

    // If sentinel value provided, load actual API key from database
    let actualApiKey = apiKey;
    if (apiKey === API_KEY_SENTINEL) {
      const repo = repoQueries.findByOwnerAndName.get(owner, repoName);
      if (!repo) {
        return res.status(400).json({ error: 'Repository not found' });
      }

      const settings = loadRepoSettings(repo.id);
      if (!settings.llm || !settings.llm.apiKey || settings.llm.apiKey.trim() === '') {
        return res.status(400).json({ error: 'No API key is currently saved' });
      }

      actualApiKey = settings.llm.apiKey;
    }

    if (!actualApiKey || typeof actualApiKey !== 'string' || actualApiKey.trim() === '') {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Import AI SDK
    const { generateText } = await import('ai');
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Create provider and determine model
    let providerInstance;
    let modelName;

    if (provider === 'anthropic') {
      providerInstance = createAnthropic({ apiKey: actualApiKey });
      modelName = model || 'claude-3-haiku-20240307';
    } else {
      providerInstance = createOpenAI({ apiKey: actualApiKey });
      modelName = model || 'gpt-3.5-turbo';
    }

    // Make minimal test call (5 tokens)
    await generateText({
      model: providerInstance(modelName),
      prompt: 'Test',
      maxTokens: 5,
    });

    res.json({
      valid: true,
      message: 'API key is valid',
      model: modelName
    });

  } catch (error) {
    console.error('LLM validation error:', error);

    let errorMessage = 'API key validation failed';
    if (error.message?.includes('API key')) {
      errorMessage = 'Invalid API key';
    } else if (error.message?.includes('model')) {
      errorMessage = 'Invalid model name';
    } else if (error.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Try again in a moment.';
    }

    res.status(400).json({
      valid: false,
      error: errorMessage,
      details: error.message
    });
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

    const incomingSettings = req.body;

    // Load existing settings to preserve API key if needed
    const existingSettings = loadRepoSettings(repo.id);

    // Merge settings, preserving API key when sentinel is provided or omitted
    const mergedSettings = mergeSettingsPreservingApiKey(incomingSettings, existingSettings);

    // Validate settings (now with preserved API key)
    const validation = validateSettings(mergedSettings);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid settings',
        details: validation.errors,
      });
    }

    // Save settings
    const result = settingsQueries.upsert.get(repo.id, JSON.stringify(mergedSettings));

    // Return masked settings to client
    const savedSettings = JSON.parse(result.settings);
    const maskedSettings = maskApiKey(savedSettings);

    res.json(maskedSettings);
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
