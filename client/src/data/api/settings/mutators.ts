import { apiClient } from '../client';
import { RepoSettings } from './types';

/**
 * Update repository settings
 */
export const updateRepoSettings = async (
  owner: string,
  repo: string,
  settings: RepoSettings
): Promise<RepoSettings> => {
  return apiClient.put<RepoSettings>(`/api/repos/${owner}/${repo}/issues/settings`, settings);
};

/**
 * Reset repository settings to defaults
 */
export const resetRepoSettings = async (
  owner: string,
  repo: string
): Promise<RepoSettings> => {
  return apiClient.delete<RepoSettings>(`/api/repos/${owner}/${repo}/issues/settings`);
};
