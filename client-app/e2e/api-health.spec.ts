import { test, expect } from '@playwright/test';

test.describe('API Health Check', () => {
  test('should have working API proxy', async ({ request }) => {
    const response = await request.get('/api/v1/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('status', 'ok');
  });

  test('should load page without API errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto('/');

    // Wait for network to be idle
    await page.waitForLoadState('domcontentloaded');

    // Check that there are no critical API errors
    const hasCriticalErrors = consoleErrors.some(
      (error) =>
        error.includes('Failed to fetch') || error.includes('API') || error.includes('500'),
    );

    expect(hasCriticalErrors).toBe(false);
    expect(pageErrors.length).toBe(0);
  });
});
