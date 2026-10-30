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
  isGithub: boolean;
  url: string | null;
}

export interface ReposResponse {
  repos: Repository[];
}

export interface SaveRepoRequest {
  owner: string;
  name: string;
}

export interface CreateLocalRepoRequest {
  name: string;
  url: string;
  description?: string;
}

export interface UpdateLocalRepoRequest {
  url?: string;
  description?: string;
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
