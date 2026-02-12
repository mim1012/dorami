import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing
 *
 * Two projects:
 *   - user:  일반 사용자 storageState, admin-* 제외 테스트 실행
 *   - admin: 관리자 storageState, admin-* 테스트만 실행
 *
 * 실행 예시:
 *   npx playwright test                  # 전체 (사용자 + 관리자)
 *   npx playwright test --project=user   # 사용자만
 *   npx playwright test --project=admin  # 관리자만
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
      testIgnore: /admin-.*\.spec\.ts/,
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/admin.json',
      },
      testMatch: /admin-.*\.spec\.ts/,
    },
  ],
});
