// Stale issues detection algorithm
// Higher score = more stale/needs attention

import { getDefaultSettings } from '../settings.js';

// Helper function to calculate days since date
function daysSince(dateString) {
  const date = new Date(dateString);
  return (Date.now() - date) / (1000 * 60 * 60 * 24);
}

export function scoreStaleIssue(issue, settings = null) {
  // Use defaults if no settings provided
  if (!settings) {
    settings = getDefaultSettings().staleIssues;
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

export function analyzeStaleIssues(issues, settings = null, options = {}) {
  // Use defaults if no settings provided
  if (!settings) {
    settings = getDefaultSettings().staleIssues;
  }

  const {
    page = 1,
    perPage = 20,
    staleLevel = 'all',  // 'all', 'very-stale', 'moderately-stale', 'slightly-stale'
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
  let filteredIssues = scoredIssues;
  if (staleLevel !== 'all') {
    if (staleLevel === 'very-stale') {
      filteredIssues = scoredIssues.filter(i => i.score >= thresholds.veryStale);
    } else if (staleLevel === 'moderately-stale') {
      filteredIssues = scoredIssues.filter(
        i => i.score >= thresholds.moderatelyStale && i.score < thresholds.veryStale
      );
    } else if (staleLevel === 'slightly-stale') {
      filteredIssues = scoredIssues.filter(
        i => i.score >= thresholds.slightlyStale && i.score < thresholds.moderatelyStale
      );
    }
  }

  // Apply search filter if present
  if (search) {
    const searchLower = search.toLowerCase();
    filteredIssues = filteredIssues.filter(issue => {
      // Search in title
      if (issue.title.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in issue number (e.g., "#123")
      if (searchLower.startsWith('#')) {
        const numberSearch = searchLower.substring(1);
        if (issue.number.toString().includes(numberSearch)) {
          return true;
        }
      } else if (issue.number.toString().includes(searchLower)) {
        return true;
      }

      // Search in labels
      const labels = JSON.parse(issue.labels || '[]');
      if (labels.some(label => label.toLowerCase().includes(searchLower))) {
        return true;
      }

      return false;
    });
  }

  // Calculate total before pagination
  const totalItems = filteredIssues.length;
  const totalPages = Math.ceil(totalItems / perPage);

  // Apply pagination
  const startIndex = (page - 1) * perPage;
  const paginatedIssues = filteredIssues.slice(startIndex, startIndex + perPage);

  // Calculate stats for ALL issues (not just current page)
  const stats = {
    all: scoredIssues.length,
    veryStale: scoredIssues.filter(i => i.score >= thresholds.veryStale).length,
    moderatelyStale: scoredIssues.filter(
      i => i.score >= thresholds.moderatelyStale && i.score < thresholds.veryStale
    ).length,
    slightlyStale: scoredIssues.filter(
      i => i.score >= thresholds.slightlyStale && i.score < thresholds.moderatelyStale
    ).length,
  };

  return {
    issues: paginatedIssues,
    totalItems,
    totalPages,
    stats,
    thresholds,
  };
}
