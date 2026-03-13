/**
 * Format phone number to US format: (123) 456-7890
 * Only accepts US +1 numbers (no international numbers)
 * Optimized for Korean Americans using US phone numbers
 */
export type PhoneRegion = 'US' | 'KR';

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
 * Format phone number input for display while typing.
 * Supports both Korean (+82 / 0xxx...) and US (+1) formats.
 * Keeps `+` prefix when provided.
 */
export function formatPhoneNumberForInput(value: string, region?: PhoneRegion): string {
  if (!value) {
    return '';
  }

  const cleaned = value.replace(/[^\d+]/g, '');
  if (!cleaned) {
    return '';
  }

  if (region === 'KR') {
    const raw = cleaned.startsWith('+82') ? cleaned.slice(3) : cleaned.replace('+', '');
    const digits = raw.replace(/^0+/, '0');

    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  if (region === 'US') {
    // Preserve '+' so user can continue typing '+1'
    if (cleaned === '+') return '+';
    const hasPlusOne = cleaned.startsWith('+1');
    const digits = hasPlusOne ? cleaned.slice(2) : cleaned.replace(/[^\d]/g, '');
    const short = digits.slice(0, 10);
    if (short.length <= 3) return hasPlusOne ? `+1 ${short}` : short;
    if (short.length <= 6)
      return hasPlusOne
        ? `+1 ${short.slice(0, 3)}-${short.slice(3)}`
        : `(${short.slice(0, 3)}) ${short.slice(3)}`;
    return hasPlusOne
      ? `+1 ${short.slice(0, 3)}-${short.slice(3, 6)}-${short.slice(6, 10)}`
      : `(${short.slice(0, 3)}) ${short.slice(3, 6)}-${short.slice(6, 10)}`;
  }

  // Auto-detect behavior (existing behavior)
  if (cleaned.startsWith('+1')) {
    const digits = cleaned.slice(2);
    if (digits.length <= 3) return `+1 ${digits}`;
    if (digits.length <= 6) return `+1 ${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  // +82 010... -> +82 010-1234-5678
  if (cleaned.startsWith('+82')) {
    const local = cleaned.slice(3).startsWith('0') ? cleaned.slice(3) : `0${cleaned.slice(3)}`;
    if (local.length <= 3) return local;
    if (local.length <= 7) return `${local.slice(0, 3)}-${local.slice(3)}`;
    return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7, 11)}`;
  }

  const digits = cleaned;
  // 0xx-xxxx-xxxx (Korean local)
  if (digits.startsWith('0')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  // 10-digit US number (no +1 prefix)
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Normalize phone number for backend payload (compact storage format).
 * Keeps only digits and optional leading +.
 */
export function normalizePhoneForBackend(value: string): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const compact = trimmed.replace(/[^\d+]/g, '');
  if (!compact) {
    return '';
  }

  if (compact.startsWith('+82')) {
    const tail = compact.slice(3).replace(/^0+/, '0');
    return `+82${tail}`;
  }

  if (compact.startsWith('+1')) {
    return `+1${compact.slice(2).replace(/[^\d]/g, '')}`;
  }

  return compact;
}

/**
 * Validate phone number used by profile/kakao flows.
 * Accept:
 *  - +1XXXXXXXXXX
 *  - 1XXXXXXXXXX
 *  - +82XXXXXXXXX (without separators)
 *  - 0XXXXXXXXXX
 */
export function isValidProfilePhone(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizePhoneForBackend(value);
  if (!normalized) {
    return false;
  }

  if (/^\+1\d{10}$/.test(normalized)) {
    return true;
  }

  if (/^1\d{10}$/.test(normalized)) {
    return true;
  }

  if (/^\d{10}$/.test(normalized)) {
    return true;
  }

  if (/^\+82\d{8,11}$/.test(normalized)) {
    return true;
  }

  if (/^0\d{8,11}$/.test(normalized)) {
    return true;
  }

  return false;
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
 * Format live stream scheduled time for US-based Korean users.
 * Shows browser local time (auto-detected timezone) + KST reference.
 *
 * Example output:
 *   "3월 10일(월) 오전 7:00 (한국 밤 9:00)"
 *   "3월 10일(월) 오전 4:00 (한국 밤 9:00)"
 */
export function formatStreamSchedule(isoString: string): {
  dayLabel: string;
  timeLabel: string;
  kstLabel: string;
} {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return { dayLabel: '날짜 미정', timeLabel: '', kstLabel: '' };
  }

  const dayLabel = date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });

  const timeLabel = date.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: 'numeric',
  });

  const kstTime = date.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'Asia/Seoul',
  });
  const kstLabel = `한국 ${kstTime}`;

  return { dayLabel, timeLabel, kstLabel };
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
