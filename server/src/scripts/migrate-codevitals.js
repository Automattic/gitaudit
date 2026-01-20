#!/usr/bin/env node
/**
 * Migration script: CodeVitals Legacy (PlanetScale MySQL) -> CodeVitals (SQLite)
 *
 * Usage:
 *   node server/src/scripts/migrate-codevitals.js <project_id> <owner/name> [--dry-run]
 *
 * Example:
 *   node server/src/scripts/migrate-codevitals.js 1 WordPress/gutenberg --dry-run
 *   node server/src/scripts/migrate-codevitals.js 1 WordPress/gutenberg
 *
 * Environment:
 *   CODEVITALS_DATABASE_URL - MySQL connection string for CodeVitals (optional, has default)
 */

import mysql from 'mysql2/promise';
import db from '../db/database.js';
import { repoQueries, metricsQueries, perfQueries } from '../db/queries.js';

// CodeVitals PlanetScale connection string (required)
const CODEVITALS_DATABASE_URL = process.env.CODEVITALS_DATABASE_URL;

if ( ! CODEVITALS_DATABASE_URL ) {
	console.error( 'Error: CODEVITALS_DATABASE_URL environment variable is required' );
	console.error( 'Set it to the PlanetScale MySQL connection string for CodeVitals' );
	process.exit( 1 );
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
	const args = process.argv.slice( 2 );

	if ( args.length < 2 || args.includes( '--help' ) || args.includes( '-h' ) ) {
		console.log( `
Usage: node migrate-codevitals.js <project_id> <owner/name> [--dry-run]

Arguments:
  project_id    CodeVitals project ID to migrate
  owner/name    CodeVitals repository (e.g., WordPress/gutenberg)

Options:
  --dry-run     Preview changes without modifying the database
  --help, -h    Show this help message

Examples:
  node server/src/scripts/migrate-codevitals.js 1 WordPress/gutenberg --dry-run
  node server/src/scripts/migrate-codevitals.js 1 WordPress/gutenberg
` );
		process.exit( args.includes( '--help' ) || args.includes( '-h' ) ? 0 : 1 );
	}

	const projectId = parseInt( args[ 0 ], 10 );
	const repoArg = args[ 1 ];
	const dryRun = args.includes( '--dry-run' );

	if ( isNaN( projectId ) ) {
		console.error( 'Error: project_id must be a number' );
		process.exit( 1 );
	}

	const slashIndex = repoArg.indexOf( '/' );
	if ( slashIndex === -1 ) {
		console.error( 'Error: Repository must be in format owner/name' );
		process.exit( 1 );
	}

	const owner = repoArg.substring( 0, slashIndex );
	const name = repoArg.substring( slashIndex + 1 );

	if ( ! owner || ! name ) {
		console.error( 'Error: Repository must be in format owner/name' );
		process.exit( 1 );
	}

	return { projectId, owner, name, dryRun };
}

// ============================================================================
// Database Connections
// ============================================================================

async function connectToCodeVitals() {
	const connection = await mysql.createConnection( {
		uri: CODEVITALS_DATABASE_URL,
		ssl: { rejectUnauthorized: true },
	} );
	return connection;
}

// ============================================================================
// Fetch CodeVitals Data
// ============================================================================

async function fetchCodeVitalsData( connection, projectId ) {
	// Verify project exists
	const [ projects ] = await connection.execute( 'SELECT * FROM project WHERE id = ?', [
		projectId,
	] );

	if ( projects.length === 0 ) {
		throw new Error( `Project ${ projectId } not found in CodeVitals` );
	}

	// Fetch metrics
	const [ metrics ] = await connection.execute( 'SELECT * FROM metric WHERE project_id = ?', [
		projectId,
	] );

	// Fetch perf data with pagination (PlanetScale has 100k row limit)
	const BATCH_SIZE = 50000;
	const perfs = [];
	let offset = 0;
	let hasMore = true;

	console.log( '  Fetching perf data in batches...' );
	while ( hasMore ) {
		const [ batch ] = await connection.execute(
			'SELECT * FROM perf WHERE project_id = ? ORDER BY id LIMIT ? OFFSET ?',
			[ projectId, BATCH_SIZE, offset ]
		);
		perfs.push( ...batch );
		console.log( `  Fetched ${ perfs.length } perf records...` );

		if ( batch.length < BATCH_SIZE ) {
			hasMore = false;
		} else {
			offset += BATCH_SIZE;
		}
	}

	return { project: projects[ 0 ], metrics, perfs };
}

