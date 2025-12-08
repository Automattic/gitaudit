import { queryOptions } from '@tanstack/react-query';
import { fetchPRs } from '../api/prs/fetchers';
import { queryKeys } from './query-keys';
import { PRsQueryParams } from '../api/prs/types';

/**
 * Query options for fetching PRs
 */
export const prsQueryOptions = (
  owner: string,
  repo: string,
  params: PRsQueryParams
) =>
  queryOptions({
    queryKey: queryKeys.prs.list(owner, repo, params),
    queryFn: () => fetchPRs(owner, repo, params),
  });
