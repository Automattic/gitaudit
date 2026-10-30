import db from './database.js';

// User queries - using functions to avoid early execution
export const userQueries = {
  get findById() {
    return db.prepare('SELECT * FROM users WHERE id = ?');
  },

  get findByGithubId() {
    return db.prepare('SELECT * FROM users WHERE github_id = ?');
  },

  get findByUsername() {
    return db.prepare('SELECT * FROM users WHERE username = ?');
  },

  get create() {
    return db.prepare(`
      INSERT INTO users (github_id, username, access_token, refresh_token, token_expires_at)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
  },

  get updateTokens() {
    return db.prepare(`
      UPDATE users
      SET access_token = ?, refresh_token = ?, token_expires_at = ?
      WHERE id = ?
    `);
  },

  get updateAllTokensByGithubId() {
    return db.prepare(`
      UPDATE users
      SET access_token = ?, refresh_token = ?, token_expires_at = ?
      WHERE github_id = ?
    `);
  },
};

// Repository queries
export const repoQueries = {
  get findByOwnerAndName() {
    return db.prepare(`
      SELECT * FROM repositories
      WHERE owner = ? AND name = ?
    `);
  },

  get findAllByUser() {
    return db.prepare(`
      SELECT r.*, ur.date_added
      FROM repositories r
      JOIN user_repositories ur ON r.id = ur.repo_id
      WHERE ur.user_id = ?
      ORDER BY ur.date_added DESC
    `);
  },

  // Create a local (non-GitHub) repository
  get createLocalRepo() {
    return db.prepare(`
      INSERT INTO repositories
        (owner, name, github_id, description, is_github, url)
      VALUES (?, ?, 0, ?, 0, ?)
      RETURNING *
    `);
  },

  // Update a local (non-GitHub) repository's url and description
  get updateLocalRepo() {
    return db.prepare(`
      UPDATE repositories
      SET url = ?, description = ?
      WHERE id = ? AND is_github = 0
      RETURNING *
    `);
  },

  get saveRepo() {
    return db.prepare(`
      INSERT INTO repositories
        (owner, name, github_id, description, stars, language, language_color, updated_at, is_private)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner, name) DO UPDATE SET
        description = excluded.description,
        stars = excluded.stars,
        language = excluded.language,
        language_color = excluded.language_color,
        updated_at = excluded.updated_at,
        is_private = excluded.is_private
      RETURNING *
    `);
  },

  get deleteByUserAndId() {
    return db.prepare(`
      DELETE FROM user_repositories
      WHERE repo_id = ? AND user_id = ?
    `);
  },

  get deleteById() {
    return db.prepare('DELETE FROM repositories WHERE id = ?');
  },

  get checkIfSaved() {
    return db.prepare(`
      SELECT r.id
      FROM repositories r
      JOIN user_repositories ur ON r.id = ur.repo_id
      WHERE ur.user_id = ? AND r.owner = ? AND r.name = ?
    `);
  },

  get findByMetricsToken() {
    return db.prepare('SELECT * FROM repositories WHERE metrics_token = ?');
  },

  get updateMetricsToken() {
    return db.prepare(`
      UPDATE repositories
      SET metrics_token = ?
      WHERE id = ?
    `);
  },

  get updateMetricsPublic() {
    return db.prepare(`
      UPDATE repositories
      SET metrics_public = ?
      WHERE id = ?
    `);
  },

  get findAllPublicMetricsRepos() {
    return db.prepare(`
      SELECT id, owner, name, description, language, language_color
      FROM repositories
      WHERE metrics_public = 1
      ORDER BY name ASC
    `);
  },

  // Role-based access queries for user_repositories
  get getUserRoleAndSync() {
    return db.prepare('SELECT role, last_synced FROM user_repositories WHERE user_id = ? AND repo_id = ?');
  },

  get updateUserRoleAndSync() {
    return db.prepare('UPDATE user_repositories SET role = ?, last_synced = ? WHERE user_id = ? AND repo_id = ?');
  },

  get addUserRepoWithRole() {
    return db.prepare('INSERT OR IGNORE INTO user_repositories (user_id, repo_id, role, last_synced) VALUES (?, ?, ?, ?)');
  },

  get countAdminsByRepoId() {
    return db.prepare(`
      SELECT COUNT(*) as count FROM user_repositories
      WHERE repo_id = ? AND role = 'admin'
    `);
  },

  get findCollaboratorsByRepoId() {
    return db.prepare(`
      SELECT ur.user_id, ur.role, ur.date_added, ur.last_synced, u.username, u.github_id
      FROM user_repositories ur
      JOIN users u ON ur.user_id = u.id
      WHERE ur.repo_id = ?
      ORDER BY ur.date_added ASC
    `);
  },
};

// Metrics queries (for performance tracking)
export const metricsQueries = {
  get findByRepoId() {
    return db.prepare(`
      SELECT * FROM metrics
      WHERE repo_id = ?
      ORDER BY priority ASC, id ASC
    `);
  },

  get findById() {
    return db.prepare('SELECT * FROM metrics WHERE id = ?');
  },

  get findByRepoIdAndKey() {
    return db.prepare('SELECT * FROM metrics WHERE repo_id = ? AND key = ?');
  },

  get insert() {
    return db.prepare(`
      INSERT INTO metrics (repo_id, key, name, unit, priority, default_visible, min_regression_delta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
  },

  get update() {
    return db.prepare(`
      UPDATE metrics
      SET name = ?, unit = ?, priority = ?, default_visible = ?, min_regression_delta = ?
      WHERE id = ?
      RETURNING *
    `);
  },

  get delete() {
    return db.prepare('DELETE FROM metrics WHERE id = ?');
  },
};

// Performance data queries (for storing metric values from CI/CD)
export const perfQueries = {
  get findByHashAndRepoId() {
    return db.prepare('SELECT * FROM perf WHERE hash = ? AND repo_id = ?');
  },

  get findByMetricIdAndBranch() {
    return db.prepare(`
      SELECT * FROM perf
      WHERE metric_id = ? AND branch = ?
      ORDER BY measured_at DESC
      LIMIT ?
    `);
  },

  get findAllByMetricIdAndBranch() {
    return db.prepare(`
      SELECT * FROM perf
      WHERE metric_id = ? AND branch = ?
      ORDER BY measured_at DESC
    `);
  },

  get insert() {
    return db.prepare(`
      INSERT INTO perf (repo_id, branch, hash, metric_id, value, raw_value, measured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  },

  get averageByMetricAndBranch() {
    return db.prepare(`
      SELECT AVG(value) as average
      FROM (
        SELECT value FROM perf
        WHERE branch = ? AND metric_id = ?
        ORDER BY measured_at DESC
        LIMIT ?
      )
    `);
  },

  get averageByMetricAndBranchWithOffset() {
    return db.prepare(`
      SELECT AVG(value) as average
      FROM (
        SELECT value FROM perf
        WHERE branch = ? AND metric_id = ?
        ORDER BY measured_at DESC
        LIMIT ? OFFSET ?
      )
    `);
  },
};

// Helper function to run multiple operations in a transaction
export function transaction(fn) {
  return db.transaction(fn);
}
