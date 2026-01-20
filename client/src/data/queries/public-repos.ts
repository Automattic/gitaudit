import { queryOptions } from '@tanstack/react-query';
import { fetchPublicRepos } from '../api/public-repos/fetchers';
import { queryKeys } from './query-keys';

/**
 * Query options for fetching public repos with metrics
 */
export const publicReposQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.publicRepos.list(),
    queryFn: () => fetchPublicRepos(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
