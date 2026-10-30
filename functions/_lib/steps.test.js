import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectSteps, median } from './steps.js';

const DAY = 24 * 60 * 60 * 1000;

const commitsOf = (values) =>
  values.map((value, index) => ({ hash: `commit-${index}`, measuredAt: index * DAY, value }));

/** Repeatable noise, so a failure here is never down to chance. */
function noise(seed = 1) {
  let state = seed;
  return (spread) => {
    state = (state * 16807) % 2147483647;
    return (state / 2147483647 - 0.5) * spread;
  };
}

const level = (value, count, spread = 0, random = noise()) =>
  Array.from({ length: count }, () => value + random(spread));

describe('detectSteps', () => {
  it('finds a lasting change once, at the commit it started', () => {
    const random = noise();
    const steps = detectSteps(commitsOf([...level(100, 40, 4, random), ...level(130, 40, 4, random)]));

    assert.equal(steps.length, 1);
    assert.equal(steps[0].kind, 'regression');
    assert.equal(steps[0].commit, 'commit-40');
    assert.equal(steps[0].previousCommit, 'commit-39');
    assert.ok(Math.abs(steps[0].changePercent - 30) < 3);
  });

  it('calls a decrease an improvement', () => {
    const steps = detectSteps(commitsOf([...level(100, 30), ...level(70, 30)]));
    assert.equal(steps[0].kind, 'improvement');
  });

  it('ignores a spike, however large', () => {
    const values = level(100, 60, 4);
    values[30] = 400;
    assert.deepEqual(detectSteps(commitsOf(values)), []);
  });

  it('ignores a short run that goes away again', () => {
    const values = level(100, 60, 4);
    values.fill(150, 30, 34);
    assert.deepEqual(detectSteps(commitsOf(values)), []);
  });

  it('finds nothing in steady noise', () => {
    assert.deepEqual(detectSteps(commitsOf(level(100, 400, 30))), []);
  });

  it('finds nothing in a metric that flips between two levels', () => {
    const random = noise(7);
    const values = Array.from({ length: 400 }, () => (random(1) > 0 ? 0.78 : 0.2));
    assert.deepEqual(detectSteps(commitsOf(values)), []);
  });

  it('finds a change that shows up clearly above larger noise', () => {
    const random = noise(3);
    const steps = detectSteps(commitsOf([...level(600, 60, 90, random), ...level(520, 60, 90, random)]));
    assert.equal(steps.length, 1);
  });

  it('reports a change that was undone as one reverted regression', () => {
    const random = noise();
    const steps = detectSteps(
      commitsOf([...level(100, 40, 4, random), ...level(150, 40, 4, random), ...level(100, 40, 4, random)])
    );

    assert.equal(steps.length, 1);
    assert.equal(steps[0].kind, 'regression');
    assert.equal(steps[0].revertedAt, 80 * DAY);
  });

  it('keeps separate changes in the same direction apart', () => {
    const random = noise();
    const steps = detectSteps(
      commitsOf([...level(100, 40, 2, random), ...level(130, 40, 2, random), ...level(170, 40, 2, random)])
    );

    assert.deepEqual(
      steps.map((step) => step.commit),
      ['commit-40', 'commit-80']
    );
    assert.deepEqual(
      steps.map((step) => step.revertedAt),
      [null, null]
    );
  });

  it('respects the noise floor set for a metric', () => {
    const commits = commitsOf([...level(100, 30), ...level(110, 30)]);
    assert.equal(detectSteps(commits, 5).length, 1);
    assert.equal(detectSteps(commits, 20).length, 0);
  });

  it('skips a change too small to matter', () => {
    assert.deepEqual(detectSteps(commitsOf([...level(100, 30), ...level(102, 30)])), []);
  });

  it('waits for enough commits after a change', () => {
    assert.deepEqual(detectSteps(commitsOf([...level(100, 40), ...level(150, 7)])), []);
    assert.equal(detectSteps(commitsOf([...level(100, 40), ...level(150, 8)])).length, 1);
  });

  it('copes with short series and a level of zero', () => {
    assert.deepEqual(detectSteps([]), []);
    assert.deepEqual(detectSteps(commitsOf([1, 2, 3])), []);
    assert.deepEqual(detectSteps(commitsOf([...level(0, 30), ...level(5, 30)])), []);
  });
});

describe('median', () => {
  it('takes the middle value, or the mean of the middle two', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
  });
});
