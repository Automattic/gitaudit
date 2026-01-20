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
      status TEXT DEFAULT 'not_started',
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

  // Reset last_fetched to recover from bug where it was updated at job start
  resetLastFetchedToRecoverUpdates();

  // Rename fetch_status to status (generic for all job types)
  renameRepoFetchStatusToStatus();

  // Clean up any stuck in_progress statuses from server crashes
  cleanupStuckStatuses();

  // Rename scoreType keys in settings JSON
  migrateScoreTypeKeys();

  // Rename stale threshold keys to match priority levels
  migrateStaleThresholdKeys();

  // Add general settings section
  migrateToGeneralSettings();

  // Create job_queue table for job persistence
  createJobQueueTable();

  // Create pull_requests table for PR audits
  createPullRequestsTable();

  // Create pr_analysis table for PR analysis results
  createPRAnalysisTable();

  // Create pr_comments table for PR comment caching
  createPRCommentsTable();

  // Add PR tracking columns to repositories table
  migratePRTrackingColumns();

  // Add non-GitHub repository support columns
  migrateNonGithubColumns();

  // Create metrics table for performance tracking
  createMetricsTable();

  // Add metrics_token column to repositories table
  migrateMetricsTokenColumn();

  // Create perf table for performance metric data points
  createPerfTable();

  // Add metrics_public column for public dashboard toggle
  migrateMetricsPublicColumn();

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

// Reset last_fetched to recover from updateFetchStatus bug (one-time migration)
// The bug: updateFetchStatus was setting last_fetched = CURRENT_TIMESTAMP at job START
// This caused incremental fetches to miss recent updates
// Fix: Set last_fetched to 2 days ago to re-fetch all recent updates
function resetLastFetchedToRecoverUpdates() {
  try {
    // Check if this migration has already run
    const migrationName = 'reset_last_fetched_recover_updates_2025_12';
    const alreadyRun = db.prepare(`
      SELECT COUNT(*) as count FROM migration_log WHERE migration_name = ?
    `).get(migrationName);

    if (alreadyRun.count > 0) {
      // Migration already completed
      return;
    }

    // Set last_fetched to 2 days ago for all repositories
    // This will cause next fetch to get all issues updated in last 2 days
    const result = db.prepare(`
      UPDATE repositories
      SET last_fetched = datetime('now', '-2 days')
      WHERE last_fetched IS NOT NULL
    `).run();

    if (result.changes > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log('🔧 BUG FIX: Recovering from last_fetched timestamp bug');
      console.log(`   Reset last_fetched to 2 days ago for ${result.changes} repository(ies)`);
      console.log(`   Next refresh will fetch all issues updated in the last 2 days`);
      console.log(`${'='.repeat(70)}\n`);
    }

    // Mark this migration as complete
    db.prepare(`
      INSERT INTO migration_log (migration_name) VALUES (?)
    `).run(migrationName);

  } catch (error) {
    console.error('Failed to reset last_fetched timestamps:', error);
    // Don't throw - allow server to start even if migration fails
  }
}

