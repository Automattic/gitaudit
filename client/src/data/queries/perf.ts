import { queryOptions } from '@tanstack/react-query';
import { fetchMetricEvolution, fetchMetricSummaries } from '../api/perf';
import { queryKeys } from './query-keys';

export const perfEvolutionQueryOptions = (
  owner: string,
  repo: string,
  metricId: number,
  limit: number = 200,
  branch: string = 'trunk'
) =>
  queryOptions({
    queryKey: queryKeys.perf.evolution(owner, repo, metricId, limit, branch),
    queryFn: () => fetchMetricEvolution(owner, repo, metricId, limit, branch),
    enabled: !!metricId,
  });

/**
 * Averages for every metric in the repo. Each metric card reads its own entry,
 * so a dashboard makes one request however many cards it shows.
 */
export const perfSummaryQueryOptions = (owner: string, repo: string, branch: string = 'trunk') =>
  queryOptions({
    queryKey: queryKeys.perf.summary(owner, repo, branch),
    queryFn: () => fetchMetricSummaries(owner, repo, branch),
  });
