import { settingsQueries } from '../db/queries.js';

/**
 * Returns default settings for bugs, stale, community, and features
 */
export function getDefaultSettings() {
  return {
    general: {
      labels: {
        bug: 'bug, defect, error, crash, broken, [type] bug',
        feature: 'enhancement, feature, feature request, new feature, proposal, [type] enhancement, [type] feature',
        highPriority: 'critical, high priority, urgent, severity: high, p0, p1, blocker, showstopper, priority high, priority: high, [priority] high',
        lowPriority: 'priority low, priority: low, [priority] low, low priority'
      },
      maintainerTeam: {
        org: '',
        teamSlug: ''
      }
    },
    bugs: {
      scoringRules: {
        highPriorityLabels: { enabled: true, points: 30 },
        lowPriorityLabels: { enabled: true, points: -20 },
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
      thresholds: {
        critical: 60,
        high: 40,
        medium: 20,
      },
    },
    features: {
      scoringRules: {
        reactions: {
          enabled: true,
        },
        uniqueCommenters: {
          enabled: true,
        },
        meTooComments: {
          enabled: true,
          points: 5,
          minimumCount: 3,
        },
        activeDiscussion: {
          enabled: true,
        },
        recentActivity: {
          enabled: true,
          recentThreshold: 30,    // days
          recentPoints: 10,
          moderateThreshold: 90,  // days
          moderatePoints: 5,
        },
        hasMilestone: {
          enabled: true,
          points: 10,
        },
        hasAssignee: {
          enabled: true,
          points: 5,
        },
        authorType: {
          enabled: true,
          teamPoints: 5,
          contributorPoints: 3,
          firstTimePoints: 2,
        },
        sentimentAnalysis: {
          enabled: true,
          maxPoints: 10,
        },
        stalePenalty: {
          enabled: true,
          points: -10,
          ageThreshold: 180,        // days since created
          inactivityThreshold: 90,  // days since updated
        },
        rejectionPenalty: {
          enabled: true,
          points: -50,
        },
        vagueDescriptionPenalty: {
          enabled: true,
          points: -5,
          lengthThreshold: 100,
        },
      },
      thresholds: {
        critical: 70,
        high: 50,
        medium: 30,
      },
    },
    stalePRs: {
      activityTimeRanges: [
        { days: 180, points: 50, name: 'extremelyStale' },
        { days: 90, points: 40, name: 'veryStale' },
        { days: 60, points: 30, name: 'moderatelyStale' },
        { days: 30, points: 20, name: 'slightlyStale' },
      ],
      bonusRules: {
        reviewStatus: {
          enabled: true,
          noReviewsPoints: 20,
          changesRequestedPoints: 30,
          approvedNotMergedPoints: 15,
        },
        draftPenalty: {
          enabled: true,
          points: -10,  // Negative = reduce score for draft PRs
        },
        abandonedByContributor: {
          enabled: true,
          points: 20,
          daysThreshold: 90,
        },
        mergeConflicts: {
          enabled: true,
          points: 30,
        },
        highInterestButStale: {
          enabled: true,
          points: 10,
          reactionThreshold: 5,
          commentsThreshold: 10,
          daysThreshold: 90,
        },
      },
      thresholds: {
        critical: 125,
        high: 100,
        medium: 70,
      },
    },
  };
}

/**
 * Ensures settings have all required sections with defaults
 */
function migrateSettings(settings) {
  const defaults = getDefaultSettings();

  return {
    general: settings.general || defaults.general,
    bugs: settings.bugs || defaults.bugs,
    stale: settings.stale || defaults.stale,
    community: settings.community || defaults.community,
    features: settings.features || defaults.features,
    stalePRs: settings.stalePRs || defaults.stalePRs,
  };
}

/**
 * Validates bugs settings
 */
function validateBugsSettings(bugSettings) {
  const errors = [];

  if (!bugSettings.scoringRules || !bugSettings.thresholds) {
    errors.push('bugs: Missing required fields: scoringRules or thresholds');
    return { valid: false, errors };
  }

  const rules = bugSettings.scoringRules;

  // Validate simple rules (0-200 points)
  const simpleRules = [
    'highPriorityLabels',
    'lowPriorityLabels',
    'recentActivity',
    'highReactions',
    'assigned',
    'milestone',
    'longstandingButActive',
  ];

  for (const rule of simpleRules) {
    if (!rules[rule]) {
      errors.push(`bugs: Missing rule: ${rule}`);
      continue;
    }

    const points = rules[rule].points;
    if (typeof points !== 'number' || points < -200 || points > 200) {
      errors.push(`bugs: ${rule}.points must be a number between -200 and 200`);
    }

    if (typeof rules[rule].enabled !== 'boolean') {
      errors.push(`bugs: ${rule}.enabled must be a boolean`);
    }
  }

  // Validate recentActivity threshold
  if (rules.recentActivity) {
    const threshold = rules.recentActivity.daysThreshold;
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 365) {
      errors.push('bugs: recentActivity.daysThreshold must be between 1 and 365');
    }
  }

  // Validate highReactions threshold
  if (rules.highReactions) {
    const threshold = rules.highReactions.reactionThreshold;
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 100) {
      errors.push('bugs: highReactions.reactionThreshold must be between 1 and 100');
    }
  }

  // Validate activeDiscussion
  if (rules.activeDiscussion) {
    const ad = rules.activeDiscussion;

    if (typeof ad.enabled !== 'boolean') {
      errors.push('bugs: activeDiscussion.enabled must be a boolean');
    }

    if (typeof ad.baseThreshold !== 'number' || ad.baseThreshold < 0 || ad.baseThreshold > 100) {
      errors.push('bugs: activeDiscussion.baseThreshold must be between 0 and 100');
    }

    if (
      typeof ad.pointsPer10Comments !== 'number' ||
      ad.pointsPer10Comments < 0 ||
      ad.pointsPer10Comments > 50
    ) {
      errors.push('bugs: activeDiscussion.pointsPer10Comments must be between 0 and 50');
    }

    if (typeof ad.maxPoints !== 'number' || ad.maxPoints < 0 || ad.maxPoints > 100) {
      errors.push('bugs: activeDiscussion.maxPoints must be between 0 and 100');
    }
  } else {
    errors.push('bugs: Missing rule: activeDiscussion');
  }

  // Validate longstandingButActive thresholds
  if (rules.longstandingButActive) {
    const lba = rules.longstandingButActive;

    if (typeof lba.ageThreshold !== 'number' || lba.ageThreshold < 1 || lba.ageThreshold > 365) {
      errors.push('bugs: longstandingButActive.ageThreshold must be between 1 and 365');
    }

    if (
      typeof lba.activityThreshold !== 'number' ||
      lba.activityThreshold < 1 ||
      lba.activityThreshold > 365
    ) {
      errors.push(
        'bugs: longstandingButActive.activityThreshold must be between 1 and 365'
      );
    }
  }

  // Validate sentimentAnalysis
  if (rules.sentimentAnalysis) {
    const sa = rules.sentimentAnalysis;

    if (typeof sa.enabled !== 'boolean') {
      errors.push('bugs: sentimentAnalysis.enabled must be a boolean');
    }

    if (typeof sa.maxPoints !== 'number' || sa.maxPoints < 0 || sa.maxPoints > 50) {
      errors.push('bugs: sentimentAnalysis.maxPoints must be between 0 and 50');
    }
  } else {
    errors.push('bugs: Missing rule: sentimentAnalysis');
  }

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = bugSettings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('bugs: thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('bugs: thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('bugs: thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('bugs: thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('bugs: thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates stale settings
 */
function validateStaleSettings(staleSettings) {
  const errors = [];

  if (
    !staleSettings.activityTimeRanges ||
    !staleSettings.bonusRules ||
    !staleSettings.thresholds
  ) {
    errors.push('stale: Missing required fields: activityTimeRanges, bonusRules, or thresholds');
    return { valid: false, errors };
  }

  // Validate activityTimeRanges
  if (!Array.isArray(staleSettings.activityTimeRanges)) {
    errors.push('stale: activityTimeRanges must be an array');
  } else {
    staleSettings.activityTimeRanges.forEach((range, idx) => {
      if (typeof range.days !== 'number' || range.days < 1 || range.days > 999) {
        errors.push(`stale: activityTimeRanges[${idx}].days must be between 1 and 999`);
      }
      if (typeof range.points !== 'number' || range.points < 0 || range.points > 200) {
        errors.push(`stale: activityTimeRanges[${idx}].points must be between 0 and 200`);
      }
      if (typeof range.name !== 'string' || range.name.trim() === '') {
        errors.push(`stale: activityTimeRanges[${idx}].name must be a non-empty string`);
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
      errors.push(`stale: Missing bonusRule: ${ruleName}`);
      continue;
    }

    if (typeof rule.enabled !== 'boolean') {
      errors.push(`stale: bonusRules.${ruleName}.enabled must be boolean`);
    }

    if (typeof rule.points !== 'number' || rule.points < 0 || rule.points > 200) {
      errors.push(`stale: bonusRules.${ruleName}.points must be between 0 and 200`);
    }

    // Validate rule-specific thresholds
    if (ruleName === 'waitingForResponse' || ruleName === 'markedForClosure') {
      if (!Array.isArray(rule.labels)) {
        errors.push(`stale: bonusRules.${ruleName}.labels must be an array`);
      }
    }

    if (ruleName === 'abandonedByAssignee' || ruleName === 'staleMilestone') {
      if (typeof rule.daysThreshold !== 'number' || rule.daysThreshold < 1 || rule.daysThreshold > 365) {
        errors.push(`stale: bonusRules.${ruleName}.daysThreshold must be between 1 and 365`);
      }
    }

    if (ruleName === 'neverAddressed') {
      if (typeof rule.ageThreshold !== 'number' || rule.ageThreshold < 1 || rule.ageThreshold > 999) {
        errors.push(`stale: bonusRules.${ruleName}.ageThreshold must be between 1 and 999`);
      }
    }

    if (ruleName === 'highInterestButStale') {
      if (
        typeof rule.reactionThreshold !== 'number' ||
        rule.reactionThreshold < 0 ||
        rule.reactionThreshold > 100
      ) {
        errors.push(
          `stale: bonusRules.${ruleName}.reactionThreshold must be between 0 and 100`
        );
      }
      if (
        typeof rule.commentsThreshold !== 'number' ||
        rule.commentsThreshold < 0 ||
        rule.commentsThreshold > 100
      ) {
        errors.push(
          `stale: bonusRules.${ruleName}.commentsThreshold must be between 0 and 100`
        );
      }
      if (
        typeof rule.daysThreshold !== 'number' ||
        rule.daysThreshold < 1 ||
        rule.daysThreshold > 365
      ) {
        errors.push(`stale: bonusRules.${ruleName}.daysThreshold must be between 1 and 365`);
      }
    }
  }

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = staleSettings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('stale: thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('stale: thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('stale: thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('stale: thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('stale: thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates community settings
 */
function validateCommunitySettings(healthSettings) {
  const errors = [];

  if (!healthSettings.scoringRules || !healthSettings.thresholds) {
    errors.push('community: Missing required fields: scoringRules or thresholds');
    return { valid: false, errors };
  }

  const rules = healthSettings.scoringRules;

  // Validate firstTimeContributor
  if (!rules.firstTimeContributor) {
    errors.push('community: Missing rule: firstTimeContributor');
  } else {
    const ftc = rules.firstTimeContributor;

    if (typeof ftc.enabled !== 'boolean') {
      errors.push('community: firstTimeContributor.enabled must be boolean');
    }

    if (typeof ftc.points !== 'number' || ftc.points < 0 || ftc.points > 200) {
      errors.push('community: firstTimeContributor.points must be between 0 and 200');
    }
  }

  // Validate meTooComments
  if (!rules.meTooComments) {
    errors.push('community: Missing rule: meTooComments');
  } else {
    const mtc = rules.meTooComments;

    if (typeof mtc.enabled !== 'boolean') {
      errors.push('community: meTooComments.enabled must be boolean');
    }

    if (typeof mtc.points !== 'number' || mtc.points < 0 || mtc.points > 200) {
      errors.push('community: meTooComments.points must be between 0 and 200');
    }

    if (typeof mtc.minimumCount !== 'number' || mtc.minimumCount < 1 || mtc.minimumCount > 100) {
      errors.push('community: meTooComments.minimumCount must be between 1 and 100');
    }
  }

  // Validate sentimentAnalysis
  if (!rules.sentimentAnalysis) {
    errors.push('community: Missing rule: sentimentAnalysis');
  } else {
    const sa = rules.sentimentAnalysis;

    if (typeof sa.enabled !== 'boolean') {
      errors.push('community: sentimentAnalysis.enabled must be boolean');
    }

    if (typeof sa.maxPoints !== 'number' || sa.maxPoints < 0 || sa.maxPoints > 50) {
      errors.push('community: sentimentAnalysis.maxPoints must be between 0 and 50');
    }
  }

  // Validate thresholds (critical > high > medium >= 0)
  const { critical, high, medium } = healthSettings.thresholds;

  if (typeof critical !== 'number' || critical < 0 || critical > 500) {
    errors.push('community: thresholds.critical must be a number between 0 and 500');
  }

  if (typeof high !== 'number' || high < 0 || high > 500) {
    errors.push('community: thresholds.high must be a number between 0 and 500');
  }

  if (typeof medium !== 'number' || medium < 0 || medium > 500) {
    errors.push('community: thresholds.medium must be a number between 0 and 500');
  }

  if (typeof critical === 'number' && typeof high === 'number' && critical <= high) {
    errors.push('community: thresholds.critical must be greater than thresholds.high');
  }

  if (typeof high === 'number' && typeof medium === 'number' && high <= medium) {
    errors.push('community: thresholds.high must be greater than thresholds.medium');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates general settings
 */
function validateGeneralSettings(generalSettings) {
  const errors = [];

  if (!generalSettings || typeof generalSettings !== 'object') {
    errors.push('general: must be an object');
    return { valid: false, errors };
  }

  // Validate labels object
  const labels = generalSettings.labels;
  if (!labels || typeof labels !== 'object') {
    errors.push('general: labels must be an object');
  } else {
    if (typeof labels.bug !== 'string' || labels.bug.trim() === '') {
      errors.push('general: labels.bug must be a non-empty string');
    }
    if (typeof labels.feature !== 'string' || labels.feature.trim() === '') {
      errors.push('general: labels.feature must be a non-empty string');
    }
    if (typeof labels.highPriority !== 'string' || labels.highPriority.trim() === '') {
      errors.push('general: labels.highPriority must be a non-empty string');
    }
    if (typeof labels.lowPriority !== 'string' || labels.lowPriority.trim() === '') {
      errors.push('general: labels.lowPriority must be a non-empty string');
    }
  }

  // Validate maintainerTeam (org and teamSlug can be empty but must be strings)
  const maintainerTeam = generalSettings.maintainerTeam;
  if (!maintainerTeam || typeof maintainerTeam !== 'object') {
    errors.push('general: maintainerTeam must be an object');
  } else {
    if (typeof maintainerTeam.org !== 'string') {
      errors.push('general: maintainerTeam.org must be string');
    }
    if (typeof maintainerTeam.teamSlug !== 'string') {
      errors.push('general: maintainerTeam.teamSlug must be string');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates user-submitted settings for general, bugs, stale, community, and features
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSettings(settings) {
  const errors = [];

  if (!settings.general || !settings.bugs || !settings.stale || !settings.community) {
    return { valid: false, errors: ['Missing required sections: general, bugs, stale, or community'] };
  }

  // Validate general
  const generalValidation = validateGeneralSettings(settings.general);
  errors.push(...generalValidation.errors);

  // Validate bugs
  const bugValidation = validateBugsSettings(settings.bugs);
  errors.push(...bugValidation.errors);

  // Validate stale
  const staleValidation = validateStaleSettings(settings.stale);
  errors.push(...staleValidation.errors);

  // Validate community
  const healthValidation = validateCommunitySettings(settings.community);
  errors.push(...healthValidation.errors);

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
    const parsed = JSON.parse(repoSettings.settings);
    return migrateSettings(parsed);
  } catch (error) {
    console.error(`Failed to parse settings for repo ${repoId}:`, error);
    return getDefaultSettings();
  }
}
