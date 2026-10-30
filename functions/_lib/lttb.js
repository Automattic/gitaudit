/**
 * LTTB (Largest Triangle Three Buckets) downsampling with regression preservation.
 *
 * Reduces the number of data points while preserving the visual shape of a line chart.
 * Regression and improvement points are never dropped.
 *
 * @param {Array<{value: number, isRegression?: boolean, isImprovement?: boolean}>} data - Data points (oldest first)
 * @param {number} targetPoints - Desired number of output points
 * @returns {Array} Downsampled array preserving first, last, and flagged points
 */
export function lttbDownsample(data, targetPoints) {
  if (data.length <= targetPoints) {
    return data;
  }

  // Identify must-keep points (first, last, regressions, improvements)
  const mustKeepIndices = new Set([0, data.length - 1]);
  for (let i = 0; i < data.length; i++) {
    if (data[i].isRegression || data[i].isImprovement) {
      mustKeepIndices.add(i);
    }
  }

  // If must-keep points already exceed target, return them in order
  if (mustKeepIndices.size >= targetPoints) {
    return Array.from(mustKeepIndices)
      .sort((a, b) => a - b)
      .map((i) => data[i]);
  }

  const remainingBudget = targetPoints - mustKeepIndices.size;
  const sortedMustKeep = Array.from(mustKeepIndices).sort((a, b) => a - b);

  // Build segments between must-keep points
  const segments = [];
  let totalGapPoints = 0;
  for (let i = 0; i < sortedMustKeep.length - 1; i++) {
    const start = sortedMustKeep[i];
    const end = sortedMustKeep[i + 1];
    const gapSize = end - start - 1;
    if (gapSize > 0) {
      segments.push({ start, end, gapSize });
      totalGapPoints += gapSize;
    }
  }

  const result = new Set(mustKeepIndices);

  // Distribute budget proportionally across segments and run LTTB on each
  for (const segment of segments) {
    const allocation = Math.round(
      (segment.gapSize / totalGapPoints) * remainingBudget
    );
    if (allocation <= 0) continue;

    // Build segment data with original indices
    const segmentData = [];
    for (let i = segment.start; i <= segment.end; i++) {
      segmentData.push({ originalIndex: i, x: i, y: data[i].value });
    }

    const downsampled = lttbCore(segmentData, allocation + 2); // +2 for endpoints
    // Add selected indices (skip first/last which are already must-keep)
    for (let i = 1; i < downsampled.length - 1; i++) {
      result.add(downsampled[i].originalIndex);
    }
  }

  return Array.from(result)
    .sort((a, b) => a - b)
    .map((i) => data[i]);
}

/**
 * Core LTTB algorithm on {x, y, originalIndex} points.
 */
function lttbCore(data, targetPoints) {
  if (data.length <= targetPoints) return data;

  const sampled = [data[0]];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  let a = 0;

  for (let i = 0; i < targetPoints - 2; i++) {
    // Average point for next bucket (look-ahead)
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      data.length
    );

    let avgX = 0;
    let avgY = 0;
    const avgCount = avgRangeEnd - avgRangeStart;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= avgCount;
    avgY /= avgCount;

    // Find point in current bucket with largest triangle area
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.min(
      Math.floor((i + 1) * bucketSize) + 1,
      data.length
    );

    let maxArea = -1;
    let maxAreaIndex = rangeStart;

    const pointAx = data[a].x;
    const pointAy = data[a].y;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area =
        Math.abs(
          (pointAx - avgX) * (data[j].y - pointAy) -
            (pointAx - data[j].x) * (avgY - pointAy)
        ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    a = maxAreaIndex;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}
