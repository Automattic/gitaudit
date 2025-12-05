import { apiClient } from '../client';

/**
 * Start fetching issues from GitHub
 */
export const startIssueFetch = async (owner: string, repo: string): Promise<void> => {
  return apiClient.post<void>(`/api/repos/${owner}/${repo}/issues/fetch`);
};

/**
 * Refresh all issues
 */
export const refreshIssues = async (owner: string, repo: string): Promise<void> => {
  return apiClient.post<void>(`/api/repos/${owner}/${repo}/issues/refresh`);
};

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
