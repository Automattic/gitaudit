import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRepos, fetchRepoBrowse, fetchRepoSearch, fetchRepoPermission } from '../api/repos/fetchers';
import { saveRepo, createLocalRepo, updateLocalRepo, fullDeleteRepo } from '../api/repos/mutators';
import { queryKeys } from './query-keys';
import { SaveRepoRequest, CreateLocalRepoRequest, UpdateLocalRepoRequest } from '../api/repos/types';

/**
 * Query options for fetching saved repos
 */
export const reposQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.repos.list(),
    queryFn: fetchRepos,
  });

/**
 * Query options for browsing GitHub repos
 */
export const repoBrowseQueryOptions = (limit?: number) =>
  queryOptions({
    queryKey: queryKeys.repos.browse(limit),
    queryFn: () => fetchRepoBrowse(limit),
    staleTime: 1000 * 60 * 1, // 1 minute (GitHub data changes frequently)
  });

/**
 * Query options for searching repos
 */
export const repoSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: queryKeys.repos.search(query),
    queryFn: () => fetchRepoSearch(query),
    enabled: query.length >= 3, // Only run if query is long enough
    staleTime: 1000 * 60 * 1, // 1 minute
  });

/**
 * Query options for checking repository permission
 */
export const repoPermissionQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.repos.permission(owner, repo),
    queryFn: () => fetchRepoPermission(owner, repo),
    staleTime: 1000 * 60 * 5, // 5 minutes - permissions don't change frequently
    retry: 2,
  });

/**
 * Mutation for saving a repository
 */
export const useSaveRepoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SaveRepoRequest) => saveRepo(data),
    onSuccess: () => {
      // Invalidate repos list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
    },
  });
};

/**
 * Mutation for creating a local (non-GitHub) repository
 */
export const useCreateLocalRepoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLocalRepoRequest) => createLocalRepo(data),
    onSuccess: () => {
      // Invalidate repos list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
    },
  });
};

/**
 * Mutation for updating a custom (non-GitHub) repository's info
 */
export const useUpdateLocalRepoMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateLocalRepoRequest) => updateLocalRepo(owner, repo, data),
    onSuccess: () => {
      // Invalidate info to refresh the data
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics.info(owner, repo) });
      // Also invalidate repos list in case description shows there
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
    },
  });
};

/**
 * Mutation for fully deleting a repository and all associated data (admin only)
 */
export const useFullDeleteRepoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) =>
      fullDeleteRepo(owner, repo),
    onSuccess: () => {
      // Invalidate repos list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
    },
  });
};
