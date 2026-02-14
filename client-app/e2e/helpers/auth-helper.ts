import { Page, request as playwrightRequest } from '@playwright/test';
import * as crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

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

    // Call GET /auth/me to get CSRF token cookie
    const meRes = await apiContext.get('/api/v1/auth/me');
    if (!meRes.ok()) {
      throw new Error(`createTestStream /auth/me failed: ${meRes.status()}`);
    }

    // Extract cookies from Set-Cookie header
    const setCookie = meRes.headers()['set-cookie'] || '';
    const csrfTokenMatch = setCookie.match(/csrf-token=([^;]+)/);
    const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : '';

    if (!csrfToken) {
      throw new Error('CSRF token not found in cookies');
    }

    // Create a stream (needs CSRF token for non-GET requests)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const streamRes = await apiContext.post('/api/v1/streaming/start', {
      data: { expiresAt },
      headers: {
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
 * Uses the Next.js proxy (same-origin) so cookies are set automatically.
 * For most tests, prefer using the global storageState from global-setup.ts instead.
 */
export async function devLogin(page: Page, role: 'USER' | 'ADMIN' = 'USER') {
  const email = role === 'ADMIN' ? 'e2e-admin@test.com' : 'e2e-user@test.com';

  // Navigate to login page so fetch runs on the correct origin
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  // Call dev-login through the Next.js proxy (same-origin, cookies auto-set)
  const user = await page.evaluate(
    async ({ email, role }) => {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, name: `E2E ${role}`, role }),
      });
      if (!res.ok) throw new Error(`dev-login failed: ${res.status}`);
      const data = await res.json();
      return data.data.user;
    },
    { email, role },
  );

  // Seed Zustand auth-storage in localStorage
  if (user) {
    await page.evaluate((userData) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: userData, isAuthenticated: true, isLoading: false },
          version: 0,
        }),
      );
    }, user);
  }
}
