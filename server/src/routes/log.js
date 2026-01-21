import express from 'express';
import { repoQueries, metricsQueries, perfQueries, transaction } from '../db/queries.js';

const router = express.Router();

// POST /api/log?token=<TOKEN>
// Logs performance metrics from CI/CD pipelines
// Copied from CodeVitals /api/log.js, adapted for SQLite/Express
router.post('/', async (req, res) => {
  const { token } = req.query;

  try {
    const { metrics, hash, timestamp, branch, baseMetrics, baseHash } = req.body;

    // Find repo by token
    const repo = repoQueries.findByMetricsToken.get(token);
    if (!repo) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get available metrics for this repo
    const availableMetrics = metricsQueries.findByRepoId.all(repo.id);

    // Get existing base perfs for normalization
    const basePerfs = perfQueries.findByHashAndRepoId.all(baseHash, repo.id);

    // Insert base metrics if not already present
    const baseTuples = [];
    Object.entries(baseMetrics || {}).forEach(([metricKey, metricValue]) => {
      const availableMetric = availableMetrics.find((m) => m.key === metricKey);
      const baseValue = availableMetric
        ? basePerfs.find((p) => p.metric_id === availableMetric.id)
        : null;

      if (availableMetric && !baseValue) {
        baseTuples.push([
          repo.id,
          baseHash, // branch = baseHash for base metrics
          baseHash,
          availableMetric.id,
          metricValue,
          metricValue,
          new Date(timestamp).toISOString(),
        ]);
      }
    });

    // Insert and normalize current metrics
    const tuples = [];
    Object.entries(metrics).forEach(([metricKey, metricValue]) => {
      const availableMetric = availableMetrics.find((m) => m.key === metricKey);
      const baseValue = availableMetric
        ? basePerfs.find((p) => p.metric_id === availableMetric.id)
        : null;

      if (availableMetric) {
        // Normalization formula from CodeVitals:
        // normalized = (current * baseline_stored) / baseline_current
        const normalizedValue =
          baseValue && baseMetrics?.[availableMetric.key]
            ? (metricValue * baseValue.value) / baseMetrics[availableMetric.key]
            : metricValue;

        tuples.push([
          repo.id,
          branch,
          hash,
          availableMetric.id,
          normalizedValue,
          metricValue,
          new Date(timestamp).toISOString(),
        ]);
      }
    });

    // Use a transaction to batch all inserts - improves performance and prevents lock contention
    const insertAllMetrics = transaction(() => {
      for (const tuple of baseTuples) {
        perfQueries.insert.run(...tuple);
      }
      for (const tuple of tuples) {
        perfQueries.insert.run(...tuple);
      }
    });
    insertAllMetrics();

    res.json({ status: 'ok', count: tuples.length });
  } catch (error) {
    console.error('[API] Failed to log metrics:', error);
    res.status(500).json({ error: 'Failed to log metrics' });
  }
});

export default router;
