import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth-helper';

/**
 * 회원가입 (프로필 등록) E2E 테스트
 *
 * 프로필이 미완성인 신규 사용자로 로그인 후 /profile/register 폼을 테스트합니다.
 * storageState를 비워서 기존 인증 상태를 무시하고, devLogin으로 새 사용자를 생성합니다.
 */
test.describe('User Registration (Profile)', () => {
  // 기존 storageState 무시 — 새 사용자로 테스트
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // about:blank에서는 localStorage 접근 불가(SecurityError)이므로
    // devLogin의 page.evaluate 호출 전 실제 origin으로 이동
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // 프로필 미완성 사용자로 로그인 (고유 이메일)
    await devLogin(page, 'USER');
  });

  test('should display registration form with all required fields', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });

    // 페이지 타이틀 확인
    await expect(page.getByRole('heading', { name: '프로필 등록' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('서비스 이용을 위해 추가 정보를 입력해주세요')).toBeVisible();

    // 기본 정보 섹션
    await expect(page.getByText('기본 정보')).toBeVisible();
    await expect(page.getByLabel('입금자명')).toBeVisible();
    await expect(page.getByLabel('인스타그램 ID')).toBeVisible();

    // 미국 배송지 섹션
    await expect(page.getByText('미국 배송지')).toBeVisible();
    await expect(page.getByLabel('수령인 (Full Name)')).toBeVisible();
    await expect(page.getByLabel('주소 (Address Line 1)')).toBeVisible();
    await expect(page.getByLabel('상세 주소 (Address Line 2)')).toBeVisible();
    await expect(page.getByLabel('도시 (City)')).toBeVisible();
    await expect(page.getByLabel('주 (State)')).toBeVisible();
    await expect(page.getByLabel('ZIP Code')).toBeVisible();
    await expect(page.getByLabel('전화번호 (미국)')).toBeVisible();

    // 등록 버튼
    await expect(page.getByRole('button', { name: '프로필 등록 완료' })).toBeVisible();
  });

  test('should show custom validation errors on submit', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '프로필 등록' })).toBeVisible({
      timeout: 10000,
    });

    // 브라우저 네이티브 required 검증 우회 — JS로 required 속성 제거
    await page.evaluate(() => {
      document.querySelectorAll('[required]').forEach((el) => el.removeAttribute('required'));
    });

    // 빈 폼 제출 → 커스텀 JS 검증 에러 표시
    await page.getByRole('button', { name: '프로필 등록 완료' }).click();

    // 필수 필드 에러 메시지 확인
    await expect(page.getByText('입금자명을 입력해주세요')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('인스타그램 ID를 입력해주세요')).toBeVisible();
    await expect(page.getByText('수령인 이름을 입력해주세요')).toBeVisible();
    await expect(page.getByText('주소를 입력해주세요')).toBeVisible();
    await expect(page.getByText('도시명을 입력해주세요')).toBeVisible();
    await expect(page.getByText('State를 선택해주세요')).toBeVisible();
    await expect(page.getByText('ZIP Code를 입력해주세요')).toBeVisible();
    await expect(page.getByText('전화번호를 입력해주세요')).toBeVisible();
  });

  test('should validate format of ZIP code and phone number', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '프로필 등록' })).toBeVisible({
      timeout: 10000,
    });

    // 잘못된 형식 입력
    await page.getByLabel('ZIP Code').fill('123');
    await page.getByLabel('전화번호 (미국)').fill('123');

    // 나머지 필수 필드는 채워서 ZIP/Phone 에러만 나오게 함
    await page.getByLabel('입금자명').fill('테스트');
    await page.getByLabel('인스타그램 ID').fill('@testuser_e2e_format');
    await page.getByLabel('수령인 (Full Name)').fill('Test User');
    await page.getByLabel('주소 (Address Line 1)').fill('123 Test St');
    await page.getByLabel('도시 (City)').fill('New York');
    await page.getByLabel('주 (State)').selectOption('NY');

    await page.getByRole('button', { name: '프로필 등록 완료' }).click();

    // 형식 에러 확인
    await expect(page.getByText('ZIP Code 형식: 12345 또는 12345-6789')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('미국 전화번호 형식: (123) 456-7890')).toBeVisible();
  });

  test('should complete registration with valid data', async ({ page }) => {
    await page.goto('/profile/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '프로필 등록' })).toBeVisible({
      timeout: 10000,
    });

    const uniqueId = `e2e_reg_${Date.now()}`;

    // 기본 정보 입력
    await page.getByLabel('입금자명').fill('테스트사용자');
    await page.getByLabel('인스타그램 ID').fill(`@${uniqueId}`);

    // 인스타그램 ID 사용 가능 확인 대기
    await expect(page.getByText('사용 가능')).toBeVisible({ timeout: 10000 });

    // 미국 배송지 입력
    await page.getByLabel('수령인 (Full Name)').fill('Test User');
    await page.getByLabel('주소 (Address Line 1)').fill('123 Main St');
    await page.getByLabel('상세 주소 (Address Line 2)').fill('Apt 4B');
    await page.getByLabel('도시 (City)').fill('New York');
    await page.getByLabel('주 (State)').selectOption('NY');
    await page.getByLabel('ZIP Code').fill('10001');
    await page.getByLabel('전화번호 (미국)').fill('2125551234');

    // 제출
    await page.getByRole('button', { name: '프로필 등록 완료' }).click();

    // 성공 시 홈으로 리다이렉트
    await expect(page).toHaveURL('/', { timeout: 15000 });
  });
});
