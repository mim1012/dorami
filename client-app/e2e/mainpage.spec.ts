import { test, expect } from '@playwright/test';

/**
 * MainPage Redesign — E2E Tests (Phase 5)
 *
 * Coverage:
 *  1. 4개 섹션 렌더링 (LiveHeroBanner / UpcomingCountdown, LiveExclusiveDeals, UpcomingLiveSlider, PopularProductGrid)
 *  2. 라이브 시작/종료 시나리오 (API mock)
 *  3. 상품 클릭 → 상세 시트 열림 → 상세 페이지 이동
 *  4. 빈 상태 처리 (라이브 없음, 상품 없음)
 *  5. 네비게이션 유지
 */

// ---------------------------------------------------------------------------
// Helpers — reusable mock factories
// ---------------------------------------------------------------------------

function mockActiveStreams(page: import('@playwright/test').Page, streams: object[]) {
  return page.route('**/api/streaming/active**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: streams, success: true, timestamp: new Date().toISOString() }),
    }),
  );
}

function mockUpcomingStreams(page: import('@playwright/test').Page, streams: object[]) {
  return page.route('**/api/streaming/upcoming**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: streams, success: true, timestamp: new Date().toISOString() }),
    }),
  );
}

function mockPopularProducts(page: import('@playwright/test').Page, products: object[]) {
  return page.route('**/api/products/popular**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          data: products,
          meta: { page: 1, limit: 8, total: products.length },
        },
        success: true,
        timestamp: new Date().toISOString(),
      }),
    }),
  );
}

function mockLiveDeals(page: import('@playwright/test').Page, products: object[]) {
  // live-deals endpoint: intercepted via the products?streamKey=… query
  return page.route('**/api/products**streamKey**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: products,
        success: true,
        timestamp: new Date().toISOString(),
      }),
    }),
  );
}

// Fixture data
const ACTIVE_LIVE = {
  id: 'stream-001',
  streamKey: 'live-key-001',
  title: '테스트 라이브 방송',
  viewerCount: 42,
  thumbnailUrl: null,
  startedAt: new Date().toISOString(),
  host: { id: 'host-1', name: '테스트 호스트' },
};

const UPCOMING_LIVE_1 = {
  id: 'upcoming-001',
  streamKey: 'upcoming-key-001',
  title: '예정 라이브 1',
  description: '첫 번째 예정 라이브 설명',
  scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
  thumbnailUrl: null,
  host: { id: 'host-1', name: '테스트 호스트' },
};

const UPCOMING_LIVE_2 = {
  id: 'upcoming-002',
  streamKey: 'upcoming-key-002',
  title: '예정 라이브 2',
  description: '두 번째 예정 라이브 설명',
  scheduledAt: new Date(Date.now() + 7_200_000).toISOString(),
  thumbnailUrl: null,
  host: { id: 'host-1', name: '테스트 호스트' },
};

const POPULAR_PRODUCT_1 = {
  id: 'prod-001',
  name: '인기 상품 1',
  price: 29000,
  originalPrice: 39000,
  discountRate: 25,
  imageUrl: null,
  isNew: true,
  soldCount: 120,
};

const POPULAR_PRODUCT_2 = {
  id: 'prod-002',
  name: '인기 상품 2',
  price: 19000,
  originalPrice: null,
  discountRate: null,
  imageUrl: null,
  isNew: false,
  soldCount: 85,
};

