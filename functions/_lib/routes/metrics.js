import { authenticate, optionalAuth, requireRepositoryAccessOrPublic, requireRepositoryAdmin } from '../auth.js';
import { HttpError, json, noContent, readJson } from '../http.js';
import {
  createMetric,
  deleteMetric,
  findMetric,
  findMetricByKey,
  findMetrics,
  updateMetric,
  updateMetricsPublic,
  updateMetricsToken,
} from '../queries.js';

const BASE = '/api/repos/:owner/:repo/metrics';

const formatMetric = (metric) => ({
  id: metric.id,
  repoId: metric.repo_id,
  key: metric.key,
  name: metric.name,
  unit: metric.unit,
  priority: Number(metric.priority),
  defaultVisible: Boolean(Number(metric.default_visible)),
  minRegressionDelta: Number(metric.min_regression_delta),
  createdAt: new Date(Number(metric.created_at)).toISOString(),
});

const isValidDelta = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Generate a secure random token
function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function findRepoMetric({ db, params, repo }) {
  const id = Number(params.id);
  const metric = Number.isInteger(id) ? await findMetric(db, id) : null;

  if (!metric || metric.repo_id !== repo.id) {
    throw new HttpError(404, 'Metric not found');
  }

  return metric;
}

export function metricRoutes(router) {
  // List metrics for a repo. Returns all metrics; defaultVisible controls UI display, not accessibility
  router.get(BASE, optionalAuth, requireRepositoryAccessOrPublic, async ({ db, repo }) =>
    json((await findMetrics(db, repo.id)).map(formatMetric))
  );

  // Create a new metric
  router.post(BASE, authenticate, requireRepositoryAdmin, async ({ db, request, repo }) => {
    const { key, name, unit, priority = 0, defaultVisible = true, minRegressionDelta = 0 } =
      await readJson(request);

    // Validate key format (alphanumeric + underscores + dashes)
    if (!key || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) {
      throw new HttpError(
        400,
        'Invalid key format. Must start with a letter and contain only letters, numbers, underscores, and dashes.'
      );
    }

    if (!name || name.trim().length === 0) {
      throw new HttpError(400, 'Name is required');
    }

    if (!isValidDelta(minRegressionDelta)) {
      throw new HttpError(400, 'minRegressionDelta must be a non-negative number');
    }

    if (await findMetricByKey(db, repo.id, key)) {
      throw new HttpError(409, 'A metric with this key already exists');
    }

    const metric = await createMetric(db, repo.id, {
      key,
      name: name.trim(),
      unit: unit || null,
      priority,
      defaultVisible,
      minRegressionDelta,
    });

    return json(formatMetric(metric), 201);
  });

  // Get repo info for commit links and settings
  // NOTE: These static routes must be defined BEFORE /:id
  router.get(`${BASE}/info`, optionalAuth, requireRepositoryAccessOrPublic, ({ repo }) =>
    json({
      url: repo.url || null,
      description: repo.description || null,
      isGithub: Boolean(Number(repo.is_github)),
    })
  );

  // Get metrics token (admin only)
  router.get(`${BASE}/token`, authenticate, requireRepositoryAdmin, ({ repo }) =>
    json({ token: repo.metrics_token || null })
  );

  // Generate or regenerate token
  router.post(`${BASE}/token/regenerate`, authenticate, requireRepositoryAdmin, async ({ db, repo }) => {
    const token = generateToken();
    await updateMetricsToken(db, repo.id, token);
    return json({ token });
  });

  // Get public status (admin only)
  router.get(`${BASE}/public`, authenticate, requireRepositoryAdmin, ({ repo }) =>
    json({ isPublic: Boolean(Number(repo.metrics_public)) })
  );

  // Update public status (admin only)
  router.put(`${BASE}/public`, authenticate, requireRepositoryAdmin, async ({ db, request, repo }) => {
    const { isPublic } = await readJson(request);

    if (typeof isPublic !== 'boolean') {
      throw new HttpError(400, 'isPublic must be a boolean');
    }

    await updateMetricsPublic(db, repo.id, isPublic);
    return json({ isPublic });
  });

  // Update a metric
  router.put(`${BASE}/:id`, authenticate, requireRepositoryAdmin, async (context) => {
    const { db } = context;
    const existing = await findRepoMetric(context);
    const { name, unit, priority, defaultVisible, minRegressionDelta } = await readJson(context.request);

    if (name !== undefined && (!name || name.trim().length === 0)) {
      throw new HttpError(400, 'Name cannot be empty');
    }

    if (minRegressionDelta !== undefined && !isValidDelta(minRegressionDelta)) {
      throw new HttpError(400, 'minRegressionDelta must be a non-negative number');
    }

    const metric = await updateMetric(db, existing.id, {
      name: name !== undefined ? name.trim() : existing.name,
      unit: unit !== undefined ? unit || null : existing.unit,
      priority: priority !== undefined ? priority : existing.priority,
      defaultVisible: defaultVisible !== undefined ? defaultVisible : Number(existing.default_visible),
      minRegressionDelta:
        minRegressionDelta !== undefined ? minRegressionDelta : existing.min_regression_delta,
    });

    return json(formatMetric(metric));
  });

  // Delete a metric
  router.delete(`${BASE}/:id`, authenticate, requireRepositoryAdmin, async (context) => {
    const metric = await findRepoMetric(context);
    await deleteMetric(context.db, metric.id);
    return noContent();
  });
}
