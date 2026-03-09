import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth-helper';

/**
 * 필수 필드 렌더링 및 유효성 검사 E2E 테스트
 *
 * 프로필 등록 폼과 관리자 상품 등록 모달의 필수 필드 존재 여부 및
 * 클라이언트 측 유효성 검사 오류 동작을 검증합니다.
 */

test.describe('필수 필드 렌더링 및 유효성 검사', () => {
  test.describe.configure({ mode: 'serial' });

  // TC-1: 프로필 폼 필수 필드 렌더링
  test('프로필 등록 폼에 필수 입력 필드가 모두 렌더링된다', async ({ page }) => {
    // [E2E-BIZ] navigate first so localStorage is accessible, then devLogin
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await devLogin(page, 'USER', { skipProfileCompletion: true });
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });

    // 입금자명
    await expect(page.getByLabel('입금자명')).toBeVisible();
    // 인스타그램 ID (선택)
    await expect(page.getByLabel('인스타그램 ID (선택)')).toBeVisible();
    // 수령인 (Full Name)
    await expect(page.getByLabel('수령인 (Full Name)')).toBeVisible();
    // 주소 (Address Line 1)
    await expect(page.getByLabel('주소 (Address Line 1)')).toBeVisible();
    // 전화번호 (미국, 선택)
    await expect(page.getByLabel('전화번호 (미국, 선택)')).toBeVisible();
    // 제출 버튼 (신규: '프로필 등록 완료', 수정: '프로필 저장')
    await expect(page.getByRole('button', { name: /프로필 (등록 완료|저장)/ })).toBeVisible();
  });

  // TC-2: 빈 폼 제출 시 유효성 검사 오류 발생
  test('프로필 폼을 빈 상태로 제출하면 유효성 검사 오류가 표시된다', async ({ page }) => {
    // 프로필 없는 신규 사용자 이메일로 로그인 (pre-fill 방지)
    const freshEmail = `e2e-fresh-${Date.now()}@test.com`;
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: freshEmail });
    await page.goto('/profile/register', { waitUntil: 'networkidle' });

    // Intercept API call to verify it is NOT made on invalid submit
    let apiCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/users/complete-profile')) {
        apiCalled = true;
      }
    });

    // Wait for form to be fully stable before clicking
    const submitBtn = page.getByRole('button', { name: /프로필 (등록 완료|저장)/ });
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });

    // 아무것도 입력하지 않고 제출
    await submitBtn.click();
    await page.waitForTimeout(500);

    // 브라우저 native validation (required 속성) — 입금자명이 비어있으면 validity.valueMissing
    const depositorInvalid = await page.evaluate(() => {
      const el = document.querySelector('input[name="depositorName"]') as HTMLInputElement;
      return el ? !el.validity.valid : false;
    });
    expect(depositorInvalid).toBe(true);

    // 페이지 이동 없음 (native validation이 submit 막음)
    expect(page.url()).toContain('/profile/register');

    // API 미호출 (native validation이 handleSubmit 호출 전에 막음)
    expect(apiCalled).toBe(false);
  });

  // TC-3: 부분 입력 시 필드별 오류 메시지
  test('입금자명만 입력하고 제출하면 수령인 이름 필드에 오류가 표시된다', async ({ page }) => {
    // 프로필 없는 신규 사용자 이메일로 로그인 (pre-fill 방지)
    const freshEmail = `e2e-partial-${Date.now()}@test.com`;
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await devLogin(page, 'USER', { skipProfileCompletion: true, email: freshEmail });
    await page.goto('/profile/register', { waitUntil: 'networkidle' });

    // 이메일, 입금자명만 입력 (fullName은 비워둠)
    await page.getByLabel('이메일').fill(freshEmail);
    await page.getByLabel('입금자명').fill('테스트이름');

    // 제출 — wait for form stability before clicking
    const submitBtn3 = page.getByRole('button', { name: /프로필 (등록 완료|저장)/ });
    await submitBtn3.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn3.click();
    await page.waitForTimeout(500);

    // fullName 필드: 비어있어 invalid (native validation)
    const fullNameInvalid = await page.evaluate(() => {
      const el = document.querySelector('input[name="fullName"]') as HTMLInputElement;
      return el ? !el.validity.valid : false;
    });
    expect(fullNameInvalid).toBe(true);

    // depositorName 필드: 채웠으므로 valid
    const depositorValid = await page.evaluate(() => {
      const el = document.querySelector('input[name="depositorName"]') as HTMLInputElement;
      return el ? el.validity.valid : true;
    });
    expect(depositorValid).toBe(true);
  });

  // TC-4: 관리자 상품 추가 모달 필수 필드 검증
  test('관리자 상품 추가 모달에서 필수 필드 미입력 시 오류가 표시된다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await devLogin(page, 'ADMIN');
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });

    // Wait for the page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Click "상품 등록" button to open modal
    await page.getByRole('button', { name: '상품 등록' }).click();

    // Modal should now be open — verify title is visible
    await expect(page.getByRole('heading', { name: '상품 등록' })).toBeVisible({ timeout: 5000 });

    // Click confirm/submit WITHOUT filling required fields
    // The submit button inside the modal says "등록하기"
    await page.getByRole('button', { name: '등록하기' }).click();

    // Modal should still be open (native validation prevented submission)
    await expect(page.getByRole('heading', { name: '상품 등록' })).toBeVisible();

    // The name field is required — browser native validation blocks submit,
    // so check validity.valueMissing on the input
    const nameInvalid = await page.evaluate(() => {
      const el = document.querySelector('input[name="name"]') as HTMLInputElement;
      return el ? !el.validity.valid : false;
    });
    expect(nameInvalid).toBe(true);
  });
});
