import { queryOptions } from '@tanstack/react-query';
import { fetchAuthVerify } from '../api/auth/fetchers';
import { queryKeys } from './query-keys';

/**
 * Query options for auth verification
 */
export const authVerifyQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.auth.verify(),
    queryFn: fetchAuthVerify,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: false, // Don't retry auth failures
  });
