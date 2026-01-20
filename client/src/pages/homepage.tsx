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
  // Determine if higher values are better based on metric key
  const isHigherBetter = ['coverage', 'score', 'accuracy', 'uptime'].some((p) =>
    metric.key.toLowerCase().includes(p)
  );

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (metric.changePercent !== null && Math.abs(metric.changePercent) >= 0.05) {
    if (isHigherBetter) {
      sentiment = metric.changePercent > 0 ? 'positive' : 'negative';
    } else {
      sentiment = metric.changePercent > 0 ? 'negative' : 'positive';
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      {/* Metric name and value */}
      <div style={{ flex: '0 0 auto', minWidth: '80px' }}>
        <div style={{ fontSize: '0.7rem', color: '#50575e', marginBottom: '2px' }}>{metric.name}</div>
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

      {/* Sparkline */}
      {metric.sparklineData.length > 1 && (
        <div style={{ flex: '1 1 auto' }}>
          <MiniSparkline
            data={metric.sparklineData}
            color={sentiment === 'negative' ? '#d63638' : '#3858e9'}
          />
        </div>
      )}

      {/* Change indicator */}
      {metric.changePercent !== null && sentiment !== 'neutral' && (
        <div
          style={{
            flex: '0 0 auto',
            fontSize: '0.7rem',
            fontWeight: 500,
            color: sentiment === 'positive' ? '#00a32a' : '#d63638',
          }}
        >
          {metric.changePercent > 0 ? '+' : ''}
          {(metric.changePercent * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

/**
 * Public repo card with metrics
 */
function PublicRepoCard({ repo }: { repo: PublicRepo }) {
  const navigate = useNavigate();

  // Show first 3 metrics
  const displayMetrics = repo.metrics.slice(0, 3);

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
        Track performance metrics across your repositories. Identify regressions, monitor trends,
        and share public dashboards with your community.
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
      <p style={{ color: '#50575e', margin: 0, fontSize: '0.875rem' }}>
        Built with care for open source projects
      </p>
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
