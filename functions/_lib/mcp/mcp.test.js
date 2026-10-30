// Runs the MCP server against MariaDB through scripts/local-db.mjs, as app.test.js does
// for the API. Start the database with `npm run db:start` first.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createLocalDb } from '../../../scripts/local-db.mjs';
import { GET, POST } from '../../mcp.js';
import { SCHEMA } from '../schema.js';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const URL_BASE = 'http://codevitals.test/mcp';
const MODERN = '2026-07-28';
const LEGACY = '2025-11-25';
const server = process.env.LOCAL_DB_URL ?? 'mysql://root:codevitals@127.0.0.1:3307';

const META = {
  'io.modelcontextprotocol/protocolVersion': MODERN,
  'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
};

let db;
let env;
let nextId = 1;

function post(body, headers = {}) {
  return POST(
    new Request(URL_BASE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { env }
  );
}

/** Send a request the way a client on the current revision does. */
function modern(method, params = {}, headers = {}) {
  return post(
    { jsonrpc: '2.0', id: nextId++, method, params: { ...params, _meta: META } },
    {
      'mcp-protocol-version': MODERN,
      'mcp-method': method,
      ...(params.name && { 'mcp-name': params.name }),
      ...headers,
    }
  );
}

/** Call a tool, and return what it answered. */
async function callTool(name, args = {}) {
  const { result } = await (await modern('tools/call', { name, arguments: args })).json();
  const { text } = result.content[0];
  return result.isError ? { error: text } : JSON.parse(text);
}

/** Read the one message out of a response framed as server-sent events. */
const readEvent = async (response) =>
  JSON.parse((await response.text()).match(/^data: (.*)$/m)[1]);

const hash = (label) => label.padEnd(40, 'x');

async function addRepo(id, owner, name, { isPublic = true, url = null, isGithub = 1 } = {}) {
  await db.query(
    `INSERT INTO repositories (id, owner, name, github_id, is_github, url, metrics_public, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, owner, name, id, isGithub, url, isPublic ? 1 : 0, `About ${name}`]
  );
}

async function addMetric(id, repoId, key, { unit = 'ms', visible = 1, floor = 0 } = {}) {
  await db.query(
    `INSERT INTO metrics (id, repo_id, \`key\`, name, unit, priority, default_visible, min_regression_delta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, repoId, key, `Metric ${key}`, unit, id, visible, floor]
  );
}

/** Rows as [hash, value, measuredAt], for a metric on trunk unless a branch is given. */
async function addRuns(metricId, repoId, runs, branch = 'trunk') {
  await db.query(
    'INSERT INTO perf (repo_id, branch, hash, metric_id, value, raw_value, measured_at) VALUES ?',
    [runs.map(([runHash, value, measuredAt]) => [repoId, branch, runHash, metricId, value, value, measuredAt])]
  );
}

/** One run per commit, an hour apart, with the last one just now. */
const series = (values, label = 'c') =>
  values.map((value, index) => [
    hash(`${label}${index}`),
    value,
    Date.now() - (values.length - index) * HOUR,
  ]);

const repeat = (value, count) => Array.from({ length: count }, () => value);

before(async () => {
  const admin = createLocalDb(server);
  await admin.query('DROP DATABASE IF EXISTS codevitals_mcp_test');
  await admin.query('CREATE DATABASE codevitals_mcp_test');
  await admin.close();

  db = createLocalDb(`${server}/codevitals_mcp_test`);
  for (const statement of SCHEMA) {
    await db.prepare(statement).run();
  }
  env = { DB: db };
});

after(() => db.close());

beforeEach(async () => {
  mock.restoreAll();
  await db.query('DELETE FROM perf');
  await db.query('DELETE FROM repositories');

  await addRepo(1, 'org', 'web');
  await addRepo(2, 'ada', 'secret', { isPublic: false });
  await addMetric(10, 1, 'lcp');
  await addMetric(20, 2, 'lcp');
});

describe('protocol', () => {
  it('describes itself to current clients', async () => {
    const { result } = await (await modern('server/discover')).json();

    assert.deepEqual(result.supportedVersions, [MODERN]);
    assert.deepEqual(result.capabilities.tools, { listChanged: false });
    assert.equal(result._meta['io.modelcontextprotocol/serverInfo'].name, 'codevitals');
  });

  it('lists the same read-only tools every time, with a hint to cache them', async () => {
    const { result } = await (await modern('tools/list')).json();

    assert.deepEqual(
      result.tools.map((tool) => tool.name),
      ['list_projects', 'list_metrics', 'get_metric_history', 'find_changes', 'compare_commits']
    );
    assert.ok(result.tools.every((tool) => tool.annotations.readOnlyHint));
    assert.equal(result.cacheScope, 'public');
    assert.ok(result.ttlMs > 0);
  });

  it('answers tool calls as plain JSON, without a session', async () => {
    const response = await modern('tools/call', { name: 'list_projects', arguments: {} });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('mcp-session-id'), null);
  });

  it('serves clients from before the stateless revision', async () => {
    const initialize = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: LEGACY, capabilities: {}, clientInfo: { name: 'old', version: '1' } },
    });
    assert.equal((await readEvent(initialize)).result.protocolVersion, LEGACY);

    const initialized = await post(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { 'mcp-protocol-version': LEGACY }
    );
    assert.equal(initialized.status, 202);

    const call = await post(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_projects', arguments: {} } },
      { 'mcp-protocol-version': LEGACY }
    );
    const { projects } = JSON.parse((await readEvent(call)).result.content[0].text);
    assert.equal(projects[0].project, 'org/web');
  });

  it('rejects headers that disagree with the body', async () => {
    const response = await modern('tools/call', { name: 'list_projects', arguments: {} }, { 'mcp-name': 'other' });
    assert.equal(response.status, 400);
  });

  it('turns down subscriptions, which have nothing to notify about', async () => {
    const response = await modern('subscriptions/listen', { notifications: { toolsListChanged: true } });
    assert.match((await response.json()).error.message, /Subscription limit/);
  });

  it('accepts calls from servers and from this site, and rejects other sites', async () => {
    const initialize = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: META } };
    const headers = { 'mcp-protocol-version': MODERN, 'mcp-method': 'tools/list' };

    assert.equal((await post(initialize, headers)).status, 200);
    assert.equal((await post(initialize, { ...headers, origin: 'http://codevitals.test' })).status, 200);
    assert.equal((await post(initialize, { ...headers, origin: 'https://evil.example' })).status, 403);
  });

  it('rejects a request too large to be a tool call', async () => {
    const response = await post(JSON.stringify({ padding: 'x'.repeat(70_000) }));
    assert.equal(response.status, 413);
  });

  it('sends people to the page about it, and tells clients GET is not supported', async () => {
    const asBrowser = await GET(new Request(URL_BASE, { headers: { accept: 'text/html' } }));
    assert.equal(asBrowser.status, 302);
    assert.equal(asBrowser.headers.get('location'), '/connect');

    const asClient = await GET(new Request(URL_BASE, { headers: { accept: 'text/event-stream' } }));
    assert.equal(asClient.status, 405);
    assert.equal(asClient.headers.get('allow'), 'POST');
  });
});

describe('private repositories', () => {
  beforeEach(() => addRuns(20, 2, series(repeat(100, 40), 'private')));

  it('are not listed', async () => {
    const { projects } = await callTool('list_projects');
    assert.deepEqual(projects.map(({ project }) => project), ['org/web']);
  });

  const attempts = {
    list_metrics: { project: 'ada/secret' },
    get_metric_history: { project: 'ada/secret', metric: 'lcp' },
    find_changes: { project: 'ada/secret' },
    compare_commits: { project: 'ada/secret', commit: hash('private0') },
  };

  for (const [tool, args] of Object.entries(attempts)) {
    it(`can't be read through ${tool}`, async () => {
      const { error } = await callTool(tool, args);
      assert.equal(error, `There's no public project called "ada/secret". Call list_projects to see them.`);
    });
  }

  it('answer just as a project that does not exist does', async () => {
    const missing = await callTool('list_metrics', { project: 'ada/nothing' });
    const secret = await callTool('list_metrics', { project: 'ada/secret' });
    assert.equal(secret.error, missing.error.replace('nothing', 'secret'));
  });

  it("can't be reached by their short name", async () => {
    const { error } = await callTool('list_metrics', { project: 'secret' });
    assert.match(error, /no public project/);
  });

  it("don't share their commits with public projects", async () => {
    const { error } = await callTool('compare_commits', { project: 'org/web', commit: hash('private0') });
    assert.match(error, /No runs were reported/);
  });

  it('stop being readable once made private', async () => {
    await db.query('UPDATE repositories SET metrics_public = 0 WHERE id = 1');
    assert.deepEqual((await callTool('list_projects')).projects, []);
  });
});

