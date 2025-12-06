/**
 * Extract a user-friendly error message from an unknown error
 * @param error - The error object (can be Error, string, or unknown)
 * @param defaultMessage - Fallback message if error cannot be parsed
 * @returns A string error message
 */
export const getErrorMessage = (
  error: unknown,
  defaultMessage: string
): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return defaultMessage;
};
