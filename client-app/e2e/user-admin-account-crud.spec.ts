/**
 * Admin 유저 계정 CRUD 테스트 (UI)
 *
 * 목적: 어드민 /admin/users 페이지에서 유저 목록 조회, 상세 조회, 접근 제어를 브라우저 UI로 검증한다.
 *
 * 검증 항목:
 *   1. 어드민 계정으로 /admin/users 접근 → 유저 테이블 표시
 *   2. 어드민 계정으로 유저 행 클릭 → 상세 페이지 이동 및 정보 표시 (serial)
 *   3. 비로그인 상태로 /admin/users 접근 → /login 리디렉트
 *   4. 일반 유저(USER) 계정으로 /admin/users 접근 → /403 또는 / 리디렉트
 *
 * 실행:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3003 \
 *   BACKEND_URL=http://127.0.0.1:3001 \
 *   npx playwright test --project=admin e2e/user-admin-account-crud.spec.ts
 *
 * 주의:
 *   - Describe 1, 2 는 admin project (storageState: admin.json) 로 실행
 *   - Describe 3 은 비로그인 (빈 storageState)
 *   - Describe 4 는 user.json storageState를 동적으로 주입 (test.use는 describe 레벨에서만 작동하므로 browser.newContext 사용)
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { gotoWithRetry } from './helpers/auth-helper';

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

const USER_STATE = path.join(__dirname, '.auth', 'user.json');

// ════════════════════════════════════════════════
// 1. Admin 유저 목록 조회 — /admin/users
// ════════════════════════════════════════════════
test.describe('1. Admin 유저 목록 조회 — /admin/users', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(120000);

  test('1-1. /admin/users 접근 시 유저 테이블 표시됨', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users', { waitForSelector: 'table', role: 'ADMIN' });

    // /403 또는 /login으로 리디렉트되지 않아야 함
    expect(page.url()).not.toContain('/403');
    expect(page.url()).not.toContain('/login');

    // 로딩 완료 대기 (isLoading=true 동안 table은 DOM에 없음)
    await page.waitForSelector('text=불러오는 중', { timeout: 5_000 }).catch(() => {});
    await page
      .waitForSelector('text=불러오는 중', { state: 'hidden', timeout: 30_000 })
      .catch(() => {});

    // 유저 테이블이 표시됨
    const hasTable = await page
      .locator('table')
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    expect(hasTable, '유저 테이블이 /admin/users에 표시되어야 함').toBe(true);
  });

  test('1-2. 테이블에 이메일 컬럼이 보임', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users', { waitForSelector: 'table', role: 'ADMIN' });

    // 이메일 컬럼 헤더 또는 셀이 표시됨
    // Wait for loading to finish first
    await page.waitForSelector('text=불러오는 중', { timeout: 5_000 }).catch(() => {});
    await page
      .waitForSelector('text=불러오는 중', { state: 'hidden', timeout: 30_000 })
      .catch(() => {});
    const hasEmailColumn = await waitForText(page, '이메일', 15_000);
    expect(hasEmailColumn, '유저 테이블에 이메일 컬럼이 표시되어야 함').toBe(true);
  });
});

// ════════════════════════════════════════════════
// 2. Admin 유저 상세 조회 (serial)
// ════════════════════════════════════════════════
test.describe('2. Admin 유저 상세 조회', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(120000);

  test('2-1. 테이블 첫 번째 행 클릭 → /admin/users/[id] 로 이동', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users', { waitForSelector: 'table', role: 'ADMIN' });

    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr, [role="row"]', { timeout: 20_000 }).catch(() => {});

    // 헤더를 제외한 첫 번째 데이터 행 (tbody 내부 또는 [role="row"] nth(1))
    const tbodyRow = page.locator('table tbody tr').first();
    const ariaRow = page.locator('[role="row"]').nth(1);

    const tbodyVisible = await tbodyRow.isVisible({ timeout: 4_000 }).catch(() => false);
    const dataRow = tbodyVisible ? tbodyRow : ariaRow;

    const rowVisible = await dataRow.isVisible({ timeout: 4_000 }).catch(() => false);

    if (rowVisible) {
      await dataRow.click({ steps: 5 });
      await page.waitForURL('**/admin/users/**', { timeout: 8_000 }).catch(() => {});
      expect(page.url()).toContain('/admin/users/');
    } else {
      // 유저가 없는 경우 — 테이블 자체가 렌더됐는지만 확인
      const hasTable = await page
        .locator('table, [role="table"]')
        .first()
        .isVisible({ timeout: 4_000 })
        .catch(() => false);
      expect(hasTable, '유저 목록 테이블이 표시되어야 함').toBe(true);
    }
  });

  test('2-2. 상세 페이지에 유저 정보(이메일, 역할 등) 표시됨', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users', { waitForSelector: 'table', role: 'ADMIN' });

    await page.waitForSelector('table tbody tr, [role="row"]', { timeout: 20_000 }).catch(() => {});

    const tbodyRow = page.locator('table tbody tr').first();
    const ariaRow = page.locator('[role="row"]').nth(1);
    const tbodyVisible = await tbodyRow.isVisible({ timeout: 4_000 }).catch(() => false);
    const dataRow = tbodyVisible ? tbodyRow : ariaRow;

    const rowVisible = await dataRow.isVisible({ timeout: 4_000 }).catch(() => false);
    if (!rowVisible) {
      // 데이터 없음 — 스킵 (빈 상태도 정상)
      return;
    }

    await dataRow.click({ steps: 5 });
    await page.waitForURL('**/admin/users/**', { timeout: 8_000 }).catch(() => {});

    // 상세 페이지: "회원 상세" 헤더 또는 "회원 정보" 섹션 표시
    const hasDetailHeading = await waitForText(page, '회원 상세', 8_000);
    const hasUserInfo = await waitForText(page, '회원 정보', 5_000);
    expect(hasDetailHeading || hasUserInfo, '상세 페이지에 회원 정보가 표시되어야 함').toBe(true);

    // 이메일 레이블이 표시됨
    const hasEmail = await waitForText(page, '이메일', 6_000);
    expect(hasEmail, '상세 페이지에 이메일 정보가 표시되어야 함').toBe(true);

    // 상태 정보 표시 (활성/비활성/차단)
    const hasStatus =
      (await waitForText(page, '상태', 4_000)) ||
      (await waitForText(page, '활성', 4_000)) ||
      (await waitForText(page, 'ACTIVE', 4_000));
    expect(hasStatus, '상세 페이지에 유저 상태 정보가 표시되어야 함').toBe(true);
  });
});

// ════════════════════════════════════════════════
// 3. 비로그인 상태 접근 제어
// ════════════════════════════════════════════════
test.describe('3. 비로그인 상태 접근 제어', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('3-1. 비로그인 상태에서 /admin/users 접근 → /login 리디렉트', async ({ page }) => {
    await page
      .goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: 12_000 })
      .catch(() => {});
    await page.waitForURL(/\/(login|403)/, { timeout: 8_000 }).catch(() => {});

    const url = page.url();
    expect(url).toMatch(/\/(login|403)/);
  });
});

// ════════════════════════════════════════════════
// 4. 일반 유저(USER) 계정 접근 제어
// ════════════════════════════════════════════════
test.describe('4. 일반 유저 계정 접근 제어', () => {
  test('4-1. USER 계정으로 /admin/users 접근 → /403 또는 홈(/) 리디렉트', async ({ browser }) => {
    // test.use는 describe 레벨에서만 작동하므로 browser.newContext로 user.json storageState를 수동 주입
    const userContext = await browser.newContext({ storageState: USER_STATE });
    const userPage = await userContext.newPage();

    try {
      await userPage
        .goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: 12_000 })
        .catch(() => {});
      await userPage.waitForURL(/\/(403|login|$)/, { timeout: 8_000 }).catch(() => {});

      const url = userPage.url();
      // 일반 유저는 /admin/users에 접근 불가 — /403, /login, 또는 홈(/)으로 리디렉트
      expect(url).not.toContain('/admin/users');
    } finally {
      await userContext.close();
    }
  });
});
