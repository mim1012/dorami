import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers/auth-helper';

/**
 * 관리자 주문 관리 E2E 테스트
 *
 * admin storageState(관리자 사용자)로 실행됩니다.
 * 주문 목록 조회, 필터링, 입금 확인, 독촉 알림 발송, 대량 배송 알림 페이지를 테스트합니다.
 *
 * 참고: 현재 admin/orders 페이지는 mock 데이터를 사용하고 있어
 * API 호출이 수반되는 테스트(입금확인, 알림전송)는 UI 다이얼로그 흐름만 검증합니다.
 */

test.describe('Admin Orders Page Display', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should display order management page with header and search', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });

    // 페이지 헤더 확인
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('모든 고객 주문을 조회하고 관리합니다')).toBeVisible();

    // 검색 입력 확인
    await expect(
      page.getByPlaceholder('주문번호, 이메일, 입금자명, 인스타그램 ID로 검색...'),
    ).toBeVisible();

    // 필터 보기 버튼 확인
    await expect(page.getByRole('button', { name: '필터 보기' })).toBeVisible();

    console.log('Admin orders page header and search displayed');
  });

  test('should display order table with columns', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 테이블 헤더 컬럼 확인
    const columns = [
      '주문번호',
      '고객',
      '입금자명',
      '결제',
      '배송',
      '합계',
      '주문일',
      '결제일',
      '작업',
    ];
    for (const col of columns) {
      await expect(page.locator('th').getByText(col, { exact: true })).toBeVisible();
    }

    // 테이블에 데이터가 있는지 확인 (mock 데이터)
    await expect(page.locator('tbody tr').first()).toBeVisible();

    console.log('Order table with all columns displayed');
  });

  test('should display order status badges correctly', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 테이블 로딩 대기
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

    // mock 데이터 배지 확인 (실제 렌더링 기준)
    // 배송 상태 배지: '배송완료', '배송중' 등
    await expect(page.locator('tbody').getByText('배송완료').first()).toBeVisible();

    // PENDING 주문에 액션 버튼 존재
    await expect(page.getByRole('button', { name: '입금확인' })).toBeVisible();

    console.log('Order status badges displayed correctly');
  });

  test('should show action buttons for pending payment orders', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // PENDING 주문(ORD-004)에 알림전송/입금확인 버튼이 보여야 함
    await expect(page.getByRole('button', { name: '알림전송' })).toBeVisible();
    await expect(page.getByRole('button', { name: '입금확인' })).toBeVisible();

    console.log('Action buttons visible for pending payment orders');
  });
});

test.describe('Admin Orders Filter', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should open and close filter panel', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 필터 패널 열기
    await page.getByRole('button', { name: '필터 보기' }).click();

    // 필터 패널 내용 확인 (테이블 헤더와 중복되므로 paragraph 역할로 특정)
    await expect(page.getByRole('paragraph').filter({ hasText: '주문 상태' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: '결제 상태' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: '배송 상태' })).toBeVisible();

    // 날짜 필터 확인
    await expect(page.getByText('주문일 시작')).toBeVisible();
    await expect(page.getByText('주문일 종료')).toBeVisible();

    // 버튼 텍스트가 "필터 숨기기"로 변경
    await expect(page.getByRole('button', { name: '필터 숨기기' })).toBeVisible();

    // 필터 패널 닫기
    await page.getByRole('button', { name: '필터 숨기기' }).click();

    // 필터 내용 사라짐 (paragraph 역할의 필터 라벨이 숨겨짐)
    await expect(page.getByRole('paragraph').filter({ hasText: '주문 상태' })).not.toBeVisible();

    console.log('Filter panel open/close works');
  });

  test('should toggle status filter buttons', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 필터 패널 열기
    await page.getByRole('button', { name: '필터 보기' }).click();
    await expect(page.getByRole('paragraph').filter({ hasText: '주문 상태' })).toBeVisible();

    // 주문 상태 필터 버튼 확인
    const pendingPaymentBtn = page.getByRole('button', { name: '입금 대기' });
    const confirmedBtn = page.getByRole('button', { name: '결제 완료' });
    const cancelledBtn = page.getByRole('button', { name: '취소됨' });

    await expect(pendingPaymentBtn).toBeVisible();
    await expect(confirmedBtn).toBeVisible();
    await expect(cancelledBtn).toBeVisible();

    // 배송 상태 필터 확인
    const shippingButtons = ['준비중', '배송중', '배송완료'];
    for (const label of shippingButtons) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    // 필터 토글 테스트: "입금 대기" 클릭 -> URL 반영
    await pendingPaymentBtn.click();
    await expect(page).toHaveURL(/orderStatus=PENDING_PAYMENT/, { timeout: 5000 });

    console.log('Status filter buttons toggle correctly');
  });

  test('should search orders by keyword', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder(
      '주문번호, 이메일, 입금자명, 인스타그램 ID로 검색...',
    );

    // 검색어 입력
    await searchInput.fill('김철수');

    // debounce 대기 후 URL에 search 파라미터 반영
    await expect(page).toHaveURL(/search=/, { timeout: 5000 });

    // 전체 초기화 버튼 표시
    await expect(page.getByRole('button', { name: '전체 초기화' })).toBeVisible();

    // 초기화 클릭
    await page.getByRole('button', { name: '전체 초기화' }).click();

    // 검색어 사라짐
    await expect(searchInput).toHaveValue('');

    console.log('Search and clear filter works');
  });
});

