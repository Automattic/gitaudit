/**
 * GitHub API Rate Limit Handler
 *
 * Provides utilities for detecting, handling, and retrying GitHub API rate limit errors.
 * Implements exponential backoff with jitter and cooldown mechanisms.
 */

// Rate limiting configuration constants
export const rateLimitConfig = {
  baseRequestDelay: 750,        // 750ms delay between API requests
  maxRetryAttempts: 3,           // Max retry attempts per request
  retryBaseDelay: 5000,          // Initial backoff delay (5s)
  retryMaxDelay: 30000,          // Max backoff delay (30s)
  rateLimitCooldown: 120000,     // Cooldown after repeated rate limits (2 min)
};

// Rate limit state tracking
let lastRateLimitTime = 0;
let consecutiveRateLimits = 0;

/**
 * Check if an error is a GitHub rate limit error
 * @param {Error} error - The error to check
 * @returns {boolean} True if rate limit error
 */
export function isRateLimitError(error) {
  if (!error) return false;

  // Check HTTP status codes (429 = rate limit, 403 = secondary rate limit)
  if (error.status === 429 || error.status === 403) {
    return true;
  }

  // Check error message content
  const message = (error.message || '').toLowerCase();
  if (
    message.includes('rate limit') ||
    message.includes('secondary rate limit') ||
    message.includes('abuse detection')
  ) {
    return true;
  }

  // Check GraphQL error types
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors.some((e) => e.type === 'RATE_LIMITED');
  }

  return false;
}

/**
 * Check if error is a primary rate limit (API quota exceeded)
 * @param {Error} error - The error to check
 * @returns {boolean} True if primary rate limit
 */
export function isPrimaryRateLimit(error) {
  if (!error) return false;
  return (
    error.status === 429 ||
    (error.message && error.message.includes('API rate limit exceeded'))
  );
}

/**
 * Check if error is a secondary rate limit (abuse detection)
 * @param {Error} error - The error to check
 * @returns {boolean} True if secondary rate limit
 */
export function isSecondaryRateLimit(error) {
  return isRateLimitError(error) && !isPrimaryRateLimit(error);
}

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - The attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, baseDelay = 5000) {
  // Exponential: 2^attempt * baseDelay
  const exponentialDelay = Math.pow(2, attempt) * baseDelay;

  // Add jitter (0-500ms) to prevent thundering herd
  const jitter = Math.random() * 500;

  // Cap at max delay
  const delay = Math.min(exponentialDelay + jitter, rateLimitConfig.retryMaxDelay);

  return Math.round(delay);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Record a rate limit hit and return consecutive hit count
 * @returns {number} Number of consecutive rate limit hits
 */
export function recordRateLimitHit() {
  const now = Date.now();
  const timeSinceLastHit = now - lastRateLimitTime;

  if (timeSinceLastHit < 60000) {
    // Within 1 minute
    consecutiveRateLimits++;
  } else {
    consecutiveRateLimits = 1;
  }

  lastRateLimitTime = now;
  return consecutiveRateLimits;
}

/**
 * Check if we should apply cooldown due to repeated rate limits
 * @returns {boolean} True if cooldown should be applied
 */
export function shouldApplyCooldown() {
  const timeSinceLastHit = Date.now() - lastRateLimitTime;
  return consecutiveRateLimits >= 3 && timeSinceLastHit < rateLimitConfig.rateLimitCooldown;
}

/**
 * Get remaining cooldown time in milliseconds
 * @returns {number} Remaining cooldown time in ms
 */
export function getCooldownRemaining() {
  const elapsed = Date.now() - lastRateLimitTime;
  return Math.max(0, rateLimitConfig.rateLimitCooldown - elapsed);
}

/**
 * Retry a function with exponential backoff on rate limit errors
 * @param {Function} fn - Async function to retry
 * @param {string} context - Context for logging
 * @param {number} maxAttempts - Maximum retry attempts
 * @returns {Promise<any>} Result of the function
 */
export async function withRetry(fn, context = '', maxAttempts = rateLimitConfig.maxRetryAttempts) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error)) {
        // Non-rate-limit error, fail immediately
        throw error;
      }

      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        console.error(
          `[RateLimit] ${context} - Max retries reached (${maxAttempts}), giving up`
        );
        throw error;
      }

      const delay = calculateBackoffDelay(attempt);
      const limitType = isPrimaryRateLimit(error) ? 'primary' : 'secondary';

      console.warn(
        `[RateLimit] ${context} - Hit ${limitType} rate limit (attempt ${attempt + 1}/${maxAttempts}), ` +
          `backing off for ${delay}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
