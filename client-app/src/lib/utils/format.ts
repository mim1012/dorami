/**
 * Format phone number to US format: (123) 456-7890
 * Only accepts US +1 numbers (no international numbers)
 * Optimized for Korean Americans using US phone numbers
 */
export function formatPhoneNumber(value: string): string {
  // Extract only digits and + sign
  const cleaned = value.replace(/[^\d+]/g, '');

  // Handle empty input
  if (!cleaned) return '';

  // Check if it has country code (+1 for US)
  let digits = cleaned;

  if (cleaned.startsWith('+1')) {
    digits = cleaned.slice(2); // Remove +1
  } else if (cleaned.startsWith('+')) {
    // Other country codes not supported
    return '';
  }

  // Limit to 10 digits (US phone number length)
  digits = digits.slice(0, 10);

  // Format: (123) 456-7890
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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
