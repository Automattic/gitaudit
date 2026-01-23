import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@wordpress/components';
import { perfAverageQueryOptions } from '@/data/queries/perf';
import type { Metric } from '@/data/api/metrics/types';

// Colors for trend indicators
const COLORS = {
  positive: '#00a32a',
  negative: '#d63638',
  neutral: '#50575e',
  primary: '#3858e9',
};

// Format number with commas and max 2 decimal places
const formatNumber = (num: number) =>
  num.toLocaleString(undefined, { maximumFractionDigits: 2 });

// Metrics where higher values are better (not regressions)
const HIGHER_IS_BETTER_PATTERNS = ['coverage', 'score', 'accuracy', 'uptime'];

const isHigherBetter = (metricKey: string): boolean => {
  const lowerKey = metricKey.toLowerCase();
  return HIGHER_IS_BETTER_PATTERNS.some((pattern) => lowerKey.includes(pattern));
};

export interface MetricSummaryProps {
  metric: Metric;
  owner: string;
  repo: string;
  /** Size variant for different contexts */
  size?: 'default' | 'compact';
}

/**
 * Metric summary content showing name, average value, and change percentage.
 * This is the content only - wrap it in your own card/container with desired styling.
 */
export function MetricSummary({ metric, owner, repo, size = 'default' }: MetricSummaryProps) {
  const { data, isLoading } = useQuery(perfAverageQueryOptions(owner, repo, metric.id));

  // Calculate change percentage
  let change: number | null = null;
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (data?.average && data?.previous) {
    change = (data.average - data.previous) / data.previous;
    const higherBetter = isHigherBetter(metric.key);

    if (Math.abs(change) >= 0.05) {
      if (higherBetter) {
        sentiment = change > 0 ? 'positive' : 'negative';
      } else {
        sentiment = change > 0 ? 'negative' : 'positive';
      }
    }
  }

  // Size-based styling
  const styles = {
    default: {
      valueFontSize: '1.5rem',
      labelFontSize: '0.875rem',
      unitFontSize: '0.75rem',
      badgePadding: '0.25rem 0.5rem',
      badgeFontSize: '0.75rem',
    },
    compact: {
      valueFontSize: '1.25rem',
      labelFontSize: '0.8125rem',
      unitFontSize: '0.75rem',
      badgePadding: '0.125rem 0.375rem',
      badgeFontSize: '0.6875rem',
    },
  }[size];

  if (isLoading) {
    return (
      <>
        <div
          style={{
            fontSize: styles.labelFontSize,
            fontWeight: 500,
            color: '#1e1e1e',
            marginBottom: '0.5rem',
          }}
        >
          {metric.name}
        </div>
        <div style={{ padding: '0.5rem 0' }}>
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      <div
        style={{
          fontSize: styles.labelFontSize,
          fontWeight: 500,
          color: '#1e1e1e',
          marginBottom: '0.5rem',
        }}
      >
        {metric.name}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {data?.average !== null && data?.average !== undefined && (
          <div
            style={{
              fontSize: styles.valueFontSize,
              fontWeight: 600,
              color: COLORS.primary,
              fontFamily: 'monospace',
            }}
            title="Average of last 20 commits (normalized)"
          >
            {formatNumber(data.average)}
            {metric.unit && (
              <span
                style={{
                  fontSize: styles.unitFontSize,
                  marginLeft: '0.25rem',
                  color: COLORS.neutral,
                }}
              >
                {metric.unit}
              </span>
            )}
          </div>
        )}

        {change !== null && sentiment !== 'neutral' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: styles.badgePadding,
              borderRadius: '4px',
              fontSize: styles.badgeFontSize,
              fontWeight: 500,
              backgroundColor:
                sentiment === 'positive'
                  ? 'rgba(0, 163, 42, 0.1)'
                  : 'rgba(214, 54, 56, 0.1)',
              color: sentiment === 'positive' ? COLORS.positive : COLORS.negative,
            }}
            title="Change compared to previous 20 commits"
          >
            <span style={{ marginRight: '0.25rem' }}>{change > 0 ? '↑' : '↓'}</span>
            {change > 0 ? '+' : ''}
            {formatNumber(change * 100)}%
          </div>
        )}
      </div>
    </>
  );
}

export default MetricSummary;
