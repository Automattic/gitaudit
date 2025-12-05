import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIssues } from '../api/issues/fetchers';
import { startIssueFetch, refreshIssues, refreshSingleIssue } from '../api/issues/mutators';
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
 * Mutation for starting issue fetch
 */
export const useStartIssueFetchMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startIssueFetch(owner, repo),
    onSuccess: () => {
      // Invalidate status to trigger refetch and start polling
      queryClient.invalidateQueries({ queryKey: queryKeys.repos.status(owner, repo) });
    },
  });
};

/**
 * Mutation for refreshing issues
 */
export const useRefreshIssuesMutation = (owner: string, repo: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => refreshIssues(owner, repo),
    onSuccess: () => {
      // Invalidate both status and issues
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.repo(owner, repo) });
    },
  });
};

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
