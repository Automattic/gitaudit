import db from './database.js';

// User queries - using functions to avoid early execution
export const userQueries = {
  get findByGithubId() {
    return db.prepare('SELECT * FROM users WHERE github_id = ?');
  },

  get create() {
    return db.prepare(`
      INSERT INTO users (github_id, username, access_token)
      VALUES (?, ?, ?)
      RETURNING *
    `);
  },

  get updateAccessToken() {
    return db.prepare(`
      UPDATE users
      SET access_token = ?
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

  get create() {
    return db.prepare(`
      INSERT INTO repositories (owner, name, github_id)
      VALUES (?, ?, ?)
      RETURNING *
    `);
  },

  get updateFetchStatus() {
    return db.prepare(`
      UPDATE repositories
      SET last_fetched = CURRENT_TIMESTAMP, fetch_status = ?
      WHERE id = ?
    `);
  },

  get updateFetchStatusWithTime() {
    return db.prepare(`
      UPDATE repositories
      SET last_fetched = ?, fetch_status = ?
      WHERE id = ?
    `);
  },

  get getById() {
    return db.prepare('SELECT * FROM repositories WHERE id = ?');
  },

  // New queries for saved repos
  get findAllByUser() {
    return db.prepare(`
      SELECT r.*, ur.date_added
      FROM repositories r
      JOIN user_repositories ur ON r.id = ur.repo_id
      WHERE ur.user_id = ?
      ORDER BY ur.date_added DESC
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

  get addUserRepo() {
    return db.prepare(`
      INSERT OR IGNORE INTO user_repositories (user_id, repo_id)
      VALUES (?, ?)
    `);
  },

  get deleteByUserAndId() {
    return db.prepare(`
      DELETE FROM user_repositories
      WHERE repo_id = ? AND user_id = ?
    `);
  },

  get checkIfSaved() {
    return db.prepare(`
      SELECT r.id
      FROM repositories r
      JOIN user_repositories ur ON r.id = ur.repo_id
      WHERE ur.user_id = ? AND r.owner = ? AND r.name = ?
    `);
  },

  get clearFullRefetchFlag() {
    return db.prepare(`
      UPDATE repositories
      SET needs_full_refetch = 0
      WHERE id = ?
    `);
  },

  get updateMaintainerLogins() {
    return db.prepare(`
      UPDATE repositories
      SET maintainer_logins = ?, maintainer_logins_updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
  },
};

// Issue queries
export const issueQueries = {
  get upsert() {
    return db.prepare(`
      INSERT INTO issues (
        repo_id, github_id, number, title, body, state, labels,
        created_at, updated_at, closed_at, comments_count,
        last_comment_at, last_comment_author, reactions, assignees, milestone, issue_type,
        author_login, author_association
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(github_id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        state = excluded.state,
        labels = excluded.labels,
        updated_at = excluded.updated_at,
        closed_at = excluded.closed_at,
        comments_count = excluded.comments_count,
        last_comment_at = excluded.last_comment_at,
        last_comment_author = excluded.last_comment_author,
        reactions = excluded.reactions,
        assignees = excluded.assignees,
        milestone = excluded.milestone,
        issue_type = excluded.issue_type,
        author_login = excluded.author_login,
        author_association = excluded.author_association
      RETURNING *
    `);
  },

  get findByRepo() {
    return db.prepare(`
      SELECT * FROM issues
      WHERE repo_id = ?
      ORDER BY updated_at DESC
    `);
  },

  get findOpenByRepo() {
    return db.prepare(`
      SELECT * FROM issues
      WHERE repo_id = ? AND state = 'open'
      ORDER BY updated_at DESC
    `);
  },

  get countByRepo() {
    return db.prepare(`
      SELECT COUNT(*) as count FROM issues WHERE repo_id = ?
    `);
  },

  get findByGithubId() {
    return db.prepare('SELECT * FROM issues WHERE github_id = ?');
  },

  get getMostRecentUpdatedAt() {
    return db.prepare(`
      SELECT MAX(updated_at) as most_recent_updated_at
      FROM issues
      WHERE repo_id = ?
    `);
  },

  get updateCommentsFetched() {
    return db.prepare(`
      UPDATE issues
      SET comments_fetched = 1
      WHERE id = ?
    `);
  },
};

// Analysis queries
export const analysisQueries = {
  get upsert() {
    return db.prepare(`
      INSERT INTO issue_analysis (issue_id, analysis_type, score, metadata)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(issue_id, analysis_type)
      DO UPDATE SET
        score = excluded.score,
        metadata = excluded.metadata,
        analyzed_at = CURRENT_TIMESTAMP
    `);
  },

  get findByIssueAndType() {
    return db.prepare(`
      SELECT * FROM issue_analysis
      WHERE issue_id = ? AND analysis_type = ?
    `);
  },

  get findByRepoAndType() {
    return db.prepare(`
      SELECT ia.*, i.*
      FROM issue_analysis ia
      JOIN issues i ON ia.issue_id = i.id
      WHERE i.repo_id = ? AND ia.analysis_type = ?
      ORDER BY ia.score DESC
    `);
  },

  get deleteByRepo() {
    return db.prepare(`
      DELETE FROM issue_analysis
      WHERE issue_id IN (SELECT id FROM issues WHERE repo_id = ?)
    `);
  },

  get findStaleAnalyses() {
    return db.prepare(`
      SELECT i.*, ia.analyzed_at
      FROM issues i
      LEFT JOIN issue_analysis ia ON i.id = ia.issue_id AND ia.analysis_type = ?
      WHERE i.repo_id = ?
        AND (ia.analyzed_at IS NULL OR i.updated_at > ia.analyzed_at)
    `);
  },

  get countByRepoAndType() {
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM issue_analysis ia
      JOIN issues i ON ia.issue_id = i.id
      WHERE i.repo_id = ? AND ia.analysis_type = ?
    `);
  },

  get deleteByIssue() {
    return db.prepare(`
      DELETE FROM issue_analysis
      WHERE issue_id = ?
    `);
  },
};

// Settings queries
export const settingsQueries = {
  get findByRepoId() {
    return db.prepare('SELECT * FROM repo_settings WHERE repo_id = ?');
  },

  get upsert() {
    return db.prepare(`
      INSERT INTO repo_settings (repo_id, settings, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(repo_id) DO UPDATE SET
        settings = excluded.settings,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);
  },

  get deleteByRepoId() {
    return db.prepare('DELETE FROM repo_settings WHERE repo_id = ?');
  },
};

// Comment queries (for community health analyzer)
export const commentQueries = {
  get insertOrUpdate() {
    return db.prepare(`
      INSERT INTO issue_comments (issue_id, github_comment_id, author, body, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(github_comment_id) DO UPDATE SET
        author = excluded.author,
        body = excluded.body,
        created_at = excluded.created_at
    `);
  },

  get findByIssueId() {
    return db.prepare(`
      SELECT * FROM issue_comments
      WHERE issue_id = ?
      ORDER BY created_at ASC
    `);
  },

  get deleteByIssueId() {
    return db.prepare(`
      DELETE FROM issue_comments
      WHERE issue_id = ?
    `);
  },

  get countByIssueId() {
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM issue_comments
      WHERE issue_id = ?
    `);
  },
};

// Helper function to run multiple operations in a transaction
export function transaction(fn) {
  return db.transaction(fn);
}
