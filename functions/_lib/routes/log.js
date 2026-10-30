import { HttpError, json, readJson } from '../http.js';
import { findMetrics, findPerfByHash, findRepoByMetricsToken, insertPerf } from '../queries.js';

// POST /api/log?token=<TOKEN>
// Logs performance metrics from CI/CD pipelines. CI in other repositories posts here,
// so this URL and its request and response formats have to stay as they are.
export function logRoutes(router) {
  router.post('/api/log', async ({ db, query, request }) => {
    const { metrics, hash, timestamp, branch, baseMetrics, baseHash } = await readJson(request);

    const repo = await findRepoByMetricsToken(db, query.get('token'));
    if (!repo) {
      throw new HttpError(401, 'Invalid token');
    }

    const [availableMetrics, basePerfs] = await Promise.all([
      findMetrics(db, repo.id),
      findPerfByHash(db, baseHash ?? null, repo.id),
    ]);

    const measuredAt = new Date(timestamp).getTime();
    const byKey = new Map(availableMetrics.map((metric) => [metric.key, metric]));
    const baseValues = new Map(basePerfs.map((perf) => [perf.metric_id, Number(perf.value)]));

    // Insert base metrics if not already present
    const baseRows = [];
    for (const [metricKey, metricValue] of Object.entries(baseMetrics || {})) {
      const metric = byKey.get(metricKey);

      if (metric && !baseValues.has(metric.id)) {
        // branch = baseHash for base metrics
        baseRows.push([repo.id, baseHash, baseHash, metric.id, metricValue, metricValue, measuredAt]);
      }
    }

    // Insert and normalize current metrics
    const rows = [];
    for (const [metricKey, metricValue] of Object.entries(metrics)) {
      const metric = byKey.get(metricKey);

      if (metric) {
        // Normalization formula from CodeVitals:
        // normalized = (current * baseline_stored) / baseline_current
        const normalizedValue =
          baseValues.has(metric.id) && baseMetrics?.[metricKey]
            ? (metricValue * baseValues.get(metric.id)) / baseMetrics[metricKey]
            : metricValue;

        rows.push([repo.id, branch, hash, metric.id, normalizedValue, metricValue, measuredAt]);
      }
    }

    const allRows = [...baseRows, ...rows];
    if (allRows.length > 0) {
      if (Number.isNaN(measuredAt)) {
        throw new HttpError(400, 'Invalid timestamp');
      }
      await insertPerf(db, allRows);
    }

    return json({ status: 'ok', count: rows.length });
  });
}
