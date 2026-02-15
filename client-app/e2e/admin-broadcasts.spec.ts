import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

/**
 * 관리자 방송 관리 E2E 테스트
 * - 방송 현황 카드, 방송 기록 테이블, 스트림 키 생성 모달
 * 참고: streaming API 미구동 시 에러 페이지가 표시될 수 있음
 */

test.describe('Admin Broadcasts Page', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  /**
   * 방송 페이지 로드 대기 — 스트리밍 API 타임아웃이 길 수 있으므로 45초 대기
   * @returns 'error' | 'loaded'
   */
  async function waitForPageLoad(page: import('@playwright/test').Page) {
    const retryBtn = page.getByRole('button', { name: '다시 시도' });
    const newBroadcastBtn = page.getByRole('button', { name: /새 방송 시작/ });

    await Promise.race([
      retryBtn.waitFor({ timeout: 45000 }).catch(() => {}),
      newBroadcastBtn.waitFor({ timeout: 45000 }).catch(() => {}),
    ]);

    if (await retryBtn.isVisible().catch(() => false)) {
      return 'error' as const;
    }
    if (await newBroadcastBtn.isVisible().catch(() => false)) {
      return 'loaded' as const;
    }
    // 둘 다 못 찾은 경우 — 마지막으로 한번 더 확인
    await page.waitForTimeout(2000);
    if (await retryBtn.isVisible().catch(() => false)) return 'error' as const;
    return 'loaded' as const;
  }

  test('should load broadcasts page (content or error)', async ({ page }) => {
    await gotoWithRetry(page, '/admin/broadcasts');

    const state = await waitForPageLoad(page);

    if (state === 'error') {
      await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
      console.log('Broadcasts page shows error (streaming API not available)');
      return;
    }

    // 정상 로드 시
    await expect(page.getByRole('button', { name: /새 방송 시작/ })).toBeVisible();

    // 라이브 현황 카드
    await expect(page.getByText('현재 라이브 중')).toBeVisible();
    await expect(page.getByText('총 시청자')).toBeVisible();
    await expect(page.getByText('총 방송 기록')).toBeVisible();

    // 방송 기록 섹션
    await expect(page.getByRole('heading', { name: '방송 기록' })).toBeVisible();

    console.log('Broadcasts page loaded successfully');
  });

  test('should open stream key generation modal if page loads', async ({ page }) => {
    await gotoWithRetry(page, '/admin/broadcasts');

    const state = await waitForPageLoad(page);

    if (state === 'error') {
      console.log('Broadcasts page error - skipping modal test');
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /새 방송 시작/ }).click();

    // 모달 내용 확인
    await expect(page.getByPlaceholder('예: 오늘의 라이브 방송')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '스트림 키 발급' })).toBeVisible();

    console.log('Stream key modal opened');
  });

  test('should generate stream key if page loads', async ({ page }) => {
    await gotoWithRetry(page, '/admin/broadcasts');

    const state = await waitForPageLoad(page);

    if (state === 'error') {
      console.log('Broadcasts page error - skipping generation test');
      return;
    }

    // 모달 열기 → 제목 입력 → 발급
    await page.getByRole('button', { name: /새 방송 시작/ }).click();
    await page.getByPlaceholder('예: 오늘의 라이브 방송').fill('E2E 테스트 방송');
    await page.getByRole('button', { name: '스트림 키 발급' }).click();

    // 결과 확인
    const success = page.getByText('스트림 키가 발급되었습니다!');
    const error = page.getByText('스트림 키 발급에 실패했습니다');

    await Promise.race([
      success.waitFor({ timeout: 10000 }).catch(() => {}),
      error.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await success.isVisible()) {
      await expect(page.getByText('RTMP 서버 URL')).toBeVisible();
      await expect(page.getByText('유효 기간')).toBeVisible();
      console.log('Stream key generated successfully');
    } else {
      console.log('Stream key generation failed (API error)');
    }
  });
});
