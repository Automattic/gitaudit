import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MetricsDashboardContent } from '@/components/metrics-dashboard-content';
import PublicHeader from '@/components/public-header';
import { repoInfoQueryOptions } from '@/data/queries/metrics';

/**
 * Public metrics dashboard page (no authentication required)
 */
function PublicMetricsDashboard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  const { data: repoInfo } = useQuery(repoInfoQueryOptions(owner!, repo!));

  // Get repo URL for commit links
  const repoUrl =
    repoInfo?.url || (repoInfo?.isGithub ? `https://github.com/${owner}/${repo}` : undefined);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f1' }}>
      <PublicHeader />

      {/* Sub-header with repo info */}
      <div
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          padding: '1rem 2rem',
          marginTop: '53px', // Account for fixed header
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e1e1e' }}>
              {owner}/{repo}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#f0f6fc',
                borderRadius: '4px',
                color: '#0366d6',
              }}
            >
              Performance Metrics
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <MetricsDashboardContent owner={owner!} repo={repo!} repoUrl={repoUrl} />
        </div>
      </div>
    </div>
  );
}

export default PublicMetricsDashboard;
