/**
 * Feature Request Prioritization Analyzer
 * Higher score = higher priority feature request
 */

import { getDefaultSettings } from '../settings.js';
import { parseSqliteDate, MS_PER_DAY } from '../../utils/dates.js';
import { filterIssuesBySearch, filterIssuesByLevel } from '../../utils/issue-filters.js';
import { calculateStats, paginateResults } from '../../utils/issue-stats.js';
import { analysisQueries } from '../../db/queries.js';

/**
 * Check if an issue is a feature request
 * @param {Object} issue - Issue to check
 * @param {Object} generalSettings - General settings (optional, for custom labels)
 * @returns {boolean}
 */
export function isFeatureRequest(issue, generalSettings = null) {
  // 1. Check GitHub's native issue type
  if (issue.issue_type && issue.issue_type.toLowerCase() === 'enhancement') {
    return true;
  }

  // 2. Check for feature labels from general settings
  const labels = JSON.parse(issue.labels || '[]');

  // Get feature labels from general settings or use defaults
  const defaults = getDefaultSettings();
  const featureLabelString = generalSettings?.labels?.feature || defaults.general.labels.feature;
  const featureKeywords = featureLabelString
    .split(',')
    .map(label => label.trim().toLowerCase())
    .filter(label => label.length > 0);

  return labels.some(label =>
    featureKeywords.some(keyword => label.toLowerCase().includes(keyword))
  );
}

/**
 * Score a feature request based on demand, engagement, and feasibility
 * @param {Object} issue - Issue to score
 * @param {Object} featuresSettings - Feature scoring settings
 * @param {Object} generalSettings - General settings (for rejection labels)
 * @param {Object} options - Additional scoring data (uniqueCommentersMap, meTooComments)
 * @returns {Object} { score, metadata }
 */
