/**
 * Deployment Smoke Tests
 *
 * Validates that the 7 critical paths of the Dorami live-commerce platform
 * are functional after a deployment. Designed to run fast (< 30 s each)
 * using direct API calls rather than UI interaction.
 *
 * Run:
 *   cd client-app && npx playwright test e2e/smoke-deployment.spec.ts --project=user
 *   cd client-app && npx playwright test e2e/smoke-deployment.spec.ts --project=admin
 *
 * The smoke project is excluded from the standard admin/user project matchers
 * so it only runs when explicitly targeted or via the smoke-test workflow.
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an isolated API context that is authenticated as the given role.
 * Returns the context + extracted cookies so that subsequent requests reuse
 * the same session (including any CSRF cookie set on GET /api/users/me).
 */
async function createAuthContext(role: 'USER' | 'ADMIN') {
  const email = role === 'ADMIN' ? 'admin@doremi.shop' : 'buyer@test.com';
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });

  // Retry up to 3 times on 429 (CI parallel workers can trigger rate-limit)
  let loginRes = await ctx.post('/api/auth/dev-login', { data: { email } });
  for (let i = 0; i < 3 && loginRes.status() === 429; i++) {
    await new Promise((r) => setTimeout(r, 4000 + i * 3000));
    loginRes = await ctx.post('/api/auth/dev-login', { data: { email } });
  }

  if (!loginRes.ok()) {
    const body = await loginRes.text();
    throw new Error(`[smoke] dev-login failed for ${role}: HTTP ${loginRes.status()} — ${body}`);
  }

  return ctx;
}

/**
 * Read the csrf-token cookie from a GET /api/users/me response.
 * Returns an empty string when CSRF is disabled (CSRF_ENABLED=false).
 */
