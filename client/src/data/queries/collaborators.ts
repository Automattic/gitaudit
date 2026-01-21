import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollaborators } from '../api/collaborators/fetchers';
import { addCollaborator, updateCollaborator, removeCollaborator } from '../api/collaborators/mutators';
import { queryKeys } from './query-keys';
import { AddCollaboratorRequest } from '../api/collaborators/types';

/**
 * Query options for fetching collaborators (admin only, custom repos only)
 */
export const collaboratorsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.collaborators.list(owner, repo),
    queryFn: () => fetchCollaborators(owner, repo),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Mutation for adding a collaborator
 */
export const useAddCollaboratorMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddCollaboratorRequest) => addCollaborator(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collaborators.list(owner, repo) });
    },
  });
};

/**
 * Mutation for updating a collaborator's role
 */
export const useUpdateCollaboratorMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, role }: { username: string; role: 'admin' | 'member' }) =>
      updateCollaborator(owner, repo, username, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collaborators.list(owner, repo) });
    },
  });
};

/**
 * Mutation for removing a collaborator
 */
export const useRemoveCollaboratorMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => removeCollaborator(owner, repo, username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collaborators.list(owner, repo) });
    },
  });
};
