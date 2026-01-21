/**
 * Query key factory following wp-calypso patterns
 * Hierarchical structure for easy invalidation
 */
export const queryKeys = {
  // Auth keys
  auth: {
    verify: () => ['auth', 'verify'] as const,
  },

  // Repository keys
  repos: {
    all: () => ['repos'] as const,
    list: () => [...queryKeys.repos.all(), 'list'] as const,
    browse: (limit?: number) => [...queryKeys.repos.all(), 'browse', { limit }] as const,
    search: (query: string) => [...queryKeys.repos.all(), 'search', query] as const,
    detail: (owner: string, repo: string) => [...queryKeys.repos.all(), owner, repo] as const,
    status: (owner: string, repo: string) => [...queryKeys.repos.detail(owner, repo), 'status'] as const,
    permission: (owner: string, repo: string) => [...queryKeys.repos.detail(owner, repo), 'permission'] as const,
  },

  // Issues keys
  issues: {
    all: () => ['issues'] as const,
    repo: (owner: string, repo: string) => [...queryKeys.issues.all(), owner, repo] as const,
    list: (
      owner: string,
      repo: string,
      params: {
        page: number;
        per_page: number;
        scoreType: string;
        issueType?: string;
        level?: string;
        search?: string;
      }
    ) => [...queryKeys.issues.repo(owner, repo), 'list', params] as const,
  },

  // PRs keys
  prs: {
    all: () => ['prs'] as const,
    repo: (owner: string, repo: string) => [...queryKeys.prs.all(), owner, repo] as const,
    list: (
      owner: string,
      repo: string,
      params: {
        page: number;
        per_page: number;
        scoreType?: string;
        level?: string;
        search?: string;
      }
    ) => [...queryKeys.prs.repo(owner, repo), 'list', params] as const,
  },

  // Settings keys
  settings: {
    all: () => ['settings'] as const,
    repo: (owner: string, repo: string) => [...queryKeys.settings.all(), owner, repo] as const,
  },

  // Metrics keys (for performance tracking)
  metrics: {
    all: () => ['metrics'] as const,
    repo: (owner: string, repo: string) => [...queryKeys.metrics.all(), owner, repo] as const,
    list: (owner: string, repo: string) => [...queryKeys.metrics.repo(owner, repo), 'list'] as const,
    token: (owner: string, repo: string) => [...queryKeys.metrics.repo(owner, repo), 'token'] as const,
    publicStatus: (owner: string, repo: string) => [...queryKeys.metrics.repo(owner, repo), 'publicStatus'] as const,
    info: (owner: string, repo: string) => [...queryKeys.metrics.repo(owner, repo), 'info'] as const,
  },

  // Performance data keys (for metric evolution and averages)
  perf: {
    all: () => ['perf'] as const,
    repo: (owner: string, repo: string) => [...queryKeys.perf.all(), owner, repo] as const,
    evolution: (owner: string, repo: string, metricId: number, limit: number, branch: string) =>
      [...queryKeys.perf.repo(owner, repo), 'evolution', metricId, limit, branch] as const,
    average: (owner: string, repo: string, metricId: number, branch: string) =>
      [...queryKeys.perf.repo(owner, repo), 'average', metricId, branch] as const,
  },

  // Public repos keys (for homepage)
  publicRepos: {
    all: () => ['publicRepos'] as const,
    list: () => [...queryKeys.publicRepos.all(), 'list'] as const,
  },

  // Collaborators keys (for custom repos)
  collaborators: {
    all: () => ['collaborators'] as const,
    repo: (owner: string, repo: string) =>
      [...queryKeys.collaborators.all(), owner, repo] as const,
    list: (owner: string, repo: string) =>
      [...queryKeys.collaborators.repo(owner, repo), 'list'] as const,
  },
} as const;
