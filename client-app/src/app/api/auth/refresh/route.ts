import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

/**
 * POST /api/auth/refresh
 *
 * Why this exists: Next.js rewrites proxy requests to the backend, but
 * Set-Cookie headers from the backend are not reliably forwarded to the browser
 * (App Router + standalone output). This Route Handler proxies the refresh
 * request and sets the accessToken cookie directly — guaranteed to reach the client.
 */
export async function POST(request: NextRequest) {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
        'X-CSRF-Token': request.headers.get('x-csrf-token') || '',
      },
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({ message: 'Token refresh failed' }));
      return NextResponse.json(error, { status: backendResponse.status });
    }

    const body = await backendResponse.json();
    const response = NextResponse.json(body);

    // Forward all Set-Cookie headers from backend — both accessToken and refreshToken
    // must be updated so the browser cookie stays in sync with Redis.
    const proto = request.headers.get('x-forwarded-proto') ?? '';
    const isHttps = proto === 'https' || request.url.startsWith('https://');

    // Node.js fetch returns multiple Set-Cookie headers as an array via getSetCookie()
    const setCookies: string[] =
      typeof (backendResponse.headers as { getSetCookie?: () => string[] }).getSetCookie ===
      'function'
        ? (backendResponse.headers as { getSetCookie: () => string[] }).getSetCookie()
        : [backendResponse.headers.get('set-cookie') ?? ''].filter(Boolean);

    for (const raw of setCookies) {
      const accessMatch = raw.match(/^accessToken=([^;]+)/);
      const refreshMatch = raw.match(/^refreshToken=([^;]+)/);

      if (accessMatch) {
        response.cookies.set('accessToken', accessMatch[1], {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          maxAge: 15 * 60,
          path: '/',
        });
      } else if (refreshMatch) {
        response.cookies.set('refreshToken', refreshMatch[1], {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
      }
    }

    return response;
  } catch {
    return NextResponse.json({ message: 'Token refresh failed' }, { status: 500 });
  }
}
