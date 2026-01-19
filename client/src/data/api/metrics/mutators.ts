import { apiClient } from '../client';
import { Metric, CreateMetricInput, UpdateMetricInput } from './types';

/**
 * Create a new metric
 */
export const createMetric = async (
  owner: string,
  repo: string,
  data: CreateMetricInput
): Promise<Metric> => {
  return apiClient.post<Metric>(`/api/repos/${owner}/${repo}/metrics`, data);
};

/**
 * Update an existing metric
 */
export const updateMetric = async (
  owner: string,
  repo: string,
  id: number,
  data: UpdateMetricInput
): Promise<Metric> => {
  return apiClient.put<Metric>(`/api/repos/${owner}/${repo}/metrics/${id}`, data);
};

/**
 * Delete a metric
 */
export const deleteMetric = async (
  owner: string,
  repo: string,
  id: number
): Promise<void> => {
  return apiClient.delete<void>(`/api/repos/${owner}/${repo}/metrics/${id}`);
};

/**
 * Regenerate the metrics API token (returns the new token for one-time copy)
 */
export const regenerateMetricsToken = async (
  owner: string,
  repo: string
): Promise<string> => {
  const response = await apiClient.post<{ token: string }>(
    `/api/repos/${owner}/${repo}/metrics/token/regenerate`
  );
  return response.token;
};
