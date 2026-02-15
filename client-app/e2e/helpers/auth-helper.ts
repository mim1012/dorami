import { Page, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * Create a test LiveStream via the backend API.
 * Returns the generated streamKey for use in product creation tests.
 *
 * Uses BASE_URL (through the Next.js proxy) so it works on staging
 * where the backend port may not be directly accessible.
 */
export async function createTestStream(): Promise<string> {
  const apiContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    // Login as admin to get auth cookies
    const loginRes = await apiContext.post('/api/v1/auth/dev-login', {
      data: { email: 'e2e-admin@test.com', name: 'E2E ADMIN', role: 'ADMIN' },
    });
    if (!loginRes.ok()) {
      throw new Error(`createTestStream login failed: ${loginRes.status()}`);
    }

    // Try to get CSRF token (may not exist if CSRF is disabled on staging)
    let csrfToken = '';
    try {
      const meRes = await apiContext.get('/api/v1/auth/me');
      const setCookie = meRes.headers()['set-cookie'] || '';
      const csrfMatch = setCookie.match(/csrf-token=([^;]+)/);
      csrfToken = csrfMatch ? csrfMatch[1] : '';
    } catch {
      // CSRF not available — proceed without it
    }

    // Create a stream
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const streamRes = await apiContext.post('/api/v1/streaming/start', {
      data: { expiresAt },
      headers,
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
 * Ensure the page is authenticated with fresh tokens.
 * Always clears stale state and performs a fresh devLogin,
 * because storageState tokens may be expired.
 */
export async function ensureAuth(page: Page, role: 'USER' | 'ADMIN' = 'USER') {
  // Clear stale cookies from storageState
  await page.context().clearCookies();

  // Navigate to login page (stable target — avoids mid-redirect state)
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Clear stale localStorage (isAuthenticated: true causes redirect loops)
  await page.evaluate(() => localStorage.clear());

  // Perform fresh login
  await devLogin(page, role);
}

/**
 * Dev login helper for E2E tests.
 *
 * Calls the dev-login API directly from the browser context using fetch().
 * This avoids React hydration DOM-detach issues (clicking buttons that get
 * re-rendered during hydration) and lets the browser handle Set-Cookie
 * headers naturally — no cookie domain mismatch or proxy forwarding issues.
 */
export async function devLogin(page: Page, role: 'USER' | 'ADMIN' = 'USER') {
  const email = role === 'ADMIN' ? 'admin@doremi.shop' : 'buyer@test.com';

  // Call dev-login API from within the browser — cookies set naturally
  const result = await page.evaluate(
    async ({ email, role }) => {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false as const, status: res.status, error: text };
      }
      const data = await res.json();
      return { ok: true as const, user: data.data?.user };
    },
    { email, role },
  );

  if (!result.ok) {
    throw new Error(`devLogin failed: ${result.status} ${result.error}`);
  }

  // Navigate to home so the app picks up the new auth cookies
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Verify auth was recognized (not redirected back to login)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}
