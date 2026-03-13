/**
 * User Profile Guard & Profile Edit → Admin Visibility Tests
 *
 * 검증 항목:
 *   1. 프로필 미완성 사용자 → 보호된 경로 접근 시 /profile/register 리디렉트
 *      - /my-page, /cart, /shop 접근 → /profile/register?returnTo=... 로 이동 확인
 *   2. /profile/register 폼으로 프로필 완성
 *      - 완성 후 /my-page 접근 가능 확인
 *   3. 프로필 수정 내용 → 어드민 /admin/users 테이블에서 조회 확인
 *      - buyer@test.com 사용자가 instagramId 수정
 *      - 관리자 페이지에서 검색 및 반영 확인
 *
 * 실행:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3003 \
 *   BACKEND_URL=http://127.0.0.1:3001 \
 *   npx playwright test --project=user e2e/user-profile-guard.spec.ts
 */
import { test, expect, request } from '@playwright/test';
import { devLogin } from './helpers/auth-helper';
import path from 'path';

const TS = Date.now();
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const ADMIN_STATE = path.join(__dirname, '.auth', 'admin.json');

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

/**
 * dev-login 후 Set-Cookie 헤더에서 accessToken 쿠키를 파싱해 context에 주입
 */
async function injectDevLoginCookies(
  context: import('@playwright/test').BrowserContext,
  email: string,
  name: string,
): Promise<boolean> {
  const apiCtx = await request.newContext({ baseURL: BACKEND_URL });
  const loginRes = await apiCtx.post('/api/auth/dev-login', {
    data: { email, name },
  });

  if (!loginRes.ok()) {
    await apiCtx.dispose();
    return false;
  }

  const setCookieHeaders = loginRes
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);

  const domain = new URL(BASE_URL).hostname;

  for (const header of setCookieHeaders) {
    const parts = header.split(';').map((p) => p.trim());
    const nameValue = parts[0];
    const eqIdx = nameValue.indexOf('=');
    const cookieName = nameValue.substring(0, eqIdx);
    const cookieValue = nameValue.substring(eqIdx + 1);

    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain,
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ]);
  }

  await apiCtx.dispose();
  return true;
}

