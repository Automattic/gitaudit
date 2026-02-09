import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardBody, Notice, Spinner } from '@wordpress/components';
import { useAuth } from '../context/auth-context';
import PublicHeader from '../components/public-header';
import { publicReposQueryOptions } from '../data/queries/public-repos';
import type { PublicRepo, PublicRepoMetric } from '../data/api/public-repos/types';

/**
 * Mini sparkline component using SVG
 */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const width = 80;
  const height = 24;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/**
 * Metric preview with sparkline
 */
function MetricPreview({ metric }: { metric: PublicRepoMetric }) {
  // Lower is always better: increase = negative, decrease = positive
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (metric.changePercent !== null && Math.abs(metric.changePercent) >= 0.05) {
    sentiment = metric.changePercent > 0 ? 'negative' : 'positive';
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      {/* Metric name and value */}
      <div style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: '0.7rem',
            color: '#50575e',
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {metric.name}
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {metric.currentAverage?.toFixed(1) ?? '-'}
          {metric.unit && (
            <span style={{ fontSize: '0.7rem', color: '#50575e' }}> {metric.unit}</span>
          )}
        </div>
      </div>

      {/* Sparkline - fixed width for alignment */}
      <div style={{ flex: '0 0 80px' }}>
        {metric.sparklineData.length > 1 && (
          <MiniSparkline
            data={metric.sparklineData}
            color={sentiment === 'negative' ? '#d63638' : '#3858e9'}
          />
        )}
      </div>

      {/* Change indicator - fixed width for alignment */}
      <div
        style={{
          flex: '0 0 36px',
          fontSize: '0.7rem',
          fontWeight: 500,
          textAlign: 'right',
        }}
      >
        {metric.changePercent !== null && sentiment !== 'neutral' && (
          <span style={{ color: sentiment === 'positive' ? '#00a32a' : '#d63638' }}>
            {metric.changePercent > 0 ? '+' : ''}
            {(metric.changePercent * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Public repo card with metrics
 */
function PublicRepoCard({ repo }: { repo: PublicRepo }) {
  const navigate = useNavigate();

  // Show first 3 visible metrics
  const displayMetrics = repo.metrics.filter((m) => m.defaultVisible).slice(0, 3);

  return (
    <Card
      onClick={() => navigate(`/public/${repo.owner}/${repo.name}/metrics`)}
      style={{ cursor: 'pointer' }}
    >
      <CardBody>
        {/* Header */}
        <div style={{ marginBottom: '0.75rem' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--wp-admin-theme-color)',
              margin: 0,
            }}
          >
            {repo.fullName}
          </h3>
          {repo.description && (
            <p
              style={{
                fontSize: '0.8rem',
                color: '#50575e',
                margin: '0.375rem 0 0',
                lineHeight: 1.4,
              }}
            >
              {repo.description.length > 70 ? repo.description.slice(0, 70) + '...' : repo.description}
            </p>
          )}
        </div>

        {/* Metrics with sparklines */}
        {displayMetrics.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {displayMetrics.map((metric) => (
              <MetricPreview key={metric.id} metric={metric} />
            ))}
          </div>
        ) : (
          <p style={{ color: '#50575e', fontSize: '0.8rem', margin: 0 }}>No metrics available</p>
        )}

        {/* Language badge */}
        {repo.language && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: repo.languageColor || '#ccc',
              }}
            />
            <span style={{ fontSize: '0.7rem', color: '#50575e' }}>{repo.language}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Hero section
 */
function HeroSection() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <section
      style={{
        padding: '8rem 2rem 4rem',
        textAlign: 'center',
        backgroundColor: '#f6f7f7',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
      <h1
        style={{
          fontSize: '2.75rem',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--wp-admin-theme-color)',
          marginBottom: '1.5rem',
          letterSpacing: '-1px',
        }}
      >
        CodeVitals
      </h1>

      <p
        style={{
          fontSize: '1.15rem',
          color: '#50575e',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}
      >
        The diagnostic tool for your repositories. Surface critical bugs, triage stale issues,
        prioritize feature requests, monitor community health, and track performance metrics —
        all scored and ranked so you know what needs attention.
      </p>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {isAuthenticated ? (
          <Button variant="primary" onClick={() => navigate('/repos')}>
            Go to Repos
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign in with GitHub
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            document.getElementById('public-dashboards')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Explore Public Dashboards
        </Button>
      </div>
      </div>
    </section>
  );
}

/**
 * Public dashboards section
 */
function PublicDashboardsSection() {
  const { data: repos, isLoading, error } = useQuery(publicReposQueryOptions());

  return (
    <section
      id="public-dashboards"
      style={{
        padding: '4rem 2rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          marginBottom: '0.75rem',
          fontSize: '1.5rem',
          fontWeight: 600,
        }}
      >
        Public Performance Dashboards
      </h2>
      <p style={{ textAlign: 'center', color: '#50575e', marginBottom: '2.5rem' }}>
        Explore performance metrics from open source projects
      </p>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner />
        </div>
      )}

      {error && (
        <Notice status="error" isDismissible={false}>
          Failed to load public dashboards
        </Notice>
      )}

      {repos && repos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#50575e' }}>No public dashboards available yet.</p>
      )}

      {repos && repos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {repos.map((repo) => (
            <PublicRepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Footer section
 */
function FooterSection() {
  return (
    <footer
      style={{
        padding: '2rem',
        textAlign: 'center',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#f6f7f7',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
        <p style={{ color: '#50575e', margin: 0, fontSize: '0.875rem' }}>
          Built with care for open source projects
        </p>
        <a
          href="https://github.com/automattic/gitaudit"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#50575e', display: 'flex', alignItems: 'center' }}
          aria-label="View source on GitHub"
        >
          <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </footer>
  );
}

/**
 * Homepage component
 */
function Homepage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <PublicHeader />
      <HeroSection />
      <PublicDashboardsSection />
      <FooterSection />
    </div>
  );
}

export default Homepage;
