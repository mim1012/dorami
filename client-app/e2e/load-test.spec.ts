import { test, expect, request as playwrightRequest } from '@playwright/test';

/**
 * Load Test E2E — Task #21
 *
 * Simulates 5 concurrent users performing the full purchase flow:
 * 1. Login (dev-login)
 * 2. Browse products
 * 3. Add to cart
 * 4. Place order
 *
 * Records response times for each step and outputs a summary.
 * Does NOT modify any existing tests.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const CONCURRENT_USERS = 5;

interface StepTiming {
  step: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

interface UserResult {
  userId: number;
  steps: StepTiming[];
  totalMs: number;
  success: boolean;
}

async function measureStep(name: string, fn: () => Promise<void>): Promise<StepTiming> {
  const start = Date.now();
  try {
    await fn();
    return { step: name, durationMs: Date.now() - start, success: true };
  } catch (err) {
    return {
      step: name,
      durationMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runUserFlow(userIndex: number): Promise<UserResult> {
  const steps: StepTiming[] = [];
  const flowStart = Date.now();
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });

  try {
    // Step 1: Login
    const loginStep = await measureStep('login', async () => {
      const res = await apiCtx.post('/api/auth/dev-login', {
        data: {
          email: `loadtest-user-${userIndex}@test.doremi.shop`,
          name: `LoadTest User ${userIndex}`,
        },
      });
      expect(res.ok()).toBeTruthy();
    });
    steps.push(loginStep);
    if (!loginStep.success) {
      return { userId: userIndex, steps, totalMs: Date.now() - flowStart, success: false };
    }

    // Get CSRF token
    let csrfToken = '';
    try {
      const meRes = await apiCtx.get('/api/auth/me');
      const setCookie = meRes.headers()['set-cookie'] || '';
      const m = setCookie.match(/csrf-token=([^;]+)/);
      csrfToken = m ? m[1] : '';
    } catch {
      /* ignore */
    }
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    // Step 2: Browse products
    let productId: string | null = null;
    let streamKey: string | null = null;
    const browseStep = await measureStep('browse_products', async () => {
      const res = await apiCtx.get('/api/products');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const products = body.data ?? [];
      if (products.length > 0) {
        productId = products[0].id;
        streamKey = products[0].streamKey || null;
      }
    });
    steps.push(browseStep);

    // Step 3: View product detail (if product exists)
    if (productId) {
      const detailStep = await measureStep('product_detail', async () => {
        const res = await apiCtx.get(`/api/products/${productId}`);
        expect(res.ok()).toBeTruthy();
      });
      steps.push(detailStep);
    } else {
      steps.push({
        step: 'product_detail',
        durationMs: 0,
        success: false,
        error: 'No products available',
      });
    }

    // Step 4: Add to cart
    let cartSuccess = false;
    if (productId) {
      const cartStep = await measureStep('add_to_cart', async () => {
        const res = await apiCtx.post('/api/cart', {
          headers,
          data: {
            productId,
            quantity: 1,
            selectedColor: 'Black',
            selectedSize: 'Free',
          },
        });
        // 200 or 409 (already in cart) both acceptable
        if (!res.ok() && res.status() !== 409) {
          const body = await res.text();
          throw new Error(`Cart add failed: ${res.status()} ${body}`);
        }
        cartSuccess = true;
      });
      steps.push(cartStep);
    } else {
      steps.push({
        step: 'add_to_cart',
        durationMs: 0,
        success: false,
        error: 'No product to add',
      });
    }

    // Step 5: Get cart contents
    const cartViewStep = await measureStep('view_cart', async () => {
      const res = await apiCtx.get('/api/cart', { headers });
      expect(res.ok()).toBeTruthy();
    });
    steps.push(cartViewStep);

    // Step 6: Create order (checkout)
    if (cartSuccess) {
      const orderStep = await measureStep('create_order', async () => {
        const res = await apiCtx.post('/api/orders', {
          headers,
          data: {
            shippingAddress: {
              name: `LoadTest User ${userIndex}`,
              phone: '010-0000-0000',
              address: '서울시 강남구 테헤란로 1',
              detailAddress: `${userIndex}층`,
              zipCode: '06234',
            },
          },
        });
        // Accept 200, 201, or 400 (empty cart is acceptable in load test)
        if (res.status() >= 500) {
          const body = await res.text();
          throw new Error(`Order failed: ${res.status()} ${body}`);
        }
      });
      steps.push(orderStep);
    } else {
      steps.push({
        step: 'create_order',
        durationMs: 0,
        success: false,
        error: 'Cart not populated',
      });
    }

    const allSuccess = steps.every((s) => s.success);
    return { userId: userIndex, steps, totalMs: Date.now() - flowStart, success: allSuccess };
  } finally {
    await apiCtx.dispose();
  }
}

test.describe('Load Test — 5 Concurrent Users', () => {
  test.setTimeout(120_000); // 2 minutes max

  test('5 users: login → browse → cart → order with timing', async () => {
    // Run all 5 users concurrently
    const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => runUserFlow(i));
    const results = await Promise.all(promises);

    // Print timing summary
    console.log('\n========== LOAD TEST RESULTS ==========');
    console.log(`Concurrent users: ${CONCURRENT_USERS}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');

    for (const r of results) {
      const status = r.success ? 'PASS' : 'PARTIAL';
      console.log(`User ${r.userId} [${status}] total=${r.totalMs}ms`);
      for (const s of r.steps) {
        const icon = s.success ? '+' : '-';
        const errMsg = s.error ? ` (${s.error.slice(0, 80)})` : '';
        console.log(`  [${icon}] ${s.step}: ${s.durationMs}ms${errMsg}`);
      }
    }

    // Aggregate stats
    const allSteps = results.flatMap((r) => r.steps);
    const stepNames = [...new Set(allSteps.map((s) => s.step))];
    console.log('\n--- Aggregate Response Times ---');
    for (const name of stepNames) {
      const matching = allSteps.filter((s) => s.step === name && s.success);
      if (matching.length === 0) {
        console.log(`${name}: no successful measurements`);
        continue;
      }
      const times = matching.map((s) => s.durationMs);
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const min = Math.min(...times);
      const max = Math.max(...times);
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] ?? max;
      console.log(
        `${name}: avg=${avg}ms min=${min}ms max=${max}ms p95=${p95}ms (${matching.length}/${CONCURRENT_USERS} ok)`,
      );
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`\nOverall: ${successCount}/${CONCURRENT_USERS} users completed full flow`);
    console.log('========================================\n');

    // At least 1 user should complete login + browse
    const loginSuccesses = results.filter((r) =>
      r.steps.some((s) => s.step === 'login' && s.success),
    );
    expect(loginSuccesses.length).toBeGreaterThan(0);
  });
});
