// utf8mb4_bin keeps comparisons case-sensitive, as they were on SQLite: metric keys
// like "LCP" and "lcp" are different metrics. Timestamps are milliseconds since the
// epoch, which leaves nothing to a database time zone or a driver's date format.
const OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(191) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    token_expires_at BIGINT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_users_username (username)
  ) ${OPTIONS}`,

  `CREATE TABLE IF NOT EXISTS repositories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner VARCHAR(191) NOT NULL,
    name VARCHAR(191) NOT NULL,
    github_id BIGINT NOT NULL,
    description TEXT NULL,
    stars INT NOT NULL DEFAULT 0,
    language VARCHAR(191) NULL,
    language_color VARCHAR(32) NULL,
    updated_at BIGINT NULL,
    is_private TINYINT(1) NOT NULL DEFAULT 0,
    is_github TINYINT(1) NOT NULL DEFAULT 1,
    url TEXT NULL,
    metrics_token VARCHAR(191) NULL,
    metrics_public TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_repositories_owner_name (owner, name),
    INDEX idx_repositories_metrics_token (metrics_token),
    INDEX idx_repositories_metrics_public (metrics_public)
  ) ${OPTIONS}`,

  `CREATE TABLE IF NOT EXISTS user_repositories (
    user_id INT NOT NULL,
    repo_id INT NOT NULL,
    date_added BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member',
    last_synced BIGINT NULL,
    PRIMARY KEY (user_id, repo_id),
    INDEX idx_user_repositories_repo (repo_id),
    CONSTRAINT fk_user_repositories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_repositories_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE
  ) ${OPTIONS}`,

  `CREATE TABLE IF NOT EXISTS metrics (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    repo_id INT NOT NULL,
    \`key\` VARCHAR(191) NOT NULL,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(64) NULL,
    priority INT NOT NULL DEFAULT 0,
    default_visible TINYINT(1) NOT NULL DEFAULT 1,
    min_regression_delta DOUBLE NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uq_metrics_repo_key (repo_id, \`key\`),
    CONSTRAINT fk_metrics_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE
  ) ${OPTIONS}`,

  // Two indexes cover every query, where the SQLite table has six: charts and
  // averages read by metric, and normalizing a CI post reads by commit.
  `CREATE TABLE IF NOT EXISTS perf (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    repo_id INT NOT NULL,
    branch VARCHAR(191) NOT NULL,
    hash VARCHAR(191) NOT NULL,
    metric_id INT NOT NULL,
    value DOUBLE NOT NULL,
    raw_value DOUBLE NOT NULL,
    measured_at BIGINT NOT NULL,
    INDEX idx_perf_metric_branch_measured (metric_id, branch, measured_at),
    INDEX idx_perf_hash_repo (hash, repo_id),
    CONSTRAINT fk_perf_metric FOREIGN KEY (metric_id) REFERENCES metrics (id) ON DELETE CASCADE
  ) ${OPTIONS}`,
];
