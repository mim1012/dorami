import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/admin', '/live/', '/cart', '/checkout', '/orders', '/alerts'];

/**
 * Decode a JWT without verifying the signature (middleware runs on the Edge runtime
 * which cannot use Node.js crypto).  We only need the `exp` claim to detect
 * obviously-expired tokens before doing a full server-side validation.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as { exp?: number };
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) =>
    path === '/' ? pathname === path : pathname.startsWith(path),
  );
  if (!isProtected) return NextResponse.next();

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
    // Token is expired — let the browser's token-refresh logic handle it,
    // but redirect to login so the user isn't stuck on a protected page
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/live/:path*', '/cart', '/checkout', '/orders/:path*', '/alerts'],
};
