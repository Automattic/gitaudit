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
  isImprovement: boolean;
  improvementPercent: number | null;
}

export interface PerfEvolutionResponse {
  data: PerfDataPoint[];
  meta: {
    totalPoints: number;
    displayedPoints: number;
    isDownsampled: boolean;
  };
}

export interface MetricAverage {
  average: number | null;
  previous: number | null;
}
