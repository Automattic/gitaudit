import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create database connection
// Railway persistent volume path or local development path
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../codevitals.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Set busy timeout to 5 seconds to handle concurrent write requests
// Without this, SQLite immediately returns SQLITE_BUSY when another transaction holds the lock
db.pragma('busy_timeout = 5000');

// Enable WAL mode for better concurrent read/write performance
// WAL allows readers to proceed while a writer is active (only one writer at a time)
db.pragma('journal_mode = WAL');

// Initialize database schema
// Databases created before the issue and PR reports were removed keep those
// tables and columns until they are dropped by hand; nothing reads them.
export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id INTEGER UNIQUE NOT NULL,
      username TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      github_id INTEGER NOT NULL,
      description TEXT,
      stars INTEGER DEFAULT 0,
      language TEXT,
      language_color TEXT,
      updated_at DATETIME,
      is_private BOOLEAN DEFAULT 0,
      is_github BOOLEAN DEFAULT 1,
      url TEXT,
      metrics_token TEXT,
      metrics_public BOOLEAN DEFAULT 0,
      UNIQUE(owner, name)
    );

    CREATE TABLE IF NOT EXISTS user_repositories (
      user_id INTEGER NOT NULL,
      repo_id INTEGER NOT NULL,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      role TEXT NOT NULL DEFAULT 'member',
      last_synced DATETIME,
      PRIMARY KEY (user_id, repo_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_repositories_user ON user_repositories(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_repositories_repo ON user_repositories(repo_id);

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT,
      priority INTEGER DEFAULT 0,
      default_visible BOOLEAN DEFAULT 1,
      min_regression_delta REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
      UNIQUE(repo_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_repo_id ON metrics(repo_id);

    CREATE TABLE IF NOT EXISTS perf (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      branch TEXT NOT NULL,
      hash TEXT NOT NULL,
      metric_id INTEGER NOT NULL,
      value REAL NOT NULL,
      raw_value REAL NOT NULL,
      measured_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
      FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_perf_repo_id ON perf(repo_id);
    CREATE INDEX IF NOT EXISTS idx_perf_metric_id ON perf(metric_id);
    CREATE INDEX IF NOT EXISTS idx_perf_branch ON perf(branch);
    CREATE INDEX IF NOT EXISTS idx_perf_hash ON perf(hash);
    CREATE INDEX IF NOT EXISTS idx_perf_measured_at ON perf(measured_at);
    CREATE INDEX IF NOT EXISTS idx_perf_metric_branch_measured ON perf(metric_id, branch, measured_at DESC);
  `);

  console.log('Database initialized successfully');
}

export default db;
