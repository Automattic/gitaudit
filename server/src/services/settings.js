import { settingsQueries } from '../db/queries.js';

/**
 * Returns default settings matching current hard-coded values
 */
export function getDefaultSettings() {
  return {
    scoringRules: {
      priorityLabels: { enabled: true, points: 30 },
      recentActivity: { enabled: true, points: 20, daysThreshold: 7 },
      highReactions: { enabled: true, points: 15, reactionThreshold: 5 },
      assigned: { enabled: true, points: 10 },
      milestone: { enabled: true, points: 15 },
      activeDiscussion: {
        enabled: true,
        baseThreshold: 5,
        pointsPer10Comments: 5,
        maxPoints: 50,
      },
      longstandingButActive: {
        enabled: true,
        points: 10,
        ageThreshold: 30,
        activityThreshold: 14,
      },
      sentimentAnalysis: { enabled: true, maxPoints: 30 },
    },
    thresholds: {
      critical: 120,
      high: 80,
      medium: 50,
    },
  };
}

/**
 * Validates user-submitted settings
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings.scoringRules || !settings.thresholds) {
    return { valid: false, errors: ['Missing required fields: scoringRules or thresholds'] };
  }

  const rules = settings.scoringRules;

  // Validate simple rules (0-200 points)
  const simpleRules = [
    'priorityLabels',
    'recentActivity',
    'highReactions',
    'assigned',
    'milestone',
    'longstandingButActive',
  ];

  for (const rule of simpleRules) {
    if (!rules[rule]) {
      errors.push(`Missing rule: ${rule}`);
      continue;
    }

    const points = rules[rule].points;
    if (typeof points !== 'number' || points < 0 || points > 200) {
      errors.push(`${rule}.points must be a number between 0 and 200`);
    }

    if (typeof rules[rule].enabled !== 'boolean') {
      errors.push(`${rule}.enabled must be a boolean`);
    }
  }

  // Validate recentActivity threshold
  if (rules.recentActivity) {
    const threshold = rules.recentActivity.daysThreshold;
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 365) {
      errors.push('recentActivity.daysThreshold must be between 1 and 365');
    }
  }

  // Validate highReactions threshold
  if (rules.highReactions) {
    const threshold = rules.highReactions.reactionThreshold;
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 100) {
      errors.push('highReactions.reactionThreshold must be between 1 and 100');
    }
  }

  // Validate activeDiscussion
  if (rules.activeDiscussion) {
    const ad = rules.activeDiscussion;

    if (typeof ad.enabled !== 'boolean') {
      errors.push('activeDiscussion.enabled must be a boolean');
    }

    if (typeof ad.baseThreshold !== 'number' || ad.baseThreshold < 0 || ad.baseThreshold > 100) {
      errors.push('activeDiscussion.baseThreshold must be between 0 and 100');
    }

    if (
      typeof ad.pointsPer10Comments !== 'number' ||
      ad.pointsPer10Comments < 0 ||
      ad.pointsPer10Comments > 50
    ) {
      errors.push('activeDiscussion.pointsPer10Comments must be between 0 and 50');
    }

    if (typeof ad.maxPoints !== 'number' || ad.maxPoints < 0 || ad.maxPoints > 100) {
      errors.push('activeDiscussion.maxPoints must be between 0 and 100');
    }
  } else {
    errors.push('Missing rule: activeDiscussion');
  }

  // Validate longstandingButActive thresholds
  if (rules.longstandingButActive) {
    const lba = rules.longstandingButActive;

    if (typeof lba.ageThreshold !== 'number' || lba.ageThreshold < 1 || lba.ageThreshold > 365) {
      errors.push('longstandingButActive.ageThreshold must be between 1 and 365');
    }

    if (
      typeof lba.activityThreshold !== 'number' ||
      lba.activityThreshold < 1 ||
      lba.activityThreshold > 365
    ) {
      errors.push('longstandingButActive.activityThreshold must be between 1 and 365');
    }
  }

  // Validate sentimentAnalysis
  if (rules.sentimentAnalysis) {
    const sa = rules.sentimentAnalysis;

    if (typeof sa.enabled !== 'boolean') {
      errors.push('sentimentAnalysis.enabled must be a boolean');
    }

    if (typeof sa.maxPoints !== 'number' || sa.maxPoints < 0 || sa.maxPoints > 50) {
      errors.push('sentimentAnalysis.maxPoints must be between 0 and 50');
    }
  } else {
    errors.push('Missing rule: sentimentAnalysis');
  }

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = settings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Helper to load repo settings with fallback to defaults
 */
export function loadRepoSettings(repoId) {
  const repoSettings = settingsQueries.findByRepoId.get(repoId);

  if (!repoSettings) {
    return getDefaultSettings();
  }

  try {
    return JSON.parse(repoSettings.settings);
  } catch (error) {
    console.error(`Failed to parse settings for repo ${repoId}:`, error);
    return getDefaultSettings();
  }
}
