import { useState, useRef, useCallback, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Button, Notice } from '@wordpress/components';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { metricsQueryOptions } from '@/data/queries/metrics';
import { perfEvolutionQueryOptions, perfAverageQueryOptions } from '@/data/queries/perf';
import type { Metric } from '@/data/api/metrics/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

const LIMITS = [
  { label: '200 commits', value: 200 },
  { label: '1000 commits', value: 1000 },
];

// Format number with commas and max 2 decimal places
const formatNumber = (num: number) =>
  num.toLocaleString(undefined, { maximumFractionDigits: 2 });

// Metrics where higher values are better (not regressions)
const HIGHER_IS_BETTER_PATTERNS = ['coverage', 'score', 'accuracy', 'uptime'];

const isHigherBetter = (metricKey: string): boolean => {
  const lowerKey = metricKey.toLowerCase();
  return HIGHER_IS_BETTER_PATTERNS.some((pattern) => lowerKey.includes(pattern));
};

// Colors matching GitAudit's palette
const COLORS = {
  positive: '#00a32a',
  negative: '#d63638',
  neutral: '#50575e',
  primary: '#3858e9',
  border: '#e0e0e0',
  cardBg: '#f6f7f7',
  cardActiveBg: '#fff',
};

interface TooltipData {
  isVisible: boolean;
  left?: number;
  top?: number;
  hash?: string;
  value?: string;
}

/**
 * Limit picker buttons
 */
function LimitPicker({
  limit,
  onChange,
}: {
  limit: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      {LIMITS.map((item, index) => (
        <span key={item.value} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => onChange(item.value)}
            style={{
              padding: '0.25rem 0.5rem',
              border: 'none',
              background: 'none',
              color: item.value === limit ? COLORS.primary : COLORS.neutral,
              fontWeight: item.value === limit ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
            }}
          >
            {item.label}
          </button>
          {index < LIMITS.length - 1 && (
            <span style={{ color: COLORS.border, margin: '0 0.25rem' }}>|</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Custom tooltip for chart data points
 */
function GraphTooltip({
  tooltipData,
  repoUrl,
}: {
  tooltipData: TooltipData;
  repoUrl?: string;
}) {
  if (!tooltipData.isVisible || !tooltipData.hash) {
    return null;
  }

  const commitUrl = repoUrl ? `${repoUrl}/commit/${tooltipData.hash}` : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: tooltipData.left,
        top: tooltipData.top,
        transform: 'translate(-50%, -100%)',
        background: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '4px',
        padding: '0.5rem 0.75rem',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'monospace',
        pointerEvents: 'auto',
        zIndex: 100,
        marginTop: '-8px',
      }}
    >
      <div>
        {commitUrl ? (
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#9ec5fe', textDecoration: 'none' }}
          >
            {tooltipData.hash.slice(0, 7)}
          </a>
        ) : (
          <span>{tooltipData.hash.slice(0, 7)}</span>
        )}
      </div>
      {tooltipData.value && (
        <div style={{ marginTop: '0.25rem' }}>{tooltipData.value}</div>
      )}
    </div>
  );
}

/**
 * "Other" card with dropdown menu for non-visible metrics
 */
function OtherMetricsCard({
  metrics,
  selectedMetricKey,
  onSelect,
}: {
  metrics: Metric[];
  selectedMetricKey?: string;
  onSelect: (metric: Metric) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = metrics.some((m) => m.key === selectedMetricKey);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (metrics.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
        borderRadius: '4px',
        backgroundColor: isActive ? COLORS.cardActiveBg : COLORS.cardBg,
        minWidth: '150px',
        height: '100%',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#1e1e1e',
          }}
        >
          Other
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              color: COLORS.neutral,
            }}
          >
            ({metrics.length})
          </span>
        </div>
        <span
          style={{
            color: COLORS.neutral,
            fontSize: '0.75rem',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 50,
            marginTop: '4px',
            overflow: 'hidden',
          }}
        >
          {metrics.map((metric, index) => (
            <div
              key={metric.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelect(metric);
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSelect(metric);
                  setIsOpen(false);
                }
              }}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: metric.key === selectedMetricKey ? COLORS.primary : '#1e1e1e',
                fontWeight: metric.key === selectedMetricKey ? 500 : 400,
                backgroundColor:
                  metric.key === selectedMetricKey ? 'rgba(56, 88, 233, 0.05)' : 'transparent',
                borderBottom: index < metrics.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              }}
              onMouseEnter={(e) => {
                if (metric.key !== selectedMetricKey) {
                  e.currentTarget.style.backgroundColor = '#f6f7f7';
                }
              }}
              onMouseLeave={(e) => {
                if (metric.key !== selectedMetricKey) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {metric.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Metric card showing name, average, and change percentage
 */
function MetricCard({
  metric,
  owner,
  repo,
  isActive,
  onSelect,
}: {
  metric: Metric;
  owner: string;
  repo: string;
  isActive: boolean;
  onSelect: () => void;
}) {
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{
        padding: '1.25rem 1rem',
        cursor: 'pointer',
        border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
        borderRadius: '4px',
        backgroundColor: isActive ? COLORS.cardActiveBg : COLORS.cardBg,
        minWidth: '150px',
      }}
    >
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#1e1e1e',
          marginBottom: '0.5rem',
        }}
      >
        {metric.name}
      </div>

      {isLoading ? (
        <div style={{ padding: '0.5rem 0' }}>
          <Spinner />
        </div>
      ) : (
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
                fontSize: '1.5rem',
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
                    fontSize: '0.75rem',
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
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
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
      )}
    </div>
  );
}

