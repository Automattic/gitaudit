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

  if (params.labels && params.labels.length > 0) {
    params.labels.forEach(label => {
      queryParams.append('labels', label);
    });
  }

  return apiClient.get<IssuesResponse>(
    `/api/repos/${owner}/${repo}/issues?${queryParams}`
  );
};

/**
 * Fetch distinct labels for a repository
 */
export const fetchLabels = async (
  owner: string,
  repo: string
): Promise<string[]> => {
  const response = await apiClient.get<{ labels: string[] }>(
    `/api/repos/${owner}/${repo}/issues/labels`
  );
  return response.labels;
};
