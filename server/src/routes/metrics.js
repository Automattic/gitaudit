import express from 'express';
import crypto from 'crypto';
import { authenticateToken, requireRepositoryAdmin } from '../middleware/auth.js';
import { repoQueries, metricsQueries } from '../db/queries.js';

const router = express.Router({ mergeParams: true });

// Generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper to get repo by owner/name
function getRepo(owner, repoName) {
  return repoQueries.findByOwnerAndName.get(owner, repoName);
}

// GET /api/repos/:owner/:repo/metrics - List all metrics for a repo
router.get('/', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const metrics = metricsQueries.findByRepoId.all(repo.id);

    // Transform to camelCase for frontend
    const transformed = metrics.map(m => ({
      id: m.id,
      repoId: m.repo_id,
      key: m.key,
      name: m.name,
      unit: m.unit,
      priority: m.priority,
      defaultVisible: Boolean(m.default_visible),
      createdAt: m.created_at,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('[API] Failed to fetch metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// POST /api/repos/:owner/:repo/metrics - Create a new metric
router.post('/', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;
  const { key, name, unit, priority = 0, defaultVisible = true } = req.body;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Validate key format (lowercase alphanumeric + underscores)
    if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) {
      return res.status(400).json({
        error: 'Invalid key format. Must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.',
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check for duplicate key
    const existing = metricsQueries.findByRepoIdAndKey.get(repo.id, key);
    if (existing) {
      return res.status(409).json({ error: 'A metric with this key already exists' });
    }

    const metric = metricsQueries.insert.get(
      repo.id,
      key,
      name.trim(),
      unit || null,
      priority,
      defaultVisible ? 1 : 0
    );

    res.status(201).json({
      id: metric.id,
      repoId: metric.repo_id,
      key: metric.key,
      name: metric.name,
      unit: metric.unit,
      priority: metric.priority,
      defaultVisible: Boolean(metric.default_visible),
      createdAt: metric.created_at,
    });
  } catch (error) {
    console.error('[API] Failed to create metric:', error);
    res.status(500).json({ error: 'Failed to create metric' });
  }
});

// PUT /api/repos/:owner/:repo/metrics/:id - Update a metric
router.put('/:id', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName, id } = req.params;
  const { name, unit, priority, defaultVisible } = req.body;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const existing = metricsQueries.findById.get(id);
    if (!existing || existing.repo_id !== repo.id) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const metric = metricsQueries.update.get(
      name !== undefined ? name.trim() : existing.name,
      unit !== undefined ? (unit || null) : existing.unit,
      priority !== undefined ? priority : existing.priority,
      defaultVisible !== undefined ? (defaultVisible ? 1 : 0) : existing.default_visible,
      id
    );

    res.json({
      id: metric.id,
      repoId: metric.repo_id,
      key: metric.key,
      name: metric.name,
      unit: metric.unit,
      priority: metric.priority,
      defaultVisible: Boolean(metric.default_visible),
      createdAt: metric.created_at,
    });
  } catch (error) {
    console.error('[API] Failed to update metric:', error);
    res.status(500).json({ error: 'Failed to update metric' });
  }
});

// DELETE /api/repos/:owner/:repo/metrics/:id - Delete a metric
router.delete('/:id', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName, id } = req.params;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const existing = metricsQueries.findById.get(id);
    if (!existing || existing.repo_id !== repo.id) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    metricsQueries.delete.run(id);

    res.status(204).send();
  } catch (error) {
    console.error('[API] Failed to delete metric:', error);
    res.status(500).json({ error: 'Failed to delete metric' });
  }
});

// GET /api/repos/:owner/:repo/metrics/token - Get metrics token (admin only)
router.get('/token', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Return actual token since this endpoint is admin-protected
    res.json({
      token: repo.metrics_token || null,
    });
  } catch (error) {
    console.error('[API] Failed to get metrics token:', error);
    res.status(500).json({ error: 'Failed to get metrics token' });
  }
});

// POST /api/repos/:owner/:repo/metrics/token/regenerate - Generate or regenerate token
router.post('/token/regenerate', authenticateToken, requireRepositoryAdmin, async (req, res) => {
  const { owner, repo: repoName } = req.params;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const newToken = generateToken();
    repoQueries.updateMetricsToken.run(newToken, repo.id);

    // Return the actual token (one-time view for copying)
    res.json({
      token: newToken,
    });
  } catch (error) {
    console.error('[API] Failed to regenerate metrics token:', error);
    res.status(500).json({ error: 'Failed to regenerate metrics token' });
  }
});

export default router;