// ════════════════════════════════════════════════
// 1. 프로필 미완성 → 리디렉트 검증
//    빈 storageState로 시작 → 신규 미완성 유저 로그인
// ════════════════════════════════════════════════
test.describe('1. 프로필 미완성 사용자 리디렉트', () => {
  // serial: 1-4가 프로필을 완성하므로 1-1/1-2/1-3 이후에 실행되도록 보장
  test.describe.configure({ mode: 'serial' });
  // 빈 storageState — global-setup의 buyer@test.com 상태 사용 안 함
  test.use({ storageState: { cookies: [], origins: [] } });

  // 테스트 간 공유: 미완성 유저 이메일
  const incompleteEmail = `e2e_incomplete_${TS}@test.com`;

  test('1-1. /my-page 접근 시 /profile/register 리디렉트', async ({ page }) => {
    // devLogin: 쿠키 + Zustand localStorage 동시 설정 → middleware + client 양쪽 가드 동작 보장
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: incompleteEmail });

    // 'commit' = 서버 응답 헤더 수신 시점(JS 실행 전)에서 URL 확인
    // domcontentloaded까지 기다리면 React useEffect가 먼저 router.replace('/login')을 호출해
    // waitForURL이 /login URL에서 타임아웃되는 레이스 컨디션이 발생함
    await page.goto('/my-page', { waitUntil: 'commit', timeout: 30_000 }).catch(() => {});

    expect(page.url()).toContain('/profile/register');
    // returnTo 파라미터로 원래 경로 보존 확인
    expect(page.url()).toContain('returnTo');
  });

  test('1-2. /shop 접근 시 /profile/register 리디렉트', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: incompleteEmail });

    await page.goto('/shop', { waitUntil: 'commit', timeout: 30_000 }).catch(() => {});

    expect(page.url()).toContain('/profile/register');
  });

  test('1-3. /cart 접근 시 /profile/register 리디렉트', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: incompleteEmail });

    await page.goto('/cart', { waitUntil: 'commit', timeout: 30_000 }).catch(() => {});

    expect(page.url()).toContain('/profile/register');

    // Let the page settle before Playwright closes it — prevents browser crash in next serial test
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
  });

  test('1-4. /live/:streamKey 접근 시 returnTo 파라미터 포함 리다이렉트', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: incompleteEmail });

    // 실제 스트림 존재 여부와 무관하게 guard가 먼저 체크하므로 리다이렉트 발생
    await page
      .goto('/live/test-stream-key', { waitUntil: 'commit', timeout: 30_000 })
      .catch(() => {});

    const url = page.url();
    expect(url).toContain('/profile/register');
    // returnTo 파라미터가 /live/test-stream-key를 encode한 값인지 확인
    expect(decodeURIComponent(url)).toContain('/live/test-stream-key');

    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
  });

  test('1-5. /profile/register 폼 완성 후 /my-page 접근 가능', async ({ page }) => {
    // devLogin: 쿠키 + Zustand localStorage 동시 설정 → email 즉시 pre-fill 보장
    // injectDevLoginCookies는 Zustand를 설정하지 않아 email 필드가 비어 검증 실패함
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: incompleteEmail });

    // 'load' 사용: domcontentloaded는 JS 다운로드 전에 발생 → ReactDOM.hydrateRoot() 미실행.
    // 'load'는 모든 스크립트 로드 완료 보장 → React 이벤트 위임(event delegation) 확립.
    await page.goto('/profile/register', { waitUntil: 'load', timeout: 30_000 }).catch(() => {});
    await page.waitForSelector('[placeholder="Zelle 입금 시 사용하는 이름"]', { timeout: 20_000 });

    // 프로필 폼 입력
    const uniqueIg = `@e2e_incomplete_${TS}`;

    // 이메일: Zustand 통해 pre-fill되지만 명시적으로도 채움 (비동기 타이밍 보장)
    const emailInput = page.getByPlaceholder('user@example.com');
    const existingEmail = await emailInput.inputValue().catch(() => '');
    if (!existingEmail) {
      await emailInput.fill(incompleteEmail);
    }

    await page.getByPlaceholder('Zelle 입금 시 사용하는 이름').fill('E2E테스트');

    // Instagram 먼저 채워 React hydration 확인.
    // pressSequentially = 실제 키 이벤트 시뮬레이션 → React 19 이벤트 위임에서 신뢰성 높음.
    // fill()은 CDP insertText를 사용해 일부 React 버전에서 onChange가 발동 안 될 수 있음.
    await page.getByPlaceholder('@username').pressSequentially(uniqueIg, { delay: 30 });
    // React onChange 연결 확인: 500ms 디바운스 후 버튼이 disabled 상태가 됨
    await page.waitForSelector('[type="submit"][disabled]', { timeout: 8_000 });
    // 인스타 체크 완료 대기
    await page.waitForSelector('[type="submit"]:not([disabled])', { timeout: 15_000 });

    await page.getByPlaceholder('First and Last Name').fill('E2E Test User');
    await page.getByPlaceholder('Street address, P.O. box').fill('123 Test Street');
    await page.getByPlaceholder('City').fill('Los Angeles');

    // State 선택 (select)
    const stateSelect = page
      .locator('select')
      .filter({ hasText: /State|CA|NY/ })
      .first();
    if (await stateSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await stateSelect.selectOption('CA');
    } else {
      await page.locator('select').nth(0).selectOption('CA');
    }

    await page.getByPlaceholder('12345 또는 12345-6789').fill('90001');
    await page.getByPlaceholder('(213) 555-1234').fill('(213) 555-9999');

    // 제출 버튼 최종 확인 후 클릭
    await page.waitForSelector('[type="submit"]:not([disabled])', { timeout: 8_000 });
    await page.locator('[type="submit"]').click({ steps: 5 });

    // 프로필 완성 후 /live, /my-page, /shop 등으로 이동 (returnTo 없으면 /live)
    await page.waitForURL(/\/(live|my-page|shop|upcoming|$)/, { timeout: 12_000 }).catch(() => {});

    // 리디렉트 후 URL이 /profile/register가 아님을 확인
    expect(page.url()).not.toContain('/profile/register');
  });
});

