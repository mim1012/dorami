import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Check if the page title contains "Live Commerce"
    await expect(page).toHaveTitle(/Live Commerce/, { timeout: 10000 });
  });

  test('should display navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Check for bottom navigation tabs (Korean labels, exact match to avoid category button conflicts)
    await expect(page.getByRole('button', { name: '홈', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '장바구니', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '라이브', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '마이', exact: true })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should navigate to different tabs', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Wait for navigation to be visible
    const shopButton = page.getByRole('button', { name: '장바구니', exact: true });
    await expect(shopButton).toBeVisible({ timeout: 10000 });

    // Navigate to Shop
    await shopButton.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/cart/);

    // Navigate to Live
    // The live tab calls the API: if a stream is active it navigates to /live/{streamKey},
    // if not it shows a toast and stays on the current page.
    const liveButton = page.getByRole('button', { name: '라이브', exact: true });
    await expect(liveButton).toBeVisible({ timeout: 10000 });
    const urlBeforeLive = page.url();
    await liveButton.click();
    await page.waitForLoadState('domcontentloaded');
    // Accept either: navigated to /live/{streamKey}, or stayed on previous page (no active stream)
    const urlAfterLive = page.url();
    const navigatedToLive = /\/live\//.test(urlAfterLive);
    const stayedOnPreviousPage = urlAfterLive === urlBeforeLive || /\/cart/.test(urlAfterLive);
    expect(navigatedToLive || stayedOnPreviousPage).toBeTruthy();

    // Navigate back to Home
    const homeButton = page.getByRole('button', { name: '홈', exact: true });
    await expect(homeButton).toBeVisible({ timeout: 10000 });
    await homeButton.click();
    await page.waitForLoadState('domcontentloaded');
    // Match home page URL (either just "/" or with query params)
    await expect(page).toHaveURL(/\/$/);
  });
});
