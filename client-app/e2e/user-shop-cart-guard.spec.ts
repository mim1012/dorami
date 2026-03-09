/**
 * User Shop / Cart / Access Guard Tests
 *
 * 검증 항목:
 *   1. 비로그인 상태 → 보호된 경로 접근 시 /login 리디렉트
 *      - / (홈) 은 공개 → 정상 접근 가능
 *      - /shop, /cart, /my-page, /alerts, /upcoming → /login 리디렉트
 *   2. 상품 등록 후 메인홈(/)에 상품 목록 없음
 *      - 홈은 라이브 섹션(LiveBanner + UpcomingLives)만 표시
 *      - 상품명이 홈에 노출되지 않음을 확인
 *      - /shop 에서는 상품명이 보임을 확인
 *   3. 카트 타이머 만료 동작 확인
 *      - 상품을 카트에 담으면 10분 타이머가 시작됨
 *      - 카트 페이지에서 타이머(expiresAt) 표시 확인
 *      - 만료 상태(EXPIRED) 아이템이 있으면 결제 버튼 비활성화
 *   4. admin/users — 일반 유저는 접근 불가 (403)
 *      - /admin/users 접근 시 /403 또는 /login 리디렉트 확인
 *
 * 실행:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3003 \
 *   BACKEND_URL=http://127.0.0.1:3001 \
 *   npx playwright test --project=user e2e/user-shop-cart-guard.spec.ts
 */
import { test, expect, request } from '@playwright/test';
import path from 'path';
import { devLogin } from './helpers/auth-helper';

const TS = Date.now();
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const ADMIN_STATE = path.join(__dirname, '.auth', 'admin.json');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';

// ─────────────────────────────────────────────
// 공통 헬퍼
// ─────────────────────────────────────────────
async function safeGoto(
  page: import('@playwright/test').Page,
  url: string,
  timeout = 12_000,
): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch {
    const title = await page.title().catch(() => '');
    if (!title) throw new Error(`Navigation failed: ${url}`);
  }
  await page.waitForSelector('main, [role="main"], h1, h2', { timeout: 8_000 }).catch(() => {});
}

