#!/usr/bin/env node
/**
 * Test Database Seeding Script
 *
 * Seeds the SQLite database with realistic test data for local development,
 * then prints a sign-in link, since the test user can't sign in through GitHub.
 *
 * Usage:
 *   node server/src/scripts/seed-test-data.js [--reset] [--dry-run]
 *
 * Options:
 *   --reset    Clear existing data before seeding
 *   --dry-run  Preview data without modifying database
 *
 * Examples:
 *   npm run seed                        # Add test data
 *   npm run seed:reset                  # Clear and re-seed
 *   npm run seed:reset -- --dry-run     # Preview reset + seed
 */

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import db, { initializeDatabase } from '../db/database.js';
import { userQueries, repoQueries, metricsQueries, perfQueries } from '../db/queries.js';

import {
	testUser,
	testCollaborator,
	testRepositories,
	metricDefinitions,
	generatePerfData,
} from './seed/data.js';

// The test user's token is fake, so its roles must never be refreshed from
// GitHub: the refresh would fail and remove the user from their repositories.
const NEVER_STALE = '2099-01-01T00:00:00.000Z';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
Usage: node seed-test-data.js [--reset] [--dry-run]

Options:
  --reset    Clear existing data before seeding
  --dry-run  Preview changes without modifying the database
  --help     Show this help message

Examples:
  node server/src/scripts/seed-test-data.js
  node server/src/scripts/seed-test-data.js --reset
  node server/src/scripts/seed-test-data.js --reset --dry-run