/**
 * Chart handle for parent to control zoom
 */
interface MetricChartHandle {
  resetZoom: () => void;
  isZoomed: boolean;
}

/**
 * Line chart for metric evolution
 */
const MetricChart = forwardRef<
  MetricChartHandle,
  {
    metric: Metric;
    owner: string;
    repo: string;
    limit: number;
    repoUrl?: string;
    onZoomChange?: (isZoomed: boolean) => void;
  }
>(function MetricChart({ metric, owner, repo, limit, repoUrl, onZoomChange }, ref) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [tooltipData, setTooltipData] = useState<TooltipData>({ isVisible: false });

  const { data: perfData, isLoading } = useQuery(
    perfEvolutionQueryOptions(owner, repo, metric.id, limit)
  );

  // Expose zoom controls to parent
  useImperativeHandle(
    ref,
    () => ({
      resetZoom: () => {
        setIsZoomed(false);
        setTooltipData({ isVisible: false });
        chartRef.current?.resetZoom();
        onZoomChange?.(false);
      },
      isZoomed,
    }),
    [isZoomed, onZoomChange]
  );

  // Reset zoom when metric or limit changes
  useEffect(() => {
    setIsZoomed(false);
    setTooltipData({ isVisible: false });
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, [metric.id, limit]);

  // Custom tooltip handler
  const externalTooltip = useCallback(
    (context: {
      chart: ChartJS;
      tooltip: {
        opacity: number;
        caretX: number;
        caretY: number;
        dataPoints?: Array<{ dataIndex: number }>;
        title?: string[];
        body?: Array<{ lines: string[] }>;
      };
    }) => {
      const { chart, tooltip } = context;

      if (tooltip.opacity === 0) {
        setTooltipData({ isVisible: false });
        return;
      }

      const { offsetLeft, offsetTop } = chart.canvas;
      const dataIndex = tooltip.dataPoints?.[0]?.dataIndex;
      const hash = dataIndex !== undefined && perfData ? perfData[dataIndex]?.hash : '';

      setTooltipData({
        isVisible: true,
        left: offsetLeft + tooltip.caretX,
        top: offsetTop + tooltip.caretY,
        hash: hash || '',
        value: tooltip.body?.[0]?.lines?.[0] || '',
      });
    },
    [perfData]
  );

  const handleZoomComplete = useCallback(() => {
    setIsZoomed(true);
    onZoomChange?.(true);
  }, [onZoomChange]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxTicksAuto: 8,
            color: COLORS.neutral,
            font: {
              size: 11,
            },
          },
          grid: {
            display: false,
          },
        },
        y: {
          min: 0,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          events: ['click'] as const,
          enabled: false,
          external: externalTooltip,
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy' as const,
            modifierKey: 'shift' as const,
          },
          zoom: {
            drag: {
              enabled: true,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
            },
            mode: 'x' as const,
            onZoomComplete: handleZoomComplete,
          },
        },
      },
    }),
    [externalTooltip, handleZoomComplete]
  );

  // Format date for x-axis labels
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const chartData = useMemo(
    () => ({
      labels: perfData?.map((p) => formatDate(p.measuredAt)) || [],
      datasets: [
        {
          label: metric.name,
          data: perfData?.map((p) => p.value) || [],
          borderColor: '#3858e9',
          backgroundColor: 'rgba(56, 88, 233, 0.1)',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.1,
        },
      ],
    }),
    [perfData, metric.name]
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner />
      </div>
    );
  }

  if (!perfData?.length) {
    return (
      <Notice status="info" isDismissible={false}>
        No performance data recorded yet for this metric.
      </Notice>
    );
  }

  return (
    <div style={{ padding: '1.5rem', height: '400px', position: 'relative' }}>
      <Line ref={chartRef} data={chartData} options={chartOptions} />
      <GraphTooltip tooltipData={tooltipData} repoUrl={repoUrl} />
    </div>
  );
});

