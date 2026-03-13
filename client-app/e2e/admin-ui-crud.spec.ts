/**
 * Admin UI CRUD Tests
 *
 * 목적: 어드민 UI 폼을 직접 조작하여 CRUD 동작을 검증
 *   - 버튼 클릭 → 모달/폼 열림 → 입력 → 저장 → 목록 반영
 *
 * 검증 항목:
 *   1. 상품 등록/수정/삭제 (UI 폼)   — /admin/products
 *   2. 방송 키 발급 (UI 폼)           — /admin/broadcasts
 *   3. 공지사항 등록/삭제 (UI 폼)    — /admin/settings
 *
 * 실행:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3003 \
 *   BACKEND_URL=http://127.0.0.1:3001 \
 *   npx playwright test --project=admin e2e/admin-ui-crud.spec.ts
 */
import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers/auth-helper';

// Force all describe blocks in this file to run serially on one worker
// to prevent concurrent devLogin calls for the same admin account
test.describe.configure({ mode: 'serial' });

const TS = Date.now();

// ─────────────────────────────────────────────
// 공통 헬퍼
// ─────────────────────────────────────────────

/** Known Issue #3: navigation timeout fallback */
async function safeGoto(page: import('@playwright/test').Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch {
    const title = await page.title().catch(() => '');
    if (!title) throw new Error(`Navigation failed: ${url}`);
  }
  await page.waitForSelector('main, [role="main"], h1, h2', { timeout: 15_000 }).catch(() => {});
}

/** Known Issue #2/#4: text wait with SPA fallback */
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

/** Wait for modal to open by checking dialog/modal selector */
async function waitForModal(
  page: import('@playwright/test').Page,
  titleText: string,
): Promise<void> {
  await page.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 6_000 }).catch(() => {});
  await waitForText(page, titleText, 5_000);
}

