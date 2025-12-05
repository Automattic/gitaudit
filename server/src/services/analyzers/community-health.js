// Community Health analyzer
// Identifies issues indicating community engagement problems
// Higher score = more important to address for community health

import { commentQueries, analysisQueries } from '../../db/queries.js';
import { getDefaultSettings } from '../settings.js';
import { parseSqliteDate } from '../../utils/dates.js';

/**
 * Check if a user is a maintainer
 */
function isMaintainer(username, maintainerLogins) {
  if (!username || !maintainerLogins || maintainerLogins.length === 0) {
    return false;
  }
  return maintainerLogins.includes(username);
}

/**
 * Check if any maintainer has commented on the issue
 */
function hasMaintainerResponse(comments, maintainerLogins) {
  if (!comments || comments.length === 0 || !maintainerLogins || maintainerLogins.length === 0) {
    return false;
  }

  return comments.some(comment => isMaintainer(comment.author, maintainerLogins));
}

/**
 * Count "me too" style comments
 * Matches patterns like: "+1", "me too", "same here", "bump", etc.
 */
function countMeTooComments(comments) {
  if (!comments || comments.length === 0) {
    return 0;
  }

  const meTooPatterns = [
    /^\+1\s*$/i,
    /^me\s+too\s*$/i,
    /^same\s+here\s*$/i,
    /^also\s+need\s+(this|it)\s*$/i,
    /^any\s+update/i,
    /^still\s+an\s+issue/i,
    /^bump\s*$/i,
    /^👍\s*$/,
    /^:thumbsup:\s*$/i,
    /^facing\s+the\s+same\s+(issue|problem)/i,
    /^having\s+the\s+same\s+(issue|problem)/i,
  ];

  return comments.filter(comment => {
    const body = (comment.body || '').trim();
    // Short comments (< 50 chars) that match patterns
    if (body.length < 50) {
      return meTooPatterns.some(pattern => pattern.test(body));
    }
    return false;
  }).length;
}

/**
 * Check if issue author is a first-time contributor
 * Uses GitHub's official authorAssociation field
 */
function isFirstTimeContributor(issue) {
  return issue.author_association === 'FIRST_TIME_CONTRIBUTOR';
}

/**
 * Score an issue for community health concerns
 */
export function scoreCommunityHealth(issue, settings, maintainerLogins) {
  if (!settings) {
    settings = getDefaultSettings().communityHealth;
  }

  const rules = settings.scoringRules;
  let score = 0;
  const metadata = {};

  // Get comments for this issue from cache
  const comments = commentQueries.findByIssueId.all(issue.id);
  const hasMaintainerComment = hasMaintainerResponse(comments, maintainerLogins);

  // Calculate days since last activity
  const updatedAt = parseSqliteDate(issue.updated_at);
  const daysSinceUpdate = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);

  // Calculate days since creation
  const createdAt = parseSqliteDate(issue.created_at);
  const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

  // Rule 1: First-time contributor without maintainer response
  if (rules.firstTimeContributor.enabled) {
    const isFirstTime = isFirstTimeContributor(issue);

    if (isFirstTime && !hasMaintainerComment) {
      score += rules.firstTimeContributor.points;
      metadata.firstTimeContributor = rules.firstTimeContributor.points;
      metadata.daysSinceCreation = Math.floor(daysSinceCreation);
    }
  }

  // Rule 2: "Me too" pile-ons without maintainer response
  if (rules.meTooComments.enabled) {
    const meTooCount = countMeTooComments(comments);

    if (meTooCount >= rules.meTooComments.minimumCount && !hasMaintainerComment) {
      score += rules.meTooComments.points;
      metadata.meTooComments = rules.meTooComments.points;
      metadata.meTooCount = meTooCount;
    }
  }

  // Rule 3: Sentiment analysis
  if (rules.sentimentAnalysis.enabled) {
    const sentimentAnalysis = analysisQueries.findByIssueAndType.get(issue.id, 'sentiment');
    if (sentimentAnalysis && sentimentAnalysis.score) {
      // Scale score proportionally: (actual score / max possible score) * desired max points
      // Sentiment score ranges from 0-30
      const scaledScore = Math.round(sentimentAnalysis.score * (rules.sentimentAnalysis.maxPoints / 30));
      score += scaledScore;
      metadata.sentimentScore = scaledScore;
      metadata.sentimentMetadata = JSON.parse(sentimentAnalysis.metadata);
    }
  }

  // Add general metadata
  metadata.hasMaintainerResponse = hasMaintainerComment;
  metadata.commentsCount = comments.length;
  metadata.daysSinceUpdate = Math.floor(daysSinceUpdate);
  metadata.authorLogin = issue.author_login;
  metadata.authorAssociation = issue.author_association;

  return {
    score,
    metadata,
  };
}

/**
 * Analyze community health for a set of issues
 * @param {Array} issues - Issues to analyze
 * @param {Object} settings - Community health settings
 * @param {Array<string>} maintainerLogins - Array of maintainer usernames
 * @param {Object} options - Pagination and filtering options
 */
export function analyzeCommunityHealth(issues, settings, maintainerLogins, options = {}) {
  if (!settings) {
    settings = getDefaultSettings().communityHealth;
  }

  const {
    page = 1,
    perPage = 20,
    priorityLevel = 'all', // 'all', 'critical', 'high', 'medium'
    search = ''
  } = options;

  const thresholds = settings.thresholds;

  // Score all issues
  const scoredIssues = issues.map(issue => {
    const { score, metadata } = scoreCommunityHealth(issue, settings, maintainerLogins);
    return {
      ...issue,
      score,
      scoreMetadata: metadata,
    };
  });

  // Sort by score descending
  scoredIssues.sort((a, b) => b.score - a.score);

  // Filter by priority level
  let filteredIssues = scoredIssues;
  if (priorityLevel !== 'all') {
    if (priorityLevel === 'critical') {
      filteredIssues = scoredIssues.filter(i => i.score >= thresholds.critical);
    } else if (priorityLevel === 'high') {
      filteredIssues = scoredIssues.filter(
        i => i.score >= thresholds.high && i.score < thresholds.critical
      );
    } else if (priorityLevel === 'medium') {
      filteredIssues = scoredIssues.filter(
        i => i.score >= thresholds.medium && i.score < thresholds.high
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

  // Calculate stats for ALL scored issues (not just current page)
  const stats = {
    all: scoredIssues.length,
    critical: scoredIssues.filter(i => i.score >= thresholds.critical).length,
    high: scoredIssues.filter(
      i => i.score >= thresholds.high && i.score < thresholds.critical
    ).length,
    medium: scoredIssues.filter(
      i => i.score >= thresholds.medium && i.score < thresholds.high
    ).length,
  };

  return {
    issues: paginatedIssues,
    totalItems,
    totalPages,
    stats,
  };
}
