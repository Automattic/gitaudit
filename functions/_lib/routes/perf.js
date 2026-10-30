import { recentAverages, RECENT_VALUES } from '../averages.js';
import { lttbDownsample } from '../lttb.js';
import { detectRegressions } from '../regressions.js';
import { optionalAuth, requireRepositoryAccessOrPublic } from '../auth.js';
import { HttpError, json } from '../http.js';
import { findLatestValuesByMetric, findMetric, findMetrics, findPerf } from '../queries.js';

const BASE = '/api/repos/:owner/:repo/perf';

// Target number of points after downsampling
const DOWNSAMPLE_TARGET = 400;

export function perfRoutes(router) {
  // Returns metric history for charts with regression detection
  router.get(`${BASE}/evolution/:metricId`, optionalAuth, requireRepositoryAccessOrPublic, async ({ db, params, query, repo }) => {
    const metricId = Number(params.metricId);
    const metric = Number.isInteger(metricId) ? await findMetric(db, metricId) : null;

    if (!metric || metric.repo_id !== repo.id) {
      throw new HttpError(404, 'Metric not found');
    }

    const limit = query.get('limit');
    const isAllRequest = !limit || limit === 'all';
    const parsedLimit = parseInt(limit);

    if (!isAllRequest && !(parsedLimit > 0)) {
      throw new HttpError(400, 'Invalid limit');
    }

    const perfs = await findPerf(db, metricId, query.get('branch') ?? 'trunk', isAllRequest ? null : parsedLimit);

    // Oldest first for charts, in camelCase for the frontend
    const transformed = perfs.reverse().map((perf) => ({
      id: Number(perf.id),
      repoId: perf.repo_id,
      branch: perf.branch,
      hash: perf.hash,
      metricId: perf.metric_id,
      value: Number(perf.value),
      rawValue: Number(perf.raw_value),
      measuredAt: new Date(Number(perf.measured_at)).toISOString(),
    }));

    // Detect regressions on full data BEFORE downsampling
    const withRegressions = detectRegressions(transformed, Number(metric.min_regression_delta) || 0);

    // Downsample only for "all" requests
    const totalPoints = withRegressions.length;
    const data =
      isAllRequest && totalPoints > DOWNSAMPLE_TARGET
        ? lttbDownsample(withRegressions, DOWNSAMPLE_TARGET)
        : withRegressions;

    return json({
      data,
      meta: {
        totalPoints,
        displayedPoints: data.length,
        isDownsampled: data.length < totalPoints,
      },
    });
  });

  // Returns rolling averages for every metric, keyed by metric id. A dashboard needs
  // them all at once, and Spacefast rejects that many simultaneous requests.
  router.get(`${BASE}/summary`, optionalAuth, requireRepositoryAccessOrPublic, async ({ db, query, repo }) => {
    const metrics = await findMetrics(db, repo.id);
    const latest = await findLatestValuesByMetric(
      db,
      metrics.map((metric) => metric.id),
      query.get('branch') ?? 'trunk',
      RECENT_VALUES
    );

    return json(
      Object.fromEntries(metrics.map((metric) => [metric.id, recentAverages(latest.get(metric.id))]))
    );
  });
}
