import { HttpError, json } from '../http.js';
import { SCHEMA } from '../schema.js';

// Off unless the space has a MIGRATION_KEY, which is only set while creating its tables
function requireMigrationKey({ env, request }) {
  if (!env.MIGRATION_KEY || request.headers.get('x-migration-key') !== env.MIGRATION_KEY) {
    throw new HttpError(404, 'Not found');
  }
}

export function adminRoutes(router) {
  router.post('/api/admin/schema', requireMigrationKey, async ({ db }) => {
    for (const statement of SCHEMA) {
      await db.prepare(statement).run();
    }
    return json({ tables: SCHEMA.length });
  });
}
