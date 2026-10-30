import { z } from 'zod';
import { recentAverages, RECENT_VALUES } from '../../../server/src/utils/averages.js';
import {
  findLatestPerfByMetric,
  findMetrics,
  findPerfBetween,
  findPerfByHashPrefix,
  findPublicRepoLastRuns,
  findPublicRepos,
} from '../queries.js';
import { detectSteps, median } from '../steps.js';

const DAY = 24 * 60 * 60 * 1000;

// Only trunk is reported on: other branches are mostly one-off runs for a pull request
const BRANCH = 'trunk';

// Timestamps before this are seconds that were stored as milliseconds, so they land in
// 1970. The values are real but their dates aren't, so they can't answer "since when".
const FIRST_VALID_TIMESTAMP = Date.UTC(2000, 0, 1);

const HISTORY_DAYS = 90;
const DEFAULT_HISTORY_POINTS = 100;
const MAX_HISTORY_POINTS = 300;
const CHANGES_DAYS = 30;
const MAX_CHANGES_DAYS = 90;

// The busiest projects land about 35 commits a day, so this is 30 days of them. It keeps
// a request to about 20,000 rows, on the largest project.
const MAX_RUNS_PER_METRIC = 1200;

// The largest metric has about 23,000 runs
const MAX_HISTORY_RUNS = 25_000;

// Enough for 50 runs each of the 40 metrics of the largest project
const MAX_RUNS_PER_COMMIT = 2000;

const BASELINE_COMMITS = 15;

// Runs to read for the baseline, as some projects run each commit more than once
const BASELINE_RUNS = BASELINE_COMMITS * 5;

const MIN_COMMIT_PREFIX = 7;
const SHORT_HASH = 12;

// Names and descriptions come from whoever runs a project, and go into a model's context
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 300;

const BYTE_DIVISORS = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

/** A problem the model can act on, as opposed to one on our side. */
class ToolError extends Error {}

const text = (value, limit) => (value ? String(value).slice(0, limit) : null);

/**
 * A value as the dashboard shows it. Sizes are stored in bytes whatever the unit says.
 * Four significant digits is more than these measurements can tell apart.
 */
function display(value, unit) {
  if (value === null || value === undefined) return null;
  const divisor = BYTE_DIVISORS[unit?.toLowerCase()] ?? 1;
  return Number((Number(value) / divisor).toPrecision(4));
}

const percent = (value) => Number(value.toFixed(1));

/** A timestamp for a model to read, or null for one that's known to be wrong. */
const date = (timestamp) =>
  Number(timestamp) >= FIRST_VALID_TIMESTAMP ? new Date(Number(timestamp)).toISOString() : null;

function parseDate(value, name) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new ToolError(`${name} must be a date like 2026-10-01, not "${value}".`);
  }
  return timestamp;
}

/** The end of a period. A day on its own includes that whole day. */
function parseEndDate(value, name) {
  const timestamp = parseDate(value, name);
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? timestamp + DAY - 1 : timestamp;
}

const dashboardUrl = (origin, repo) => `${origin}/public/${repo.owner}/${repo.name}/metrics`;

function commitUrl(repo, hash) {
  const base = repo.url || (Number(repo.is_github) ? `https://github.com/${repo.owner}/${repo.name}` : null);
  return base ? `${base}/commit/${hash}` : null;
}

function formatMetric(metric) {
  return {
    key: metric.key,
    name: text(metric.name, MAX_NAME_LENGTH),
    unit: text(metric.unit, MAX_NAME_LENGTH),
  };
}

/**
 * Find a project among the public ones, which is what keeps every tool to public data.
 * Anything else gets the same answer as a project that doesn't exist.
 */
async function findProject(db, name) {
  const wanted = name.trim().toLowerCase();
  const repos = await findPublicRepos(db);
  const exact = repos.filter((repo) => `${repo.owner}/${repo.name}`.toLowerCase() === wanted);
  const matches = exact.length ? exact : repos.filter((repo) => repo.name.toLowerCase() === wanted);

  if (matches.length > 1) {
    const names = matches.map((repo) => `${repo.owner}/${repo.name}`).join(' or ');
    throw new ToolError(`"${name}" could be ${names}. Use owner/name.`);
  }
  if (matches.length === 0) {
    throw new ToolError(`There's no public project called "${name}". Call list_projects to see them.`);
  }
  return matches[0];
}

