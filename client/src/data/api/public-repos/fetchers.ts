import { apiClient } from '../client';
import type { PublicRepo } from './types';

/**
 * Fetch all repositories with public metrics enabled
 */
export const fetchPublicRepos = async (): Promise<PublicRepo[]> => {
  return apiClient.get<PublicRepo[]>('/api/public-repos');
};
