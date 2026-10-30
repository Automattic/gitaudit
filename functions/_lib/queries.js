// env.DB follows D1's API, but runs on MariaDB and limits each statement to 256 bound
// parameters and each database operation to 64 KB. Every query costs a network call
// too, so reads that are always needed together are joined into one.

const rowsOf = (result) => (Array.isArray(result) ? result : result?.results ?? []);

const statement = (db, sql, params) =>
  params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);

const all = async (db, sql, ...params) => rowsOf(await statement(db, sql, params).all());
const first = async (db, sql, ...params) => (await statement(db, sql, params).first()) ?? null;
const run = (db, sql, ...params) => statement(db, sql, params).run();

// Users

export const findUserByGithubId = (db, githubId) =>
  first(db, 'SELECT * FROM users WHERE github_id = ?', githubId);

export const findUserByUsername = (db, username) =>
  first(db, 'SELECT * FROM users WHERE username = ?', username);

/** Create the user on first sign-in, or store their new tokens on later ones. */
export async function saveUser(db, { githubId, username, accessToken, refreshToken, tokenExpiresAt }) {
  await run(
    db,
    `INSERT INTO users (github_id, username, access_token, refresh_token, token_expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       access_token = VALUES(access_token),
       refresh_token = VALUES(refresh_token),
       token_expires_at = VALUES(token_expires_at)`,
    githubId,
    username,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    Date.now()
  );
  return findUserByGithubId(db, githubId);
}

export const updateUserTokens = (db, userId, accessToken, refreshToken, tokenExpiresAt) =>
  run(
    db,
    'UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?',
    accessToken,
    refreshToken,
    tokenExpiresAt,
    userId
  );

// Repositories

export const findRepo = (db, owner, name) =>
  first(db, 'SELECT * FROM repositories WHERE owner = ? AND name = ?', owner, name);

/** A repository with the user's role and last_synced on it, both null if they aren't a member. */
export const findRepoForUser = (db, owner, name, userId) =>
  first(
    db,
    `SELECT r.*, ur.role, ur.last_synced
     FROM repositories r
     LEFT JOIN user_repositories ur ON ur.repo_id = r.id AND ur.user_id = ?
     WHERE r.owner = ? AND r.name = ?`,
    userId,
    owner,
    name
  );

export const findReposForUser = (db, userId) =>
  all(
    db,
    `SELECT r.*
     FROM repositories r
     JOIN user_repositories ur ON ur.repo_id = r.id
     WHERE ur.user_id = ?
     ORDER BY ur.date_added DESC`,
    userId
  );

const LINK_USER_TO_REPO = `
  INSERT IGNORE INTO user_repositories (user_id, repo_id, date_added, role, last_synced)
  SELECT ?, id, ?, ?, ? FROM repositories WHERE owner = ? AND name = ?`;

/** Save a GitHub repository and add it to the user's list, in one transaction. */
export async function saveGithubRepo(db, repo, userId, role, lastSynced) {
  await db.batch([
    statement(
      db,
      `INSERT INTO repositories
         (owner, name, github_id, description, stars, language, language_color, updated_at, is_private)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         description = VALUES(description),
         stars = VALUES(stars),
         language = VALUES(language),
         language_color = VALUES(language_color),
         updated_at = VALUES(updated_at),
         is_private = VALUES(is_private)`,
      [
        repo.owner,
        repo.name,
        repo.githubId,
        repo.description,
        repo.stars,
        repo.language,
        repo.languageColor,
        repo.updatedAt,
        repo.isPrivate,
      ]
    ),
    statement(db, LINK_USER_TO_REPO, [userId, Date.now(), role, lastSynced, repo.owner, repo.name]),
  ]);
  return findRepo(db, repo.owner, repo.name);
}

