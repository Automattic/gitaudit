import express from 'express';
import { optionalAuth, requireRepositoryAccessOrPublic } from '../middleware/auth.js';
import { perfQueries, metricsQueries } from '../db/queries.js';

const router = express.Router({ mergeParams: true });

// Regression detection threshold (10% increase = regression)
const REGRESSION_THRESHOLD = 0.10;

// Metrics where higher values are better (not regressions)
const HIGHER_IS_BETTER_PATTERNS = ['coverage', 'score', 'accuracy', 'uptime'];

function isHigherBetter(metricKey) {
  const lowerKey = metricKey.toLowerCase();
  return HIGHER_IS_BETTER_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

// Helper to check if a metric exists and belongs to the repo
function isMetricAccessible(metricId, repoId) {
  const metric = metricsQueries.findById.get(metricId);
  if (!metric || metric.repo_id !== repoId) {
    return false;
  }
  return metric;
}

/**
 * Detect regressions in performance data
 * @param {Array} perfs - Performance data points (oldest first)
 * @param {boolean} higherIsBetter - Whether higher values are better
 * @returns {Array} - Array with regression flags added
 */
function detectRegressions(perfs, higherIsBetter = false) {
  if (perfs.length < 2) return perfs;

  return perfs.map((point, index) => {
    if (index === 0) {
      return { ...point, isRegression: false, regressionPercent: null };
    }

    const prev = perfs[index - 1];
    const change = prev.value !== 0 ? (point.value - prev.value) / prev.value : 0;

    // For most metrics (like bundle size, load time), increase = regression
    // For coverage/score metrics, decrease = regression
    const isRegression = higherIsBetter
      ? change < -REGRESSION_THRESHOLD // Decrease is bad
      : change > REGRESSION_THRESHOLD; // Increase is bad

    return {
      ...point,
      isRegression,
      regressionPercent: isRegression ? change * 100 : null,
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

    // Check metric is accessible and get metric details
    const metric = isMetricAccessible(metricId, repo.id);
    if (!metric) {
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

    // Detect regressions
    const higherBetter = isHigherBetter(metric.key);
    const withRegressions = detectRegressions(transformed, higherBetter);

    res.json(withRegressions);
  } catch (error) {
    console.error('[API] Failed to fetch metric evolution:', error);
    res.status(500).json({ error: 'Failed to fetch metric evolution' });
  }
});

// GET /api/repos/:owner/:repo/perf/average/:metricId
// Returns rolling averages and regression summary
router.get('/average/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    // Check metric is accessible and get metric details
    const metric = isMetricAccessible(metricId, repo.id);
    if (!metric) {
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

    // Count regressions in last 50 commits
    const recentPerfs = perfQueries.findByMetricIdAndBranch.all(metricId, branch, 50);
    recentPerfs.reverse();
    const transformed = recentPerfs.map((p) => ({
      value: p.value,
    }));
    const higherBetter = isHigherBetter(metric.key);
    const withRegressions = detectRegressions(transformed, higherBetter);
    const regressionCount = withRegressions.filter((p) => p.isRegression).length;

    res.json({
      average: currentAvg?.average || null,
      previous: previousAvg?.average || null,
      regressionCount,
    });
  } catch (error) {
    console.error('[API] Failed to fetch metric average:', error);
    res.status(500).json({ error: 'Failed to fetch metric average' });
  }
});

// GET /api/repos/:owner/:repo/perf/regressions/:metricId
// Returns detailed regression list
router.get('/regressions/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { limit = 50, branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    // Check metric is accessible and get metric details
    const metric = isMetricAccessible(metricId, repo.id);
    if (!metric) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    const perfs = perfQueries.findByMetricIdAndBranch.all(
      metricId,
      branch,
      parseInt(limit)
    );

    // Reverse to get oldest first
    perfs.reverse();

    const transformed = perfs.map((p) => ({
      id: p.id,
      hash: p.hash,
      value: p.value,
      measuredAt: p.measured_at,
    }));

    const higherBetter = isHigherBetter(metric.key);
    const withRegressions = detectRegressions(transformed, higherBetter);

    // Filter to only regressions
    const regressions = withRegressions
      .filter((p) => p.isRegression)
      .map((p) => ({
        hash: p.hash,
        value: p.value,
        measuredAt: p.measuredAt,
        regressionPercent: p.regressionPercent,
      }));

    res.json({
      total: regressions.length,
      regressions,
    });
  } catch (error) {
    console.error('[API] Failed to fetch regressions:', error);
    res.status(500).json({ error: 'Failed to fetch regressions' });
  }
});

export default router;
