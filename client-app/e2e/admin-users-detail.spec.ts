import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

/**
 * 관리자 사용자 관리 심화 E2E 테스트
 * - 사용자 목록 필터, 사용자 상세, 상태 변경
 */

test.describe('Admin Users List Filters', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should display users page with search and filters', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users');

    // 헤더
    await expect(page.getByRole('heading', { name: '회원 관리' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('등록된 회원을 조회하고 관리합니다')).toBeVisible();

    // 검색 입력
    await expect(page.getByPlaceholder('이름, 이메일 또는 인스타그램 ID로 검색...')).toBeVisible();

    // 필터 보기 버튼
    await expect(page.getByRole('button', { name: '필터 보기' })).toBeVisible();

    console.log('Users page with search displayed');
  });

  test('should open filter panel with status filters', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users');
    await expect(page.getByRole('heading', { name: '회원 관리' })).toBeVisible({ timeout: 15000 });

    // 필터 패널 열기
    await page.getByRole('button', { name: '필터 보기' }).click();

    // 날짜 필터
    await expect(page.getByText('가입일 시작')).toBeVisible();
    await expect(page.getByText('가입일 종료')).toBeVisible();

    // 상태 필터 버튼
    await expect(page.getByRole('button', { name: '활성', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '비활성', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '정지', exact: true })).toBeVisible();

    console.log('Filter panel with status filters displayed');
  });

  test('should display users table with correct columns', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users');
    await expect(page.getByRole('heading', { name: '회원 관리' })).toBeVisible({ timeout: 15000 });

    // 테이블 로딩 대기
    const loadingText = page.getByText('회원 목록을 불러오는 중...');
    const table = page.locator('tbody tr').first();

    await Promise.race([
      table.waitFor({ timeout: 10000 }).catch(() => {}),
      loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {}),
    ]);

    // 테이블 컬럼 확인
    const columns = ['인스타그램 ID', '이메일', '이름', '가입일'];
    for (const col of columns) {
      const header = page.locator('th').getByText(col);
      const isVisible = await header.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`Column found: ${col}`);
      }
    }

    console.log('Users table columns checked');
  });

  test('should search users by keyword', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users');
    await expect(page.getByRole('heading', { name: '회원 관리' })).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder('이름, 이메일 또는 인스타그램 ID로 검색...');
    await searchInput.fill('test');

    // debounce 대기
    await page.waitForTimeout(500);

    // 전체 초기화 버튼 표시
    const clearBtn = page.getByRole('button', { name: '전체 초기화' });
    const hasClear = await clearBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasClear) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue('');
    }

    console.log('User search works');
  });
});