/** Create a repository that isn't on GitHub, with its creator as admin, in one transaction. */
export async function createLocalRepo(db, { owner, name, description, url }, userId) {
  await db.batch([
    statement(
      db,
      `INSERT INTO repositories (owner, name, github_id, description, is_github, url)
       VALUES (?, ?, 0, ?, 0, ?)`,
      [owner, name, description, url]
    ),
    statement(db, LINK_USER_TO_REPO, [userId, Date.now(), 'admin', null, owner, name]),
  ]);
  return findRepo(db, owner, name);
}

export const updateLocalRepo = (db, repoId, url, description) =>
  run(db, 'UPDATE repositories SET url = ?, description = ? WHERE id = ? AND is_github = 0', url, description, repoId);

export const deleteRepo = (db, repoId) => run(db, 'DELETE FROM repositories WHERE id = ?', repoId);

export const findRepoByMetricsToken = (db, token) =>
  first(db, 'SELECT * FROM repositories WHERE metrics_token = ?', token);

export const updateMetricsToken = (db, repoId, token) =>
  run(db, 'UPDATE repositories SET metrics_token = ? WHERE id = ?', token, repoId);

export const updateMetricsPublic = (db, repoId, isPublic) =>
  run(db, 'UPDATE repositories SET metrics_public = ? WHERE id = ?', isPublic ? 1 : 0, repoId);

// Collaborators

export const findCollaborators = (db, repoId) =>
  all(
    db,
    `SELECT ur.user_id, ur.role, ur.date_added, u.username, u.github_id
     FROM user_repositories ur
     JOIN users u ON u.id = ur.user_id
     WHERE ur.repo_id = ?
     ORDER BY ur.date_added ASC`,
    repoId
  );

export const findMembership = (db, userId, repoId) =>
  first(db, 'SELECT role, last_synced FROM user_repositories WHERE user_id = ? AND repo_id = ?', userId, repoId);

export const addCollaborator = (db, userId, repoId, role) =>
  run(
    db,
    'INSERT INTO user_repositories (user_id, repo_id, date_added, role) VALUES (?, ?, ?, ?)',
    userId,
    repoId,
    Date.now(),
    role
  );

export const updateMembership = (db, userId, repoId, role, lastSynced) =>
  run(
    db,
    'UPDATE user_repositories SET role = ?, last_synced = ? WHERE user_id = ? AND repo_id = ?',
    role,
    lastSynced,
    userId,
    repoId
  );

export const deleteMembership = (db, userId, repoId) =>
  run(db, 'DELETE FROM user_repositories WHERE user_id = ? AND repo_id = ?', userId, repoId);

export async function countAdmins(db, repoId) {
  const row = await first(
    db,
    "SELECT COUNT(*) AS count FROM user_repositories WHERE repo_id = ? AND role = 'admin'",
    repoId
  );
  return Number(row.count);
}

// Metrics

export const findMetrics = (db, repoId) =>
  all(db, 'SELECT * FROM metrics WHERE repo_id = ? ORDER BY priority ASC, id ASC', repoId);

export const findMetric = (db, id) => first(db, 'SELECT * FROM metrics WHERE id = ?', id);

export const findMetricByKey = (db, repoId, key) =>
  first(db, 'SELECT * FROM metrics WHERE repo_id = ? AND `key` = ?', repoId, key);

