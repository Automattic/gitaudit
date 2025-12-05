export interface ThresholdSettings {
  critical: number;
  high: number;
  medium: number;
}

export interface ImportantBugsSettings {
  thresholds: ThresholdSettings;
  weights: {
    labels: number;
    comments: number;
    age: number;
  };
}

export interface StaleIssuesSettings {
  thresholds: ThresholdSettings;
}

export interface CommunityHealthSettings {
  thresholds: ThresholdSettings;
}

export interface RepoSettings {
  importantBugs: ImportantBugsSettings;
  staleIssues: StaleIssuesSettings;
  communityHealth: CommunityHealthSettings;
}
