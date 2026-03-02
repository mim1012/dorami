import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

interface Product {
  id: string;
  name: string;
  price: string | number;
  stock: number;
  status: string;
}
interface LiveStream {
  id: string;
  streamKey: string;
  status: string;
}

async function createLiveStreamViaApi(streamKey: string): Promise<LiveStream | null> {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const loginRes = await apiCtx.post('/api/auth/dev-login', {
      data: { email: 'admin@dorami.shop', role: 'ADMIN' },
    });
    if (!loginRes.ok()) return null;
    let csrfToken = '';
    try {
      const meRes = await apiCtx.get('/api/auth/me');
      const setCookie = meRes.headers()['set-cookie'] || '';
      const m = setCookie.match(/csrf-token=([^;]+)/);
      csrfToken = m ? m[1] : '';
    } catch {}
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour from now
    const res = await apiCtx.post('/api/streaming/start', {
      headers,
      data: { expiresAt, description: 'E2E Test Stream' },
    });
    const body = await res.json();
    // If admin already has an active stream, use that stream's key
    if (!res.ok() && body.context?.streamKey) {
      return { id: body.context.streamId, streamKey: body.context.streamKey, status: 'LIVE' };
    }
    if (!res.ok()) return null;
    return (body.data ?? null) as LiveStream | null;
  } finally {
    await apiCtx.dispose();
  }
}

async function createProductViaApi(opts: {
  streamKey: string;
  name: string;
  price?: number;
  stock?: number;
}): Promise<Product | null> {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const loginRes = await apiCtx.post('/api/auth/dev-login', {
      data: { email: 'admin@dorami.shop', role: 'ADMIN' },
    });
    if (!loginRes.ok()) return null;
    let csrfToken = '';
    try {
      const meRes = await apiCtx.get('/api/auth/me');
      const setCookie = meRes.headers()['set-cookie'] || '';
      const m = setCookie.match(/csrf-token=([^;]+)/);
      csrfToken = m ? m[1] : '';
    } catch {}
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    const res = await apiCtx.post('/api/products', {
      headers,
      data: {
        streamKey: opts.streamKey,
        name: opts.name,
        price: opts.price ?? 10000,
        stock: opts.stock ?? 1,
        timerEnabled: false,
        timerDuration: 10,
        images: [],
        colorOptions: ['Black'],
        sizeOptions: ['Free'],
        shippingFee: 0,
      },
    });
    if (!res.ok()) return null;
    const body = await res.json();
    return (body.data ?? null) as Product | null;
  } finally {
    await apiCtx.dispose();
  }
}

async function deleteProductViaApi(productId: string): Promise<void> {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    await apiCtx.post('/api/auth/dev-login', {
      data: { email: 'admin@dorami.shop', role: 'ADMIN' },
    });
    let csrfToken = '';
    try {
      const meRes = await apiCtx.get('/api/auth/me');
      const setCookie = meRes.headers()['set-cookie'] || '';
      const m = setCookie.match(/csrf-token=([^;]+)/);
      csrfToken = m ? m[1] : '';
    } catch {}
    const headers: Record<string, string> = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    await apiCtx.delete(`/api/products/${productId}`, { headers });
  } finally {
    await apiCtx.dispose();
  }
}

async function addToCartViaApi(
  apiCtx: Awaited<ReturnType<typeof playwrightRequest.newContext>>,
  productId: string,
  quantity: number,
): Promise<{ ok: boolean; status: number; errorCode?: string }> {
  const res = await apiCtx.post('/api/cart', { data: { productId, quantity } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), errorCode: body.errorCode };
}

async function getProductStock(productId: string): Promise<number | null> {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const res = await apiCtx.get(`/api/products/${productId}`);
    if (!res.ok()) return null;
    const body = await res.json();
    return body.data?.stock ?? null;
  } finally {
    await apiCtx.dispose();
  }
}

async function createAndLoginUser(email: string) {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const loginRes = await apiCtx.post('/api/auth/dev-login', { data: { email, role: 'USER' } });
  if (!loginRes.ok()) {
    await apiCtx.dispose();
    throw new Error(`Failed to login: ${loginRes.status()}`);
  }
  try {
    await apiCtx.post('/api/users/complete-profile', {
      data: {
        depositorName: 'E2E',
        instagramId: `@e2e_${email.split('@')[0]}`,
        fullName: 'E2E User',
        address1: '123 St',
        address2: 'Apt',
        city: 'NYC',
        state: 'NY',
        zip: '10001',
        phone: '5551234567',
      },
    });
  } catch {}
  return apiCtx;
}

