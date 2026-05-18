/**
 * E2E: Sprint 0 + Sprint 1 改进的行为 & 边缘场景验收
 *
 * 覆盖 20 个用例,跨 5 个 surface:
 *   - 主题 v2 (cookie SSR、dropdown 切换、data-theme 反映、cookie 损坏退化)
 *   - 首 prompt chips + enhance (append、组合、空 / 401 / 502 / 空字符串错误路径)
 *   - Marketplace 卡片 (年化 hero、教育用途、未成熟 OOS 角标、null annual return)
 *   - Time Travel 工具栏 (0 草稿不显示)
 *
 * 设计原则:
 *   1. 所有外部 API mock,不依赖真 LLM / DB / wallet
 *   2. 边缘情况"优雅处理"——失败/空值/异常输入都要测
 *   3. test.describe.configure({ mode: 'parallel' }) 强制 per-test context 隔离,
 *      否则 theme cookie + zustand localStorage 会在 test 间泄漏
 *
 * 跑法:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 \
 *     bun run test:e2e tests/e2e/sprint-improvements.spec.ts \
 *     --project=desktop --workers=2
 *
 *   workers=2 是经过验证的稳定下限(单 dev server 同时服务 4+ ctx 会出请求堆积),
 *   workers=1 也稳但慢一倍。
 */
import { test, expect, type Page, type Route } from "@playwright/test";

// Force per-test browser context isolation. Without this, theme cookies and
// localStorage state from earlier tests leak forward and cause cascading
// false failures even when each test passes in isolation.
test.describe.configure({ mode: "parallel" });

// ─── shared helpers ─────────────────────────────────────────────────────────

/**
 * Stub the very common chatter that the dashboard fires off on mount so the
 * SUT (system under test) doesn't time out waiting for a wallet / quota /
 * usage check that has no business being involved in these specs.
 */
