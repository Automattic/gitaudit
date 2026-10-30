import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMetrics,
  fetchMetricsToken,
  fetchMetricsPublicStatus,
  updateMetricsPublicStatus,
  fetchRepoInfo,
} from '../api/metrics/fetchers';
import { createMetric, updateMetric, deleteMetric, regenerateMetricsToken } from '../api/metrics/mutators';
import { queryKeys } from './query-keys';
import { CreateMetricInput, UpdateMetricInput } from '../api/metrics/types';

/**
 * Query options for fetching metrics list
 */
export const metricsQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.metrics.list(owner, repo),
    queryFn: () => fetchMetrics(owner, repo),
  });

/**
 * Query options for fetching whether a metrics token has been generated.
 */
export const metricsTokenQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.metrics.token(owner, repo),
    queryFn: () => fetchMetricsToken(owner, repo),
  });

/**
 * Mutation for creating a metric
 */
export const useCreateMetricMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMetricInput) => createMetric(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics.list(owner, repo) });
    },
  });
};

/**
 * Mutation for updating a metric
 */
export const useUpdateMetricMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMetricInput }) =>
      updateMetric(owner, repo, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics.list(owner, repo) });
      // Regression flags in cached perf data are derived from metric settings
      // (minRegressionDelta), so they go stale when a metric changes
      queryClient.invalidateQueries({ queryKey: queryKeys.perf.repo(owner, repo) });
    },
  });
};

/**
 * Mutation for deleting a metric
 */
export const useDeleteMetricMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteMetric(owner, repo, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics.list(owner, repo) });
    },
  });
};

/**
 * Mutation for regenerating the metrics token
 */
export const useRegenerateMetricsTokenMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => regenerateMetricsToken(owner, repo),
    // Discard the resolved plaintext token from MutationCache as soon as the
    // component stops referencing it, instead of the 5-minute default.
    gcTime: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics.token(owner, repo) });
    },
  });
};

/**
 * Query options for fetching repo info (for commit links)
 */
export const repoInfoQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.metrics.info(owner, repo),
    queryFn: () => fetchRepoInfo(owner, repo),
  });

/**
 * Query options for fetching public metrics status
 */
export const metricsPublicStatusQueryOptions = (owner: string, repo: string) =>
  queryOptions({
    queryKey: queryKeys.metrics.publicStatus(owner, repo),
    queryFn: () => fetchMetricsPublicStatus(owner, repo),
  });

/**
 * Mutation for updating public metrics status
 */
export const useUpdateMetricsPublicStatusMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isPublic: boolean) => updateMetricsPublicStatus(owner, repo, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics.publicStatus(owner, repo) });
    },
  });
};
