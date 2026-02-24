import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/csrf
 *
 * Ensures a CSRF token cookie is set in the browser.
 *
 * Why this exists: Next.js rewrites proxy requests to the backend, but in some
 * configurations (App Router + standalone output) the backend's Set-Cookie
 * headers are not reliably forwarded to the browser. This Route Handler sets
 * the cookie directly from the Next.js server — guaranteed to reach the client —
 * using the same Double Submit Cookie pattern as the backend CsrfGuard.
 */
export async function GET(request: NextRequest) {
  const existingToken = request.cookies.get('csrf-token')?.value;

  if (existingToken) {
    return NextResponse.json({ token: existingToken });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const response = NextResponse.json({ token });

  // Use request protocol to determine secure flag — NODE_ENV is always 'production'
  // in standalone builds, so it cannot be used to detect HTTP staging environments.
  const proto = request.headers.get('x-forwarded-proto') ?? '';
  const isHttps = proto === 'https' || request.url.startsWith('https://');

  response.cookies.set('csrf-token', token, {
    httpOnly: false, // Must be readable by JavaScript (getCsrfToken in client.ts)
    secure: isHttps,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    path: '/',
  });

  return response;
}
