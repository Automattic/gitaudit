import { apiClient } from '../client';
import { PRsResponse, PRsQueryParams } from './types';

/**
 * Fetch paginated PRs
 */
export const fetchPRs = async (
  owner: string,
  repo: string,
  params: PRsQueryParams
): Promise<PRsResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    per_page: params.per_page.toString(),
  });

  if (params.scoreType) {
    queryParams.set('scoreType', params.scoreType);
  }

  if (params.level) {
    queryParams.set('level', params.level);
  }

  if (params.search) {
    queryParams.set('search', params.search);
  }

  return apiClient.get<PRsResponse>(
    `/api/repos/${owner}/${repo}/prs?${queryParams}`
  );
};
