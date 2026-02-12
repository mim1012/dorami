import { test, expect } from '@playwright/test';

/**
 * 마이페이지 & 배송지 관리 E2E 테스트
 *
 * user storageState(프로필 완성된 사용자)로 실행됩니다.
 * 마이페이지 접근, 프로필 확인, 배송지 수정, 주문 내역 네비게이션을 테스트합니다.
 */
test.describe('My Page', () => {
  test.setTimeout(60000);

  test('should display my page with profile sections', async ({ page }) => {
    await page.goto('/my-page', { waitUntil: 'domcontentloaded' });

    // 페이지 타이틀 확인
    await expect(page.getByText('마이페이지')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('프로필 관리 및 주문 내역 확인')).toBeVisible();

    // 배송지 정보 섹션 확인
    await expect(page.getByText('배송지 정보')).toBeVisible({ timeout: 10000 });

    // 로그아웃 버튼 확인
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });

  test('should show shipping address or empty state', async ({ page }) => {
    await page.goto('/my-page', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('배송지 정보')).toBeVisible({ timeout: 15000 });

    // 배송지가 있거나 없는 상태 중 하나
    const hasAddress = await page
      .getByText('등록된 배송지가 없습니다')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasAddress) {
      console.log('No shipping address registered');
    } else {
      console.log('Shipping address is displayed');
    }

    // 수정 버튼은 항상 존재
    await expect(page.getByRole('button', { name: '수정' })).toBeVisible();
  });

  test('should open address edit modal and validate fields', async ({ page }) => {
    await page.goto('/my-page', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('배송지 정보')).toBeVisible({ timeout: 15000 });

    // 수정 버튼 클릭
    await page.getByRole('button', { name: '수정' }).click();

    // 모달 열림 확인
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Edit Shipping Address')).toBeVisible();

    // 폼 필드 확인
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Address Line 1')).toBeVisible();
    await expect(page.getByLabel('Address Line 2 (Optional)')).toBeVisible();
    await expect(page.getByLabel('City')).toBeVisible();
    await expect(page.getByLabel('State')).toBeVisible();
    await expect(page.getByLabel('ZIP Code')).toBeVisible();
    await expect(page.getByLabel('Phone Number')).toBeVisible();

    // 버튼 확인
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });

  test('should edit and save shipping address', async ({ page }) => {
    await page.goto('/my-page', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('배송지 정보')).toBeVisible({ timeout: 15000 });

    // 수정 모달 열기
    await page.getByRole('button', { name: '수정' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // 배송지 입력/수정
    await page.getByLabel('Full Name').fill('E2E Test User');
    await page.getByLabel('Address Line 1').fill('456 Test Avenue');
    await page.getByLabel('Address Line 2 (Optional)').fill('Suite 100');
    await page.getByLabel('City').fill('Los Angeles');
    await page.getByLabel('State').selectOption('CA');
    await page.getByLabel('ZIP Code').fill('90001');
    await page.getByLabel('Phone Number').fill('3105551234');

    // 저장
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // 모달 닫힘 확인
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // 성공 메시지 확인
    await expect(page.getByText('배송지가 저장되었습니다')).toBeVisible({ timeout: 5000 });

    // 저장된 주소 표시 확인
    await expect(page.getByText('E2E Test User')).toBeVisible();
    await expect(page.getByText('456 Test Avenue')).toBeVisible();
    await expect(page.getByText('Los Angeles, CA 90001')).toBeVisible();
  });

  test('should cancel address edit without saving', async ({ page }) => {
    await page.goto('/my-page', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('배송지 정보')).toBeVisible({ timeout: 15000 });

    // 모달 열기
    await page.getByRole('button', { name: '수정' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // 입력 후 취소
    await page.getByLabel('Full Name').fill('Should Not Be Saved');

    await page.getByRole('button', { name: 'Cancel' }).click();

    // 모달 닫힘 확인
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // 취소한 값이 표시되지 않아야 함
    await expect(page.getByText('Should Not Be Saved')).not.toBeVisible();
  });
});

test.describe('Order History Page', () => {
  test.setTimeout(60000);

  test('should display order history or empty state', async ({ page }) => {
    await page.goto('/orders', { waitUntil: 'domcontentloaded' });

    // 페이지 타이틀 확인
    await expect(page.getByText('주문 내역')).toBeVisible({ timeout: 15000 });

    // 페이지 로딩 대기 후 주문이 있거나 없는 상태 중 하나 확인
    // isVisible()은 즉시 체크하므로 waitFor로 먼저 대기
    const emptyLocator = page.getByText('주문 내역이 없습니다');
    const orderLocator = page.getByText('주문번호:').first();

    // 둘 중 하나가 나타날 때까지 대기
    await Promise.race([
      emptyLocator.waitFor({ timeout: 10000 }).catch(() => {}),
      orderLocator.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await emptyLocator.isVisible()) {
      // 빈 상태 확인
      await expect(page.getByText('라이브 방송에서 상품을 주문해보세요')).toBeVisible();
      await expect(page.getByRole('button', { name: '쇼핑하러 가기' })).toBeVisible();
      console.log('Order history is empty');
    } else {
      // 주문 카드가 보이는지 확인
      await expect(orderLocator).toBeVisible();
      console.log('Orders are displayed');
    }
  });

  test('should navigate to shopping from empty order state', async ({ page }) => {
    await page.goto('/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('주문 내역')).toBeVisible({ timeout: 15000 });

    const emptyLocator = page.getByText('주문 내역이 없습니다');
    const orderLocator = page.getByText('주문번호:').first();

    await Promise.race([
      emptyLocator.waitFor({ timeout: 10000 }).catch(() => {}),
      orderLocator.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await emptyLocator.isVisible()) {
      await page.getByRole('button', { name: '쇼핑하러 가기' }).click();
      await expect(page).toHaveURL('/', { timeout: 10000 });
    } else {
      console.log('Orders exist - skipping empty state navigation test');
    }
  });
});