describe('errors', () => {
  it('keep database details from the client, and log them', async () => {
    const error = mock.method(console, 'error', () => {});
    env.DB = { prepare: () => { throw new Error("Table '152306480.repositories' doesn't exist"); } };

    try {
      assert.deepEqual(await callTool('list_metrics', { project: 'org/web' }), {
        error: "CodeVitals couldn't read that data. Try again.",
      });
      assert.equal(error.mock.callCount(), 1);
    } finally {
      env.DB = db;
    }
  });

  it('let the model correct its arguments', async () => {
    assert.match((await callTool('list_metrics', {})).error, /project/);
    assert.match((await callTool('list_metrics', { project: 'nope/nope' })).error, /list_projects/);
    assert.match((await callTool('get_metric_history', { project: 'org/web', metric: 'nope' })).error, /list_metrics/);
    assert.match(
      (await callTool('get_metric_history', { project: 'org/web', metric: 'lcp', since: 'last week' })).error,
      /must be a date/
    );
  });
});

describe('list_projects', () => {
  it('says when each project last reported', async () => {
    const lastRun = Date.now() - 200 * DAY;
    await addRuns(10, 1, [[hash('old'), 100, lastRun]]);

    const { projects } = await callTool('list_projects');

    assert.deepEqual(projects, [
      {
        project: 'org/web',
        description: 'About web',
        language: null,
        lastMeasuredAt: new Date(lastRun).toISOString(),
        dashboardUrl: 'http://codevitals.test/public/org/web/metrics',
      },
    ]);
  });

  it('copes with a project that has no runs', async () => {
    assert.equal((await callTool('list_projects')).projects[0].lastMeasuredAt, null);
  });

  it('keeps long text out of a model\'s context', async () => {
    await db.query('UPDATE repositories SET description = ? WHERE id = 1', ['x'.repeat(5000)]);
    assert.equal((await callTool('list_projects')).projects[0].description.length, 300);
  });
});

