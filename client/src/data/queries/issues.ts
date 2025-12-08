import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIssues } from '../api/issues/fetchers';
import { refreshSingleIssue } from '../api/issues/mutators';
import { queryKeys } from './query-keys';
import { IssuesQueryParams } from '../api/issues/types';

/**
 * Query options for fetching issues
 */
export const issuesQueryOptions = (
  owner: string,
  repo: string,
  params: IssuesQueryParams
) =>
  queryOptions({
    queryKey: queryKeys.issues.list(owner, repo, params),
    queryFn: () => fetchIssues(owner, repo, params),
  });

/**
 * Mutation for refreshing a single issue
 */
export const useRefreshSingleIssueMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueNumber: number) => refreshSingleIssue(owner, repo, issueNumber),
    onSuccess: () => {
      // Invalidate all issue lists for this repo
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.repo(owner, repo) });
    },
  });
};
