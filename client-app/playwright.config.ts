import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing against ngrok deployment
 * Test URL: https://unossified-georgie-smeeky.ngrok-free.dev
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://unossified-georgie-smeeky.ngrok-free.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: undefined, // No need to start server - using ngrok URL
});
