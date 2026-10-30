import express from 'express';
import { repoQueries, metricsQueries, findLatestValuesByMetric } from '../db/queries.js';
import { recentAverages, RECENT_VALUES } from '../utils/averages.js';

const router = express.Router();

// Metrics shown on each repo's homepage card
const CARD_METRICS = 3;
const SPARKLINE_POINTS = 20;

// GET /api/public-repos
// Returns all repositories with public metrics enabled, including the metrics on their
// homepage card and sparkline data
router.get('/', async (req, res) => {
  try {
    // Get all repos with metrics_public = 1
    const repos = repoQueries.findAllPublicMetricsRepos.all().map((repo) => ({
      ...repo,
      metrics: metricsQueries.findByRepoId
        .all(repo.id)
        .filter((metric) => metric.default_visible)
        .slice(0, CARD_METRICS),
    }));

    const latest = findLatestValuesByMetric(
      repos.flatMap((repo) => repo.metrics.map((metric) => metric.id)),
      'trunk',
      RECENT_VALUES
    );

    const reposWithMetrics = repos.map((repo) => ({
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      fullName: `${repo.owner}/${repo.name}`,
      description: repo.description,
      language: repo.language,
      languageColor: repo.language_color,
      metrics: repo.metrics.map((metric) => {
        const values = latest.get(metric.id);
        const { average, previous } = recentAverages(values);

        return {
          id: metric.id,
          key: metric.key,
          name: metric.name,
          unit: metric.unit,
          // Oldest first for the sparkline
          sparklineData: values.slice(0, SPARKLINE_POINTS).reverse(),
          currentAverage: average,
          changePercent: average && previous ? (average - previous) / previous : null,
        };
      }),
    }));

    res.json(reposWithMetrics);
  } catch (error) {
    console.error('[API] Failed to fetch public repos:', error);
    res.status(500).json({ error: 'Failed to fetch public repositories' });
  }
});

export default router;
