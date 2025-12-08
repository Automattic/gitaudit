export interface Repository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  githubId: number;
  description: string | null;
  stars: number;
  language: string | null;
  languageColor: string | null;
  updatedAt: string;
  isPrivate: boolean;
}

export interface ReposResponse {
  repos: Repository[];
}

export interface SaveRepoRequest {
  owner: string;
  name: string;
  githubId: number;
  description: string | null;
  stars: number;
  language: string | null;
  languageColor: string | null;
  updatedAt: string;
  isPrivate: boolean;
}

export interface GitHubRepo {
  databaseId: number;
  name: string;
  description: string | null;
  stargazerCount: number;
  updatedAt: string;
  isPrivate: boolean;
  owner: {
    login: string;
  };
  primaryLanguage: {
    name: string;
    color: string;
  } | null;
}

export interface GitHubReposResponse {
  repos: GitHubRepo[];
}

export interface RepoStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  currentJob?: 'issue-fetch' | 'pr-fetch' | 'sentiment' | null;
  progress?: {
    current: number;
    total: number;
  };
  message?: string;
}