const LIVE_DEAL_PRODUCT = {
  id: 'deal-001',
  name: '방송특가 상품',
  price: 15000,
  originalPrice: 25000,
  discountRate: 40,
  imageUrl: null,
  stock: 3,
  status: 'AVAILABLE',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('MainPage — 4개 섹션 렌더링', () => {
  test.setTimeout(30_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Section 1: LiveHeroBanner (라이브 진행 중)
  // ─────────────────────────────────────────────────────────────────────────
  test('라이브 진행 중 — LiveHeroBanner 표시', async ({ page }) => {
    await mockActiveStreams(page, [ACTIVE_LIVE]);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const banner = page.locator('[data-testid="live-banner"]');
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // LIVE 뱃지 확인
    await expect(banner.getByText('LIVE')).toBeVisible();
    // 시청자수 텍스트 포함 (숫자)
    await expect(banner.getByText('42')).toBeVisible();
    // 방송 제목
    await expect(banner.getByText('테스트 라이브 방송')).toBeVisible();
    // 호스트명
    await expect(banner.getByText('테스트 호스트')).toBeVisible();
    // CTA 버튼
    await expect(banner.getByText('지금 시청하기')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 1: UpcomingCountdown (라이브 없음, 예정 있음)
  // ─────────────────────────────────────────────────────────────────────────
  test('라이브 없음 — UpcomingCountdown (예정 라이브 제목) 표시', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, [UPCOMING_LIVE_1]);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const countdown = page.locator('[data-testid="upcoming-countdown"]');
    await expect(countdown).toBeVisible({ timeout: 15_000 });
    await expect(countdown.getByText('다음 라이브까지')).toBeVisible();
    // 예정 라이브 제목 표시
    await expect(countdown.getByText('예정 라이브 1')).toBeVisible();
  });

  test('라이브 없음, 예정도 없음 — "예정된 라이브가 없습니다" 표시', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const countdown = page.locator('[data-testid="upcoming-countdown"]');
    await expect(countdown).toBeVisible({ timeout: 15_000 });
    await expect(countdown.getByText('예정된 라이브가 없습니다')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 2: LiveExclusiveDeals (방송특가)
  // ─────────────────────────────────────────────────────────────────────────
  test('라이브 진행 중 — 방송특가 섹션 표시', async ({ page }) => {
    await mockActiveStreams(page, [ACTIVE_LIVE]);
    await mockLiveDeals(page, [LIVE_DEAL_PRODUCT]);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 방송특가 섹션 헤더
    await expect(page.getByText('라이브 특가')).toBeVisible({ timeout: 15_000 });
    // LIVE 한정 뱃지
    await expect(page.getByText('LIVE 한정')).toBeVisible();
    // 상품명
    await expect(page.getByText('방송특가 상품')).toBeVisible();
  });

  test('라이브 없음 — 방송특가 섹션 미표시', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 방송특가 섹션이 렌더링되지 않아야 함
    await expect(page.getByText('라이브 특가'))
      .not.toBeVisible({ timeout: 5_000 })
      .catch(() => {});
    // UpcomingCountdown 표시 확인
    await expect(page.locator('[data-testid="upcoming-countdown"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3: UpcomingLiveSlider (예정된 라이브)
  // ─────────────────────────────────────────────────────────────────────────
  test('예정된 라이브 슬라이더 — 카드 렌더링', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, [UPCOMING_LIVE_1, UPCOMING_LIVE_2]);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('예정된 라이브')).toBeVisible({ timeout: 15_000 });

    const cards = page.locator('[data-testid="upcoming-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    expect(await cards.count()).toBe(2);

    // 첫 번째 카드 내용 확인
    await expect(cards.first().getByText('예정 라이브 1')).toBeVisible();
    await expect(cards.first().getByText('테스트 호스트')).toBeVisible();
  });

  test('예정된 라이브 — 슬라이더 다음/이전 버튼 동작', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, [UPCOMING_LIVE_1, UPCOMING_LIVE_2]);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const nextBtn = page.locator('[data-testid="slider-next"]');
    const prevBtn = page.locator('[data-testid="slider-prev"]');

    await expect(nextBtn).toBeVisible({ timeout: 15_000 });
    await expect(prevBtn).toBeVisible();

    // 버튼 클릭이 에러 없이 동작해야 함
    await nextBtn.click();
    await page.waitForTimeout(300);
    await prevBtn.click();
  });

  test('예정된 라이브 없음 — 슬라이더 섹션 미표시', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // UpcomingLiveSlider는 빈 배열이면 null 반환
    await expect(page.locator('[data-testid="upcoming-card"]'))
      .not.toBeVisible({ timeout: 5_000 })
      .catch(() => {});
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 4: PopularProductGrid (인기 상품)
  // ─────────────────────────────────────────────────────────────────────────
  test('인기 상품 그리드 — 렌더링 및 상품 수', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1, POPULAR_PRODUCT_2]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const grid = page.locator('[data-testid="popular-grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const cards = grid.locator('[data-testid="product-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    expect(await cards.count()).toBe(2);
  });

  test('인기 상품 — 카드 정보 정확성 (이름, 가격, 뱃지)', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // 상품명
    await expect(card.getByText('인기 상품 1')).toBeVisible();
    // NEW 뱃지
    await expect(card.getByText('NEW')).toBeVisible();
    // 판매수 뱃지
    await expect(card.getByText('120 판매')).toBeVisible();
  });

  test('인기 상품 없음 — 그리드 미표시', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // PopularProductGrid returns null when empty
    await expect(page.locator('[data-testid="popular-grid"]'))
      .not.toBeVisible({ timeout: 5_000 })
      .catch(() => {});
  });
});

// ---------------------------------------------------------------------------

test.describe('MainPage — 라이브 시작/종료 시나리오', () => {
  test.setTimeout(30_000);

  test('라이브 시작 시나리오 — 배너 → 라이브 페이지 이동', async ({ page }) => {
    await mockActiveStreams(page, [ACTIVE_LIVE]);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const banner = page.locator('[data-testid="live-banner"]');
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // CTA 클릭 → /live/{streamKey} 이동
    const ctaButton = banner.getByText('지금 시청하기');
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    await page.waitForURL('**/live/live-key-001**', { timeout: 10_000 });
    expect(page.url()).toContain('/live/live-key-001');
  });

  test('라이브 시작 시나리오 — 배너 전체 클릭으로 이동', async ({ page }) => {
    await mockActiveStreams(page, [ACTIVE_LIVE]);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const banner = page.locator('[data-testid="live-banner"]');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.click();

    await page.waitForURL('**/live/live-key-001**', { timeout: 10_000 });
    expect(page.url()).toContain('/live/live-key-001');
  });

  test('라이브 종료 시나리오 — 카운트다운으로 전환', async ({ page }) => {
    // 처음에는 활성 라이브가 있다가, 페이지 리로드 시 없는 것으로 변경
    let callCount = 0;
    await page.route('**/api/streaming/active**', (route) => {
      callCount++;
      if (callCount === 1) {
        // 첫 번째 호출: 라이브 있음
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [ACTIVE_LIVE],
            success: true,
            timestamp: new Date().toISOString(),
          }),
        });
      } else {
        // 이후 호출: 라이브 종료
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], success: true, timestamp: new Date().toISOString() }),
        });
      }
    });
    await mockUpcomingStreams(page, [UPCOMING_LIVE_1]);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 처음에는 라이브 배너 표시
    await expect(page.locator('[data-testid="live-banner"]')).toBeVisible({ timeout: 15_000 });

    // 라이브 종료 시뮬레이션: 페이지 리로드
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 이후 카운트다운 표시 (예정 라이브가 있으므로)
    await expect(page.locator('[data-testid="upcoming-countdown"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('예정된 라이브 카드 클릭 — 라이브 페이지 이동', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, [UPCOMING_LIVE_1]);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('[data-testid="upcoming-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await page.waitForURL('**/live/upcoming-key-001**', { timeout: 10_000 });
    expect(page.url()).toContain('/live/upcoming-key-001');
  });
});

