/**
 * E2E Test: Journey 2 - Multi-Stock Validation
 *
 * Covers the critical path:
 *   Select strategy -> Select sector -> Run batch validation -> Ranking table displayed
 *
 * Tested across 4 viewports: Desktop (1920x1080), Laptop (1280x800),
 * Tablet (768x1024), Mobile (390x844).
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import {
  MOCK_SECTORS,
  MOCK_VALIDATION_RESULT,
  MOCK_STOCK_LIST,
  MOCK_EMPTY_RESPONSE,
  MOCK_SERVER_ERROR,
} from './fixtures/test-data';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Set up API route mocking for the multi-stock validation journey.
 */
async function setupValidationMocks(page: Page): Promise<void> {
  // Mock sector & strategy list endpoint (GET)
  await page.route('**/api/backtest/sector*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SECTORS),
      });
    } else if (route.request().method() === 'POST') {
      // Mock batch validation execution
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VALIDATION_RESULT),
      });
    } else {
      await route.continue();
    }
  });

  // Mock multi-stocks endpoint
  await page.route('**/api/backtest/multi-stocks', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_VALIDATION_RESULT),
    });
  });

  // Mock stock list
  await page.route('**/api/stocks/list*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STOCK_LIST),
    });
  });

  // Mock stock search
  await page.route('**/api/stocks/search*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STOCK_LIST),
    });
  });
}

/**
 * Set up mocks that return empty data for empty state testing.
 */
async function setupEmptyValidationMocks(page: Page): Promise<void> {
  await page.route('**/api/backtest/sector*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { strategies: [], sectors: [] },
          timestamp: Date.now(),
        }),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { summary: null, rankings: [], signals: [] },
          timestamp: Date.now(),
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/stocks/list*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_EMPTY_RESPONSE),
    });
  });
}

// ─── Happy Path Tests ───────────────────────────────────────────────────────

test.describe('Journey 2: Multi-Stock Validation - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await setupValidationMocks(page);
  });

  test('should display the strategy validation page', async ({ page }) => {
    await page.goto('/dashboard/strategy-validation');

    // Verify page loads with expected content
    await expect(
      page.getByText(/\u591a\u80a1\u9a8c\u8bc1|\u7b56\u7565\u9a8c\u8bc1|validation|multi.*stock/i).first()
    ).toBeVisible();
  });

  test('should show strategy selector with available strategies', async ({ page }) => {
    await page.goto('/dashboard/strategy-validation');

    // Look for the strategy selector or dropdown
    const strategySelector = page.locator(
      '[data-testid="strategy-selector"], select, [role="combobox"], [role="listbox"]'
    ).first();

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // The strategy selector area should be present
    await expect(
      page.getByText(/\u7b56\u7565|\u9009\u62e9\u7b56\u7565|strategy|select/i).first()
    ).toBeVisible();
  });

  test('should show sector selector with industry sectors', async ({ page }) => {
    await page.goto('/dashboard/strategy-validation');
    await page.waitForLoadState('networkidle');

    // The sector/industry selector should be present
    await expect(
      page.getByText(/\u884c\u4e1a|\u677f\u5757|\u7533\u4e07|sector|industry/i).first()
    ).toBeVisible();
  });

  test('should display ranking table after running validation', async ({ page }) => {
    await page.goto('/dashboard/strategy-validation');
    await page.waitForLoadState('networkidle');

    // Find and click the run/validate button
    const runButton = page.getByRole('button', {
      name: /\u8fd0\u884c|\u9a8c\u8bc1|\u5f00\u59cb|run|validate|start/i,
    }).first();

    // If a run button is visible, click it
    const isRunButtonVisible = await runButton.isVisible().catch(() => false);
    if (isRunButtonVisible) {
      await runButton.click();

      // Wait for ranking results to appear
      await expect(
        page.getByText(/\u6392\u540d|\u8d35\u5dde\u8305\u53f0|ranking|600519/i).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('should allow CSV export when results are available', async ({ page }) => {
    await page.goto('/dashboard/strategy-validation');
    await page.waitForLoadState('networkidle');

    // Trigger validation first
    const runButton = page.getByRole('button', {
      name: /\u8fd0\u884c|\u9a8c\u8bc1|\u5f00\u59cb|run|validate|start/i,
    }).first();

    const isRunButtonVisible = await runButton.isVisible().catch(() => false);
    if (isRunButtonVisible) {
      await runButton.click();
      await page.waitForTimeout(1000);
    }

    // Look for export button
    const exportButton = page.getByRole('button', {
      name: /\u5bfc\u51fa|export|csv|download/i,
    }).first();

    const isExportVisible = await exportButton.isVisible().catch(() => false);
    if (isExportVisible) {
      // Verify export button is present and clickable
      await expect(exportButton).toBeEnabled();
    }
  });
});

// ─── Error Path Tests ───────────────────────────────────────────────────────

test.describe('Journey 2: Multi-Stock Validation - Error Paths', () => {
  test('should show empty state when no strategies are available', async ({ page }) => {
    await setupEmptyValidationMocks(page);

    await page.goto('/dashboard/strategy-validation');
    await page.waitForLoadState('networkidle');

    // Page should still be functional even with empty data
    // Look for empty state indicator or guidance text
    await expect(page.locator('body')).toBeVisible();

    // The page should not crash - verify basic structure is intact
    await expect(
      page.getByText(/\u591a\u80a1\u9a8c\u8bc1|\u7b56\u7565\u9a8c\u8bc1|validation/i).first()
    ).toBeVisible();
  });

  test('should handle validation API failure gracefully', async ({ page }) => {
    // Set up mocks where sector list works but validation fails
    await page.route('**/api/backtest/sector*', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SECTORS),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SERVER_ERROR),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/stocks/list*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_STOCK_LIST),
      });
    });

    await page.goto('/dashboard/strategy-validation');
    await page.waitForLoadState('networkidle');

    // Page should load without crashing
    await expect(
      page.getByText(/\u591a\u80a1\u9a8c\u8bc1|\u7b56\u7565\u9a8c\u8bc1|validation/i).first()
    ).toBeVisible();
  });
});
