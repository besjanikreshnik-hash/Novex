import { defineConfig, devices } from '@playwright/test';

/**
 * NovEx E2E test configuration.
 *
 * Expects:
 *   - Backend running at http://localhost:3000 (with seeded data)
 *   - Web app running at http://localhost:3001
 *
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,      // sequential — tests share seeded state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                // single worker — order matters
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'off',       // we take manual screenshots for docs
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Uncomment to auto-start web dev server:
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  */
});
