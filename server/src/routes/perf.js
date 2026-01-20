import express from 'express';
import { optionalAuth, requireRepositoryAccessOrPublic } from '../middleware/auth.js';
import { perfQueries, metricsQueries } from '../db/queries.js';

const router = express.Router({ mergeParams: true });

// Helper to check if a metric is accessible (visible or authenticated)
function isMetricAccessible(metricId, repoId, isPublicAccess) {
  const metric = metricsQueries.findById.get(metricId);
  if (!metric || metric.repo_id !== repoId) {
    return false;
  }
  // For public access, only allow visible metrics
  if (isPublicAccess && !metric.default_visible) {
    return false;
  }
  return true;
}

// GET /api/repos/:owner/:repo/perf/evolution/:metricId
// Returns metric history for charts
// Public access only allowed for visible metrics
router.get('/evolution/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { limit = 100, branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    // Check metric is accessible
    if (!isMetricAccessible(metricId, repo.id, req.isPublicAccess)) {
      return res.status(404).json({ error: 'Metric not found' });
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
// Returns rolling averages
// Public access only allowed for visible metrics
router.get('/average/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    // Check metric is accessible
    if (!isMetricAccessible(metricId, repo.id, req.isPublicAccess)) {
      return res.status(404).json({ error: 'Metric not found' });
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