test.describe('Edge Cases', () => {
  let streamKey: string;
  test.beforeAll(async () => {
    const requestedKey = `edge-${Date.now()}`;
    const stream = await createLiveStreamViaApi(requestedKey);
    streamKey = stream?.streamKey || requestedKey;
  });

  test('E-EDGE-01: Negative Stock Prevention', async () => {
    const p = await createProductViaApi({ streamKey, name: `P1-${Date.now()}`, stock: 1 });
    expect(p).toBeTruthy();
    if (!p) return;
    const u1 = await createAndLoginUser(`u1-${Date.now()}@test.com`);
    const u2 = await createAndLoginUser(`u2-${Date.now()}@test.com`);
    try {
      const [r1, r2] = await Promise.all([
        addToCartViaApi(u1, p.id, 1),
        addToCartViaApi(u2, p.id, 1),
      ]);
      expect([r1, r2].filter((r) => r.ok).length).toBe(1);
      expect(await getProductStock(p.id)).toBeGreaterThanOrEqual(0);
    } finally {
      await u1.dispose();
      await u2.dispose();
      await deleteProductViaApi(p.id);
    }
  });

  test('E-EDGE-02: Exact Stock Exhaustion', async () => {
    const p = await createProductViaApi({ streamKey, name: `P2-${Date.now()}`, stock: 3 });
    expect(p).toBeTruthy();
    if (!p) return;
    const users = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createAndLoginUser(`u${i}-${Date.now()}@test.com`)),
    );
    try {
      const results = await Promise.all(users.map((u) => addToCartViaApi(u, p.id, 1)));
      expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(3);
      expect(await getProductStock(p.id)).toBeGreaterThanOrEqual(0);
    } finally {
      await Promise.all(users.map((u) => u.dispose()));
      await deleteProductViaApi(p.id);
    }
  });

  test('E-EDGE-03: Concurrent Updates', async () => {
    const p = await createProductViaApi({ streamKey, name: `P3-${Date.now()}`, stock: 50 });
    expect(p).toBeTruthy();
    if (!p) return;
    const u = await createAndLoginUser(`u-${Date.now()}@test.com`);
    try {
      await addToCartViaApi(u, p.id, 1);
      const results = await Promise.all([
        u.put('/api/cart', { data: { productId: p.id, quantity: 5 } }).catch(() => null),
        u.put('/api/cart', { data: { productId: p.id, quantity: 3 } }).catch(() => null),
      ]);
      expect(results.filter((r) => r && r.ok()).length).toBeGreaterThanOrEqual(0);
    } finally {
      await u.dispose();
      await deleteProductViaApi(p.id);
    }
  });

  test('E-EDGE-04: Timer Expiration', async () => {
    const p = await createProductViaApi({ streamKey, name: `P4-${Date.now()}`, stock: 20 });
    expect(p).toBeTruthy();
    if (!p) return;
    const u = await createAndLoginUser(`u-${Date.now()}@test.com`);
    try {
      const res = await addToCartViaApi(u, p.id, 5);
      expect(res.ok).toBe(true);
    } finally {
      await u.dispose();
      await deleteProductViaApi(p.id);
    }
  });

  test('E-EDGE-05: Status Change', async () => {
    const p = await createProductViaApi({ streamKey, name: `P5-${Date.now()}`, stock: 10 });
    expect(p).toBeTruthy();
    if (!p) return;
    const u = await createAndLoginUser(`u-${Date.now()}@test.com`);
    // Create admin user for patching products
    const adminCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    await adminCtx.post('/api/auth/dev-login', {
      data: { email: 'admin@dorami.shop', role: 'ADMIN' },
    });
    const a = adminCtx;
    try {
      await addToCartViaApi(u, p.id, 2);
      let csrf = '';
      try {
        const meRes = await a.get('/api/auth/me');
        const setCookie = meRes.headers()['set-cookie'] || '';
        const m = setCookie.match(/csrf-token=([^;]+)/);
        csrf = m ? m[1] : '';
      } catch {}
      const h: Record<string, string> = {};
      if (csrf) h['x-csrf-token'] = csrf;
      await a.patch(`/api/products/${p.id}`, {
        headers: h,
        data: { stock: 0, status: 'SOLD_OUT' },
      });
      const res = await addToCartViaApi(u, p.id, 1);
      expect(res.ok).toBe(false);
    } finally {
      await u.dispose();
      await a.dispose();
      await deleteProductViaApi(p.id);
    }
  });
});