export function scoreFeatureRequest(issue, featuresSettings = null, generalSettings = null, options = {}) {
  if (!featuresSettings || !generalSettings) {
    const defaults = getDefaultSettings();
    featuresSettings = featuresSettings || defaults.features;
    generalSettings = generalSettings || defaults.general;
  }

  const rules = featuresSettings.scoringRules;
  let score = 0;
  const metadata = {};

  // Parse JSON fields
  const reactions = JSON.parse(issue.reactions || '{}');
  const labels = JSON.parse(issue.labels || '[]');
  const assignees = JSON.parse(issue.assignees || '[]');

  // === 1. DEMAND SIGNALS (0-40 points) ===

  // A. Reactions Score (0-20 points)
  if (rules.reactions.enabled) {
    const reactionCount = reactions.total || 0;
    let reactionsScore = 0;

    if (reactionCount <= 10) {
      reactionsScore = reactionCount * 0.5; // 0-5 points (linear)
    } else if (reactionCount <= 50) {
      reactionsScore = 5 + ((reactionCount - 10) * 0.25); // 5-15 points
    } else {
      reactionsScore = 15 + Math.min((reactionCount - 50) * 0.1, 5); // 15-20 points
    }

    score += Math.round(reactionsScore);
    metadata.reactionsScore = Math.round(reactionsScore);
    metadata.reactionCount = reactionCount;
  }

  // B. Unique Commenters (0-15 points)
  if (rules.uniqueCommenters.enabled) {
    const uniqueCommenters = options.uniqueCommentersMap?.[issue.id] || 0;
    let commentersScore = 0;

    if (uniqueCommenters >= 16) {
      commentersScore = 15;
    } else if (uniqueCommenters >= 6) {
      commentersScore = 10;
    } else if (uniqueCommenters >= 2) {
      commentersScore = 5;
    }

    score += commentersScore;
    metadata.uniqueCommentersScore = commentersScore;
    metadata.uniqueCommenters = uniqueCommenters;
  }

  // C. "Me too" Comments (0-5 points)
  if (rules.meTooComments.enabled) {
    const meTooCount = options.meTooComments?.[issue.id] || 0;

    if (meTooCount >= rules.meTooComments.minimumCount) {
      score += rules.meTooComments.points;
      metadata.meTooCommentsScore = rules.meTooComments.points;
      metadata.meTooCount = meTooCount;
    }
  }

  // === 2. ENGAGEMENT QUALITY (0-25 points) ===

  // A. Active Discussion (0-15 points)
  if (rules.activeDiscussion.enabled) {
    const commentCount = issue.comments_count || 0;
    let discussionScore = 0;

    if (commentCount >= 30) {
      discussionScore = 15;
    } else if (commentCount >= 16) {
      discussionScore = 10;
    } else if (commentCount >= 6) {
      discussionScore = 5;
    }

    score += discussionScore;
    metadata.activeDiscussionScore = discussionScore;
    metadata.commentsCount = commentCount;
  }

  // B. Recent Activity (0-10 points)
  if (rules.recentActivity.enabled) {
    const daysSinceUpdate = (Date.now() - parseSqliteDate(issue.updated_at)) / MS_PER_DAY;
    let activityScore = 0;

    if (daysSinceUpdate <= rules.recentActivity.recentThreshold) {
      activityScore = rules.recentActivity.recentPoints;
    } else if (daysSinceUpdate <= rules.recentActivity.moderateThreshold) {
      activityScore = rules.recentActivity.moderatePoints;
    }

    score += activityScore;
    metadata.recentActivityScore = activityScore;
    metadata.daysSinceUpdate = Math.floor(daysSinceUpdate);
  }

  // === 3. FEASIBILITY INDICATORS (0-15 points) ===

  // A. Has Milestone (0-10 points)
  if (rules.hasMilestone.enabled) {
    if (issue.milestone && issue.milestone.trim().length > 0) {
      score += rules.hasMilestone.points;
      metadata.hasMilestone = true;
      metadata.milestone = issue.milestone;
      metadata.milestoneScore = rules.hasMilestone.points;
    }
  }

  // B. Has Assignee (0-5 points)
  if (rules.hasAssignee.enabled) {
    if (assignees.length > 0) {
      score += rules.hasAssignee.points;
      metadata.hasAssignee = true;
      metadata.assigneeCount = assignees.length;
      metadata.assigneeScore = rules.hasAssignee.points;
    }
  }

  // === 4. USER VALUE (0-15 points) ===

  // A. Author Type (0-5 points)
  if (rules.authorType.enabled) {
    const authorAssociation = issue.author_association || 'NONE';
    let authorScore = 0;

    if (['MEMBER', 'OWNER', 'COLLABORATOR'].includes(authorAssociation)) {
      authorScore = rules.authorType.teamPoints;
      metadata.authorType = 'team';
    } else if (authorAssociation === 'CONTRIBUTOR') {
      authorScore = rules.authorType.contributorPoints;
      metadata.authorType = 'contributor';
    } else if (authorAssociation === 'FIRST_TIME_CONTRIBUTOR') {
      authorScore = rules.authorType.firstTimePoints;
      metadata.authorType = 'first-time';
    }

    score += authorScore;
    metadata.authorTypeScore = authorScore;
  }

  // B. Sentiment Analysis - Intensity (0-10 points)
  if (rules.sentimentAnalysis.enabled) {
    const sentimentAnalysis = analysisQueries.findByIssueAndType.get(issue.id, 'sentiment');
    if (sentimentAnalysis && sentimentAnalysis.metadata) {
      try {
        const sentimentMetadata = JSON.parse(sentimentAnalysis.metadata);
        const rawSentiment = sentimentMetadata.issueSentiment || 0; // -1 to +1

        // Measure passion/intensity (distance from neutral)
        const intensity = Math.abs(rawSentiment); // 0 to 1
        const sentimentScore = Math.round(intensity * rules.sentimentAnalysis.maxPoints);

        score += sentimentScore;
        metadata.sentimentScore = sentimentScore;
        metadata.sentimentRaw = rawSentiment;
        metadata.sentimentIntensity = intensity;
      } catch (error) {
        console.error('Error parsing sentiment metadata:', error);
      }
    }
  }

  // === 5. PENALTIES ===

  // A. Stale Without Activity (-10 points)
  if (rules.stalePenalty.enabled) {
    const daysSinceCreated = (Date.now() - parseSqliteDate(issue.created_at)) / MS_PER_DAY;
    const daysSinceUpdated = (Date.now() - parseSqliteDate(issue.updated_at)) / MS_PER_DAY;

    if (daysSinceCreated > rules.stalePenalty.ageThreshold &&
        daysSinceUpdated > rules.stalePenalty.inactivityThreshold) {
      score += rules.stalePenalty.points; // Negative number
      metadata.staleFeature = true;
      metadata.stalePenalty = rules.stalePenalty.points;
      metadata.daysSinceCreated = Math.floor(daysSinceCreated);
    }
  }

  // B. Rejection Labels (-50 points, uses general.labels.lowPriority)
  if (rules.rejectionPenalty.enabled) {
    const rejectionKeywords = generalSettings.labels.lowPriority
      .split(',')
      .map(label => label.trim().toLowerCase())
      .filter(label => label.length > 0);

    const hasRejectionLabel = labels.some(label =>
      rejectionKeywords.some(reject => label.toLowerCase().includes(reject))
    );

    if (hasRejectionLabel) {
      score += rules.rejectionPenalty.points; // Negative number
      metadata.rejected = true;
      metadata.rejectionPenalty = rules.rejectionPenalty.points;
    }
  }

  // C. Vague Description (-5 points)
  if (rules.vagueDescriptionPenalty.enabled) {
    const bodyLength = (issue.body || '').length;

    if (bodyLength < rules.vagueDescriptionPenalty.lengthThreshold) {
      score += rules.vagueDescriptionPenalty.points; // Negative number
      metadata.vagueDescription = true;
      metadata.bodyLength = bodyLength;
      metadata.vagueDescriptionPenalty = rules.vagueDescriptionPenalty.points;
    }
  }

  return {
    score: Math.max(0, score), // Don't allow negative total scores
    metadata,
  };
}

