/**
 * Stale pull requests detection algorithm
 * Higher score = more stale/needs attention
 */

import { getDefaultSettings } from '../settings.js';
import { parseSqliteDate, MS_PER_DAY } from '../../utils/dates.js';
import { filterIssuesBySearch, filterIssuesByLevel } from '../../utils/issue-filters.js';
import { calculateStats, paginateResults } from '../../utils/issue-stats.js';

// Helper function to calculate days since date
function daysSince(dateString) {
  if (!dateString) return 0;
  const date = parseSqliteDate(dateString);
  return (Date.now() - date) / MS_PER_DAY;
}

export function scoreStalePR(pr, settings = null) {
  if (!settings) {
    settings = getDefaultSettings().stalePRs;
  }

  let score = 0;
  const metadata = {};

  // Parse JSON fields
  const labels = JSON.parse(pr.labels || '[]');
  const reactions = JSON.parse(pr.reactions || '{}');
  const assignees = JSON.parse(pr.assignees || '[]');
  const reviewers = JSON.parse(pr.reviewers || '[]');

  const daysSinceCreated = daysSince(pr.created_at);
  const daysSinceUpdated = daysSince(pr.updated_at);

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

  // 2. Review Status Bonus
  const reviewRule = settings.bonusRules.reviewStatus;
  if (reviewRule.enabled) {
    if (pr.review_decision === 'CHANGES_REQUESTED') {
      score += reviewRule.changesRequestedPoints;
      metadata.reviewStatus = reviewRule.changesRequestedPoints;
    } else if (pr.review_decision === 'APPROVED' && pr.state === 'open') {
      score += reviewRule.approvedNotMergedPoints;
      metadata.reviewStatus = reviewRule.approvedNotMergedPoints;
    } else if (!pr.review_decision || pr.review_decision === 'REVIEW_REQUIRED') {
      score += reviewRule.noReviewsPoints;
      metadata.reviewStatus = reviewRule.noReviewsPoints;
    }
  }

  // 3. Draft Status Penalty
  const draftRule = settings.bonusRules.draftPenalty;
  if (draftRule.enabled && pr.draft) {
    score += draftRule.points; // Negative value
    metadata.isDraft = true;
    metadata.draftPenalty = draftRule.points;
  }

  // 4. Author Abandonment
  const abandonedRule = settings.bonusRules.abandonedByContributor;
  if (abandonedRule.enabled) {
    const isExternal = ['CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR'].includes(pr.author_association);
    if (isExternal && daysSinceUpdated > abandonedRule.daysThreshold) {
      score += abandonedRule.points;
      metadata.abandonedByContributor = abandonedRule.points;
      metadata.authorAssociation = pr.author_association;
    }
  }

  // 5. Merge Conflicts
  const conflictsRule = settings.bonusRules.mergeConflicts;
  if (conflictsRule.enabled) {
    if (pr.mergeable_state === 'CONFLICTING') {
      score += conflictsRule.points;
      metadata.mergeConflicts = conflictsRule.points;
    }
  }

  // 6. High Interest but Stale
  const highInterestRule = settings.bonusRules.highInterestButStale;
  if (highInterestRule.enabled) {
    const totalReactions = reactions.total || 0;
    if (
      (totalReactions > highInterestRule.reactionThreshold ||
        pr.comments_count > highInterestRule.commentsThreshold) &&
      daysSinceUpdated > highInterestRule.daysThreshold
    ) {
      score += highInterestRule.points;
      metadata.highInterestButStale = highInterestRule.points;
      metadata.totalReactions = totalReactions;
      metadata.commentsCount = pr.comments_count;
    }
  }

  return { score, metadata };
}

/**
 * Analyze stale PRs with pagination and filtering
 * @param {Array} prs - Array of PR objects
 * @param {Object} settings - Stale PR settings
 * @param {Object} options - Query options (page, per_page, search, level)
 * @returns {Object} Paginated results with stats
 */
export function analyzeStalePRs(prs, settings = null, options = {}) {
  if (!settings) {
    settings = getDefaultSettings().stalePRs;
  }

  const { page = 1, per_page = 20, search = '', level = 'all' } = options;

  // Score all PRs
  const scoredPRs = prs.map(pr => {
    const { score, metadata } = scoreStalePR(pr, settings);
    return { ...pr, score, metadata };
  });

  // Filter by search term
  const searchFiltered = filterIssuesBySearch(scoredPRs, search);

  // Filter by level (critical/high/medium/all)
  const levelFiltered = filterIssuesByLevel(searchFiltered, level, settings.thresholds);

  // Sort by score descending
  const sorted = levelFiltered.sort((a, b) => b.score - a.score);

  // Calculate stats
  const stats = calculateStats(searchFiltered, settings.thresholds);

  // Paginate results
  const paginated = paginateResults(sorted, page, per_page);

  return {
    prs: paginated.paginatedItems,
    totalItems: paginated.totalItems,
    totalPages: paginated.totalPages,
    currentPage: page,
    stats,
  };
}
