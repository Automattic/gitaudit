import { apiClient } from '../client';

/**
 * Refresh a single PR
 */
export const refreshSinglePR = async (
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> => {
  return apiClient.post<void>(
    `/api/repos/${owner}/${repo}/prs/${prNumber}/refresh`
  );
};
