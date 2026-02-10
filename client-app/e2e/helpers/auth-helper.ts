import { Page, request as playwrightRequest } from '@playwright/test';
import * as crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Create a test LiveStream via the backend API.
 * Returns the generated streamKey for use in product creation tests.
 */
export async function createTestStream(): Promise<string> {
  const apiContext = await playwrightRequest.newContext({ baseURL: BACKEND_URL });
  try {
    // Login as admin to get auth cookies
    const loginRes = await apiContext.post('/api/v1/auth/dev-login', {
      data: { email: 'e2e-admin@test.com', name: 'E2E ADMIN', role: 'ADMIN' },
    });
    if (!loginRes.ok()) {
      throw new Error(`createTestStream login failed: ${loginRes.status()}`);
    }

    // Extract accessToken from Set-Cookie header
    const setCookie = loginRes.headers()['set-cookie'] || '';
    const tokenMatch = setCookie.match(/accessToken=([^;]+)/);
    const accessToken = tokenMatch ? tokenMatch[1] : '';

    // Create a stream (needs CSRF token for non-GET requests)
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const streamRes = await apiContext.post('/api/v1/streaming/start', {
      data: { expiresAt },
      headers: {
        Cookie: `accessToken=${accessToken}; csrf-token=${csrfToken}`,
        'x-csrf-token': csrfToken,
      },
    });

    if (streamRes.ok()) {
      const body = await streamRes.json();
      return body.data.streamKey;
    }

    // If stream already exists, use the streamKey from the error context
    const errBody = await streamRes.json().catch(() => null);
    if (errBody?.errorCode === 'STREAM_ALREADY_ACTIVE' && errBody?.context?.streamKey) {
      return errBody.context.streamKey;
    }

    throw new Error(`createTestStream failed: ${streamRes.status()} ${JSON.stringify(errBody)}`);
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Dev login helper for E2E tests.
 *
 * 1. Calls dev-login API directly on the backend (bypasses Next.js proxy to avoid 500 errors)
 * 2. Manually sets auth cookies + CSRF token on the browser context for localhost
 * 3. Intercepts /auth/me requests so useAuth's fetchProfile() always succeeds
 * 4. Intercepts all cross-origin API calls to the backend and forwards them server-side
 *    (bypasses browser CORS/CSRF restrictions)
 * 5. Seeds Zustand auth-storage via addInitScript for subsequent navigations
 */
export async function devLogin(page: Page, role: 'USER' | 'ADMIN' = 'USER') {
  const email = role === 'ADMIN' ? 'e2e-admin@test.com' : 'e2e-user@test.com';

  // Call dev-login directly on the backend (not through Next.js proxy)
  // to avoid intermittent 500 errors from Next.js rewrite on rapid requests.
  const apiContext = await playwrightRequest.newContext({
    baseURL: BACKEND_URL,
  });

  try {
    const response = await apiContext.post('/api/v1/auth/dev-login', {
      data: { email, name: `E2E ${role}`, role },
    });

    if (!response.ok()) {
      throw new Error(`devLogin failed: ${response.status()} ${await response.text()}`);
    }

    const body = await response.json();
    const user = body.data.user;

    // Extract auth tokens from response cookies
    const responseCookies = response.headers()['set-cookie'];
    let accessToken = '';
    let refreshToken = '';

    if (responseCookies) {
      const cookieStrings = Array.isArray(responseCookies)
        ? responseCookies
        : responseCookies.split(/,(?=\s*\w+=)/);

      for (const cookieStr of cookieStrings) {
        const match = cookieStr.match(/^([^=]+)=([^;]*)/);
        if (match) {
          const name = match[1].trim();
          const value = match[2].trim();
          if (name === 'accessToken') accessToken = value;
          if (name === 'refreshToken') refreshToken = value;
        }
      }
    }

    // Set auth cookies on browser context for localhost (covers all ports)
    const browserCookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'Strict' | 'Lax' | 'None';
      expires: number;
    }> = [];

    if (accessToken) {
      browserCookies.push({
        name: 'accessToken',
        value: accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 900,
      });
    }
    if (refreshToken) {
      browserCookies.push({
        name: 'refreshToken',
        value: refreshToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 604800,
      });
    }

    // Set a CSRF token cookie readable by JS
    const csrfToken = crypto.randomBytes(32).toString('hex');
    browserCookies.push({
      name: 'csrf-token',
      value: csrfToken,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 86400,
    });

    if (browserCookies.length > 0) {
      await page.context().addCookies(browserCookies);
    }

    // Intercept /auth/me requests — useAuth's fetchProfile() calls this on every page load.
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: user }),
      });
    });

    // Intercept ALL cross-origin API calls to the backend and forward them server-side.
    // This bypasses browser CORS preflight and CSRF cookie issues.
    // Preserve all original headers and add auth cookies + CSRF token.
    await page.route(`${BACKEND_URL}/api/**`, async (route) => {
      const request = route.request();

      // Skip if already handled by a more specific route (like /auth/me)
      if (request.url().includes('/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: user }),
        });
      }

      try {
        // Preserve ALL original request headers, override auth-related ones
        const overrideHeaders: Record<string, string> = {
          ...request.headers(),
          cookie: `accessToken=${accessToken}; refreshToken=${refreshToken}; csrf-token=${csrfToken}`,
        };

        // Add CSRF token header for mutating requests
        if (request.method() !== 'GET' && request.method() !== 'OPTIONS') {
          overrideHeaders['x-csrf-token'] = csrfToken;
        }

        const fetchResponse = await route.fetch({ headers: overrideHeaders });

        // Manually extract response to avoid content-encoding mismatch
        // (Playwright may decompress body but keep the content-encoding header)
        const body = await fetchResponse.body();
        const responseHeaders = { ...fetchResponse.headers() };
        delete responseHeaders['content-encoding'];
        delete responseHeaders['content-length'];

        await route.fulfill({
          status: fetchResponse.status(),
          headers: responseHeaders,
          body,
        });
      } catch (err) {
        console.error(
          `[auth-helper] route.fetch failed: ${request.method()} ${request.url()}`,
          err,
        );
        await route.abort('connectionfailed');
      }
    });

    // Seed Zustand auth-storage in localStorage via addInitScript.
    if (user) {
      await page.addInitScript((userData) => {
        localStorage.setItem(
          'auth-storage',
          JSON.stringify({
            state: { user: userData, isAuthenticated: true, isLoading: false },
            version: 0,
          }),
        );
      }, user);
    }
  } finally {
    await apiContext.dispose();
  }
}
