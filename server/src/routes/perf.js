import express from 'express';
import { authenticateToken, requireRepositoryAccess } from '../middleware/auth.js';
import { repoQueries, perfQueries } from '../db/queries.js';

const router = express.Router({ mergeParams: true });

// Helper to get repo by owner/name
function getRepo(owner, repoName) {
  return repoQueries.findByOwnerAndName.get(owner, repoName);
}

// GET /api/repos/:owner/:repo/perf/evolution/:metricId
// Returns metric history for charts (same logic as CodeVitals /api/evolution/[metric_id].js)
router.get('/evolution/:metricId', authenticateToken, requireRepositoryAccess, async (req, res) => {
  const { owner, repo: repoName, metricId } = req.params;
  const { limit = 100, branch = 'trunk' } = req.query;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const perfs = perfQueries.findByMetricIdAndBranch.all(
      metricId,
      branch,
      parseInt(limit)
    );

    // Reverse to get oldest first for charts
    perfs.reverse();

    // Transform to camelCase for frontend
    const transformed = perfs.map((p) => ({
      id: p.id,
      repoId: p.repo_id,
      branch: p.branch,
      hash: p.hash,
      metricId: p.metric_id,
      value: p.value,
      rawValue: p.raw_value,
      measuredAt: p.measured_at,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('[API] Failed to fetch metric evolution:', error);
    res.status(500).json({ error: 'Failed to fetch metric evolution' });
  }
});

// GET /api/repos/:owner/:repo/perf/average/:metricId
// Returns rolling averages (same logic as CodeVitals /api/average/[metric_id].js)
router.get('/average/:metricId', authenticateToken, requireRepositoryAccess, async (req, res) => {
  const { owner, repo: repoName, metricId } = req.params;
  const { branch = 'trunk' } = req.query;

  try {
    const repo = getRepo(owner, repoName);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Average of last 20 values
    const currentAvg = perfQueries.averageByMetricAndBranch.get(
      branch,
      metricId,
      20
    );

    // Average of previous 20 values (offset by 20)
    const previousAvg = perfQueries.averageByMetricAndBranchWithOffset.get(
      branch,
      metricId,
      20,
      20
    );

    res.json({
      average: currentAvg?.average || null,
      previous: previousAvg?.average || null,
    });
  } catch (error) {
    console.error('[API] Failed to fetch metric average:', error);
    res.status(500).json({ error: 'Failed to fetch metric average' });
  }
});

export default router;
