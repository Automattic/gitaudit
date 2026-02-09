#!/usr/bin/env node
/**
 * Test Database Seeding Script
 *
 * Seeds the SQLite database with realistic test data for local development.
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

import db, { initializeDatabase } from '../db/database.js';
import {
	userQueries,
	repoQueries,
	issueQueries,
	prQueries,
	analysisQueries,
	prAnalysisQueries,
	metricsQueries,
	perfQueries,
} from '../db/queries.js';

import {
	testUser,
	testRepositories,
	testIssues,
	testPullRequests,
	metricDefinitions,
	generatePerfData,
	daysAgo,
	toSqliteDate,
} from './seed/data.js';

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
	const tables = [
		'perf',
		'metrics',
		'pr_analysis',
		'pr_comments',
		'pull_requests',
		'issue_analysis',
		'issue_comments',
		'issues',
		'repo_settings',
		'job_queue',
		'user_repositories',
		'repositories',
		'users',
	];

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

function seedUsers(dryRun) {
	if (dryRun) {
		console.log(`  [DRY-RUN] Would create user: ${testUser.username}`);
		return { id: -1, ...testUser };
	}

	// Check if user already exists
	const existing = userQueries.findByGithubId.get(testUser.github_id);
	if (existing) {
		console.log(`  User already exists: ${testUser.username} (id: ${existing.id})`);
		return existing;
	}

	const user = userQueries.create.get(testUser.github_id, testUser.username, testUser.access_token);
	console.log(`  Created user: ${testUser.username} (id: ${user.id})`);
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

		// Link to user
		repoQueries.addUserRepo.run(userId, repo.id);

		// Mark as completed so it appears ready in the UI
		repoQueries.updateStatus.run('completed', repo.id);

		console.log(`  Created repo: ${repoData.owner}/${repoData.name} (id: ${repo.id})`);
		repos.push(repo);
	}

	return repos;
}

// ============================================================================
// Seed Issues
// ============================================================================

function seedIssues(repos, dryRun) {
	const issues = [];
	const githubRepo = repos.find((r) => r.is_github === 1 || r.is_github === true);

	if (!githubRepo) {
		console.log('  No GitHub repo found, skipping issues');
		return issues;
	}

	let githubIdCounter = 1000000;

	for (const issueData of testIssues) {
		if (dryRun) {
			console.log(`  [DRY-RUN] Would create issue #${issueData.number}: ${issueData.title.substring(0, 50)}...`);
			issues.push({ id: issues.length + 1, ...issueData });
			continue;
		}

		const createdAt = daysAgo(issueData.daysOld);
		const updatedAt = daysAgo(issueData.daysSinceUpdate);
		const closedAt = issueData.state === 'closed' && issueData.daysClosed ? daysAgo(issueData.daysClosed) : null;

		const issue = issueQueries.upsert.get(
			githubRepo.id,
			githubIdCounter++,
			issueData.number,
			issueData.title,
			issueData.body,
			issueData.state,
			JSON.stringify(issueData.labels),
			toSqliteDate(createdAt),
			toSqliteDate(updatedAt),
			closedAt ? toSqliteDate(closedAt) : null,
			issueData.comments_count,
			issueData.comments_count > 0 ? toSqliteDate(daysAgo(issueData.daysSinceUpdate + 1)) : null,
			issueData.comments_count > 0 ? 'commenter' : null,
			JSON.stringify(issueData.reactions || {}),
			JSON.stringify(issueData.assignees || []),
			issueData.milestone || null,
			issueData.issue_type || null,
			issueData.author_login,
			issueData.author_association
		);

		issues.push(issue);
	}

	console.log(`  Created ${issues.length} issues`);
	return issues;
}

// ============================================================================
// Seed Pull Requests
// ============================================================================

function seedPullRequests(repos, dryRun) {
	const prs = [];
	const githubRepo = repos.find((r) => r.is_github === 1 || r.is_github === true);

	if (!githubRepo) {
		console.log('  No GitHub repo found, skipping PRs');
		return prs;
	}

	let githubIdCounter = 2000000;

	for (const prData of testPullRequests) {
		if (dryRun) {
			console.log(`  [DRY-RUN] Would create PR #${prData.number}: ${prData.title.substring(0, 50)}...`);
			prs.push({ id: prs.length + 1, ...prData });
			continue;
		}

		const createdAt = daysAgo(prData.daysOld);
		const updatedAt = daysAgo(prData.daysSinceUpdate);
		const closedAt = prData.state === 'closed' ? daysAgo(prData.daysSinceUpdate) : null;
		const mergedAt = prData.merged && prData.daysMerged ? daysAgo(prData.daysMerged) : null;

		const pr = prQueries.upsert.get(
			githubRepo.id,
			githubIdCounter++,
			prData.number,
			prData.title,
			prData.body,
			prData.state,
			prData.draft ? 1 : 0,
			JSON.stringify(prData.labels),
			toSqliteDate(createdAt),
			toSqliteDate(updatedAt),
			closedAt ? toSqliteDate(closedAt) : null,
			mergedAt ? toSqliteDate(mergedAt) : null,
			prData.comments_count,
			prData.comments_count > 0 ? toSqliteDate(daysAgo(prData.daysSinceUpdate + 1)) : null,
			prData.comments_count > 0 ? 'reviewer' : null,
			JSON.stringify(prData.reactions || {}),
			JSON.stringify(prData.assignees || []),
			JSON.stringify(prData.reviewers || []),
			prData.review_decision,
			prData.mergeable_state,
			prData.additions,
			prData.deletions,
			prData.changed_files,
			prData.author_login,
			prData.author_association,
			prData.head_ref_name,
			prData.base_ref_name
		);

		prs.push(pr);
	}

	console.log(`  Created ${prs.length} pull requests`);
	return prs;
}

// ============================================================================
// Seed Analysis Results
// ============================================================================

function seedAnalysis(issues, prs, dryRun) {
	if (dryRun) {
		console.log(`  [DRY-RUN] Would create analysis for ${issues.length} issues and ${prs.length} PRs`);
		return;
	}

	let issueAnalysisCount = 0;
	let prAnalysisCount = 0;

	// Generate analysis for each issue (bugs, stale, features, community)
	const analysisTypes = ['bugs', 'stale', 'features', 'community'];

	for (const issue of issues) {
		if (!issue.id || issue.id < 0) continue;

		for (const type of analysisTypes) {
			// Generate a score based on the issue characteristics
			const score = generateIssueScore(issue, type);

			analysisQueries.upsert.run(
				issue.id,
				type,
				score,
				JSON.stringify({
					generatedAt: new Date().toISOString(),
					type: 'seed-data',
				})
			);
			issueAnalysisCount++;
		}
	}

	// Generate stale analysis for PRs
	for (const pr of prs) {
		if (!pr.id || pr.id < 0) continue;

		const score = generatePRStaleScore(pr);

		prAnalysisQueries.upsert.run(
			pr.id,
			'stale-prs',
			score,
			JSON.stringify({
				generatedAt: new Date().toISOString(),
				type: 'seed-data',
			})
		);
		prAnalysisCount++;
	}

	console.log(`  Created ${issueAnalysisCount} issue analyses and ${prAnalysisCount} PR analyses`);
}

function generateIssueScore(issue, type) {
	// Simple scoring based on issue characteristics
	let score = 50; // Base score

	const labels = issue.labels ? JSON.parse(issue.labels) : [];
	const reactions = issue.reactions ? JSON.parse(issue.reactions) : {};
	const reactionsTotal = reactions.total || 0;

	if (type === 'bugs') {
		if (labels.some((l) => ['critical', 'p0', 'security'].includes(l.toLowerCase()))) score += 40;
		if (labels.some((l) => ['high priority'].includes(l.toLowerCase()))) score += 20;
		if (labels.some((l) => ['low priority'].includes(l.toLowerCase()))) score -= 20;
		if (reactionsTotal > 50) score += 30;
		else if (reactionsTotal > 10) score += 15;
		if (issue.comments_count > 20) score += 20;
		if (issue.assignees && JSON.parse(issue.assignees).length > 0) score += 10;
	} else if (type === 'stale') {
		const daysSinceUpdate = issue.daysSinceUpdate || 0;
		if (daysSinceUpdate > 365) score += 40;
		else if (daysSinceUpdate > 180) score += 30;
		else if (daysSinceUpdate > 90) score += 20;
		else if (daysSinceUpdate > 30) score += 10;
		else score = 0;

		if (labels.some((l) => l.toLowerCase().includes('waiting'))) score += 15;
		if (issue.comments_count === 0) score += 20;
	} else if (type === 'features') {
		if (reactionsTotal > 100) score += 40;
		else if (reactionsTotal > 50) score += 25;
		else if (reactionsTotal > 10) score += 10;
		if (issue.body && issue.body.length > 500) score += 15;
		if (issue.body && issue.body.length < 100) score -= 20;
		if (labels.some((l) => ['wontfix', 'rejected'].includes(l.toLowerCase()))) score -= 30;
	} else if (type === 'community') {
		if (issue.author_association === 'FIRST_TIME_CONTRIBUTOR') score += 20;
		if (labels.some((l) => ['good first issue', 'help wanted'].includes(l.toLowerCase()))) score += 15;
		if (issue.comments_count > 5) score += 10;
	}

	return Math.max(0, Math.min(100, score));
}

function generatePRStaleScore(pr) {
	let score = 0;

	const daysSinceUpdate = pr.daysSinceUpdate || 0;

	// Age-based scoring
	if (daysSinceUpdate > 180) score += 40;
	else if (daysSinceUpdate > 90) score += 30;
	else if (daysSinceUpdate > 60) score += 20;
	else if (daysSinceUpdate > 30) score += 10;

	// Review state
	if (pr.review_decision === 'CHANGES_REQUESTED') score += 25;
	if (pr.mergeable_state === 'CONFLICTING') score += 20;

	// Draft penalty (less urgent)
	if (pr.draft) score -= 15;

	// External contributor bonus (should get attention)
	if (pr.author_association === 'FIRST_TIME_CONTRIBUTOR') score += 10;

	return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Seed Performance Metrics
// ============================================================================

function seedMetrics(repos, dryRun) {
	// Use the GitHub repo (WordPress/gutenberg) for metrics so they're visible when testing
	const metricsRepo = repos.find((r) => r.is_github === 1 || r.is_github === true) || repos[0];
	const metrics = [];
	const perfData = [];

	if (dryRun) {
		console.log(`  [DRY-RUN] Would create ${metricDefinitions.length} metrics with 60 days of data each`);
		return { metrics: [], perfData: [] };
	}

	for (const metricDef of metricDefinitions) {
		// Check if metric already exists
		const existing = metricsQueries.findByRepoIdAndKey.get(metricsRepo.id, metricDef.key);
		let metric;

		if (existing) {
			console.log(`  Metric already exists: ${metricDef.key} (id: ${existing.id})`);
			metric = existing;
		} else {
			metric = metricsQueries.insert.get(
				metricsRepo.id,
				metricDef.key,
				metricDef.name,
				metricDef.unit || null,
				metricDef.priority,
				metricDef.default_visible ? 1 : 0
			);
			console.log(`  Created metric: ${metricDef.key} (id: ${metric.id})`);
		}

		metrics.push(metric);

		// Generate perf data for this metric
		const dataPoints = generatePerfData(metric.id, metricDef.key, metricsRepo.id, 'trunk', 60);

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

		perfData.push(...dataPoints);
	}

	console.log(`  Created ${metrics.length} metrics with ${perfData.length} data points`);
	return { metrics, perfData };
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
		console.log('\n[1/6] Clearing existing data...');
		clearDatabase(dryRun);
	} else {
		console.log('\n[1/6] Skipping clear (no --reset flag)');
	}

	// Define seeding function
	const doSeed = () => {
		console.log('\n[2/6] Seeding users...');
		const user = seedUsers(dryRun);

		console.log('\n[3/6] Seeding repositories...');
		const repos = seedRepositories(user.id, dryRun);

		console.log('\n[4/6] Seeding issues...');
		const issues = seedIssues(repos, dryRun);

		console.log('\n[5/6] Seeding pull requests...');
		const prs = seedPullRequests(repos, dryRun);

		console.log('\n[6/6] Seeding analysis and metrics...');
		seedAnalysis(issues, prs, dryRun);
		const { metrics, perfData } = seedMetrics(repos, dryRun);

		return { user, repos, issues, prs, metrics, perfData };
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
		console.log(`  Users: 1`);
		console.log(`  Repositories: ${result.repos.length}`);
		console.log(`  Issues: ${result.issues.length}`);
		console.log(`  Pull Requests: ${result.prs.length}`);
		console.log(`  Metrics: ${result.metrics.length}`);
		console.log(`  Perf Data Points: ${result.perfData.length}`);
		console.log('\nYou can now start the server and view the test data.');
	}
}

main();
