// Important bugs scoring algorithm
// Higher score = more important

import { analysisQueries } from '../../db/queries.js';
import { getDefaultSettings } from '../settings.js';

// Helper function to check if issue is a bug
export function isBugIssue(issue) {
  // Check if issue has a bug type (GitHub's new issue types feature)
  if (issue.issue_type && issue.issue_type.toLowerCase() === 'bug') {
    return true;
  }

  // Fallback to checking labels
  const labels = JSON.parse(issue.labels || '[]');
  const bugLabels = ['bug', 'defect', 'error', 'crash', 'broken', '[type] bug'];

  return labels.some(label =>
    bugLabels.some(bugKeyword => label.toLowerCase().includes(bugKeyword))
  );
}

export function scoreIssue(issue, settings = null) {
  // Use defaults if no settings provided (backward compatibility)
  if (!settings) {
    settings = getDefaultSettings().importantBugs;
  }

  const rules = settings.scoringRules;
  let score = 0;
  const metadata = {};

  // Parse JSON fields
  const labels = JSON.parse(issue.labels || '[]');
  const assignees = JSON.parse(issue.assignees || '[]');
  const reactions = JSON.parse(issue.reactions || '{}');

  // 1. Priority/severity labels
  if (rules.priorityLabels.enabled) {
    const priorityLabels = [
      'critical', 'high priority', 'urgent', 'severity: high',
      'p0', 'p1', 'blocker', 'showstopper'
    ];
    const hasPriorityLabel = labels.some(label =>
      priorityLabels.some(priority => label.toLowerCase().includes(priority))
    );
    if (hasPriorityLabel) {
      score += rules.priorityLabels.points;
      metadata.hasPriorityLabel = true;
    }
  }

  // 2. Recent activity
  if (rules.recentActivity.enabled) {
    const updatedAt = new Date(issue.updated_at);
    const daysSinceUpdate = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate <= rules.recentActivity.daysThreshold) {
      score += rules.recentActivity.points;
      metadata.recentActivity = true;
    }
  }

  // 3. High reactions
  if (rules.highReactions.enabled) {
    const totalReactions = reactions.total || 0;
    if (totalReactions > rules.highReactions.reactionThreshold) {
      score += rules.highReactions.points;
      metadata.highEngagement = true;
    }
  }

  // 4. Assigned
  if (rules.assigned.enabled && assignees.length > 0) {
    score += rules.assigned.points;
    metadata.isAssigned = true;
  }

  // 5. Milestone
  if (rules.milestone.enabled && issue.milestone) {
    score += rules.milestone.points;
    metadata.hasMilestone = true;
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
      metadata.activeDiscussion = true;
      metadata.commentScore = commentScore;
    }
  }

  // 7. Long-standing but active
  if (rules.longstandingButActive.enabled) {
    const createdAt = new Date(issue.created_at);
    const updatedAt = new Date(issue.updated_at);
    const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    const daysSinceUpdate = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation > rules.longstandingButActive.ageThreshold &&
        daysSinceUpdate <= rules.longstandingButActive.activityThreshold) {
      score += rules.longstandingButActive.points;
      metadata.longstandingButActive = true;
    }
  }

  // 8. Sentiment analysis
  if (rules.sentimentAnalysis.enabled) {
    const sentimentAnalysis = analysisQueries.findByIssueAndType.get(issue.id, 'sentiment');
    if (sentimentAnalysis && sentimentAnalysis.score) {
      const scaledScore = Math.min(sentimentAnalysis.score, rules.sentimentAnalysis.maxPoints);
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

export function analyzeImportantBugs(issues, settings = null, options = {}) {
  // Use defaults if no settings provided (backward compatibility)
  if (!settings) {
    settings = getDefaultSettings().importantBugs;
  }

  const {
    page = 1,
    perPage = 20,
    priorityLevel = 'all',  // 'all', 'critical', 'high', 'medium'
    search = ''
  } = options;

  const thresholds = settings.thresholds;

  // First, filter to only bug issues
  const bugIssues = issues.filter(isBugIssue);

  // Score all bug issues with custom settings
  const scoredBugs = bugIssues.map(issue => {
    const { score, metadata } = scoreIssue(issue, settings);
    return {
      ...issue,
      score,
      scoreMetadata: metadata,
    };
  });

  // Sort by score descending
  scoredBugs.sort((a, b) => b.score - a.score);

  // Filter by priority level
  let filteredBugs = scoredBugs;
  if (priorityLevel !== 'all') {
    if (priorityLevel === 'critical') {
      filteredBugs = scoredBugs.filter(b => b.score >= thresholds.critical);
    } else if (priorityLevel === 'high') {
      filteredBugs = scoredBugs.filter(
        b => b.score >= thresholds.high && b.score < thresholds.critical
      );
    } else if (priorityLevel === 'medium') {
      filteredBugs = scoredBugs.filter(
        b => b.score >= thresholds.medium && b.score < thresholds.high
      );
    }
  }

  // Apply search filter if present
  if (search) {
    const searchLower = search.toLowerCase();
    filteredBugs = filteredBugs.filter(bug => {
      // Search in title
      if (bug.title.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in issue number (e.g., "#123")
      if (searchLower.startsWith('#')) {
        const numberSearch = searchLower.substring(1);
        if (bug.number.toString().includes(numberSearch)) {
          return true;
        }
      } else if (bug.number.toString().includes(searchLower)) {
        return true;
      }

      // Search in labels
      const labels = JSON.parse(bug.labels || '[]');
      if (labels.some(label => label.toLowerCase().includes(searchLower))) {
        return true;
      }

      return false;
    });
  }

  // Calculate total before pagination
  const totalItems = filteredBugs.length;
  const totalPages = Math.ceil(totalItems / perPage);

  // Apply pagination
  const startIndex = (page - 1) * perPage;
  const paginatedBugs = filteredBugs.slice(startIndex, startIndex + perPage);

  // Calculate stats for ALL bugs (not just current page)
  const stats = {
    all: scoredBugs.length,
    critical: scoredBugs.filter(b => b.score >= thresholds.critical).length,
    high: scoredBugs.filter(
      b => b.score >= thresholds.high && b.score < thresholds.critical
    ).length,
    medium: scoredBugs.filter(
      b => b.score >= thresholds.medium && b.score < thresholds.high
    ).length,
  };

  return {
    bugs: paginatedBugs,
    totalItems,
    totalPages,
    stats,
  };
}
