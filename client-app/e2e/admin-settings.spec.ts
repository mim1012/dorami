import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

/**
 * 관리자 설정 페이지 E2E 테스트
 * - 계좌, 타이머, 배송비, 알림, 공지 설정
 */

test.describe('Admin Settings Page', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should display settings page with all sections', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');

    // 헤더
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('플랫폼 전체 설정을 관리합니다')).toBeVisible();

    // 주요 섹션 확인
    await expect(page.getByText('장바구니 예약 타이머')).toBeVisible();
    await expect(page.getByText('무통장 입금 정보')).toBeVisible();
    await expect(page.getByText('배송 설정')).toBeVisible();
    await expect(page.getByText('알림 설정')).toBeVisible();

    // 전체 설정 저장 버튼
    await expect(page.getByRole('button', { name: /전체 설정 저장/ })).toBeVisible();

    console.log('Settings page with all sections displayed');
  });

  test('should display cart timer settings', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });

    // 장바구니 타이머 설정
    await expect(page.getByText('기본 타이머 시간 (분)')).toBeVisible();
    await expect(page.getByText(/결제를 완료해야 하는 시간/)).toBeVisible();

    // 타이머 입력 필드
    const timerInput = page.locator('input[type="number"]').first();
    await expect(timerInput).toBeVisible();

    console.log('Cart timer settings displayed');
  });

  test('should display bank account settings', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });

    // 무통장 입금 정보 필드
    await expect(page.getByText('은행명')).toBeVisible();
    await expect(page.getByText('계좌번호')).toBeVisible();
    await expect(page.getByText('예금주')).toBeVisible();

    console.log('Bank account settings displayed');
  });

  test('should display notification and shipping settings', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });

    // 알림 설정
    await expect(page.getByText('알림 설정')).toBeVisible();
    await expect(page.getByText('이메일 알림 활성화')).toBeVisible();

    // 배송 설정
    await expect(page.getByText('기본 배송비 (원)')).toBeVisible();

    console.log('Notification and shipping settings displayed');
  });

  test('should display advanced settings sections', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });

    // 배송문구 설정
    await expect(page.getByText('배송문구 설정')).toBeVisible();

    // 적립 포인트 설정
    await expect(page.getByText('적립 포인트 설정')).toBeVisible();

    // 공지 관리
    await expect(page.getByText('공지 관리')).toBeVisible();

    console.log('Advanced settings sections displayed');
  });
});
