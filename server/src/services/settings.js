import { settingsQueries } from '../db/queries.js';

/**
 * Returns default settings for bugs, stale, and community
 */
export function getDefaultSettings() {
  return {
    bugs: {
      scoringRules: {
        priorityLabels: {
          enabled: true,
          points: 30,
          labels: 'critical, high priority, urgent, severity: high, p0, p1, blocker, showstopper, priority high, priority: high, [priority] high'
        },
        lowPriorityLabels: {
          enabled: true,
          points: -20,
          labels: 'priority low, priority: low, [priority] low, low priority'
        },
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
    stale: {
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
        critical: 60,
        high: 40,
        medium: 20,
      },
    },
    community: {
      scoringRules: {
        firstTimeContributor: {
          enabled: true,
          points: 30,
        },
        meTooComments: {
          enabled: true,
          points: 20,
          minimumCount: 3, // min "me too" style comments
        },
        sentimentAnalysis: {
          enabled: true,
          maxPoints: 30,
        },
      },
      maintainerTeam: {
        org: '', // e.g., 'facebook'
        teamSlug: '', // e.g., 'react-core'
      },
      thresholds: {
        critical: 60,
        high: 40,
        medium: 20,
      },
    },
  };
}

/**
 * Migrates old settings format to new unified format
 */
function migrateSettings(settings) {
  const defaults = getDefaultSettings();

  let bugs;
  let stale;
  let community;

  // Handle new format (bugs, stale, community)
  if (settings.bugs || settings.stale || settings.community) {
    bugs = settings.bugs || defaults.bugs;
    stale = settings.stale || defaults.stale;
    community = settings.community || defaults.community;
  }
  // Handle old format (importantBugs, staleIssues, communityHealth)
  else if (settings.importantBugs || settings.staleIssues || settings.communityHealth) {
    bugs = settings.importantBugs || defaults.bugs;
    stale = settings.staleIssues || defaults.stale;
    community = settings.communityHealth || defaults.community;
  } else {
    // Very old format: wrap in bugs, add stale and community defaults
    bugs = settings;
    stale = defaults.stale;
    community = defaults.community;
  }

  // Migrate priorityLabels and lowPriorityLabels to include labels field if missing
  if (bugs.scoringRules) {
    if (bugs.scoringRules.priorityLabels && !bugs.scoringRules.priorityLabels.labels) {
      bugs.scoringRules.priorityLabels.labels = defaults.bugs.scoringRules.priorityLabels.labels;
    }

    if (bugs.scoringRules.lowPriorityLabels && !bugs.scoringRules.lowPriorityLabels.labels) {
      bugs.scoringRules.lowPriorityLabels.labels = defaults.bugs.scoringRules.lowPriorityLabels.labels;
    }

    // Add lowPriorityLabels rule if it doesn't exist (for very old settings)
    if (!bugs.scoringRules.lowPriorityLabels) {
      bugs.scoringRules.lowPriorityLabels = defaults.bugs.scoringRules.lowPriorityLabels;
    }
  }

  return {
    bugs,
    stale,
    community,
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
    'lowPriorityLabels',
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
    if (typeof points !== 'number' || points < -200 || points > 200) {
      errors.push(`importantBugs: ${rule}.points must be a number between -200 and 200`);
    }

    if (typeof rules[rule].enabled !== 'boolean') {
      errors.push(`importantBugs: ${rule}.enabled must be a boolean`);
    }
  }

  // Validate priorityLabels and lowPriorityLabels have labels field
  if (rules.priorityLabels) {
    if (typeof rules.priorityLabels.labels !== 'string' || rules.priorityLabels.labels.trim() === '') {
      errors.push('importantBugs: priorityLabels.labels must be a non-empty string');
    }
  }

  if (rules.lowPriorityLabels) {
    if (typeof rules.lowPriorityLabels.labels !== 'string' || rules.lowPriorityLabels.labels.trim() === '') {
      errors.push('importantBugs: lowPriorityLabels.labels must be a non-empty string');
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

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = staleSettings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('staleIssues: thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('staleIssues: thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('staleIssues: thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('staleIssues: thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('staleIssues: thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates community health settings
 */
function validateCommunityHealthSettings(healthSettings) {
  const errors = [];

  if (!healthSettings.scoringRules || !healthSettings.maintainerTeam || !healthSettings.thresholds) {
    errors.push('communityHealth: Missing required fields: scoringRules, maintainerTeam, or thresholds');
    return { valid: false, errors };
  }

  const rules = healthSettings.scoringRules;

  // Validate firstTimeContributor
  if (!rules.firstTimeContributor) {
    errors.push('communityHealth: Missing rule: firstTimeContributor');
  } else {
    const ftc = rules.firstTimeContributor;

    if (typeof ftc.enabled !== 'boolean') {
      errors.push('communityHealth: firstTimeContributor.enabled must be boolean');
    }

    if (typeof ftc.points !== 'number' || ftc.points < 0 || ftc.points > 200) {
      errors.push('communityHealth: firstTimeContributor.points must be between 0 and 200');
    }
  }

  // Validate meTooComments
  if (!rules.meTooComments) {
    errors.push('communityHealth: Missing rule: meTooComments');
  } else {
    const mtc = rules.meTooComments;

    if (typeof mtc.enabled !== 'boolean') {
      errors.push('communityHealth: meTooComments.enabled must be boolean');
    }

    if (typeof mtc.points !== 'number' || mtc.points < 0 || mtc.points > 200) {
      errors.push('communityHealth: meTooComments.points must be between 0 and 200');
    }

    if (typeof mtc.minimumCount !== 'number' || mtc.minimumCount < 1 || mtc.minimumCount > 100) {
      errors.push('communityHealth: meTooComments.minimumCount must be between 1 and 100');
    }
  }

  // Validate sentimentAnalysis
  if (!rules.sentimentAnalysis) {
    errors.push('communityHealth: Missing rule: sentimentAnalysis');
  } else {
    const sa = rules.sentimentAnalysis;

    if (typeof sa.enabled !== 'boolean') {
      errors.push('communityHealth: sentimentAnalysis.enabled must be boolean');
    }

    if (typeof sa.maxPoints !== 'number' || sa.maxPoints < 0 || sa.maxPoints > 50) {
      errors.push('communityHealth: sentimentAnalysis.maxPoints must be between 0 and 50');
    }
  }

  // Validate maintainerTeam (org and teamSlug can be empty but must be strings)
  const team = healthSettings.maintainerTeam;
  if (typeof team.org !== 'string') {
    errors.push('communityHealth: maintainerTeam.org must be a string');
  }

  if (typeof team.teamSlug !== 'string') {
    errors.push('communityHealth: maintainerTeam.teamSlug must be a string');
  }

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = healthSettings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('communityHealth: thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('communityHealth: thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('communityHealth: thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('communityHealth: thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('communityHealth: thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates user-submitted settings for bugs, stale, and community
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings.bugs || !settings.stale || !settings.community) {
    return { valid: false, errors: ['Missing required sections: bugs, stale, or community'] };
  }

  // Validate bugs
  const bugValidation = validateImportantBugsSettings(settings.bugs);
  errors.push(...bugValidation.errors);

  // Validate stale issues
  const staleValidation = validateStaleIssuesSettings(settings.stale);
  errors.push(...staleValidation.errors);

  // Validate community health
  const healthValidation = validateCommunityHealthSettings(settings.community);
  errors.push(...healthValidation.errors);

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
