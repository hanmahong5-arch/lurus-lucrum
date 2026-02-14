/**
 * Playwright E2E Test Configuration
 *
 * Defines 4 viewport projects covering desktop, laptop, tablet, and mobile.
 * Tests critical user journeys across all viewport sizes.
 */
import { defineConfig, devices } from '@playwright/test';

/** Base URL for the development server */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/** Default timeout for each test (30 seconds) */
const TEST_TIMEOUT_MS = 30_000;

/** Default timeout for navigation actions (15 seconds) */
const NAVIGATION_TIMEOUT_MS = 15_000;

/** Default timeout for action operations like click (10 seconds) */
const ACTION_TIMEOUT_MS = 10_000;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  // Run tests in parallel by file
  fullyParallel: true,

  // Fail the build on CI if test.only is left in source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI to avoid resource contention
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  // Shared settings for all projects
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
  },

  // Test timeout per individual test
  timeout: TEST_TIMEOUT_MS,

  // 4 viewport projects per Story 7.2 acceptance criteria
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'laptop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  // Web server configuration (start dev server before tests)
  webServer: {
    command: 'bun run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
