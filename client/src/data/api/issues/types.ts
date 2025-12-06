export interface ScoreObject {
  type: 'bugs' | 'stale' | 'community';
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
    bugs?: {
      critical: number;
      high: number;
      medium: number;
    };
    stale?: {
      critical: number;
      high: number;
      medium: number;
    };
    community?: {
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
  scoreType: 'bugs' | 'stale' | 'community';
  issueType?: 'bugs' | 'stale';
  level?: 'all' | 'critical' | 'high' | 'medium';
  search?: string;
  labels?: string[];
}
