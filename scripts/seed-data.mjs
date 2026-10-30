// Test data for `npm run seed`, with enough history to exercise regression detection
// and downsampling in the charts.
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 60;

export const testUser = {
  githubId: 12345678,
  username: 'testdev',
  accessToken: 'gho_test_token_for_local_development_only',
  refreshToken: null,
  tokenExpiresAt: null,
};

// Has no repositories of its own, so it can be added as a collaborator
export const testCollaborator = {
  githubId: 87654321,
  username: 'testcollaborator',
  accessToken: 'gho_test_token_for_local_development_only',
  refreshToken: null,
  tokenExpiresAt: null,
};

export const testRepositories = [
  {
    owner: 'WordPress',
    name: 'gutenberg',
    githubId: 70107786,
    description: 'The Block Editor project for WordPress and beyond.',
    stars: 10500,
    language: 'JavaScript',
    languageColor: '#f1e05a',
    isPrivate: 0,
    isGithub: true,
    metricsPublic: true,
    metricsToken: 'local-dev-gutenberg-token',
  },
  {
    owner: 'testdev',
    name: 'internal-tools',
    description: 'A custom repository that is not on GitHub.',
    url: 'https://git.example.com/internal-tools',
    isGithub: false,
    metricsPublic: false,
    metricsToken: 'local-dev-internal-tools-token',
  },
];

export const metricDefinitions = [
  { key: 'lcp', name: 'Largest Contentful Paint', unit: 'ms', priority: 100, defaultVisible: true },
  { key: 'fcp', name: 'First Contentful Paint', unit: 'ms', priority: 90, defaultVisible: true },
  { key: 'cls', name: 'Cumulative Layout Shift', unit: '', priority: 80, defaultVisible: true },
  { key: 'fid', name: 'First Input Delay', unit: 'ms', priority: 70, defaultVisible: true },
  { key: 'ttfb', name: 'Time to First Byte', unit: 'ms', priority: 60, defaultVisible: true },
  { key: 'bundle_size', name: 'Bundle Size', unit: 'KB', priority: 50, defaultVisible: true },
  { key: 'test_duration', name: 'Test Suite Duration', unit: 's', priority: 40, defaultVisible: false },
  { key: 'test_coverage', name: 'Test Coverage', unit: '%', priority: 35, defaultVisible: true },
  { key: 'perf_score', name: 'Performance Score', unit: '/100', priority: 30, defaultVisible: false },
];

// Realistic production values
const metricBaseValues = {
  lcp: 2500,
  fcp: 1800,
  cls: 0.1,
  fid: 100,
  ttfb: 600,
  bundle_size: 350 * 1024, // Stored in bytes, like real byte-scale metrics
  test_duration: 45,
  test_coverage: 85,
  perf_score: 90,
};

function generateCommitHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 40; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Seeded random for reproducible data (simple LCG)
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Generate deterministic performance data with clear regression patterns.
 *
 * Each metric gets a unique pattern based on its key so the dashboard
 * doesn't look identical across metrics. The patterns include:
 *   - Stable baselines
 *   - Sharp regressions (>15% change, well above the 10% detection threshold)
 *   - Recovery after regression
 *   - Gradual degradation (small changes that don't individually trigger detection)
 *   - A second regression later in the series
 *
 * The points are spread evenly over HISTORY_DAYS. More than 400 of them makes
 * the "All" chart view downsample, the way a real repository's history does.
 *
 * @returns {Array} [repoId, branch, hash, metricId, value, rawValue, measuredAt]
 */
export function generatePerfData(metricId, metricKey, repoId, branch = 'trunk', dataPoints = 600) {
  const baseValue = metricBaseValues[metricKey] || 100;

  // Use metric key as seed for reproducible per-metric variation
  let seed = 0;
  for (let i = 0; i < metricKey.length; i++) {
    seed = seed * 31 + metricKey.charCodeAt(i);
  }
  const rand = seededRandom(seed);

  // Build a multiplier curve. Lower is always better:
  // multiplier > 1 = worse (regression), multiplier < 1 = better (improvement).
  const multipliers = [];
  for (let i = 0; i < dataPoints; i++) {
    const noise = (rand() - 0.5) * 0.04; // ±2% jitter
    let m = 1.0 + noise;

    // Position in the 60-step pattern below, however many points there are
    const step = (i * 60) / dataPoints;

    if (step >= 10 && step <= 12) {
      // First regression: sharp spike
      m = 1.2 + noise;
    } else if (step >= 13 && step <= 16) {
      // Recovery: gradually return to baseline
      const recovery = (step - 12) / 4;
      m = 1.2 - recovery * 0.2 + noise;
    } else if (step >= 20 && step <= 22) {
      // Improvement: sharp drop
      m = 0.8 + noise;
    } else if (step >= 23 && step <= 24) {
      // Drift back to baseline after improvement
      m = 0.92 + noise;
    } else if (step >= 25 && step <= 35) {
      // Gradual degradation: ~1-2% per point (won't trigger 10% threshold individually)
      const drift = (step - 24) * 0.015;
      m = 1.0 + drift + noise;
    } else if (step >= 40 && step <= 42) {
      // Second regression: another sharp spike
      m = 1.25 + noise;
    } else if (step >= 43 && step <= 48) {
      // Partial recovery: stays slightly elevated
      m = 1.08 + noise;
    } else if (step >= 50 && step <= 52) {
      // Second improvement: optimization lands
      m = 0.82 + noise;
    }
    // All other points stay near baseline (m ≈ 1.0)

    multipliers.push(m);
  }

  return multipliers.map((multiplier, i) => {
    const age = ((dataPoints - 1 - i) * HISTORY_DAYS) / dataPoints;
    const value = Math.round(Math.max(0, baseValue * multiplier) * 100) / 100;

    return [repoId, branch, generateCommitHash(), metricId, value, value, Date.now() - age * MS_PER_DAY];
  });
}
