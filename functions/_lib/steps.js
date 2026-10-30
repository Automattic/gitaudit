// Commits compared on each side of a possible change. A spike shorter than half of this
// can't move a median, which is what separates a lasting change from a noisy run.
const WINDOW = 15;

// The fewest commits after a change that make it worth reporting
const MIN_COMMITS_AFTER = 8;

// Changes smaller than this aren't reported, however cleanly they stand out
const MIN_CHANGE = 0.05;

// How often a commit after a change has to be on the far side of a commit before it.
// Reaching this by chance is rare enough to hold up across every commit of every metric,
// and it needs no assumptions about noise, which many of these metrics would break: some
// sit on two levels, and some only take whole numbers.
const MIN_SEPARATION = 0.9;

// How close to the old level a later change has to land to count as undoing an earlier one
const REVERT_TOLERANCE = 0.5;

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The share of before-and-after pairs that moved up, with ties counting for half. */
function shareMovedUp(before, after) {
  let moved = 0;
  for (const earlier of before) {
    for (const later of after) {
      if (later > earlier) moved += 1;
      else if (later === earlier) moved += 0.5;
    }
  }
  return moved / (before.length * after.length);
}

function isChange(valuesBefore, valuesAfter, minDelta) {
  const before = median(valuesBefore);
  const after = median(valuesAfter);

  if (before === 0 || Math.abs(after - before) < minDelta) return false;
  if (Math.abs((after - before) / before) < MIN_CHANGE) return false;

  const movedUp = shareMovedUp(valuesBefore, valuesAfter);
  return (after > before ? movedUp : 1 - movedUp) >= MIN_SEPARATION;
}

const windowBefore = (values, index, start = 0) => values.slice(Math.max(start, index - WINDOW), index);
const windowAfter = (values, index, end = values.length) => values.slice(index, Math.min(end, index + WINDOW));

/** How far each side of `index` sits from that side's own median. */
function splitCost(values, index) {
  const spread = (side) => {
    const level = median(side);
    return side.reduce((sum, value) => sum + Math.abs(value - level), 0);
  };
  return spread(windowBefore(values, index)) + spread(windowAfter(values, index));
}

/** Find the commit a change starts at, near a point where it shows. */
function locate(values, index) {
  const first = Math.max(1, index - (WINDOW >> 1));
  const last = Math.min(values.length - 1, index + (WINDOW >> 1));

  let best = index;
  let bestCost = Infinity;
  for (let i = first; i <= last; i++) {
    const cost = splitCost(values, i);
    if (cost < bestCost) {
      best = i;
      bestCost = cost;
    }
  }
  return best;
}

/** The commits either side of a step, each kept to its own stretch between steps. */
function stretches(values, indexes, position) {
  const index = indexes[position];
  return {
    before: windowBefore(values, index, indexes[position - 1]),
    after: windowAfter(values, index, indexes[position + 1]),
  };
}

/**
 * Find lasting changes in a metric's level. A candidate stands for the whole run of
 * neighbouring commits that also show the change, so the largest of each run is kept.
 * Those can still sit on the edge of a larger change, and show nothing once it's
 * accounted for, so steps are checked again against their neighbours.
 */
function findSteps(values, minDelta) {
  const candidates = [];

  for (let index = MIN_COMMITS_AFTER; index <= values.length - MIN_COMMITS_AFTER; index++) {
    const before = windowBefore(values, index);
    const after = windowAfter(values, index);

    if (isChange(before, after, minDelta)) {
      candidates.push({ index, size: Math.abs(median(after) - median(before)) });
    }
  }

  const indexes = [];

  for (const { index } of candidates.sort((a, b) => b.size - a.size)) {
    const located = locate(values, index);
    const isSettled = values.length - located >= MIN_COMMITS_AFTER;

    if (isSettled && indexes.every((kept) => Math.abs(kept - located) >= WINDOW)) {
      indexes.push(located);
    }
  }

  indexes.sort((a, b) => a - b);

  for (let position = 0; position < indexes.length; ) {
    const { before, after } = stretches(values, indexes, position);

    if (isChange(before, after, minDelta)) {
      position++;
    } else {
      indexes.splice(position, 1);
      position = Math.max(0, position - 1);
    }
  }

  return indexes;
}

/**
 * Detect lasting changes in a metric, unlike the point-to-point flags on a chart, most
 * of which are a noisy run that the next commit undoes.
 *
 * @param {Array<{hash: string, measuredAt: number, value: number}>} commits - One value
 *   per commit, oldest first
 * @param {number} [minDelta=0] - The metric's noise floor, in stored units
 * @returns {Array} Changes oldest first. Lower is better, so an increase is a regression.
 *   `revertedAt` is set when a later change returned the metric to where it started.
 */
export function detectSteps(commits, minDelta = 0) {
  const values = commits.map((commit) => commit.value);

  const steps = findSteps(values, minDelta).map((index, position, indexes) => {
    const sides = stretches(values, indexes, position);
    const before = median(sides.before);
    const after = median(sides.after);

    return {
      kind: after > before ? 'regression' : 'improvement',
      before,
      after,
      changePercent: ((after - before) / before) * 100,
      commit: commits[index].hash,
      previousCommit: commits[index - 1].hash,
      measuredAt: commits[index].measuredAt,
      commitsAfter: commits.length - index,
      revertedAt: null,
    };
  });

  // A change that went away is one story, not a regression and an unrelated improvement
  const kept = [];
  for (const step of steps) {
    const previous = kept.at(-1);
    const undoesPrevious =
      previous &&
      !previous.revertedAt &&
      previous.kind !== step.kind &&
      Math.abs(step.after - previous.before) <= Math.abs(previous.after - previous.before) * REVERT_TOLERANCE;

    if (undoesPrevious) {
      previous.revertedAt = step.measuredAt;
    } else {
      kept.push(step);
    }
  }

  return kept;
}