export async function createMetric(db, repoId, metric) {
  await run(
    db,
    `INSERT INTO metrics (repo_id, \`key\`, name, unit, priority, default_visible, min_regression_delta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    repoId,
    metric.key,
    metric.name,
    metric.unit,
    metric.priority,
    metric.defaultVisible ? 1 : 0,
    metric.minRegressionDelta,
    Date.now()
  );
  return findMetricByKey(db, repoId, metric.key);
}

export async function updateMetric(db, id, metric) {
  await run(
    db,
    `UPDATE metrics
     SET name = ?, unit = ?, priority = ?, default_visible = ?, min_regression_delta = ?
     WHERE id = ?`,
    metric.name,
    metric.unit,
    metric.priority,
    metric.defaultVisible ? 1 : 0,
    metric.minRegressionDelta,
    id
  );
  return findMetric(db, id);
}

export const deleteMetric = (db, id) => run(db, 'DELETE FROM metrics WHERE id = ?', id);

/** Visible metrics of every public repository, for the homepage. */
export const findPublicRepoMetrics = (db) =>
  all(
    db,
    `SELECT m.* FROM metrics m
     JOIN repositories r ON r.id = m.repo_id
     WHERE r.metrics_public = 1 AND m.default_visible = 1
     ORDER BY m.priority ASC, m.id ASC`
  );

export const findPublicRepos = (db) =>
  all(
    db,
    `SELECT id, owner, name, description, language, language_color
     FROM repositories
     WHERE metrics_public = 1
     ORDER BY name ASC`
  );

// Performance data

export const findPerfByHash = (db, hash, repoId) =>
  all(db, 'SELECT metric_id, value FROM perf WHERE hash = ? AND repo_id = ?', hash, repoId);

const PERF_COLUMNS = 'id, repo_id, branch, hash, metric_id, value, raw_value, measured_at';

// Runs of the same commit share a timestamp, so id keeps their order from being arbitrary
export const findPerf = (db, metricId, branch, limit) =>
  limit
    ? all(
        db,
        `SELECT ${PERF_COLUMNS} FROM perf
         WHERE metric_id = ? AND branch = ?
         ORDER BY measured_at DESC, id DESC
         LIMIT ?`,
        metricId,
        branch,
        limit
      )
    : all(
        db,
        `SELECT ${PERF_COLUMNS} FROM perf
         WHERE metric_id = ? AND branch = ?
         ORDER BY measured_at DESC, id DESC`,
        metricId,
        branch
      );

/**
 * Store a CI run's rows in one statement, so a post can't land half-way. They go in as
 * one JSON parameter, because bound parameters would run out at 36 rows.
 *
 * @param {Array} rows - [repoId, branch, hash, metricId, value, rawValue, measuredAt]
 */
export const insertPerf = (db, rows) =>
  run(
    db,
    `INSERT INTO perf (repo_id, branch, hash, metric_id, value, raw_value, measured_at)
     SELECT repo_id, branch, hash, metric_id, value, raw_value, measured_at
     FROM JSON_TABLE(?, '$[*]' COLUMNS (
       repo_id INT PATH '$[0]',
       branch VARCHAR(191) PATH '$[1]',
       hash VARCHAR(191) PATH '$[2]',
       metric_id INT PATH '$[3]',
       value DOUBLE PATH '$[4]',
       raw_value DOUBLE PATH '$[5]',
       measured_at BIGINT PATH '$[6]'
     )) AS incoming`,
    JSON.stringify(rows)
  );

/**
 * Read the latest values of several metrics in one query, rather than a query per
 * metric, which adds up to hundreds of network calls on the homepage. Every metric
 * gets its own index lookup, so this stays fast however large perf is.
 *
 * @returns {Promise<Map<number, number[]>>} Each metric's values, newest first
 */
export async function findLatestValuesByMetric(db, metricIds, branch, limit) {
  const latest = new Map(metricIds.map((id) => [id, []]));
  if (metricIds.length === 0) return latest;

  const sql = metricIds
    .map(
      (id) => `
      SELECT id, metric_id, value, measured_at FROM (
        SELECT id, metric_id, value, measured_at FROM perf
        WHERE metric_id = ${Number(id)} AND branch = ?
        ORDER BY measured_at DESC, id DESC
        LIMIT ${Number(limit)}
      ) AS latest_${Number(id)}`
    )
    .join(' UNION ALL ');

  const rows = await all(db, sql, ...metricIds.map(() => branch));

  // UNION ALL doesn't promise to keep each subquery's order
  rows.sort((a, b) => Number(b.measured_at) - Number(a.measured_at) || Number(b.id) - Number(a.id));
  for (const row of rows) {
    latest.get(Number(row.metric_id)).push(Number(row.value));
  }

  return latest;
}
