import { apiClient } from '../client';
import { ReposResponse, GitHubReposResponse, RepoStatus } from './types';

/**
 * Fetch user's saved repositories
 */
export const fetchRepos = async (): Promise<ReposResponse> => {
  return apiClient.get<ReposResponse>('/api/repos');
};

/**
 * Browse available GitHub repositories
 */
export const fetchRepoBrowse = async (limit: number = 12): Promise<GitHubReposResponse> => {
  return apiClient.get<GitHubReposResponse>(`/api/repos/browse?limit=${limit}`);
};

/**
 * Search GitHub repositories
 */
export const fetchRepoSearch = async (query: string): Promise<GitHubReposResponse> => {
  return apiClient.get<GitHubReposResponse>(`/api/repos/search?q=${encodeURIComponent(query)}`);
};

/**
 * Fetch repository status (for polling background jobs)
 */
export const fetchRepoStatus = async (owner: string, repo: string): Promise<RepoStatus> => {
  return apiClient.get<RepoStatus>(`/api/repos/${owner}/${repo}/status`);
};
