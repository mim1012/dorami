import { test, expect, request as playwrightRequest } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * B. 기존 회원(완성된 프로필) 동작 검증
 * - beforeEach에서 fresh dev-login으로 토큰 갱신
 */
test.describe('B. 기존 회원 동작 검증', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(60000);

  // 매 테스트마다 fresh 로그인 (토큰 만료 방지)
  test.beforeEach(async ({ page }) => {
    const apiCtx = await playwrightRequest.newContext({ baseURL: BACKEND_URL });
    const loginRes = await apiCtx.post('/api/auth/dev-login', {
      data: { email: 'e2e-user@test.com', name: 'E2E USER' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const user = loginData.data.user;

    const setCookieHeaders = loginRes
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value);
    const cookies = setCookieHeaders.map((header) => {
      const parts = header.split(';').map((p) => p.trim());
      const [nameValue] = parts;
      const eqIdx = nameValue.indexOf('=');
      return {
        name: nameValue.substring(0, eqIdx),
        value: nameValue.substring(eqIdx + 1),
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      };
    });

    // 실제 /users/me 프로필 가져오기 (완성된 프로필)
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const meRes = await apiCtx.get('/api/users/me', { headers: { Cookie: cookieHeader } });
    const meData = await meRes.json();
    const fullUser = meData.data;
    await apiCtx.dispose();

    // /login 이외의 페이지에서 localStorage 세팅 (/login은 useAuth가 isLoading=false 강제 세팅)
    // 쿠키를 먼저 context에 추가한 다음 임의 페이지 이동
    await page.context().addCookies(cookies);

    // useAuth 재검증 intercept — /api/users/me 요청을 완성된 유저 데이터로 응답
    await page.route('http://localhost:3001/api/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: fullUser,
          success: true,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    // / 페이지 이동 (useAuth 마운트 → isLoading:true → fetchProfile → route intercept로 fullUser 반환)
    // /login이 아닌 페이지를 사용해야 useAuth가 setLoading(false)로 단축하지 않음
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    // useAuth 세션 fetch 완료 대기
    await page.waitForTimeout(1000);
  });

  test('B1: 완성된 프로필 유저 → /profile/register 접근 시 리다이렉트 없이 정상 접근', async ({
    page,
  }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/profile\/register|login/, { timeout: 5000 });

    // route intercept 덕분에 /profile/register에 머물러야 함
    // 만약 /login이면 앱의 useAuth 세션 재검증 타이밍 이슈
    expect(page.url()).toContain('/profile/register');
  });

  test('B2: /profile/register 진입 시 form 필드가 모두 존재하고 입력 가능', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('프로필 등록').first()).toBeVisible({ timeout: 10000 });

    // 필수 필드들 존재 확인 (프리필은 앱에서 지원하지 않음 — 빈 폼으로 시작)
    const depositorInput = page.getByLabel('입금자명');
    await expect(depositorInput).toBeVisible();
    await expect(depositorInput).toBeEnabled();

    const instaInput = page.getByLabel('인스타그램 ID');
    await expect(instaInput).toBeVisible();
    await expect(instaInput).toBeEnabled();

    const fullNameInput = page.getByLabel('수령인');
    await expect(fullNameInput).toBeVisible();

    const address1 = page.getByLabel('주소').first();
    await expect(address1).toBeVisible();
  });

  test('B3: 입금자명(depositorName) 수정 가능', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('프로필 등록').first()).toBeVisible({ timeout: 10000 });

    const depositorInput = page.getByLabel('입금자명');
    await depositorInput.fill('수정된입금자명');
    expect(await depositorInput.inputValue()).toBe('수정된입금자명');
  });

  test('B4: 인스타그램 ID(instagramId) 수정 가능', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('프로필 등록').first()).toBeVisible({ timeout: 10000 });

    const instaInput = page.getByLabel('인스타그램 ID');
    const newId = `@modified_${Date.now()}`;
    await instaInput.fill(newId);
    const currentVal = await instaInput.inputValue();
    expect(currentVal).toContain('modified_');
  });

  test('B5: 전화번호(phone) 필드 수정 가능 (선택 필드)', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('프로필 등록').first()).toBeVisible({ timeout: 10000 });

    const phoneInput = page.getByLabel('전화번호');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('(310) 555-7777');
    expect(await phoneInput.inputValue()).toBe('(310) 555-7777');
  });

  test('B6: 배송지(address) 필드 수정 가능', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('프로필 등록').first()).toBeVisible({ timeout: 10000 });

    const address1 = page.getByLabel('주소').first();
    await expect(address1).toBeVisible();
    await address1.fill('999 Updated Street');
    expect(await address1.inputValue()).toBe('999 Updated Street');

    const city = page.getByLabel('도시');
    await city.fill('Chicago');
    expect(await city.inputValue()).toBe('Chicago');
  });

  test('B7: 수정 후 저장 성공', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('프로필 등록').first()).toBeVisible({ timeout: 10000 });

    await page.getByLabel('입금자명').fill('업데이트된이름');
    await page.getByRole('button', { name: '프로필 등록 완료' }).click();

    await page.waitForTimeout(2000);
    const errorVisible = await page
      .getByText('오류')
      .isVisible()
      .catch(() => false);
    expect(errorVisible).toBeFalsy();
  });
});
