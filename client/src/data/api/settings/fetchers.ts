import { apiClient } from '../client';
import { RepoSettings } from './types';

/**
 * Fetch repository settings
 */
export const fetchRepoSettings = async (
  owner: string,
  repo: string
): Promise<RepoSettings> => {
  return apiClient.get<RepoSettings>(`/api/repos/${owner}/${repo}/issues/settings`);
};