// ════════════════════════════════════════════════
// 1. 상품 CRUD — /admin/products
// ════════════════════════════════════════════════
test.describe.serial('1. 상품 UI CRUD — /admin/products', () => {
  test.setTimeout(240000);
  const productName = `UI_상품_${TS}`;

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('1-1. 상품 등록 폼 → 등록 → 목록 노출', async ({ page }) => {
    await safeGoto(page, '/admin/products');
    // Wait directly for the button — handles both fast and slow loading
    await page
      .getByText('상품 등록', { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 90_000 });

    // 상품 등록 버튼 클릭 (v1.57: steps:5 for human-like mouse)
    await page.getByText('상품 등록', { exact: true }).first().click({ steps: 5 });
    await waitForModal(page, '상품 등록');

    // 상품명 입력
    await page.getByPlaceholder('예: 프리미엄 무선 이어폰').fill(productName);

    // 가격 입력
    await page.getByPlaceholder('29000').fill('45000');

    // 재고 입력
    await page.getByPlaceholder('50').fill('30');

    // "등록하기" 버튼 클릭
    await page.getByText('등록하기', { exact: true }).click({ steps: 5 });

    // 등록 후 목록에 상품 등장 대기 (loading 완료 포함)
    const appeared = await waitForText(page, productName, 60_000);
    expect(appeared).toBe(true);
  });

  test('1-2. 등록된 상품 수정', async ({ page }) => {
    await safeGoto(page, '/admin/products');

    // 목록에서 방금 생성된 상품 행의 편집 버튼 찾기 (loading 완료 대기 겸용)
    const row = page.locator('tr, [role="row"]').filter({ hasText: productName }).first();
    await row.waitFor({ timeout: 90_000 }).catch(() => {});

    // 편집 버튼 — title="수정" 속성으로 직접 찾기 (drag handle과 구분)
    const editBtn = row.locator('button[title="수정"]').first();
    await editBtn.scrollIntoViewIfNeeded().catch(() => {});
    await editBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await editBtn.click({ steps: 5 });

    await waitForModal(page, '상품 수정');

    // 상품명에 수정 텍스트 추가
    const nameInput = page.getByPlaceholder('예: 프리미엄 무선 이어폰');
    await nameInput.clear();
    await nameInput.fill(`${productName}_수정`);

    // "수정하기" 클릭
    await page.getByText('수정하기', { exact: true }).click({ steps: 5 });

    const updated = await waitForText(page, `${productName}_수정`, 30_000);
    expect(updated).toBe(true);
  });

  test('1-3. 등록된 상품 삭제', async ({ page }) => {
    // describe-level timeout 240000 사용 (beforeEach ensureAuth ~60s 포함)
    await safeGoto(page, '/admin/products');

    // 수정된 상품명 또는 원본 이름 찾기 (loading 완료 대기 겸용)
    const targetName = `${productName}_수정`;
    const row = page.locator('tr, [role="row"]').filter({ hasText: targetName }).first();
    const fallbackRow = page.locator('tr, [role="row"]').filter({ hasText: productName }).first();

    const targetRow = (await row.isVisible({ timeout: 30_000 }).catch(() => false))
      ? row
      : fallbackRow;
    await targetRow.waitFor({ timeout: 30_000 }).catch(() => {});

    // 삭제 버튼 — title="삭제" 속성으로 직접 찾기
    const deleteBtn = targetRow.locator('button[title="삭제"]').first();
    await deleteBtn.scrollIntoViewIfNeeded().catch(() => {});
    await deleteBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await deleteBtn.click({ steps: 5 });

    // ConfirmDialog (role="alertdialog") 나타날 때까지 대기
    await page.waitForSelector('[role="alertdialog"]', { timeout: 6_000 });
    // 500ms: 애니메이션 + useEffect auto-focus 완료 대기
    await page.waitForTimeout(500);

    // DELETE API 응답 캡처 (confirm 클릭 전에 등록하여 경쟁 조건 방지)
    const deletePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/products/') && resp.request().method() === 'DELETE',
      { timeout: 15_000 },
    );

    // force: true — Playwright 위치 검사 우회 + 올바른 포인터 이벤트 디스패치 (React 합성 이벤트 호환)
    await page.locator('[role="alertdialog"] button').last().click({ force: true });

    // DELETE API 완료 대기 및 상태 코드 검증 (204 = No Content = 성공)
    const deleteResp = await deletePromise;
    expect(deleteResp.status()).toBe(204);

    // 다이얼로그 닫힘 대기
    await page.waitForSelector('[role="alertdialog"]', { state: 'detached', timeout: 10_000 });

    // handleDelete → fetchProducts() 완료 후 목록에서 사라짐 확인
    // expect().toHaveCount() 는 Playwright 자동 재시도 — fetchProducts 비동기 완료까지 대기
    await expect(page.getByText(targetName, { exact: false })).toHaveCount(0, { timeout: 20_000 });
  });
});

// ════════════════════════════════════════════════
// 2. 방송 키 발급 — /admin/broadcasts
// ════════════════════════════════════════════════
test.describe.serial('2. 방송 키 발급 UI — /admin/broadcasts', () => {
  test.setTimeout(200000);
  const streamTitle = `UI_라이브_${TS}`;

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('2-1. 방송 키 발급 폼 → 발급 → Step 2 완료 확인', async ({ page }) => {
    await safeGoto(page, '/admin/broadcasts');

    // "방송 키 발급" 버튼 클릭
    await page.getByText('방송 키 발급', { exact: true }).first().click({ steps: 5 });

    // Step 1 모달 열림 대기 ("방송 시작하기" 헤더)
    await waitForModal(page, '방송 시작하기');

    // 방송 제목 입력
    await page.getByPlaceholder('예: 오늘의 라이브 방송').fill(streamTitle);

    // 방송 예정일 설정 (내일 14:00 KST)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    await page
      .locator('input[type="datetime-local"]')
      .fill(dateStr)
      .catch(() => {});

    // "발급하기" 버튼 클릭
    await page.getByText('발급하기', { exact: true }).click({ steps: 5 });

    // Step 2 결과 화면: "스트림 키 발급 완료" 헤더
    const step2Visible = await waitForText(page, '스트림 키 발급 완료', 15_000);
    expect(step2Visible).toBe(true);

    // 스트림 키 텍스트가 화면에 있는지 확인
    const hasStreamKey = await waitForText(page, 'doremi-', 5_000);
    expect(hasStreamKey).toBe(true);
  });

  test('2-2. 방송 목록에 생성된 방송 노출', async ({ page }) => {
    await safeGoto(page, '/admin/broadcasts');

    // Wait directly for stream title to appear (handles loading state automatically)
    const inList = await waitForText(page, streamTitle, 60_000);
    expect(inList).toBe(true);
  });
});

