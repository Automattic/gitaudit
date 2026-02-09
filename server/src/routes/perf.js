import express from 'express';
import { optionalAuth, requireRepositoryAccessOrPublic } from '../middleware/auth.js';
import { perfQueries, metricsQueries } from '../db/queries.js';

const router = express.Router({ mergeParams: true });

// Regression detection threshold (10% increase = regression)
const REGRESSION_THRESHOLD = 0.10;

// Helper to check if a metric exists and belongs to the repo
function isMetricAccessible(metricId, repoId) {
  const metric = metricsQueries.findById.get(metricId);
  if (!metric || metric.repo_id !== repoId) {
    return false;
  }
  return true;
}

/**
 * Detect regressions and improvements in performance data.
 * Lower is always better: increase = regression, decrease = improvement.
 * @param {Array} perfs - Performance data points (oldest first)
 * @returns {Array} - Array with regression/improvement flags added
 */
function detectRegressions(perfs) {
  if (perfs.length < 2) return perfs;

  return perfs.map((point, index) => {
    if (index === 0) {
      return { ...point, isRegression: false, regressionPercent: null, isImprovement: false, improvementPercent: null };
    }

    const prev = perfs[index - 1];
    const change = prev.value !== 0 ? (point.value - prev.value) / prev.value : 0;

    const isRegression = change > REGRESSION_THRESHOLD;
    const isImprovement = change < -REGRESSION_THRESHOLD;

    return {
      ...point,
      isRegression,
      regressionPercent: isRegression ? Math.abs(change * 100) : null,
      isImprovement,
      improvementPercent: isImprovement ? Math.abs(change * 100) : null,
    };
  });
}

// GET /api/repos/:owner/:repo/perf/evolution/:metricId
// Returns metric history for charts with regression detection
router.get('/evolution/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { limit = 100, branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    if (!isMetricAccessible(metricId, repo.id)) {
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

    const withRegressions = detectRegressions(transformed);

    res.json(withRegressions);
  } catch (error) {
    console.error('[API] Failed to fetch metric evolution:', error);
    res.status(500).json({ error: 'Failed to fetch metric evolution' });
  }
});

// GET /api/repos/:owner/:repo/perf/average/:metricId
// Returns rolling averages
router.get('/average/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    if (!isMetricAccessible(metricId, repo.id)) {
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
