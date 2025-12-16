import type { RepoSettings } from '@/data/api/settings/types';

// Type aliases for clarity
type GeneralSettings = RepoSettings['general'];
type ImportantBugsSettings = RepoSettings['bugs'];
type StaleIssuesSettings = RepoSettings['stale'];
type CommunityHealthSettings = RepoSettings['community'];
type FeatureRequestSettings = RepoSettings['features'];
type StalePRsSettings = RepoSettings['stalePRs'];

// Flattened settings type (for forms)
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

// ============================================================================
// GENERAL SETTINGS HELPERS
// ============================================================================

export function flattenGeneralSettings(settings: GeneralSettings): FlattenedSettings {
  return {
    // Labels (only label strings, no enabled/points)
    labels_bug: settings.labels.bug,
    labels_feature: settings.labels.feature,
    labels_highPriority: settings.labels.highPriority,
    labels_lowPriority: settings.labels.lowPriority,

    // Maintainer Team
    maintainerTeam_org: settings.maintainerTeam.org,
    maintainerTeam_teamSlug: settings.maintainerTeam.teamSlug,
  };
}

export function unflattenGeneralSettings(
  edits: Record<string, unknown>,
  currentSettings: GeneralSettings
): GeneralSettings {
  // Deep clone to avoid mutation
  const updated = JSON.parse(JSON.stringify(currentSettings));

  // Apply all edits
  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('labels_')) {
      const labelKey = key.replace('labels_', '');
      updated.labels[labelKey] = value;
    } else if (key.startsWith('maintainerTeam_')) {
      const teamKey = key.replace('maintainerTeam_', '');
      updated.maintainerTeam[teamKey] = value;
    }
  });

  return updated;
}

// ============================================================================
// IMPORTANT BUGS HELPERS
// ============================================================================

export function flattenImportantBugsSettings(settings: ImportantBugsSettings): FlattenedSettings {
  const rules = settings.scoringRules;
  return {
    // High Priority Labels (enabled and points only, labels come from general)
    highPriorityLabels_enabled: rules.highPriorityLabels.enabled,
    highPriorityLabels_points: rules.highPriorityLabels.points,

    // Low Priority Labels (enabled and points only, labels come from general)
    lowPriorityLabels_enabled: rules.lowPriorityLabels.enabled,
    lowPriorityLabels_points: rules.lowPriorityLabels.points,

    // Recent Activity
    recentActivity_enabled: rules.recentActivity.enabled,
    recentActivity_points: rules.recentActivity.points,
    recentActivity_daysThreshold: rules.recentActivity.daysThreshold,

    // High Reactions
    highReactions_enabled: rules.highReactions.enabled,
    highReactions_points: rules.highReactions.points,
    highReactions_reactionThreshold: rules.highReactions.reactionThreshold,

    // Assigned
    assigned_enabled: rules.assigned.enabled,
    assigned_points: rules.assigned.points,

    // Milestone
    milestone_enabled: rules.milestone.enabled,
    milestone_points: rules.milestone.points,

    // Active Discussion
    activeDiscussion_enabled: rules.activeDiscussion.enabled,
    activeDiscussion_baseThreshold: rules.activeDiscussion.baseThreshold,
    activeDiscussion_pointsPer10Comments: rules.activeDiscussion.pointsPer10Comments,
    activeDiscussion_maxPoints: rules.activeDiscussion.maxPoints,

    // Long-standing But Active
    longstandingButActive_enabled: rules.longstandingButActive.enabled,
    longstandingButActive_points: rules.longstandingButActive.points,
    longstandingButActive_ageThreshold: rules.longstandingButActive.ageThreshold,
    longstandingButActive_activityThreshold: rules.longstandingButActive.activityThreshold,

    // Sentiment Analysis
    sentimentAnalysis_enabled: rules.sentimentAnalysis.enabled,
    sentimentAnalysis_maxPoints: rules.sentimentAnalysis.maxPoints,

    // Thresholds
    thresholds_critical: settings.thresholds.critical,
    thresholds_high: settings.thresholds.high,
    thresholds_medium: settings.thresholds.medium,
  };
}