test.describe('Admin Orders Confirm Payment Dialog', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should show confirm payment dialog and cancel', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 입금확인 버튼 클릭
    await page.getByRole('button', { name: '입금확인' }).click();

    // 확인 다이얼로그 표시
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 다이얼로그 제목 확인
    await expect(dialog.getByText('입금 확인')).toBeVisible();

    // 다이얼로그 내용에 주문 정보 포함
    await expect(dialog.getByText(/주문번호/)).toBeVisible();
    await expect(dialog.getByText(/입금자명/)).toBeVisible();
    await expect(dialog.getByText(/금액/)).toBeVisible();
    await expect(dialog.getByText(/은행 계좌로 위 금액의 입금을 확인하셨습니까/)).toBeVisible();

    // 취소 버튼 클릭
    await dialog.getByRole('button', { name: '취소' }).click();

    // 다이얼로그 닫힘
    await expect(dialog).not.toBeVisible();

    console.log('Confirm payment dialog displayed and cancelled');
  });

  test('should attempt confirm payment and handle API response', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 입금확인 버튼 클릭
    await page.getByRole('button', { name: '입금확인' }).click();

    // 확인 다이얼로그에서 확인 클릭
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: '확인' }).click();

    // 다이얼로그 닫힘
    await expect(dialog).not.toBeVisible();

    // API 응답 대기 (mock ID이므로 에러 토스트 예상)
    const toast = page.locator('[role="alert"]');
    await expect(toast.first()).toBeVisible({ timeout: 10000 });

    const toastText = await toast.first().textContent();
    console.log(`Payment confirm result: ${toastText}`);
  });
});

test.describe('Admin Orders Send Reminder Dialog', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should show send reminder dialog and cancel', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 알림전송 버튼 클릭
    await page.getByRole('button', { name: '알림전송' }).click();

    // 확인 다이얼로그 표시
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 다이얼로그 제목 확인
    await expect(dialog.getByText('알림 전송')).toBeVisible();

    // 다이얼로그 내용에 주문/고객 정보 포함
    await expect(dialog.getByText(/주문번호/)).toBeVisible();
    await expect(dialog.getByText(/고객/)).toBeVisible();
    await expect(dialog.getByText(/KakaoTalk 결제 알림을 전송하시겠습니까/)).toBeVisible();

    // 취소 버튼 클릭
    await dialog.getByRole('button', { name: '취소' }).click();
    await expect(dialog).not.toBeVisible();

    console.log('Send reminder dialog displayed and cancelled');
  });

  test('should attempt send reminder and handle API response', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });

    // 알림전송 버튼 클릭
    await page.getByRole('button', { name: '알림전송' }).click();

    // 확인 다이얼로그에서 전송 클릭
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: '전송' }).click();

    // 다이얼로그 닫힘
    await expect(dialog).not.toBeVisible();

    // API 응답 대기 (mock ID이므로 에러 토스트 예상)
    const toast = page.locator('[role="alert"]');
    await expect(toast.first()).toBeVisible({ timeout: 10000 });

    const toastText = await toast.first().textContent();
    console.log(`Send reminder result: ${toastText}`);
  });
});

test.describe('Bulk Notify Page', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should display bulk notify page with instructions', async ({ page }) => {
    await page.goto('/admin/orders/bulk-notify', { waitUntil: 'domcontentloaded' });

    // 페이지 헤더
    await expect(page.getByText('Bulk Shipping Notifications')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('Send tracking number notifications to multiple customers at once'),
    ).toBeVisible();

    // 사용법 안내
    await expect(page.getByText('How to use')).toBeVisible();
    await expect(page.getByText(/Download the sample CSV template/)).toBeVisible();
    await expect(page.getByText(/Fill in your Order IDs and Tracking Numbers/)).toBeVisible();
    await expect(page.getByText(/Upload the CSV file/)).toBeVisible();
    await expect(
      page.getByText(/Only orders with confirmed payment status will receive notifications/),
    ).toBeVisible();

    // 샘플 CSV 다운로드 버튼
    await expect(page.getByRole('button', { name: /Download Sample CSV/ })).toBeVisible();

    // 업로드 섹션
    await expect(page.getByText('Upload CSV File')).toBeVisible();
    await expect(page.getByText('Select CSV File')).toBeVisible();

    // Send 버튼 (파일 없이 비활성화)
    const sendBtn = page.getByRole('button', { name: 'Send Notifications' });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();

    // Cancel 버튼
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    console.log('Bulk notify page displayed correctly');
  });

  test('should download sample CSV', async ({ page }) => {
    await page.goto('/admin/orders/bulk-notify', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Bulk Shipping Notifications')).toBeVisible({ timeout: 15000 });

    // 다운로드 이벤트 캡처
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.getByRole('button', { name: /Download Sample CSV/ }).click(),
    ]);

    // 파일명 확인
    expect(download.suggestedFilename()).toBe('sample-tracking-numbers.csv');
    console.log('Sample CSV downloaded successfully');
  });

  test('should navigate back to orders page on cancel', async ({ page }) => {
    await page.goto('/admin/orders/bulk-notify', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Bulk Shipping Notifications')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 10000 });

    console.log('Cancel navigates back to orders page');
  });
});