// ════════════════════════════════════════════════
// 3. 공지사항 CRUD — /admin/settings
// ════════════════════════════════════════════════
test.describe.serial('3. 공지사항 UI CRUD — /admin/settings', () => {
  test.setTimeout(200000);
  const noticeTitle = `UI_공지_${TS}`;
  const noticeContent = `UI 테스트로 등록된 공지입니다. ${TS}`;

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('3-1. 공지 등록 폼 → 등록 → 목록 노출', async ({ page }) => {
    await safeGoto(page, '/admin/settings');

    // Wait for settings to fully load (sidebar h1 "DoremiLive" always exists; wait for page content h1)
    await page.waitForSelector('text=시스템 설정', { timeout: 90_000 }).catch(() => {});

    // Expand the 공지 목록 관리 accordion section (closed by default)
    // NoticeListManagement (title/content CRUD) is in "공지 목록 관리", not "공지 작성 관리"
    const sectionHeader = page.getByRole('button', { name: /공지 목록 관리/ });
    await sectionHeader.waitFor({ timeout: 15_000 });
    await sectionHeader.click({ steps: 3 });

    // 공지 제목 입력
    const titleInput = page.getByPlaceholder('공지 제목을 입력하세요');
    await titleInput.waitFor({ timeout: 10_000 });
    await titleInput.fill(noticeTitle);

    // 공지 내용 입력 (rows="5" textarea 특정)
    await page.locator('textarea[rows="5"]').fill(noticeContent);

    // 카테고리: 버튼 형식 (IMPORTANT = '중요')
    await page.getByText('중요', { exact: true }).first().click({ steps: 5 });

    // "등록" 버튼 클릭 (정확히 "등록" — "수정 완료"와 구분)
    await page.getByText('등록', { exact: true }).click({ steps: 5 });

    // 목록에 공지 등장 대기 (re-fetch 포함)
    const appeared = await waitForText(page, noticeTitle, 30_000);
    expect(appeared).toBe(true);
  });

  test('3-2. 등록된 공지 삭제', async ({ page }) => {
    await safeGoto(page, '/admin/settings');

    // Expand 공지 목록 관리 section (closed by default)
    await page.waitForSelector('text=시스템 설정', { timeout: 90_000 }).catch(() => {});
    const sectionHeader2 = page.getByRole('button', { name: /공지 목록 관리/ });
    await sectionHeader2.waitFor({ timeout: 15_000 });
    await sectionHeader2.click({ steps: 3 });

    // 공지 목록 <li> 에서 해당 공지 찾기
    const noticeRow = page.locator('li').filter({ hasText: noticeTitle }).first();
    await noticeRow.waitFor({ timeout: 10_000 });

    // 삭제 버튼: aria-label="삭제" (Trash2 아이콘 버튼)
    await noticeRow.locator('[aria-label="삭제"]').click({ steps: 5 });

    // ConfirmDialog는 role="alertdialog" — 나타날 때까지 대기
    await page.waitForSelector('[role="alertdialog"]', { timeout: 6_000 });

    // alertdialog 내부의 확인 버튼 (마지막 버튼 = 확인, 첫 번째 = 취소)
    await page.locator('[role="alertdialog"] button').last().click({ steps: 5 });

    // 삭제 후 목록에서 사라짐 확인
    await page.waitForTimeout(1_500);
    const stillExists = await waitForText(page, noticeTitle, 3_000);
    expect(stillExists).toBe(false);
  });
});