describe('list_metrics', () => {
  it('reports the same averages as the dashboard', async () => {
    await addRuns(10, 1, series([...repeat(100, 20), ...repeat(120, 20)]));

    const { metrics } = await callTool('list_metrics', { project: 'org/web' });

    assert.equal(metrics[0].recentAverage, 120);
    assert.equal(metrics[0].previousAverage, 100);
    assert.equal(metrics[0].changePercent, 20);
  });

  it('converts sizes, which are stored in bytes', async () => {
    await addMetric(11, 1, 'bundle', { unit: 'KB' });
    await addRuns(11, 1, series(repeat(2048, 3)));

    const { metrics } = await callTool('list_metrics', { project: 'org/web' });
    const bundle = metrics.find(({ key }) => key === 'bundle');

    assert.equal(bundle.recentAverage, 2);
    assert.equal(bundle.unit, 'KB');
  });

  it('shows how stale a metric is, and which ones the dashboard hides', async () => {
    await addMetric(11, 1, 'hidden', { visible: 0 });
    await addRuns(11, 1, [[hash('old'), 5, Date.now() - 10 * DAY - HOUR]]);

    const { metrics } = await callTool('list_metrics', { project: 'org/web' });
    const hidden = metrics.find(({ key }) => key === 'hidden');

    assert.equal(hidden.daysSinceLastMeasured, 10);
    assert.equal(hidden.shownByDefault, false);
  });

  it('finds a project by its short name, in any case', async () => {
    assert.equal((await callTool('list_metrics', { project: 'WEB' })).project, 'org/web');
    assert.equal((await callTool('list_metrics', { project: 'ORG/web' })).project, 'org/web');
  });

  it('asks for the owner when a short name is ambiguous', async () => {
    await addRepo(3, 'other', 'web');
    assert.match((await callTool('list_metrics', { project: 'web' })).error, /no public project/);
  });
});

