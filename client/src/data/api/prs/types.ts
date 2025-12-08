export interface PR {
  id: number;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  commentsCount: number;
  labels: string[];
  assignees: string[];
  reviewers: string[];
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  mergeableState: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN' | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  authorLogin: string;
  authorAssociation: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface PRsResponse {
  prs: PR[];
  totalItems: number;
  totalPages: number;
  stats?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
  };
  thresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  fetchStatus: 'not_started' | 'in_progress' | 'completed' | 'failed';
}

export interface PRsQueryParams {
  page: number;
  per_page: number;
  scoreType?: 'stale-prs';
  level?: 'all' | 'critical' | 'high' | 'medium';
  search?: string;
}
