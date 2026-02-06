import { test, expect } from '@playwright/test';
import { gotoWithNgrokHandling } from './helpers/ngrok-helper';

test.describe('Home Page', () => {
  test('should load the home page successfully', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for React hydration

    // Check if the page title contains "Live Commerce"
    await expect(page).toHaveTitle(/Live Commerce/, { timeout: 10000 });
  });

  test('should display navigation tabs', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for React hydration

    // Check for bottom navigation tabs with increased timeout
    await expect(page.getByRole('button', { name: /Home/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Shop/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Live/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /My Page/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to different tabs', async ({ page }) => {
    await gotoWithNgrokHandling(page, '/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for React hydration

    // Wait for navigation to be visible
    const shopButton = page.getByRole('button', { name: /Shop/i });
    await expect(shopButton).toBeVisible({ timeout: 10000 });

    // Navigate to Shop
    await shopButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/shop/);

    // Navigate to Live
    const liveButton = page.getByRole('button', { name: /Live/i });
    await expect(liveButton).toBeVisible({ timeout: 10000 });
    await liveButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/live/);

    // Navigate back to Home
    const homeButton = page.getByRole('button', { name: /Home/i });
    await expect(homeButton).toBeVisible({ timeout: 10000 });
    await homeButton.click();
    await page.waitForLoadState('networkidle');
    // Match home page URL (either just "/" or with query params)
    await expect(page).toHaveURL(/\/$/);
  });
});
