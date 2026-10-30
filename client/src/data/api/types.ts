// Shared API types

export interface ApiError {
  message: string;
  status?: number;
  details?: string[];
}
