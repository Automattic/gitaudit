/**
 * Important bugs scoring algorithm
 * Higher score = more important
 */

import { analysisQueries } from '../../db/queries.js';
import { getDefaultSettings } from '../settings.js';
import { parseSqliteDate, MS_PER_DAY } from '../../utils/dates.js';
import { filterIssuesBySearch, filterIssuesByLevel } from '../../utils/issue-filters.js';
import { calculateStats, paginateResults } from '../../utils/issue-stats.js';
import { scaleSentimentScore } from '../../utils/sentiment-utils.js';

// Helper function to check if issue is a bug
export function isBugIssue(issue, generalSettings = null) {
  // Check if issue has a bug type (GitHub's new issue types feature)
  if (issue.issue_type && issue.issue_type.toLowerCase() === 'bug') {
    return true;
  }

  // Fallback to checking labels from settings
  const labels = JSON.parse(issue.labels || '[]');

  // Get bug labels from general settings or use defaults
  const defaults = getDefaultSettings();
  const bugLabelString = generalSettings?.labels?.bug || defaults.general.labels.bug;
  const bugLabels = bugLabelString
    .split(',')
    .map(label => label.trim().toLowerCase())
    .filter(label => label.length > 0);

  return labels.some(label =>
    bugLabels.some(bugKeyword => label.toLowerCase().includes(bugKeyword))
  );
}

export function scoreIssue(issue, bugsSettings = null, generalSettings = null) {
  if (!bugsSettings || !generalSettings) {
    const defaults = getDefaultSettings();
    bugsSettings = bugsSettings || defaults.bugs;
    generalSettings = generalSettings || defaults.general;
  }

  const rules = bugsSettings.scoringRules;
  let score = 0;
  const metadata = {};

  // Parse JSON fields
  const labels = JSON.parse(issue.labels || '[]');
  const assignees = JSON.parse(issue.assignees || '[]');
  const reactions = JSON.parse(issue.reactions || '{}');

  // 1. High priority labels (enabled/points from bugs, labels from general)
  if (rules.highPriorityLabels.enabled && generalSettings.labels.highPriority) {
    const priorityLabels = generalSettings.labels.highPriority
      .split(',')
      .map(label => label.trim().toLowerCase())
      .filter(label => label.length > 0);

    const hasPriorityLabel = labels.some(label =>
      priorityLabels.some(priority => label.toLowerCase().includes(priority))
    );
    if (hasPriorityLabel) {
      score += rules.highPriorityLabels.points;
      metadata.highPriorityLabels = rules.highPriorityLabels.points;
    }
  }

  // 1b. Low priority labels (negative scoring, enabled/points from bugs, labels from general)
  if (rules.lowPriorityLabels.enabled && generalSettings.labels.lowPriority) {
    const lowPriorityLabels = generalSettings.labels.lowPriority
      .split(',')
      .map(label => label.trim().toLowerCase())
      .filter(label => label.length > 0);

    const hasLowPriorityLabel = labels.some(label =>
      lowPriorityLabels.some(priority => label.toLowerCase().includes(priority))
    );
    if (hasLowPriorityLabel) {
      score += rules.lowPriorityLabels.points;
      metadata.lowPriorityLabels = rules.lowPriorityLabels.points;
    }
  }

  // 2. Recent activity
  if (rules.recentActivity.enabled) {
    const updatedAt = parseSqliteDate(issue.updated_at);
    const daysSinceUpdate = (Date.now() - updatedAt) / MS_PER_DAY;
    if (daysSinceUpdate <= rules.recentActivity.daysThreshold) {
      score += rules.recentActivity.points;
      metadata.recentActivity = rules.recentActivity.points;
      metadata.daysSinceUpdate = Math.floor(daysSinceUpdate);
    }
  }

  // 3. High reactions
  if (rules.highReactions.enabled) {
    const totalReactions = reactions.total || 0;
    if (totalReactions > rules.highReactions.reactionThreshold) {
      score += rules.highReactions.points;
      metadata.highReactions = rules.highReactions.points;
      metadata.totalReactions = totalReactions;
    }
  }

  // 4. Assigned
  if (rules.assigned.enabled && assignees.length > 0) {
    score += rules.assigned.points;
    metadata.assigned = rules.assigned.points;
  }

  // 5. Milestone
  if (rules.milestone.enabled && issue.milestone) {
    score += rules.milestone.points;
    metadata.milestone = rules.milestone.points;
  }

  // 6. Active discussion - scaled by comment count
  if (rules.activeDiscussion.enabled && issue.comments_count > rules.activeDiscussion.baseThreshold) {
    const maxComments = rules.activeDiscussion.baseThreshold +
      (rules.activeDiscussion.maxPoints / rules.activeDiscussion.pointsPer10Comments) * 10;
    const commentsForScoring = Math.min(issue.comments_count, maxComments);
    const additionalComments = commentsForScoring - rules.activeDiscussion.baseThreshold;
    const commentScore = Math.min(
      Math.floor(additionalComments / 10) * rules.activeDiscussion.pointsPer10Comments,
      rules.activeDiscussion.maxPoints
    );

    if (commentScore > 0) {
      score += commentScore;
      metadata.activeDiscussion = commentScore;
      metadata.commentsCount = issue.comments_count;
    }
  }

  // 7. Long-standing but active
  if (rules.longstandingButActive.enabled) {
    const createdAt = parseSqliteDate(issue.created_at);
    const updatedAt = parseSqliteDate(issue.updated_at);
    const daysSinceCreation = (Date.now() - createdAt) / MS_PER_DAY;
    const daysSinceUpdate = (Date.now() - updatedAt) / MS_PER_DAY;

    if (daysSinceCreation > rules.longstandingButActive.ageThreshold &&
        daysSinceUpdate <= rules.longstandingButActive.activityThreshold) {
      score += rules.longstandingButActive.points;
      metadata.longstandingButActive = rules.longstandingButActive.points;
      metadata.daysSinceCreation = Math.floor(daysSinceCreation);
    }
  }

  // 8. Sentiment analysis
  if (rules.sentimentAnalysis.enabled) {
    const sentimentAnalysis = analysisQueries.findByIssueAndType.get(issue.id, 'sentiment');
    if (sentimentAnalysis && sentimentAnalysis.score) {
      const scaledScore = scaleSentimentScore(sentimentAnalysis.score, rules.sentimentAnalysis.maxPoints);
      score += scaledScore;
      metadata.sentimentScore = scaledScore;
      metadata.sentimentMetadata = JSON.parse(sentimentAnalysis.metadata);
    }
  }

  return {
    score,
    metadata,
  };
}

