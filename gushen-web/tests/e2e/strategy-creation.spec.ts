/**
 * E2E Test: Journey 1 - Strategy Creation & Backtest (Core Flow)
 *
 * Covers the critical path:
 *   Input strategy description -> Generate code -> Select stock -> Run backtest -> See ScoreCard
 *
 * Tested across 4 viewports: Desktop (1920x1080), Laptop (1280x800),
 * Tablet (768x1024), Mobile (390x844).
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import {
  MOCK_STRATEGY_GENERATE_RESPONSE,
  MOCK_BACKTEST_RESULT,
  MOCK_STOCK_LIST,
  MOCK_SERVER_ERROR,
} from './fixtures/test-data';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Set up API route mocking for the strategy creation journey.
 * Intercepts all relevant API calls with deterministic mock responses.
 */
async function setupStrategyCreationMocks(page: Page): Promise<void> {
  // Mock strategy generation endpoint
  await page.route('**/api/strategy/generate', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STRATEGY_GENERATE_RESPONSE),
    });
  });

  // Mock backtest execution endpoint
  await page.route('**/api/backtest', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BACKTEST_RESULT),
      });
    } else {
      await route.continue();
    }
  });

  // Mock stock list endpoint
  await page.route('**/api/stocks/list*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STOCK_LIST),
    });
  });

  // Mock stock search endpoint
  await page.route('**/api/stocks/search*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STOCK_LIST),
    });
  });

  // Mock history save endpoint (non-critical)
  await page.route('**/api/history', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock backtest sector endpoint (used for strategy list)
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
    } else {
      await route.continue();
    }
  });
}

/**
 * Set up API mocking that simulates network failure during generation.
 */
async function setupGenerationFailureMocks(page: Page): Promise<void> {
  await page.route('**/api/strategy/generate', async (route: Route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SERVER_ERROR),
    });
  });

  // Other endpoints still work normally
  await page.route('**/api/backtest', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BACKTEST_RESULT),
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

  await page.route('**/api/history', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

// ─── Happy Path Tests ───────────────────────────────────────────────────────

test.describe('Journey 1: Strategy Creation & Backtest - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await setupStrategyCreationMocks(page);
  });

  test('should display the dashboard with strategy input area', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify page title element is visible
    await expect(page.getByText('AI 策略生成器')).toBeVisible();

    // Verify strategy input area exists
    const strategyInput = page.locator('textarea, [data-testid="strategy-input"]').first();
    await expect(strategyInput).toBeVisible();
  });

  test('should generate strategy code from natural language input', async ({ page }) => {
    await page.goto('/dashboard');

    // Enter strategy description in the input area
    const strategyInput = page.locator('textarea').first();
    await strategyInput.fill('\u5f53KDJ\u5728\u0032\u0030\u4ee5\u4e0b\u91d1\u53c9\u65f6\u4e70\u5165\uff0c\u5728\u0038\u0030\u4ee5\u4e0a\u6b7b\u53c9\u65f6\u5356\u51fa');

    // Click the generate button
    const generateButton = page.getByRole('button', { name: /\u751f\u6210|generate/i }).first();
    await generateButton.click();

    // Wait for code to appear in the code preview area
    await expect(page.getByText('KDJGoldenCrossStrategy').first()).toBeVisible({
      timeout: 10_000,
    });

    // Verify the generated code contains expected content
    await expect(page.getByText('kdj_period').first()).toBeVisible();
  });

  test('should display backtest results with score after running backtest', async ({ page }) => {
    await page.goto('/dashboard');

    // Step 1: Enter strategy and generate code
    const strategyInput = page.locator('textarea').first();
    await strategyInput.fill('\u53cc\u5747\u7ebf\u4ea4\u53c9\u7b56\u7565');

    const generateButton = page.getByRole('button', { name: /\u751f\u6210|generate/i }).first();
    await generateButton.click();

    // Wait for code generation to complete
    await expect(page.getByText('KDJGoldenCrossStrategy').first()).toBeVisible({
      timeout: 10_000,
    });

    // Step 2: Look for the backtest / run button and click it
    const backtestButton = page.getByRole('button', { name: /\u56de\u6d4b|backtest|run|\u8fd0\u884c/i }).first();
    await backtestButton.click();

    // Step 3: Verify backtest results are displayed
    // Wait for result metrics to appear (e.g., total return, Sharpe ratio)
    await expect(
      page.getByText(/32\.5%|18\.7%|\u603b\u6536\u76ca|\u590f\u666e\u6bd4\u7387|total.*return/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('should show strategy templates section', async ({ page }) => {
    await page.goto('/dashboard');

    // The template section should be visible on the page
    await expect(
      page.getByText(/\u7b56\u7565\u6a21\u677f|\u6a21\u677f\u5e93|templates/i).first()
    ).toBeVisible();
  });
});

// ─── Error Path Tests ───────────────────────────────────────────────────────

test.describe('Journey 1: Strategy Creation & Backtest - Error Paths', () => {
  test('should show fallback code when API generation fails', async ({ page }) => {
    await setupGenerationFailureMocks(page);

    await page.goto('/dashboard');

    // Enter strategy description
    const strategyInput = page.locator('textarea').first();
    await strategyInput.fill('\u5747\u7ebf\u4ea4\u53c9\u7b56\u7565');

    // Click generate
    const generateButton = page.getByRole('button', { name: /\u751f\u6210|generate/i }).first();
    await generateButton.click();

    // Wait for error message or fallback code to appear
    // The dashboard page shows fallback code on API failure
    await expect(
      page.getByText(/API.*\u5931\u8d25|\u79bb\u7ebf\u6a21\u5f0f|fallback|AIStrategy/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should handle empty strategy input gracefully', async ({ page }) => {
    await setupStrategyCreationMocks(page);

    await page.goto('/dashboard');

    // Try to click generate without entering text
    const generateButton = page.getByRole('button', { name: /\u751f\u6210|generate/i }).first();

    // The button should be disabled or clicking it should show validation
    const isDisabled = await generateButton.isDisabled();
    if (!isDisabled) {
      await generateButton.click();
      // Expect no crash - page should remain functional
      await expect(page.getByText('AI 策略生成器')).toBeVisible();
    }
  });
});
