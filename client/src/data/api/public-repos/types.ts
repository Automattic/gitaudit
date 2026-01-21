export interface PublicRepoMetric {
  id: number;
  key: string;
  name: string;
  unit: string | null;
  defaultVisible: boolean;
  sparklineData: number[];
  currentAverage: number | null;
  changePercent: number | null;
}

export interface PublicRepo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  languageColor: string | null;
  metrics: PublicRepoMetric[];
}
