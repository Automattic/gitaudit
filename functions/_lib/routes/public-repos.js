import { recentAverages, RECENT_VALUES } from '../../../server/src/utils/averages.js';
import { json } from '../http.js';
import { findLatestValuesByMetric, findPublicRepoMetrics, findPublicRepos } from '../queries.js';

// Metrics shown on each repo's homepage card
const CARD_METRICS = 3;
const SPARKLINE_POINTS = 20;

export function publicRepoRoutes(router) {
  // Returns all repositories with public metrics enabled, including the metrics on their
  // homepage card and sparkline data
  router.get('/api/public-repos', async ({ db }) => {
    const [repos, metrics] = await Promise.all([findPublicRepos(db), findPublicRepoMetrics(db)]);

    const cards = new Map(repos.map((repo) => [repo.id, []]));
    for (const metric of metrics) {
      const card = cards.get(metric.repo_id);
      if (card.length < CARD_METRICS) card.push(metric);
    }

    const latest = await findLatestValuesByMetric(
      db,
      [...cards.values()].flat().map((metric) => metric.id),
      'trunk',
      RECENT_VALUES
    );

    return json(
      repos.map((repo) => ({
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: `${repo.owner}/${repo.name}`,
        description: repo.description,
        language: repo.language,
        languageColor: repo.language_color,
        metrics: cards.get(repo.id).map((metric) => {
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
      }))
    );
  });
}
