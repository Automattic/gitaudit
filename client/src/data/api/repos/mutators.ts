import { apiClient } from '../client';
import { SaveRepoRequest, Repository } from './types';

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
