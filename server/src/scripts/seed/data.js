/**
 * Test data definitions for database seeding
 *
 * This file contains all the test data with varied characteristics
 * to exercise all scoring algorithms and UI states.
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

function randomBetween(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
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
	},
];

// ============================================================================
// Test Issues - Varied to test all scoring paths
// ============================================================================

export const testIssues = [
	// ==================== CRITICAL BUGS (score 120+) ====================
	{
		number: 101,
		title: '[Bug] Critical security vulnerability in authentication',
		body: `## Description
A critical security vulnerability has been discovered in the authentication flow that allows unauthorized access.

## Steps to Reproduce
1. Navigate to login page
2. Enter malformed credentials
3. Bypass authentication

## Impact
This is a critical security issue affecting all users.

## Environment
- Version: 2.0.0
- Browser: All
- OS: All`,
		state: 'open',
		labels: ['bug', 'critical', 'security', 'p0'],
		daysOld: 3,
		daysSinceUpdate: 1,
		comments_count: 28,
		reactions: { total: 67, '+1': 50, '-1': 0, heart: 12, rocket: 5 },
		assignees: ['senior-dev', 'security-lead'],
		milestone: 'v2.0.1-hotfix',
		issue_type: 'Bug',
		author_login: 'security-researcher',
		author_association: 'CONTRIBUTOR',
	},
	{
		number: 102,
		title: '[Bug] Data corruption when saving large files',
		body: `Files over 100MB are being corrupted during save operations. This is causing data loss for users.

Logs show truncation errors in the file handler.`,
		state: 'open',
		labels: ['bug', 'critical', 'data-loss'],
		daysOld: 7,
		daysSinceUpdate: 2,
		comments_count: 45,
		reactions: { total: 89, '+1': 72, '-1': 0, heart: 10, rocket: 7 },
		assignees: ['backend-lead'],
		milestone: 'v2.0.1-hotfix',
		issue_type: 'Bug',
		author_login: 'enterprise-user',
		author_association: 'NONE',
	},

	// ==================== HIGH PRIORITY BUGS (score 80-119) ====================
	{
		number: 103,
		title: '[Bug] Performance regression in API response times',
		body: `API response times have increased by 300% since the last release.

## Metrics
- Before: 50ms average
- After: 200ms average

This is affecting user experience significantly.`,
		state: 'open',
		labels: ['bug', 'performance', 'high priority'],
		daysOld: 12,
		daysSinceUpdate: 3,
		comments_count: 12,
		reactions: { total: 18, '+1': 15, '-1': 0, heart: 3 },
		assignees: ['perf-engineer'],
		milestone: 'v2.1.0',
		issue_type: 'Bug',
		author_login: 'monitoring-bot',
		author_association: 'MEMBER',
	},
	{
		number: 104,
		title: '[Bug] Memory leak in dashboard component',
		body: `The dashboard component is leaking memory when switching between views. After 30 minutes of use, the browser tab consumes 2GB+ RAM.`,
		state: 'open',
		labels: ['bug', 'memory', 'frontend'],
		daysOld: 20,
		daysSinceUpdate: 5,
		comments_count: 8,
		reactions: { total: 12, '+1': 10, '-1': 0, heart: 2 },
		assignees: ['frontend-dev'],
		milestone: null,
		issue_type: 'Bug',
		author_login: 'qa-engineer',
		author_association: 'MEMBER',
	},

	// ==================== MEDIUM PRIORITY BUGS (score 50-79) ====================
	{
		number: 105,
		title: '[Bug] UI glitch on mobile Safari',
		body: `The sidebar menu doesn't close properly on iOS Safari when tapping outside.`,
		state: 'open',
		labels: ['bug', 'ui', 'mobile', 'ios'],
		daysOld: 35,
		daysSinceUpdate: 15,
		comments_count: 4,
		reactions: { total: 5, '+1': 4, '-1': 0, heart: 1 },
		assignees: [],
		milestone: null,
		issue_type: 'Bug',
		author_login: 'mobile-user',
		author_association: 'NONE',
	},
	{
		number: 106,
		title: '[Bug] Chart tooltips cut off at screen edge',
		body: `When hovering over data points near the edge of the screen, the tooltip is partially hidden.`,
		state: 'open',
		labels: ['bug', 'ui', 'charts'],
		daysOld: 45,
		daysSinceUpdate: 20,
		comments_count: 3,
		reactions: { total: 3, '+1': 3 },
		assignees: [],
		milestone: 'backlog',
		issue_type: 'Bug',
		author_login: 'data-analyst',
		author_association: 'NONE',
	},

	// ==================== LOW PRIORITY BUGS (score < 50) ====================
	{
		number: 107,
		title: '[Bug] Typo in error message',
		body: `The error message says "Unauthroized" instead of "Unauthorized".`,
		state: 'open',
		labels: ['bug', 'low priority', 'good first issue', 'typo'],
		daysOld: 90,
		daysSinceUpdate: 85,
		comments_count: 1,
		reactions: { total: 1, '+1': 1 },
		assignees: [],
		milestone: null,
		issue_type: 'Bug',
		author_login: 'first-timer',
		author_association: 'FIRST_TIME_CONTRIBUTOR',
	},
	{
		number: 108,
		title: '[Bug] Favicon missing on some pages',
		body: `The favicon doesn't show on the settings page.`,
		state: 'open',
		labels: ['bug', 'low priority'],
		daysOld: 120,
		daysSinceUpdate: 110,
		comments_count: 0,
		reactions: { total: 0 },
		assignees: [],
		milestone: null,
		issue_type: 'Bug',
		author_login: 'random-user',
		author_association: 'NONE',
	},

	// ==================== CRITICAL STALE (score 60+) ====================
	{
		number: 109,
		title: 'Issue awaiting response for over a year',
		body: `This issue was reported but never addressed. The original reporter provided all requested information but got no response.`,
		state: 'open',
		labels: ['waiting for response', 'needs more info'],
		daysOld: 420,
		daysSinceUpdate: 400,
		comments_count: 2,
		reactions: { total: 8, '+1': 8 },
		assignees: ['former-employee'],
		milestone: null,
		issue_type: null,
		author_login: 'patient-user',
		author_association: 'NONE',
	},
	{
		number: 110,
		title: 'Never addressed - zero comments',
		body: `This bug report has received zero attention since filing.`,
		state: 'open',
		labels: ['bug', 'triage'],
		daysOld: 380,
		daysSinceUpdate: 380,
		comments_count: 0,
		reactions: { total: 15, '+1': 12, heart: 3 },
		assignees: [],
		milestone: null,
		issue_type: 'Bug',
		author_login: 'ignored-user',
		author_association: 'NONE',
	},

	// ==================== HIGH STALE (with engagement) ====================
	{
		number: 111,
		title: 'Popular issue that was abandoned',
		body: `A highly upvoted feature request that had significant discussion but was then abandoned.`,
		state: 'open',
		labels: ['enhancement', 'discussion'],
		daysOld: 250,
		daysSinceUpdate: 200,
		comments_count: 42,
		reactions: { total: 156, '+1': 130, heart: 20, rocket: 6 },
		assignees: ['former-pm'],
		milestone: 'v3.0',
		issue_type: null,
		author_login: 'community-voice',
		author_association: 'CONTRIBUTOR',
	},

	// ==================== CRITICAL FEATURE REQUESTS (score 70+) ====================
	{
		number: 112,
		title: '[Feature] Dark mode support',
		body: `## Summary
Add dark mode support to the application.

## Motivation
Dark mode reduces eye strain and saves battery on OLED screens. This has been requested by many users.

## Proposed Solution
- Add a theme toggle in settings
- Support system preference detection
- Persist preference in localStorage

## Additional Context
- Design mockups: [link]
- Similar implementation in competitor: [link]

## Acceptance Criteria
- [ ] Toggle switch in settings
- [ ] Automatic system preference detection
- [ ] All components styled for both modes
- [ ] Smooth transition animation`,
		state: 'open',
		labels: ['enhancement', 'feature request', 'ux', 'accessibility'],
		daysOld: 180,
		daysSinceUpdate: 30,
		comments_count: 89,
		reactions: { total: 234, '+1': 180, heart: 45, rocket: 9 },
		assignees: ['design-lead', 'frontend-lead'],
		milestone: 'v3.0',
		issue_type: null,
		author_login: 'power-user',
		author_association: 'CONTRIBUTOR',
	},
	{
		number: 113,
		title: '[Feature] Export to PDF',
		body: `Allow users to export reports and dashboards to PDF format for sharing with stakeholders who don't have access to the platform.

Key requirements:
- Maintain formatting and charts
- Support custom headers/footers
- Include timestamp and metadata`,
		state: 'open',
		labels: ['enhancement', 'feature request'],
		daysOld: 120,
		daysSinceUpdate: 45,
		comments_count: 34,
		reactions: { total: 78, '+1': 65, heart: 10, rocket: 3 },
		assignees: ['backend-dev'],
		milestone: 'v2.2.0',
		issue_type: null,
		author_login: 'enterprise-admin',
		author_association: 'NONE',
	},

	// ==================== MEDIUM FEATURE REQUESTS ====================
	{
		number: 114,
		title: '[Feature] Keyboard shortcuts',
		body: `Add keyboard shortcuts for common actions like navigation, search, and creating new items.`,
		state: 'open',
		labels: ['enhancement', 'ux'],
		daysOld: 90,
		daysSinceUpdate: 60,
		comments_count: 12,
		reactions: { total: 25, '+1': 20, heart: 5 },
		assignees: [],
		milestone: null,
		issue_type: null,
		author_login: 'keyboard-warrior',
		author_association: 'NONE',
	},

	// ==================== LOW FEATURE REQUESTS (vague/rejected) ====================
	{
		number: 115,
		title: 'Add thing',
		body: `Please add this feature.`,
		state: 'open',
		labels: ['enhancement', 'needs more info'],
		daysOld: 60,
		daysSinceUpdate: 55,
		comments_count: 1,
		reactions: { total: 0 },
		assignees: [],
		milestone: null,
		issue_type: null,
		author_login: 'vague-requester',
		author_association: 'NONE',
	},
	{
		number: 116,
		title: '[Feature] Blockchain integration',
		body: `Add blockchain to make the app more secure and decentralized.`,
		state: 'open',
		labels: ['enhancement', 'wontfix', 'low priority'],
		daysOld: 150,
		daysSinceUpdate: 140,
		comments_count: 5,
		reactions: { total: 2, '-1': 2 },
		assignees: [],
		milestone: null,
		issue_type: null,
		author_login: 'crypto-bro',
		author_association: 'NONE',
	},

	// ==================== COMMUNITY HEALTH TEST CASES ====================
	{
		number: 117,
		title: 'First-time contributor needs help',
		body: `I'm new to open source and would like to contribute. I found this issue but I'm not sure where to start.`,
		state: 'open',
		labels: ['good first issue', 'help wanted'],
		daysOld: 14,
		daysSinceUpdate: 2,
		comments_count: 6,
		reactions: { total: 3, '+1': 2, heart: 1 },
		assignees: [],
		milestone: null,
		issue_type: null,
		author_login: 'new-contributor',
		author_association: 'FIRST_TIME_CONTRIBUTOR',
	},
	{
		number: 118,
		title: 'Great documentation improvement',
		body: `The documentation for the API is excellent but could be improved with more examples.`,
		state: 'open',
		labels: ['documentation', 'enhancement'],
		daysOld: 30,
		daysSinceUpdate: 10,
		comments_count: 8,
		reactions: { total: 15, '+1': 10, heart: 5 },
		assignees: ['docs-maintainer'],
		milestone: 'docs-v2',
		issue_type: null,
		author_login: 'docs-lover',
		author_association: 'MEMBER',
	},

	// ==================== CLOSED ISSUES (for variety) ====================
	{
		number: 119,
		title: '[Bug] Fixed: Login button not working',
		body: `The login button was not responding to clicks.`,
		state: 'closed',
		labels: ['bug'],
		daysOld: 60,
		daysSinceUpdate: 55,
		daysClosed: 55,
		comments_count: 5,
		reactions: { total: 4, '+1': 4 },
		assignees: ['frontend-dev'],
		milestone: 'v2.0.0',
		issue_type: 'Bug',
		author_login: 'bug-reporter',
		author_association: 'NONE',
	},
	{
		number: 120,
		title: '[Feature] Implemented: Search functionality',
		body: `Add search functionality to find items quickly.`,
		state: 'closed',
		labels: ['enhancement', 'feature request'],
		daysOld: 90,
		daysSinceUpdate: 70,
		daysClosed: 70,
		comments_count: 12,
		reactions: { total: 45, '+1': 40, heart: 5 },
		assignees: ['search-engineer'],
		milestone: 'v2.0.0',
		issue_type: null,
		author_login: 'feature-requester',
		author_association: 'CONTRIBUTOR',
	},
];

// ============================================================================
// Test Pull Requests - Varied review states and ages
// ============================================================================

export const testPullRequests = [
	// ==================== CRITICAL STALE PRs ====================
	{
		number: 201,
		title: 'feat: Add user preferences (abandoned)',
		body: `This PR adds user preferences functionality but was abandoned after review feedback.`,
		state: 'open',
		draft: false,
		labels: ['enhancement', 'needs-work'],
		daysOld: 150,
		daysSinceUpdate: 130,
		comments_count: 18,
		reactions: { total: 8, '+1': 6, heart: 2 },
		assignees: ['reviewer1'],
		reviewers: ['senior-dev', 'tech-lead'],
		review_decision: 'CHANGES_REQUESTED',
		mergeable_state: 'CONFLICTING',
		additions: 580,
		deletions: 120,
		changed_files: 18,
		author_login: 'former-intern',
		author_association: 'CONTRIBUTOR',
		head_ref_name: 'feature/user-preferences',
		base_ref_name: 'main',
	},
	{
		number: 202,
		title: 'fix: Memory leak in event listeners',
		body: `Fixes the memory leak issue by properly cleaning up event listeners.

Related: #104`,
		state: 'open',
		draft: false,
		labels: ['bug', 'memory'],
		daysOld: 120,
		daysSinceUpdate: 100,
		comments_count: 12,
		reactions: { total: 5, '+1': 5 },
		assignees: [],
		reviewers: ['frontend-lead'],
		review_decision: 'CHANGES_REQUESTED',
		mergeable_state: 'CONFLICTING',
		additions: 45,
		deletions: 30,
		changed_files: 5,
		author_login: 'external-contributor',
		author_association: 'FIRST_TIME_CONTRIBUTOR',
		head_ref_name: 'fix/memory-leak',
		base_ref_name: 'main',
	},

	// ==================== HIGH STALE PRs ====================
	{
		number: 203,
		title: 'feat: Dashboard redesign',
		body: `Complete redesign of the dashboard UI with improved charts and widgets.`,
		state: 'open',
		draft: false,
		labels: ['enhancement', 'ui'],
		daysOld: 90,
		daysSinceUpdate: 75,
		comments_count: 25,
		reactions: { total: 15, '+1': 12, heart: 3 },
		assignees: ['design-lead'],
		reviewers: ['ux-reviewer', 'frontend-lead'],
		review_decision: 'REVIEW_REQUIRED',
		mergeable_state: 'MERGEABLE',
		additions: 1200,
		deletions: 800,
		changed_files: 35,
		author_login: 'ui-designer',
		author_association: 'MEMBER',
		head_ref_name: 'feature/dashboard-redesign',
		base_ref_name: 'main',
	},

	// ==================== APPROVED BUT NOT MERGED ====================
	{
		number: 204,
		title: 'docs: Update API documentation',
		body: `Updates the API documentation with new endpoints and examples.`,
		state: 'open',
		draft: false,
		labels: ['documentation'],
		daysOld: 45,
		daysSinceUpdate: 40,
		comments_count: 8,
		reactions: { total: 10, '+1': 8, heart: 2 },
		assignees: [],
		reviewers: ['docs-reviewer'],
		review_decision: 'APPROVED',
		mergeable_state: 'MERGEABLE',
		additions: 350,
		deletions: 50,
		changed_files: 12,
		author_login: 'docs-contributor',
		author_association: 'CONTRIBUTOR',
		head_ref_name: 'docs/api-update',
		base_ref_name: 'main',
	},
	{
		number: 205,
		title: 'feat: Add export functionality',
		body: `Implements export to CSV and JSON formats.

Closes #113 (partial)`,
		state: 'open',
		draft: false,
		labels: ['enhancement', 'feature request'],
		daysOld: 30,
		daysSinceUpdate: 25,
		comments_count: 15,
		reactions: { total: 20, '+1': 18, heart: 2 },
		assignees: ['backend-dev'],
		reviewers: ['backend-lead', 'qa-engineer'],
		review_decision: 'APPROVED',
		mergeable_state: 'MERGEABLE',
		additions: 420,
		deletions: 30,
		changed_files: 8,
		author_login: 'feature-dev',
		author_association: 'MEMBER',
		head_ref_name: 'feature/export',
		base_ref_name: 'main',
	},

	// ==================== DRAFT PRs ====================
	{
		number: 206,
		title: 'WIP: New notification system',
		body: `Work in progress - implementing a new notification system.

TODO:
- [ ] Email notifications
- [ ] Push notifications
- [ ] In-app notifications
- [ ] Notification preferences`,
		state: 'open',
		draft: true,
		labels: ['wip', 'enhancement'],
		daysOld: 35,
		daysSinceUpdate: 10,
		comments_count: 5,
		reactions: { total: 3, '+1': 3 },
		assignees: ['notifications-dev'],
		reviewers: [],
		review_decision: null,
		mergeable_state: 'UNKNOWN',
		additions: 890,
		deletions: 50,
		changed_files: 22,
		author_login: 'senior-dev',
		author_association: 'MEMBER',
		head_ref_name: 'feature/notifications',
		base_ref_name: 'main',
	},
	{
		number: 207,
		title: 'Draft: Experimental caching layer',
		body: `Exploring different caching strategies. Not ready for review.`,
		state: 'open',
		draft: true,
		labels: ['experiment', 'performance'],
		daysOld: 60,
		daysSinceUpdate: 55,
		comments_count: 2,
		reactions: { total: 1, '+1': 1 },
		assignees: [],
		reviewers: [],
		review_decision: null,
		mergeable_state: 'MERGEABLE',
		additions: 300,
		deletions: 20,
		changed_files: 6,
		author_login: 'perf-engineer',
		author_association: 'MEMBER',
		head_ref_name: 'experiment/caching',
		base_ref_name: 'main',
	},

	// ==================== AWAITING INITIAL REVIEW ====================
	{
		number: 208,
		title: 'fix: Handle edge case in date parsing',
		body: `Fixes date parsing for locales with different date formats.`,
		state: 'open',
		draft: false,
		labels: ['bug', 'i18n'],
		daysOld: 60,
		daysSinceUpdate: 58,
		comments_count: 1,
		reactions: { total: 2, '+1': 2 },
		assignees: [],
		reviewers: ['i18n-lead'],
		review_decision: 'REVIEW_REQUIRED',
		mergeable_state: 'MERGEABLE',
		additions: 25,
		deletions: 8,
		changed_files: 2,
		author_login: 'international-dev',
		author_association: 'FIRST_TIME_CONTRIBUTOR',
		head_ref_name: 'fix/date-parsing',
		base_ref_name: 'main',
	},

	// ==================== RECENT/ACTIVE PRs ====================
	{
		number: 209,
		title: 'feat: Add keyboard shortcuts',
		body: `Implements keyboard shortcuts for common actions.

Closes #114`,
		state: 'open',
		draft: false,
		labels: ['enhancement', 'ux'],
		daysOld: 7,
		daysSinceUpdate: 2,
		comments_count: 8,
		reactions: { total: 12, '+1': 10, heart: 2 },
		assignees: ['frontend-dev'],
		reviewers: ['ux-reviewer', 'frontend-lead'],
		review_decision: 'REVIEW_REQUIRED',
		mergeable_state: 'MERGEABLE',
		additions: 180,
		deletions: 20,
		changed_files: 8,
		author_login: 'keyboard-dev',
		author_association: 'CONTRIBUTOR',
		head_ref_name: 'feature/keyboard-shortcuts',
		base_ref_name: 'main',
	},
	{
		number: 210,
		title: 'chore: Update dependencies',
		body: `Updates all npm dependencies to latest versions.`,
		state: 'open',
		draft: false,
		labels: ['dependencies', 'maintenance'],
		daysOld: 3,
		daysSinceUpdate: 1,
		comments_count: 2,
		reactions: { total: 0 },
		assignees: ['devops'],
		reviewers: ['tech-lead'],
		review_decision: 'APPROVED',
		mergeable_state: 'MERGEABLE',
		additions: 500,
		deletions: 480,
		changed_files: 2,
		author_login: 'dependabot',
		author_association: 'MEMBER',
		head_ref_name: 'chore/update-deps',
		base_ref_name: 'main',
	},

	// ==================== MERGED PRs (for variety) ====================
	{
		number: 211,
		title: 'feat: Implement search functionality',
		body: `Full-text search implementation using ElasticSearch.`,
		state: 'closed',
		merged: true,
		draft: false,
		labels: ['enhancement', 'feature request'],
		daysOld: 80,
		daysSinceUpdate: 70,
		daysMerged: 70,
		comments_count: 28,
		reactions: { total: 35, '+1': 30, heart: 5 },
		assignees: ['search-engineer'],
		reviewers: ['backend-lead', 'tech-lead'],
		review_decision: 'APPROVED',
		mergeable_state: null,
		additions: 1500,
		deletions: 200,
		changed_files: 25,
		author_login: 'search-expert',
		author_association: 'MEMBER',
		head_ref_name: 'feature/search',
		base_ref_name: 'main',
	},
	{
		number: 212,
		title: 'fix: Critical security patch',
		body: `Patches the security vulnerability reported in #101.`,
		state: 'closed',
		merged: true,
		draft: false,
		labels: ['bug', 'security', 'critical'],
		daysOld: 5,
		daysSinceUpdate: 4,
		daysMerged: 4,
		comments_count: 12,
		reactions: { total: 25, '+1': 20, heart: 5 },
		assignees: ['security-lead'],
		reviewers: ['security-reviewer', 'tech-lead'],
		review_decision: 'APPROVED',
		mergeable_state: null,
		additions: 85,
		deletions: 40,
		changed_files: 4,
		author_login: 'security-lead',
		author_association: 'MEMBER',
		head_ref_name: 'hotfix/security-patch',
		base_ref_name: 'main',
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
];

// Base values for each metric (realistic production values)
const metricBaseValues = {
	lcp: 2500, // 2.5s - "needs improvement" threshold
	fcp: 1800, // 1.8s
	cls: 0.1, // Good threshold
	fid: 100, // 100ms
	ttfb: 600, // 600ms
	bundle_size: 350, // 350KB
	test_duration: 45, // 45 seconds
};

/**
 * Generate performance data points for a metric
 */
export function generatePerfData(metricId, metricKey, repoId, branch = 'trunk', dataPoints = 30) {
	const data = [];
	const baseValue = metricBaseValues[metricKey] || 100;

	for (let i = dataPoints - 1; i >= 0; i--) {
		const measuredAt = daysAgo(i);
		// Add realistic variation: +/- 10% with occasional spikes
		let variation = (Math.random() - 0.5) * 0.2 * baseValue;

		// 10% chance of a performance spike (regression)
		if (Math.random() < 0.1) {
			variation += baseValue * 0.15; // 15% spike
		}

		const value = Math.max(0, baseValue + variation);

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
