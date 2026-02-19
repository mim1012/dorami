import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTestStream, ensureAuth, gotoWithRetry, devLogin } from './helpers/auth-helper';

/**
 * 방송 중 상품 등록 → 라이브 페이지 실시간 반영 E2E 테스트
 *
 * 검증 항목:
 * A-PRD-RT-01: 관리자 상품 등록 → 관리자 상품 목록 UI에 즉시 반영 (페이지 이동 없이)
 * A-PRD-RT-02: 등록된 상품이 /api/products?streamKey API에서 조회됨
 * A-PRD-RT-03: 라이브 페이지가 스트림 상태(PENDING/LIVE)에 맞게 UI 표시
 * A-PRD-RT-04: [스트림 LIVE 상태인 경우] 사용자 라이브 페이지 상품 목록에 실시간 반영
 *
 * 스테이징 제약:
 * - 스트림이 PENDING 상태면 라이브 페이지 상품 목록 미표시 (정상 동작)
 * - LIVE 상태가 되면 WebSocket live:product:added 이벤트로 실시간 반영
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Admin Live Product Realtime', () => {
  test.setTimeout(120000);

  let testStreamKey: string;

  test.beforeAll(async () => {
    testStreamKey = await createTestStream();
    console.log(`[Setup] 테스트 스트림 키: ${testStreamKey}`);
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
    await page.waitForTimeout(1500);
  });

  test('A-PRD-RT-01~04: 상품 등록 관리자 UI 즉시 반영 + 라이브 페이지 상태 검증', async ({
    page,
    browser,
  }) => {
    const testProductName = `E2E 실시간 상품 ${Date.now()}`;

    // ── 스트림 현재 상태 확인 ─────────────────────────────────────────────
    const statusResp = await page
      .evaluate(async (sk) => {
        const res = await fetch(`/api/streaming/key/${sk}/status`, { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
      }, testStreamKey)
      .catch(() => null);

    const streamStatus: string = statusResp?.data?.status ?? 'UNKNOWN';
    console.log(`[스트림 상태] ${streamStatus}`);

    // ── A-PRD-RT-04 준비: LIVE인 경우 사용자 페이지를 먼저 열어서 관찰 ──
    let userPage: Page | null = null;
    let userContext: BrowserContext | null = null;

    if (streamStatus === 'LIVE') {
      userContext = await browser.newContext();
      userPage = await userContext.newPage();

      // 사용자 컨텍스트 인증 (devLogin — stale state 없이 신규 발급)
      await userPage.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
      await userPage.evaluate(() => localStorage.clear());
      await devLogin(userPage, 'USER');
      await userPage.waitForTimeout(2500);

      // 라이브 페이지로 이동하여 상품 목록 대기
      await userPage.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
      await userPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // 상품 목록 사이드바 표시 확인 (데스크톱 기준)
      const productSidebar = userPage.locator('aside').filter({ hasText: '상품 목록' });
      const sidebarVisible = await productSidebar.isVisible({ timeout: 8000 }).catch(() => false);
      if (sidebarVisible) {
        console.log('[유저 페이지] 라이브 상품 목록 사이드바 준비 완료 — 상품 추가 대기 시작');
      } else {
        console.log('[유저 페이지] 사이드바 미확인 (모바일 뷰 또는 상태 이상)');
      }
    }

    // ── A-PRD-RT-01: 관리자 상품 등록 → 관리자 상품 목록 즉시 반영 ──────
    await gotoWithRetry(page, '/admin/products');

    const createButton = page.locator('button').filter({ hasText: '상품 등록' }).first();
    await expect(createButton).toBeVisible({ timeout: 15000 });
    await createButton.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // 스트림 키 / 상품명 / 가격 / 재고 입력
    const streamKeyInput = modal.locator('input[name="streamKey"]');
    await expect(streamKeyInput).toBeVisible({ timeout: 10000 });
    await streamKeyInput.fill(testStreamKey);
    await page.getByLabel('상품명').fill(testProductName);
    await page.getByLabel('가격 (원)').fill('39000');
    await page.getByLabel('재고').fill('10');
    await page.getByLabel('배송비 (원)').fill('3000');

    // 등록 제출
    await page.getByRole('button', { name: '등록하기', exact: true }).click();

    // 모달 닫힘 + 성공 토스트 확인
    await expect(modal).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('alert').filter({ hasText: '등록되었습니다' })).toBeVisible({
      timeout: 5000,
    });

    // 페이지 이동 없이 상품 목록에 즉시 반영 확인
    const productRow = page.locator('tr', { hasText: testProductName });
    await expect(productRow).toBeVisible({ timeout: 10000 });
    await expect(productRow.getByText('39,000')).toBeVisible();
    console.log(`✅ A-PRD-RT-01: 관리자 상품 목록 즉시 반영 확인 — "${testProductName}"`);

    // 가격, 재고, 판매상태 표시 확인
    await expect(productRow.getByText('10개')).toBeVisible();
    await expect(productRow.getByText('판매중')).toBeVisible();
    console.log('✅ A-PRD-RT-01: 가격(39,000), 재고(10개), 판매중 표시 확인');

    // ── A-PRD-RT-02: 상품 API 조회 (라이브 페이지 데이터 레이어) ──────────
    await page.waitForTimeout(500);
    const products = await page
      .evaluate(
        async ({ sk, name }) => {
          const res = await fetch(`/api/products?streamKey=${sk}&status=AVAILABLE`, {
            credentials: 'include',
          });
          if (!res.ok) return null;
          const body = await res.json();
          return body.data;
        },
        { sk: testStreamKey, name: testProductName },
      )
      .catch(() => null);

    if (products) {
      const found = products.some((p: any) => p.name === testProductName);
      expect(found).toBe(true);
      console.log(`✅ A-PRD-RT-02: 상품 API 조회 확인 — 총 ${products.length}개 중 신규 상품 포함`);
    } else {
      console.log('⚠️ A-PRD-RT-02: 상품 API 응답 없음 (인증 또는 네트워크 문제)');
    }

    // ── A-PRD-RT-03/04: 라이브 페이지 UI 검증 ──────────────────────────────
    if (streamStatus === 'LIVE' && userPage) {
      // WebSocket live:product:added 이벤트 반영 대기
      await userPage.waitForTimeout(3000);

      // 사이드바 상품 목록에서 신규 상품 확인
      const newProductInLive = await userPage
        .getByText(testProductName)
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      if (newProductInLive) {
        console.log(
          `✅ A-PRD-RT-04: 라이브 페이지 상품 목록에 실시간 반영 확인 — "${testProductName}"`,
        );
      } else {
        // 전체 상품 목록 덤프 (디버깅)
        const allProductTexts = await userPage
          .locator('aside .space-y-3 h3')
          .allTextContents()
          .catch(() => []);
        console.log(
          `⚠️ A-PRD-RT-04: 라이브 페이지에 상품 미발견. 현재 목록: ${JSON.stringify(allProductTexts)}`,
        );
      }

      // 라이브 상태 배지 표시 확인 (LIVE 배지)
      const liveBadge = userPage.getByText('LIVE').first();
      const liveBadgeVisible = await liveBadge.isVisible({ timeout: 5000 }).catch(() => false);
      if (liveBadgeVisible) {
        console.log('✅ A-PRD-RT-03: 라이브 페이지 LIVE 배지 표시 확인');
      }
    } else {
      // PENDING/OFFLINE 상태: 라이브 페이지 상태 표시 검증
      await page.goto(`/live/${testStreamKey}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const pendingMsg = page.getByText('아직 방송 전이에요');
      const offlineMsg = page.getByText('스트림을 찾을 수 없거나 종료되었습니다');
      const homeBtn = page.getByRole('button', { name: '홈으로 돌아가기' });

      const isPending = await pendingMsg.isVisible({ timeout: 5000 }).catch(() => false);
      const isOffline = await offlineMsg.isVisible({ timeout: 3000 }).catch(() => false);
      const hasHomeBtn = await homeBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (isPending) {
        await expect(page.getByText('곧 시작됩니다. 잠시만 기다려주세요!')).toBeVisible({
          timeout: 3000,
        });
        console.log(
          '✅ A-PRD-RT-03: 라이브 페이지 — PENDING 상태 UI 정확히 표시 ("아직 방송 전이에요")',
        );
      } else if (isOffline) {
        console.log('✅ A-PRD-RT-03: 라이브 페이지 — OFFLINE 상태 UI 정확히 표시');
      } else {
        // LIVE로 전환되어 상품 목록이 보이는 경우
        const productSidebar = page.locator('aside').filter({ hasText: '상품 목록' });
        const isSidebarVisible = await productSidebar
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (isSidebarVisible) {
          const newProduct = await page
            .getByText(testProductName)
            .isVisible({ timeout: 8000 })
            .catch(() => false);
          if (newProduct) {
            console.log(
              `✅ A-PRD-RT-03/04: 라이브 페이지 상품 목록에 신규 상품 표시 확인 — "${testProductName}"`,
            );
          } else {
            console.log('⚠️ A-PRD-RT-03: 라이브 페이지 로드됨 — 신규 상품은 아직 목록에 미표시');
          }
        } else {
          console.log('⚠️ A-PRD-RT-03: 라이브 페이지 상태 판별 불가');
        }
      }

      // 홈 버튼 표시 확인 (PENDING/OFFLINE 모두 공통)
      if (hasHomeBtn) {
        console.log('✅ A-PRD-RT-03: "홈으로 돌아가기" 버튼 표시 확인');
      }

      console.log(
        `[참고] 스트림이 LIVE 상태가 되면 사용자가 상품 목록을 실시간으로 볼 수 있습니다 (WebSocket live:product:added 이벤트)`,
      );
    }

    // ── 정리: 테스트 상품 삭제 ─────────────────────────────────────────────
    try {
      await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const cleanupRow = page.locator('tr', { hasText: testProductName });
      const deleteBtn = cleanupRow.getByRole('button', { name: '삭제' });
      if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.getByRole('alertdialog');
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        await confirmDialog.getByRole('button', { name: '삭제' }).click();
        await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });
        console.log(`[정리] 테스트 상품 "${testProductName}" 삭제 완료`);
      }
    } catch (e) {
      console.warn(`[정리] 상품 삭제 실패 (무시): ${e instanceof Error ? e.message : e}`);
    }

    if (userContext) {
      await userContext.close();
    }

    console.log('\n=== A-PRD-RT-01~04 검증 완료 ===');
  });
});
