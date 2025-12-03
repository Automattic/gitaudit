import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

export function useRepoStatus(owner, repo) {
  const [status, setStatus] = useState(null);
  const pollingIntervalRef = useRef(null);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api.get(`/api/repos/${owner}/${repo}/issues/status`);
      setStatus(data);
    } catch (err) {
      console.error('Error checking repo status:', err);
    }
  }, [owner, repo]);

  const refresh = useCallback(async () => {
    try {
      await api.post(`/api/repos/${owner}/${repo}/issues/refresh`);
      // Force immediate status check to pick up the change
      await checkStatus();
    } catch (err) {
      console.error('Error refreshing data:', err);
      throw err; // Re-throw so caller can handle
    }
  }, [owner, repo, checkStatus]);

  // Initial status check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Start/stop polling based on status
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Only poll when status is 'in_progress'
    if (status?.status === 'in_progress') {
      pollingIntervalRef.current = setInterval(() => {
        checkStatus();
      }, 2000); // Poll every 2 seconds
    }

    // Cleanup on unmount or when status changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [status?.status, checkStatus]);

  return { ...status, refresh };
}