// Clean up any repositories stuck in 'in_progress' status
function cleanupStuckStatuses() {
  const result = db.prepare(`
    UPDATE repositories
    SET status = 'completed'
    WHERE status = 'in_progress'
  `).run();

  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} repositories stuck in 'in_progress' status`);
  }
}

// Migration function to rename fetch_status to status (generic for all job types)
function renameRepoFetchStatusToStatus() {
  try {
    // Check if the column needs renaming
    const columns = db.prepare('PRAGMA table_info(repositories)').all();
    const hasFetchStatus = columns.some(col => col.name === 'fetch_status');
    const hasStatus = columns.some(col => col.name === 'status');

    if (hasFetchStatus && !hasStatus) {
      db.exec('ALTER TABLE repositories RENAME COLUMN fetch_status TO status');
      console.log('Renamed fetch_status to status in repositories table');
    }
  } catch (error) {
    console.error('Failed to rename fetch_status to status:', error);
    // Don't throw - allow server to start even if migration fails
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

// Migrate scoreType keys in repo_settings from camelCase to match route segments
// importantBugs → bugs, staleIssues → stale, communityHealth → community
function migrateScoreTypeKeys() {
  try {
    // Check if this migration has already run
    const migrationName = 'rename_score_type_keys_2025_12';
    const alreadyRun = db.prepare(`
      SELECT COUNT(*) as count FROM migration_log WHERE migration_name = ?
    `).get(migrationName);

    if (alreadyRun.count > 0) {
      // Migration already completed
      return;
    }

    // Get all repo settings
    const allSettings = db.prepare(`
      SELECT id, settings FROM repo_settings
    `).all();

    if (allSettings.length === 0) {
      // No settings to migrate, just mark as complete
      db.prepare(`
        INSERT INTO migration_log (migration_name) VALUES (?)
      `).run(migrationName);
      return;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('🔄 MIGRATING: Renaming scoreType keys in repo settings');
    console.log(`   Found ${allSettings.length} repository setting(s) to process`);

    // Prepare update statement
    const updateStmt = db.prepare(`
      UPDATE repo_settings SET settings = ? WHERE id = ?
    `);

    const migrate = db.transaction(() => {
      let migratedCount = 0;

      for (const row of allSettings) {
        try {
          const settings = JSON.parse(row.settings);
          let modified = false;

          // Rename importantBugs → bugs
          if (settings.importantBugs) {
            settings.bugs = settings.importantBugs;
            delete settings.importantBugs;
            modified = true;
          }

          // Rename staleIssues → stale
          if (settings.staleIssues) {
            settings.stale = settings.staleIssues;
            delete settings.staleIssues;
            modified = true;
          }

          // Rename communityHealth → community
          if (settings.communityHealth) {
            settings.community = settings.communityHealth;
            delete settings.communityHealth;
            modified = true;
          }

          if (modified) {
            updateStmt.run(JSON.stringify(settings), row.id);
            migratedCount++;
          }
        } catch (error) {
          console.error(`   ⚠️  Failed to migrate settings for repo_settings id=${row.id}:`, error.message);
        }
      }

      console.log(`   ✓ Updated ${migratedCount} repository setting(s)`);
      console.log(`${'='.repeat(70)}\n`);
    });

    migrate();

    // Mark this migration as complete
    db.prepare(`
      INSERT INTO migration_log (migration_name) VALUES (?)
    `).run(migrationName);

  } catch (error) {
    console.error('Failed to migrate scoreType keys:', error);
    // Don't throw - allow server to start even if migration fails
  }
}

// Migrate stale threshold keys to match priority levels (critical, high, medium)
// veryStale → critical, moderatelyStale → high, slightlyStale → medium
function migrateStaleThresholdKeys() {
  try {
    // Check if this migration has already run
    const migrationName = 'rename_stale_threshold_keys_2025_12';
    const alreadyRun = db.prepare(`
      SELECT COUNT(*) as count FROM migration_log WHERE migration_name = ?
    `).get(migrationName);

    if (alreadyRun.count > 0) {
      // Migration already completed
      return;
    }

    // Get all repo settings
    const allSettings = db.prepare(`
      SELECT id, settings FROM repo_settings
    `).all();

    if (allSettings.length === 0) {
      // No settings to migrate, just mark as complete
      db.prepare(`
        INSERT INTO migration_log (migration_name) VALUES (?)
      `).run(migrationName);
      return;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('🔄 MIGRATING: Renaming stale threshold keys to match priority levels');
    console.log(`   Found ${allSettings.length} repository setting(s) to process`);

    // Prepare update statement
    const updateStmt = db.prepare(`
      UPDATE repo_settings SET settings = ? WHERE id = ?
    `);

    const migrate = db.transaction(() => {
      let migratedCount = 0;

      for (const row of allSettings) {
        try {
          const settings = JSON.parse(row.settings);
          let modified = false;

          // Update stale thresholds
          if (settings.stale && settings.stale.thresholds) {
            const thresholds = settings.stale.thresholds;

            // Rename veryStale → critical
            if (thresholds.veryStale !== undefined) {
              thresholds.critical = thresholds.veryStale;
              delete thresholds.veryStale;
              modified = true;
            }

            // Rename moderatelyStale → high
            if (thresholds.moderatelyStale !== undefined) {
              thresholds.high = thresholds.moderatelyStale;
              delete thresholds.moderatelyStale;
              modified = true;
            }

            // Rename slightlyStale → medium
            if (thresholds.slightlyStale !== undefined) {
              thresholds.medium = thresholds.slightlyStale;
              delete thresholds.slightlyStale;
              modified = true;
            }
          }

          if (modified) {
            updateStmt.run(JSON.stringify(settings), row.id);
            migratedCount++;
          }
        } catch (error) {
          console.error(`   ⚠️  Failed to migrate settings for repo_settings id=${row.id}:`, error.message);
        }
      }

      console.log(`   ✓ Updated ${migratedCount} repository setting(s)`);
      console.log(`${'='.repeat(70)}\n`);
    });

    migrate();

    // Mark this migration as complete
    db.prepare(`
      INSERT INTO migration_log (migration_name) VALUES (?)
    `).run(migrationName);

  } catch (error) {
    console.error('Failed to migrate stale threshold keys:', error);
    // Don't throw - allow server to start even if migration fails
  }
}

// Add general settings section and migrate global label configuration
// Creates: general.labels { bug, feature, highPriority, lowPriority }
// Splits:  bugs.scoringRules.priorityLabels → general.labels.highPriority + bugs.scoringRules.highPriorityLabels
//          bugs.scoringRules.lowPriorityLabels → general.labels.lowPriority + bugs.scoringRules.lowPriorityLabels
// Moves:   features.detection.featureLabels → general.labels.feature
//          community.maintainerTeam → general.maintainerTeam
// Removes: features.detection (all labels moved to general)
function migrateToGeneralSettings() {
  try {
    // Check if this migration has already run
    const migrationName = 'add_general_settings_2025_12_v3';
    const alreadyRun = db.prepare(`
      SELECT COUNT(*) as count FROM migration_log WHERE migration_name = ?
    `).get(migrationName);

    if (alreadyRun.count > 0) {
      // Migration already completed
      return;
    }

    // Get all repo settings
    const allSettings = db.prepare(`
      SELECT id, settings FROM repo_settings
    `).all();

    if (allSettings.length === 0) {
      // No settings to migrate, just mark as complete
      db.prepare(`
        INSERT INTO migration_log (migration_name) VALUES (?)
      `).run(migrationName);
      return;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('🔄 MIGRATING: Adding general settings section');
    console.log(`   Found ${allSettings.length} repository setting(s) to process`);

    // Prepare update statement
    const updateStmt = db.prepare(`
      UPDATE repo_settings SET settings = ? WHERE id = ?
    `);

    const migrate = db.transaction(() => {
      let migratedCount = 0;

      for (const row of allSettings) {
        try {
          const settings = JSON.parse(row.settings);

          // Skip if already migrated to the new structure
          if (settings.general?.labels?.highPriority !== undefined &&
              settings.bugs?.scoringRules?.highPriorityLabels !== undefined) {
            continue;
          }

          let modified = false;

          // Get defaults for fallback values
          const defaults = {
            labels: {
              bug: 'bug, defect, error, crash, broken, [type] bug',
              feature: 'enhancement, feature, feature request, new feature, proposal, [type] enhancement, [type] feature',
              highPriority: 'critical, high priority, urgent, severity: high, p0, p1, blocker, showstopper, priority high, priority: high, [priority] high',
              lowPriority: 'priority low, priority: low, [priority] low, low priority'
            },
            highPriorityLabels: { enabled: true, points: 30 },
            lowPriorityLabels: { enabled: true, points: -20 }
          };

          // Initialize general section if it doesn't exist
          if (!settings.general) {
            settings.general = {
              labels: {
                bug: '',
                feature: '',
                highPriority: '',
                lowPriority: ''
              },
              maintainerTeam: { org: '', teamSlug: '' }
            };
            modified = true;
          }

          // Ensure labels object exists
          if (!settings.general.labels) {
            settings.general.labels = {
              bug: '',
              feature: '',
              highPriority: '',
              lowPriority: ''
            };
            modified = true;
          }

          // Add bug and feature labels if missing
          if (!settings.general.labels.bug) {
            settings.general.labels.bug = defaults.labels.bug;
            modified = true;
          }
          if (!settings.general.labels.feature) {
            settings.general.labels.feature = defaults.labels.feature;
            modified = true;
          }

          // Ensure bugs.scoringRules exists
          if (!settings.bugs) {
            settings.bugs = { scoringRules: {}, thresholds: { critical: 120, high: 80, medium: 50 } };
            modified = true;
          }
          if (!settings.bugs.scoringRules) {
            settings.bugs.scoringRules = {};
            modified = true;
          }

          // Migrate priority labels - SPLIT into labels (general) and enabled/points (bugs)
          // Handle old priorityLabels from bugs.scoringRules
          if (settings.bugs.scoringRules.priorityLabels) {
            const priorityLabels = settings.bugs.scoringRules.priorityLabels;

            // Move labels string to general.labels.highPriority
            settings.general.labels.highPriority = priorityLabels.labels || defaults.labels.highPriority;

            // Keep enabled/points in bugs.scoringRules.highPriorityLabels
            settings.bugs.scoringRules.highPriorityLabels = {
              enabled: priorityLabels.enabled ?? defaults.highPriorityLabels.enabled,
              points: priorityLabels.points ?? defaults.highPriorityLabels.points
            };

            // Remove old priorityLabels
            delete settings.bugs.scoringRules.priorityLabels;
            modified = true;
          }
          // Handle old priorityLabels from general (incorrect previous migration)
          else if (settings.general.priorityLabels) {
            const priorityLabels = settings.general.priorityLabels;

            // Move labels string to general.labels.highPriority
            settings.general.labels.highPriority = priorityLabels.labels || defaults.labels.highPriority;

            // Create highPriorityLabels in bugs.scoringRules with enabled/points
            settings.bugs.scoringRules.highPriorityLabels = {
              enabled: priorityLabels.enabled ?? defaults.highPriorityLabels.enabled,
              points: priorityLabels.points ?? defaults.highPriorityLabels.points
            };

            // Remove old priorityLabels from general
            delete settings.general.priorityLabels;
            modified = true;
          }
          // No old settings - create with defaults
          else if (!settings.general.labels.highPriority) {
            settings.general.labels.highPriority = defaults.labels.highPriority;
            settings.bugs.scoringRules.highPriorityLabels = defaults.highPriorityLabels;
            modified = true;
          }

          // Migrate low priority labels - SPLIT into labels (general) and enabled/points (bugs)
          // Handle old lowPriorityLabels that has all fields (labels, enabled, points)
          if (settings.bugs.scoringRules.lowPriorityLabels?.labels !== undefined) {
            const lowPriorityLabels = settings.bugs.scoringRules.lowPriorityLabels;

            // Move labels string to general.labels.lowPriority
            settings.general.labels.lowPriority = lowPriorityLabels.labels || defaults.labels.lowPriority;

            // Keep only enabled/points in bugs.scoringRules.lowPriorityLabels
            settings.bugs.scoringRules.lowPriorityLabels = {
              enabled: lowPriorityLabels.enabled ?? defaults.lowPriorityLabels.enabled,
              points: lowPriorityLabels.points ?? defaults.lowPriorityLabels.points
            };

            modified = true;
          }
          // Handle old lowPriorityLabels from general (incorrect previous migration)
          else if (settings.general.lowPriorityLabels) {
            const lowPriorityLabels = settings.general.lowPriorityLabels;

            // Move labels string to general.labels.lowPriority
            settings.general.labels.lowPriority = lowPriorityLabels.labels || defaults.labels.lowPriority;

            // Create lowPriorityLabels in bugs.scoringRules with enabled/points
            settings.bugs.scoringRules.lowPriorityLabels = {
              enabled: lowPriorityLabels.enabled ?? defaults.lowPriorityLabels.enabled,
              points: lowPriorityLabels.points ?? defaults.lowPriorityLabels.points
            };

            // Remove old lowPriorityLabels from general
            delete settings.general.lowPriorityLabels;
            modified = true;
          }
          // No old settings - create with defaults
          else if (!settings.general.labels.lowPriority) {
            settings.general.labels.lowPriority = defaults.labels.lowPriority;
            settings.bugs.scoringRules.lowPriorityLabels = defaults.lowPriorityLabels;
            modified = true;
          }

          // Migrate maintainer team from community to general
          if (settings.community?.maintainerTeam) {
            settings.general.maintainerTeam = settings.community.maintainerTeam;
            delete settings.community.maintainerTeam;
            modified = true;
          }

          // Ensure features section exists (without detection - labels are in general)
          if (!settings.features) {
            settings.features = {
              scoringRules: {
                reactions: { enabled: true },
                uniqueCommenters: { enabled: true },
                meTooComments: { enabled: true, points: 5, minimumCount: 3 },
                activeDiscussion: { enabled: true },
                recentActivity: { enabled: true, recentThreshold: 30, recentPoints: 10, moderateThreshold: 90, moderatePoints: 5 },
                hasMilestone: { enabled: true, points: 10 },
                hasAssignee: { enabled: true, points: 5 },
                authorType: { enabled: true, teamPoints: 5, contributorPoints: 3, firstTimePoints: 2 },
                sentimentAnalysis: { enabled: true, maxPoints: 10 },
                stalePenalty: { enabled: true, points: -10, ageThreshold: 180, inactivityThreshold: 90 },
                rejectionPenalty: { enabled: true, points: -50 },
                vagueDescriptionPenalty: { enabled: true, points: -5, lengthThreshold: 100 },
              },
              thresholds: { critical: 70, high: 50, medium: 30 },
            };
            modified = true;
          }

          // Migrate featureLabels from features.detection to general.labels.feature
          if (settings.features?.detection?.featureLabels) {
            settings.general.labels.feature = settings.features.detection.featureLabels;
            modified = true;
          }

          // Remove detection section from features (labels moved to general)
          if (settings.features?.detection) {
            delete settings.features.detection;
            modified = true;
          }

          if (modified) {
            updateStmt.run(JSON.stringify(settings), row.id);
            migratedCount++;
          }
        } catch (error) {
          console.error(`   ⚠️  Failed to migrate settings for repo_settings id=${row.id}:`, error.message);
        }
      }

      console.log(`   ✓ Updated ${migratedCount} repository setting(s)`);
      console.log(`${'='.repeat(70)}\n`);
    });

    migrate();

    // Mark this migration as complete
    db.prepare(`
      INSERT INTO migration_log (migration_name) VALUES (?)
    `).run(migrationName);

  } catch (error) {
    console.error('Failed to migrate to general settings:', error);
    // Don't throw - allow server to start even if migration fails
  }
}

// Create job_queue table for persistent job queue
function createJobQueueTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      repo_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      args TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 50,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='job_queue'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_job_queue_status')) {
    db.exec('CREATE INDEX idx_job_queue_status ON job_queue(status, priority DESC, created_at ASC)');
    console.log('Created idx_job_queue_status index');
  }

  if (!indexNames.includes('idx_job_queue_repo')) {
    db.exec('CREATE INDEX idx_job_queue_repo ON job_queue(repo_id, status)');
    console.log('Created idx_job_queue_repo index');
  }

  if (!indexNames.includes('idx_job_queue_job_id')) {
    db.exec('CREATE INDEX idx_job_queue_job_id ON job_queue(job_id)');
    console.log('Created idx_job_queue_job_id index');
  }

  if (!indexNames.includes('idx_job_queue_user')) {
    db.exec('CREATE INDEX idx_job_queue_user ON job_queue(user_id)');
    console.log('Created idx_job_queue_user index');
  }
}

// Create pull_requests table for PR audits
function createPullRequestsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      github_id INTEGER NOT NULL UNIQUE,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      draft BOOLEAN DEFAULT 0,
      labels TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      closed_at DATETIME,
      merged_at DATETIME,
      comments_count INTEGER DEFAULT 0,
      last_comment_at DATETIME,
      last_comment_author TEXT,
      reactions TEXT,
      assignees TEXT,
      reviewers TEXT,
      review_decision TEXT,
      mergeable_state TEXT,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      changed_files INTEGER DEFAULT 0,
      author_login TEXT,
      author_association TEXT,
      head_ref_name TEXT,
      base_ref_name TEXT,
      comments_fetched BOOLEAN DEFAULT 0,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pull_requests'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_prs_repo_state')) {
    db.exec('CREATE INDEX idx_prs_repo_state ON pull_requests(repo_id, state)');
    console.log('Created idx_prs_repo_state index');
  }

  if (!indexNames.includes('idx_prs_updated')) {
    db.exec('CREATE INDEX idx_prs_updated ON pull_requests(updated_at)');
    console.log('Created idx_prs_updated index');
  }

  if (!indexNames.includes('idx_prs_github_id')) {
    db.exec('CREATE INDEX idx_prs_github_id ON pull_requests(github_id)');
    console.log('Created idx_prs_github_id index');
  }

  if (!indexNames.includes('idx_prs_draft')) {
    db.exec('CREATE INDEX idx_prs_draft ON pull_requests(repo_id, draft)');
    console.log('Created idx_prs_draft index');
  }

  if (!indexNames.includes('idx_prs_review_decision')) {
    db.exec('CREATE INDEX idx_prs_review_decision ON pull_requests(repo_id, review_decision)');
    console.log('Created idx_prs_review_decision index');
  }
}

// Create pr_analysis table for PR analysis results
function createPRAnalysisTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pr_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL,
      analysis_type TEXT NOT NULL,
      score REAL,
      metadata TEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE
    )
  `);

  // Create unique index for upserts
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pr_analysis'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_pr_analysis_pr_type_unique')) {
    db.exec('CREATE UNIQUE INDEX idx_pr_analysis_pr_type_unique ON pr_analysis(pr_id, analysis_type)');
    console.log('Created unique index idx_pr_analysis_pr_type_unique');
  }
}

