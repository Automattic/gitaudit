export interface PerfDataPoint {
  id: number;
  repoId: number;
  branch: string;
  hash: string;
  metricId: number;
  value: number;
  rawValue: number;
  measuredAt: string;
}

export interface MetricAverage {
  average: number | null;
  previous: number | null;
}
