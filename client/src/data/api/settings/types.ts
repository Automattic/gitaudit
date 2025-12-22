export interface ThresholdSettings {
  critical: number;
  high: number;
  medium: number;
}

export interface GeneralSettings {
  labels: {
    bug: string;
    feature: string;
    highPriority: string;
    lowPriority: string;
  };
  maintainerTeam: {
    org: string;
    teamSlug: string;
  };
}

export interface ImportantBugsSettings {
  thresholds: ThresholdSettings;
  scoringRules: {
    highPriorityLabels: {
      enabled: boolean;
      points: number;
    };
    lowPriorityLabels: {
      enabled: boolean;
      points: number;
    };
    [key: string]: any;
  };
}

export interface StaleIssuesSettings {
  thresholds: ThresholdSettings;
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
}

export interface FeatureRequestSettings {
  thresholds: ThresholdSettings;
  scoringRules: {
    [key: string]: any;
  };
}

export interface StalePRsSettings {
  thresholds: ThresholdSettings;
  activityTimeRanges: Array<{ days: number; points: number; name: string }>;
  bonusRules: {
    [key: string]: any;
  };
}

export interface LLMSettings {
  enabled: boolean;
  provider: 'anthropic' | 'openai';
  /**
   * API key for the LLM provider.
   * - When reading: Will be "***SET***" if a key exists, empty string if not set
   * - When writing: Provide actual key to update, "***SET***" or omit to preserve existing
   */
  apiKey: string;
  model: string;
}

export interface RepoSettings {
  general: GeneralSettings;
  bugs: ImportantBugsSettings;
  stale: StaleIssuesSettings;
  community: CommunityHealthSettings;
  features: FeatureRequestSettings;
  stalePRs: StalePRsSettings;
  llm: LLMSettings;
}