// Create pr_comments table for PR comment caching
function createPRCommentsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pr_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL,
      github_comment_id INTEGER NOT NULL,
      comment_type TEXT NOT NULL,
      author TEXT NOT NULL,
      body TEXT,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='pr_comments'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_pr_comments_pr_id')) {
    db.exec('CREATE INDEX idx_pr_comments_pr_id ON pr_comments(pr_id)');
    console.log('Created idx_pr_comments_pr_id index');
  }

  if (!indexNames.includes('idx_pr_comments_github_id')) {
    db.exec('CREATE UNIQUE INDEX idx_pr_comments_github_id ON pr_comments(github_comment_id)');
    console.log('Created unique idx_pr_comments_github_id index');
  }
}

// Add PR tracking columns to repositories table
function migratePRTrackingColumns() {
  // Get existing columns
  const columns = db.prepare('PRAGMA table_info(repositories)').all();
  const columnNames = columns.map(col => col.name);

  // Add last_pr_fetched column if it doesn't exist
  if (!columnNames.includes('last_pr_fetched')) {
    db.exec('ALTER TABLE repositories ADD COLUMN last_pr_fetched DATETIME');
    console.log('Added last_pr_fetched column to repositories table');
  }

  // Add pr_count column if it doesn't exist
  if (!columnNames.includes('pr_count')) {
    db.exec('ALTER TABLE repositories ADD COLUMN pr_count INTEGER DEFAULT 0');
    console.log('Added pr_count column to repositories table');
  }
}

