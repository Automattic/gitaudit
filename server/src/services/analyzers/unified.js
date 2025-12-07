import {
  scoreIssue as scoreImportantBug,
  isBugIssue,
} from "./bugs.js";
import { scoreStaleIssue } from "./stale.js";
import { scoreCommunityHealth } from "./community.js";
import { scoreFeatureRequest, isFeatureRequest } from "./features.js";
import { getDefaultSettings } from "../settings.js";

/**
 * Classify level based on score and thresholds
 */
function classifyLevel(score, thresholds) {
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

/**
 * Analyze issues with all score types (bugs, stale, community, features)
 * @param {Array} issues - Issues to analyze
 * @param {Object} settings - Settings object containing bugs, stale, community, and features settings
 * @param {Object} options - Analysis options
 * @param {number} options.page - Page number for pagination (default: 1)
 * @param {number} options.perPage - Items per page (default: 20)
 * @param {string} options.scoreType - Score type to filter by: 'bugs', 'stale', 'community', 'features', 'all' (default: 'all')
 * @param {string} options.sortBy - Sort by specific score: 'bugs.score', 'stale.score', 'community.score', 'features.score' (default: null)
 * @param {string} options.level - Priority level: 'critical', 'high', 'medium', 'low', 'all' (default: 'all')
 * @param {string} options.search - Search term for filtering (default: '')
 * @param {string} options.issueType - Issue type filter: 'bugs', 'features', 'all' (default: 'all')
 * @param {Array} options.maintainerLogins - Maintainer usernames for community health scoring (default: [])
 * @param {Array} options.labels - Label names to filter by (must have ALL labels) (default: [])
 * @returns {Object} Analyzed issues with scores, stats, and pagination
 */
export function analyzeIssuesWithAllScores(issues, settings, options = {}) {
  const {
    page = 1,
    perPage = 20,
    scoreType = "all", // 'bugs', 'stale', 'community', 'features', 'all'
    sortBy = null, // 'bugs.score', 'stale.score', 'community.score', 'features.score'
    level = "all", // critical, high, medium, low, all
    search = "",
    issueType = "all", // 'bugs', 'features', 'all'
    maintainerLogins = [], // Array of maintainer usernames for community health
    labels = [], // Array of label names to filter by (must have ALL labels)
  } = options;

  // Filter by issue type if requested
  let issuesToScore = issues;
  if (issueType === "bugs") {
    issuesToScore = issues.filter(isBugIssue);
  } else if (issueType === "features") {
    issuesToScore = issues.filter(issue => isFeatureRequest(issue, settings.features));
  }

  // Score all issues with requested analyzers
  const scoredIssues = issuesToScore.map((issue) => {
    const scores = [];

    // Run bugs analyzer if requested
    if (scoreType === "all" || scoreType === "bugs") {
      const { score, metadata } = scoreImportantBug(
        issue,
        settings.bugs
      );
      scores.push({
        type: "bugs",
        score,
        metadata,
      });
    }

    // Run stale analyzer if requested
    if (scoreType === "all" || scoreType === "stale") {
      const { score, metadata } = scoreStaleIssue(issue, settings.stale);
      scores.push({
        type: "stale",
        score,
        metadata,
      });
    }

    // Run community analyzer if requested
    if (scoreType === "all" || scoreType === "community") {
      const { score, metadata } = scoreCommunityHealth(
        issue,
        settings.community,
        maintainerLogins
      );
      scores.push({
        type: "community",
        score,
        metadata,
      });
    }

    // Run features analyzer if requested
    if (scoreType === "all" || scoreType === "features") {
      const { score, metadata } = scoreFeatureRequest(
        issue,
        settings.features,
        {} // TODO: Add uniqueCommentersMap and meTooComments
      );
      scores.push({
        type: "features",
        score,
        metadata,
      });
    }

    return { ...issue, scores };
  });

  // Apply filters based on level
  let filteredIssues = scoredIssues;

  // Filter by level (for bugs)
  if (scoreType === "bugs" && level !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const bugScore = issue.scores.find((s) => s.type === "bugs");
      if (!bugScore) return false;
      return (
        classifyLevel(bugScore.score, settings.bugs.thresholds) === level
      );
    });
  }

  // Filter by level (for stale)
  if (scoreType === "stale" && level !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const staleScore = issue.scores.find((s) => s.type === "stale");
      if (!staleScore) return false;
      return (
        classifyLevel(staleScore.score, settings.stale.thresholds) === level
      );
    });
  }

  // Filter by level (for community)
  if (scoreType === "community" && level !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const healthScore = issue.scores.find((s) => s.type === "community");
      if (!healthScore) return false;
      return (
        classifyLevel(healthScore.score, settings.community.thresholds) === level
      );
    });
  }

  // Filter by level (for features)
  if (scoreType === "features" && level !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const featureScore = issue.scores.find((s) => s.type === "features");
      if (!featureScore) return false;
      return (
        classifyLevel(featureScore.score, settings.features.thresholds) === level
      );
    });
  }

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filteredIssues = filteredIssues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(searchLower) ||
        issue.body?.toLowerCase().includes(searchLower) ||
        issue.number.toString().includes(search)
    );
  }

  // Apply labels filter (must have ALL specified labels)
  if (labels && labels.length > 0) {
    filteredIssues = filteredIssues.filter((issue) => {
      const issueLabels = JSON.parse(issue.labels || "[]");
      return labels.every((label) => issueLabels.includes(label));
    });
  }

  // Sort by requested score type
  const sortByScoreType = sortBy
    ? sortBy.split(".")[0]
    : scoreType === "all"
    ? "bugs"
    : scoreType;

  filteredIssues.sort((a, b) => {
    const aScore = a.scores.find((s) => s.type === sortByScoreType)?.score || 0;
    const bScore = b.scores.find((s) => s.type === sortByScoreType)?.score || 0;
    return bScore - aScore; // Descending
  });

  // Paginate
  const startIdx = (page - 1) * perPage;
  const endIdx = startIdx + perPage;
  const paginatedIssues = filteredIssues.slice(startIdx, endIdx);

  return {
    issues: paginatedIssues,
    totalItems: filteredIssues.length,
    totalPages: Math.ceil(filteredIssues.length / perPage),
    thresholds: {
      bugs: settings.bugs.thresholds,
      stale: settings.stale.thresholds,
      community: settings.community.thresholds,
      features: settings.features.thresholds,
    },
  };
}
