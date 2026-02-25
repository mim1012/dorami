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
    await expect(page.getByText('입금 정보 (Zelle)')).toBeVisible();
    await expect(page.getByText('알림톡 설정 (카카오 알림톡)')).toBeVisible();
    await expect(page.getByText('배송 설정')).toBeVisible();
    await expect(page.getByText('알림 설정')).toBeVisible();

    // 전체 설정 저장 버튼
    await expect(page.getByRole('button', { name: /전체 설정 저장/ })).toBeVisible();

    console.log('Settings page with all sections displayed');
  });

  test('should display zelle payment settings', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });

    // Zelle 입금 정보 설정
    await expect(page.getByText('입금 정보 (Zelle)')).toBeVisible();
    await expect(page.getByText('Zelle 이메일')).toBeVisible();
    await expect(page.getByText('Name (수신인)')).toBeVisible();

    console.log('Zelle payment settings displayed');
  });

  test('should display shipping settings', async ({ page }) => {
    await gotoWithRetry(page, '/admin/settings');
    await expect(page.getByRole('heading', { name: '시스템 설정' })).toBeVisible({
      timeout: 15000,
    });

    // 배송 설정 필드
    await expect(page.getByText('배송 설정')).toBeVisible();
    await expect(page.getByText('기본 배송비 — 동부 ($)')).toBeVisible();
    await expect(page.getByText('CA/서부 배송비 ($)')).toBeVisible();

    console.log('Shipping settings displayed');
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
    await expect(page.getByText('기본 배송비 — 동부 ($)')).toBeVisible();

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
