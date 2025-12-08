import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRepos, fetchRepoBrowse, fetchRepoSearch, fetchRepoStatus } from '../api/repos/fetchers';
import { saveRepo, deleteRepo, fetchRepoData } from '../api/repos/mutators';
import { queryKeys } from './query-keys';
import { SaveRepoRequest } from '../api/repos/types';

/**
 * Query options for fetching saved repos
 */
export const reposQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.repos.list(),
    queryFn: fetchRepos,
  });

/**
 * Query options for repo status with polling support
 */
export const repoStatusQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.repos.status(owner, repo),
    queryFn: () => fetchRepoStatus(owner, repo),
    refetchInterval: 5000, // Poll every 5 seconds
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
 * Mutation for deleting a repository
 */
export const useDeleteRepoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: number) => deleteRepo(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.list() });
    },
  });
};

/**
 * Mutation for fetching repository data (issues and PRs) from GitHub
 */
export const useFetchRepoDataMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fetchRepoData(owner, repo),
    onSuccess: () => {
      // Invalidate status to trigger refetch and start polling
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.status(owner, repo) });
    },
  });
};
