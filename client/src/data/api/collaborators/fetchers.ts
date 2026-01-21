import { apiClient } from '../client';
import { CollaboratorsResponse } from './types';

/**
 * Fetch collaborators for a repository (admin only, custom repos only)
 */
export const fetchCollaborators = async (
  owner: string,
  repo: string
): Promise<CollaboratorsResponse> => {
  return apiClient.get<CollaboratorsResponse>(
    `/api/repos/${owner}/${repo}/collaborators`
  );
};
