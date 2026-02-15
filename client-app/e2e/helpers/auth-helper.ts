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
    // Login as admin to get auth cookies (through Next.js proxy: /api/* → backend /api/v1/*)
    const loginRes = await apiContext.post('/api/auth/dev-login', {
      data: { email: 'e2e-admin@test.com', name: 'E2E ADMIN', role: 'ADMIN' },
    });
    if (!loginRes.ok()) {
      throw new Error(`createTestStream login failed: ${loginRes.status()}`);
    }

    // Try to get CSRF token (may not exist if CSRF is disabled on staging)
    let csrfToken = '';
    try {
      const meRes = await apiContext.get('/api/auth/me');
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

    const streamRes = await apiContext.post('/api/streaming/start', {
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
  const domain = new URL(BASE_URL).hostname;

  // Navigate to login page first (need a page at the right origin for localStorage)
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Clear stale localStorage (isAuthenticated: true causes redirect loops)
  await page.evaluate(() => localStorage.clear());

  // Expire stale cookies from storageState by overwriting with empty values.
  // We avoid clearCookies() because clearCookies() + addCookies() causes
  // an alternating pass/fail bug in Playwright.
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: '',
      domain,
      path: '/',
      expires: 1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    },
    {
      name: 'refreshToken',
      value: '',
      domain,
      path: '/',
      expires: 1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ]);

  // Perform fresh login (sets cookies + localStorage, does NOT navigate)
  await devLogin(page, role);

  // Brief pause to avoid hitting the staging server's rate limiter (3 req/sec in production).
  // Each test triggers 2-4 backend calls during page load; spacing them out prevents 429s.
  await page.waitForTimeout(2500);
}

/**
 * Navigate to an admin page with automatic retry on auth failure.
 *
 * When the staging server rate-limits API calls (HTTP 429), the app
 * interprets the failure as an auth error and redirects to the login page.
 * This helper detects that redirect and retries: re-authenticate → wait → navigate again.
 *
 * @param page  Playwright Page
 * @param url   Target URL (e.g. '/admin/products')
 * @param opts  Options: waitForSelector to confirm page loaded, maxRetries, role
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  opts: {
    waitForSelector?: string;
    maxRetries?: number;
    role?: 'USER' | 'ADMIN';
  } = {},
) {
  const { waitForSelector, maxRetries = 2, role = 'ADMIN' } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for network to settle — ensures auth API calls (/users/me etc.) complete
    // and any resulting client-side redirect (429 → auth fail → /login) has happened.
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Check if we ended up on the login page (URL check is fastest + most reliable)
    const isLoginPage =
      page.url().includes('/login') ||
      (await page
        .locator('button', { hasText: '카카오로 로그인' })
        .isVisible({ timeout: 1000 })
        .catch(() => false));

    if (!isLoginPage) {
      // If a specific selector was requested, wait for it
      if (waitForSelector) {
        try {
          await page.locator(waitForSelector).first().waitFor({ timeout: 15000 });
        } catch {
          // Selector not found, but we're not on login page — let the test handle it
        }
      }
      return; // Success — not on login page
    }

    if (attempt < maxRetries) {
      console.log(
        `gotoWithRetry: login redirect detected on attempt ${attempt + 1}, re-authenticating...`,
      );
      // Wait longer on each retry to let rate limiter cool down
      await page.waitForTimeout(3000 + attempt * 2000);
      await page.evaluate(() => localStorage.clear());
      await devLogin(page, role);
      await page.waitForTimeout(2500);
    }
  }

  // All retries exhausted — proceed anyway, test assertions will catch the failure
  console.warn(`gotoWithRetry: still on login page after ${maxRetries + 1} attempts`);
}

/**
 * Dev login helper for E2E tests.
 *
 * Uses a standalone Playwright request context (isolated from the browser's
 * cookie jar) to call dev-login, then manually injects cookies with
 * secure=false. This solves three problems:
 * 1. React hydration DOM-detach (no UI interaction needed)
 * 2. Secure cookie over HTTP (backend sends Secure cookies, staging is HTTP)
 * 3. Auth store race condition (populate Zustand localStorage)
 *
 * Using a standalone context prevents page.request from auto-storing
 * Secure cookies in the browser jar, which would conflict with our
 * addCookies(secure=false) and cause alternating pass/fail patterns.
 */
export async function devLogin(page: Page, role: 'USER' | 'ADMIN' = 'USER') {
  const email = role === 'ADMIN' ? 'admin@doremi.shop' : 'buyer@test.com';
  const domain = new URL(BASE_URL).hostname;

  // 1. Use isolated request context — avoids polluting browser cookie jar
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  let user: any = null;

  try {
    const response = await apiCtx.post('/api/auth/dev-login', {
      data: { email, role },
    });

    if (!response.ok()) {
      throw new Error(`devLogin failed: ${response.status()} ${await response.text()}`);
    }

    // 2. Extract Set-Cookie headers and inject into browser with secure=false
    const allHeaders = response.headersArray();
    const setCookieHeaders = allHeaders.filter((h) => h.name.toLowerCase() === 'set-cookie');

    for (const header of setCookieHeaders) {
      const parts = header.value.split(';');
      const [nameValue] = parts;
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;
      const name = nameValue.substring(0, eqIdx).trim();
      const value = nameValue.substring(eqIdx + 1).trim();

      await page.context().addCookies([
        {
          name,
          value,
          domain,
          path: '/',
          httpOnly: header.value.toLowerCase().includes('httponly'),
          secure: false,
          sameSite: 'Lax',
        },
      ]);
    }

    // 3. Extract user data from response
    const body = await response.json();
    user = body.data?.user;
  } finally {
    await apiCtx.dispose();
  }

  // 4. Populate Zustand auth store in localStorage so app hydrates as authenticated
  if (user) {
    await page.evaluate((userData) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { user: userData, isAuthenticated: true }, version: 0 }),
      );
    }, user);
  }

  // Don't navigate here — let the test's own page.goto() be the first
  // authenticated navigation. This avoids a race condition where the home
  // page's useAuth hook calls /users/me asynchronously, and the test's
  // subsequent goto() fires before that call completes, leaving the app
  // in an inconsistent auth state.
}
