// Metric cards compare the latest values against the ones before them
const WINDOW = 20;

// How many of a metric's latest values recentAverages needs
export const RECENT_VALUES = WINDOW * 2;

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length || null;
}

/**
 * @param {number[]} values - A metric's latest values, newest first
 * @returns {{average: number|null, previous: number|null}}
 */
export function recentAverages(values) {
  return {
    average: mean(values.slice(0, WINDOW)),
    previous: mean(values.slice(WINDOW, RECENT_VALUES)),
  };
}
