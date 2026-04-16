import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PATHS = ['/admin'];
const PUBLIC_EXACT_ROUTES = ['/'];
const PUBLIC_PREFIX_ROUTES = ['/login', '/auth', '/profile/register', '/open-in-browser'];
const PROFILE_OPTIONAL_PATHS = ['/profile/register'];
const KAKAO_OPEN_EXTERNAL_QUERY = 'openExternal';
const KAKAO_OPEN_EXTERNAL_VALUE = '1';
const KAKAO_EXTERNAL_ORIGIN = (
  process.env.KAKAO_EXTERNAL_ORIGIN ??
  process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ??
  ''
).trim();

function normalizeOrigin(origin: string): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin.startsWith('http') ? origin : `https://${origin}`);
    if (url.hostname === '0.0.0.0' || url.hostname === '[::]' || url.hostname === '::') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isRoutableHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return Boolean(value) && !value.startsWith('0.0.0.0') && !value.startsWith('[::]');
}

/**
 * Decode a JWT without verifying the signature (middleware runs on the Edge runtime
 * which cannot use Node.js crypto).  We only need the `exp` and `role` claims to detect
 * obviously-expired tokens and unauthorized role access before doing a full server-side validation.
 */
function decodeJwtPayload(token: string): {
  exp?: number;
  role?: string;
  profileComplete?: boolean;
  shippingAddressComplete?: boolean;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as {
      exp?: number;
      role?: string;
      profileComplete?: boolean;
      shippingAddressComplete?: boolean;
      [key: string]: unknown;
    };
    return payload;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const base = getPublicUrl(request);
  const loginUrl = new URL('/login', base);
  const redirectTarget =
    pathname +
    (request.nextUrl.search && request.nextUrl.search !== '' ? request.nextUrl.search : '');
  loginUrl.searchParams.set('redirect', redirectTarget);
  return NextResponse.redirect(loginUrl);
}

function redirectToForbidden(request: NextRequest): NextResponse {
  const base = getPublicUrl(request);
  const forbiddenUrl = new URL('/403', base);
  return NextResponse.redirect(forbiddenUrl);
}

function isKakaoInAppBrowser(userAgent: string): boolean {
  return /kakaotalk/i.test(userAgent);
}

function isInstagramInAppBrowser(userAgent: string): boolean {
  return /Instagram/i.test(userAgent);
}

function isFacebookInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV/i.test(userAgent);
}

function isOtherInAppBrowser(userAgent: string): boolean {
  return /\bLine\/|\bTwitter/i.test(userAgent);
}

function isNonKakaoInAppBrowser(userAgent: string): boolean {
  return (
    isInstagramInAppBrowser(userAgent) ||
    isFacebookInAppBrowser(userAgent) ||
    isOtherInAppBrowser(userAgent)
  );
}

function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