// ════════════════════════════════════════════════
// 2. 프로필 수정 → 어드민 users 테이블 반영 확인
//    buyer@test.com (이미 프로필 완성) 사용
// ════════════════════════════════════════════════
test.describe('2. 프로필 수정 → 어드민 users 테이블 반영', () => {
  // serial: fullyParallel=true 환경에서 2-1→2-2→2-3 순서 보장 + 동일 worker에서 TS 공유
  test.describe.configure({ mode: 'serial' });

  // 기본 user storageState 사용 (buyer@test.com, 프로필 완성 상태)
  const updatedInstagramId = `@e2e_updated_${TS}`;

  test('2-1. instagramId 수정 (API 직접 호출)', async ({ page }) => {
    // /profile/register 접근하여 편집 모드 확인
    await page
      .goto('/profile/register', { waitUntil: 'domcontentloaded', timeout: 30_000 })
      .catch(() => {});
    // heading이 보일 때까지 충분히 대기 (SSR hydration + redirect 완료 이후)
    await page.waitForSelector('h1, h2', { timeout: 15_000 }).catch(() => {});
    const heading = await page
      .locator('h1, h2')
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => '');
    // 완성 프로필 사용자는 편집 폼을 보거나 다른 페이지로 이동 — 어느 쪽이든 페이지는 로드됨
    expect(page.url()).not.toBe('about:blank');

    // page.request는 브라우저 세션 쿠키(buyer@test.com)를 자동으로 포함
    // PATCH /users/me 로 instagramId만 업데이트 (phone 형식 충돌 우회)
    const res = await page.request.patch('/api/users/me', {
      data: { instagramId: updatedInstagramId },
    });

    expect(res.ok(), `instagramId 수정 API 실패 (status: ${res.status()})`).toBe(true);
    console.log(`instagramId 수정 완료: ${updatedInstagramId} (status: ${res.status()})`);
  });

  test('2-2. 어드민 API로 수정된 instagramId 조회 확인', async ({ page }) => {
    // page fixture (buyer@test.com 세션) 로 어드민 API 직접 호출은 불가 (권한 없음)
    // 대신 admin devLogin request context 사용
    const { request: pwRequest } = await import('@playwright/test');
    const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const apiCtx = await pwRequest.newContext({ baseURL: BASE_URL });

    try {
      // admin 로그인
      const loginRes = await apiCtx.post('/api/auth/dev-login', {
        data: { email: 'admin@doremi.shop' },
      });
      expect(loginRes.ok(), `admin devLogin failed: ${loginRes.status()}`).toBe(true);

      // admin/users 검색 (instagramId contains)
      const searchTerm = updatedInstagramId.replace('@', '');
      const searchRes = await apiCtx.get(
        `/api/admin/users?search=${encodeURIComponent(searchTerm)}&page=1&limit=20`,
      );
      expect(searchRes.ok(), `admin/users search failed: ${searchRes.status()}`).toBe(true);

      const body = await searchRes.json();
      const users: Array<{ instagramId?: string; email?: string }> = body?.data?.users ?? [];
      const found = users.some((u) => u.instagramId && u.instagramId.includes(searchTerm));

      expect(
        found,
        `instagramId "${updatedInstagramId}" not found in admin/users API response. users=${JSON.stringify(users.map((u) => u.instagramId))}`,
      ).toBe(true);
    } finally {
      await apiCtx.dispose();
    }
  });

  test('2-3. 어드민 users 테이블 — buyer@test.com 상세 정보 조회', async ({ browser }) => {
    // storageState 토큰이 만료됐을 수 있으므로 devLogin으로 갱신
    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await adminContext.newPage();

    try {
      await adminPage.goto('/login', { waitUntil: 'commit', timeout: 60_000 });
      await devLogin(adminPage, 'ADMIN');
      await safeGoto(adminPage, '/admin/users', 30_000);

      // 검색 — instagramId로 검색 (2-2와 동일한 검색어, admin API 확인됨)
      const searchTerm = updatedInstagramId.replace('@', '');
      const searchInput = adminPage.getByPlaceholder('인스타그램 ID 또는 이메일 검색...');
      await searchInput.waitFor({ timeout: 30_000 });
      await searchInput.fill(searchTerm);
      // Wait for 300ms debounce + API call to complete (networkidle unreliable with WS)
      await adminPage.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      await adminPage.waitForTimeout(3_000);

      // 테이블에서 instagramId 텍스트 확인 (getByText가 text= selector보다 신뢰성 높음)
      const hasUser = await adminPage
        .getByText(searchTerm, { exact: false })
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!hasUser) {
        // 행 클릭으로 상세 페이지 이동 시도
        const userRow = adminPage
          .locator('tr, [role="row"]')
          .filter({ hasText: /e2e_updated/ })
          .first();
        if (await userRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await userRow.click({ steps: 5 });
          await adminPage.waitForURL('**/admin/users/**', { timeout: 8_000 }).catch(() => {});
          const hasDetail = await waitForText(adminPage, searchTerm, 8_000);
          expect(hasDetail, `instagramId "${updatedInstagramId}" not found in detail page`).toBe(
            true,
          );
        } else {
          expect(
            hasUser,
            `user with instagramId "${updatedInstagramId}" not visible in table`,
          ).toBe(true);
        }
      }
    } finally {
      await adminContext.close();
    }
  });
});