// ============================================================================
// Find or Create Target Repository
// ============================================================================

function findOrCreateRepository( owner, name, projectName, dryRun ) {
	let repo = repoQueries.findByOwnerAndName.get( owner, name );

	if ( repo ) {
		console.log( `Found existing repository: ${ owner }/${ name } (id: ${ repo.id })` );
		return repo;
	}

	if ( dryRun ) {
		console.log( `[DRY-RUN] Would create repository: ${ owner }/${ name }` );
		return { id: -1, owner, name, isPlaceholder: true };
	}

	// Create non-GitHub repository
	repo = repoQueries.createLocalRepo.get(
		owner,
		name,
		`Migrated from CodeVitals: ${ projectName }`,
		null // url
	);
	console.log( `Created new repository: ${ owner }/${ name } (id: ${ repo.id })` );
	return repo;
}

// ============================================================================
// Migrate Metrics
// ============================================================================

function migrateMetrics( repoId, sourceMetrics, dryRun ) {
	const idMapping = new Map(); // legacy_id -> new_id
	const stats = { created: 0, skipped: 0 };

	for ( const sourceMetric of sourceMetrics ) {
		const existing = repoId > 0 ? metricsQueries.findByRepoIdAndKey.get( repoId, sourceMetric.key ) : null;

		if ( existing ) {
			// Metric exists - map ID
			idMapping.set( sourceMetric.id, existing.id );
			stats.skipped++;
			if ( dryRun ) {
				console.log(
					`  [DRY-RUN] Metric '${ sourceMetric.key }' exists (id: ${ existing.id })`
				);
			}
		} else {
			if ( dryRun ) {
				console.log( `  [DRY-RUN] Would create metric: ${ sourceMetric.key }` );
				idMapping.set( sourceMetric.id, -1 ); // Placeholder
				stats.created++;
			} else {
				const newMetric = metricsQueries.insert.get(
					repoId,
					sourceMetric.key,
					sourceMetric.name,
					null, // unit (not in CodeVitals schema)
					sourceMetric.priority || 0,
					sourceMetric.default_visible ? 1 : 0
				);
				idMapping.set( sourceMetric.id, newMetric.id );
				stats.created++;
				console.log(
					`  Created metric: ${ sourceMetric.key } (id: ${ newMetric.id })`
				);
			}
		}
	}

	return { idMapping, stats };
}

// ============================================================================
// Migrate Perf Data
// ============================================================================

