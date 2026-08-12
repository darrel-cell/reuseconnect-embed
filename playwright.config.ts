import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the embed portal.
 *
 * These exist because of one specific class of bug. The dashboard once crashed
 * on `undefined.toFixed()` — a component reading a response field the backend had
 * stopped sending — and with no error boundary the partner's customer saw a blank
 * iframe. Neither `tsc` nor the API-level suite could see it: the app's own copy
 * of the type still declared the removed field, so the compiler was satisfied,
 * and nothing in the API suite renders a page.
 *
 * So the assertions here are deliberately about *rendering*: every spec fails on
 * an uncaught page error, and the fixtures mirror the real API responses. The
 * server side of that contract is asserted separately, in the backend's
 * `e2e/embed-access.ts`.
 *
 * Runs against the built output rather than the dev server, so what is tested is
 * what would ship.
 */
export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: 'http://localhost:4181',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run build && npx vite preview --port 4181 --strictPort',
    url: 'http://localhost:4181',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
