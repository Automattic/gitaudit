export interface ScoreObject {
  type: 'importantBugs' | 'staleIssues' | 'communityHealth';
  score: number;
  metadata: Record<string, unknown>;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  scores?: ScoreObject[];
}

export interface IssuesResponse {
  issues: Issue[];
  totalItems: number;
  totalPages: number;
  thresholds?: {
    importantBugs?: {
      critical: number;
      high: number;
      medium: number;
    };
    staleIssues?: {
      veryStale: number;
      moderatelyStale: number;
      slightlyStale: number;
    };
    communityHealth?: {
      critical: number;
      high: number;
      medium: number;
    };
  };
  fetchStatus: 'not_started' | 'in_progress' | 'completed' | 'failed';
}

export interface IssuesQueryParams {
  page: number;
  per_page: number;
  scoreType: 'importantBugs' | 'staleIssues' | 'communityHealth';
  issueType?: 'bugs' | 'stale';
  priority?: 'all' | 'critical' | 'high' | 'medium';
  level?: 'all' | 'veryStale' | 'moderatelyStale' | 'slightlyStale';
  search?: string;
  labels?: string[];
}
