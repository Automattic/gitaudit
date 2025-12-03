import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

/**
 * Hook for fetching issues data (data fetching only, no UI state management)
 *
 * @param {Object} config - Configuration object
 * @param {string} config.scoreType - Type of score ('importantBugs' or 'staleIssues')
 * @param {Object} config.defaultThresholds - Default threshold values
 * @param {Function} config.buildApiParams - Function to build API query parameters
 * @param {Function} config.extractStats - Function to extract stats from API response
 * @param {Function} config.extractThresholds - Function to extract thresholds from API response
 *
 * @param {Object} dependencies - Dynamic dependencies that trigger refetch
 * @param {number} dependencies.page - Current page number
 * @param {number} dependencies.perPage - Items per page
 * @param {string} dependencies.search - Search query
 * @param {string} dependencies.activeTab - Active tab/filter
 *
 * @returns {Object} Data state and loading status
 */
export function useIssues(config, dependencies) {
  const { owner, repo } = useParams();
  const {
    scoreType,
    defaultThresholds,
    buildApiParams,
    extractStats,
    extractThresholds,
  } = config;

  const { page, perPage, search, activeTab } = dependencies;

  // Data state only (no UI state)
  const [issues, setIssues] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState(null);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [fetchStatus, setFetchStatus] = useState('not_started');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data fetching logic
  const loadIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API params using config function
      const params = buildApiParams({
        page,
        perPage,
        activeTab,
        search,
        scoreType,
      });

      const data = await api.get(
        `/api/repos/${owner}/${repo}/issues?${params}`
      );

      setIssues(data.issues || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 0);
      setStats(extractStats(data));
      setThresholds(extractThresholds(data) || defaultThresholds);
      setFetchStatus(data.fetchStatus || 'not_started');
      setError(null);
    } catch (err) {
      console.error("Error loading issues:", err);
      setError(err.message || "Failed to load issues");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [
    owner,
    repo,
    page,
    perPage,
    search,
    activeTab,
    scoreType,
    buildApiParams,
    extractStats,
    extractThresholds,
    defaultThresholds,
  ]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  return {
    // Data state
    issues,
    totalItems,
    totalPages,
    stats,
    thresholds,
    fetchStatus,
    loading,
    error,
  };
}
