import { json } from './http.js';
import { createRouter } from './router.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { collaboratorRoutes } from './routes/collaborators.js';
import { logRoutes } from './routes/log.js';
import { metricRoutes } from './routes/metrics.js';
import { perfRoutes } from './routes/perf.js';
import { publicRepoRoutes } from './routes/public-repos.js';
import { repoRoutes } from './routes/repos.js';

const router = createRouter();

router.get('/health', () => json({ status: 'ok', timestamp: new Date().toISOString() }));

adminRoutes(router);
authRoutes(router);
logRoutes(router);
publicRepoRoutes(router);
repoRoutes(router);
metricRoutes(router);
perfRoutes(router);
collaboratorRoutes(router);

export default function handler(request, { env }) {
  return router.handle(request, env);
}
