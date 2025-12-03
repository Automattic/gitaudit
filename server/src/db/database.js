import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create database connection
// Railway persistent volume path or local development path
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../gitaudit.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id INTEGER UNIQUE NOT NULL,
      username TEXT NOT NULL,
      access_token TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Repositories cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      github_id INTEGER NOT NULL,
      last_fetched DATETIME,
      fetch_status TEXT DEFAULT 'not_started',
      UNIQUE(owner, name)
    )
  `);

  // Issues cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      github_id INTEGER NOT NULL UNIQUE,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      labels TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      closed_at DATETIME,
      comments_count INTEGER DEFAULT 0,
      last_comment_at DATETIME,
      last_comment_author TEXT,
      reactions TEXT,
      assignees TEXT,
      milestone TEXT,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_issues_repo_state
    ON issues(repo_id, state)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_issues_updated
    ON issues(updated_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_issues_github_id
    ON issues(github_id)
  `);

  // Analysis results cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS issue_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      analysis_type TEXT NOT NULL,
      score REAL,
      metadata TEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analysis_issue_type
    ON issue_analysis(issue_id, analysis_type)
  `);

  // Migrate repositories table to add new columns
  migrateRepositoriesTable();

  // Migrate issues table to add new columns
  migrateIssuesTable();

  // Migrate issue_analysis table to add unique constraint
  migrateIssueAnalysisTable();

  // Create repo_settings table
  createRepoSettingsTable();

  // Clean up any stuck in_progress statuses from server crashes
  cleanupStuckStatuses();

  console.log('Database initialized successfully');
}

// Clean up any repositories stuck in 'in_progress' status
function cleanupStuckStatuses() {
  const result = db.prepare(`
    UPDATE repositories
    SET fetch_status = 'completed'
    WHERE fetch_status = 'in_progress'
  `).run();

  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} repositories stuck in 'in_progress' status`);
  }
}

// Migration function to add new columns to issues table
function migrateIssuesTable() {
  // Get existing columns
  const columns = db.prepare('PRAGMA table_info(issues)').all();
  const columnNames = columns.map(col => col.name);

  // Add issue_type column if it doesn't exist
  if (!columnNames.includes('issue_type')) {
    db.exec('ALTER TABLE issues ADD COLUMN issue_type TEXT');
    console.log('Added issue_type column to issues table');
  }
}

// Migration function to add unique constraint to issue_analysis table
function migrateIssueAnalysisTable() {
  // Check if unique index exists
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='issue_analysis'").all();
  const indexNames = indexes.map(idx => idx.name);

  // Drop old non-unique index if it exists
  if (indexNames.includes('idx_analysis_issue_type')) {
    db.exec('DROP INDEX IF EXISTS idx_analysis_issue_type');
    console.log('Dropped old non-unique index idx_analysis_issue_type');
  }

  // Create unique index for ON CONFLICT to work
  if (!indexNames.includes('idx_analysis_issue_type_unique')) {
    db.exec('CREATE UNIQUE INDEX idx_analysis_issue_type_unique ON issue_analysis(issue_id, analysis_type)');
    console.log('Created unique index idx_analysis_issue_type_unique');
  }
}

// Migration function to add new columns to repositories table
function migrateRepositoriesTable() {
  // Get existing columns
  const columns = db.prepare('PRAGMA table_info(repositories)').all();
  const columnNames = columns.map(col => col.name);

  // Add user_id column if it doesn't exist
  if (!columnNames.includes('user_id')) {
    db.exec('ALTER TABLE repositories ADD COLUMN user_id INTEGER REFERENCES users(id)');
    console.log('Added user_id column to repositories table');
  }

  // Add description column if it doesn't exist
  if (!columnNames.includes('description')) {
    db.exec('ALTER TABLE repositories ADD COLUMN description TEXT');
    console.log('Added description column to repositories table');
  }

  // Add stars column if it doesn't exist
  if (!columnNames.includes('stars')) {
    db.exec('ALTER TABLE repositories ADD COLUMN stars INTEGER DEFAULT 0');
    console.log('Added stars column to repositories table');
  }

  // Add language column if it doesn't exist
  if (!columnNames.includes('language')) {
    db.exec('ALTER TABLE repositories ADD COLUMN language TEXT');
    console.log('Added language column to repositories table');
  }

  // Add language_color column if it doesn't exist
  if (!columnNames.includes('language_color')) {
    db.exec('ALTER TABLE repositories ADD COLUMN language_color TEXT');
    console.log('Added language_color column to repositories table');
  }

  // Add updated_at column if it doesn't exist
  if (!columnNames.includes('updated_at')) {
    db.exec('ALTER TABLE repositories ADD COLUMN updated_at DATETIME');
    console.log('Added updated_at column to repositories table');
  }

  // Add is_private column if it doesn't exist
  if (!columnNames.includes('is_private')) {
    db.exec('ALTER TABLE repositories ADD COLUMN is_private BOOLEAN DEFAULT 0');
    console.log('Added is_private column to repositories table');
  }

  // Add date_added column if it doesn't exist
  if (!columnNames.includes('date_added')) {
    db.exec('ALTER TABLE repositories ADD COLUMN date_added DATETIME');
    console.log('Added date_added column to repositories table');
  }

  // Create index on user_id if it doesn't exist
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='repositories'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_user_repos')) {
    db.exec('CREATE INDEX idx_user_repos ON repositories(user_id)');
    console.log('Created idx_user_repos index');
  }
}

// Create repo_settings table for per-repository scoring configuration
function createRepoSettingsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL UNIQUE,
      settings TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    )
  `);

  // Create index on repo_id
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='repo_settings'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_repo_settings_repo_id')) {
    db.exec('CREATE INDEX idx_repo_settings_repo_id ON repo_settings(repo_id)');
    console.log('Created idx_repo_settings_repo_id index');
  }
}

export default db;