describe('get_metric_history', () => {
  it('reads the median of each commit, oldest first', async () => {
    const at = Date.now() - HOUR;
    await addRuns(10, 1, [
      [hash('a'), 90, at],
      [hash('a'), 100, at],
      [hash('a'), 500, at],
      [hash('b'), 200, at + 1],
    ]);

    const { points, commits } = await callTool('get_metric_history', { project: 'org/web', metric: 'lcp' });

    assert.equal(commits, 2);
    assert.deepEqual(points.map(({ value }) => value), [100, 200]);
    assert.equal(points[0].commit, hash('a').slice(0, 12));
  });

  it('groups commits when there are more than asked for', async () => {
    await addRuns(10, 1, series(Array.from({ length: 100 }, (_, index) => index + 1)));

    const { points, commits } = await callTool('get_metric_history', {
      project: 'org/web',
      metric: 'lcp',
      maxPoints: 10,
    });

    assert.equal(commits, 100);
    assert.equal(points.length, 10);
    assert.equal(points.reduce((sum, point) => sum + point.commits, 0), 100);
    assert.deepEqual({ min: points[0].min, max: points[0].max }, { min: 1, max: 10 });
  });

  it('keeps to the period asked for', async () => {
    await addRuns(10, 1, [
      [hash('before'), 1, Date.UTC(2026, 0, 1)],
      [hash('during'), 2, Date.UTC(2026, 1, 1)],
      [hash('after'), 3, Date.UTC(2026, 2, 1)],
    ]);

    const { points } = await callTool('get_metric_history', {
      project: 'org/web',
      metric: 'lcp',
      since: '2026-01-15',
      until: '2026-02-15',
    });

    assert.deepEqual(points.map(({ value }) => value), [2]);
  });

  it('leaves out runs with broken 1970 dates', async () => {
    await addRuns(10, 1, [
      [hash('seconds'), 1, 1_700_000_000],
      [hash('real'), 2, Date.UTC(2026, 0, 1)],
    ]);

    const { points } = await callTool('get_metric_history', { project: 'org/web', metric: 'lcp', since: '1960-01-01' });

    assert.deepEqual(points.map(({ value }) => value), [2]);
  });

  it('leaves out other branches and base commits', async () => {
    await addRuns(10, 1, series([1]));
    await addRuns(10, 1, series([2], 'pr'), 'my-branch');
    await addRuns(10, 1, series([3], 'base'), hash('base0'));

    const { points } = await callTool('get_metric_history', { project: 'org/web', metric: 'lcp' });

    assert.deepEqual(points.map(({ value }) => value), [1]);
  });

  it('finds a metric by its key in any case, or by its name', async () => {
    assert.equal((await callTool('get_metric_history', { project: 'org/web', metric: 'LCP' })).metric.key, 'lcp');
    assert.equal(
      (await callTool('get_metric_history', { project: 'org/web', metric: 'metric lcp' })).metric.key,
      'lcp'
    );
  });
});

describe('find_changes', () => {
  beforeEach(() => db.query('UPDATE repositories SET is_github = 1'));

  it('finds a lasting change, and the commit it started at', async () => {
    await addRuns(10, 1, series([...repeat(100, 40), ...repeat(150, 40)]));

    const { changes, metricsChecked } = await callTool('find_changes', { project: 'org/web' });

    assert.equal(metricsChecked, 1);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].kind, 'regression');
    assert.deepEqual([changes[0].before, changes[0].after, changes[0].changePercent], [100, 150, 50]);
    assert.equal(changes[0].commit, hash('c40').slice(0, 12));
    assert.equal(changes[0].commitUrl, `https://github.com/org/web/commit/${hash('c40')}`);
    assert.equal(changes[0].revertedAt, null);
  });

  it('ignores a spike, which the chart would flag', async () => {
    const values = repeat(100, 80);
    values[50] = 400;
    await addRuns(10, 1, series(values));

    assert.deepEqual((await callTool('find_changes', { project: 'org/web' })).changes, []);
  });

  it('says when a change was undone', async () => {
    await addRuns(10, 1, series([...repeat(100, 30), ...repeat(150, 30), ...repeat(100, 30)]));
    const { changes } = await callTool('find_changes', { project: 'org/web' });

    assert.equal(changes.length, 1);
    assert.notEqual(changes[0].revertedAt, null);
  });

  it('only reports changes in the period asked for', async () => {
    const values = [...repeat(100, 40), ...repeat(150, 40 + 24 * 3)];
    await addRuns(10, 1, series(values));

    assert.equal((await callTool('find_changes', { project: 'org/web', days: 30 })).changes.length, 1);
    assert.equal((await callTool('find_changes', { project: 'org/web', days: 1 })).changes.length, 0);
  });

  it('checks hidden metrics only when asked', async () => {
    await addMetric(11, 1, 'hidden', { visible: 0 });
    await addRuns(11, 1, series([...repeat(100, 40), ...repeat(150, 40)]));

    assert.equal((await callTool('find_changes', { project: 'org/web' })).changes.length, 0);
    assert.equal((await callTool('find_changes', { project: 'org/web', metric: 'hidden' })).changes.length, 1);
  });

  it("respects a metric's noise floor", async () => {
    await db.query('UPDATE metrics SET min_regression_delta = 100 WHERE id = 10');
    await addRuns(10, 1, series([...repeat(100, 40), ...repeat(150, 40)]));

    assert.deepEqual((await callTool('find_changes', { project: 'org/web' })).changes, []);
  });

  it('converts sizes, and links custom repositories to their own host', async () => {
    await db.query("UPDATE repositories SET is_github = 0, url = 'https://git.example/web' WHERE id = 1");
    await addMetric(11, 1, 'bundle', { unit: 'KB' });
    await addRuns(11, 1, series([...repeat(1024, 40), ...repeat(2048, 40)]));

    const [change] = (await callTool('find_changes', { project: 'org/web' })).changes;

    assert.deepEqual([change.before, change.after], [1, 2]);
    assert.equal(change.commitUrl, `https://git.example/web/commit/${hash('c40')}`);
  });

  it('handles the largest project there is within the platform limits', async () => {
    for (let id = 100; id < 140; id++) {
      await addMetric(id, 1, `m${id}`);
    }
    await addRuns(100, 1, series([...repeat(100, 40), ...repeat(150, 40)]));

    const { metricsChecked, changes } = await callTool('find_changes', { project: 'org/web' });

    assert.equal(metricsChecked, 41);
    assert.equal(changes.length, 1);
  });

  it('copes with a project that has no runs', async () => {
    assert.deepEqual(await callTool('find_changes', { project: 'org/web' }), {
      project: 'org/web',
      days: 30,
      metricsChecked: 1,
      analyzedFrom: null,
      changes: [],
      dashboardUrl: 'http://codevitals.test/public/org/web/metrics',
    });
  });
});

