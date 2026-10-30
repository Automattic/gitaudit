import express from 'express';
import { optionalAuth, requireRepositoryAccessOrPublic } from '../middleware/auth.js';
import { perfQueries, metricsQueries, findLatestValuesByMetric } from '../db/queries.js';
import { recentAverages, RECENT_VALUES } from '../utils/averages.js';
import { lttbDownsample } from '../utils/lttb.js';
import { detectRegressions } from '../utils/regressions.js';

const router = express.Router({ mergeParams: true });

// Helper to fetch a metric if it exists and belongs to the repo (null otherwise)
function getAccessibleMetric(metricId, repoId) {
  const metric = metricsQueries.findById.get(metricId);
  if (!metric || metric.repo_id !== repoId) {
    return null;
  }
  return metric;
}

// Target number of points after downsampling
const DOWNSAMPLE_TARGET = 400;

// GET /api/repos/:owner/:repo/perf/evolution/:metricId
// Returns metric history for charts with regression detection
router.get('/evolution/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { limit, branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    const metric = getAccessibleMetric(metricId, repo.id);
    if (!metric) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    let perfs;
    if (!limit || limit === 'all') {
      perfs = perfQueries.findAllByMetricIdAndBranch.all(metricId, branch);
    } else {
      perfs = perfQueries.findByMetricIdAndBranch.all(
        metricId,
        branch,
        parseInt(limit)
      );
    }

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

    // Detect regressions on full data BEFORE downsampling
    const withRegressions = detectRegressions(transformed, metric.min_regression_delta || 0);

    // Downsample only for "all" requests
    const isAllRequest = !limit || limit === 'all';
    const totalPoints = withRegressions.length;
    const data = isAllRequest && totalPoints > DOWNSAMPLE_TARGET
      ? lttbDownsample(withRegressions, DOWNSAMPLE_TARGET)
      : withRegressions;

    res.json({
      data,
      meta: {
        totalPoints,
        displayedPoints: data.length,
        isDownsampled: data.length < totalPoints,
      },
    });
  } catch (error) {
    console.error('[API] Failed to fetch metric evolution:', error);
    res.status(500).json({ error: 'Failed to fetch metric evolution' });
  }
});

// GET /api/repos/:owner/:repo/perf/summary
// Returns rolling averages for every metric, keyed by metric id. A dashboard needs
// them all at once, and hosts can reject that many simultaneous requests.
router.get('/summary', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { branch = 'trunk' } = req.query;

  try {
    const metrics = metricsQueries.findByRepoId.all(req.publicRepo.id);
    const latest = findLatestValuesByMetric(metrics.map((m) => m.id), branch, RECENT_VALUES);

    res.json(Object.fromEntries(metrics.map((m) => [m.id, recentAverages(latest.get(m.id))])));
  } catch (error) {
    console.error('[API] Failed to fetch metric summary:', error);
    res.status(500).json({ error: 'Failed to fetch metric summary' });
  }
});

export default router;
