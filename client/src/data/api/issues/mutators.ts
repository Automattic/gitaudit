import { apiClient } from '../client';

/**
 * Refresh a single issue
 */
export const refreshSingleIssue = async (
  owner: string,
  repo: string,
  issueNumber: number
): Promise<void> => {
  return apiClient.post<void>(
    `/api/repos/${owner}/${repo}/issues/${issueNumber}/refresh`
  );
};
