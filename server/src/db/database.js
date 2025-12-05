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

  // Migrate to user_repositories join table
  migrateToUserRepositoriesTable();

  // Create issue_comments table for community health analyzer
  createIssueCommentsTable();

  // Migrate timestamps from ISO 8601 to SQLite format
  migrateTimestampFormats();

  // Trigger full refetch after timezone bug fix (one-time)
  triggerFullRefetchAfterTimezoneFix();

  // Clean up any stuck in_progress statuses from server crashes
  cleanupStuckStatuses();

  console.log('Database initialized successfully');
}

// Migrate timestamps from ISO 8601 format to SQLite format
// This ensures consistent timestamp comparisons for incremental analysis
function migrateTimestampFormats() {
  try {
    // Check if migration is needed (check for ISO format timestamps)
    const needsMigration = db.prepare(`
      SELECT COUNT(*) as count FROM issues WHERE created_at LIKE '%T%'
    `).get();

    if (needsMigration.count === 0) {
      // Migration already completed
      return;
    }

    console.log(`Migrating ${needsMigration.count} issue timestamps from ISO 8601 to SQLite format...`);

    // Migrate issues table using SQLite's datetime() function for proper normalization
    const issuesResult = db.prepare(`
      UPDATE issues SET
        created_at = datetime(created_at),
        updated_at = datetime(updated_at),
        closed_at = CASE
          WHEN closed_at IS NOT NULL THEN datetime(closed_at)
          ELSE NULL
        END,
        last_comment_at = CASE
          WHEN last_comment_at IS NOT NULL THEN datetime(last_comment_at)
          ELSE NULL
        END
      WHERE created_at LIKE '%T%'
    `).run();

    // Migrate comments table
    const commentsResult = db.prepare(`
      UPDATE issue_comments SET
        created_at = datetime(created_at)
      WHERE created_at LIKE '%T%'
    `).run();

    // Migrate repositories table
    const reposResult = db.prepare(`
      UPDATE repositories SET
        last_fetched = datetime(last_fetched),
        updated_at = CASE
          WHEN updated_at IS NOT NULL AND updated_at LIKE '%T%'
          THEN datetime(updated_at)
          ELSE updated_at
        END
      WHERE (last_fetched LIKE '%T%' AND last_fetched IS NOT NULL)
         OR (updated_at LIKE '%T%' AND updated_at IS NOT NULL)
    `).run();

    const totalMigrated = issuesResult.changes + commentsResult.changes + reposResult.changes;
    console.log(`✓ Migrated ${totalMigrated} timestamps to SQLite format (${issuesResult.changes} issues, ${commentsResult.changes} comments, ${reposResult.changes} repos)`);
  } catch (error) {
    console.error('Failed to migrate timestamp formats:', error);
    // Don't throw - allow server to start even if migration fails
  }
}