async function stubAmbientNoise(page: Page): Promise<void> {
  // Per-test isolation: each test starts with a clean cookie jar so cookies
  // set by earlier tests (esp. theme cookies) can't leak forward.
  await page.context().clearCookies();
  // NextAuth session endpoint — anonymous response, with the `*` glob so
  // both `/api/auth/session` and `/api/auth/session?update=true` hit the
  // stub. Without this stub useSession() can sit at 'loading' forever
  // and useUserWorkspace.isReady never flips → dashboard stuck on
  // "Loading workspace..." placeholder.
  await page.route("**/api/auth/session*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    }),
  );
  // The first-visit WelcomeFlow dialog blocks every interactive test in this
  // suite by sitting on a modal overlay. Seed the user-preferences zustand
  // persist key so the gate sees "already completed" before render — much
  // more reliable than clicking the close button after the fact.
  //
  // Storage key per createPersistedStore: `lucrum:${name}`. Use version=3 to
  // match the current store version and skip the migrate path (which has
  // surprising behaviour on partially-seeded state).
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "lucrum:user-preferences",
        JSON.stringify({ state: { hasCompletedOnboarding: true }, version: 3 }),
      );
    } catch {
      /* private mode → onboarding will show, oh well */
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 主题 v2 — cookie SSR + dropdown + DOM 反映
// ════════════════════════════════════════════════════════════════════════════

test.describe("Theme system v2", () => {
  test.beforeEach(async ({ page }) => {
    await stubAmbientNoise(page);
  });

  test("首次访问无 cookie → data-theme=terminal-pro", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "terminal-pro");
  });

  test("cookie=cyberpunk → 首屏 data-theme=cyberpunk (无 FOUC)", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "lucrum-theme",
        value: "cyberpunk",
        url: "http://localhost:3002",
      },
    ]);
    await page.goto("/dashboard");
    const html = page.locator("html");
    // SSR contract: attribute is set before first paint, so it's visible
    // immediately without any JS having run.
    await expect(html).toHaveAttribute("data-theme", "cyberpunk");
  });

  test("cookie 值损坏 → 退回 terminal-pro,不抛错", async ({ page, context }) => {
    await context.addCookies([
      { name: "lucrum-theme", value: "bogus-value", url: "http://localhost:3002" },
    ]);
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "terminal-pro");
  });

  test("dropdown 切换 → data-theme 即时变化", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    // Switcher 显示当前 label "终端 Pro"
    const switcher = page.getByRole("button", {
      name: /切换主题，当前/,
    });
    await expect(switcher).toBeVisible({ timeout: 15_000 });
    await switcher.click();
    // 下拉应有 2 个主题选项
    const cyberpunkItem = page.getByRole("menuitem", { name: /霓虹/ });
    await expect(cyberpunkItem).toBeVisible();
    await cyberpunkItem.click();
    // data-theme 立即更新
    await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
  });

  test("切换后硬刷新 → 仍是新主题 (cookie 持久化)", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page
      .getByRole("button", { name: /切换主题，当前/ })
      .click();
    await page.getByRole("menuitem", { name: /霓虹/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
    // 等 cookie 写入再刷新
    await page.waitForTimeout(150);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 首 prompt chips + enhance
// ════════════════════════════════════════════════════════════════════════════

test.describe("Strategy input — chips + enhance", () => {
  test.beforeEach(async ({ page }) => {
    await stubAmbientNoise(page);
  });

  test("5 个叙事 chip 全部可见", async ({ page }) => {
    await page.goto("/dashboard");
    // textarea 必须先在
    await expect(page.locator("textarea").first()).toBeVisible({
      timeout: 15_000,
    });
    for (const label of [
      "抓涨停",
      "跟北向",
      "周期轮动",
      "高股息",
      "业绩超预期",
    ]) {
      await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
    }
  });

  test("chip 点击 → 文本 append 到空 textarea (无前导逗号)", async ({ page }) => {
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("");
    await page.getByRole("button", { name: /跟北向/ }).click();
    const val = await textarea.inputValue();
    expect(val).toMatch(/^买入北向资金/);
    expect(val.startsWith("，")).toBe(false);
  });

  test("两次 chip 点击 → 用「，」分隔,不替换", async ({ page }) => {
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("");
    await page.getByRole("button", { name: /跟北向/ }).click();
    await page.getByRole("button", { name: /高股息/ }).click();
    const val = await textarea.inputValue();
    expect(val).toContain("买入北向资金");
    expect(val).toContain("买入连续 3 年股息率");
    expect(val.split("，").length).toBeGreaterThanOrEqual(2);
  });

  test("enhance 按钮: 空 textarea → 禁用", async ({ page }) => {
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("");
    const enhanceBtn = page.getByRole("button", { name: /把它变专业/ });
    await expect(enhanceBtn).toBeDisabled();
  });

  test("enhance 成功 → textarea 被 LLM 改写结果替换", async ({ page }) => {
    await page.route("**/api/strategy/enhance", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            enhanced:
              "标的范围: 沪深 300 成分股。周期: 日线。入场: 5/20 双均线金叉。出场: 死叉或止损 5%。",
            model: "test-model",
            fallbackUsed: false,
          },
        }),
      }),
    );
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await textarea.fill("均线交叉");
    await page.getByRole("button", { name: /把它变专业/ }).click();
    await expect(textarea).toHaveValue(/标的范围: 沪深 300/, { timeout: 5000 });
  });

  test("enhance 401 → inline 错误提示,textarea 不变", async ({ page }) => {
    await page.route("**/api/strategy/enhance", (route: Route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAUTHORIZED", title: "未登录", description: "请先登录" },
        }),
      }),
    );
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await textarea.fill("均线交叉测试");
    await page.getByRole("button", { name: /把它变专业/ }).click();
    // 原文本保留 + 出现 "enhance 失败" 提示
    await expect(textarea).toHaveValue("均线交叉测试");
    await expect(page.getByText(/enhance 失败/)).toBeVisible({ timeout: 5000 });
  });

  test("enhance 502 → 同样优雅展示,不影响后续操作", async ({ page }) => {
    await page.route("**/api/strategy/enhance", (route: Route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: { description: "AI 服务暂时不可用" },
        }),
      }),
    );
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await textarea.fill("test");
    await page.getByRole("button", { name: /把它变专业/ }).click();
    await expect(page.getByText(/enhance 失败/)).toBeVisible({ timeout: 5000 });
    // 用户应能继续修改 textarea
    await textarea.fill("changed");
    await expect(textarea).toHaveValue("changed");
  });

  test("enhance 返回空字符串 → 也是 error,不静默清空", async ({ page }) => {
    await page.route("**/api/strategy/enhance", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { enhanced: "" } }),
      }),
    );
    await page.goto("/dashboard");
    const textarea = page.locator("textarea").first();
    await textarea.fill("原始描述");
    await page.getByRole("button", { name: /把它变专业/ }).click();
    // textarea 不应被清空; 错误应可见
    await expect(textarea).toHaveValue("原始描述");
    await expect(page.getByText(/enhance 失败/)).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Time Travel — 0 草稿时应隐藏,非禁用
// ════════════════════════════════════════════════════════════════════════════