/**
 * Analyze feature requests from a set of issues
 * @param {Array} issues - Issues to analyze
 * @param {Object} featuresSettings - Feature scoring settings
 * @param {Object} generalSettings - General settings (for rejection labels)
 * @param {Object} options - Pagination and filtering options
 * @returns {Object} Analyzed issues with scores, stats, and pagination
 */
export function analyzeFeatureRequests(issues, featuresSettings = null, generalSettings = null, options = {}) {
  if (!featuresSettings || !generalSettings) {
    const defaults = getDefaultSettings();
    featuresSettings = featuresSettings || defaults.features;
    generalSettings = generalSettings || defaults.general;
  }

  const {
    page = 1,
    perPage = 20,
    priorityLevel = 'all',  // 'all', 'critical', 'high', 'medium'
    search = ''
  } = options;

  const thresholds = featuresSettings.thresholds;

  // First, filter to only feature request issues
  const featureIssues = issues.filter(issue => isFeatureRequest(issue, generalSettings));

  // Pre-compute unique commenters for all feature issues
  // TODO: This will be implemented when we add the batch query
  const uniqueCommentersMap = {};

  // Pre-compute "me too" comments for all feature issues
  // TODO: This will be implemented when we add the batch query
  const meTooComments = {};

  // Score all feature requests
  const scoredFeatures = featureIssues.map(issue => {
    const { score, metadata } = scoreFeatureRequest(issue, featuresSettings, generalSettings, {
      uniqueCommentersMap,
      meTooComments,
    });
    return {
      ...issue,
      score,
      scoreMetadata: metadata,
    };
  });

  // Sort by score descending (highest priority first)
  scoredFeatures.sort((a, b) => b.score - a.score);

  // Filter by priority level
  let filteredFeatures = filterIssuesByLevel(scoredFeatures, priorityLevel, thresholds);

  // Apply search filter
  filteredFeatures = filterIssuesBySearch(filteredFeatures, search);

  // Calculate stats for ALL features (not just current page)
  const stats = calculateStats(scoredFeatures, thresholds);

  // Apply pagination
  const { paginatedItems, totalItems, totalPages } = paginateResults(filteredFeatures, page, perPage);

  return {
    issues: paginatedItems,
    totalItems,
    totalPages,
    stats,
    thresholds,
  };
}