async function waitForText(
  page: import('@playwright/test').Page,
  text: string,
  timeout = 8_000,
): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${text}`, { timeout });
    return true;
  } catch {
    return page
      .getByText(text, { exact: false })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
  }
}

// 어드민 API context 생성 (dev-login으로 인증)
async function createAdminApiContext() {
  const apiCtx = await request.newContext({ baseURL: BACKEND_URL });
  const loginRes = await apiCtx.post('/api/auth/dev-login', {
    data: { email: ADMIN_EMAIL, name: 'E2E Admin' },
  });
  if (!loginRes.ok()) {
    await apiCtx.dispose();
    throw new Error(`Admin dev-login 실패: ${loginRes.status()}`);
  }
  return apiCtx;
}

// ════════════════════════════════════════════════
// 1. 비로그인 → 보호 페이지 /login 리디렉트
// ════════════════════════════════════════════════
test.describe('1. 비로그인 상태 접근 가드', () => {
  // 쿠키 없는 빈 세션
  test.use({ storageState: { cookies: [], origins: [] } });

  const protectedRoutes = ['/shop', '/cart', '/my-page', '/alerts', '/upcoming'];

  for (const route of protectedRoutes) {
    test(`1-x. ${route} → /login 리디렉트`, async ({ page }) => {
      // 비로그인 → middleware가 즉시 /login으로 서버사이드 리디렉트
      // .catch 없이 goto: 리디렉트가 발생하면 goto가 /login에서 domcontentloaded로 완료됨
      try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch {
        // navigation timeout 발생 시 현재 URL 확인으로 대체
      }
      await page.waitForURL(/\/(login|profile\/register)/, { timeout: 15_000 });
      // 비로그인 → /login (로그인+미완성은 /profile/register로 감)
      expect(page.url()).toContain('/login');
    });
  }

  test('1-home. / (홈) → 비로그인이어도 정상 접근 가능', async ({ page }) => {
    await safeGoto(page, '/');
    // 로그인 페이지로 리디렉트되지 않음
    expect(page.url()).not.toContain('/login');
    // 홈에 라이브 섹션 콘텐츠가 존재 (헤더 또는 배너 영역)
    const hasContent = await page
      .locator('main, [role="main"]')
      .first()
      .isVisible({ timeout: 6_000 })
      .catch(() => false);
    expect(hasContent).toBe(true);
  });
});

// ════════════════════════════════════════════════
// 2. 상품 등록 후 메인홈에 상품 목록 없음
//    홈은 라이브 섹션(LiveBanner + UpcomingLives)만 표시
// ════════════════════════════════════════════════
test.describe('2. 상품은 홈(/)에 노출되지 않음', () => {
  test.describe.configure({ mode: 'serial' });

  const productName = `홈노출테스트_${TS}`;
  let productId: string | null = null;

  test('2-1. 어드민 API로 테스트 상품 등록', async ({ browser }) => {
    // storageState 토큰이 만료됐을 수 있으므로 devLogin으로 갱신
    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await devLogin(adminPage, 'ADMIN');
      // 어드민 페이지 한 번 방문하여 CSRF 쿠키 획득
      await adminPage
        .goto('/admin/products', { waitUntil: 'domcontentloaded', timeout: 30_000 })
        .catch(() => {});
      // page.request는 브라우저 세션의 CSRF 쿠키를 자동 포함
      const res = await adminPage.request.post('/api/products', {
        data: {
          name: productName,
          price: '39.99',
          stock: 10,
          description: 'E2E 홈 노출 검증용 상품',
        },
      });
      expect(res.ok(), `상품 등록 실패: ${res.status()}`).toBe(true);
      const body = await res.json();
      productId = body?.data?.id ?? body?.id ?? null;
      console.log(`테스트 상품 등록: ${productName} (id=${productId})`);
    } finally {
      await adminContext.close();
    }
  });

  test('2-2. 홈(/)에 상품 이름이 표시되지 않음', async ({ page }) => {
    await safeGoto(page, '/');

    // 홈 페이지에는 LiveBanner, UpcomingLives만 있음 — 상품 목록 없음
    const productOnHome = await waitForText(page, productName, 4_000);
    expect(
      productOnHome,
      `상품 "${productName}"이 홈에 노출됨 (홈은 라이브 섹션만 표시해야 함)`,
    ).toBe(false);

    // 홈에 상품 그리드/목록 컨테이너가 없음을 확인
    const hasProductGrid = await page
      .locator('[class*="product"], [data-testid*="product"]')
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    expect(hasProductGrid, '홈 페이지에 상품 그리드 컨테이너가 존재함').toBe(false);
  });

  test('2-3. /shop 에서는 등록된 상품이 보임', async ({ page }) => {
    await safeGoto(page, '/shop');
    const found = await waitForText(page, productName, 10_000);
    expect(found, `상품 "${productName}"이 /shop 페이지에서 보이지 않음`).toBe(true);
  });

  test('2-4. 홈에는 라이브 섹션(LiveBanner/UpcomingLives)만 존재', async ({ page }) => {
    await safeGoto(page, '/');
    // 홈 main 내에 "라이브" 관련 텍스트 또는 섹션이 존재하는지
    // (라이브 방송이 없는 경우 "예정된 방송" 또는 배너 placeholder가 표시됨)
    const mainEl = page.locator('main');
    await mainEl.waitFor({ timeout: 8_000 });
    const mainHtml = await mainEl.innerHTML({ timeout: 5_000 }).catch(() => '');
    // 상품 관련 키워드가 main에 없어야 함
    expect(mainHtml).not.toContain(productName);
  });
});

// ════════════════════════════════════════════════
// 3. 카트 타이머 만료 동작 확인
//    실제 10분 대기 없이 UI 상태 검증
// ════════════════════════════════════════════════
test.describe('3. 카트 타이머 및 만료 UI', () => {
  test.describe.configure({ mode: 'serial' });

  test('3-1. /cart 접근 시 장바구니 페이지 정상 로드', async ({ page }) => {
    await safeGoto(page, '/cart');
    // 장바구니 헤딩 확인
    const hasHeading = await waitForText(page, '장바구니', 8_000);
    expect(hasHeading).toBe(true);
  });

  test('3-2. 빈 카트 → 빈 상태 메시지 표시', async ({ page }) => {
    // 현재 카트를 비우기 (GET → DELETE all items)
    const cartRes = await page.request.get('/api/cart');
    if (cartRes.ok()) {
      const cartBody = await cartRes.json();
      const items: Array<{ id: string }> = cartBody?.data?.items ?? [];
      for (const item of items) {
        await page.request.delete(`/api/cart/${item.id}`).catch(() => {});
      }
    }

    await safeGoto(page, '/cart');

    // 빈 상태: "장바구니가 비어있습니다" 또는 유사 텍스트
    const isEmpty = await waitForText(page, '비어', 15_000);
    expect(isEmpty, '빈 카트에서 빈 상태 메시지가 나타나지 않음').toBe(true);

    // 빈 카트에서 결제 버튼 없음
    const hasCheckout = await page
      .getByText('결제하기', { exact: false })
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    expect(hasCheckout).toBe(false);
  });

  test('3-3. 카트 아이템 EXPIRED 상태 → 결제 버튼 비활성화', async ({ page }) => {
    // 만료 상태 시뮬: /api/cart GET이 EXPIRED 아이템을 반환할 때 UI 동작 검증
    // 실제 만료는 서버 TTL(10분) 이후에 발생하므로,
    // 여기서는 page.route 인터셉터로 expired 응답을 모킹
    await page.route('**/api/cart', async (route) => {
      const mockCart = {
        success: true,
        data: {
          items: [
            {
              id: 'mock-expired-item',
              productName: '만료테스트상품',
              price: 29.99,
              quantity: 1,
              shippingFee: 0,
              timerEnabled: true,
              expiresAt: new Date(Date.now() - 60_000).toISOString(), // 1분 전 만료
              status: 'EXPIRED',
              total: 29.99,
            },
          ],
          itemCount: 1,
          subtotal: 29.99,
          totalShippingFee: 0,
          grandTotal: 29.99,
          earliestExpiration: new Date(Date.now() - 60_000).toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      await route.fulfill({ json: mockCart });
    });

    await safeGoto(page, '/cart');

    // 만료된 상품이 있으면 결제 버튼이 "만료된 상품이 있습니다" 텍스트로 비활성화
    const expiredMsg = await waitForText(page, '만료된 상품이 있습니다', 8_000);
    expect(expiredMsg, '만료 아이템 존재 시 결제 버튼이 비활성화 메시지를 표시해야 함').toBe(true);

    // 결제 버튼이 disabled 상태
    const checkoutBtn = page.getByText('만료된 상품이 있습니다', { exact: false }).first();
    const isDisabled = await checkoutBtn
      .evaluate((el) => {
        const btn = el.closest('button');
        return btn?.disabled ?? btn?.getAttribute('disabled') !== null;
      })
      .catch(() => true);
    expect(isDisabled).toBe(true);

    // 인터셉터 해제
    await page.unroute('**/api/cart');
  });

  test('3-4. 카트 타이머 만료 → handleCartExpired 호출 시 카트 재조회', async ({ page }) => {
    // CartTimer onExpired → fetchCart 재호출 검증
    // 시간 기반 모킹: 3.5초 전 = ACTIVE 아이템, 3.5초 후 = 빈 카트
    // (BottomTabBar도 /api/cart를 호출하므로 fetchCount 대신 시간으로 분기)

    const expiresAt = new Date(Date.now() + 3_000).toISOString(); // 3초 후 만료
    const switchAt = Date.now() + 3_500; // 3.5초 이후 요청은 빈 카트 반환

    await page.route('**/api/cart', async (route) => {
      if (Date.now() < switchAt) {
        // 만료 전: 3초 타이머가 있는 ACTIVE 아이템
        await route.fulfill({
          json: {
            success: true,
            data: {
              items: [
                {
                  id: 'mock-timer-item',
                  productName: '타이머테스트상품',
                  price: 19.99,
                  quantity: 1,
                  shippingFee: 0,
                  timerEnabled: true,
                  expiresAt,
                  status: 'ACTIVE',
                  total: 19.99,
                },
              ],
              itemCount: 1,
              subtotal: 19.99,
              totalShippingFee: 0,
              grandTotal: 19.99,
              earliestExpiration: expiresAt,
            },
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        // 만료 후: 빈 카트
        await route.fulfill({
          json: {
            success: true,
            data: { items: [], itemCount: 0, subtotal: 0, totalShippingFee: 0, grandTotal: 0 },
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    await safeGoto(page, '/cart');

    // 타이머 카운트다운이 표시되는지 확인 (CartTimer 컴포넌트)
    // earliestExpiration이 있으면 "예약 시간이 얼마 남지 않았습니다!" 경고 배너 표시
    const timerBanner = await waitForText(page, '예약 시간이 얼마 남지 않았습니다', 6_000);
    expect(timerBanner, '타이머 경고 배너가 표시되어야 함').toBe(true);

    // 3초 후 타이머 만료 → CartTimer가 "예약 시간 만료" 표시
    // (onExpired → handleCartExpired → fetchCart 재호출은 비동기로 발생)
    await page.waitForTimeout(4_000);
    const timerExpired = await waitForText(page, '예약 시간 만료', 5_000);
    expect(timerExpired, '타이머 만료 후 "예약 시간 만료" 표시가 나타나야 함').toBe(true);

    await page.unroute('**/api/cart');
  });
});

// ════════════════════════════════════════════════
// 4. admin/users — 일반 유저 접근 불가 (403)
// ════════════════════════════════════════════════
test.describe('4. admin/users — 일반 유저 접근 권한 검증', () => {
  test('4-1. buyer@test.com → /admin/users 접근 시 /403 리디렉트', async ({ page }) => {
    await page
      .goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: 12_000 })
      .catch(() => {});
    await page.waitForURL(/\/(403|login|profile\/register)/, { timeout: 8_000 });

    const url = page.url();
    expect(url).toMatch(/\/(403|login)/);
  });

  test('4-2. buyer@test.com → /admin (대시보드) 접근 시 /403 리디렉트', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await page.waitForURL(/\/(403|login)/, { timeout: 8_000 });

    const url = page.url();
    expect(url).toMatch(/\/(403|login)/);
  });

  test('4-3. 어드민 → /admin/users 정상 접근 및 테이블 표시', async ({ browser }) => {
    // 어드민 context — storageState 토큰이 만료됐을 수 있으므로 devLogin으로 갱신
    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await adminContext.newPage();

    try {
      await adminPage.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await devLogin(adminPage, 'ADMIN');
      await safeGoto(adminPage, '/admin/users');

      // /403 또는 /login으로 리디렉트되지 않아야 함
      expect(adminPage.url()).not.toContain('/403');
      expect(adminPage.url()).not.toContain('/login');

      // users 테이블이 표시됨
      const hasTable = await adminPage
        .locator('table, [role="table"], [role="grid"]')
        .first()
        .isVisible({ timeout: 8_000 })
        .catch(() => false);
      // 테이블 또는 유저 목록이 있음
      const hasUserList = hasTable || (await waitForText(adminPage, '이메일', 8_000));
      expect(hasUserList, '어드민 users 테이블이 표시되어야 함').toBe(true);
    } finally {
      await adminContext.close();
    }
  });

  test('4-4. 어드민 /admin/users — buyer@test.com 유저 조회', async ({ browser }) => {
    // 어드민 context — storageState 토큰이 만료됐을 수 있으므로 devLogin으로 갱신
    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await adminContext.newPage();

    try {
      await adminPage.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await devLogin(adminPage, 'ADMIN');
      await safeGoto(adminPage, '/admin/users');

      // 검색창에 buyer@test.com 입력
      const searchInput = adminPage.getByPlaceholder('인스타그램 ID 또는 이메일 검색...');
      await searchInput.waitFor({ timeout: 15_000 });
      await searchInput.fill('buyer@test.com');
      // debounce 300ms + API 응답 대기
      await adminPage.waitForTimeout(500);
      await adminPage.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

      // 유저 행이 표시됨
      const hasUser = await waitForText(adminPage, 'buyer@test.com', 10_000);
      expect(hasUser, 'buyer@test.com 유저가 어드민 users 테이블에 표시되어야 함').toBe(true);
    } finally {
      await adminContext.close();
    }
  });
});
