import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient instance
 * Used for imperative cache updates and invalidations in mutations
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