export function unflattenImportantBugsSettings(
  edits: Record<string, unknown>,
  currentSettings: ImportantBugsSettings
): ImportantBugsSettings {
  // Deep clone to avoid mutation
  const updated = JSON.parse(JSON.stringify(currentSettings));

  // Apply all edits
  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('thresholds_')) {
      const thresholdKey = key.replace('thresholds_', '');
      updated.thresholds[thresholdKey] = value;
    } else {
      // Parse rule name and property from key like 'priorityLabels_enabled'
      const firstUnderscore = key.indexOf('_');
      const ruleName = key.substring(0, firstUnderscore);
      const propName = key.substring(firstUnderscore + 1);

      if (updated.scoringRules[ruleName]) {
        updated.scoringRules[ruleName][propName] = value;
      }
    }
  });

  return updated;
}

// ============================================================================
// STALE ISSUES HELPERS
// ============================================================================

export function flattenStaleIssuesSettings(settings: StaleIssuesSettings): FlattenedSettings {
  const flat: Record<string, any> = {};

  // Activity ranges (4 ranges)
  settings.activityTimeRanges.forEach((range, idx) => {
    flat[`activityRange_${idx}_days`] = range.days;
    flat[`activityRange_${idx}_points`] = range.points;
    flat[`activityRange_${idx}_name`] = range.name;
  });

  // Bonus rules (6 rules)
  Object.entries(settings.bonusRules).forEach(([ruleName, rule]) => {
    flat[`${ruleName}_enabled`] = rule.enabled;
    flat[`${ruleName}_points`] = rule.points;

    // Rule-specific fields
    if (rule.daysThreshold !== undefined) {
      flat[`${ruleName}_daysThreshold`] = rule.daysThreshold;
    }
    if (rule.ageThreshold !== undefined) {
      flat[`${ruleName}_ageThreshold`] = rule.ageThreshold;
    }
    if (rule.reactionThreshold !== undefined) {
      flat[`${ruleName}_reactionThreshold`] = rule.reactionThreshold;
    }
    if (rule.commentsThreshold !== undefined) {
      flat[`${ruleName}_commentsThreshold`] = rule.commentsThreshold;
    }
    if (rule.labels !== undefined) {
      flat[`${ruleName}_labels`] = rule.labels;
    }
  });

  // Thresholds
  flat.thresholds_critical = settings.thresholds.critical;
  flat.thresholds_high = settings.thresholds.high;
  flat.thresholds_medium = settings.thresholds.medium;

  return flat;
}

export function unflattenStaleIssuesSettings(
  edits: Record<string, unknown>,
  currentSettings: StaleIssuesSettings
): StaleIssuesSettings {
  // Deep clone to avoid mutation
  const updated = JSON.parse(JSON.stringify(currentSettings));

  // Apply all edits
  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('activityRange_')) {
      // Parse: activityRange_0_days -> idx=0, prop=days
      const parts = key.split('_');
      const idx = parseInt(parts[1]);
      const prop = parts[2];
      updated.activityTimeRanges[idx][prop] = value;
    } else if (key.startsWith('thresholds_')) {
      const thresholdKey = key.replace('thresholds_', '');
      updated.thresholds[thresholdKey] = value;
    } else {
      // Bonus rules: waitingForResponse_enabled -> ruleName=waitingForResponse, prop=enabled
      const firstUnderscore = key.indexOf('_');
      const ruleName = key.substring(0, firstUnderscore);
      const propName = key.substring(firstUnderscore + 1);

      if (updated.bonusRules[ruleName]) {
        updated.bonusRules[ruleName][propName] = value;
      }
    }
  });

  return updated;
}

// ============================================================================
// COMMUNITY HEALTH HELPERS
// ============================================================================

export function flattenCommunityHealthSettings(settings: CommunityHealthSettings): FlattenedSettings {
  const rules = settings.scoringRules;
  return {
    // First-Time Contributor
    firstTimeContributor_enabled: rules.firstTimeContributor.enabled,
    firstTimeContributor_points: rules.firstTimeContributor.points,

    // Me Too Comments
    meTooComments_enabled: rules.meTooComments.enabled,
    meTooComments_points: rules.meTooComments.points,
    meTooComments_minimumCount: rules.meTooComments.minimumCount,

    // Sentiment Analysis
    sentimentAnalysis_enabled: rules.sentimentAnalysis.enabled,
    sentimentAnalysis_maxPoints: rules.sentimentAnalysis.maxPoints,

    // Thresholds
    thresholds_critical: settings.thresholds.critical,
    thresholds_high: settings.thresholds.high,
    thresholds_medium: settings.thresholds.medium,
  };
}

