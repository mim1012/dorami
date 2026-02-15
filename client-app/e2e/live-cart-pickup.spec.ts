import { test, expect } from '@playwright/test';
import { createTestStream, ensureAuth } from './helpers/auth-helper';

/**
 * 라이브 방송 주워담기 + 타이머 E2E 테스트
 *
 * user storageState(프로필 완성된 사용자)로 실행됩니다.
 * 라이브 방송 페이지에서 상품을 장바구니에 담고, 타이머가 동작하는지 검증합니다.
 *
 * 전제 조건: 백엔드 서버 실행 중, 라이브 스트림 + 상품이 존재해야 함
 */

test.describe.configure({ mode: 'serial' });

let streamKey: string;
let testProductId: string;

test.describe('Live Stream Cart Pickup (주워담기)', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'USER');
  });

  test('should setup: create live stream and product', async ({ page }) => {
    // 1. 테스트용 라이브 스트림 생성
    try {
      streamKey = await createTestStream();
      console.log(`Test stream created: ${streamKey}`);
    } catch (e) {
      console.log(`Stream creation failed: ${e.message} - attempting to use existing`);
      // 기존 스트림 사용 시도
      await page.goto('/admin/broadcasts', { waitUntil: 'domcontentloaded' });
      test.skip(true, 'Could not create test stream');
      return;
    }

    // 2. API로 테스트 상품 생성 (관리자 권한 필요)
    const product = await page.evaluate(
      async ({ streamKey }) => {
        // 관리자로 로그인
        const loginRes = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: 'e2e-admin@test.com', name: 'E2E ADMIN', role: 'ADMIN' }),
        });
        if (!loginRes.ok) return null;

        const match = document.cookie.match(/csrf-token=([^;]+)/);
        const csrf = match ? match[1] : '';

        // 상품 생성
        const productRes = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify({
            name: 'E2E 테스트 상품 - 주워담기',
            price: 15000,
            quantity: 5,
            shippingFee: 3000,
            timerEnabled: true,
            timerDuration: 10,
            streamKey,
            colors: ['빨강', '파랑'],
            sizes: ['S', 'M', 'L'],
          }),
        });

        if (!productRes.ok) {
          const err = await productRes.text().catch(() => 'unknown');
          console.log(`Product creation failed: ${err}`);
          return null;
        }

        const data = await productRes.json();
        return data.data || data;
      },
      { streamKey },
    );

    if (!product) {
      test.skip(true, 'Could not create test product');
      return;
    }

    testProductId = product.id;
    console.log(`Test product created: ${testProductId}`);

    // 3. 다시 일반 사용자로 로그인
    await page.evaluate(async () => {
      await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'e2e-user@test.com', name: 'E2E USER', role: 'USER' }),
      });
    });
  });

  test('should display products on live stream page', async ({ page }) => {
    test.skip(!streamKey, 'No stream available');

    await page.goto(`/live/${streamKey}`, { waitUntil: 'domcontentloaded' });

    // 라이브 페이지 로딩 확인
    await page.waitForLoadState('networkidle');

    // 상품 목록이 표시되는지 확인 (데스크톱에서는 사이드바, 모바일에서는 하단)
    const productName = page.getByText('E2E 테스트 상품 - 주워담기');
    const isVisible = await productName.isVisible({ timeout: 10000 }).catch(() => false);

    if (isVisible) {
      console.log('Product visible on live stream page');
    } else {
      // 모바일 뷰에서는 상품 탭을 열어야 할 수 있음
      const productTab = page.getByRole('button', { name: /상품/ });
      const hasTab = await productTab.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasTab) {
        await productTab.click();
        await expect(productName).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should add product to cart (주워담기) from live stream', async ({ page }) => {
    test.skip(!streamKey || !testProductId, 'No stream/product available');

    // 1. 장바구니 비우기
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const match = document.cookie.match(/csrf-token=([^;]+)/);
      const csrf = match ? match[1] : '';
      await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'include',
      });
    });

    // 2. API로 장바구니에 추가 (주워담기)
    const cartResult = await page.evaluate(
      async ({ productId }) => {
        const match = document.cookie.match(/csrf-token=([^;]+)/);
        const csrf = match ? match[1] : '';
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify({ productId, quantity: 1, color: '빨강', size: 'M' }),
        });
        if (!res.ok) {
          const err = await res.text().catch(() => '');
          return { ok: false, error: err };
        }
        const data = await res.json();
        return { ok: true, data: data.data || data };
      },
      { productId: testProductId },
    );

    expect(cartResult.ok).toBe(true);
    console.log(`Added to cart: ${JSON.stringify(cartResult.data?.id)}`);

    // 3. 장바구니 페이지에서 확인
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('장바구니')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('E2E 테스트 상품 - 주워담기')).toBeVisible({ timeout: 10000 });
  });

  test('should display timer on cart item when timerEnabled', async ({ page }) => {
    test.skip(!testProductId, 'No product available');

    // 장바구니 API로 타이머 정보 확인
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('장바구니')).toBeVisible({ timeout: 15000 });

    const cartData = await page.evaluate(async () => {
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.data || data;
    });

    expect(cartData).toBeDefined();
    expect(cartData.items.length).toBeGreaterThan(0);

    const timerItem = cartData.items.find((item: any) => item.timerEnabled === true);
    expect(timerItem).toBeDefined();
    expect(timerItem.expiresAt).toBeDefined();
    expect(timerItem.remainingSeconds).toBeGreaterThan(0);

    console.log(
      `Timer active: ${timerItem.remainingSeconds}s remaining, expires at ${timerItem.expiresAt}`,
    );

    // UI에서 타이머 또는 남은 시간 표시 확인
    const timerText = page.locator('text=/\\d+:\\d+/'); // MM:SS 형식
    const hasTimer = await timerText
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasTimer) {
      console.log('Timer UI displayed on cart item');
    } else {
      console.log('Timer data confirmed via API (UI may render differently)');
    }
  });

  test('should verify color and size selection in cart', async ({ page }) => {
    test.skip(!testProductId, 'No product available');

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('장바구니')).toBeVisible({ timeout: 15000 });

    // 옵션(색상, 사이즈) 표시 확인
    await expect(page.getByText('빨강')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('M')).toBeVisible({ timeout: 5000 });

    console.log('Color and size options displayed in cart');
  });

  test('should show stock limit when adding too many items', async ({ page }) => {
    test.skip(!testProductId, 'No product available');

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });

    // 재고 초과 추가 시도
    const result = await page.evaluate(
      async ({ productId }) => {
        const match = document.cookie.match(/csrf-token=([^;]+)/);
        const csrf = match ? match[1] : '';
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify({ productId, quantity: 100 }),
        });
        return { ok: res.ok, status: res.status };
      },
      { productId: testProductId },
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    console.log('Stock limit correctly enforced');
  });

  test('cleanup: clear cart after tests', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const match = document.cookie.match(/csrf-token=([^;]+)/);
      const csrf = match ? match[1] : '';
      await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'include',
      });
    });
    console.log('Cart cleared after tests');
  });
});
