import { ApiError } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * API Error class for structured error handling
 */
export class ApiRequestError extends Error implements ApiError {
  status?: number;
  details?: string[];

  constructor(message: string, status?: number, details?: string[]) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Generic request function with auth injection
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle authentication error (session expired)
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login?error=session_expired';
      throw new ApiRequestError('Session expired. Please login again.', response.status);
    }

    // Handle permission denied (user is authenticated but lacks permission)
    if (response.status === 403) {
      throw new ApiRequestError('You do not have permission to perform this action.', response.status);
    }

    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiRequestError(
      errorData.error || `HTTP ${response.status}`,
      response.status,
      errorData.details
    );
  }

  // Handle 204 No Content responses (e.g., DELETE)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * API client with typed methods
 */
export const apiClient = {
  get: <T>(endpoint: string): Promise<T> => request<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data?: unknown): Promise<T> =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string): Promise<T> =>
    request<T>(endpoint, { method: 'DELETE' }),
};
