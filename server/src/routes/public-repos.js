import express from 'express';
import { repoQueries, metricsQueries, perfQueries } from '../db/queries.js';

const router = express.Router();

// GET /api/public-repos
// Returns all repositories with public metrics enabled, including visible metrics and sparkline data
router.get('/', async (req, res) => {
  try {
    // Get all repos with metrics_public = 1
    const repos = repoQueries.findAllPublicMetricsRepos.all();

    // For each repo, get visible metrics with sparkline data
    const reposWithMetrics = repos.map((repo) => {
      const metrics = metricsQueries.findVisibleByRepoId.all(repo.id);

      const metricsWithSparkline = metrics.map((metric) => {
        // Get last 20 perf values for sparkline (branch = trunk)
        const perfData = perfQueries.findByMetricIdAndBranch.all(metric.id, 'trunk', 20);
        // Reverse to get oldest first for sparkline
        const sparklineData = perfData.map((p) => p.value).reverse();

        // Calculate averages for change percentage
        const currentAvg = perfQueries.averageByMetricAndBranch.get('trunk', metric.id, 20);
        const previousAvg = perfQueries.averageByMetricAndBranchWithOffset.get(
          'trunk',
          metric.id,
          20,
          20
        );

        let changePercent = null;
        if (currentAvg?.average && previousAvg?.average) {
          changePercent = (currentAvg.average - previousAvg.average) / previousAvg.average;
        }

        return {
          id: metric.id,
          key: metric.key,
          name: metric.name,
          unit: metric.unit,
          sparklineData,
          currentAverage: currentAvg?.average || null,
          changePercent,
        };
      });

      return {
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: `${repo.owner}/${repo.name}`,
        description: repo.description,
        language: repo.language,
        languageColor: repo.language_color,
        metrics: metricsWithSparkline,
      };
    });

    res.json(reposWithMetrics);
  } catch (error) {
    console.error('[API] Failed to fetch public repos:', error);
    res.status(500).json({ error: 'Failed to fetch public repositories' });
  }
});

export default router;
