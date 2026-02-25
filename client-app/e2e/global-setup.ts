import { chromium, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const COOKIE_DOMAIN = new URL(BASE_URL).hostname;

export const AUTH_DIR = path.join(__dirname, '.auth');
export const USER_STATE = path.join(AUTH_DIR, 'user.json');
export const ADMIN_STATE = path.join(AUTH_DIR, 'admin.json');

/**
 * Parse Set-Cookie header strings into Playwright cookie objects.
 */
function parseSetCookies(setCookieHeaders: string[]): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}> {
  return setCookieHeaders.map((header) => {
    const parts = header.split(';').map((p) => p.trim());
    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf('=');
    const name = nameValue.substring(0, eqIdx);
    const value = nameValue.substring(eqIdx + 1);

    const cookie: any = {
      name,
      value,
      domain: COOKIE_DOMAIN,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    };

    for (const attr of attrs) {
      const lower = attr.toLowerCase();
      if (lower === 'httponly') {
        cookie.httpOnly = true;
      } else if (lower === 'secure') {
        cookie.secure = true;
      } else if (lower.startsWith('path=')) {
        cookie.path = attr.split('=')[1];
      } else if (lower.startsWith('domain=')) {
        cookie.domain = attr.split('=')[1];
      } else if (lower.startsWith('max-age=')) {
        const maxAge = parseInt(attr.split('=')[1], 10);
        cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
      } else if (lower.startsWith('expires=')) {
        cookie.expires = Math.floor(new Date(attr.substring(8)).getTime() / 1000);
      } else if (lower.startsWith('samesite=')) {
        const val = attr.split('=')[1].toLowerCase();
        if (val === 'strict') cookie.sameSite = 'Strict';
        else if (val === 'none') cookie.sameSite = 'None';
        else cookie.sameSite = 'Lax';
      }
    }

    // Always force domain to match the test environment (backend may send domain=localhost)
    cookie.domain = COOKIE_DOMAIN;
    // Force secure=false for non-HTTPS environments (e.g. staging over HTTP)
    if (!BASE_URL.startsWith('https')) {
      cookie.secure = false;
    }

    return cookie;
  });
}

async function authenticate(
  browser: import('@playwright/test').Browser,
  role: 'USER' | 'ADMIN',
  outputPath: string,
) {
  // Use same emails as devLogin helper for consistency (ADMIN_EMAILS only needs one entry)
  const email = role === 'ADMIN' ? 'admin@doremi.shop' : 'buyer@test.com';

  // 1. Call dev-login API at Node.js level (bypasses CORS)
  const apiContext = await request.newContext({ baseURL: BACKEND_URL });

  const loginRes = await apiContext.post('/api/auth/dev-login', {
    data: { email, name: `E2E ${role}`, role },
  });

  if (!loginRes.ok()) {
    throw new Error(`dev-login failed: ${loginRes.status()}`);
  }

  const loginData = await loginRes.json();
  let user = loginData.data.user;

  // Extract cookies from response headers
  const setCookieHeaders = loginRes
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
  const cookies = parseSetCookies(setCookieHeaders);

  // 2. If USER, complete profile using the same API context (cookies auto-forwarded)
  if (role === 'USER') {
    // GET request triggers CSRF token cookie generation (guard sets csrf-token cookie on GET)
    const meCheck = await apiContext.get('/api/users/me');
    const meCheckData = meCheck.ok() ? (await meCheck.json()).data : null;

    // Only call complete-profile if fields are missing
    if (!meCheckData?.instagramId || !meCheckData?.depositorName) {
      const state = await apiContext.storageState();
      const csrfToken = state.cookies.find((c) => c.name === 'csrf-token')?.value ?? '';

      const profileRes = await apiContext.post('/api/users/complete-profile', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          depositorName: 'E2E테스트',
          instagramId: `@e2e_user_${user.id?.slice(0, 8) ?? 'test'}`,
          fullName: 'E2E Test User',
          address1: '123 Test Street',
          address2: 'Apt 1',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          phone: '(212) 555-1234',
        },
      });
      if (!profileRes.ok()) {
        console.warn(`complete-profile: ${profileRes.status()} ${await profileRes.text()}`);
      }
    }
  }

  // 3. Fetch full user profile
  const meRes = await apiContext.get('/api/users/me');
  if (meRes.ok()) {
    const meData = await meRes.json();
    user = meData.data || user;
  }

  // Verify USER profile is complete — if not, useProfileGuard will redirect all
  // profile-guarded routes (/cart, /my-page) to /profile/register during tests.
  if (role === 'USER' && (!user?.instagramId || !user?.depositorName)) {
    throw new Error(
      `global-setup: USER profile incomplete after complete-profile call. ` +
        `instagramId=${user?.instagramId}, depositorName=${user?.depositorName}. ` +
        `Check that /api/users/complete-profile succeeded and /api/users/me returns the updated fields.`,
    );
  }

  await apiContext.dispose();

  // 4. Create browser context, set cookies and localStorage
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  // Seed Zustand auth-storage in localStorage
  await page.evaluate((userData) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user: userData, isAuthenticated: true, isLoading: false },
        version: 0,
      }),
    );
  }, user);

  // Save storageState (cookies + localStorage)
  await context.storageState({ path: outputPath });
  await context.close();
}

async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  await authenticate(browser, 'USER', USER_STATE);
  await authenticate(browser, 'ADMIN', ADMIN_STATE);
  await browser.close();
}

export default globalSetup;
