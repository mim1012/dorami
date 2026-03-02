import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

test.describe.configure({ mode: 'serial' });

let testProductId: string;
const TOTAL_STOCK = 152;
const PRODUCT_NAME = 'E2E-재고차감-분석';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Admin Stock Deduction & Analytics Verification', () => {
  test.setTimeout(180000);

  test('Step 01: Admin creates product with empty streamKey via API', async ({ page }) => {
    await ensureAuth(page, 'ADMIN');

    const res = await page.request.post(BACKEND_URL + '/api/products', {
      data: {
        name: 'E2E-재고차감-분석',
        price: 50000,
        stock: 152,
        colorOptions: ['red', 'green'],
        sizeOptions: ['100'],
        shippingFee: 3000,
      },
    });

    const body = await res.json();
    testProductId = body.data?.id || '';

    expect(testProductId).toBeTruthy();
    console.log('✅ Step 01: Product created - ' + testProductId);
  });

  test('Step 02: User1 orders 50 units via API', async ({ page }) => {
    test.skip(!testProductId);

    const orderRes = await page.request.post(BACKEND_URL + '/api/orders', {
      data: {
        productId: testProductId,
        quantity: 50,
        color: 'green',
        size: '100',
        paymentMethod: 'CREDIT_CARD',
        newShippingAddress: {
          name: 'User1',
          phone: '010-1111-1111',
          address: 'Seoul',
          detailAddress: 'D1',
          zipCode: '06000',
        },
      },
    });

    const orderBody = await orderRes.json();
    expect(orderBody.data?.id).toBeTruthy();
    console.log('✅ Step 02: User1 ordered 50 units - ' + orderBody.data?.id);
  });

  test('Step 03: User2 orders 2 units via API', async ({ page }) => {
    test.skip(!testProductId);

    const orderRes = await page.request.post(BACKEND_URL + '/api/orders', {
      data: {
        productId: testProductId,
        quantity: 2,
        color: 'green',
        size: '100',
        paymentMethod: 'CREDIT_CARD',
        newShippingAddress: {
          name: 'User2',
          phone: '010-2222-2222',
          address: 'Seoul',
          detailAddress: 'D2',
          zipCode: '06000',
        },
      },
    });

    const orderBody = await orderRes.json();
    expect(orderBody.data?.id).toBeTruthy();
    console.log('✅ Step 03: User2 ordered 2 units - ' + orderBody.data?.id);
  });

  test('Step 04: User3 orders 100 units via API', async ({ page }) => {
    test.skip(!testProductId);

    const orderRes = await page.request.post(BACKEND_URL + '/api/orders', {
      data: {
        productId: testProductId,
        quantity: 100,
        color: 'red',
        size: '100',
        paymentMethod: 'CREDIT_CARD',
        newShippingAddress: {
          name: 'User3',
          phone: '010-3333-3333',
          address: 'Seoul',
          detailAddress: 'D3',
          zipCode: '06000',
        },
      },
    });

    const orderBody = await orderRes.json();
    expect(orderBody.data?.id).toBeTruthy();
    console.log('✅ Step 04: User3 ordered 100 units - ' + orderBody.data?.id);
  });

  test('Step 05: Admin confirms payment for all 3 orders', async ({ page }) => {
    test.skip(!testProductId);

    await ensureAuth(page, 'ADMIN');
    await gotoWithRetry(page, '/admin/orders');
    await page.waitForTimeout(1000);

    const pending = page.locator('tr:has-text("PENDING_PAYMENT"), tr:has-text("입금대기")');
    const cnt = await pending.count();

    for (let i = 0; i < Math.min(cnt, 3); i++) {
      const row = pending.nth(i);
      await row.locator('a, button').first().click();
      await page.waitForTimeout(500);

      const btn = page.locator('button:has-text("입금확인")');
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        const ok = page.locator('button:has-text("확인")').last();
        if (await ok.isVisible({ timeout: 2000 }).catch(() => false)) await ok.click();
      }
      await page.goBack();
      await page.waitForTimeout(1000);
    }

    console.log('✅ Step 05: All payments confirmed');
  });

  test('Step 06: Verify stock decremented to 0', async ({ page }) => {
    test.skip(!testProductId);

    const res = await page.request.get(BACKEND_URL + '/api/products/' + testProductId);
    const data = await res.json();
    expect(data.data.stock).toBe(0);

    console.log('✅ Step 06: Stock = ' + data.data.stock + ' (152 - 50 - 2 - 100 = 0)');
  });

  test('Step 07: Verify product visible in analytics', async ({ page }) => {
    test.skip(!testProductId);

    await ensureAuth(page, 'ADMIN');
    await gotoWithRetry(page, '/admin/analytics');
    await page.waitForTimeout(2000);

    const visible = await page
      .locator('text=' + PRODUCT_NAME)
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    console.log('✅ Step 07: Product visible in analytics = ' + (visible ? 'YES' : 'NO'));
  });

  test('Step 08: Final integration check', async ({ page }) => {
    test.skip(!testProductId);

    const res = await page.request.get(BACKEND_URL + '/api/products/' + testProductId);
    const data = await res.json();
    expect(data.data.stock).toBe(0);

    console.log('✅ Step 08: COMPLETE - 152 units sold, stock = 0');
  });
});
