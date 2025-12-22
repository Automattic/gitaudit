/**
 * Sentinel value indicating an API key is set without exposing the actual value
 */
export const API_KEY_SENTINEL = '***SET***';

/**
 * Check if an API key value is the sentinel (already set)
 */
export function isApiKeySet(apiKey: string | undefined): boolean {
  return apiKey === API_KEY_SENTINEL;
}

/**
 * Check if an API key value is empty (not set)
 */
export function isApiKeyEmpty(apiKey: string | undefined): boolean {
  return !apiKey || apiKey.trim() === '';
}
