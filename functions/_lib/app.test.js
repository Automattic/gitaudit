// Runs the app against MariaDB through scripts/local-db.mjs, which enforces Spacefast's
// limits, with GitHub stubbed. Start the database with `npm run db:start` first.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createLocalDb } from '../../scripts/local-db.mjs';
import handler from './app.js';
import { signToken, verifyToken } from './jwt.js';
import { SCHEMA } from './schema.js';

const SECRET = 'test-secret';
const DAY = 24 * 60 * 60 * 1000;
const server = process.env.LOCAL_DB_URL ?? 'mysql://root:codevitals@127.0.0.1:3307';

let db;
let env;
let githubResponses;

const realFetch = globalThis.fetch;

/** Answer GitHub's API from githubResponses, in the order the app calls it. */
function stubGitHub() {
  githubResponses = [];
  mock.method(globalThis, 'fetch', async () => {
    const next = githubResponses.shift();
    assert.ok(next, 'Unexpected GitHub request');
    return next instanceof Response ? next : Response.json(next);
  });
}

async function call(method, path, { token, body } = {}) {
  const response = await handler(
    new Request(`http://codevitals.test${path}`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: body && JSON.stringify(body),
    }),
    { env }
  );
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

const session = (githubId, username) => signToken({ githubId, username }, SECRET, 3600);

async function seed() {
  const now = Date.now();
  await db.query('DELETE FROM perf');
  await db.query('DELETE FROM repositories');
  await db.query('DELETE FROM users');
  await db.query(
    `INSERT INTO users (id, github_id, username, access_token, created_at)
     VALUES (1, 100, 'ada', 'gho_ada', ?), (2, 200, 'grace', 'gho_grace', ?)`,
    [now, now]
  );
  await db.query(
    `INSERT INTO repositories (id, owner, name, github_id, is_github, metrics_token, metrics_public)
     VALUES (1, 'org', 'web', 1, 1, 'web-token', 1), (2, 'ada', 'tools', 0, 0, 'tools-token', 0)`
  );
  await db.query(
    `INSERT INTO user_repositories (user_id, repo_id, date_added, role, last_synced)
     VALUES (1, 1, ?, 'admin', ?), (1, 2, ?, 'admin', NULL)`,
    [now, now, now]
  );
}