// Add columns to support non-GitHub repositories
function migrateNonGithubColumns() {
  // Get existing columns
  const columns = db.prepare('PRAGMA table_info(repositories)').all();
  const columnNames = columns.map(col => col.name);

  // Add is_github column if it doesn't exist (default 1 = true for backward compatibility)
  if (!columnNames.includes('is_github')) {
    db.exec('ALTER TABLE repositories ADD COLUMN is_github BOOLEAN DEFAULT 1');
    console.log('Added is_github column to repositories table');
  }

  // Add url column if it doesn't exist (for non-GitHub commit linking)
  if (!columnNames.includes('url')) {
    db.exec('ALTER TABLE repositories ADD COLUMN url TEXT');
    console.log('Added url column to repositories table');
  }
}

// Create metrics table for performance tracking
function createMetricsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT,
      priority INTEGER DEFAULT 0,
      default_visible BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
      UNIQUE(repo_id, key)
    )
  `);

  // Create index for faster lookups by repo_id
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='metrics'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_metrics_repo_id')) {
    db.exec('CREATE INDEX idx_metrics_repo_id ON metrics(repo_id)');
    console.log('Created idx_metrics_repo_id index');
  }
}

// Add metrics_token column to repositories table for CI/CD API authentication
function migrateMetricsTokenColumn() {
  const columns = db.prepare('PRAGMA table_info(repositories)').all();
  const columnNames = columns.map(col => col.name);

  if (!columnNames.includes('metrics_token')) {
    db.exec('ALTER TABLE repositories ADD COLUMN metrics_token TEXT');
    console.log('Added metrics_token column to repositories table');
  }
}

// Create perf table for storing performance metric data points
function createPerfTable() {
  db.exec(`
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
    )
  `);

  // Create indexes for better query performance
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='perf'").all();
  const indexNames = indexes.map(idx => idx.name);

  if (!indexNames.includes('idx_perf_repo_id')) {
    db.exec('CREATE INDEX idx_perf_repo_id ON perf(repo_id)');
    console.log('Created idx_perf_repo_id index');
  }

  if (!indexNames.includes('idx_perf_metric_id')) {
    db.exec('CREATE INDEX idx_perf_metric_id ON perf(metric_id)');
    console.log('Created idx_perf_metric_id index');
  }

  if (!indexNames.includes('idx_perf_branch')) {
    db.exec('CREATE INDEX idx_perf_branch ON perf(branch)');
    console.log('Created idx_perf_branch index');
  }

  if (!indexNames.includes('idx_perf_hash')) {
    db.exec('CREATE INDEX idx_perf_hash ON perf(hash)');
    console.log('Created idx_perf_hash index');
  }

  if (!indexNames.includes('idx_perf_measured_at')) {
    db.exec('CREATE INDEX idx_perf_measured_at ON perf(measured_at)');
    console.log('Created idx_perf_measured_at index');
  }
}

// Add metrics_public column to repositories table for public dashboard toggle
function migrateMetricsPublicColumn() {
  const columns = db.prepare('PRAGMA table_info(repositories)').all();
  const columnNames = columns.map(col => col.name);

  if (!columnNames.includes('metrics_public')) {
    db.exec('ALTER TABLE repositories ADD COLUMN metrics_public BOOLEAN DEFAULT 0');
    console.log('Added metrics_public column to repositories table');
  }
}

export default db;