export function unflattenCommunityHealthSettings(
  edits: Record<string, unknown>,
  currentSettings: CommunityHealthSettings
): CommunityHealthSettings {
  // Deep clone to avoid mutation
  const updated = JSON.parse(JSON.stringify(currentSettings));

  // Apply all edits
  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('thresholds_')) {
      const thresholdKey = key.replace('thresholds_', '');
      updated.thresholds[thresholdKey] = value;
    } else {
      // Parse rule name and property from key like 'firstTimeContributor_enabled'
      const firstUnderscore = key.indexOf('_');
      const ruleName = key.substring(0, firstUnderscore);
      const propName = key.substring(firstUnderscore + 1);

      if (updated.scoringRules[ruleName]) {
        updated.scoringRules[ruleName][propName] = value;
      }
    }
  });

  return updated;
}

// ============================================================================
// FEATURE REQUEST HELPERS
// ============================================================================

export function flattenFeatureRequestSettings(settings: FeatureRequestSettings): FlattenedSettings {
  const rules = settings.scoringRules;
  return {
    // Reactions
    reactions_enabled: rules.reactions.enabled,

    // Unique Commenters
    uniqueCommenters_enabled: rules.uniqueCommenters.enabled,

    // Me Too Comments
    meTooComments_enabled: rules.meTooComments.enabled,
    meTooComments_points: rules.meTooComments.points,
    meTooComments_minimumCount: rules.meTooComments.minimumCount,

    // Active Discussion
    activeDiscussion_enabled: rules.activeDiscussion.enabled,

    // Recent Activity
    recentActivity_enabled: rules.recentActivity.enabled,
    recentActivity_recentThreshold: rules.recentActivity.recentThreshold,
    recentActivity_recentPoints: rules.recentActivity.recentPoints,
    recentActivity_moderateThreshold: rules.recentActivity.moderateThreshold,
    recentActivity_moderatePoints: rules.recentActivity.moderatePoints,

    // Has Milestone
    hasMilestone_enabled: rules.hasMilestone.enabled,
    hasMilestone_points: rules.hasMilestone.points,

    // Has Assignee
    hasAssignee_enabled: rules.hasAssignee.enabled,
    hasAssignee_points: rules.hasAssignee.points,

    // Author Type
    authorType_enabled: rules.authorType.enabled,
    authorType_teamPoints: rules.authorType.teamPoints,
    authorType_contributorPoints: rules.authorType.contributorPoints,
    authorType_firstTimePoints: rules.authorType.firstTimePoints,

    // Sentiment Analysis
    sentimentAnalysis_enabled: rules.sentimentAnalysis.enabled,
    sentimentAnalysis_maxPoints: rules.sentimentAnalysis.maxPoints,

    // Stale Penalty
    stalePenalty_enabled: rules.stalePenalty.enabled,
    stalePenalty_points: rules.stalePenalty.points,
    stalePenalty_ageThreshold: rules.stalePenalty.ageThreshold,
    stalePenalty_inactivityThreshold: rules.stalePenalty.inactivityThreshold,

    // Rejection Penalty
    rejectionPenalty_enabled: rules.rejectionPenalty.enabled,
    rejectionPenalty_points: rules.rejectionPenalty.points,

    // Vague Description Penalty
    vagueDescriptionPenalty_enabled: rules.vagueDescriptionPenalty.enabled,
    vagueDescriptionPenalty_points: rules.vagueDescriptionPenalty.points,
    vagueDescriptionPenalty_lengthThreshold: rules.vagueDescriptionPenalty.lengthThreshold,

    // Thresholds
    thresholds_critical: settings.thresholds.critical,
    thresholds_high: settings.thresholds.high,
    thresholds_medium: settings.thresholds.medium,
  };
}

export function unflattenFeatureRequestSettings(
  edits: Record<string, unknown>,
  currentSettings: FeatureRequestSettings
): FeatureRequestSettings {
  // Deep clone to avoid mutation
  const updated = JSON.parse(JSON.stringify(currentSettings));

  // Apply all edits
  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('thresholds_')) {
      const thresholdKey = key.replace('thresholds_', '');
      updated.thresholds[thresholdKey] = value;
    } else {
      // Parse rule name and property from key like 'reactions_enabled'
      const firstUnderscore = key.indexOf('_');
      const ruleName = key.substring(0, firstUnderscore);
      const propName = key.substring(firstUnderscore + 1);

      if (updated.scoringRules[ruleName]) {
        updated.scoringRules[ruleName][propName] = value;
      }
    }
  });

  return updated;
}

