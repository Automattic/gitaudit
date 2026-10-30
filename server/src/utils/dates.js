/**
 * Date formatting utilities for consistent timestamp handling across the application.
 *
 * Standardizes on SQLite datetime format for storage:
 * - Format: "YYYY-MM-DD HH:MM:SS" (UTC)
 * - Example: "2025-12-04 10:26:49"
 *
 * Converts from the ISO 8601 format used by GitHub API and JavaScript:
 * - Format: "YYYY-MM-DDTHH:MM:SS.sssZ" (UTC with timezone indicator)
 * - Example: "2025-12-04T10:26:49.123Z"
 */

/**
 * Convert any timestamp format to SQLite datetime format
 *
 * @param {string|Date|null} timestamp - ISO 8601 string, Date object, or null
 * @returns {string|null} - SQLite datetime format (YYYY-MM-DD HH:MM:SS) or null
 *
 * @example
 * toSqliteDateTime("2025-12-04T10:26:49Z") // "2025-12-04 10:26:49"
 * toSqliteDateTime("2025-12-04T10:26:49.123Z") // "2025-12-04 10:26:49"
 * toSqliteDateTime(new Date()) // "2025-12-04 10:26:49"
 * toSqliteDateTime(null) // null
 */
export function toSqliteDateTime(timestamp) {
  if (!timestamp) return null;

  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Validate date
    if (isNaN(date.getTime())) {
      console.error(`Invalid timestamp: ${timestamp}`);
      return null;
    }

    // Format as YYYY-MM-DD HH:MM:SS (UTC)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error(`Error converting timestamp to SQLite format:`, error);
    return null;
  }
}