export interface MetricsDashboardContentProps {
  owner: string;
  repo: string;
  repoUrl?: string;
}

/**
 * Shared metrics dashboard content - used by both authenticated and public wrappers
 */
export function MetricsDashboardContent({ owner, repo, repoUrl }: MetricsDashboardContentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const chartRef = useRef<MetricChartHandle>(null);

  const selectedMetricKey = searchParams.get('metric');
  const [limit, setLimit] = useState(200);
  const [isZoomed, setIsZoomed] = useState(false);

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery(metricsQueryOptions(owner, repo));

  // Find selected metric or default to first visible one
  const visibleMetrics = metrics?.filter((m) => m.defaultVisible) || [];
  const hiddenMetrics = metrics?.filter((m) => !m.defaultVisible) || [];
  const selectedMetric =
    metrics?.find((m) => m.key === selectedMetricKey) || visibleMetrics[0] || metrics?.[0];

  // Update URL when metric changes
  const handleSelectMetric = (metric: Metric) => {
    setSearchParams({ metric: metric.key });
  };

  const handleResetZoom = () => {
    chartRef.current?.resetZoom();
  };

  if (metricsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner />
      </div>
    );
  }

  if (metricsError) {
    return (
      <div style={{ padding: '2rem' }}>
        <Notice status="error" isDismissible={false}>
          {(metricsError as Error).message || 'Failed to load metrics'}
        </Notice>
      </div>
    );
  }

  if (!metrics?.length) {
    return (
      <div style={{ padding: '2rem' }}>
        <Notice status="info" isDismissible={false}>
          No metrics available for this repository.
        </Notice>
      </div>
    );
  }

  return (
    <>
      {/* Metric cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        {(visibleMetrics.length > 0 ? visibleMetrics : metrics).map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            owner={owner}
            repo={repo}
            isActive={selectedMetric?.id === metric.id}
            onSelect={() => handleSelectMetric(metric)}
          />
        ))}
        {hiddenMetrics.length > 0 && (
          <OtherMetricsCard
            metrics={hiddenMetrics}
            selectedMetricKey={selectedMetricKey || undefined}
            onSelect={handleSelectMetric}
          />
        )}
      </div>

      {/* Chart controls and chart */}
      {selectedMetric && (
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Header: Metric name | Reset Zoom */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `1px solid ${COLORS.border}`,
              padding: '0.75rem 1rem',
              backgroundColor: COLORS.cardBg,
            }}
          >
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#1e1e1e',
              }}
            >
              {selectedMetric.name}
            </div>
            <Button
              variant="secondary"
              disabled={!isZoomed}
              onClick={handleResetZoom}
              style={{ opacity: isZoomed ? 1 : 0.5 }}
            >
              Reset Zoom
            </Button>
          </div>

          <MetricChart
            ref={chartRef}
            metric={selectedMetric}
            owner={owner}
            repo={repo}
            limit={limit}
            repoUrl={repoUrl}
            onZoomChange={setIsZoomed}
          />

          {/* Footer: Limit tabs | Tip */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              borderTop: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.cardBg,
            }}
          >
            <LimitPicker limit={limit} onChange={setLimit} />
            <div
              style={{
                fontSize: '0.75rem',
                color: COLORS.neutral,
              }}
            >
              <strong>Tip:</strong> Click to see commit. Drag to zoom, Shift+drag to pan.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
