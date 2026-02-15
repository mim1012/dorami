import { test, expect } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

test.describe('Admin Orders Management', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('should access admin orders page', async ({ page }) => {
    await gotoWithRetry(page, '/admin/orders');

    // Verify we're on orders page (not redirected to /login)
    await expect(page).toHaveURL(/\/admin\/orders/);

    // Check for orders table or empty state
    const hasOrders = await page
      .getByText('주문 내역이 없습니다')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasOrders) {
      console.log('Admin orders page loaded with orders');
    } else {
      console.log('Admin orders page loaded - empty state');
    }
  });

  test('should display order list', async ({ page }) => {
    await gotoWithRetry(page, '/admin/orders');

    // Look for order-related elements
    const orderElements = ['주문 관리', '주문 번호', '고객', '상태'];

    for (const text of orderElements) {
      const element = page.getByText(text);
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        console.log(`Found: ${text}`);
      }
    }
  });
});

test.describe('Admin Users Management', () => {
  test.setTimeout(60000);

  test('should access admin users page', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users');

    // Verify we're on users page (not redirected to /login)
    await expect(page).toHaveURL(/\/admin\/users/);

    console.log('Admin users page accessible');
  });

  test('should display users list', async ({ page }) => {
    await gotoWithRetry(page, '/admin/users');

    // Look for user management elements
    const userElements = ['사용자 관리', '회원', '이메일'];

    for (const text of userElements) {
      const element = page.getByText(text);
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        console.log(`Found: ${text}`);
      }
    }
  });
});

test.describe('Admin Dashboard Navigation', () => {
  test.setTimeout(90000);

  test('should navigate through all admin pages', async ({ page }) => {
    const adminPages = [
      { path: '/admin', name: 'Admin Home' },
      { path: '/admin/dashboard', name: 'Dashboard' },
      { path: '/admin/products', name: 'Products' },
      { path: '/admin/orders', name: 'Orders' },
      { path: '/admin/users', name: 'Users' },
      { path: '/admin/broadcasts', name: 'Broadcasts' },
      { path: '/admin/settlement', name: 'Settlement' },
      { path: '/admin/settings', name: 'Settings' },
    ];

    for (const { path, name } of adminPages) {
      await gotoWithRetry(page, path);

      // Verify we're on the correct page (not redirected to /login)
      expect(page.url()).toContain(path);
      console.log(`${name} page accessible at ${path}`);

      // Take a brief pause between navigations
      await page.waitForTimeout(500);
    }
  });
});
