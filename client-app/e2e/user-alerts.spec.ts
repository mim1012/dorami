import { test, expect } from '@playwright/test';

/**
 * 사용자 알림 피드 E2E 테스트
 * - 알림 목록, 탭 필터, 빈 상태
 */

test.describe('User Alerts Page', () => {
  test.setTimeout(60000);

  test('should display alerts page with header and tabs', async ({ page }) => {
    await page.goto('/alerts', { waitUntil: 'domcontentloaded' });

    // 헤더
    await expect(page.getByRole('heading', { name: '알림' })).toBeVisible({ timeout: 15000 });

    // 탭 버튼 확인 (알림 항목 버튼과 하단 네비 중복 방지: exact 매칭)
    const innerMain = page.locator('main main');
    await expect(innerMain.getByRole('button', { name: '전체', exact: true })).toBeVisible();
    await expect(innerMain.getByRole('button', { name: '주문', exact: true })).toBeVisible();
    await expect(innerMain.getByRole('button', { name: '라이브', exact: true })).toBeVisible();
    await expect(innerMain.getByRole('button', { name: '공지', exact: true })).toBeVisible();

    console.log('Alerts page with tabs displayed');
  });

  test('should show notifications or empty state', async ({ page }) => {
    await page.goto('/alerts', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '알림' })).toBeVisible({ timeout: 15000 });

    // 알림 목록 또는 빈 상태
    const emptyState = page.getByText('알림이 없습니다');
    const notification = page.getByText('주문 접수').first();
    const liveNotif = page.getByText('라이브 방송 알림').first();

    await Promise.race([
      emptyState.waitFor({ timeout: 10000 }).catch(() => {}),
      notification.waitFor({ timeout: 10000 }).catch(() => {}),
      liveNotif.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await emptyState.isVisible()) {
      await expect(page.getByText('새로운 소식이 있으면 알려드릴게요')).toBeVisible();
      console.log('No notifications - empty state');
    } else {
      console.log('Notifications displayed');
    }
  });

  test('should switch between notification tabs', async ({ page }) => {
    await page.goto('/alerts', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '알림' })).toBeVisible({ timeout: 15000 });

    // 각 탭 클릭 테스트 (알림 항목 버튼과 하단 네비 중복 방지: exact 매칭)
    const innerMain = page.locator('main main');
    const tabs = ['주문', '라이브', '공지', '전체'];
    for (const tab of tabs) {
      await innerMain.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(500);
      console.log(`Switched to ${tab} tab`);
    }

    console.log('Tab switching works');
  });
});