// ============================================================================
// STALE PRS HELPERS
// ============================================================================

export function flattenStalePRsSettings(settings: StalePRsSettings): FlattenedSettings {
  const flat: Record<string, any> = {};

  // Activity ranges (4 ranges)
  settings.activityTimeRanges.forEach((range: { days: number; points: number; name: string }, idx: number) => {
    flat[`activityRange_${idx}_days`] = range.days;
    flat[`activityRange_${idx}_points`] = range.points;
    flat[`activityRange_${idx}_name`] = range.name;
  });

  // Bonus rules
  const rules = settings.bonusRules;

  // Review Status
  flat.reviewStatus_enabled = rules.reviewStatus.enabled;
  flat.reviewStatus_noReviewsPoints = rules.reviewStatus.noReviewsPoints;
  flat.reviewStatus_changesRequestedPoints = rules.reviewStatus.changesRequestedPoints;
  flat.reviewStatus_approvedNotMergedPoints = rules.reviewStatus.approvedNotMergedPoints;

  // Draft Penalty
  flat.draftPenalty_enabled = rules.draftPenalty.enabled;
  flat.draftPenalty_points = rules.draftPenalty.points;

  // Abandoned by Contributor
  flat.abandonedByContributor_enabled = rules.abandonedByContributor.enabled;
  flat.abandonedByContributor_points = rules.abandonedByContributor.points;
  flat.abandonedByContributor_daysThreshold = rules.abandonedByContributor.daysThreshold;

  // Merge Conflicts
  flat.mergeConflicts_enabled = rules.mergeConflicts.enabled;
  flat.mergeConflicts_points = rules.mergeConflicts.points;

  // High Interest but Stale
  flat.highInterestButStale_enabled = rules.highInterestButStale.enabled;
  flat.highInterestButStale_points = rules.highInterestButStale.points;
  flat.highInterestButStale_reactionThreshold = rules.highInterestButStale.reactionThreshold;
  flat.highInterestButStale_commentsThreshold = rules.highInterestButStale.commentsThreshold;
  flat.highInterestButStale_daysThreshold = rules.highInterestButStale.daysThreshold;

  // Thresholds
  flat.thresholds_critical = settings.thresholds.critical;
  flat.thresholds_high = settings.thresholds.high;
  flat.thresholds_medium = settings.thresholds.medium;

  return flat;
}

export function unflattenStalePRsSettings(
  edits: Record<string, unknown>,
  currentSettings: StalePRsSettings
): StalePRsSettings {
  // Deep clone to avoid mutation
  const updated = JSON.parse(JSON.stringify(currentSettings));

  // Apply all edits
  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('activityRange_')) {
      const parts = key.split('_');
      const idx = parseInt(parts[1]);
      const prop = parts[2];
      updated.activityTimeRanges[idx][prop] = value;
    } else if (key.startsWith('thresholds_')) {
      const thresholdKey = key.replace('thresholds_', '');
      updated.thresholds[thresholdKey] = value;
    } else {
      // Bonus rules
      const firstUnderscore = key.indexOf('_');
      const ruleName = key.substring(0, firstUnderscore);
      const propName = key.substring(firstUnderscore + 1);

      if (updated.bonusRules[ruleName]) {
        updated.bonusRules[ruleName][propName] = value;
      }
    }
  });

  return updated;
}

// ============================================================================
// LLM SETTINGS HELPERS
// ============================================================================

type LLMSettings = RepoSettings['llm'];

export function flattenLLMSettings(settings: LLMSettings): FlattenedSettings {
  return {
    llm_enabled: settings.enabled,
    llm_provider: settings.provider,
    llm_apiKey: settings.apiKey,
    llm_model: settings.model,
  };
}

export function unflattenLLMSettings(
  edits: Record<string, unknown>,
  currentSettings: LLMSettings
): LLMSettings {
  const updated = JSON.parse(JSON.stringify(currentSettings));

  Object.entries(edits).forEach(([key, value]) => {
    if (key.startsWith('llm_')) {
      const propName = key.replace('llm_', '');
      updated[propName] = value;
    }
  });

  return updated;
}
