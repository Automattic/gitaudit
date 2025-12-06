/**
 * Filter issues by search term
 * Searches in title, issue number, and labels
 * @param {Array} issues - Issues to filter
 * @param {string} search - Search term
 * @returns {Array} Filtered issues
 */
export function filterIssuesBySearch(issues, search) {
  if (!search) {
    return issues;
  }

  const searchLower = search.toLowerCase();
  return issues.filter(issue => {
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

/**
 * Filter issues by level based on score and thresholds
 * @param {Array} scoredIssues - Issues with scores
 * @param {string} level - Level to filter by ('all', 'critical', 'high', 'medium')
 * @param {Object} thresholds - Threshold values {critical, high, medium}
 * @returns {Array} Filtered issues
 */
export function filterIssuesByLevel(scoredIssues, level, thresholds) {
  if (level === 'all') {
    return scoredIssues;
  }

  if (level === 'critical') {
    return scoredIssues.filter(i => i.score >= thresholds.critical);
  }

  if (level === 'high') {
    return scoredIssues.filter(
      i => i.score >= thresholds.high && i.score < thresholds.critical
    );
  }

  if (level === 'medium') {
    return scoredIssues.filter(
      i => i.score >= thresholds.medium && i.score < thresholds.high
    );
  }

  return scoredIssues;
}
