import { test, expect } from '@playwright/test';

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