// Trigger full refetch for all repos after timezone bug fix (one-time migration)
// This ensures data integrity after fixing timezone parsing bugs
function triggerFullRefetchAfterTimezoneFix() {
  try {
    // Check if this migration has already run by looking for a migration marker
    // We'll use a metadata table to track one-time migrations
    db.exec(`
      CREATE TABLE IF NOT EXISTS migration_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        run_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if this specific migration has already run
    const migrationName = 'timezone_bug_fix_refetch_2025_12';
    const alreadyRun = db.prepare(`
      SELECT COUNT(*) as count FROM migration_log WHERE migration_name = ?
    `).get(migrationName);

    if (alreadyRun.count > 0) {
      // Migration already completed
      return;
    }

    // Set needs_full_refetch flag for all repositories that have been fetched
    const result = db.prepare(`
      UPDATE repositories
      SET needs_full_refetch = 1
      WHERE last_fetched IS NOT NULL
    `).run();

    if (result.changes > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log('🔄 TIMEZONE BUG FIX: Triggering full refetch for data integrity');
      console.log(`   Flagged ${result.changes} repository(ies) for full refresh`);
      console.log(`   Next refresh will fetch ALL issues to ensure 100% accuracy`);
      console.log(`${'='.repeat(70)}\n`);
    }

    // Mark this migration as complete
    db.prepare(`
      INSERT INTO migration_log (migration_name) VALUES (?)
    `).run(migrationName);

  } catch (error) {
    console.error('Failed to trigger full refetch after timezone fix:', error);
    // Don't throw - allow server to start even if migration fails
  }
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

  // Add comments_fetched column if it doesn't exist
  if (!columnNames.includes('comments_fetched')) {
    db.exec('ALTER TABLE issues ADD COLUMN comments_fetched BOOLEAN DEFAULT 0');
    console.log('Added comments_fetched column to issues table');
  }

  // Add author_login column if it doesn't exist
  if (!columnNames.includes('author_login')) {
    db.exec('ALTER TABLE issues ADD COLUMN author_login TEXT');
    console.log('Added author_login column to issues table');
  }

  // Add author_association column if it doesn't exist
  if (!columnNames.includes('author_association')) {
    db.exec('ALTER TABLE issues ADD COLUMN author_association TEXT');
    console.log('Added author_association column to issues table');
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

  // Add needs_full_refetch column if it doesn't exist
  // Default to 1 (true) for existing repos to populate author data on next sync
  if (!columnNames.includes('needs_full_refetch')) {
    db.exec('ALTER TABLE repositories ADD COLUMN needs_full_refetch BOOLEAN DEFAULT 1');
    console.log('Added needs_full_refetch column to repositories table');
    console.log('All existing repos will do a full refetch on next sync to populate author data');
  }

  // Add maintainer_logins column if it doesn't exist (stores JSON array of maintainer logins)
  if (!columnNames.includes('maintainer_logins')) {
    db.exec('ALTER TABLE repositories ADD COLUMN maintainer_logins TEXT');
    console.log('Added maintainer_logins column to repositories table');
  }

  // Add maintainer_logins_updated_at column if it doesn't exist
  if (!columnNames.includes('maintainer_logins_updated_at')) {
    db.exec('ALTER TABLE repositories ADD COLUMN maintainer_logins_updated_at DATETIME');
    console.log('Added maintainer_logins_updated_at column to repositories table');
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

// Create issue_comments table for caching comment data
function createIssueCommentsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS issue_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      github_comment_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      body TEXT,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='issue_comments'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_comments_issue_id')) {
    db.exec('CREATE INDEX idx_comments_issue_id ON issue_comments(issue_id)');
    console.log('Created idx_comments_issue_id index');
  }

  if (!indexNames.includes('idx_comments_github_id')) {
    db.exec('CREATE UNIQUE INDEX idx_comments_github_id ON issue_comments(github_comment_id)');
    console.log('Created unique idx_comments_github_id index');
  }
}

// Migration function to create user_repositories join table
function migrateToUserRepositoriesTable() {
  // Check if user_repositories table already exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_repositories'").all();

  if (tables.length === 0) {
    // Create the join table
    db.exec(`
      CREATE TABLE user_repositories (
        user_id INTEGER NOT NULL,
        repo_id INTEGER NOT NULL,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, repo_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      )
    `);
    console.log('Created user_repositories join table');

    // Create indexes for better query performance
    db.exec('CREATE INDEX idx_user_repositories_user ON user_repositories(user_id)');
    db.exec('CREATE INDEX idx_user_repositories_repo ON user_repositories(repo_id)');
    console.log('Created indexes for user_repositories table');

    // Migrate existing data from repositories.user_id to user_repositories
    const existingRepos = db.prepare(`
      SELECT id, user_id FROM repositories WHERE user_id IS NOT NULL
    `).all();

    if (existingRepos.length > 0) {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO user_repositories (user_id, repo_id)
        VALUES (?, ?)
      `);

      const migrate = db.transaction(() => {
        for (const repo of existingRepos) {
          insertStmt.run(repo.user_id, repo.id);
        }
      });

      migrate();
      console.log(`Migrated ${existingRepos.length} repository relationships to user_repositories table`);
    }
  }
}

export default db;