before(async () => {
  const admin = createLocalDb(server);
  await admin.query('DROP DATABASE IF EXISTS codevitals_test');
  await admin.query('CREATE DATABASE codevitals_test');
  await admin.close();

  db = createLocalDb(`${server}/codevitals_test`);
  for (const statement of SCHEMA) {
    await db.prepare(statement).run();
  }
  env = { DB: db, SESSION_SECRET: SECRET, GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' };
});

after(() => db.close());

beforeEach(async () => {
  mock.restoreAll();
  globalThis.fetch = realFetch;
  await seed();
  stubGitHub();
});

describe('sessions', () => {
  it('rejects tampered and expired tokens', async () => {
    const [header, payload] = (await session(100, 'ada')).split('.');
    const forged = await signToken({ githubId: 200 }, 'other-secret', 60);
    const expired = await signToken({ githubId: 100 }, SECRET, -10);

    assert.equal((await call('GET', '/auth/verify', { token: forged })).status, 403);
    assert.equal((await call('GET', '/auth/verify', { token: expired })).status, 403);
    assert.equal((await call('GET', '/auth/verify', { token: `${header}.${payload}.AAAA` })).status, 403);
  });
});

describe('GitHub login', () => {
  it('redirects to GitHub with this site as the callback', async () => {
    const { status, headers } = await call('GET', '/auth/github?state=%2Frepos%2Forg%2Fweb');
    const location = new URL(headers.get('location'));

    assert.equal(status, 302);
    assert.equal(location.searchParams.get('redirect_uri'), 'http://codevitals.test/auth/github/callback');
    assert.equal(location.searchParams.get('state'), '/repos/org/web');
  });

  it('creates the user, and sends them back with a session', async () => {
    githubResponses.push(
      { access_token: 'gho_new', refresh_token: 'ghr_new', expires_in: 28800 },
      { data: { viewer: { databaseId: 300, login: 'katherine' } } }
    );

    const { status, headers } = await call('GET', '/auth/github/callback?code=abc&state=%2Frepos');
    const location = new URL(headers.get('location'));
    const token = location.searchParams.get('token');

    assert.equal(status, 302);
    assert.equal(location.pathname, '/auth/callback');
    assert.equal(location.searchParams.get('from'), '/repos');
    assert.equal((await call('GET', '/auth/verify', { token })).body.user.username, 'katherine');
  });

  it('stores new tokens for a returning user', async () => {
    githubResponses.push(
      { access_token: 'gho_rotated' },
      { data: { viewer: { databaseId: 100, login: 'ada' } } }
    );

    await call('GET', '/auth/github/callback?code=abc');

    const [[user]] = await db.query("SELECT access_token FROM users WHERE username = 'ada'");
    assert.equal(user.access_token, 'gho_rotated');
  });

  it('reports a failed exchange to the login page', async () => {
    githubResponses.push({ error: 'bad_verification_code' });
    const { headers } = await call('GET', '/auth/github/callback?code=expired');
    assert.match(headers.get('location'), /\/login\?error=auth_failed$/);
  });
});

describe('GitHub repositories', () => {
  const repository = {
    databaseId: 9,
    name: 'site',
    owner: { login: 'org' },
    description: 'A site',
    stargazerCount: 3,
    primaryLanguage: { name: 'PHP', color: '#777' },
    updatedAt: '2026-10-01T00:00:00Z',
    isPrivate: false,
  };

  it('searches and browses with the user token', async () => {
    const token = await session(100, 'ada');
    githubResponses.push(
      { data: { search: { nodes: [repository] } } },
      { data: { viewer: { repositories: { nodes: [repository] } } } }
    );

    assert.equal((await call('GET', '/api/repos/search?q=site', { token })).body.repos[0].name, 'site');
    assert.equal((await call('GET', '/api/repos/browse', { token })).body.repos[0].name, 'site');
    assert.equal((await call('GET', '/api/repos/search?q=si', { token })).status, 400);
  });

  it('saves a repository with the role GitHub reports', async () => {
    const token = await session(100, 'ada');
    githubResponses.push({ data: { repository: { viewerPermission: 'ADMIN' } } });

    const { body } = await call('POST', '/api/repos/save', {
      token,
      body: {
        owner: 'org',
        name: 'site',
        githubId: 9,
        description: 'A site',
        stars: 3,
        language: 'PHP',
        languageColor: '#777',
        updatedAt: '2026-10-01T00:00:00Z',
        isPrivate: false,
      },
    });

    assert.equal(body.role, 'admin');
    assert.equal(body.repo.fullName, 'org/site');
    assert.equal(body.repo.updatedAt, '2026-10-01T00:00:00.000Z');
    assert.ok((await call('GET', '/api/repos', { token })).body.repos.some((r) => r.name === 'site'));
  });

  it('saves as a member when GitHub can not confirm admin', async () => {
    githubResponses.push(new Response('', { status: 502 }));

    const { body } = await call('POST', '/api/repos/save', {
      token: await session(100, 'ada'),
      body: { owner: 'org', name: 'other', githubId: 10 },
    });

    assert.equal(body.role, 'member');
  });
});

describe('role refresh', () => {
  const makeStale = () => db.query('UPDATE user_repositories SET last_synced = ?', [Date.now() - 2 * DAY]);

  it('updates a stale role from GitHub', async () => {
    await makeStale();
    githubResponses.push({ data: { repository: { viewerPermission: 'WRITE' } } });

    const { body } = await call('GET', '/api/repos/org/web/permission', { token: await session(100, 'ada') });

    assert.equal(body.role, 'member');
  });

  it('removes someone GitHub says has lost access', async () => {
    await makeStale();
    githubResponses.push({ data: { repository: null }, errors: [{ type: 'NOT_FOUND' }] });

    const { status } = await call('GET', '/api/repos/org/web/permission', { token: await session(100, 'ada') });

    assert.equal(status, 403);
    assert.equal((await call('GET', '/api/repos', { token: await session(100, 'ada') })).body.repos.length, 1);
  });

  it('keeps access when GitHub is down', async () => {
    await makeStale();
    githubResponses.push(new Response('', { status: 503 }));

    const { body } = await call('GET', '/api/repos/org/web/permission', { token: await session(100, 'ada') });

    assert.equal(body.role, 'admin');
    assert.equal((await call('GET', '/api/repos', { token: await session(100, 'ada') })).body.repos.length, 2);
  });

  it('leaves custom repositories alone', async () => {
    await makeStale();
    const { body } = await call('GET', '/api/repos/ada/tools/permission', { token: await session(100, 'ada') });
    assert.equal(body.role, 'admin');
  });
});

describe('token refresh', () => {
  it('refreshes an expired token only when calling GitHub', async () => {
    await db.query(
      "UPDATE users SET refresh_token = 'ghr_old', token_expires_at = ? WHERE username = 'ada'",
      [Date.now() - DAY]
    );
    const token = await session(100, 'ada');

    assert.equal((await call('GET', '/api/repos', { token })).status, 200);

    githubResponses.push(
      { access_token: 'gho_fresh', refresh_token: 'ghr_fresh', expires_in: 28800 },
      { data: { search: { nodes: [] } } }
    );
    assert.equal((await call('GET', '/api/repos/search?q=site', { token })).status, 200);

    const [[user]] = await db.query("SELECT access_token, refresh_token FROM users WHERE username = 'ada'");
    assert.deepEqual({ ...user }, { access_token: 'gho_fresh', refresh_token: 'ghr_fresh' });
  });

  it('asks the user to sign in again when the refresh fails', async () => {
    await db.query(
      "UPDATE users SET refresh_token = 'ghr_old', token_expires_at = ? WHERE username = 'ada'",
      [Date.now() - DAY]
    );
    githubResponses.push({ error: 'bad_refresh_token' });

    const { status } = await call('GET', '/api/repos/search?q=site', { token: await session(100, 'ada') });

    assert.equal(status, 401);
  });
});

describe('/api/log', () => {
  async function addMetrics(count) {
    const values = Array.from({ length: count }, (_, i) => [1, `m${i}`, `Metric ${i}`, Date.now()]);
    await db.query('INSERT INTO metrics (repo_id, `key`, name, created_at) VALUES ?', [values]);
  }

  const post = (body, token = 'web-token') =>
    call('POST', `/api/log?token=${token}`, {
      body: { branch: 'trunk', timestamp: '2026-10-30T12:00:00Z', ...body },
    });

  it('stores a post larger than the bound parameter limit allows', async () => {
    await addMetrics(40);
    const metrics = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`m${i}`, i + 0.5]));

    const { body } = await post({
      metrics,
      hash: 'a'.repeat(40),
      baseHash: 'b'.repeat(40),
      baseMetrics: metrics,
    });

    assert.deepEqual(body, { status: 'ok', count: 40 });
    const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM perf');
    assert.equal(count, 80);
  });

  it('normalizes against the stored base value', async () => {
    await addMetrics(1);

    await post({ metrics: { m0: 100 }, hash: 'first', baseHash: 'base', baseMetrics: { m0: 80 } });
    await post({ metrics: { m0: 100 }, hash: 'second', baseHash: 'base', baseMetrics: { m0: 40 } });

    const [[row]] = await db.query("SELECT value, raw_value FROM perf WHERE hash = 'second'");
    assert.deepEqual({ ...row }, { value: 200, raw_value: 100 });
  });

  it('keeps stored values accurate', async () => {
    await addMetrics(1);
    await post({ metrics: { m0: 181.91799926757812 }, hash: 'accurate' });

    // JSON_TABLE can round the last bit of a double, which is far below what charts show
    const [[row]] = await db.query("SELECT value FROM perf WHERE hash = 'accurate'");
    assert.ok(Math.abs(row.value - 181.91799926757812) < 1e-9);
  });

  it('keeps runs that share a timestamp in the order they arrived', async () => {
    await addMetrics(1);
    await post({ metrics: { m0: 1 }, hash: 'first' });
    await post({ metrics: { m0: 2 }, hash: 'second' });

    const [[metric]] = await db.query("SELECT id FROM metrics WHERE `key` = 'm0'");
    const { body } = await call('GET', `/api/repos/org/web/perf/evolution/${metric.id}?limit=10`);

    assert.deepEqual(body.data.map((point) => point.hash), ['first', 'second']);
  });

  it('rejects an unknown token', async () => {
    assert.equal((await post({ metrics: {} }, 'wrong')).status, 401);
  });
});

