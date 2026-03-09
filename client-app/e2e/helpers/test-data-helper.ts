import { Page, request as playwrightRequest } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * Create a product via API (admin auth required in page context).
 * streamKey is optional — products can exist without a live stream.
 */
export async function createTestProduct(
  page: Page,
  options: {
    name: string;
    price?: number;
    stock?: number;
    streamKey?: string;
  },
): Promise<string> {
  // [E2E-BIZ] Create product via admin page context
  const productId = await page.evaluate(
    async ({ name, price, stock, streamKey }) => {
      const match = document.cookie.match(/csrf-token=([^;]+)/);
      const csrf = match ? match[1] : '';

      const payload: Record<string, unknown> = {
        name,
        price: price ?? 29000,
        stock: stock ?? 10,
        timerEnabled: false,
      };
      if (streamKey) payload.streamKey = streamKey;

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`createTestProduct failed: ${res.status} ${err}`);
      }
      const data = await res.json();
      return (data.data ?? data).id as string;
    },
    {
      name: options.name,
      price: options.price,
      stock: options.stock,
      streamKey: options.streamKey,
    },
  );

  return productId;
}

/** Delete a product via API (admin auth required in page context) */
export async function deleteTestProduct(page: Page, productId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    const csrf = match ? match[1] : '';
    await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrf },
      credentials: 'include',
    });
  }, productId);
}

/** Clear all active cart items for the current user */
export async function clearCart(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    const csrf = match ? match[1] : '';
    await fetch('/api/cart', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrf },
      credentials: 'include',
    });
  });
}

/** Get current cart from API */
export async function getCartFromAPI(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const res = await fetch('/api/cart', {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data ?? data;
  });
}

/** Add a product to cart, returns { status, body } */
export async function addToCart(
  page: Page,
  productId: string,
  quantity = 1,
): Promise<{ status: number; body: any }> {
  return page.evaluate(
    async ({ productId, quantity }) => {
      const match = document.cookie.match(/csrf-token=([^;]+)/);
      const csrf = match ? match[1] : '';
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity }),
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
    { productId, quantity },
  );
}

/** Create an order from the current cart */
export async function createOrderFromCart(
  page: Page,
): Promise<{ orderId: string; status: number }> {
  return page.evaluate(async () => {
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    const csrf = match ? match[1] : '';
    const res = await fetch('/api/orders/from-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    const orderId = (body?.data ?? body)?.id ?? '';
    return { orderId, status: res.status };
  });
}

/** Get a specific order from API (user or admin auth) */
export async function getOrderFromAPI(page: Page, orderId: string): Promise<any> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/api/orders/${id}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data ?? data;
  }, orderId);
}

/** Get order list from API */
export async function getOrdersFromAPI(page: Page): Promise<any[]> {
  return page.evaluate(async () => {
    const res = await fetch('/api/orders', {
      credentials: 'include',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data.data ?? data;
    return Array.isArray(result) ? result : (result?.orders ?? []);
  });
}

/** Admin: confirm payment for an order */
export async function adminConfirmPayment(
  page: Page,
  orderId: string,
): Promise<{ status: number }> {
  return page.evaluate(async (id) => {
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    const csrf = match ? match[1] : '';

    // Primary endpoint
    const res = await fetch(`/api/admin/orders/${id}/confirm-payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      credentials: 'include',
    });

    if (!res.ok) {
      // Fallback endpoint
      const res2 = await fetch(`/api/orders/${id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
      });
      return { status: res2.status };
    }

    return { status: res.status };
  }, orderId);
}

/**
 * Create a product via standalone request context (no page required).
 * Used in beforeAll hooks where no page is available yet.
 * Returns productId.
 */
export async function createTestProductViaAPI(options: {
  name: string;
  price?: number;
  stock?: number;
  streamKey?: string;
}): Promise<string | null> {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    await apiCtx.post('/api/auth/dev-login', {
      data: { email: 'admin@dorami.shop', name: 'E2E ADMIN' },
    });

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

    const payload: Record<string, unknown> = {
      name: options.name,
      price: options.price ?? 29000,
      stock: options.stock ?? 10,
      timerEnabled: false,
    };
    if (options.streamKey) payload.streamKey = options.streamKey;

    const res = await apiCtx.post('/api/products', { headers, data: payload });
    if (!res.ok()) {
      console.warn(`createTestProductViaAPI failed: ${res.status()} ${await res.text()}`);
      return null;
    }
    const body = await res.json();
    return (body.data ?? body).id as string;
  } finally {
    await apiCtx.dispose();
  }
}

/** Delete a product via standalone request context (no page required). */
export async function deleteTestProductViaAPI(productId: string): Promise<void> {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    await apiCtx.post('/api/auth/dev-login', {
      data: { email: 'admin@dorami.shop', name: 'E2E ADMIN' },
    });
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
    await apiCtx.delete(`/api/products/${productId}`, { headers });
  } finally {
    await apiCtx.dispose();
  }
}
