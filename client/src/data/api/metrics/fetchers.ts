import { apiClient } from '../client';
import { Metric } from './types';

/**
 * Fetch metrics for a repository
 * Works for both authenticated and public access - backend determines what to return
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

export interface MetricsPublicStatus {
  isPublic: boolean;
}

export interface RepoInfo {
  url: string | null;
  isGithub: boolean;
}

/**
 * Fetch repo info for commit links (works for public access)
 */
export const fetchRepoInfo = async (owner: string, repo: string): Promise<RepoInfo> => {
  return apiClient.get<RepoInfo>(`/api/repos/${owner}/${repo}/metrics/info`);
};

/**
 * Fetch public metrics status (admin only)
 */
export const fetchMetricsPublicStatus = async (
  owner: string,
  repo: string
): Promise<MetricsPublicStatus> => {
  return apiClient.get<MetricsPublicStatus>(`/api/repos/${owner}/${repo}/metrics/public`);
};

/**
 * Update public metrics status (admin only)
 */
export const updateMetricsPublicStatus = async (
  owner: string,
  repo: string,
  isPublic: boolean
): Promise<MetricsPublicStatus> => {
  return apiClient.put<MetricsPublicStatus>(`/api/repos/${owner}/${repo}/metrics/public`, { isPublic });
};