async function findProjectMetric(db, repo, key) {
  const wanted = key.trim().toLowerCase();
  const metrics = await findMetrics(db, repo.id);
  const metric =
    metrics.find((candidate) => candidate.key === key) ??
    metrics.find((candidate) => candidate.key.toLowerCase() === wanted) ??
    metrics.find((candidate) => candidate.name.toLowerCase() === wanted);

  if (!metric) {
    throw new ToolError(`${repo.owner}/${repo.name} has no metric "${key}". Call list_metrics to see them.`);
  }
  return metric;
}

/** One value per commit, oldest first: the median of its runs, as some projects run more than once. */
function groupByCommit(runs) {
  const commits = new Map();

  for (const run of runs) {
    if (!commits.has(run.hash)) {
      commits.set(run.hash, { hash: run.hash, measuredAt: Number(run.measured_at), values: [] });
    }
    commits.get(run.hash).values.push(Number(run.value));
  }

  return [...commits.values()]
    .map(({ hash, measuredAt, values }) => ({ hash, measuredAt, value: median(values) }))
    .reverse();
}

function summarizeCommits(commits, unit) {
  return {
    from: date(commits[0].measuredAt),
    to: date(commits.at(-1).measuredAt),
    commits: commits.length,
    value: display(median(commits.map((commit) => commit.value)), unit),
    min: display(Math.min(...commits.map((commit) => commit.value)), unit),
    max: display(Math.max(...commits.map((commit) => commit.value)), unit),
  };
}

/** Commits as they are if they fit, or else equal-sized groups of them. */
function downsample(commits, maxPoints, unit) {
  if (commits.length <= maxPoints) {
    return commits.map(({ hash, measuredAt, value }) => ({
      measuredAt: date(measuredAt),
      commit: hash.slice(0, SHORT_HASH),
      value: display(value, unit),
    }));
  }

  const boundary = (index) => Math.floor((index * commits.length) / maxPoints);
  return Array.from({ length: maxPoints }, (_, index) =>
    summarizeCommits(commits.slice(boundary(index), boundary(index + 1)), unit)
  );
}

function resolveCommit(runs, prefix) {
  const hashes = [...new Set(runs.map((run) => run.hash))];

  if (hashes.length === 0) {
    throw new ToolError(`No runs were reported for commit "${prefix}".`);
  }
  if (hashes.length > 1) {
    throw new ToolError(`"${prefix}" matches more than one commit. Use more of the hash.`);
  }

  // A commit that was only reported as another's base has rows with its hash as the branch
  const reported = runs.filter((run) => run.branch !== run.hash);
  return { hash: hashes[0], runs: reported.length ? reported : runs };
}

function valuesByMetric(runs) {
  const values = new Map();
  for (const run of runs) {
    const id = Number(run.metric_id);
    if (!values.has(id)) values.set(id, []);
    values.get(id).push(Number(run.value));
  }
  return values;
}

/** Turn a failure into a message for the model, without any internals in it. */
const respondingToErrors = (handler) => async (args) => {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await handler(args)) }] };
  } catch (error) {
    if (!(error instanceof ToolError)) {
      console.error('[MCP] Tool failed:', error);
    }
    const message = error instanceof ToolError ? error.message : "CodeVitals couldn't read that data. Try again.";
    return { content: [{ type: 'text', text: message }], isError: true };
  }
};

const project = z.string().min(1).max(400).describe('The project, as owner/name. For example WordPress/gutenberg.');
const metricKey = z.string().min(1).max(400).describe('The metric key from list_metrics.');
const commit = z.string().min(MIN_COMMIT_PREFIX).max(191);

