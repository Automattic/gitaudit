import { apiClient } from '../client';
import type { PerfDataPoint, MetricAverage } from './types';

export const fetchMetricEvolution = async (
  owner: string,
  repo: string,
  metricId: number,
  limit: number = 100,
  branch: string = 'trunk'
): Promise<PerfDataPoint[]> => {
  const params = new URLSearchParams({ limit: limit.toString(), branch });
  return apiClient.get<PerfDataPoint[]>(
    `/api/repos/${owner}/${repo}/perf/evolution/${metricId}?${params}`
  );
};

export const fetchMetricAverage = async (
  owner: string,
  repo: string,
  metricId: number,
  branch: string = 'trunk'
): Promise<MetricAverage> => {
  const params = new URLSearchParams({ branch });
  return apiClient.get<MetricAverage>(
    `/api/repos/${owner}/${repo}/perf/average/${metricId}?${params}`
  );
};
