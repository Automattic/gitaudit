import { apiClient } from '../client';
import { Metric } from './types';

/**
 * Fetch all metrics for a repository
 */
export const fetchMetrics = async (owner: string, repo: string): Promise<Metric[]> => {
  return apiClient.get<Metric[]>(`/api/repos/${owner}/${repo}/metrics`);
};

/**
 * Fetch the metrics API token (masked)
 */
export const fetchMetricsToken = async (owner: string, repo: string): Promise<string | null> => {
  const response = await apiClient.get<{ token: string | null }>(`/api/repos/${owner}/${repo}/metrics/token`);
  return response.token;
};
