import { settingsQueries } from '../db/queries.js';

/**
 * Returns default settings for both important bugs and stale issues
 */
export function getDefaultSettings() {
  return {
    importantBugs: {
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
    },
    staleIssues: {
      activityTimeRanges: [
        { days: 365, points: 50, name: 'extremelyStale' },
        { days: 180, points: 40, name: 'veryStale' },
        { days: 90, points: 30, name: 'moderatelyStale' },
        { days: 60, points: 20, name: 'slightlyStale' },
      ],
      bonusRules: {
        waitingForResponse: {
          enabled: true,
          points: 20,
          labels: [
            'waiting for response',
            'needs more info',
            'needs information',
            'awaiting response',
            'needs feedback',
            'pending response',
            'waiting-for-author',
            'needs author feedback',
          ],
        },
        abandonedByAssignee: { enabled: true, points: 15, daysThreshold: 90 },
        neverAddressed: { enabled: true, points: 15, ageThreshold: 180 },
        highInterestButStale: {
          enabled: true,
          points: 10,
          reactionThreshold: 5,
          commentsThreshold: 10,
          daysThreshold: 90,
        },
        staleMilestone: { enabled: false, points: 10, daysThreshold: 60 },
        markedForClosure: {
          enabled: false,
          points: 5,
          labels: ['duplicate', 'wontfix', 'invalid'],
        },
      },
      thresholds: {
        veryStale: 60,
        moderatelyStale: 40,
        slightlyStale: 20,
      },
    },
  };
}

/**
 * Migrates old settings format to new unified format
 */
function migrateSettings(settings) {
  const defaults = getDefaultSettings();

  // If already in new format, ensure both sections exist
  if (settings.importantBugs || settings.staleIssues) {
    return {
      importantBugs: settings.importantBugs || defaults.importantBugs,
      staleIssues: settings.staleIssues || defaults.staleIssues,
    };
  }

  // Old format: wrap in importantBugs, add staleIssues defaults
  return {
    importantBugs: settings,
    staleIssues: defaults.staleIssues,
  };
}

/**
 * Validates important bugs settings
 */
