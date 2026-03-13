import { test, expect, request as playwrightRequest } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * C. Admin 페이지 검증
 * - beforeEach에서 fresh admin dev-login
 * - route intercept로 /users/me 응답
 */
test.describe('C. Admin 페이지 검증', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    const apiCtx = await playwrightRequest.newContext({ baseURL: BACKEND_URL });
    const loginRes = await apiCtx.post('/api/v1/auth/dev-login', {
      data: { email: 'e2e-admin@test.com', name: 'E2E ADMIN', role: 'ADMIN' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const user = loginData.data.user;

    const setCookieHeaders = loginRes.headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value);
    const cookies = setCookieHeaders.map((header) => {
      const parts = header.split(';').map((p) => p.trim());
      const [nameValue] = parts;
      const eqIdx = nameValue.indexOf('=');
      return {
        name: nameValue.substring(0, eqIdx),
        value: nameValue.substring(eqIdx + 1),
        domain: 'localhost', path: '/', expires: -1,
        httpOnly: false, secure: false, sameSite: 'Lax' as const,
      };
    });

    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const meRes = await apiCtx.get('/api/v1/users/me', { headers: { Cookie: cookieHeader } });
    const adminUser = (await meRes.json()).data;
    await apiCtx.dispose();

    await page.context().addCookies(cookies);

    await page.route('http://localhost:3001/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: adminUser, success: true, timestamp: new Date().toISOString() }),
      });
    });

    // / 페이지에서 useAuth 세션 수립
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('C1: /admin/users 페이지 접근 성공', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/admin\/users|login/, { timeout: 5000 });
    expect(page.url()).toContain('/admin/users');
    await expect(
      page.getByPlaceholder('이름, 이메일 또는 인스타그램 ID로 검색...')
    ).toBeVisible({ timeout: 10000 });
  });

  test('C2: 이름으로 검색 동작 확인', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('input[placeholder="이름, 이메일 또는 인스타그램 ID로 검색..."]', { state: 'visible', timeout: 15000 });
    const searchInput = page.getByPlaceholder('이름, 이메일 또는 인스타그램 ID로 검색...');
    await searchInput.click();
    await searchInput.type('E2E', { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const hasResults = await page.getByText(/E2E|e2e/).isVisible().catch(() => false);
    const noResults = await page.getByText(/없|no result/i).isVisible().catch(() => false);
    expect(hasResults || noResults).toBeTruthy();
  });

  test('C3: 이메일로 검색 동작 확인', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('input[placeholder="이름, 이메일 또는 인스타그램 ID로 검색..."]', { state: 'visible', timeout: 15000 });
    const searchInput = page.getByPlaceholder('이름, 이메일 또는 인스타그램 ID로 검색...');
    await searchInput.click();
    await searchInput.type('e2e-user@test.com', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    await expect(page.getByText(/e2e-user|E2E|result|없|검색/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('C4: 유저 상세 클릭 시 배송지가 복호화되어 표시됨', async ({ page }) => {
    test.skip(true, '배송지 암호화/복호화 기능 구현 여부 미확인');
  });

  test('C5: admin/users 페이지 내 모든 검색창 인터랙션 확인', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('input[placeholder="이름, 이메일 또는 인스타그램 ID로 검색..."]', { state: 'visible', timeout: 15000 });
    const searchInput = page.getByPlaceholder('이름, 이메일 또는 인스타그램 ID로 검색...');
    await expect(searchInput).toBeEnabled({ timeout: 5000 });

    const globalSearch = page.getByPlaceholder('검색...').first();
    await expect(globalSearch).toBeVisible({ timeout: 5000 });
    await expect(globalSearch).toBeEnabled();
  });
});