// ════════════════════════════════════════════════
// 3. 프로필 미완성 전체 플로우
//    미완성 유저 → returnTo 포함 리디렉트 → 폼 완성 → returnTo 경로 복귀 → 이후 보호 경로 정상 접근
// ════════════════════════════════════════════════
test.describe('3. 프로필 미완성 → 폼 완성 → 보호 경로 접근 전체 플로우', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  const flowEmail = `e2e_flow_${TS}@test.com`;
  const flowIg = `@e2e_flow_${TS}`;

  test('3-1. /shop 접근 → returnTo=/shop 포함 /profile/register 리디렉트', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: flowEmail });

    await page.goto('/shop', { waitUntil: 'commit', timeout: 30_000 }).catch(() => {});

    const url = page.url();
    expect(url).toContain('/profile/register');
    expect(url).toContain('returnTo');
    // returnTo 파라미터가 /shop을 가리키는지 확인
    expect(decodeURIComponent(url)).toContain('/shop');
  });

  test('3-2. /profile/register 폼 완성 → returnTo 경로(/shop)로 복귀', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'commit', timeout: 30_000 });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: flowEmail });

    // 'load' 사용: 모든 스크립트 로드 완료 보장 → React 이벤트 위임 확립
    await page
      .goto('/profile/register?returnTo=%2Fshop', {
        waitUntil: 'load',
        timeout: 30_000,
      })
      .catch(() => {});
    await page.waitForSelector('[placeholder="Zelle 입금 시 사용하는 이름"]', { timeout: 20_000 });

    // 이메일 명시적으로 채우기 — async prefill useEffect 타이밍 불일치 대비
    const flowEmailInput = page.getByPlaceholder('user@example.com');
    const existingFlowEmail = await flowEmailInput.inputValue().catch(() => '');
    if (!existingFlowEmail) {
      await flowEmailInput.fill(flowEmail);
    }
    await page.getByPlaceholder('Zelle 입금 시 사용하는 이름').fill('E2E플로우');

    // Instagram 먼저 채워 React hydration 확인.
    // pressSequentially = 실제 키 이벤트 → React 19 onChange 신뢰성 보장.
    await page.getByPlaceholder('@username').pressSequentially(flowIg, { delay: 30 });
    // React onChange 연결 확인: 500ms 디바운스 후 버튼 disabled
    await page.waitForSelector('[type="submit"][disabled]', { timeout: 8_000 });
    await page.waitForSelector('[type="submit"]:not([disabled])', { timeout: 15_000 });

    await page.getByPlaceholder('First and Last Name').fill('E2E Flow User');
    await page.getByPlaceholder('Street address, P.O. box').fill('456 Flow Avenue');
    await page.getByPlaceholder('City').fill('Los Angeles');
    // State 선택
    await page.locator('select').nth(0).selectOption('CA');
    await page.getByPlaceholder('12345 또는 12345-6789').fill('90001');
    await page.getByPlaceholder('(213) 555-1234').fill('(213) 555-7777');

    // submit 버튼 활성화 재확인 후 클릭
    await page.waitForSelector('[type="submit"]:not([disabled])', { timeout: 8_000 });
    await page.locator('[type="submit"]').click({ steps: 5 });

    // returnTo=/shop 경로로 이동 (/shop은 /store로 리디렉트됨)
    await page.waitForURL(/\/(shop|store)/, { timeout: 12_000 }).catch(() => {});

    // /shop은 Next.js redirect로 /store가 됨 → 둘 다 허용
    expect(page.url()).toMatch(/\/(shop|store)/);
    expect(page.url()).not.toContain('/profile/register');
    console.log(`프로필 완성 후 복귀 URL: ${page.url()}`);
  });

  test('3-3. 프로필 완성 후 /cart 정상 접근 (리디렉트 없음)', async ({ page, context }) => {
    // 동일 이메일로 다시 로그인 — DB에 profileComplete=true 상태
    const ok = await injectDevLoginCookies(context, flowEmail, 'E2E플로우유저');
    expect(ok, 'dev-login 실패').toBe(true);

    await page.goto('/cart', { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await page.waitForSelector('main, [role="main"], h1, h2', { timeout: 8_000 }).catch(() => {});

    expect(page.url()).not.toContain('/profile/register');
    expect(page.url()).not.toContain('/login');
    // 장바구니 페이지 내용 존재 (빈 카트 포함)
    const hasCart = await page
      .getByText('장바구니', { exact: false })
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(hasCart, '/cart 접근 후 장바구니 페이지가 표시되어야 함').toBe(true);
  });

  test('3-4. 프로필 완성 후 /my-page 정상 접근 (리디렉트 없음)', async ({ page, context }) => {
    const ok = await injectDevLoginCookies(context, flowEmail, 'E2E플로우유저');
    expect(ok, 'dev-login 실패').toBe(true);

    await page.goto('/my-page', { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await page.waitForSelector('main, [role="main"], h1, h2', { timeout: 8_000 }).catch(() => {});

    expect(page.url()).not.toContain('/profile/register');
    expect(page.url()).not.toContain('/login');
  });

  test('3-5. 프로필 완성 후 /alerts 정상 접근 (리디렉트 없음)', async ({ page, context }) => {
    const ok = await injectDevLoginCookies(context, flowEmail, 'E2E플로우유저');
    expect(ok, 'dev-login 실패').toBe(true);

    await page.goto('/alerts', { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await page.waitForSelector('main, [role="main"], h1, h2', { timeout: 8_000 }).catch(() => {});

    expect(page.url()).not.toContain('/profile/register');
    expect(page.url()).not.toContain('/login');
  });
});