function validateImportantBugsSettings(bugSettings) {
  const errors = [];

  if (!bugSettings.scoringRules || !bugSettings.thresholds) {
    errors.push('importantBugs: Missing required fields: scoringRules or thresholds');
    return { valid: false, errors };
  }

  const rules = bugSettings.scoringRules;

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
      errors.push(`importantBugs: Missing rule: ${rule}`);
      continue;
    }

    const points = rules[rule].points;
    if (typeof points !== 'number' || points < 0 || points > 200) {
      errors.push(`importantBugs: ${rule}.points must be a number between 0 and 200`);
    }

    if (typeof rules[rule].enabled !== 'boolean') {
      errors.push(`importantBugs: ${rule}.enabled must be a boolean`);
    }
  }

  // Validate recentActivity threshold
  if (rules.recentActivity) {
    const threshold = rules.recentActivity.daysThreshold;
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 365) {
      errors.push('importantBugs: recentActivity.daysThreshold must be between 1 and 365');
    }
  }

  // Validate highReactions threshold
  if (rules.highReactions) {
    const threshold = rules.highReactions.reactionThreshold;
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 100) {
      errors.push('importantBugs: highReactions.reactionThreshold must be between 1 and 100');
    }
  }

  // Validate activeDiscussion
  if (rules.activeDiscussion) {
    const ad = rules.activeDiscussion;

    if (typeof ad.enabled !== 'boolean') {
      errors.push('importantBugs: activeDiscussion.enabled must be a boolean');
    }

    if (typeof ad.baseThreshold !== 'number' || ad.baseThreshold < 0 || ad.baseThreshold > 100) {
      errors.push('importantBugs: activeDiscussion.baseThreshold must be between 0 and 100');
    }

    if (
      typeof ad.pointsPer10Comments !== 'number' ||
      ad.pointsPer10Comments < 0 ||
      ad.pointsPer10Comments > 50
    ) {
      errors.push('importantBugs: activeDiscussion.pointsPer10Comments must be between 0 and 50');
    }

    if (typeof ad.maxPoints !== 'number' || ad.maxPoints < 0 || ad.maxPoints > 100) {
      errors.push('importantBugs: activeDiscussion.maxPoints must be between 0 and 100');
    }
  } else {
    errors.push('importantBugs: Missing rule: activeDiscussion');
  }

  // Validate longstandingButActive thresholds
  if (rules.longstandingButActive) {
    const lba = rules.longstandingButActive;

    if (typeof lba.ageThreshold !== 'number' || lba.ageThreshold < 1 || lba.ageThreshold > 365) {
      errors.push('importantBugs: longstandingButActive.ageThreshold must be between 1 and 365');
    }

    if (
      typeof lba.activityThreshold !== 'number' ||
      lba.activityThreshold < 1 ||
      lba.activityThreshold > 365
    ) {
      errors.push(
        'importantBugs: longstandingButActive.activityThreshold must be between 1 and 365'
      );
    }
  }

  // Validate sentimentAnalysis
  if (rules.sentimentAnalysis) {
    const sa = rules.sentimentAnalysis;

    if (typeof sa.enabled !== 'boolean') {
      errors.push('importantBugs: sentimentAnalysis.enabled must be a boolean');
    }

    if (typeof sa.maxPoints !== 'number' || sa.maxPoints < 0 || sa.maxPoints > 50) {
      errors.push('importantBugs: sentimentAnalysis.maxPoints must be between 0 and 50');
    }
  } else {
    errors.push('importantBugs: Missing rule: sentimentAnalysis');
  }

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = bugSettings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('importantBugs: thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('importantBugs: thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('importantBugs: thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('importantBugs: thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('importantBugs: thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates stale issues settings
 */
function validateStaleIssuesSettings(staleSettings) {
  const errors = [];

  if (
    !staleSettings.activityTimeRanges ||
    !staleSettings.bonusRules ||
    !staleSettings.thresholds
  ) {
    errors.push('staleIssues: Missing required fields: activityTimeRanges, bonusRules, or thresholds');
    return { valid: false, errors };
  }

  // Validate activityTimeRanges
  if (!Array.isArray(staleSettings.activityTimeRanges)) {
    errors.push('staleIssues: activityTimeRanges must be an array');
  } else {
    staleSettings.activityTimeRanges.forEach((range, idx) => {
      if (typeof range.days !== 'number' || range.days < 1 || range.days > 999) {
        errors.push(`staleIssues: activityTimeRanges[${idx}].days must be between 1 and 999`);
      }
      if (typeof range.points !== 'number' || range.points < 0 || range.points > 200) {
        errors.push(`staleIssues: activityTimeRanges[${idx}].points must be between 0 and 200`);
      }
      if (typeof range.name !== 'string' || range.name.trim() === '') {
        errors.push(`staleIssues: activityTimeRanges[${idx}].name must be a non-empty string`);
      }
    });
  }

  // Validate bonusRules
  const rules = staleSettings.bonusRules;
  const expectedRules = [
    'waitingForResponse',
    'abandonedByAssignee',
    'neverAddressed',
    'highInterestButStale',
    'staleMilestone',
    'markedForClosure',
  ];

  for (const ruleName of expectedRules) {
    const rule = rules[ruleName];
    if (!rule) {
      errors.push(`staleIssues: Missing bonusRule: ${ruleName}`);
      continue;
    }

    if (typeof rule.enabled !== 'boolean') {
      errors.push(`staleIssues: bonusRules.${ruleName}.enabled must be boolean`);
    }

    if (typeof rule.points !== 'number' || rule.points < 0 || rule.points > 200) {
      errors.push(`staleIssues: bonusRules.${ruleName}.points must be between 0 and 200`);
    }

    // Validate rule-specific thresholds
    if (ruleName === 'waitingForResponse' || ruleName === 'markedForClosure') {
      if (!Array.isArray(rule.labels)) {
        errors.push(`staleIssues: bonusRules.${ruleName}.labels must be an array`);
      }
    }

    if (ruleName === 'abandonedByAssignee' || ruleName === 'staleMilestone') {
      if (typeof rule.daysThreshold !== 'number' || rule.daysThreshold < 1 || rule.daysThreshold > 365) {
        errors.push(`staleIssues: bonusRules.${ruleName}.daysThreshold must be between 1 and 365`);
      }
    }

    if (ruleName === 'neverAddressed') {
      if (typeof rule.ageThreshold !== 'number' || rule.ageThreshold < 1 || rule.ageThreshold > 999) {
        errors.push(`staleIssues: bonusRules.${ruleName}.ageThreshold must be between 1 and 999`);
      }
    }

    if (ruleName === 'highInterestButStale') {
      if (
        typeof rule.reactionThreshold !== 'number' ||
        rule.reactionThreshold < 0 ||
        rule.reactionThreshold > 100
      ) {
        errors.push(
          `staleIssues: bonusRules.${ruleName}.reactionThreshold must be between 0 and 100`
        );
      }
      if (
        typeof rule.commentsThreshold !== 'number' ||
        rule.commentsThreshold < 0 ||
        rule.commentsThreshold > 100
      ) {
        errors.push(
          `staleIssues: bonusRules.${ruleName}.commentsThreshold must be between 0 and 100`
        );
      }
      if (
        typeof rule.daysThreshold !== 'number' ||
        rule.daysThreshold < 1 ||
        rule.daysThreshold > 365
      ) {
        errors.push(`staleIssues: bonusRules.${ruleName}.daysThreshold must be between 1 and 365`);
      }
    }
  }

  // Validate thresholds (veryStale > moderatelyStale > slightlyStale >= 0)
  const { veryStale, moderatelyStale, slightlyStale } = staleSettings.thresholds;

  if (typeof veryStale !== 'number' || veryStale < 0 || veryStale > 500) {
    errors.push('staleIssues: thresholds.veryStale must be a number between 0 and 500');
  }

  if (typeof moderatelyStale !== 'number' || moderatelyStale < 0 || moderatelyStale > 500) {
    errors.push('staleIssues: thresholds.moderatelyStale must be a number between 0 and 500');
  }

  if (typeof slightlyStale !== 'number' || slightlyStale < 0 || slightlyStale > 500) {
    errors.push('staleIssues: thresholds.slightlyStale must be a number between 0 and 500');
  }

  if (typeof veryStale === 'number' && typeof moderatelyStale === 'number' && veryStale <= moderatelyStale) {
    errors.push('staleIssues: thresholds.veryStale must be greater than thresholds.moderatelyStale');
  }

  if (typeof moderatelyStale === 'number' && typeof slightlyStale === 'number' && moderatelyStale <= slightlyStale) {
    errors.push(
      'staleIssues: thresholds.moderatelyStale must be greater than thresholds.slightlyStale'
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates user-submitted settings for both important bugs and stale issues
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings.importantBugs || !settings.staleIssues) {
    return { valid: false, errors: ['Missing required sections: importantBugs or staleIssues'] };
  }

  // Validate important bugs
  const bugValidation = validateImportantBugsSettings(settings.importantBugs);
  errors.push(...bugValidation.errors);

  // Validate stale issues
  const staleValidation = validateStaleIssuesSettings(settings.staleIssues);
  errors.push(...staleValidation.errors);

  return { valid: errors.length === 0, errors };
}

/**
 * Helper to load repo settings with fallback to defaults and migration
 */
export function loadRepoSettings(repoId) {
  const repoSettings = settingsQueries.findByRepoId.get(repoId);

  if (!repoSettings) {
    return getDefaultSettings();
  }

  try {
    const parsed = JSON.parse(repoSettings.settings);
    return migrateSettings(parsed);
  } catch (error) {
    console.error(`Failed to parse settings for repo ${repoId}:`, error);
    return getDefaultSettings();
  }
}
