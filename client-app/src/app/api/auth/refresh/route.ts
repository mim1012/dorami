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

    // Parse accessToken from backend Set-Cookie and set it directly
    const setCookieHeader = backendResponse.headers.get('set-cookie');
    if (setCookieHeader) {
      const tokenMatch = setCookieHeader.match(/accessToken=([^;]+)/);
      if (tokenMatch) {
        const proto = request.headers.get('x-forwarded-proto') ?? '';
        const isHttps = proto === 'https' || request.url.startsWith('https://');

        response.cookies.set('accessToken', tokenMatch[1], {
          httpOnly: true,
          secure: isHttps,
          sameSite: isHttps ? 'strict' : 'lax',
          maxAge: 15 * 60,
          path: '/',
        });
      }
    }

    return response;
  } catch {
    return NextResponse.json({ message: 'Token refresh failed' }, { status: 500 });
  }
}
