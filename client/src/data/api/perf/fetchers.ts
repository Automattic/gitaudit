import { apiClient } from '../client';
import type { PerfEvolutionResponse, MetricSummaries } from './types';

export const fetchMetricEvolution = async (
  owner: string,
  repo: string,
  metricId: number,
  limit: number = 100,
  branch: string = 'trunk'
): Promise<PerfEvolutionResponse> => {
  const params = new URLSearchParams({ branch });
  if (limit > 0) {
    params.set('limit', limit.toString());
  }
  // When limit <= 0 (sentinel for "All"), omit limit param so server returns all data
  return apiClient.get<PerfEvolutionResponse>(
    `/api/repos/${owner}/${repo}/perf/evolution/${metricId}?${params}`
  );
};

export const fetchMetricSummaries = async (
  owner: string,
  repo: string,
  branch: string = 'trunk'
): Promise<MetricSummaries> => {
  const params = new URLSearchParams({ branch });
  return apiClient.get<MetricSummaries>(`/api/repos/${owner}/${repo}/perf/summary?${params}`);
};