describe('compare_commits', () => {
  beforeEach(async () => {
    await addMetric(11, 1, 'bundle', { unit: 'KB' });
    await addRuns(10, 1, series([...repeat(100, 14), 110, 150]));
    await addRuns(11, 1, series([...repeat(1024, 15), 1024]));
  });

  it('compares a commit with the ones before it, largest change first', async () => {
    const { metrics, commit, comparedWith } = await callTool('compare_commits', {
      project: 'org/web',
      commit: hash('c15').slice(0, 10),
    });

    assert.equal(commit, hash('c15').slice(0, 12));
    assert.equal(comparedWith, 'the 15 commits before');
    assert.deepEqual(
      metrics.map(({ key, before, after, changePercent, withinRecentRange }) => [
        key,
        before,
        after,
        changePercent,
        withinRecentRange,
      ]),
      [
        ['lcp', 100, 150, 50, false],
        ['bundle', 1, 1, 0, true],
      ]
    );
  });

  it('compares two commits directly', async () => {
    const { metrics, comparedWith } = await callTool('compare_commits', {
      project: 'org/web',
      commit: hash('c15'),
      base: hash('c14'),
    });

    assert.equal(comparedWith, hash('c14').slice(0, 12));
    assert.deepEqual([metrics[0].before, metrics[0].after], [110, 150]);
  });

  it('copes with a metric the base commit did not report', async () => {
    await addRuns(10, 1, [[hash('partial'), 100, Date.now() - 100 * HOUR]]);

    const { metrics } = await callTool('compare_commits', {
      project: 'org/web',
      commit: hash('c15'),
      base: hash('partial'),
    });

    assert.deepEqual(metrics.find(({ key }) => key === 'bundle').before, null);
  });

  it('asks for more of a hash that matches several commits', async () => {
    await addRuns(10, 1, [
      [hash('shared-a'), 1, Date.now() - HOUR],
      [hash('shared-b'), 2, Date.now() - HOUR],
    ]);

    const { error } = await callTool('compare_commits', { project: 'org/web', commit: 'shared-' });

    assert.match(error, /more than one commit/);
  });

  it('treats a hash as text, not a pattern', async () => {
    assert.match((await callTool('compare_commits', { project: 'org/web', commit: 'c1%xxxxx' })).error, /No runs/);
    assert.match((await callTool('compare_commits', { project: 'org/web', commit: 'c1_xxxxx' })).error, /No runs/);
  });

  it('turns down a hash too short to mean anything', async () => {
    assert.match((await callTool('compare_commits', { project: 'org/web', commit: 'c1' })).error, /commit/);
  });

  it("doesn't count a commit reported twice as its own baseline", async () => {
    await addRuns(10, 1, [[hash('c15'), 150, Date.now() + HOUR]]);

    const { metrics } = await callTool('compare_commits', { project: 'org/web', commit: hash('c15') });

    assert.equal(metrics.find(({ key }) => key === 'lcp').withinRecentRange, false);
  });

  it('reads a commit that was only reported as a base', async () => {
    await addRuns(10, 1, [[hash('base'), 120, Date.now() - HOUR]], hash('base'));

    const { metrics } = await callTool('compare_commits', { project: 'org/web', commit: hash('base') });

    assert.equal(metrics[0].after, 120);
  });
});
