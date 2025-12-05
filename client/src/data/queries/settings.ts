import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRepoSettings } from '../api/settings/fetchers';
import { updateRepoSettings, resetRepoSettings } from '../api/settings/mutators';
import { queryKeys } from './query-keys';
import { RepoSettings } from '../api/settings/types';

/**
 * Query options for fetching repo settings
 */
export const repoSettingsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.settings.repo(owner, repo),
    queryFn: () => fetchRepoSettings(owner, repo),
  });

/**
 * Mutation for updating settings
 */
export const useUpdateSettingsMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: RepoSettings) => updateRepoSettings(owner, repo, settings),
    onSuccess: (data) => {
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.settings.repo(owner, repo), data);
    },
  });
};

/**
 * Mutation for resetting settings
 */
export const useResetSettingsMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => resetRepoSettings(owner, repo),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings.repo(owner, repo), data);
    },
  });
};
