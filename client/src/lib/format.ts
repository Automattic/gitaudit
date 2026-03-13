const BYTE_DIVISORS: Record<string, number> = {
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

/**
 * Format a numeric value, automatically dividing by the appropriate power of 1024
 * when the unit is a byte-scale unit (KB, MB, GB, TB).
 */
export const formatValueWithUnit = (num: number, unit: string | null | undefined): string => {
  const divisor = unit ? BYTE_DIVISORS[unit.toLowerCase()] : undefined;
  const converted = divisor ? num / divisor : num;
  return converted.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
