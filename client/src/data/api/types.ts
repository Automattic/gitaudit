// Shared API types

export interface ApiError {
  message: string;
  status?: number;
  details?: string[];
}

export interface PaginationParams {
  page: number;
  per_page: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}