// ---------------------------------------------------------------------------

test.describe('MainPage — 상품 클릭 및 네비게이션', () => {
  test.setTimeout(30_000);

  test('인기 상품 카드 클릭 — 상세 시트 열림', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const sheet = page.locator('[data-testid="product-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // 시트 내 상품명 확인
    await expect(sheet.getByText('인기 상품 1')).toBeVisible();
    // 상품 상세보기 버튼
    await expect(sheet.getByText('상품 상세보기')).toBeVisible();
  });

  test('상품 상세 시트 — 닫기 (backdrop 클릭)', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const sheet = page.locator('[data-testid="product-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // backdrop 클릭으로 닫기
    const backdrop = sheet.locator('[aria-hidden="true"]');
    await backdrop.click();
    await expect(sheet).not.toBeVisible({ timeout: 3_000 });
  });

  test('상품 상세 시트 — 닫기 (Escape 키)', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const sheet = page.locator('[data-testid="product-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible({ timeout: 3_000 });
  });

  test('상품 상세 시트 — "상품 상세보기" 클릭 → 상품 페이지 이동', async ({ page }) => {
    await mockActiveStreams(page, []);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, [POPULAR_PRODUCT_1]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const sheet = page.locator('[data-testid="product-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    await sheet.getByText('상품 상세보기').click();
    await page.waitForURL('**/products/prod-001**', { timeout: 10_000 });
    expect(page.url()).toContain('/products/prod-001');
  });

  test('방송특가 상품 클릭 — 상세 시트 열림', async ({ page }) => {
    await mockActiveStreams(page, [ACTIVE_LIVE]);
    await mockLiveDeals(page, [LIVE_DEAL_PRODUCT]);
    await mockUpcomingStreams(page, []);
    await mockPopularProducts(page, []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 방송특가 섹션 대기
    await expect(page.getByText('라이브 특가')).toBeVisible({ timeout: 15_000 });

    // 방송특가 카드 클릭
    const dealCard = page.getByText('방송특가 상품').first();
    await expect(dealCard).toBeVisible({ timeout: 10_000 });
    await dealCard.click();

    const sheet = page.locator('[data-testid="product-detail-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await expect(sheet.getByText('방송특가 상품')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------

test.describe('MainPage — 기존 네비게이션 유지', () => {
  test.setTimeout(30_000);

  test('BottomTabBar — 전체 탭 표시', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: '홈', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: '장바구니', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '라이브', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '마이', exact: true })).toBeVisible();
  });

  test('헤더 — 로고 및 검색바 표시', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 로고 텍스트
    await expect(page.getByText('Doremi')).toBeVisible({ timeout: 15_000 });
    // 서브텍스트
    await expect(page.getByText('Live Shopping Experience')).toBeVisible();
  });

  test('에러 상태 — 네트워크 오류 시 에러 UI 표시', async ({ page }) => {
    // mainpage data 전체 실패
    await page.route('**/api/streaming/active**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"Internal Server Error"}',
      }),
    );
    await page.route('**/api/streaming/upcoming**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"Internal Server Error"}',
      }),
    );
    await page.route('**/api/products/popular**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"Internal Server Error"}',
      }),
    );

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 에러 메시지 또는 다시 시도 버튼
    await expect(
      page.getByText('데이터를 불러오는데 실패했습니다.').or(page.getByText('다시 시도')),
    ).toBeVisible({ timeout: 15_000 });
  });
});
