#!/usr/bin/env node
// Fills the local MariaDB from `npm run db:start` with test data, creating its tables
// first, then prints a sign-in link, since the test user can't sign in through GitHub.
//
// Usage:
//   npm run seed         Add the test data, keeping what's there
//   npm run seed:reset   Clear the database first
import dotenv from 'dotenv';
import { createSessionToken } from '../functions/_lib/auth.js';
import {
  createLocalRepo,
  createMetric,
  findRepo,
  saveGithubRepo,
  saveUser,
  updateMetricsPublic,
  updateMetricsToken,
} from '../functions/_lib/queries.js';
import { SCHEMA } from '../functions/_lib/schema.js';
import { createLocalDb } from './local-db.mjs';
import {
  generatePerfData,
  metricDefinitions,
  testCollaborator,
  testRepositories,
  testUser,
} from './seed-data.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

// The test user's token is fake, so its roles must never be refreshed from GitHub: the
// refresh would fail and remove the user from their repositories.
const NEVER_STALE = Date.UTC(2099, 0, 1);

const db = createLocalDb(process.env.LOCAL_DB_URL ?? 'mysql://root:codevitals@127.0.0.1:3307/codevitals');

async function seedRepository(userId, data) {
  if (await findRepo(db, data.owner, data.name)) {
    console.log(`  ${data.owner}/${data.name} already exists`);
    return;
  }

  // Added as admin, so every settings screen can be tested
  const repo = data.isGithub
    ? await saveGithubRepo(db, { ...data, updatedAt: Date.now() }, userId, 'admin', NEVER_STALE)
    : await createLocalRepo(db, data, userId);

  await updateMetricsToken(db, repo.id, data.metricsToken);
  await updateMetricsPublic(db, repo.id, data.metricsPublic ? 1 : 0);

  for (const definition of metricDefinitions) {
    const metric = await createMetric(db, repo.id, { ...definition, minRegressionDelta: 0 });

    // One bulk insert, which the platform's limits wouldn't allow but a local database does
    await db.query(
      'INSERT INTO perf (repo_id, branch, hash, metric_id, value, raw_value, measured_at) VALUES ?',
      [generatePerfData(metric.id, definition.key, repo.id)]
    );
  }

  console.log(`  ${data.owner}/${data.name}: ${metricDefinitions.length} metrics`);
}

async function printSignInLink(user) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    console.log('\nSet SESSION_SECRET in .env and run this again to get a sign-in link.');
    return;
  }

  const token = await createSessionToken(user, secret);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  console.log('\nSign in as the test user with this link (valid for 30 days):');
  console.log(`  ${clientUrl}/auth/callback?token=${token}`);
}

for (const statement of SCHEMA) {
  await db.query(statement);
}

if (process.argv.includes('--reset')) {
  // Everything else belongs to these, and goes with them
  await db.query('DELETE FROM repositories');
  await db.query('DELETE FROM users');
  console.log('Cleared the database');
}

const user = await saveUser(db, testUser);
await saveUser(db, testCollaborator);

console.log('Seeding repositories...');
for (const repo of testRepositories) {
  await seedRepository(user.id, repo);
}

await printSignInLink(user);
await db.close();
