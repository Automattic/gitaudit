import express from 'express';
import { optionalAuth, requireRepositoryAccessOrPublic } from '../middleware/auth.js';
import { perfQueries, metricsQueries } from '../db/queries.js';
import { lttbDownsample } from '../utils/lttb.js';

const router = express.Router({ mergeParams: true });

// Regression detection threshold (10% increase = regression)
const REGRESSION_THRESHOLD = 0.10;

// Helper to fetch a metric if it exists and belongs to the repo (null otherwise)
function getAccessibleMetric(metricId, repoId) {
  const metric = metricsQueries.findById.get(metricId);
  if (!metric || metric.repo_id !== repoId) {
    return null;
  }
  return metric;
}

/**
 * Detect regressions and improvements in performance data.
 * Lower is always better: increase = regression, decrease = improvement.
 *
 * A point is only flagged when the change exceeds BOTH the relative threshold
 * and the metric's absolute noise floor (minDelta). The floor exists for
 * low-baseline metrics where a fixed percentage sits inside normal
 * measurement noise (e.g. 10% of a 64ms TTFB is ~6ms — a couple of standard
 * deviations of run-to-run jitter). minDelta = 0 preserves the old behavior.
 *
 * @param {Array} perfs - Performance data points (oldest first)
 * @param {number} [minDelta=0] - Minimum absolute change to flag, in stored
 *   `value` units (baseline-normalized when the repo submits baseMetrics —
 *   the same units plotted on the chart), not `raw_value` units
 * @returns {Array} - Array with regression/improvement flags added
 */
function detectRegressions(perfs, minDelta = 0) {
  if (perfs.length < 2) return perfs;

  return perfs.map((point, index) => {
    if (index === 0) {
      return { ...point, isRegression: false, regressionPercent: null, isImprovement: false, improvementPercent: null };
    }

    const prev = perfs[index - 1];
    const delta = point.value - prev.value;
    const change = prev.value !== 0 ? delta / prev.value : 0;
    const exceedsFloor = Math.abs(delta) >= minDelta;

    const isRegression = exceedsFloor && change > REGRESSION_THRESHOLD;
    const isImprovement = exceedsFloor && change < -REGRESSION_THRESHOLD;

    return {
      ...point,
      isRegression,
      regressionPercent: isRegression ? Math.abs(change * 100) : null,
      isImprovement,
      improvementPercent: isImprovement ? Math.abs(change * 100) : null,
    };
  });
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

// GET /api/repos/:owner/:repo/perf/average/:metricId
// Returns rolling averages
router.get('/average/:metricId', optionalAuth, requireRepositoryAccessOrPublic, async (req, res) => {
  const { metricId } = req.params;
  const { branch = 'trunk' } = req.query;

  try {
    const repo = req.publicRepo;

    if (!getAccessibleMetric(metricId, repo.id)) {
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
