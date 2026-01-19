export interface Metric {
  id: number;
  repoId: number;
  key: string;
  name: string;
  unit: string | null;
  priority: number;
  defaultVisible: boolean;
  createdAt: string;
}

export interface CreateMetricInput {
  key: string;
  name: string;
  unit?: string;
  priority?: number;
  defaultVisible?: boolean;
}

export interface UpdateMetricInput {
  name?: string;
  unit?: string;
  priority?: number;
  defaultVisible?: boolean;
}
