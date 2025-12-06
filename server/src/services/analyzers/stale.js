/**
 * Stale issues detection algorithm
 * Higher score = more stale/needs attention
 */

import { getDefaultSettings } from '../settings.js';
import { parseSqliteDate, MS_PER_DAY } from '../../utils/dates.js';
import { filterIssuesBySearch, filterIssuesByLevel } from '../../utils/issue-filters.js';
import { calculateStats, paginateResults } from '../../utils/issue-stats.js';

// Helper function to calculate days since date
function daysSince(dateString) {
  const date = parseSqliteDate(dateString);
  return (Date.now() - date) / MS_PER_DAY;
}

export function scoreStaleIssue(issue, settings = null) {
  if (!settings) {
    settings = getDefaultSettings().stale;
  }

  let score = 0;
  const metadata = {};

  // Parse JSON fields
  const labels = JSON.parse(issue.labels || '[]');
  const assignees = JSON.parse(issue.assignees || '[]');
  const reactions = JSON.parse(issue.reactions || '{}');

  const daysSinceCreated = daysSince(issue.created_at);
  const daysSinceUpdated = daysSince(issue.updated_at);

  // Store days for display
  metadata.daysSinceUpdated = Math.floor(daysSinceUpdated);
  metadata.daysSinceCreated = Math.floor(daysSinceCreated);

  // 1. Activity Time Ranges - use configurable ranges
  // Sort by days descending to check longest periods first
  const sortedRanges = [...settings.activityTimeRanges].sort((a, b) => b.days - a.days);

  for (const range of sortedRanges) {
    if (daysSinceUpdated > range.days) {
      score += range.points;
      metadata.activityTimeRange = range.points;
      metadata.activityTimeRangeName = range.name;
      break; // Only apply one time range
    }
  }

  // 2. Waiting for Response Labels
  const waitingRule = settings.bonusRules.waitingForResponse;
  if (waitingRule.enabled) {
    const hasWaitingLabel = labels.some(label =>
      waitingRule.labels.some(waiting => label.toLowerCase().includes(waiting))
    );
    if (hasWaitingLabel) {
      score += waitingRule.points;
      metadata.waitingForResponse = waitingRule.points;
    }
  }

  // 3. Abandoned by Assignee
  const abandonedRule = settings.bonusRules.abandonedByAssignee;
  if (abandonedRule.enabled) {
    if (assignees.length > 0 && daysSinceUpdated > abandonedRule.daysThreshold) {
      score += abandonedRule.points;
      metadata.abandonedByAssignee = abandonedRule.points;
    }
  }

  // 4. Never Addressed
  const neverAddressedRule = settings.bonusRules.neverAddressed;
  if (neverAddressedRule.enabled) {
    if (daysSinceCreated > neverAddressedRule.ageThreshold && issue.comments_count === 0) {
      score += neverAddressedRule.points;
      metadata.neverAddressed = neverAddressedRule.points;
    }
  }

  // 5. High Interest but Stale
  const highInterestRule = settings.bonusRules.highInterestButStale;
  if (highInterestRule.enabled) {
    const totalReactions = reactions.total || 0;
    if (
      (totalReactions > highInterestRule.reactionThreshold ||
        issue.comments_count > highInterestRule.commentsThreshold) &&
      daysSinceUpdated > highInterestRule.daysThreshold
    ) {
      score += highInterestRule.points;
      metadata.highInterestButStale = highInterestRule.points;
      metadata.totalReactions = totalReactions;
      metadata.commentsCount = issue.comments_count;
    }
  }

  // 6. Stale Milestone (disabled by default)
  const staleMilestoneRule = settings.bonusRules.staleMilestone;
  if (staleMilestoneRule.enabled) {
    if (issue.milestone && daysSinceUpdated > staleMilestoneRule.daysThreshold) {
      score += staleMilestoneRule.points;
      metadata.staleMilestone = staleMilestoneRule.points;
    }
  }

  // 7. Marked for Closure (disabled by default)
  const markedForClosureRule = settings.bonusRules.markedForClosure;
  if (markedForClosureRule.enabled) {
    const hasDuplicateLabel = labels.some(label =>
      markedForClosureRule.labels.some(dup => label.toLowerCase().includes(dup))
    );
    if (hasDuplicateLabel && issue.state === 'open') {
      score += markedForClosureRule.points;
      metadata.markedForClosure = markedForClosureRule.points;
    }
  }

  return {
    score,
    metadata,
  };
}

/**
 * Analyze stale issues from a set of issues
 * @param {Array} issues - Issues to analyze
 * @param {Object} settings - Stale scoring settings
 * @param {Object} options - Pagination and filtering options
 * @returns {Object} Analyzed issues with scores, stats, and pagination
 */
export function analyzeStaleIssues(issues, settings = null, options = {}) {
  if (!settings) {
    settings = getDefaultSettings().stale;
  }

  const {
    page = 1,
    perPage = 20,
    staleLevel = 'all',  // 'all', 'critical', 'high', 'medium'
    search = ''
  } = options;

  // Use configurable thresholds
  const thresholds = settings.thresholds;

  // Score all issues
  const scoredIssues = issues.map(issue => {
    const { score, metadata } = scoreStaleIssue(issue, settings);
    return {
      ...issue,
      score,
      scoreMetadata: metadata,
    };
  });

  // Sort by score descending (most stale first)
  scoredIssues.sort((a, b) => b.score - a.score);

  // Filter by stale level
  let filteredIssues = filterIssuesByLevel(scoredIssues, staleLevel, thresholds);

  // Apply search filter
  filteredIssues = filterIssuesBySearch(filteredIssues, search);

  // Calculate stats for ALL issues (not just current page)
  const stats = calculateStats(scoredIssues, thresholds);

  // Apply pagination
  const { paginatedItems, totalItems, totalPages } = paginateResults(filteredIssues, page, perPage);

  return {
    issues: paginatedItems,
    totalItems,
    totalPages,
    stats,
    thresholds,
  };
}