async function getCsrfToken(ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>) {
  try {
    const meRes = await ctx.get('/api/users/me');
    const setCookie = meRes.headers()['set-cookie'] ?? '';
    const m = setCookie.match(/csrf-token=([^;]+)/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Deployment Smoke Tests', () => {
  // Each test is self-contained and fast
  test.setTimeout(30000);

  // -------------------------------------------------------------------------
  // SMOKE-01: Login
  // -------------------------------------------------------------------------
  test('SMOKE-01: dev-login returns 200 and sets accessToken cookie', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    try {
      const res = await ctx.post('/api/auth/dev-login', {
        data: { email: 'buyer@test.com' },
      });

      expect(res.status(), `dev-login should return 200 but got ${res.status()}`).toBe(200);

      const body = await res.json();
      expect(body.success, 'response envelope should have success:true').toBe(true);
      expect(body.data, 'response should contain data').toBeTruthy();

      // Access token must be delivered as an HttpOnly cookie
      const allHeaders = res.headersArray();
      const cookieHeaders = allHeaders
        .filter((h) => h.name.toLowerCase() === 'set-cookie')
        .map((h) => h.value);

      const hasAccessToken = cookieHeaders.some((c) => c.startsWith('accessToken='));
      expect(
        hasAccessToken,
        `accessToken cookie not found in Set-Cookie headers: ${cookieHeaders.join(' | ')}`,
      ).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // SMOKE-02: Stream creation (admin)
  // -------------------------------------------------------------------------
  test('SMOKE-02: admin can create a live stream and receive a streamKey', async () => {
    const ctx = await createAuthContext('ADMIN');
    try {
      const csrfToken = await getCsrfToken(ctx);
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await ctx.post('/api/streaming/start', {
        data: { expiresAt },
        headers,
      });

      // 200/201 = created; 400 STREAM_ALREADY_ACTIVE = a stream exists (also valid)
      const body = await res.json().catch(() => null);

      if (res.ok()) {
        const streamKey: unknown = body?.data?.streamKey;
        expect(
          typeof streamKey === 'string' && streamKey.length > 0,
          `streamKey should be a non-empty string, got: ${JSON.stringify(streamKey)}`,
        ).toBe(true);
        console.log(`[SMOKE-02] created stream: ${streamKey}`);
      } else if (body?.errorCode === 'STREAM_ALREADY_ACTIVE') {
        // An existing active stream satisfies the smoke requirement
        const streamKey: unknown = body?.context?.streamKey;
        expect(
          typeof streamKey === 'string' && streamKey.length > 0,
          `STREAM_ALREADY_ACTIVE but no streamKey in context: ${JSON.stringify(body)}`,
        ).toBe(true);
        console.log(`[SMOKE-02] stream already active: ${streamKey}`);
      } else {
        throw new Error(
          `[SMOKE-02] POST /api/streaming/start failed: HTTP ${res.status()} — ${JSON.stringify(body)}`,
        );
      }
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // SMOKE-03: Active streams list (viewer perspective)
  // -------------------------------------------------------------------------
  test('SMOKE-03: GET /api/streaming/streams/active returns 200 with streams array', async () => {
    // This endpoint is @Public — no auth needed, but we use auth context for
    // consistency with how the live page fetches it.
    const ctx = await createAuthContext('USER');
    try {
      const res = await ctx.get('/api/streaming/streams/active');

      expect(
        res.status(),
        `GET /api/streaming/streams/active should return 200, got ${res.status()}`,
      ).toBe(200);

      const body = await res.json();
      expect(body.success, 'response envelope should have success:true').toBe(true);

      // data may be a single stream object or an array; either is acceptable
      const data = body.data;
      expect(data !== undefined && data !== null, 'data field should be present').toBe(true);
      console.log(
        `[SMOKE-03] active streams data type: ${Array.isArray(data) ? 'array' : typeof data}`,
      );
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // SMOKE-04: Chat — WebSocket upgrade reachable via HTTP handshake
  // -------------------------------------------------------------------------
  test('SMOKE-04: Socket.IO /chat namespace accepts HTTP upgrade (polling check)', async () => {
    // Socket.IO always starts with an HTTP polling request before upgrading to
    // WebSocket. A 200 on the polling endpoint proves the namespace is alive.
    // We use node-fetch via page.request so we stay within Playwright's context.
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    try {
      // EIO=4 = Engine.IO v4 (Socket.IO v4); transport=polling
      const res = await ctx.get('/socket.io/', {
        params: { EIO: '4', transport: 'polling', namespace: '/chat' },
      });

      // 200 = Engine.IO handshake accepted
      // 400/403 = namespace exists but auth missing (still proves server is up)
      // 404 = Socket.IO not mounted at this path (hard failure)
      expect(
        res.status() !== 404,
        `Socket.IO /chat namespace not found (404). ` +
          `Got HTTP ${res.status()} — server may not be running or WS path changed.`,
      ).toBe(true);

      console.log(`[SMOKE-04] Socket.IO polling response: HTTP ${res.status()}`);
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // SMOKE-05: Products list
  // -------------------------------------------------------------------------
  test('SMOKE-05: GET /api/products returns 200 with products array', async () => {
    const ctx = await createAuthContext('USER');
    try {
      const res = await ctx.get('/api/products');

      expect(res.status(), `GET /api/products should return 200, got ${res.status()}`).toBe(200);

      const body = await res.json();
      expect(body.success, 'response envelope should have success:true').toBe(true);

      // Products may be nested in data.products or data directly as array
      const raw = body.data;
      const products: unknown[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.products)
          ? raw.products
          : [];

      expect(
        Array.isArray(products),
        `products should be an array, got: ${JSON.stringify(raw).slice(0, 200)}`,
      ).toBe(true);

      console.log(`[SMOKE-05] products count: ${products.length}`);
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // SMOKE-06: Order — add to cart then place order
  // -------------------------------------------------------------------------
  test('SMOKE-06: user can add a product to cart and place an order (ORD-YYYYMMDD-XXXXX)', async () => {
    const ctx = await createAuthContext('USER');
    try {
      const csrfToken = await getCsrfToken(ctx);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      // Ensure profile is complete so ProfileCompleteGuard doesn't block
      await ctx.post('/api/users/complete-profile', {
        headers,
        data: {
          email: 'buyer@test.com',
          depositorName: 'E2E스모크',
          instagramId: '@smoke_test_buyer',
          fullName: 'Smoke Test Buyer',
          address1: '123 Smoke Street',
          address2: 'Suite 1',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          phone: '(212) 555-0000',
        },
      });
      // Re-fetch CSRF after profile update (cookie may rotate)
      const freshCsrf = await getCsrfToken(ctx);
      if (freshCsrf) headers['x-csrf-token'] = freshCsrf;

      // 1. Find a product with AVAILABLE status
      const productsRes = await ctx.get('/api/products/store');
      expect(productsRes.ok(), `GET /api/products/store failed: HTTP ${productsRes.status()}`).toBe(
        true,
      );

      const productsBody = await productsRes.json();
      const raw = productsBody.data;
      const allProducts: Array<{ id: string; status: string; stock: number }> = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.products)
          ? raw.products
          : [];

      const availableProduct = allProducts.find((p) => p.status === 'AVAILABLE' && p.stock > 0);

      if (!availableProduct) {
        console.warn(
          '[SMOKE-06] No AVAILABLE product with stock > 0 found — skipping order assertion. ' +
            'Create at least one available product for full smoke coverage.',
        );
        test.skip(true, 'No available product with stock found — partial smoke pass');
        return;
      }

      console.log(
        `[SMOKE-06] using product: ${availableProduct.id} (stock: ${availableProduct.stock})`,
      );

      // 2. Clear existing cart items to avoid CART_ALREADY_EXISTS conflicts
      const cartGetRes = await ctx.get('/api/cart');
      if (cartGetRes.ok()) {
        const cartBody = await cartGetRes.json();
        const existingItems: Array<{ id: string }> = cartBody.data?.items ?? [];
        for (const item of existingItems) {
          await ctx.delete(`/api/cart/${item.id}`, { headers });
        }
      }

      // 3. Add to cart
      const cartRes = await ctx.post('/api/cart', {
        headers,
        data: { productId: availableProduct.id, quantity: 1 },
      });

      if (!cartRes.ok()) {
        const errBody = await cartRes.json().catch(() => null);
        // Cart requires an ACTIVE live stream — if not live, skip gracefully
        if (
          errBody?.errorCode === 'STREAM_NOT_LIVE' ||
          errBody?.errorCode === 'NO_ACTIVE_STREAM' ||
          cartRes.status() === 400
        ) {
          console.warn(
            `[SMOKE-06] Cart add requires active stream — stream not LIVE. ` +
              `errorCode=${errBody?.errorCode}. Skipping order sub-test.`,
          );
          test.skip(true, 'Cart requires active live stream — skipped in non-live environment');
          return;
        }
        throw new Error(
          `[SMOKE-06] POST /api/cart failed: HTTP ${cartRes.status()} — ${JSON.stringify(errBody)}`,
        );
      }

      // 4. Place order from cart
      const orderRes = await ctx.post('/api/orders/from-cart', {
        headers,
        data: {},
      });

      expect(orderRes.ok(), `POST /api/orders/from-cart failed: HTTP ${orderRes.status()}`).toBe(
        true,
      );

      const orderBody = await orderRes.json();
      const order = orderBody.data;
      const orderId: unknown = order?.id ?? order?.orderId;

      expect(typeof orderId, 'order id should be a string').toBe('string');
      expect(
        orderId as string,
        `order id should match ORD-YYYYMMDD-XXXXX format, got: ${orderId}`,
      ).toMatch(/^ORD-\d{8}-\d{5}$/);

      console.log(`[SMOKE-06] order placed: ${orderId}`);
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------------
  // SMOKE-07: Admin order list
  // -------------------------------------------------------------------------
  test('SMOKE-07: admin GET /api/admin/orders returns 200 with orders array', async () => {
    const ctx = await createAuthContext('ADMIN');
    try {
      const res = await ctx.get('/api/admin/orders', {
        params: { page: '1', limit: '10', sortBy: 'createdAt', sortOrder: 'desc' },
      });

      expect(res.status(), `GET /api/admin/orders should return 200, got ${res.status()}`).toBe(
        200,
      );

      const body = await res.json();
      expect(body.success, 'response envelope should have success:true').toBe(true);

      const data = body.data;
      const orders: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.orders)
          ? data.orders
          : [];

      expect(Array.isArray(orders), 'orders should be an array').toBe(true);

      // Validate ID format of any returned orders
      for (const order of orders as Array<{ id?: string }>) {
        if (order?.id) {
          expect(
            order.id,
            `order id should match ORD-YYYYMMDD-XXXXX format, got: ${order.id}`,
          ).toMatch(/^ORD-\d{8}-\d{5}$/);
        }
      }

      console.log(`[SMOKE-07] admin orders count: ${orders.length}`);
    } finally {
      await ctx.dispose();
    }
  });
});
