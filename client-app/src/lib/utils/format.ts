/**
 * Format international phone number with country code (e.g. +1, +82)
 * Preserves country code format if present, otherwise allows flexible input
 */
export function formatPhoneNumber(value: string): string {
  // If starts with +, preserve country code format
  if (value.startsWith('+')) {
    // Allow + followed by country code and flexible spacing/hyphens
    return value.replace(/[^\d+\-() ]/g, '');
  }

  // For US numbers without +, try to format as (123) 456-7890
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) {
    // If more than 10 digits, assume it's international format - return as-is
    return value.replace(/[^\d+\-() ]/g, '');
  }

  // Standard US formatting for 10 digits or less
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Format ZIP code to 12345 or 12345-6789 format
 */
export function formatZipCode(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Limit to 9 digits
  const limited = digits.slice(0, 9);

  // Format based on length
  if (limited.length === 0) return '';
  if (limited.length <= 5) return limited;
  return `${limited.slice(0, 5)}-${limited.slice(5)}`;
}

/**
 * Format Instagram ID to ensure @ prefix
 */
export function formatInstagramId(value: string): string {
  // Remove all characters except letters, numbers, periods, underscores, and @
  const cleaned = value.replace(/[^a-zA-Z0-9._@]/g, '');

  // Remove any @ symbols that aren't at the start
  const withoutMiddleAt = cleaned.replace(/(?!^)@/g, '');

  // Ensure @ prefix
  if (withoutMiddleAt.length === 0) return '';
  return withoutMiddleAt.startsWith('@') ? withoutMiddleAt : `@${withoutMiddleAt}`;
}

/**
 * Format price in USD currency format
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}