function isAndroidUserAgent(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

function buildAndroidIntentUrl(targetUrl: URL, fallbackUrl: URL): string {
  const intentTarget = `${targetUrl.host}${targetUrl.pathname}${targetUrl.search}`;
  return [
    `intent://${intentTarget}`,
    '#Intent;scheme=https;',
    'action=android.intent.action.VIEW;',
    'category=android.intent.category.BROWSABLE;',
    `package=com.android.chrome;`,
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl.toString())};`,
    'end',
  ].join('');
}

function buildUrlWithOpenExternalFlag(source: URL): URL {
  const url = new URL(source.toString());
  url.searchParams.set(KAKAO_OPEN_EXTERNAL_QUERY, KAKAO_OPEN_EXTERNAL_VALUE);
  return url;
}

function getPublicUrl(request: NextRequest): URL {
  // request.url may return internal Docker address (e.g. http://0.0.0.0:3000/path)
  // when running in standalone mode. Reconstruct the public URL from forwarded headers.
  const canonicalOrigin = normalizeOrigin(KAKAO_EXTERNAL_ORIGIN);
  if (canonicalOrigin) {
    return new URL(`${canonicalOrigin}${request.nextUrl.pathname}${request.nextUrl.search}`);
  }

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const hostHeader = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const host = hostHeader.split(',')[0]?.trim() ?? '';
  if (isRoutableHost(host)) {
    return new URL(`${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`);
  }

  return request.nextUrl;
}

function handleNonKakaoInAppRedirect(request: NextRequest): NextResponse | null {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!isNonKakaoInAppBrowser(userAgent)) {
    return null;
  }

  const targetUrl = getPublicUrl(request);

  if (isAndroidUserAgent(userAgent)) {
    const fallbackUrl = buildUrlWithOpenExternalFlag(targetUrl);
    return NextResponse.redirect(buildAndroidIntentUrl(targetUrl, fallbackUrl));
  }

  // iOS: redirect to an interstitial page instructing the user to open in Safari
  if (isIosUserAgent(userAgent)) {
    const openInBrowserUrl = new URL('/open-in-browser', targetUrl);
    openInBrowserUrl.searchParams.set('url', targetUrl.toString());
    return NextResponse.redirect(openInBrowserUrl);
  }

  return null;
}

function handleKakaoInAppRedirect(request: NextRequest): NextResponse | null {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!isKakaoInAppBrowser(userAgent)) {
    return null;
  }

  if (request.nextUrl.searchParams.get(KAKAO_OPEN_EXTERNAL_QUERY) === KAKAO_OPEN_EXTERNAL_VALUE) {
    return null;
  }

  const targetUrl = getPublicUrl(request);

  if (isAndroidUserAgent(userAgent)) {
    const fallbackUrl = buildUrlWithOpenExternalFlag(targetUrl);
    return NextResponse.redirect(buildAndroidIntentUrl(targetUrl, fallbackUrl));
  }

  if (isIosUserAgent(userAgent)) {
    return NextResponse.redirect(buildUrlWithOpenExternalFlag(targetUrl));
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonKakaoRedirect = handleNonKakaoInAppRedirect(request);
  if (nonKakaoRedirect) {
    return nonKakaoRedirect;
  }

  const kakaoRedirect = handleKakaoInAppRedirect(request);
  if (kakaoRedirect) {
    return kakaoRedirect;
  }

  const isPublicExact = PUBLIC_EXACT_ROUTES.includes(pathname);
  const isPublicPrefix = PUBLIC_PREFIX_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isPublicExact || isPublicPrefix) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  if (!accessToken) {
    if (refreshToken) {
      return NextResponse.next();
    }
    return redirectToLogin(request, pathname);
  }

  // Validate token structure and expiry client-side (no secret needed)
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    // Malformed token — clear cookie and redirect
    const response = redirectToLogin(request, pathname);
    response.cookies.delete('accessToken');
    return response;
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    // Token is expired. Let the client-side token-refresh logic handle it
    // (client.ts intercepts 401 responses and attempts POST /api/auth/refresh).
    return NextResponse.next();
  }

  // /my-page 접근 시 admin은 /admin으로 리다이렉트
  const isMyPage = pathname.startsWith('/my-page');
  if (isMyPage && payload.role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin', getPublicUrl(request)));
  }

  // Check admin role for admin-only routes
  const isAdminPath = ADMIN_PATHS.some((path) => pathname.startsWith(path));
  if (isAdminPath && payload.role !== 'ADMIN') {
    return redirectToForbidden(request);
  }

  const requiresProfileCompletion = !PROFILE_OPTIONAL_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (requiresProfileCompletion && payload.role !== 'ADMIN' && payload.profileComplete !== true) {
    const profileUrl = new URL('/profile/register', getPublicUrl(request));
    if (pathname !== '/profile/register') {
      const search = request.nextUrl.search ?? '';
      const target = `${pathname}${search}`;
      profileUrl.searchParams.set('returnTo', target);
    }
    return NextResponse.redirect(profileUrl);
  }

  if (
    requiresProfileCompletion &&
    payload.role !== 'ADMIN' &&
    payload.profileComplete === true &&
    payload.shippingAddressComplete === false
  ) {
    const profileUrl = new URL('/profile/register', getPublicUrl(request));
    if (pathname !== '/profile/register') {
      const search = request.nextUrl.search ?? '';
      const target = `${pathname}${search}`;
      profileUrl.searchParams.set('returnTo', target);
    }
    return NextResponse.redirect(profileUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|_next/data|_next/webpack-hmr|favicon\\.ico|icon-.*\\.png|logo\\.png|badge-.*\\.png|manifest\\.json|robots\\.txt|sw\\.js|images/).*)',
  ],
};
