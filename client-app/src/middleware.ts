import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PATHS = ['/admin'];
const PUBLIC_EXACT_ROUTES = ['/'];
const PUBLIC_PREFIX_ROUTES = ['/login', '/auth', '/profile/register'];
const PROFILE_OPTIONAL_PATHS = ['/profile/register'];
const KAKAO_OPEN_EXTERNAL_QUERY = 'openExternal';
const KAKAO_OPEN_EXTERNAL_VALUE = '1';

/**
 * Decode a JWT without verifying the signature (middleware runs on the Edge runtime
 * which cannot use Node.js crypto).  We only need the `exp` and `role` claims to detect
 * obviously-expired tokens and unauthorized role access before doing a full server-side validation.
 */
function decodeJwtPayload(
  token: string,
): { exp?: number; role?: string; profileComplete?: boolean } | null {
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
      [key: string]: unknown;
    };
    return payload;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  const redirectTarget =
    pathname +
    (request.nextUrl.search && request.nextUrl.search !== '' ? request.nextUrl.search : '');
  loginUrl.searchParams.set('redirect', redirectTarget);
  return NextResponse.redirect(loginUrl);
}

function redirectToForbidden(request: NextRequest): NextResponse {
  const forbiddenUrl = new URL('/403', request.url);
  return NextResponse.redirect(forbiddenUrl);
}

function isKakaoInAppBrowser(userAgent: string): boolean {
  return /kakaotalk/i.test(userAgent);
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

function handleKakaoInAppRedirect(request: NextRequest): NextResponse | null {
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!isKakaoInAppBrowser(userAgent)) {
    return null;
  }

  if (request.nextUrl.searchParams.get(KAKAO_OPEN_EXTERNAL_QUERY) === KAKAO_OPEN_EXTERNAL_VALUE) {
    return null;
  }

  const targetUrl = new URL(request.url);

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
  if (!accessToken) {
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
    // Token is expired. For live/shop paths, let the client-side token-refresh logic handle it
    // so active viewers are not disrupted mid-session. All other protected pages redirect to login.
    const isLiveOrShopPath =
      pathname.startsWith('/live') ||
      pathname.startsWith('/shop') ||
      pathname.startsWith('/cart') ||
      pathname.startsWith('/checkout');
    if (isLiveOrShopPath) {
      return NextResponse.next();
    }
    return redirectToLogin(request, pathname);
  }

  // /my-page 접근 시 admin은 /admin으로 리다이렉트
  const isMyPage = pathname.startsWith('/my-page');
  if (isMyPage && payload.role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin', request.url));
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
    const profileUrl = new URL('/profile/register', request.url);
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
    '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|manifest\\.json|robots\\.txt).*)',
  ],
};
