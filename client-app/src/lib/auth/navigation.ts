export const POST_LOGIN_RETURN_KEY = 'doremi_post_login_return_to';

export function sanitizeReturnPath(raw: string | null | undefined, fallback = ''): string {
  if (!raw) return fallback;

  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/')) return fallback;
    if (decoded.startsWith('//')) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

export function getReturnToFromSearchParams(searchParams: URLSearchParams): string {
  return sanitizeReturnPath(searchParams.get('returnTo') || searchParams.get('redirect'));
}

export function persistPostLoginReturnTo(returnTo: string): void {
  if (typeof window === 'undefined') return;

  try {
    const safeReturnTo = sanitizeReturnPath(returnTo);
    if (safeReturnTo) {
      window.localStorage.setItem(POST_LOGIN_RETURN_KEY, safeReturnTo);
      return;
    }

    window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
  } catch {
    // localStorage may be unavailable in restricted webviews
  }
}

export function readStoredPostLoginReturnTo(): string {
  if (typeof window === 'undefined') return '';

  try {
    return sanitizeReturnPath(window.localStorage.getItem(POST_LOGIN_RETURN_KEY));
  } catch {
    return '';
  }
}

export function consumeStoredPostLoginReturnTo(): string {
  if (typeof window === 'undefined') return '';

  try {
    const stored = window.localStorage.getItem(POST_LOGIN_RETURN_KEY);
    window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
    return sanitizeReturnPath(stored);
  } catch {
    return '';
  }
}

export function clearStoredPostLoginReturnTo(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
  } catch {
    // localStorage may be unavailable in restricted webviews
  }
}

export function resolveAuthenticatedRedirect(
  role: string | undefined,
  returnTo: string,
  fallback = '/',
): string {
  const safeReturnTo = sanitizeReturnPath(returnTo);
  if (!safeReturnTo) {
    return fallback;
  }

  if (role === 'USER' && safeReturnTo.startsWith('/admin')) {
    return fallback;
  }

  return safeReturnTo;
}

export function buildProfileRegisterRedirect(kakaoName?: string | null, returnTo?: string): string {
  const params = new URLSearchParams();
  const safeReturnTo = sanitizeReturnPath(returnTo);

  if (kakaoName) {
    params.set('kakaoName', kakaoName);
  }

  if (safeReturnTo) {
    params.set('returnTo', safeReturnTo);
  }

  const query = params.toString();
  return query ? `/profile/register?${query}` : '/profile/register';
}
