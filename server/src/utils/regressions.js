// Regression detection threshold (10% increase = regression)
const REGRESSION_THRESHOLD = 0.10;

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
 * @param {number} [minDelta=0] - Minimum absolute change to flag, compared
 *   against stored `value` deltas (baseline-normalized when the repo submits
 *   baseMetrics). Not `raw_value` units, and not the chart's display units —
 *   byte-scale (KB/MB/GB/TB) labels divide the stored value by 1024^n
 * @returns {Array} - Array with regression/improvement flags added
 */
export function detectRegressions(perfs, minDelta = 0) {
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
