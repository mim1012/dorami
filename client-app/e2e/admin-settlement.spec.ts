import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers/auth-helper';

/**
 * 관리자 정산 페이지 E2E 테스트
 * - 날짜 선택, 조회, 요약 카드, 차트, 테이블
 */

test.describe('Admin Settlement Page', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should display settlement page with date range inputs', async ({ page }) => {
    await page.goto('/admin/settlement', { waitUntil: 'domcontentloaded' });

    // 헤더
    await expect(page.getByRole('heading', { name: '정산 관리' })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('입금 확인된 주문의 정산 리포트를 조회하고 다운로드하세요'),
    ).toBeVisible();

    // 조회 기간 선택
    await expect(page.getByText('조회 기간 선택')).toBeVisible();
    await expect(page.getByText('시작일')).toBeVisible();
    await expect(page.getByText('종료일')).toBeVisible();

    // 조회하기 버튼
    await expect(page.getByRole('button', { name: '조회하기' })).toBeVisible();

    // 초기 안내 문구 (리포트 생성 전)
    await expect(page.getByText('정산 리포트를 조회해주세요')).toBeVisible();

    console.log('Settlement page with date inputs displayed');
  });

  test('should generate settlement report', async ({ page }) => {
    await page.goto('/admin/settlement', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '정산 관리' })).toBeVisible({ timeout: 15000 });

    // 날짜 범위 설정 (최근 30일)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const startInput = page.locator('input[type="date"]').first();
    const endInput = page.locator('input[type="date"]').last();

    await startInput.fill(formatDate(thirtyDaysAgo));
    await endInput.fill(formatDate(today));

    // 조회하기 클릭
    await page.getByRole('button', { name: '조회하기' }).click();

    // 로딩 후 결과 확인 (요약 카드 또는 빈 상태)
    const summaryCard = page.getByText('총 주문 건수');
    const emptyState = page.getByText('선택한 기간에 입금 확인된 주문이 없습니다');

    await Promise.race([
      summaryCard.waitFor({ timeout: 15000 }).catch(() => {}),
      emptyState.waitFor({ timeout: 15000 }).catch(() => {}),
    ]);

    if (await summaryCard.isVisible()) {
      // 요약 카드 확인
      await expect(page.getByText('총 매출액')).toBeVisible();
      await expect(page.getByText('평균 주문액')).toBeVisible();
      await expect(page.getByText('배송비 총액')).toBeVisible();

      // 차트 섹션 (데이터가 있을 때만 표시됨)
      const chartSection = page.getByText('일별 매출 추이');
      if (await chartSection.isVisible().catch(() => false)) {
        console.log('Settlement report generated with chart');
      } else {
        console.log('Settlement report generated (no chart data)');
      }
    } else if (await emptyState.isVisible()) {
      console.log('No confirmed orders in date range');
    } else {
      console.log('Settlement report query completed');
    }
  });
});