`);
		process.exit(0);
	}

	return {
		reset: args.includes('--reset'),
		dryRun: args.includes('--dry-run'),
	};
}

// ============================================================================
// Clear Database (for --reset)
// ============================================================================

function clearDatabase(dryRun) {
	// Delete in FK-safe order (children before parents)
	const tables = ['perf', 'metrics', 'user_repositories', 'repositories', 'users'];

	if (dryRun) {
		console.log('  [DRY-RUN] Would clear tables:', tables.join(', '));
		return;
	}

	for (const table of tables) {
		db.exec(`DELETE FROM ${table}`);
	}
	console.log('  Cleared all tables');
}

// ============================================================================
// Seed Users
// ============================================================================

function seedUser(userData, dryRun) {
	if (dryRun) {
		console.log(`  [DRY-RUN] Would create user: ${userData.username}`);
		return { id: -1, ...userData };
	}

	// Check if user already exists
	const existing = userQueries.findByGithubId.get(userData.github_id);
	if (existing) {
		console.log(`  User already exists: ${userData.username} (id: ${existing.id})`);
		return existing;
	}

	const user = userQueries.create.get(userData.github_id, userData.username, userData.access_token, null, null);
	console.log(`  Created user: ${userData.username} (id: ${user.id})`);
	return user;
}

// ============================================================================
// Seed Repositories
// ============================================================================

function seedRepositories(userId, dryRun) {
	const repos = [];

	for (const repoData of testRepositories) {
		if (dryRun) {
			console.log(`  [DRY-RUN] Would create repo: ${repoData.owner}/${repoData.name}`);
			repos.push({ id: repos.length + 1, ...repoData });
			continue;
		}

		// Check if repo already exists
		const existing = repoQueries.findByOwnerAndName.get(repoData.owner, repoData.name);
		if (existing) {
			console.log(`  Repo already exists: ${repoData.owner}/${repoData.name} (id: ${existing.id})`);
			repos.push(existing);
			continue;
		}

		let repo;
		if (repoData.is_github) {
			// GitHub repository
			repo = repoQueries.saveRepo.get(
				repoData.owner,
				repoData.name,
				repoData.github_id,
				repoData.description,
				repoData.stars,
				repoData.language,
				repoData.language_color,
				new Date().toISOString(),
				repoData.is_private ? 1 : 0
			);
		} else {
			// Local/non-GitHub repository
			repo = repoQueries.createLocalRepo.get(
				repoData.owner,
				repoData.name,
				repoData.description,
				repoData.url || null
			);
		}

		// Link to user as admin, so every settings screen can be tested
		repoQueries.addUserRepoWithRole.run(userId, repo.id, 'admin', repoData.is_github ? NEVER_STALE : null);

		repoQueries.updateMetricsToken.run(repoData.metrics_token, repo.id);
		repoQueries.updateMetricsPublic.run(repoData.metrics_public ? 1 : 0, repo.id);

		console.log(`  Created repo: ${repoData.owner}/${repoData.name} (id: ${repo.id})`);
		repos.push(repo);
	}

	return repos;
}

// ============================================================================
// Seed Performance Metrics
// ============================================================================

function seedMetrics(repo, dryRun) {
	if (dryRun) {
		console.log(`  [DRY-RUN] Would create ${metricDefinitions.length} metrics with data for ${repo.owner}/${repo.name}`);
		return { metrics: [], pointCount: 0 };
	}

	const metrics = [];
	let pointCount = 0;

	for (const metricDef of metricDefinitions) {
		// Check if metric already exists
		const existing = metricsQueries.findByRepoIdAndKey.get(repo.id, metricDef.key);

		if (existing) {
			console.log(`  Metric already exists: ${metricDef.key} (id: ${existing.id})`);
			metrics.push(existing);
			continue;
		}

		const metric = metricsQueries.insert.get(
			repo.id,
			metricDef.key,
			metricDef.name,
			metricDef.unit || null,
			metricDef.priority,
			metricDef.default_visible ? 1 : 0,
			metricDef.min_regression_delta || 0
		);
		metrics.push(metric);

		// Generate perf data for this metric
		const dataPoints = generatePerfData(metric.id, metricDef.key, repo.id);

		for (const point of dataPoints) {
			perfQueries.insert.run(
				point.repo_id,
				point.branch,
				point.hash,
				point.metric_id,
				point.value,
				point.raw_value,
				point.measured_at
			);
		}

		pointCount += dataPoints.length;
	}

	console.log(`  ${repo.owner}/${repo.name}: ${metrics.length} metrics, ${pointCount} new data points`);
	return { metrics, pointCount };
}

// ============================================================================
// Local Sign-in
// ============================================================================

function printSignInLink() {
	const secret = process.env.SESSION_SECRET;

	if (!secret) {
		console.log('\nSet SESSION_SECRET in server/.env and run this again to get a sign-in link.');
		return;
	}

	const token = jwt.sign({ githubId: testUser.github_id, username: testUser.username }, secret, {
		expiresIn: '30d',
	});
	const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

	console.log('\nSign in as the test user with this link (valid for 30 days):');
	console.log(`  ${clientUrl}/auth/callback?token=${token}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	const { reset, dryRun } = parseArgs();

	console.log('='.repeat(60));
	console.log('CodeVitals Test Database Seeding');
	console.log('='.repeat(60));
	console.log(`Mode: ${dryRun ? 'DRY RUN' : reset ? 'RESET + SEED' : 'SEED'}`);
	console.log('='.repeat(60));

	// Ensure schema exists
	initializeDatabase();

	// Reset if requested
	if (reset) {
		console.log('\n[1/4] Clearing existing data...');
		clearDatabase(dryRun);
	} else {
		console.log('\n[1/4] Skipping clear (no --reset flag)');
	}

	// Define seeding function
	const doSeed = () => {
		console.log('\n[2/4] Seeding users...');
		const user = seedUser(testUser, dryRun);
		seedUser(testCollaborator, dryRun);

		console.log('\n[3/4] Seeding repositories...');
		const repos = seedRepositories(user.id, dryRun);

		console.log('\n[4/4] Seeding metrics...');
		const seeded = repos.map((repo) => seedMetrics(repo, dryRun));

		return {
			repos,
			metricCount: seeded.reduce((total, { metrics }) => total + metrics.length, 0),
			pointCount: seeded.reduce((total, { pointCount }) => total + pointCount, 0),
		};
	};

	if (dryRun) {
		// In dry-run mode, just show what would happen (no transaction needed)
		doSeed();
		console.log('\n[DRY RUN] No changes were made. Run without --dry-run to execute.');
	} else {
		// Wrap in transaction for atomicity
		const runSeed = db.transaction(doSeed);
		const result = runSeed();

		console.log('\n' + '='.repeat(60));
		console.log('Seeding Complete!');
		console.log('='.repeat(60));
		console.log(`  Repositories: ${result.repos.length}`);
		console.log(`  Metrics: ${result.metricCount}`);
		console.log(`  New Data Points: ${result.pointCount}`);

		printSignInLink();
	}
}

main();
