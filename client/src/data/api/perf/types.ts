export interface PerfDataPoint {
  id: number;
  repoId: number;
  branch: string;
  hash: string;
  metricId: number;
  value: number;
  rawValue: number;
  measuredAt: string;
  isRegression: boolean;
  regressionPercent: number | null;
}

export interface MetricAverage {
  average: number | null;
  previous: number | null;
  regressionCount: number;
}
