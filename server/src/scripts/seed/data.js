/**
 * Test data definitions for database seeding
 *
 * This file contains the test repositories and metrics, with enough history
 * to exercise regression detection and downsampling in the charts.
 */

// ============================================================================
// Date Utilities
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysAgo(days) {
	return new Date(Date.now() - days * MS_PER_DAY);
}

export function toSqliteDate(date) {
	return date.toISOString().replace('T', ' ').split('.')[0];
}

function generateCommitHash() {
	const chars = '0123456789abcdef';
	let hash = '';
	for (let i = 0; i < 40; i++) {
		hash += chars[Math.floor(Math.random() * chars.length)];
	}
	return hash;
}

// ============================================================================
// Test User
// ============================================================================

export const testUser = {
	github_id: 12345678,
	username: 'testdev',
	access_token: 'gho_test_token_for_local_development_only',
};

// Has no repositories of its own, so it can be added as a collaborator
export const testCollaborator = {
	github_id: 87654321,
	username: 'testcollaborator',
	access_token: 'gho_test_token_for_local_development_only',
};

// ============================================================================
// Test Repositories
// ============================================================================

export const testRepositories = [
	{
		owner: 'WordPress',
		name: 'gutenberg',
		github_id: 70107786,
		description: 'The Block Editor project for WordPress and beyond.',
		stars: 10500,
		language: 'JavaScript',
		language_color: '#f1e05a',
		is_private: false,
		is_github: true,
		metrics_public: true,
		metrics_token: 'local-dev-gutenberg-token',
	},
	{
		owner: 'testdev',
		name: 'internal-tools',
		description: 'A custom repository that is not on GitHub.',
		url: 'https://git.example.com/internal-tools',
		is_github: false,
		metrics_public: false,
		metrics_token: 'local-dev-internal-tools-token',
	},
];

// ============================================================================
// Performance Metrics Definitions
// ============================================================================

export const metricDefinitions = [
	{ key: 'lcp', name: 'Largest Contentful Paint', unit: 'ms', priority: 100, default_visible: true },
	{ key: 'fcp', name: 'First Contentful Paint', unit: 'ms', priority: 90, default_visible: true },
	{ key: 'cls', name: 'Cumulative Layout Shift', unit: '', priority: 80, default_visible: true },
	{ key: 'fid', name: 'First Input Delay', unit: 'ms', priority: 70, default_visible: true },
	{ key: 'ttfb', name: 'Time to First Byte', unit: 'ms', priority: 60, default_visible: true },
	{ key: 'bundle_size', name: 'Bundle Size', unit: 'KB', priority: 50, default_visible: true },
	{ key: 'test_duration', name: 'Test Suite Duration', unit: 's', priority: 40, default_visible: false },
	{ key: 'test_coverage', name: 'Test Coverage', unit: '%', priority: 35, default_visible: true },
	{ key: 'perf_score', name: 'Performance Score', unit: '/100', priority: 30, default_visible: false },
];

// Base values for each metric (realistic production values)
const metricBaseValues = {
	lcp: 2500, // 2.5s - "needs improvement" threshold
	fcp: 1800, // 1.8s
	cls: 0.1, // Good threshold
	fid: 100, // 100ms
	ttfb: 600, // 600ms
	bundle_size: 350 * 1024, // 350KB, stored in bytes like real byte-scale metrics
	test_duration: 45, // 45 seconds
	test_coverage: 85, // 85%
	perf_score: 90, // 90/100
};

const HISTORY_DAYS = 60;

// Seeded random for reproducible data (simple LCG)
function seededRandom(seed) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		return (s >>> 0) / 0xffffffff;
	};
}

/**
 * Generate deterministic performance data with clear regression patterns.
 *
 * Each metric gets a unique pattern based on its key so the dashboard
 * doesn't look identical across metrics. The patterns include:
 *   - Stable baselines
 *   - Sharp regressions (>15% change, well above the 10% detection threshold)
 *   - Recovery after regression
 *   - Gradual degradation (small changes that don't individually trigger detection)
 *   - A second regression later in the series
 *
 * The points are spread evenly over HISTORY_DAYS. More than 400 of them makes
 * the "All" chart view downsample, the way a real repository's history does.
 */
export function generatePerfData(metricId, metricKey, repoId, branch = 'trunk', dataPoints = 600) {
	const baseValue = metricBaseValues[metricKey] || 100;

	// Use metric key as seed for reproducible per-metric variation
	let seed = 0;
	for (let i = 0; i < metricKey.length; i++) {
		seed = seed * 31 + metricKey.charCodeAt(i);
	}
	const rand = seededRandom(seed);

	// Build a multiplier curve. Lower is always better:
	// multiplier > 1 = worse (regression), multiplier < 1 = better (improvement).
	const multipliers = [];
	for (let i = 0; i < dataPoints; i++) {
		const noise = (rand() - 0.5) * 0.04; // ±2% jitter
		let m = 1.0 + noise;

		// Position in the 60-step pattern below, however many points there are
		const step = (i * 60) / dataPoints;

		if (step >= 10 && step <= 12) {
			// First regression: sharp spike
			m = 1.20 + noise;
		} else if (step >= 13 && step <= 16) {
			// Recovery: gradually return to baseline
			const recovery = (step - 12) / 4;
			m = 1.20 - recovery * 0.20 + noise;
		} else if (step >= 20 && step <= 22) {
			// Improvement: sharp drop
			m = 0.80 + noise;
		} else if (step >= 23 && step <= 24) {
			// Drift back to baseline after improvement
			m = 0.92 + noise;
		} else if (step >= 25 && step <= 35) {
			// Gradual degradation: ~1-2% per point (won't trigger 10% threshold individually)
			const drift = (step - 24) * 0.015;
			m = 1.0 + drift + noise;
		} else if (step >= 40 && step <= 42) {
			// Second regression: another sharp spike
			m = 1.25 + noise;
		} else if (step >= 43 && step <= 48) {
			// Partial recovery: stays slightly elevated
			m = 1.08 + noise;
		} else if (step >= 50 && step <= 52) {
			// Second improvement: optimization lands
			m = 0.82 + noise;
		}
		// All other points stay near baseline (m ≈ 1.0)

		multipliers.push(m);
	}

	const data = [];
	for (let i = 0; i < dataPoints; i++) {
		const measuredAt = daysAgo(((dataPoints - 1 - i) * HISTORY_DAYS) / dataPoints);
		const value = Math.max(0, baseValue * multipliers[i]);

		data.push({
			repo_id: repoId,
			branch,
			hash: generateCommitHash(),
			metric_id: metricId,
			value: Math.round(value * 100) / 100,
			raw_value: Math.round(value * 100) / 100,
			measured_at: toSqliteDate(measuredAt),
		});
	}

	return data;
}