describe('metrics token', () => {
  const TOKEN_PATH = '/api/repos/org/web/metrics/token';

  it('says whether a token exists without returning it', async () => {
    const token = await session(100, 'ada');

    assert.deepEqual((await call('GET', TOKEN_PATH, { token })).body, { tokenSet: true });

    await db.query('UPDATE repositories SET metrics_token = NULL WHERE id = 1');
    assert.deepEqual((await call('GET', TOKEN_PATH, { token })).body, { tokenSet: false });
  });

  it('returns a new token once, and it replaces the old one', async () => {
    const token = await session(100, 'ada');
    const log = (metricsToken) =>
      call('POST', `/api/log?token=${metricsToken}`, {
        body: { branch: 'trunk', metrics: {}, hash: 'a', timestamp: '2026-10-30T12:00:00Z' },
      });

    const regenerated = await call('POST', `${TOKEN_PATH}/regenerate`, { token });

    assert.match(regenerated.body.token, /^[0-9a-f]{64}$/);
    assert.equal((await log(regenerated.body.token)).status, 200);
    assert.equal((await log('web-token')).status, 401);
    assert.deepEqual((await call('GET', TOKEN_PATH, { token })).body, { tokenSet: true });
  });

  it('is limited to repository admins', async () => {
    const token = await session(200, 'grace');
    await db.query('INSERT INTO user_repositories (user_id, repo_id, date_added, role, last_synced) VALUES (2, 1, ?, ?, ?)', [
      Date.now(),
      'member',
      Date.now(),
    ]);

    assert.equal((await call('GET', TOKEN_PATH, { token })).status, 403);
    assert.equal((await call('POST', `${TOKEN_PATH}/regenerate`, { token })).status, 403);
  });

  it('stays out of the response when a repository is saved again', async () => {
    githubResponses.push(new Response('', { status: 502 }));

    const { body } = await call('POST', '/api/repos/save', {
      token: await session(200, 'grace'),
      body: { owner: 'org', name: 'web', githubId: 1 },
    });

    assert.equal(body.role, 'member');
    assert.ok(!JSON.stringify(body).includes('web-token'));
  });
});

describe('admin routes', () => {
  it('do not exist without a migration key', async () => {
    assert.equal((await call('POST', '/api/admin/schema')).status, 404);
  });

  it('create the tables with the key', async () => {
    const response = await handler(
      new Request('http://codevitals.test/api/admin/schema', {
        method: 'POST',
        headers: { 'x-migration-key': 'key' },
      }),
      { env: { ...env, MIGRATION_KEY: 'key' } }
    );

    assert.equal(response.status, 200);
  });
});

describe('limits', () => {
  it('reads every public repository in one homepage request', async () => {
    const values = Array.from({ length: 300 }, (_, i) => [1, `m${i}`, `Metric ${i}`, Date.now()]);
    await db.query('INSERT INTO metrics (repo_id, `key`, name, created_at) VALUES ?', [values]);

    const { status, body } = await call('GET', '/api/public-repos');

    assert.equal(status, 200);
    assert.equal(body[0].metrics.length, 3);
  });
});
