import { HttpError, json, readJson } from '../http.js';
import { SCHEMA } from '../schema.js';

// Columns of each imported table, in dependency order. Rows arrive as arrays in this order.
const TABLES = {
  users: {
    id: 'INT',
    github_id: 'BIGINT',
    username: 'VARCHAR(191)',
    access_token: 'VARCHAR(2048)',
    refresh_token: 'VARCHAR(2048)',
    token_expires_at: 'BIGINT',
    created_at: 'BIGINT',
  },
  repositories: {
    id: 'INT',
    owner: 'VARCHAR(191)',
    name: 'VARCHAR(191)',
    github_id: 'BIGINT',
    description: 'VARCHAR(4096)',
    stars: 'INT',
    language: 'VARCHAR(191)',
    language_color: 'VARCHAR(32)',
    updated_at: 'BIGINT',
    is_private: 'INT',
    is_github: 'INT',
    url: 'VARCHAR(2048)',
    metrics_token: 'VARCHAR(191)',
    metrics_public: 'INT',
  },
  user_repositories: {
    user_id: 'INT',
    repo_id: 'INT',
    date_added: 'BIGINT',
    role: 'VARCHAR(16)',
    last_synced: 'BIGINT',
  },
  metrics: {
    id: 'INT',
    repo_id: 'INT',
    key: 'VARCHAR(191)',
    name: 'VARCHAR(255)',
    unit: 'VARCHAR(64)',
    priority: 'INT',
    default_visible: 'INT',
    min_regression_delta: 'DOUBLE',
    created_at: 'BIGINT',
  },
  perf: {
    id: 'BIGINT',
    repo_id: 'INT',
    branch: 'VARCHAR(191)',
    hash: 'VARCHAR(191)',
    metric_id: 'INT',
    value: 'DOUBLE',
    raw_value: 'DOUBLE',
    measured_at: 'BIGINT',
  },
};

const quote = (name) => `\`${name}\``;

function importSql(table) {
  const columns = Object.entries(TABLES[table]);
  const names = columns.map(([name]) => quote(name)).join(', ');
  const paths = columns
    .map(([name, type], index) => `${quote(name)} ${type} PATH '$[${index}]'`)
    .join(', ');

  // IGNORE and the original ids make an import safe to repeat: a batch retried after
  // a timeout can't duplicate rows, and a later run only adds what's new.
  return `INSERT IGNORE INTO ${table} (${names})
    SELECT ${names} FROM JSON_TABLE(?, '$[*]' COLUMNS (${paths})) AS incoming`;
}

// Off unless the space has a MIGRATION_KEY, and meant to be unset again after the move
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
    return json({ tables: Object.keys(TABLES) });
  });

  router.post('/api/admin/import/:table', requireMigrationKey, async ({ db, params, request }) => {
    if (!TABLES[params.table]) {
      throw new HttpError(404, 'Unknown table');
    }

    const { rows } = await readJson(request);
    await db.prepare(importSql(params.table)).bind(JSON.stringify(rows)).run();
    return json({ received: rows.length });
  });

  router.get('/api/admin/status', requireMigrationKey, async ({ db }) => {
    const counts = await Promise.all(
      Object.keys(TABLES).map(async (table) => {
        const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first();
        return [table, Number(row.count)];
      })
    );
    const { maxId } = await db.prepare('SELECT MAX(id) AS maxId FROM perf').first();
    return json({ ...Object.fromEntries(counts), perfMaxId: Number(maxId ?? 0) });
  });
}