function migratePerf( repoId, sourcePerfs, metricIdMapping, dryRun ) {
	const stats = { inserted: 0, skipped: 0, errors: 0 };

	// Prepare check for duplicates
	const checkDuplicate = db.prepare(
		'SELECT id FROM perf WHERE hash = ? AND metric_id = ?'
	);

	const total = sourcePerfs.length;
	let processed = 0;

	for ( const sourcePerf of sourcePerfs ) {
		processed++;

		// Progress reporting every 1000 records
		if ( processed % 1000 === 0 ) {
			console.log(
				`  Progress: ${ processed }/${ total } (${ Math.round( ( processed / total ) * 100 ) }%)`
			);
		}

		const targetMetricId = metricIdMapping.get( sourcePerf.metric_id );

		if ( ! targetMetricId ) {
			console.warn(
				`  Warning: No mapping for metric_id ${ sourcePerf.metric_id }, skipping perf record`
			);
			stats.errors++;
			continue;
		}

		if ( dryRun ) {
			stats.inserted++;
			continue;
		}

		try {
			// Check for duplicate (same hash + metric_id)
			const existing = checkDuplicate.get( sourcePerf.hash, targetMetricId );

			if ( existing ) {
				stats.skipped++;
				continue;
			}

			// Convert measured_at to ISO string if it's a Date object
			let measuredAt = sourcePerf.measured_at;
			if ( measuredAt instanceof Date ) {
				measuredAt = measuredAt.toISOString();
			}

			// Handle NULL raw_value by using value as fallback
			const rawValue = sourcePerf.raw_value ?? sourcePerf.value;

			perfQueries.insert.run(
				repoId,
				sourcePerf.branch,
				sourcePerf.hash,
				targetMetricId,
				sourcePerf.value,
				rawValue,
				measuredAt
			);
			stats.inserted++;
		} catch ( error ) {
			console.error( `  Error inserting perf record: ${ error.message }` );
			stats.errors++;
		}
	}

	return stats;
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function migrate() {
	const { projectId, owner, name, dryRun } = parseArgs();

	console.log( '=' .repeat( 60 ) );
	console.log( 'CodeVitals Legacy -> CodeVitals Migration' );
	console.log( '=' .repeat( 60 ) );
	console.log( `Source: CodeVitals project_id = ${ projectId }` );
	console.log( `Target: CodeVitals repo = ${ owner }/${ name }` );
	console.log( `Mode: ${ dryRun ? 'DRY RUN (no changes)' : 'LIVE' }` );
	console.log( '=' .repeat( 60 ) );

	let mysqlConnection;

	try {
		// Connect to CodeVitals
		console.log( '\n[1/5] Connecting to CodeVitals (PlanetScale)...' );
		mysqlConnection = await connectToCodeVitals();
		console.log( 'Connected successfully' );

		// Fetch source data
		console.log( '\n[2/5] Fetching data from CodeVitals...' );
		const { project, metrics, perfs } = await fetchCodeVitalsData(
			mysqlConnection,
			projectId
		);
		console.log( `Found project: ${ project.name } (slug: ${ project.slug })` );
		console.log( `Found ${ metrics.length } metrics and ${ perfs.length } perf records` );

		// Find or create target repository
		console.log( '\n[3/5] Setting up target repository...' );
		const repo = findOrCreateRepository( owner, name, project.name, dryRun );

		if ( dryRun && repo.isPlaceholder ) {
			console.log( 'Note: Using placeholder IDs for dry run' );
		}

		// Migrate token
		let tokenMigrated = false;
		if ( project.token ) {
			if ( dryRun ) {
				console.log( `[DRY-RUN] Would set metrics_token from CodeVitals` );
				tokenMigrated = true;
			} else {
				repoQueries.updateMetricsToken.run( project.token, repo.id );
				console.log( `Set metrics_token from CodeVitals project` );
				tokenMigrated = true;
			}
		} else {
			console.log( 'Note: No token found in CodeVitals project' );
		}

		// Migrate metrics
		console.log( '\n[4/5] Migrating metrics...' );
		const { idMapping, stats: metricStats } = migrateMetrics(
			repo.id,
			metrics,
			dryRun
		);
		console.log(
			`Metrics: ${ metricStats.created } created, ${ metricStats.skipped } existing`
		);

		// Migrate perf data (wrap in transaction for atomicity)
		console.log( '\n[5/5] Migrating performance data...' );

		let perfStats;
		if ( dryRun ) {
			perfStats = migratePerf( repo.id, perfs, idMapping, true );
		} else {
			const runMigration = db.transaction( () => {
				return migratePerf( repo.id, perfs, idMapping, false );
			} );
			perfStats = runMigration();
		}

		console.log(
			`Perf records: ${ perfStats.inserted } inserted, ${ perfStats.skipped } duplicates, ${ perfStats.errors } errors`
		);

		// Summary
		console.log( '\n' + '=' .repeat( 60 ) );
		console.log( 'Migration Summary' );
		console.log( '=' .repeat( 60 ) );
		console.log( `Source project: ${ project.name } (id: ${ projectId })` );
		console.log( `Target repository: ${ owner }/${ name }` );
		console.log( `Token: ${ tokenMigrated ? 'migrated' : 'not found in source' }` );
		console.log(
			`Metrics: ${ metricStats.created } new, ${ metricStats.skipped } existing`
		);
		console.log(
			`Perf records: ${ perfStats.inserted } inserted, ${ perfStats.skipped } duplicates`
		);

		if ( dryRun ) {
			console.log(
				'\n[DRY RUN] No changes were made. Run without --dry-run to execute.'
			);
		} else {
			console.log( '\nMigration completed successfully!' );
		}
	} catch ( error ) {
		console.error( '\nMigration failed:', error.message );
		if ( error.stack ) {
			console.error( error.stack );
		}
		process.exit( 1 );
	} finally {
		if ( mysqlConnection ) {
			await mysqlConnection.end();
		}
	}
}

migrate();
