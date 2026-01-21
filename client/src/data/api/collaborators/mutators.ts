import { apiClient } from '../client';
import { AddCollaboratorRequest, UpdateCollaboratorRequest, Collaborator } from './types';

/**
 * Add a collaborator to a repository (admin only, custom repos only)
 */
export const addCollaborator = async (
  owner: string,
  repo: string,
  data: AddCollaboratorRequest
): Promise<Collaborator> => {
  return apiClient.post<Collaborator>(
    `/api/repos/${owner}/${repo}/collaborators`,
    data
  );
};

/**
 * Update a collaborator's role (admin only, custom repos only)
 */
export const updateCollaborator = async (
  owner: string,
  repo: string,
  username: string,
  data: UpdateCollaboratorRequest
): Promise<{ username: string; role: string }> => {
  return apiClient.patch(
    `/api/repos/${owner}/${repo}/collaborators/${username}`,
    data
  );
};

/**
 * Remove a collaborator from a repository (admin only, custom repos only)
 */
export const removeCollaborator = async (
  owner: string,
  repo: string,
  username: string
): Promise<void> => {
  return apiClient.delete<void>(
    `/api/repos/${owner}/${repo}/collaborators/${username}`
  );
};
