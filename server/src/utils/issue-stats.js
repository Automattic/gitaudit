/**
 * Calculate statistics for scored issues based on thresholds
 * Uses single-pass calculation for efficiency
 * @param {Array} scoredIssues - Issues with scores
 * @param {Object} thresholds - Threshold values {critical, high, medium}
 * @returns {Object} Stats object {all, critical, high, medium}
 */
export function calculateStats(scoredIssues, thresholds) {
  const stats = {
    all: scoredIssues.length,
    critical: 0,
    high: 0,
    medium: 0,
  };

  // Single pass through the array
  for (const issue of scoredIssues) {
    if (issue.score >= thresholds.critical) {
      stats.critical++;
    } else if (issue.score >= thresholds.high) {
      stats.high++;
    } else if (issue.score >= thresholds.medium) {
      stats.medium++;
    }
  }

  return stats;
}

/**
 * Paginate results
 * @param {Array} items - Items to paginate
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @returns {Object} {paginatedItems, totalItems, totalPages}
 */
export function paginateResults(items, page, perPage) {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedItems = items.slice(startIndex, startIndex + perPage);

  return {
    paginatedItems,
    totalItems,
    totalPages,
  };
}
