import { apiClient } from '../client';
import { SaveRepoRequest, CreateLocalRepoRequest, UpdateLocalRepoRequest, Repository } from './types';

/**
 * Save a repository to user's list
 */
export const saveRepo = async (data: SaveRepoRequest): Promise<Repository> => {
  return apiClient.post<Repository>('/api/repos/save', data);
};

/**
 * Delete a repository from user's list
 */
export const deleteRepo = async (repoId: number): Promise<void> => {
  return apiClient.delete<void>(`/api/repos/${repoId}`);
};

/**
 * Fetch repository data (issues and PRs) from GitHub
 */
export const fetchRepoData = async (owner: string, repo: string): Promise<void> => {
  return apiClient.post<void>(`/api/repos/${owner}/${repo}/fetch`);
};

/**
 * Create a local (non-GitHub) repository
 */
export const createLocalRepo = async (data: CreateLocalRepoRequest): Promise<{ repo: Repository }> => {
  return apiClient.post<{ repo: Repository }>('/api/repos/local', data);
};

/**
 * Update a custom (non-GitHub) repository's info
 */
export const updateLocalRepo = async (
  owner: string,
  repo: string,
  data: UpdateLocalRepoRequest
): Promise<{ repo: Repository }> => {
  return apiClient.patch<{ repo: Repository }>(`/api/repos/${owner}/${repo}`, data);
};

/**
 * Fully delete a repository and all associated data (admin only)
 */
export const fullDeleteRepo = async (owner: string, repo: string): Promise<void> => {
  return apiClient.delete<void>(`/api/repos/${owner}/${repo}/full`);
};
