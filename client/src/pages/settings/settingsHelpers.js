// ============================================================================
// IMPORTANT BUGS HELPERS
// ============================================================================

export function flattenImportantBugsSettings(settings) {
  const rules = settings.scoringRules;
  return {
    // Priority Labels
    priorityLabels_enabled: rules.priorityLabels.enabled,
    priorityLabels_points: rules.priorityLabels.points,
    priorityLabels_labels: rules.priorityLabels.labels,

    // Low Priority Labels
    lowPriorityLabels_enabled: rules.lowPriorityLabels.enabled,
    lowPriorityLabels_points: rules.lowPriorityLabels.points,
    lowPriorityLabels_labels: rules.lowPriorityLabels.labels,

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

export function unflattenImportantBugsSettings(edits, currentSettings) {
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

export function flattenStaleIssuesSettings(settings) {
  const flat = {};

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
  flat.thresholds_veryStale = settings.thresholds.veryStale;
  flat.thresholds_moderatelyStale = settings.thresholds.moderatelyStale;
  flat.thresholds_slightlyStale = settings.thresholds.slightlyStale;

  return flat;
}

export function unflattenStaleIssuesSettings(edits, currentSettings) {
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