export function registerTools(server, { db, origin }) {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'List the open source projects with public metrics on CodeVitals, and when each last reported. Start here.',
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    respondingToErrors(async () => {
      const [repos, lastRuns] = await Promise.all([findPublicRepos(db), findPublicRepoLastRuns(db, BRANCH)]);
      const lastMeasuredAt = new Map(lastRuns.map((run) => [run.repo_id, run.measured_at]));

      return {
        projects: repos.map((repo) => ({
          project: `${repo.owner}/${repo.name}`,
          description: text(repo.description, MAX_DESCRIPTION_LENGTH),
          language: repo.language,
          lastMeasuredAt: date(lastMeasuredAt.get(repo.id)),
          dashboardUrl: dashboardUrl(origin, repo),
        })),
      };
    })
  );

  server.registerTool(
    'list_metrics',
    {
      title: 'List metrics',
      description:
        "List everything a project measures, with each metric's recent level and how it moved. " +
        'recentAverage covers the latest 20 runs on trunk and previousAverage the 20 before those, as on the dashboard.',
      inputSchema: z.object({ project }),
      annotations: READ_ONLY,
    },
    respondingToErrors(async (args) => {
      const repo = await findProject(db, args.project);
      const metrics = await findMetrics(db, repo.id);
      const latest = await findLatestPerfByMetric(db, metrics.map(({ id }) => id), BRANCH, RECENT_VALUES);

      return {
        project: `${repo.owner}/${repo.name}`,
        dashboardUrl: dashboardUrl(origin, repo),
        metrics: metrics.map((metric) => {
          const runs = latest.get(metric.id);
          const { average, previous } = recentAverages(runs.map((run) => Number(run.value)));
          const lastMeasuredAt = date(runs[0]?.measured_at);

          return {
            ...formatMetric(metric),
            shownByDefault: Boolean(Number(metric.default_visible)),
            recentAverage: display(average, metric.unit),
            previousAverage: display(previous, metric.unit),
            changePercent: average && previous ? percent(((average - previous) / previous) * 100) : null,
            lastMeasuredAt,
            daysSinceLastMeasured: lastMeasuredAt
              ? Math.floor((Date.now() - Date.parse(lastMeasuredAt)) / DAY)
              : null,
          };
        }),
      };
    })
  );

  server.registerTool(
    'get_metric_history',
    {
      title: 'Get metric history',
      description:
        "Read a metric's values on trunk over a period, one value per commit. A long period comes back as groups " +
        'of commits, each with its median, min and max.',
      inputSchema: z.object({
        project,
        metric: metricKey,
        since: z.string().optional().describe(`Start date, like 2026-01-01. Defaults to ${HISTORY_DAYS} days ago.`),
        until: z.string().optional().describe('End date. Defaults to now.'),
        maxPoints: z
          .number()
          .int()
          .min(2)
          .max(MAX_HISTORY_POINTS)
          .optional()
          .describe(`How many points to return at most. Defaults to ${DEFAULT_HISTORY_POINTS}.`),
      }),
      annotations: READ_ONLY,
    },
    respondingToErrors(async (args) => {
      const until = args.until ? parseEndDate(args.until, 'until') : Date.now();
      const since = Math.max(
        args.since ? parseDate(args.since, 'since') : until - HISTORY_DAYS * DAY,
        FIRST_VALID_TIMESTAMP
      );

      const repo = await findProject(db, args.project);
      const metric = await findProjectMetric(db, repo, args.metric);
      const runs = await findPerfBetween(db, metric.id, BRANCH, since, until, MAX_HISTORY_RUNS);
      const commits = groupByCommit(runs);

      return {
        project: `${repo.owner}/${repo.name}`,
        metric: formatMetric(metric),
        since: date(since),
        until: date(until),
        commits: commits.length,
        reachedLimit: runs.length === MAX_HISTORY_RUNS,
        points: downsample(commits, args.maxPoints ?? DEFAULT_HISTORY_POINTS, metric.unit),
        dashboardUrl: dashboardUrl(origin, repo),
      };
    })
  );

  server.registerTool(
    'find_changes',
    {
      title: 'Find changes',
      description:
        "Find lasting changes in a project's metrics, and the commit each started at. Use this to answer what got " +
        'slower or faster: it compares the commits around each point, so one noisy run is never reported, unlike ' +
        'the flags on the dashboard charts. A commit can be a few commits away from the true cause, so read ' +
        'changes that hit several metrics at once as the strongest evidence. A change needs 8 commits after it ' +
        'to show up here.',
      inputSchema: z.object({
        project,
        metric: metricKey.optional().describe('Check only this metric. Defaults to those shown on the dashboard.'),
        days: z
          .number()
          .int()
          .min(1)
          .max(MAX_CHANGES_DAYS)
          .optional()
          .describe(`How far back to report changes. Defaults to ${CHANGES_DAYS}.`),
      }),
      annotations: READ_ONLY,
    },
    respondingToErrors(async (args) => {
      const days = args.days ?? CHANGES_DAYS;
      const since = Date.now() - days * DAY;

      const repo = await findProject(db, args.project);
      const metrics = args.metric
        ? [await findProjectMetric(db, repo, args.metric)]
        : (await findMetrics(db, repo.id)).filter((metric) => Number(metric.default_visible));

      // Commits from before the period show what a change at the start of it was a change from
      const latest = await findLatestPerfByMetric(db, metrics.map(({ id }) => id), BRANCH, MAX_RUNS_PER_METRIC, {
        since: Math.max(since - MAX_CHANGES_DAYS * DAY, FIRST_VALID_TIMESTAMP),
      });

      const changes = metrics.flatMap((metric) =>
        detectSteps(groupByCommit(latest.get(metric.id)), Number(metric.min_regression_delta) || 0)
          .filter((step) => step.measuredAt >= since || step.revertedAt >= since)
          .map((step) => ({
            kind: step.kind,
            metric: formatMetric(metric),
            before: display(step.before, metric.unit),
            after: display(step.after, metric.unit),
            changePercent: percent(step.changePercent),
            measuredAt: date(step.measuredAt),
            commit: step.commit.slice(0, SHORT_HASH),
            commitUrl: commitUrl(repo, step.commit),
            commitsSince: step.commitsAfter,
            revertedAt: step.revertedAt ? date(step.revertedAt) : null,
          }))
      );

      // The latest of each metric's earliest run, as that's how far back all of them reach
      const analyzedFrom = Math.max(
        ...[...latest.values()].flatMap((runs) => (runs.length ? [Number(runs.at(-1).measured_at)] : []))
      );

      return {
        project: `${repo.owner}/${repo.name}`,
        days,
        metricsChecked: metrics.length,
        // A busy project's history may not reach back as far as was asked
        analyzedFrom: date(analyzedFrom),
        changes: changes.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
        dashboardUrl: dashboardUrl(origin, repo),
      };
    })
  );

  server.registerTool(
    'compare_commits',
    {
      title: 'Compare commits',
      description:
        "Compare every metric at a commit with the commits before it, or with another commit. Results are " +
        'sorted by size of change. withinRecentRange is true when the value is no higher or lower than the ' +
        '15 commits before it reached, so the difference is likely noise.',
      inputSchema: z.object({
        project,
        commit: commit.describe('The commit to look at. At least the first 7 characters of its hash.'),
        base: commit.optional().describe('A commit to compare with. Defaults to the median of the 15 commits before.'),
      }),
      annotations: READ_ONLY,
    },
    respondingToErrors(async (args) => {
      const repo = await findProject(db, args.project);
      const head = resolveCommit(await findPerfByHashPrefix(db, args.commit, repo.id, MAX_RUNS_PER_COMMIT), args.commit);
      const base = args.base
        ? resolveCommit(await findPerfByHashPrefix(db, args.base, repo.id, MAX_RUNS_PER_COMMIT), args.base)
        : null;

      const metrics = await findMetrics(db, repo.id);
      const headValues = valuesByMetric(head.runs);
      const baseValues = base && valuesByMetric(base.runs);
      const measured = metrics.filter((metric) => headValues.has(metric.id));

      const earlier = await findLatestPerfByMetric(db, measured.map(({ id }) => id), BRANCH, BASELINE_RUNS, {
        since: FIRST_VALID_TIMESTAMP,
        // A commit can be reported more than once, and shouldn't count as its own baseline
        before: Math.min(...head.runs.map((run) => Number(run.measured_at))),
      });

      const comparison = measured.map((metric) => {
        const recent = groupByCommit(earlier.get(metric.id))
          .slice(-BASELINE_COMMITS)
          .map((run) => run.value);
        const after = median(headValues.get(metric.id));
        const compared = baseValues ? baseValues.get(metric.id) : recent;
        const before = compared?.length ? median(compared) : null;

        return {
          ...formatMetric(metric),
          before: display(before, metric.unit),
          after: display(after, metric.unit),
          changePercent: before ? percent(((after - before) / before) * 100) : null,
          withinRecentRange: recent.length
            ? after >= Math.min(...recent) && after <= Math.max(...recent)
            : null,
        };
      });

      return {
        project: `${repo.owner}/${repo.name}`,
        commit: head.hash.slice(0, SHORT_HASH),
        commitUrl: commitUrl(repo, head.hash),
        measuredAt: date(head.runs[0].measured_at),
        comparedWith: base ? base.hash.slice(0, SHORT_HASH) : `the ${BASELINE_COMMITS} commits before`,
        metrics: comparison.sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)),
        dashboardUrl: dashboardUrl(origin, repo),
      };
    })
  );
}
