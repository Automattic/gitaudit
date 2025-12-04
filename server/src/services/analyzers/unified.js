import {
  scoreIssue as scoreImportantBug,
  isBugIssue,
} from "./important-bugs.js";
import { scoreStaleIssue } from "./stale-issues.js";
import { scoreCommunityHealth } from "./community-health.js";
import { getDefaultSettings } from "../settings.js";

/**
 * Classify priority level based on score and thresholds
 */
function classifyPriority(score, thresholds) {
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

/**
 * Classify stale level based on score and thresholds
 */
function classifyStaleLevel(score, thresholds) {
  if (score >= thresholds.veryStale) return "veryStale";
  if (score >= thresholds.moderatelyStale) return "moderatelyStale";
  if (score >= thresholds.slightlyStale) return "slightlyStale";
  return "fresh";
}

/**
 * Calculate unified stats for all score types
 */
function calculateUnifiedStats(issues, scoreType, settings) {
  const stats = {};

  if (scoreType === "all" || scoreType === "importantBugs") {
    const criticalCount = issues.filter((i) => {
      const bugScore = i.scores.find((s) => s.type === "importantBugs");
      return (
        bugScore && bugScore.score >= settings.importantBugs.thresholds.critical
      );
    }).length;

    const highCount = issues.filter((i) => {
      const bugScore = i.scores.find((s) => s.type === "importantBugs");
      return (
        bugScore &&
        bugScore.score >= settings.importantBugs.thresholds.high &&
        bugScore.score < settings.importantBugs.thresholds.critical
      );
    }).length;

    const mediumCount = issues.filter((i) => {
      const bugScore = i.scores.find((s) => s.type === "importantBugs");
      return (
        bugScore &&
        bugScore.score >= settings.importantBugs.thresholds.medium &&
        bugScore.score < settings.importantBugs.thresholds.high
      );
    }).length;

    const lowCount = issues.filter((i) => {
      const bugScore = i.scores.find((s) => s.type === "importantBugs");
      return (
        bugScore && bugScore.score < settings.importantBugs.thresholds.medium
      );
    }).length;

    stats.importantBugs = {
      all: criticalCount + highCount + mediumCount + lowCount,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    };
  }

  if (scoreType === "all" || scoreType === "staleIssues") {
    const veryStaleCount = issues.filter((i) => {
      const staleScore = i.scores.find((s) => s.type === "staleIssues");
      return (
        staleScore &&
        staleScore.score >= settings.staleIssues.thresholds.veryStale
      );
    }).length;

    const moderatelyStaleCount = issues.filter((i) => {
      const staleScore = i.scores.find((s) => s.type === "staleIssues");
      return (
        staleScore &&
        staleScore.score >= settings.staleIssues.thresholds.moderatelyStale &&
        staleScore.score < settings.staleIssues.thresholds.veryStale
      );
    }).length;

    const slightlyStaleCount = issues.filter((i) => {
      const staleScore = i.scores.find((s) => s.type === "staleIssues");
      return (
        staleScore &&
        staleScore.score >= settings.staleIssues.thresholds.slightlyStale &&
        staleScore.score < settings.staleIssues.thresholds.moderatelyStale
      );
    }).length;

    const freshCount = issues.filter((i) => {
      const staleScore = i.scores.find((s) => s.type === "staleIssues");
      return (
        staleScore &&
        staleScore.score < settings.staleIssues.thresholds.slightlyStale
      );
    }).length;

    stats.staleIssues = {
      all:
        veryStaleCount + moderatelyStaleCount + slightlyStaleCount + freshCount,
      veryStale: veryStaleCount,
      moderatelyStale: moderatelyStaleCount,
      slightlyStale: slightlyStaleCount,
      fresh: freshCount,
    };
  }

  if (scoreType === "all" || scoreType === "communityHealth") {
    const criticalCount = issues.filter((i) => {
      const healthScore = i.scores.find((s) => s.type === "communityHealth");
      return (
        healthScore && healthScore.score >= settings.communityHealth.thresholds.critical
      );
    }).length;

    const highCount = issues.filter((i) => {
      const healthScore = i.scores.find((s) => s.type === "communityHealth");
      return (
        healthScore &&
        healthScore.score >= settings.communityHealth.thresholds.high &&
        healthScore.score < settings.communityHealth.thresholds.critical
      );
    }).length;

    const mediumCount = issues.filter((i) => {
      const healthScore = i.scores.find((s) => s.type === "communityHealth");
      return (
        healthScore &&
        healthScore.score >= settings.communityHealth.thresholds.medium &&
        healthScore.score < settings.communityHealth.thresholds.high
      );
    }).length;

    const lowCount = issues.filter((i) => {
      const healthScore = i.scores.find((s) => s.type === "communityHealth");
      return (
        healthScore && healthScore.score < settings.communityHealth.thresholds.medium
      );
    }).length;

    stats.communityHealth = {
      all: criticalCount + highCount + mediumCount + lowCount,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    };
  }

  return stats;
}

/**
 * Analyze issues with all score types
 */
export function analyzeIssuesWithAllScores(issues, settings, options = {}) {
  const {
    page = 1,
    perPage = 20,
    scoreType = "all", // 'importantBugs', 'staleIssues', 'communityHealth', 'all'
    sortBy = null, // 'importantBugs.score', 'staleIssues.score', 'communityHealth.score'
    priority = "all", // critical, high, medium, low, all
    level = "all", // veryStale, moderatelyStale, slightlyStale, all
    search = "",
    issueType = "all", // 'bugs', 'all' (can be extended for 'feature-requests', etc.)
    maintainerLogins = [], // Array of maintainer usernames for community health
  } = options;

  // Filter by issue type if requested
  let issuesToScore = issues;
  if (issueType === "bugs") {
    issuesToScore = issues.filter(isBugIssue);
  }

  // Score all issues with requested analyzers
  const scoredIssues = issuesToScore.map((issue) => {
    const scores = [];

    // Run importantBugs analyzer if requested
    if (scoreType === "all" || scoreType === "importantBugs") {
      const { score, metadata } = scoreImportantBug(
        issue,
        settings.importantBugs
      );
      scores.push({
        type: "importantBugs",
        score,
        metadata,
      });
    }

    // Run staleIssues analyzer if requested
    if (scoreType === "all" || scoreType === "staleIssues") {
      const { score, metadata } = scoreStaleIssue(issue, settings.staleIssues);
      scores.push({
        type: "staleIssues",
        score,
        metadata,
      });
    }

    // Run communityHealth analyzer if requested
    if (scoreType === "all" || scoreType === "communityHealth") {
      const { score, metadata } = scoreCommunityHealth(
        issue,
        settings.communityHealth,
        maintainerLogins
      );
      scores.push({
        type: "communityHealth",
        score,
        metadata,
      });
    }

    return { ...issue, scores };
  });

  // Calculate stats BEFORE filtering (so tabs show correct counts)
  const stats = calculateUnifiedStats(scoredIssues, scoreType, settings);

  // Apply filters based on scoreType
  let filteredIssues = scoredIssues;

  // Filter by priority level (for importantBugs)
  if (scoreType === "importantBugs" && priority !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const bugScore = issue.scores.find((s) => s.type === "importantBugs");
      if (!bugScore) return false;
      return (
        classifyPriority(bugScore.score, settings.importantBugs.thresholds) ===
        priority
      );
    });
  }

  // Filter by stale level (for staleIssues)
  if (scoreType === "staleIssues" && level !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const staleScore = issue.scores.find((s) => s.type === "staleIssues");
      if (!staleScore) return false;
      return (
        classifyStaleLevel(
          staleScore.score,
          settings.staleIssues.thresholds
        ) === level
      );
    });
  }

  // Filter by priority level (for communityHealth)
  if (scoreType === "communityHealth" && priority !== "all") {
    filteredIssues = filteredIssues.filter((issue) => {
      const healthScore = issue.scores.find((s) => s.type === "communityHealth");
      if (!healthScore) return false;
      return (
        classifyPriority(healthScore.score, settings.communityHealth.thresholds) ===
        priority
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

  // Sort by requested score type
  const sortByScoreType = sortBy
    ? sortBy.split(".")[0]
    : scoreType === "all"
    ? "importantBugs"
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
    stats,
    thresholds: {
      importantBugs: settings.importantBugs.thresholds,
      staleIssues: settings.staleIssues.thresholds,
      communityHealth: settings.communityHealth.thresholds,
    },
  };
}
