#!/usr/bin/env node
/**
 * Copies a CodeVitals SQLite database into a space through its admin routes. The
 * space needs a MIGRATION_KEY variable, and the same value in this script's environment.
 *
 * Usage:
 *   MIGRATION_KEY=... node scripts/import-to-spacefast.mjs <database.db> <url> [--new-only]
 *
 * Options:
 *   --new-only  Only send perf rows newer than the space has, for the final sync before cutover
 *
 * Environment:
 *   SPACE_TOKEN  Machine token (sfm_...), needed while the space is private
 *
 * Rows keep their original ids and the routes ignore ones they already have, so this
 * is safe to run again. It compares row counts at the end, and exits with an error if
 * anything is missing.
 */
import Database from 'better-sqlite3';

const [source, url] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const newOnly = process.argv.includes('--new-only');
const migrationKey = process.env.MIGRATION_KEY;

if (!source || !url || !migrationKey) {
  console.error('Usage: MIGRATION_KEY=... node scripts/import-to-spacefast.mjs <database.db> <url> [--new-only]');
  process.exit(1);
}

const CONCURRENCY = 6;
const MAX_BATCH_BYTES = 58000; // Under the platform's 64 KB per operation, leaving room for the SQL
const MAX_BATCH_ROWS = 500;
const RETRIES = 6;

// Re-reading this many perf rows covers any gaps left by batches that ran concurrently
const NEW_ONLY_OVERLAP = 10000;

const headers = {
  'content-type': 'application/json',
  'x-migration-key': migrationKey,
  ...(process.env.SPACE_TOKEN && { 'x-sf-authorization': `Bearer ${process.env.SPACE_TOKEN}` }),
};

async function request(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`${url}${path}`, {
        method,
        headers,
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (response.ok) return await response.json();

      const detail = await response.text();
      if (response.status < 429 && response.status !== 403) {
        throw Object.assign(new Error(`${path}: ${response.status} ${detail.slice(0, 200)}`), {
          fatal: true,
        });
      }
    } catch (error) {
      if (error.fatal || attempt >= RETRIES) throw error;
    }

    if (attempt >= RETRIES) throw new Error(`${path}: gave up after ${RETRIES} retries`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}

// SQLite holds a mix of ISO strings and its own UTC format, which has no time zone
function toMilliseconds(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return value;

  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const milliseconds = Date.parse(iso);

  if (Number.isNaN(milliseconds)) {
    throw new Error(`Can't read timestamp: ${value}`);
  }
  return milliseconds;
}

const now = Date.now();
const TABLES = [
  {
    name: 'users',
    sql: `SELECT id, github_id, username, access_token, refresh_token, token_expires_at, created_at FROM users`,
    row: (r) => [r.id, r.github_id, r.username, r.access_token, r.refresh_token, toMilliseconds(r.token_expires_at), toMilliseconds(r.created_at, now)],
  },
  {
    name: 'repositories',
    sql: `SELECT id, owner, name, github_id, description, stars, language, language_color, updated_at, is_private, is_github, url, metrics_token, metrics_public FROM repositories`,
    row: (r) => [r.id, r.owner, r.name, r.github_id, r.description, r.stars ?? 0, r.language, r.language_color, toMilliseconds(r.updated_at), r.is_private ? 1 : 0, r.is_github === 0 ? 0 : 1, r.url, r.metrics_token, r.metrics_public ? 1 : 0],
  },
  {
    name: 'user_repositories',
    sql: `SELECT user_id, repo_id, date_added, role, last_synced FROM user_repositories`,
    row: (r) => [r.user_id, r.repo_id, toMilliseconds(r.date_added, now), r.role, toMilliseconds(r.last_synced)],
  },
  {
    name: 'metrics',
    sql: `SELECT id, repo_id, key, name, unit, priority, default_visible, min_regression_delta, created_at FROM metrics`,
    row: (r) => [r.id, r.repo_id, r.key, r.name, r.unit, r.priority ?? 0, r.default_visible ? 1 : 0, r.min_regression_delta ?? 0, toMilliseconds(r.created_at, now)],
  },
  {
    name: 'perf',
    sql: `SELECT id, repo_id, branch, hash, metric_id, value, raw_value, measured_at FROM perf WHERE id > ? ORDER BY id`,
    params: (perfAfter) => [perfAfter],
    row: (r) => [r.id, r.repo_id, r.branch, r.hash, r.metric_id, r.value, r.raw_value, toMilliseconds(r.measured_at)],
  },
];

async function importTable(database, table, perfAfter) {
  const running = new Set();
  const start = Date.now();
  let batch = [];
  let bytes = 0;
  let sent = 0;

  const send = async (rows) => {
    const task = request('POST', `/api/admin/import/${table.name}`, { rows }).then(() => {
      running.delete(task);
      sent += rows.length;
    });
    running.add(task);
    if (running.size >= CONCURRENCY) await Promise.race(running);
  };

  const params = table.params ? table.params(perfAfter) : [];

  for (const source of database.prepare(table.sql).iterate(...params)) {
    const row = table.row(source);
    const size = Buffer.byteLength(JSON.stringify(row)) + 1;

    if (batch.length >= MAX_BATCH_ROWS || bytes + size > MAX_BATCH_BYTES) {
      await send(batch);
      batch = [];
      bytes = 0;
    }

    batch.push(row);
    bytes += size;
  }

  if (batch.length > 0) await send(batch);
  await Promise.all(running);

  console.log(`  ${table.name}: sent ${sent} rows in ${Math.round((Date.now() - start) / 1000)}s`);
}

async function main() {
  const database = new Database(source, { readonly: true });

  await request('POST', '/api/admin/schema');

  const before = await request('GET', '/api/admin/status');
  const perfAfter = newOnly ? Math.max(0, before.perfMaxId - NEW_ONLY_OVERLAP) : 0;

  for (const table of TABLES) {
    await importTable(database, table, perfAfter);
  }

  const after = await request('GET', '/api/admin/status');
  let missing = false;

  for (const { name } of TABLES) {
    const expected = database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count;
    const matches = after[name] === expected;
    console.log(`  ${matches ? 'OK ' : 'DIFFERENT'} ${name}: ${after[name]} of ${expected}`);
    missing ||= !matches;
  }

  if (missing) {
    console.error('Row counts differ. A row can be skipped if it breaks a constraint in the new schema.');
    process.exit(1);
  }
}

await main();
