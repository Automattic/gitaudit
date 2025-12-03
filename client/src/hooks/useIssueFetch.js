import { useCallback } from 'react';
import api from '../utils/api';

export function useIssueFetch(owner, repo) {
  const startFetch = useCallback(async () => {
    try {
      await api.post(`/api/repos/${owner}/${repo}/issues/fetch`);
    } catch (err) {
      console.error('Error starting fetch:', err);
      throw err;
    }
  }, [owner, repo]);

  return {
    startFetch,
  };
}