/**
 * Analyze important bugs from a set of issues
 * @param {Array} issues - Issues to analyze
 * @param {Object} bugsSettings - Bugs scoring settings
 * @param {Object} generalSettings - General settings (for priority labels)
 * @param {Object} options - Pagination and filtering options
 * @returns {Object} Analyzed issues with scores, stats, and pagination
 */
export function analyzeImportantBugs(issues, bugsSettings = null, generalSettings = null, options = {}) {
  if (!bugsSettings || !generalSettings) {
    const defaults = getDefaultSettings();
    bugsSettings = bugsSettings || defaults.bugs;
    generalSettings = generalSettings || defaults.general;
  }

  const {
    page = 1,
    perPage = 20,
    priorityLevel = 'all',  // 'all', 'critical', 'high', 'medium'
    search = ''
  } = options;

  const thresholds = bugsSettings.thresholds;

  // First, filter to only bug issues
  const bugIssues = issues.filter(issue => isBugIssue(issue, generalSettings));

  // Score all bug issues with custom settings
  const scoredBugs = bugIssues.map(issue => {
    const { score, metadata } = scoreIssue(issue, bugsSettings, generalSettings);
    return {
      ...issue,
      score,
      scoreMetadata: metadata,
    };
  });

  // Sort by score descending
  scoredBugs.sort((a, b) => b.score - a.score);

  // Filter by priority level
  let filteredBugs = filterIssuesByLevel(scoredBugs, priorityLevel, thresholds);

  // Apply search filter
  filteredBugs = filterIssuesBySearch(filteredBugs, search);

  // Calculate stats for ALL bugs (not just current page)
  const stats = calculateStats(scoredBugs, thresholds);

  // Apply pagination
  const { paginatedItems, totalItems, totalPages } = paginateResults(filteredBugs, page, perPage);

  return {
    issues: paginatedItems,
    totalItems,
    totalPages,
    stats,
    thresholds,
  };
}
