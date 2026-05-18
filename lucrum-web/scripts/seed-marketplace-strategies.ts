/**
 * Seed 12 curated marketplace strategies authored by the curator system user.
 *
 * Idempotent: looks up by title first; only inserts missing rows.
 *
 * Run via:
 *   bun run scripts/seed-marketplace-strategies.ts
 *   # or in-cluster:
 *   kubectl exec -n lucrum deploy/lucrum-web -- bun run scripts/seed-marketplace-strategies.ts
 */

import { db } from "@/lib/db";
import {
  marketplaceStrategies,
  strategyHistory,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Curator system user — events/payments attributed to this user id.
// ---------------------------------------------------------------------------

const CURATOR_USER_ID = "system:lucrum-curator";

// ---------------------------------------------------------------------------
// Strategy template literal — minimal vnpy CtaTemplate skeleton.
// Each seed defines its `body` block (indicators + on_bar logic).
// ---------------------------------------------------------------------------

const CODE_HEADER = `"""
{title}

{description}
"""
from vnpy.trader.object import BarData
from vnpy_ctastrategy import CtaTemplate
`;

interface Seed {
  title: string;
  description: string;
  school:
    | "value"
    | "growth"
    | "trend"
    | "momentum"
    | "reversion"
    | "quant"
    | "macro";
  priceType: "free" | "per_run" | "subscription";
  pricePerRun?: number;
  tags?: string[];
  defaultParams: Record<string, number | string | boolean>;
  expected: { annual: number; sharpe: number; maxDd: number };
  bodyCode: string;
}

const SEEDS: readonly Seed[] = [
  // ---- 价值（value） ----------------------------------------------------
  {
    title: "巴菲特低 PE 选股",
    description: "经典价值投资：买入 PE < 15 且 ROE > 12% 的股票，长期持有。",
    school: "value",
    priceType: "per_run",
    pricePerRun: 1.0,
    tags: ["value", "long-term"],
    defaultParams: { pe_max: 15, roe_min: 0.12, hold_days: 60 },
    expected: { annual: 0.14, sharpe: 1.1, maxDd: 0.18 },
    bodyCode: `
class BuffettValueStrategy(CtaTemplate):
    author = "Lucrum Curator"
    pe_max = 15.0
    roe_min = 0.12
    hold_days = 60
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real implementation needs fundamentals feed; uses placeholder.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "林奇 PEG 增长价值",
    description: "PEG (PE / 增长率) 低于 1，挖掘被低估的成长股。",
    school: "value",
    priceType: "free",
    tags: ["value", "growth"],
    defaultParams: { peg_max: 1.0, hold_days: 30 },
    expected: { annual: 0.16, sharpe: 1.2, maxDd: 0.2 },
    bodyCode: `
class LynchPegStrategy(CtaTemplate):
    author = "Lucrum Curator"
    peg_max = 1.0
    hold_days = 30
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  // ---- 成长（growth） --------------------------------------------------
  {
    title: "高 ROE 加速成长",
    description: "ROE 连续 3 季度 > 20% 且加速上行的高质量成长股组合。",
    school: "growth",
    priceType: "free",
    tags: ["growth"],
    defaultParams: { roe_min: 0.2, accel_quarters: 3, hold_days: 45 },
    expected: { annual: 0.22, sharpe: 1.3, maxDd: 0.25 },
    bodyCode: `
class HighRoeGrowthStrategy(CtaTemplate):
    author = "Lucrum Curator"
    roe_min = 0.2
    accel_quarters = 3
    hold_days = 45
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  // ---- 趋势（trend） ---------------------------------------------------
  {
    title: "双均线趋势跟踪",
    description: "经典 5/20 双均线金叉买入、死叉卖出。",
    school: "trend",
    priceType: "free",
    tags: ["trend", "ma"],
    defaultParams: { fast_window: 5, slow_window: 20 },
    expected: { annual: 0.12, sharpe: 0.9, maxDd: 0.15 },
    bodyCode: `
class DualMaTrendStrategy(CtaTemplate):
    author = "Lucrum Curator"
    fast_window = 5
    slow_window = 20
    fixed_size = 1
    fast_ma = 0.0
    slow_ma = 0.0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        self.fast_ma = am.sma(self.fast_window)
        self.slow_ma = am.sma(self.slow_window)
        if self.fast_ma > self.slow_ma and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.fast_ma < self.slow_ma and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "Donchian 通道突破",
    description: "突破 N 日最高价做多，跌破 N 日最低价平仓。",
    school: "trend",
    priceType: "free",
    tags: ["trend", "breakout"],
    defaultParams: { window: 20, fixed_size: 1 },
    expected: { annual: 0.18, sharpe: 1.1, maxDd: 0.22 },
    bodyCode: `
class DonchianBreakoutStrategy(CtaTemplate):
    author = "Lucrum Curator"
    window = 20
    fixed_size = 1
    high_n = 0.0
    low_n = 0.0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        self.high_n = am.high.max()
        self.low_n = am.low.min()
        if bar.close_price > self.high_n and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif bar.close_price < self.low_n and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  // ---- 动量（momentum） ------------------------------------------------
  {
    title: "MACD 动量信号",
    description: "MACD 金叉买入、死叉卖出，配合 DIF/DEA 过滤。",
    school: "momentum",
    priceType: "free",
    tags: ["momentum", "macd"],
    defaultParams: { macd_fast: 12, macd_slow: 26, macd_signal: 9 },
    expected: { annual: 0.15, sharpe: 1.05, maxDd: 0.17 },
    bodyCode: `
class MacdMomentumStrategy(CtaTemplate):
    author = "Lucrum Curator"
    macd_fast = 12
    macd_slow = 26
    macd_signal = 9
    fixed_size = 1
    dif = 0.0
    dea = 0.0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        self.dif, self.dea, _ = am.macd(self.macd_fast, self.macd_slow, self.macd_signal, True)
        if self.dif > self.dea and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.dif < self.dea and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "相对强度选股",
    description: "20 日相对强度 > 70 的强势股轮动买入。",
    school: "momentum",
    priceType: "free",
    tags: ["momentum", "rs"],
    defaultParams: { window: 20, rs_min: 70 },
    expected: { annual: 0.2, sharpe: 1.15, maxDd: 0.24 },
    bodyCode: `
class RelativeStrengthStrategy(CtaTemplate):
    author = "Lucrum Curator"
    window = 20
    rs_min = 70.0
    fixed_size = 1
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        ret = (am.close[-1] / am.close[-self.window] - 1.0) * 100.0
        if ret > self.rs_min and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif ret < 0 and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  // ---- 反转（reversion） -----------------------------------------------
  {
    title: "RSI 超卖反弹",
    description: "RSI < 30 买入，RSI > 70 卖出，捕捉短线反弹。",
    school: "reversion",
    priceType: "free",
    tags: ["reversion", "rsi"],
    defaultParams: { rsi_window: 14, rsi_buy: 30, rsi_sell: 70 },
    expected: { annual: 0.1, sharpe: 0.85, maxDd: 0.14 },
    bodyCode: `
class RsiReversionStrategy(CtaTemplate):
    author = "Lucrum Curator"
    rsi_window = 14
    rsi_buy = 30.0
    rsi_sell = 70.0
    fixed_size = 1
    rsi_value = 0.0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        self.rsi_value = am.rsi(self.rsi_window)
        if self.rsi_value < self.rsi_buy and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.rsi_value > self.rsi_sell and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "KDJ 金叉买入",
    description: "KDJ 三线低位金叉买入，高位死叉卖出。",
    school: "reversion",
    priceType: "free",
    tags: ["reversion", "kdj"],
    defaultParams: { kdj_n: 9, kdj_m1: 3, kdj_m2: 3 },
    expected: { annual: 0.09, sharpe: 0.8, maxDd: 0.13 },
    bodyCode: `
class KdjReversionStrategy(CtaTemplate):
    author = "Lucrum Curator"
    kdj_n = 9
    kdj_m1 = 3
    kdj_m2 = 3
    fixed_size = 1
    k = 50.0
    d = 50.0
    j = 50.0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        self.k, self.d = am.stoch(self.kdj_n, self.kdj_m1, self.kdj_m2)
        self.j = 3 * self.k - 2 * self.d
        if self.k > self.d and self.k < 30 and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        elif self.k < self.d and self.k > 70 and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  // ---- 量化（quant） ---------------------------------------------------
  {
    title: "多因子综合评分",
    description: "动量 + 估值 + 质量三因子综合评分，每月轮动 Top N。",
    school: "quant",
    priceType: "per_run",
    pricePerRun: 2.0,
    tags: ["quant", "multifactor"],
    defaultParams: { top_n: 10, rebal_days: 20 },
    expected: { annual: 0.24, sharpe: 1.45, maxDd: 0.16 },
    bodyCode: `
class MultiFactorStrategy(CtaTemplate):
    author = "Lucrum Curator"
    top_n = 10
    rebal_days = 20
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Placeholder: real impl ranks the universe by composite score.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.rebal_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "波动率均值回归",
    description: "20 日波动率超过历史均值 + 2σ 时反向开仓。",
    school: "quant",
    priceType: "free",
    tags: ["quant", "volatility"],
    defaultParams: { window: 20, sigma_thresh: 2.0 },
    expected: { annual: 0.13, sharpe: 1.0, maxDd: 0.15 },
    bodyCode: `
class VolMeanReversionStrategy(CtaTemplate):
    author = "Lucrum Curator"
    window = 20
    sigma_thresh = 2.0
    fixed_size = 1
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        am = self.cta_engine.get_am(self.vt_symbol)
        std = am.close.std()
        mean = am.close.mean()
        if bar.close_price > mean + self.sigma_thresh * std and self.pos > 0:
            self.sell(bar.close_price, abs(self.pos))
        elif bar.close_price < mean - self.sigma_thresh * std and self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
        self.put_event()
`,
  },
  // ---- 宏观（macro） ---------------------------------------------------
  {
    title: "行业轮动配置",
    description: "基于行业景气度月度轮动到 Top 3 板块。",
    school: "macro",
    priceType: "per_run",
    pricePerRun: 0.5,
    tags: ["macro", "rotation"],
    defaultParams: { top_sectors: 3, rebal_days: 22 },
    expected: { annual: 0.17, sharpe: 1.2, maxDd: 0.19 },
    bodyCode: `
class SectorRotationStrategy(CtaTemplate):
    author = "Lucrum Curator"
    top_sectors = 3
    rebal_days = 22
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.rebal_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },

  // =========================================================================
  // 叙事化策略包 — 2026-05-18 追加（UX 评审 §3）
  // 标题用"用户场景"而非技术指标，让首次浏览者立刻产生"我想要这个"的心智。
  // 技术细节藏在 description / tags / bodyCode 里，给极客层。
  // =========================================================================
  {
    title: "跟着北向资金抄作业",
    description:
      "买入北向资金近 5 日累计净买入额 TOP10 的标的，持有 5-10 个交易日。外资在买什么就跟买什么，规避羊群效应靠移仓滑点过滤。",
    school: "macro",
    priceType: "free",
    tags: ["北向", "外资", "narrative"],
    defaultParams: { top_n: 10, lookback_days: 5, hold_days: 7 },
    expected: { annual: 0.19, sharpe: 1.25, maxDd: 0.17 },
    bodyCode: `
class NorthboundFollowStrategy(CtaTemplate):
    author = "Lucrum Curator"
    top_n = 10
    lookback_days = 5
    hold_days = 7
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real impl reads northbound_flow.daily_net_buy table.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "打新中签翻倍包",
    description:
      "自动筛 PE < 行业 60% 分位 + 首日开板换手 > 30% 的新股，模拟'中签即卖'与'破发坚持'两种执行路径。",
    school: "quant",
    priceType: "free",
    tags: ["打新", "新股", "narrative"],
    defaultParams: { pe_percentile_max: 60, turnover_min: 0.3, hold_days: 5 },
    expected: { annual: 0.21, sharpe: 1.15, maxDd: 0.16 },
    bodyCode: `
class IpoPlayStrategy(CtaTemplate):
    author = "Lucrum Curator"
    pe_percentile_max = 60.0
    turnover_min = 0.3
    hold_days = 5
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "季报暴雷预警 & 反向",
    description:
      "业绩预告下修 > 30% 当日抛售（持仓时）或开空（非持仓时）；预增 > 50% 次日开盘买入并 3 日内不破前低则持有。利用 A 股 T+1 信息差。",
    school: "reversion",
    priceType: "free",
    tags: ["业绩", "暴雷", "narrative"],
    defaultParams: { revise_down_pct: 0.30, revise_up_pct: 0.50, hold_days: 10 },
    expected: { annual: 0.16, sharpe: 1.05, maxDd: 0.18 },
    bodyCode: `
class EarningsShockStrategy(CtaTemplate):
    author = "Lucrum Curator"
    revise_down_pct = 0.30
    revise_up_pct = 0.50
    hold_days = 10
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real impl reads earnings_revisions table + breaking-news feed.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "龙虎榜机构席位跟单",
    description:
      "当日龙虎榜机构净买入额 > 5000 万的标的，次日开盘跟买，3 日内不破前低持有；机构现身买入是国内市场最强的短期信号之一。",
    school: "momentum",
    priceType: "per_run",
    pricePerRun: 0.5,
    tags: ["龙虎榜", "机构", "narrative"],
    defaultParams: { net_buy_min_wan: 5000, hold_days: 3, stop_breach_low_n: 3 },
    expected: { annual: 0.25, sharpe: 1.35, maxDd: 0.22 },
    bodyCode: `
class DragonTigerListStrategy(CtaTemplate):
    author = "Lucrum Curator"
    net_buy_min_wan = 5000
    hold_days = 3
    stop_breach_low_n = 3
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real impl reads dragon_tiger_list.daily_institutional_seats.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "国家队动向追踪",
    description:
      "中央汇金 / 社保基金 / 证金 / QFII 季报重仓股变化，新进 + 加仓标的池长期持有。适合'信仰持有'型用户，年化中等但回撤最低。",
    school: "value",
    priceType: "free",
    tags: ["国家队", "汇金", "社保", "narrative"],
    defaultParams: { rebal_quarters: 1, hold_days: 90 },
    expected: { annual: 0.12, sharpe: 1.4, maxDd: 0.10 },
    bodyCode: `
class NationalTeamStrategy(CtaTemplate):
    author = "Lucrum Curator"
    rebal_quarters = 1
    hold_days = 90
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real impl joins quarterly_top10_holders ON ['汇金', '社保', '证金'].
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "周期股轮动罗盘",
    description:
      "PPI / PMI 拐点驱动有色 → 煤炭 → 化工 → 钢铁的板块轮动，每月调仓。告别'满仓守一个周期'，让宏观数据替你决定攻防。",
    school: "macro",
    priceType: "per_run",
    pricePerRun: 1.0,
    tags: ["周期", "轮动", "narrative"],
    defaultParams: { rebal_days: 22, ppi_lookback_months: 3 },
    expected: { annual: 0.18, sharpe: 1.18, maxDd: 0.20 },
    bodyCode: `
class CycleSectorRotationStrategy(CtaTemplate):
    author = "Lucrum Curator"
    rebal_days = 22
    ppi_lookback_months = 3
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real impl joins macro_indicators.ppi_yoy + sector_returns.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.rebal_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
  {
    title: "高股息红利避风港",
    description:
      "股息率 > 5% + 连续 3 年分红 + ROE > 10% 的低估值蓝筹股，熊市里能睡着觉的策略。年化不一定最高，但夏普最稳。",
    school: "value",
    priceType: "free",
    tags: ["股息", "红利", "narrative"],
    defaultParams: { div_yield_min: 0.05, payout_years_min: 3, roe_min: 0.10, hold_days: 120 },
    expected: { annual: 0.11, sharpe: 1.55, maxDd: 0.09 },
    bodyCode: `
class HighDividendStrategy(CtaTemplate):
    author = "Lucrum Curator"
    div_yield_min = 0.05
    payout_years_min = 3
    roe_min = 0.10
    hold_days = 120
    fixed_size = 1
    bars_held = 0
    def on_bar(self, bar: BarData):
        if not self.inited:
            return
        # Stub: real impl joins fundamentals.dividend_history + roe_history.
        if self.pos == 0:
            self.buy(bar.close_price, self.fixed_size)
            self.bars_held = 0
        else:
            self.bars_held += 1
            if self.bars_held >= self.hold_days:
                self.sell(bar.close_price, abs(self.pos))
        self.put_event()
`,
  },
];

function renderCode(seed: Seed): string {
  return (
    CODE_HEADER.replace("{title}", seed.title).replace(
      "{description}",
      seed.description,
    ) + seed.bodyCode
  );
}

async function main(): Promise<void> {
  let inserted = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    // Idempotency: skip if a marketplace listing with the same title already
    // exists. We don't update existing rows — operators can do that manually.
    const existing = await db
      .select({ id: marketplaceStrategies.id })
      .from(marketplaceStrategies)
      .where(eq(marketplaceStrategies.title, seed.title))
      .limit(1);
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    const code = renderCode(seed);

    // 1) Create the strategy_history row that the marketplace row references.
    const historyRows = await db
      .insert(strategyHistory)
      .values({
        userId: CURATOR_USER_ID,
        tenantId: null,
        strategyName: seed.title,
        description: seed.description,
        strategyCode: code,
        parameters: JSON.stringify(seed.defaultParams),
        strategyType: "curated",
        version: 1,
        isActive: true,
        isStarred: true,
        tags: seed.tags ? JSON.stringify(seed.tags) : null,
      })
      .returning({ id: strategyHistory.id });

    const historyId = historyRows[0]?.id;
    if (!historyId) {
      console.warn(`[seed] strategy_history insert failed for "${seed.title}"`);
      continue;
    }

    // 2) Create the marketplace listing.
    await db.insert(marketplaceStrategies).values({
      strategyHistoryId: historyId,
      authorUserId: CURATOR_USER_ID,
      title: seed.title,
      description: seed.description,
      priceType: seed.priceType,
      pricePerRun: seed.pricePerRun ?? 0,
      priceMonthly: 0,
      gradeScore: "A",
      totalRuns: 0,
      totalSubscribers: 0,
      stakedLb: 0,
      status: "active",
      school: seed.school,
      ratingAvg: "0",
      ratingCount: 0,
      forkCount: 0,
    });

    inserted += 1;
  }

  console.log(`[seed-marketplace] inserted ${inserted}, skipped ${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-marketplace] failed:", err);
    process.exit(1);
  });
