import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

export function useIssueFetch(owner, repo) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingIntervalRef = useRef(null);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api.get(`/api/repos/${owner}/${repo}/issues/status`);
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error checking status:', err);
      setError(err.message);
    }
  }, [owner, repo]);

  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    // Start new polling interval - use function reference directly
    pollingIntervalRef.current = setInterval(() => {
      api.get(`/api/repos/${owner}/${repo}/issues/status`)
        .then(data => {
          setStatus(data);
          setError(null);
        })
        .catch(err => {
          console.error('Error checking status:', err);
          setError(err.message);
        });
    }, 2000);
  }, [owner, repo]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startFetch = useCallback(async () => {
    try {
      setError(null);
      await api.post(`/api/repos/${owner}/${repo}/issues/fetch`);
      // Check status immediately and start polling
      await checkStatus();
      startPolling();
    } catch (err) {
      console.error('Error starting fetch:', err);
      setError(err.message);
    }
  }, [owner, repo, checkStatus, startPolling]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await api.post(`/api/repos/${owner}/${repo}/issues/refresh`);
      // Check status immediately and start polling
      await checkStatus();
      startPolling();
    } catch (err) {
      console.error('Error refreshing:', err);
      setError(err.message);
    }
  }, [owner, repo, checkStatus, startPolling]);

  // Initial status check on mount
  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]); // Only re-run when owner/repo changes

  // Start/stop polling based on status
  useEffect(() => {
    if (status?.status === 'in_progress') {
      startPolling();
    } else {
      stopPolling();
    }

    // Cleanup on unmount
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.status]); // Only depend on status, not the callback functions

  return {
    status,
    loading,
    error,
    startFetch,
    refresh,
    checkStatus,
  };
}
