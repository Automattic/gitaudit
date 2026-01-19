import db from './database.js';

// User queries - using functions to avoid early execution
export const userQueries = {
  get findById() {
    return db.prepare('SELECT * FROM users WHERE id = ?');
  },

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

  get updateStatus() {
    return db.prepare(`
      UPDATE repositories
      SET status = ?
      WHERE id = ?
    `);
  },

  get updateStatusWithTime() {
    return db.prepare(`
      UPDATE repositories
      SET last_fetched = ?, status = ?
      WHERE id = ?
    `);
  },

  get updateLastFetched() {
    return db.prepare(`
      UPDATE repositories
      SET last_fetched = ?
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

// Job queue queries
export const jobQueries = {
  get insert() {
    return db.prepare(`
      INSERT INTO job_queue (job_id, type, repo_id, user_id, args, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
  },

  get findPendingJobs() {
    return db.prepare(`
      SELECT * FROM job_queue
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC
    `);
  },

  get findProcessingJobs() {
    return db.prepare(`
      SELECT * FROM job_queue
      WHERE status = 'processing'
      ORDER BY started_at ASC
    `);
  },

  // Find next pending job that's not for a repo currently being processed
  findNextPendingJob(excludeRepoIds = []) {
    if (excludeRepoIds.length === 0) {
      return db.prepare(`
        SELECT * FROM job_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `).get();
    }

    const placeholders = excludeRepoIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT * FROM job_queue
      WHERE status = 'pending'
        AND repo_id NOT IN (${placeholders})
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `).get(...excludeRepoIds);
  },

  get findByJobId() {
    return db.prepare(`
      SELECT * FROM job_queue
      WHERE job_id = ?
    `);
  },

  get updateStatus() {
    return db.prepare(`
      UPDATE job_queue
      SET status = ?
      WHERE job_id = ?
    `);
  },

  get updateStarted() {
    return db.prepare(`
      UPDATE job_queue
      SET status = 'processing', started_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `);
  },

  get updateCompleted() {
    return db.prepare(`
      UPDATE job_queue
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `);
  },

  get updateFailed() {
    return db.prepare(`
      UPDATE job_queue
      SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_message = ?
      WHERE job_id = ?
    `);
  },

  get deleteByJobId() {
    return db.prepare(`
      DELETE FROM job_queue
      WHERE job_id = ?
    `);
  },

  get deleteOldCompleted() {
    return db.prepare(`
      DELETE FROM job_queue
      WHERE status IN ('completed', 'failed')
        AND completed_at < datetime('now', '-7 days')
    `);
  },

  get countByStatus() {
    return db.prepare(`
      SELECT status, COUNT(*) as count
      FROM job_queue
      GROUP BY status
    `);
  },

  get countByRepoAndStatus() {
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM job_queue
      WHERE repo_id = ? AND status = ?
    `);
  },

  get findDuplicateJob() {
    return db.prepare(`
      SELECT * FROM job_queue
      WHERE type = ?
        AND repo_id = ?
        AND args = ?
        AND status IN ('pending', 'processing')
      LIMIT 1
    `);
  },
};

// Pull Request queries
export const prQueries = {
  get upsert() {
    return db.prepare(`
      INSERT INTO pull_requests (
        repo_id, github_id, number, title, body, state, draft, labels,
        created_at, updated_at, closed_at, merged_at, comments_count,
        last_comment_at, last_comment_author, reactions, assignees, reviewers,
        review_decision, mergeable_state, additions, deletions, changed_files,
        author_login, author_association, head_ref_name, base_ref_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(github_id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        state = excluded.state,
        draft = excluded.draft,
        labels = excluded.labels,
        updated_at = excluded.updated_at,
        closed_at = excluded.closed_at,
        merged_at = excluded.merged_at,
        comments_count = excluded.comments_count,
        last_comment_at = excluded.last_comment_at,
        last_comment_author = excluded.last_comment_author,
        reactions = excluded.reactions,
        assignees = excluded.assignees,
        reviewers = excluded.reviewers,
        review_decision = excluded.review_decision,
        mergeable_state = excluded.mergeable_state,
        additions = excluded.additions,
        deletions = excluded.deletions,
        changed_files = excluded.changed_files,
        author_login = excluded.author_login,
        author_association = excluded.author_association,
        head_ref_name = excluded.head_ref_name,
        base_ref_name = excluded.base_ref_name
      RETURNING *
    `);
  },

  get findByRepo() {
    return db.prepare(`
      SELECT * FROM pull_requests
      WHERE repo_id = ?
      ORDER BY updated_at DESC
    `);
  },

  get findOpenByRepo() {
    return db.prepare(`
      SELECT * FROM pull_requests
      WHERE repo_id = ? AND state = 'open'
      ORDER BY updated_at DESC
    `);
  },

  get countByRepo() {
    return db.prepare(`
      SELECT COUNT(*) as count FROM pull_requests WHERE repo_id = ?
    `);
  },

  get findByGithubId() {
    return db.prepare('SELECT * FROM pull_requests WHERE github_id = ?');
  },

  get getMostRecentUpdatedAt() {
    return db.prepare(`
      SELECT MAX(updated_at) as most_recent_updated_at
      FROM pull_requests
      WHERE repo_id = ?
    `);
  },

  get updateCommentsFetched() {
    return db.prepare(`
      UPDATE pull_requests
      SET comments_fetched = 1
      WHERE id = ?
    `);
  },

  get updatePRCount() {
    return db.prepare(`
      UPDATE repositories
      SET pr_count = (
        SELECT COUNT(*) FROM pull_requests WHERE repo_id = ?
      )
      WHERE id = ?
    `);
  },

  get updateLastPRFetched() {
    return db.prepare(`
      UPDATE repositories
      SET last_pr_fetched = ?
      WHERE id = ?
    `);
  },
};

// PR Analysis queries
export const prAnalysisQueries = {
  get upsert() {
    return db.prepare(`
      INSERT INTO pr_analysis (pr_id, analysis_type, score, metadata)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(pr_id, analysis_type)
      DO UPDATE SET
        score = excluded.score,
        metadata = excluded.metadata,
        analyzed_at = CURRENT_TIMESTAMP
    `);
  },

  get findByPRAndType() {
    return db.prepare(`
      SELECT * FROM pr_analysis
      WHERE pr_id = ? AND analysis_type = ?
    `);
  },

  get findByRepoAndType() {
    return db.prepare(`
      SELECT pa.*, pr.*
      FROM pr_analysis pa
      JOIN pull_requests pr ON pa.pr_id = pr.id
      WHERE pr.repo_id = ? AND pa.analysis_type = ?
      ORDER BY pa.score DESC
    `);
  },

  get findStaleAnalyses() {
    return db.prepare(`
      SELECT pr.*, pa.analyzed_at
      FROM pull_requests pr
      LEFT JOIN pr_analysis pa ON pr.id = pa.pr_id AND pa.analysis_type = ?
      WHERE pr.repo_id = ?
        AND (pa.analyzed_at IS NULL OR pr.updated_at > pa.analyzed_at)
    `);
  },

  get countByRepoAndType() {
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM pr_analysis pa
      JOIN pull_requests pr ON pa.pr_id = pr.id
      WHERE pr.repo_id = ? AND pa.analysis_type = ?
    `);
  },

  get deleteByPR() {
    return db.prepare(`
      DELETE FROM pr_analysis
      WHERE pr_id = ?
    `);
  },

  get deleteByRepo() {
    return db.prepare(`
      DELETE FROM pr_analysis
      WHERE pr_id IN (SELECT id FROM pull_requests WHERE repo_id = ?)
    `);
  },
};

// PR Comment queries
export const prCommentQueries = {
  get insertOrUpdate() {
    return db.prepare(`
      INSERT INTO pr_comments (pr_id, github_comment_id, comment_type, author, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(github_comment_id) DO UPDATE SET
        author = excluded.author,
        body = excluded.body,
        created_at = excluded.created_at,
        comment_type = excluded.comment_type
    `);
  },

  get findByPRId() {
    return db.prepare(`
      SELECT * FROM pr_comments
      WHERE pr_id = ?
      ORDER BY created_at ASC
    `);
  },

  get deleteByPRId() {
    return db.prepare(`
      DELETE FROM pr_comments
      WHERE pr_id = ?
    `);
  },

  get countByPRId() {
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM pr_comments
      WHERE pr_id = ?
    `);
  },
};

// Metrics queries (for performance tracking)
export const metricsQueries = {
  get findByRepoId() {
    return db.prepare(`
      SELECT * FROM metrics
      WHERE repo_id = ?
      ORDER BY priority DESC, name ASC
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
      INSERT INTO metrics (repo_id, key, name, unit, priority, default_visible)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
  },

  get update() {
    return db.prepare(`
      UPDATE metrics
      SET name = ?, unit = ?, priority = ?, default_visible = ?
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
