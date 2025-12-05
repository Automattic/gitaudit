/**
 * Date formatting utilities for consistent timestamp handling across the application.
 *
 * Standardizes on SQLite datetime format for storage:
 * - Format: "YYYY-MM-DD HH:MM:SS" (UTC)
 * - Example: "2025-12-04 10:26:49"
 *
 * Converts to/from ISO 8601 format used by GitHub API and JavaScript:
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

/**
 * Convert SQLite datetime format to ISO 8601 string
 *
 * @param {string|null} sqliteDateTime - SQLite datetime (YYYY-MM-DD HH:MM:SS)
 * @returns {string|null} - ISO 8601 string or null
 *
 * @example
 * toISOString("2025-12-04 10:26:49") // "2025-12-04T10:26:49.000Z"
 * toISOString(null) // null
 */
export function toISOString(sqliteDateTime) {
  if (!sqliteDateTime) return null;

  try {
    // SQLite datetime is stored as UTC but without timezone indicator
    // We need to append 'Z' to tell JavaScript it's UTC, otherwise it assumes local time
    const date = new Date(sqliteDateTime + ' UTC');

    // Validate date
    if (isNaN(date.getTime())) {
      console.error(`Invalid SQLite datetime: ${sqliteDateTime}`);
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.error(`Error converting SQLite datetime to ISO:`, error);
    return null;
  }
}

/**
 * Parse SQLite datetime string to JavaScript Date object
 *
 * CRITICAL: Use this function whenever reading datetime values from the SQLite database.
 * SQLite stores datetimes in "YYYY-MM-DD HH:MM:SS" format without timezone indicators.
 * JavaScript's Date() constructor interprets such strings as LOCAL time, not UTC,
 * causing timezone-dependent bugs.
 *
 * @param {string|null} sqliteDateTime - SQLite datetime (YYYY-MM-DD HH:MM:SS)
 * @returns {Date|null} - Date object (UTC) or null
 *
 * @example
 * parseSqliteDate("2025-12-04 10:26:49") // Date object representing 2025-12-04T10:26:49.000Z
 * parseSqliteDate(null) // null
 */
export function parseSqliteDate(sqliteDateTime) {
  if (!sqliteDateTime) return null;

  try {
    // SQLite datetime is stored as UTC but without timezone indicator
    // Append ' UTC' to tell JavaScript to interpret as UTC, not local time
    const date = new Date(sqliteDateTime + ' UTC');

    // Validate date
    if (isNaN(date.getTime())) {
      console.error(`Invalid SQLite datetime: ${sqliteDateTime}`);
      return null;
    }

    return date;
  } catch (error) {
    console.error(`Error parsing SQLite datetime:`, error);
    return null;
  }
}

/**
 * Get current timestamp in SQLite format
 * Equivalent to SQLite's CURRENT_TIMESTAMP but as a string parameter
 *
 * @returns {string} - Current timestamp in SQLite format
 *
 * @example
 * now() // "2025-12-04 10:26:49"
 */
export function now() {
  return toSqliteDateTime(new Date());
}
