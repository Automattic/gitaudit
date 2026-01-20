import { queryOptions } from '@tanstack/react-query';
import { fetchMetricEvolution, fetchMetricAverage } from '../api/perf';
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

export const perfAverageQueryOptions = (
  owner: string,
  repo: string,
  metricId: number,
  branch: string = 'trunk'
) =>
  queryOptions({
    queryKey: queryKeys.perf.average(owner, repo, metricId, branch),
    queryFn: () => fetchMetricAverage(owner, repo, metricId, branch),
    enabled: !!metricId,
  });
