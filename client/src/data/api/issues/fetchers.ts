import { apiClient } from '../client';
import { IssuesResponse, IssuesQueryParams } from './types';

/**
 * Fetch paginated issues
 */
export const fetchIssues = async (
  owner: string,
  repo: string,
  params: IssuesQueryParams
): Promise<IssuesResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    per_page: params.per_page.toString(),
    scoreType: params.scoreType,
  });

  // Use 'priority' for importantBugs, 'level' for staleIssues
  if (params.priority) {
    queryParams.set('priority', params.priority);
  }

  if (params.level) {
    queryParams.set('level', params.level);
  }

  if (params.issueType) {
    queryParams.set('issueType', params.issueType);
  }

  if (params.search) {
    queryParams.set('search', params.search);
  }

  return apiClient.get<IssuesResponse>(
    `/api/repos/${owner}/${repo}/issues?${queryParams}`
  );
};
