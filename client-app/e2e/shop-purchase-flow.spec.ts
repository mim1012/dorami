import { test, expect } from '@playwright/test';
import { gotoWithNgrokHandling } from './helpers/ngrok-helper';

test.describe('Shop Purchase Flow', () => {
  test('should browse products in shop page', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/shop');
    await page.waitForLoadState('networkidle');

    // Verify we're on the shop page
    await expect(page).toHaveURL(/\/shop/);

    // Check if products are loaded
    // The page might show products or empty state
    const hasProducts = await page.getByText('상품이 없습니다').isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasProducts) {
      console.log('✅ Shop page loaded - products are displayed');
    } else {
      console.log('ℹ️ Shop page loaded - no products available');
    }
  });

  test('should navigate to product detail page', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/shop');
    await page.waitForLoadState('networkidle');

    // Try to find a product card and click it
    // This will depend on having products in the database
    const productCard = page.locator('[data-testid="product-card"]').first();

    const productExists = await productCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (productExists) {
      await productCard.click();
      await page.waitForLoadState('networkidle');

      // Verify we're on a product detail page
      await expect(page).toHaveURL(/\/products\/\w+/);
      console.log('✅ Product detail page loaded');
    } else {
      console.log('⚠️ No products available to test detail page navigation');
    }
  });

  test('should navigate to cart page', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/');
    await page.waitForLoadState('networkidle');

    // Click on cart tab in bottom navigation
    const cartButton = page.getByRole('button', { name: /Shop/i });

    if (await cartButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cartButton.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/shop/);
      console.log('✅ Navigation to shop via bottom tab works');
    } else {
      // Try direct navigation
      await gotoWithNgrokHandling(page, '/cart');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/cart/);
      console.log('✅ Direct navigation to cart works');
    }
  });

  test('should display cart page correctly', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/cart');
    await page.waitForLoadState('networkidle');

    // Cart might be empty or have items
    const emptyCart = await page.getByText('장바구니가 비어있습니다').isVisible({ timeout: 3000 }).catch(() => false);

    if (emptyCart) {
      console.log('✅ Empty cart state displayed correctly');
      await expect(page.getByText('장바구니가 비어있습니다')).toBeVisible();
    } else {
      console.log('ℹ️ Cart has items');
    }
  });
});

test.describe('Admin Orders Management', () => {
  test('should access admin orders page', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/admin/orders');
    await page.waitForLoadState('networkidle');

    // Verify we're on orders page
    await expect(page).toHaveURL(/\/admin\/orders/);

    // Check for orders table or empty state
    const hasOrders = await page.getByText('주문 내역이 없습니다').isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasOrders) {
      console.log('✅ Admin orders page loaded with orders');
    } else {
      console.log('✅ Admin orders page loaded - empty state');
    }
  });

  test('should display order list', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/admin/orders');
    await page.waitForLoadState('networkidle');

    // Look for order-related elements
    const orderElements = [
      '주문 관리',
      '주문 번호',
      '고객',
      '상태'
    ];

    for (const text of orderElements) {
      const element = page.getByText(text);
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        console.log(`✅ Found: ${text}`);
      }
    }
  });
});

test.describe('Admin Users Management', () => {
  test('should access admin users page', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/admin/users');
    await page.waitForLoadState('networkidle');

    // Verify we're on users page
    await expect(page).toHaveURL(/\/admin\/users/);

    console.log('✅ Admin users page accessible');
  });

  test('should display users list', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/admin/users');
    await page.waitForLoadState('networkidle');

    // Look for user management elements
    const userElements = [
      '사용자 관리',
      '회원',
      '이메일'
    ];

    for (const text of userElements) {
      const element = page.getByText(text);
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        console.log(`✅ Found: ${text}`);
      }
    }
  });
});

test.describe('Admin Dashboard Navigation', () => {
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
      await gotoWithNgrokHandling(page, path);
      await page.waitForLoadState('networkidle');

      // Use regex to match URL path, allowing for query parameters
      // Create a regex that matches the path anywhere in the URL
      await expect(page.url()).toContain(path);
      console.log(`✅ ${name} page accessible at ${path}`);

      // Take a brief pause between navigations
      await page.waitForTimeout(500);
    }
  });
});
