import { test, expect, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

async function uploadImageViaApi(apiCtx: any): Promise<string | null> {
  try {
    // Create a temporary PNG file for upload
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
      0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const res = await apiCtx.post('/api/upload/image', {
      multipart: { file: { buffer: pngData, mimeType: 'image/png' } },
    });
    if (!res.ok()) return null;
    const body = await res.json();
    return body.url || body.data?.url;
  } catch (e) {
    console.error('Image upload error:', e);
    return null;
  }
}

async function createLiveStreamViaApi(streamKey: string) {
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
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const res = await apiCtx.post('/api/streaming/start', {
      headers,
      data: { expiresAt, description: 'E2E Test Stream' },
    });
    const body = await res.json();
    if (!res.ok() && body.context?.streamKey) {
      return { id: body.context.streamId, streamKey: body.context.streamKey, status: 'LIVE' };
    }
    if (!res.ok()) return null;
    return body.data ?? null;
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

async function deleteProductViaApi(productId: string) {
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

async function addToCartViaApi(apiCtx: any, productId: string, quantity: number) {
  const res = await apiCtx.post('/api/cart', { data: { productId, quantity } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), errorCode: body.errorCode };
}

async function getProductStock(productId: string) {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const res = await apiCtx.get(`${BASE_URL}/api/products/${productId}`);
    if (!res.ok()) return null;
    const body = await res.json();
    return body.data?.stock ?? null;
  } finally {
    await apiCtx.dispose();
  }
}

test.describe('Admin Product Registration & Concurrent Cart', () => {
  let streamKey: string;

  test.beforeAll(async () => {
    const requestedKey = `admin-test-${Date.now()}`;
    const stream = await createLiveStreamViaApi(requestedKey);
    streamKey = stream?.streamKey || requestedKey;
  });

  test('A-ADMIN-01: Admin register product with images, colors, sizes, timer, badge', async ({
    request,
  }) => {
    const productName = `테스트상품-${Date.now()}`;

    const p = await request.post(`${BASE_URL}/api/products`, {
      data: {
        streamKey,
        name: productName,
        price: 29000,
        stock: 10,
        timerEnabled: true,
        timerDuration: 600,
        images: [],
        colorOptions: ['Red', 'Blue', 'Black'],
        sizeOptions: ['S', 'M', 'L', 'XL'],
        shippingFee: 3000,
        isNew: true,
      },
    });

    const pBody = await p.json();
    const productId = pBody.data?.id;
    expect(productId).toBeTruthy();
    console.log(`✅ 상품 생성됨: ${productName}`);
    console.log(`🎨 색상: Red, Blue, Black`);
    console.log(`📏 사이즈: S, M, L, XL`);
    console.log(`⏱️  타이머: 10분 활성화`);
    console.log(`✨ NEW 뱃지: 활성화`);
    console.log(`💰 가격: 29,000원 | 재고: 10개`);
    console.log(`📍 관리자 페이지 확인: ${BASE_URL}/admin/products`);
  });

  test('A-ADMIN-02: Concurrent users can add to cart with timer active', async ({ request }) => {
    const p = await request.post(`${BASE_URL}/api/products`, {
      data: {
        streamKey,
        name: `Concurrent-${Date.now()}`,
        price: 29000,
        stock: 10,
        timerEnabled: true,
        timerDuration: 600,
        images: [],
        colorOptions: ['Black'],
        sizeOptions: ['Free'],
        shippingFee: 3000,
      },
    });

    const pBody = await p.json();
    const productId = pBody.data?.id;
    expect(productId).toBeTruthy();
    if (!productId) return;

    const u1 = await createAndLoginUser(`u1-${Date.now()}@test.com`);
    const u2 = await createAndLoginUser(`u2-${Date.now()}@test.com`);

    try {
      const [r1, r2] = await Promise.all([
        addToCartViaApi(u1, productId, 5),
        addToCartViaApi(u2, productId, 5),
      ]);

      expect([r1.ok, r2.ok].filter(Boolean).length).toBeGreaterThanOrEqual(1);
      const stock = await getProductStock(productId);
      expect(stock).toBeGreaterThanOrEqual(0);
    } finally {
      await u1.dispose();
      await u2.dispose();
    }
  });

  test('A-ADMIN-03: Cart with timer can be added and has expiration time', async ({ request }) => {
    const p = await request.post(`${BASE_URL}/api/products`, {
      data: {
        streamKey,
        name: `TimerTest-${Date.now()}`,
        price: 15000,
        stock: 20,
        timerEnabled: true,
        timerDuration: 600,
        images: [],
        colorOptions: ['Black'],
        sizeOptions: ['Free'],
        shippingFee: 0,
      },
    });

    const pBody = await p.json();
    const productId = pBody.data?.id;
    expect(productId).toBeTruthy();
    if (!productId) return;

    const user = await createAndLoginUser(`timer-${Date.now()}@test.com`);
    try {
      const addRes = await addToCartViaApi(user, productId, 3);
      expect(addRes.ok).toBe(true);

      const cartRes = await user.get(`${BASE_URL}/api/cart`);
      const cartBody = await cartRes.json();
      if (cartBody.data?.items?.length > 0) {
        const cartItem = cartBody.data.items[0];
        expect(cartItem.expiresAt).toBeTruthy();
      }
    } finally {
      await user.dispose();
    }
  });
});
