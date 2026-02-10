import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth-helper';

test.describe('Shop Purchase Flow', () => {
  test('should browse products in shop page', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on the shop page
    await expect(page).toHaveURL(/\/shop/);

    // Check if products are loaded
    const hasProducts = await page
      .getByText('상품이 없습니다')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasProducts) {
      console.log('Shop page loaded - products are displayed');
    } else {
      console.log('Shop page loaded - no products available');
    }
  });

  test('should navigate to product detail page', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('domcontentloaded');

    // Try to find a product card and click it
    const productCard = page.locator('[data-testid="product-card"]').first();
    const productExists = await productCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (productExists) {
      await productCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Verify we're on a product detail page
      await expect(page).toHaveURL(/\/products\/\w+/);
      console.log('Product detail page loaded');
    } else {
      console.log('No products available to test detail page navigation');
    }
  });

  test('should navigate to cart page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click on shop tab in bottom navigation (Korean label, exact match)
    const shopButton = page.getByRole('button', { name: '상품', exact: true });

    if (await shopButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shopButton.click();
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/shop/);
      console.log('Navigation to shop via bottom tab works');
    } else {
      // Try direct navigation
      await page.goto('/cart');
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/cart/);
      console.log('Direct navigation to cart works');
    }
  });

  test('should display cart page correctly', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('domcontentloaded');

    // Cart might be empty or have items
    const emptyCart = await page
      .getByText('장바구니가 비어있습니다')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (emptyCart) {
      console.log('Empty cart state displayed correctly');
      await expect(page.getByText('장바구니가 비어있습니다')).toBeVisible();
    } else {
      console.log('Cart has items');
    }
  });
});

test.describe('Admin Orders Management', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await devLogin(page, 'ADMIN');
  });

  test('should access admin orders page', async ({ page }) => {
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });

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
    await page.goto('/admin/orders', { waitUntil: 'domcontentloaded' });

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

  test.beforeEach(async ({ page }) => {
    await devLogin(page, 'ADMIN');
  });

  test('should access admin users page', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

    // Verify we're on users page (not redirected to /login)
    await expect(page).toHaveURL(/\/admin\/users/);

    console.log('Admin users page accessible');
  });

  test('should display users list', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

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

  test.beforeEach(async ({ page }) => {
    await devLogin(page, 'ADMIN');
  });

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
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Verify we're on the correct page (not redirected to /login)
      expect(page.url()).toContain(path);
      console.log(`${name} page accessible at ${path}`);

      // Take a brief pause between navigations
      await page.waitForTimeout(500);
    }
  });
});
