import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { DataViews } from '@wordpress/dataviews';
import { Card, CardBody, Button, Notice, Spinner } from '@wordpress/components';
import { useAuth } from '../context/AuthContext';
import { useIssueFetch } from '../hooks/useIssueFetch';
import api from '../utils/api';
import Page from '../components/Page';

function ImportantBugs() {
  const { owner, repo } = useParams();
  const { status, loading: statusLoading, error: statusError, startFetch, refresh } = useIssueFetch(owner, repo);

  // DataViews state
  const [view, setView] = useState({
    type: 'table',
    page: 1,
    perPage: 20,
    filters: [],
    fields: ['score', 'title', 'labels', 'commentsCount', 'updatedAt'],
    layout: {},
    search: '',
    titleField: 'title',
  });

  // Data state
  const [bugs, setBugs] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({ all: 0, critical: 0, high: 0, medium: 0 });
  const [thresholds, setThresholds] = useState({ critical: 120, high: 80, medium: 50 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const prevStatusRef = useRef();

  // Load bugs when view changes or data becomes available
  useEffect(() => {
    const prevStatus = prevStatusRef.current?.status;
    const currentStatus = status?.status;

    // Load bugs when:
    // 1. Initial load: data just became available
    // 2. After refresh: transitioning from in_progress to completed
    const initialLoad = status?.hasCachedData && !prevStatusRef.current?.hasCachedData;
    const refreshCompleted = prevStatus === 'in_progress' && currentStatus === 'completed';

    if (initialLoad || refreshCompleted) {
      loadBugs();
    }

    prevStatusRef.current = status;
  }, [status?.hasCachedData, status?.status]);

  // Load bugs when pagination, filter, or search changes
  useEffect(() => {
    if (status?.hasCachedData) {
      loadBugs();
    }
  }, [view.page, view.search, activeTab]);

  async function loadBugs() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: view.page.toString(),
        per_page: view.perPage.toString(),
        priority: activeTab,
      });

      // Add search parameter if present
      if (view.search) {
        params.set('search', view.search);
      }

      const data = await api.get(`/api/repos/${owner}/${repo}/issues/important-bugs?${params}`);

      setBugs(data.bugs || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 0);
      setStats(data.stats || { all: 0, critical: 0, high: 0, medium: 0 });
      setThresholds(data.thresholds || { critical: 120, high: 80, medium: 50 });
    } catch (err) {
      console.error('Error loading bugs:', err);
      setError(err.message || 'Failed to load bugs');
    } finally {
      setLoading(false);
    }
  }

  // Tab click handler
  const handleTabClick = useCallback((priorityLevel) => {
    setActiveTab(priorityLevel);
    setView(prev => ({
      ...prev,
      page: 1,  // Reset to first page
    }));
  }, []);

  // Helper function to format dates
  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }, []);

  // Helper function to get score color
  const getScoreColor = useCallback((score) => {
    if (score >= thresholds.critical) return '#d63638';
    if (score >= thresholds.high) return '#f56e28';
    if (score >= thresholds.medium) return '#f0b849';
    return '#50575e';
  }, [thresholds]);

  // Field definitions
  const fields = useMemo(() => [
    {
      id: 'score',
      type: 'integer',
      header: 'Score',
      enableSorting: false,
      enableHiding: false,
      width: '80px',
      render: ({ item }) => (
        <div style={{
          backgroundColor: getScoreColor(item.score),
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          fontWeight: 'bold',
          textAlign: 'center',
          display: 'inline-block',
          minWidth: '50px',
        }}>
          {item.score}
        </div>
      ),
    },
    {
      id: 'title',
      type: 'text',
      header: 'Title',
      enableHiding: false,
      enableGlobalSearch: true,
      getValue: ({ item }) => `#${item.number} ${item.title}`,
      width: '40%',
      render: ({ item }) => (
        <span>#{item.number} {item.title}</span>
      ),
    },
    {
      id: 'labels',
      type: 'text',
      header: 'Labels',
      enableSorting: false,
      getValue: ({ item }) => item.labels.join(', '),
      width: '20%',
      render: ({ item }) => {
        if (!item.labels || item.labels.length === 0) {
          return <span style={{ color: '#999' }}>—</span>;
        }
        return (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {item.labels.slice(0, 3).map((label, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '12px',
                  color: '#50575e',
                }}
              >
                {label}
              </span>
            ))}
            {item.labels.length > 3 && (
              <span style={{ fontSize: '0.75rem', color: '#666' }}>
                +{item.labels.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'commentsCount',
      type: 'integer',
      header: 'Comments',
      enableSorting: false,
      width: '100px',
      render: ({ item }) => (
        <span style={{ color: '#666' }}>
          💬 {item.commentsCount}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      type: 'datetime',
      header: 'Updated',
      enableSorting: false,
      width: '120px',
      render: ({ item }) => (
        <span style={{ color: '#666' }}>{formatDate(item.updatedAt)}</span>
      ),
    },
    // Additional hidden fields (user can show via column selector)
    {
      id: 'createdAt',
      type: 'datetime',
      header: 'Created',
      enableSorting: false,
      render: ({ item }) => (
        <span style={{ color: '#666' }}>{formatDate(item.createdAt)}</span>
      ),
    },
    {
      id: 'assignees',
      type: 'text',
      header: 'Assignees',
      enableSorting: false,
      render: ({ item }) => (
        <span style={{ color: '#666' }}>
          {item.assignees && item.assignees.length > 0 ? item.assignees.join(', ') : '—'}
        </span>
      ),
    },
    {
      id: 'milestone',
      type: 'text',
      header: 'Milestone',
      enableSorting: false,
      render: ({ item }) => (
        <span style={{ color: '#666' }}>{item.milestone || '—'}</span>
      ),
    },
  ], [thresholds, formatDate, getScoreColor]);

  // Pagination info for DataViews
  const paginationInfo = useMemo(() => ({
    totalItems,
    totalPages,
  }), [totalItems, totalPages]);

  // Actions for DataViews
  const actions = useMemo(() => [
    {
      id: 'view-on-github',
      label: 'View on GitHub',
      isPrimary: true,
      callback: (items) => {
        if (items.length === 1) {
          window.open(items[0].url, '_blank', 'noopener,noreferrer');
        }
      },
    },
  ], []);

  // Render loading state
  if (!status) {
    return (
      <Page title="Important Bugs">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Spinner />
          <p style={{ marginTop: '1rem', color: '#666' }}>Checking repository status...</p>
        </div>
      </Page>
    );
  }

  const hasNoData = !status?.hasCachedData && status?.status !== 'in_progress';

  // Render failed state
  if (status?.status === 'failed') {
    return (
      <Page title="Important Bugs">
        <Notice status="error" isDismissible={false}>
          Failed to fetch issues. Please try again.
        </Notice>
        <div style={{ marginTop: '1rem' }}>
          <Button variant="primary" onClick={() => startFetch()}>
            Retry Fetch
          </Button>
        </div>
      </Page>
    );
  }

  // Main view
  return (
    <Page
      title="Important Bugs"
      description={
        status?.hasCachedData
          ? `${status?.issueCount} total issues • Last updated ${formatDate(status?.lastFetched)}`
          : undefined
      }
      actions={
        <Button
          variant="secondary"
          onClick={refresh}
          disabled={status?.status === 'in_progress'}
        >
          {status?.status === 'in_progress' ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      }
    >
      {statusError && (
        <Notice status="error" isDismissible={false} style={{ marginBottom: '1rem' }}>
          {statusError}
        </Notice>
      )}

      {hasNoData ? (
        <Card>
          <CardBody>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>No Data Yet</h3>
              <p style={{ marginBottom: '2rem', color: '#666' }}>
                We need to fetch issues from GitHub before we can analyze them.
                This may take a few minutes depending on the repository size.
              </p>
              <Button variant="primary" onClick={startFetch}>
                Fetch Issues from GitHub
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              borderBottom: '2px solid #ddd',
            }}>
              {[
                { key: 'all', label: 'All', count: stats.all },
                { key: 'critical', label: 'Critical', count: stats.critical },
                { key: 'high', label: 'High', count: stats.high },
                { key: 'medium', label: 'Medium', count: stats.medium },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: activeTab === tab.key ? '3px solid #2271b1' : '3px solid transparent',
                    color: activeTab === tab.key ? '#2271b1' : '#666',
                    fontWeight: activeTab === tab.key ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    marginBottom: '-2px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.key) {
                      e.target.style.color = '#2271b1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.key) {
                      e.target.style.color = '#666';
                    }
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Error notice */}
            {error && (
              <Notice status="error" isDismissible={false} style={{ marginBottom: '1rem' }}>
                {error}
              </Notice>
            )}

            {/* Loading state for initial load */}
            {loading && bugs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Spinner />
                <p style={{ marginTop: '1rem', color: '#666' }}>Analyzing bugs...</p>
              </div>
            ) : bugs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#666', margin: 0 }}>
                  No bugs found in this category.
                </p>
              </div>
            ) : (
              <DataViews
                data={bugs}
                fields={fields}
                view={view}
                onChangeView={setView}
                actions={actions}
                paginationInfo={paginationInfo}
                defaultLayouts={{ table: {} }}
                getItemId={(item) => item.id}
              />
            )}
          </CardBody>
        </Card>
      )}
    </Page>
  );
}

export default ImportantBugs;
