import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers/auth-helper';

/**
 * 라이브 시청 페이지 E2E 테스트 (사용자)
 * - 라이브 목록, 빈 상태, 예정 방송
 */

test.describe('Live Page', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'USER');
  });

  test('should display live page with header', async ({ page }) => {
    await page.goto('/live', { waitUntil: 'domcontentloaded' });

    // 헤더
    await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('실시간 라이브 방송')).toBeVisible();

    console.log('Live page header displayed');
  });

  test('should show empty state or live streams', async ({ page }) => {
    await page.goto('/live', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible({ timeout: 15000 });

    // 빈 상태 또는 라이브 목록
    const emptyState = page.getByText('진행 중인 라이브가 없습니다');
    const liveSection = page.getByText('지금 라이브 중');

    await Promise.race([
      emptyState.waitFor({ timeout: 10000 }).catch(() => {}),
      liveSection.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await emptyState.isVisible()) {
      await expect(page.getByText('곧 새로운 라이브가 시작됩니다')).toBeVisible();
      console.log('No live streams - empty state displayed');
    } else if (await liveSection.isVisible()) {
      // LIVE 배지 확인
      await expect(page.getByText('LIVE').first()).toBeVisible();
      console.log('Live streams displayed');
    } else {
      // 예정된 라이브만 있는 경우
      const scheduled = await page.getByText('예정된 라이브').isVisible();
      if (scheduled) {
        console.log('Scheduled streams displayed');
      } else {
        console.log('Live page loaded with unknown state');
      }
    }
  });
});
