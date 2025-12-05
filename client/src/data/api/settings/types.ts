export interface ThresholdSettings {
  critical: number;
  high: number;
  medium: number;
}

export interface StaleIssuesThresholds {
  veryStale: number;
  moderatelyStale: number;
  slightlyStale: number;
}

export interface ImportantBugsSettings {
  thresholds: ThresholdSettings;
  scoringRules: {
    [key: string]: any;
  };
}

export interface StaleIssuesSettings {
  thresholds: StaleIssuesThresholds;
  activityTimeRanges: Array<{ days: number; points: number; name: string }>;
  bonusRules: {
    [key: string]: any;
  };
}

export interface CommunityHealthSettings {
  thresholds: ThresholdSettings;
  scoringRules: {
    [key: string]: any;
  };
  maintainerTeam: {
    org: string;
    teamSlug: string;
  };
}

export interface RepoSettings {
  importantBugs: ImportantBugsSettings;
  staleIssues: StaleIssuesSettings;
  communityHealth: CommunityHealthSettings;
}
