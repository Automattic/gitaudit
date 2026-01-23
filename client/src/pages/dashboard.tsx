import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Button } from '@wordpress/components';
import { repoStatusQueryOptions } from '@/data/queries/repos';
import { metricsQueryOptions } from '@/data/queries/metrics';
import RefreshButton from '@/layouts/shared/refresh-button';
import { MetricSummary } from '@/components/metric-summary';
import Page from '../components/page';

// Colors matching the app's palette
const COLORS = {
  positive: '#00a32a',
  negative: '#d63638',
  neutral: '#50575e',
  primary: '#3858e9',
  border: '#e0e0e0',
  cardBg: '#fff',
};

// Format large numbers with K/M suffixes
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
};

// Format relative time
const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Stat Card component for displaying a single statistic
 */
function StatCard({
  label,
  value,
  subValue,
  subLabel,
  color = COLORS.primary,
  to,
}: {
  label: string;
  value: number | string;
  subValue?: number | string;
  subLabel?: string;
  color?: string;
  to?: string;
}) {
  const cardStyle = {
    padding: '1.25rem',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    backgroundColor: COLORS.cardBg,
    textDecoration: 'none',
    display: 'block',
    transition: 'border-color 0.15s',
  };

  const content = (
    <>
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: COLORS.neutral,
          marginBottom: '0.5rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 600,
          color,
          fontFamily: 'monospace',
          lineHeight: 1.2,
        }}
      >
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
      {subValue !== undefined && (
        <div
          style={{
            fontSize: '0.75rem',
            color: COLORS.neutral,
            marginTop: '0.25rem',
          }}
        >
          {typeof subValue === 'number' ? formatNumber(subValue) : subValue} {subLabel}
        </div>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = COLORS.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = COLORS.border;
        }}
      >
        {content}
      </Link>
    );
  }

  return <div style={cardStyle}>{content}</div>;
}

/**
 * Quick Link component for navigation
 */
function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: '0.75rem 1rem',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        backgroundColor: COLORS.cardBg,
        color: '#1e1e1e',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: 500,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLORS.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.border;
      }}
    >
      → {label}
    </Link>
  );
}

function Dashboard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  const { data: statusData, isLoading: statusLoading } = useQuery({
    ...repoStatusQueryOptions(owner!, repo!),
    refetchInterval: 5000, // Poll for status updates
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery(metricsQueryOptions(owner!, repo!));

  // Filter to visible metrics, limit to 3 for dashboard preview
  const visibleMetrics = (metrics?.filter((m) => m.defaultVisible) || []).slice(0, 3);
  const hasMetrics = metrics && metrics.length > 0;

  const isGithub = statusData?.isGithub ?? true;
  const hasData = statusData?.hasCachedData || statusData?.hasCachedPRs;

  if (statusLoading) {
    return (
      <Page title="Dashboard">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page title="Dashboard">
      {/* Repository Header */}
      <div
        style={{
          padding: '1.5rem',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '8px',
          backgroundColor: COLORS.cardBg,
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {/* Repo name and badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                {owner}/{repo}
              </h3>
              {isGithub && statusData?.stars !== undefined && statusData.stars > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.8125rem',
                    color: COLORS.neutral,
                  }}
                >
                  ★ {formatNumber(statusData.stars)}
                </span>
              )}
              {statusData?.language && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    fontSize: '0.8125rem',
                    color: COLORS.neutral,
                  }}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: statusData.languageColor || '#858585',
                    }}
                  />
                  {statusData.language}
                </span>
              )}
            </div>

            {/* Description */}
            {statusData?.description && (
              <p
                style={{
                  margin: '0.75rem 0 0 0',
                  fontSize: '0.875rem',
                  color: COLORS.neutral,
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {statusData.description}
              </p>
            )}

            {/* Last synced */}
            {isGithub && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: COLORS.neutral }}>
                Last synced: {formatRelativeTime(statusData?.lastFetched)}
              </div>
            )}
          </div>

          {/* Sync button */}
          {isGithub && (
            <div style={{ marginLeft: '1rem' }}>
              <RefreshButton owner={owner!} repo={repo!} />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {isGithub && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <StatCard
            label="Open Issues"
            value={statusData?.openIssueCount ?? 0}
            subValue={statusData?.closedIssueCount ?? 0}
            subLabel="closed"
          />
          <StatCard
            label="Open PRs"
            value={statusData?.openPRCount ?? 0}
            subValue={statusData?.mergedPRCount ?? 0}
            subLabel="merged"
          />
          <StatCard
            label="Needs Attention"
            value={statusData?.highPriorityCount ?? 0}
            subLabel="high priority bugs"
            color={
              (statusData?.highPriorityCount ?? 0) > 0 ? COLORS.negative : COLORS.positive
            }
            to={`/repos/${owner}/${repo}/bugs/all`}
          />
          <StatCard
            label="Recent Activity"
            value={formatRelativeTime(statusData?.recentActivity)}
            subLabel="last update"
          />
        </div>
      )}

      {/* Stats explanation note */}
      {isGithub && hasData && (
        <p
          style={{
            margin: '0 0 1.5rem 0',
            fontSize: '0.75rem',
            color: COLORS.neutral,
            fontStyle: 'italic',
          }}
        >
          Stats based on synced data. Use the refresh button to fetch latest from GitHub.
        </p>
      )}

      {/* Empty state for repos with no data */}
      {isGithub && !hasData && (
        <div
          style={{
            padding: '2rem',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            backgroundColor: COLORS.cardBg,
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ margin: 0, color: COLORS.neutral }}>
            No data synced yet. Click the refresh button to fetch issues and pull requests from GitHub.
          </p>
        </div>
      )}

      {/* Metrics Section */}
      {!metricsLoading && hasMetrics && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Metrics</h4>
            <Link
              to={`/repos/${owner}/${repo}/metrics`}
              style={{
                fontSize: '0.8125rem',
                color: COLORS.primary,
                textDecoration: 'none',
              }}
            >
              View All →
            </Link>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {visibleMetrics.map((metric) => (
              <div
                key={metric.id}
                style={{
                  padding: '1rem',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '8px',
                  backgroundColor: COLORS.cardBg,
                }}
              >
                <MetricSummary metric={metric} owner={owner!} repo={repo!} size="compact" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links (GitHub repos only) */}
      {isGithub && hasData && (
        <div>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600 }}>
            Quick Links
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <QuickLink to={`/repos/${owner}/${repo}/bugs/all`} label="Important Bugs" />
            <QuickLink to={`/repos/${owner}/${repo}/stale/all`} label="Stale Issues" />
            <QuickLink to={`/repos/${owner}/${repo}/features/all`} label="Feature Requests" />
            <QuickLink to={`/repos/${owner}/${repo}/community/all`} label="Community Health" />
            <QuickLink to={`/repos/${owner}/${repo}/stale-prs/all`} label="Stale PRs" />
          </div>
        </div>
      )}

      {/* Non-GitHub repo info */}
      {!isGithub && (
        <div
          style={{
            padding: '1.5rem',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            backgroundColor: COLORS.cardBg,
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ margin: '0 0 1rem 0', color: COLORS.neutral }}>
            This is a custom repository. Issue and PR tracking is not available for non-GitHub
            repositories.
          </p>
          {statusData?.url && (
            <Button
              variant="secondary"
              href={statusData.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Repository →
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}

export default Dashboard;
