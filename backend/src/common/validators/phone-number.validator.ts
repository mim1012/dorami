export const PHONE_INPUT_PATTERN =
  /^(\+1|1)?[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}$|^(\+82|0)\d{8,11}$/;

export const PHONE_PAYLOAD_PATTERN = /^(\+1\d{10}|1\d{10}|\d{10}|\+82\d{8,11}|0\d{8,11})$/;

export const KAKAO_PHONE_MESSAGE =
  'Invalid phone number format. Use examples: +1 213-555-1234, 1 213-555-1234, 010-1234-5678, +82 10-1234-5678';

export function normalizePhoneForBackend(value: string): string {
  if (!value) {
    return '';
  }

  const compact = value.trim().replace(/[^\d+]/g, '');
  if (!compact) {
    return '';
  }

  if (compact.startsWith('+82')) {
    return `+82${compact.slice(3).replace(/^0+/, '0')}`;
  }

  if (compact.startsWith('+1')) {
    return `+1${compact.slice(2)}`;
  }

  // 82로 시작하지만 + 없는 경우 — 한국 국가코드로 처리
  if (/^82\d{8,11}$/.test(compact)) {
    return `+${compact}`;
  }

  return compact;
}
