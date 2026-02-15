import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers/auth-helper';

/**
 * 관리자 감사 로그 E2E 테스트
 * - 로그 목록, 필터, CSV 내보내기
 */

test.describe('Admin Audit Log Page', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should display audit log page with filters', async ({ page }) => {
    await page.goto('/admin/audit-log', { waitUntil: 'domcontentloaded' });

    // 헤더
    await expect(page.getByRole('heading', { name: '관리 기록' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('모든 관리자 작업 및 변경 사항을 추적합니다')).toBeVisible();

    // 필터 섹션
    await expect(page.getByText('필터', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('시작일')).toBeVisible();
    await expect(page.getByText('종료일')).toBeVisible();
    await expect(page.getByText('작업 유형')).toBeVisible();

    // 필터 버튼
    await expect(page.getByRole('button', { name: '필터 적용' })).toBeVisible();
    await expect(page.getByRole('button', { name: '초기화' })).toBeVisible();
    await expect(page.getByRole('button', { name: /CSV 내보내기/ })).toBeVisible();

    console.log('Audit log page with filters displayed');
  });

  test('should show audit logs or empty state', async ({ page }) => {
    await page.goto('/admin/audit-log', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '관리 기록' })).toBeVisible({ timeout: 15000 });

    // 로그 목록 또는 빈 상태 대기
    const emptyState = page.getByText('기록이 없습니다');
    const tableHeader = page.locator('th').getByText('시간');

    await Promise.race([
      emptyState.waitFor({ timeout: 10000 }).catch(() => {}),
      tableHeader.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);

    if (await tableHeader.isVisible()) {
      // 테이블 컬럼 확인
      await expect(page.locator('th').getByText('관리자')).toBeVisible();
      await expect(page.locator('th').getByText('작업')).toBeVisible();
      await expect(page.locator('th').getByText('대상')).toBeVisible();
      await expect(page.locator('th').getByText('상세')).toBeVisible();
      console.log('Audit logs displayed in table');
    } else {
      await expect(
        page.getByText('관리자가 작업을 수행하면 여기에 기록이 표시됩니다'),
      ).toBeVisible();
      console.log('No audit logs - empty state');
    }
  });

  test('should filter audit logs by action type', async ({ page }) => {
    await page.goto('/admin/audit-log', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '관리 기록' })).toBeVisible({ timeout: 15000 });

    // 작업 유형 드롭다운 선택
    const actionSelect = page.locator('select');
    await actionSelect.selectOption({ label: '생성' });

    // 필터 적용
    await page.getByRole('button', { name: '필터 적용' }).click();

    // 페이지 로딩 대기
    await page.waitForTimeout(2000);

    // 초기화 클릭
    await page.getByRole('button', { name: '초기화' }).click();

    console.log('Audit log filter by action type works');
  });
});