test.describe("Time-Travel toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await stubAmbientNoise(page);
  });

  test("首次访问无草稿 → '版本' 按钮不在 DOM", async ({ page }) => {
    await page.context().clearCookies();
    // 显式清 localStorage 以保证 drafts 为 []
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* 隐身模式可能拒绝 */
      }
    });
    await page.goto("/dashboard");
    // toolbar 应已渲染
    await expect(
      page.getByRole("button", { name: /历史/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
    // 但 "版本" 不应存在 (隐藏,非 disabled)
    const versionBtn = page.getByRole("button", { name: /^版本/ });
    await expect(versionBtn).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Marketplace 卡片 — 年化 hero + 教育用途 + 未成熟 OOS 角标
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketplace card layout + OOS badge", () => {
  /**
   * Construct a mock /api/lurus/marketplace/list payload covering the four
   * publishedAt cases we care about:
   *   - 5 days old   → immature, 85 days remaining
   *   - 200 days old → vetted, no badge
   *   - null         → unknown, "未上架记录"
   *   - negative annualReturn → loss color + no "+" sign
   */
  function buildMockList() {
    const now = Date.now();
    const fiveDaysAgo = new Date(now - 5 * 86_400_000).toISOString();
    const twoHundredDaysAgo = new Date(now - 200 * 86_400_000).toISOString();
    const strategies = [
        {
          id: 1,
          title: "近期新策略 5 天",
          description: null,
          priceType: "free",
          pricePerRun: 0,
          priceMonthly: 0,
          gradeScore: "A",
          totalRuns: 12,
          totalSubscribers: 3,
          publishedAt: fiveDaysAgo,
          authorName: "tester",
          annualizedReturn: 12.5,
          winRate: 55,
          maxDrawdown: -8,
          sharpeRatio: 1.1,
          rating: 4.0,
          ratingCount: 0,
          forkCount: 0,
          school: "trend",
        },
        {
          id: 2,
          title: "老牌成熟策略 200 天",
          description: null,
          priceType: "free",
          pricePerRun: 0,
          priceMonthly: 0,
          gradeScore: "S",
          totalRuns: 999,
          totalSubscribers: 200,
          publishedAt: twoHundredDaysAgo,
          authorName: "veteran",
          annualizedReturn: 24.8,
          winRate: 65,
          maxDrawdown: -6,
          sharpeRatio: 1.85,
          rating: 4.7,
          ratingCount: 80,
          forkCount: 50,
          school: "value",
        },
        {
          id: 3,
          title: "无上架时间策略",
          description: null,
          priceType: "free",
          pricePerRun: 0,
          priceMonthly: 0,
          gradeScore: "B",
          totalRuns: 5,
          totalSubscribers: 1,
          publishedAt: null,
          authorName: null,
          annualizedReturn: null,
          winRate: null,
          maxDrawdown: null,
          sharpeRatio: null,
          rating: null,
          ratingCount: null,
          forkCount: null,
          school: null,
        },
        {
          id: 4,
          title: "亏损策略测试",
          description: null,
          priceType: "free",
          pricePerRun: 0,
          priceMonthly: 0,
          gradeScore: "D",
          totalRuns: 2,
          totalSubscribers: 0,
          publishedAt: twoHundredDaysAgo,
          authorName: "tester",
          annualizedReturn: -7.3,
          winRate: 30,
          maxDrawdown: -22,
          sharpeRatio: -0.5,
          rating: 2.0,
          ratingCount: 5,
          forkCount: 1,
          school: "trend",
        },
    ];
    return { strategies, total: strategies.length };
  }

  test.beforeEach(async ({ page }) => {
    await stubAmbientNoise(page);
    await page.route("**/api/lurus/marketplace/list*", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockList()),
      }),
    );
  });

  test("每张卡有 '教育用途' 合规角标", async ({ page }) => {
    await page.goto("/dashboard/marketplace");
    const titles = ["近期新策略", "老牌成熟策略", "无上架时间", "亏损策略"];
    for (const t of titles) {
      const card = page.locator(`text=${t}`).first().locator("..").locator("..");
      await expect(card.getByText("教育用途").first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("< 90 天的策略显示未成熟 OOS 角标", async ({ page }) => {
    await page.goto("/dashboard/marketplace");
    const recentCard = page
      .locator("text=近期新策略 5 天")
      .first()
      .locator("..")
      .locator("..");
    await expect(recentCard.getByText(/未成熟 · OOS 还需/)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("> 90 天的策略不应显示 OOS 角标", async ({ page }) => {
    await page.goto("/dashboard/marketplace");
    const oldCard = page
      .locator("text=老牌成熟策略 200 天")
      .first()
      .locator("..")
      .locator("..");
    // OOS 黄色 pill 不应存在于这张卡内
    await expect(oldCard.getByText(/未成熟/)).toHaveCount(0);
  });

  test("publishedAt=null 的策略显示 '未上架记录'", async ({ page }) => {
    await page.goto("/dashboard/marketplace");
    const unknownCard = page
      .locator("text=无上架时间策略")
      .first()
      .locator("..")
      .locator("..");
    await expect(unknownCard.getByText(/未上架记录/)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("annualReturn 负值 → 显示不带 '+' 号", async ({ page }) => {
    await page.goto("/dashboard/marketplace");
    const lossCard = page
      .locator("text=亏损策略测试")
      .first()
      .locator("..")
      .locator("..");
    // 期望显示 "-7.3%",不带 "+"
    await expect(lossCard.getByText(/-7\.3%/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("annualReturn=null → 显示 '--' 不崩", async ({ page }) => {
    await page.goto("/dashboard/marketplace");
    const noMetricCard = page
      .locator("text=无上架时间策略")
      .first()
      .locator("..")
      .locator("..");
    await expect(noMetricCard.getByText("--").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
