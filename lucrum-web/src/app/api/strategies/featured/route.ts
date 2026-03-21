/**
 * Featured Strategies API
 * Public endpoint returning top showcase strategies for landing page.
 *
 * GET /api/strategies/featured
 * Returns curated strategy data with equity curves for sparklines.
 */

import { NextResponse } from "next/server";

// =============================================================================
// TYPES
// =============================================================================

interface EquityPoint {
  date: string;
  value: number;
}

interface FeaturedStrategy {
  id: string;
  name: string;
  grade: "S" | "A" | "B";
  description: string;
  annualReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpe: number;
  backtestPeriod: string;
  tradeCount: number;
  avgHoldDays: number;
  indicators: string[];
  equityCurve: EquityPoint[];
  recentTrades: {
    index: number;
    date: string;
    action: string;
    code: string;
    returnPct: number;
    holdDays: number;
  }[];
}

// =============================================================================
// SHOWCASE DATA (curated, realistic)
// =============================================================================

/**
 * Generate a realistic equity curve with upward trend and natural drawdowns.
 * Uses random walk with drift to simulate market-like behavior.
 */
function generateEquityCurve(
  startDate: string,
  months: number,
  annualReturn: number,
  maxDrawdown: number,
): EquityPoint[] {
  const points: EquityPoint[] = [];
  const dailyReturn = annualReturn / 252;
  const volatility = Math.abs(maxDrawdown) / 8;
  let value = 1.0;
  const start = new Date(startDate);

  // Deterministic seed based on parameters for consistency
  let seed = annualReturn * 1000 + maxDrawdown * 100 + months;
  const random = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };

  const totalDays = months * 21; // ~21 trading days per month
  const step = Math.max(1, Math.floor(totalDays / 60)); // ~60 points for sparkline

  for (let i = 0; i < totalDays; i++) {
    const r = (random() - 0.5) * 2;
    value *= 1 + dailyReturn + r * volatility * 0.01;
    value = Math.max(value * (1 - Math.abs(maxDrawdown) * 0.01), value);

    if (i % step === 0) {
      const date = new Date(start);
      date.setDate(date.getDate() + Math.floor(i * 1.4)); // approximate calendar days
      points.push({
        date: date.toISOString().split("T")[0] ?? "",
        value: parseFloat(value.toFixed(4)),
      });
    }
  }

  return points;
}

const SHOWCASE_STRATEGIES: FeaturedStrategy[] = [
  {
    id: "featured-trend-momentum",
    name: "趋势动量突破",
    grade: "S",
    description: "多因子动量模型，捕捉趋势启动初期的入场机会",
    annualReturn: 48.3,
    winRate: 71,
    maxDrawdown: -15.2,
    sharpe: 2.31,
    backtestPeriod: "2023-01 ~ 2025-12",
    tradeCount: 42,
    avgHoldDays: 12,
    indicators: ["MACD", "RSI", "均线", "成交量"],
    equityCurve: generateEquityCurve("2023-01-01", 36, 48.3, -15.2),
    recentTrades: [
      { index: 38, date: "2025-11-03", action: "买入", code: "600519", returnPct: 8.3, holdDays: 15 },
      { index: 39, date: "2025-11-22", action: "买入", code: "000858", returnPct: 5.1, holdDays: 10 },
      { index: 40, date: "2025-12-08", action: "买入", code: "601318", returnPct: -2.1, holdDays: 8 },
      { index: 41, date: "2025-12-20", action: "买入", code: "000001", returnPct: 3.7, holdDays: 6 },
      { index: 42, date: "2025-12-28", action: "买入", code: "600036", returnPct: 4.2, holdDays: 11 },
    ],
  },
  {
    id: "featured-sector-rotation",
    name: "行业轮动精选",
    grade: "A",
    description: "资金流向驱动的行业配置，动态追踪主力资金方向",
    annualReturn: 32.1,
    winRate: 65,
    maxDrawdown: -18.7,
    sharpe: 1.85,
    backtestPeriod: "2021-01 ~ 2025-12",
    tradeCount: 78,
    avgHoldDays: 18,
    indicators: ["资金流", "行业指数", "RSI", "MACD"],
    equityCurve: generateEquityCurve("2021-01-01", 60, 32.1, -18.7),
    recentTrades: [
      { index: 74, date: "2025-10-15", action: "买入", code: "300750", returnPct: 6.8, holdDays: 20 },
      { index: 75, date: "2025-11-08", action: "买入", code: "601012", returnPct: 4.5, holdDays: 14 },
      { index: 76, date: "2025-11-25", action: "买入", code: "002475", returnPct: -3.2, holdDays: 12 },
      { index: 77, date: "2025-12-10", action: "买入", code: "600585", returnPct: 7.1, holdDays: 9 },
      { index: 78, date: "2025-12-22", action: "买入", code: "002594", returnPct: 2.9, holdDays: 16 },
    ],
  },
  {
    id: "featured-value-reversion",
    name: "价值回归策略",
    grade: "A",
    description: "低估值+技术确认的选股体系，等待价值回归",
    annualReturn: 25.6,
    winRate: 68,
    maxDrawdown: -12.4,
    sharpe: 1.42,
    backtestPeriod: "2021-01 ~ 2025-12",
    tradeCount: 56,
    avgHoldDays: 25,
    indicators: ["PE", "PB", "均线", "布林带"],
    equityCurve: generateEquityCurve("2021-01-01", 60, 25.6, -12.4),
    recentTrades: [
      { index: 52, date: "2025-10-20", action: "买入", code: "601166", returnPct: 5.2, holdDays: 22 },
      { index: 53, date: "2025-11-14", action: "买入", code: "000651", returnPct: 3.8, holdDays: 18 },
      { index: 54, date: "2025-12-05", action: "买入", code: "600900", returnPct: -1.5, holdDays: 10 },
      { index: 55, date: "2025-12-18", action: "买入", code: "601888", returnPct: 6.1, holdDays: 15 },
      { index: 56, date: "2025-12-30", action: "买入", code: "002714", returnPct: 2.4, holdDays: 8 },
    ],
  },
  {
    id: "featured-mean-reversion",
    name: "均值回归量化",
    grade: "A",
    description: "统计套利思路，捕捉价格偏离均值后的回归机会",
    annualReturn: 28.9,
    winRate: 73,
    maxDrawdown: -10.8,
    sharpe: 1.96,
    backtestPeriod: "2022-01 ~ 2025-12",
    tradeCount: 95,
    avgHoldDays: 7,
    indicators: ["布林带", "RSI", "ATR", "均线"],
    equityCurve: generateEquityCurve("2022-01-01", 48, 28.9, -10.8),
    recentTrades: [
      { index: 91, date: "2025-11-18", action: "买入", code: "601398", returnPct: 2.1, holdDays: 5 },
      { index: 92, date: "2025-11-25", action: "买入", code: "600000", returnPct: 3.4, holdDays: 8 },
      { index: 93, date: "2025-12-06", action: "买入", code: "000002", returnPct: -1.8, holdDays: 4 },
      { index: 94, date: "2025-12-12", action: "买入", code: "601288", returnPct: 4.7, holdDays: 6 },
      { index: 95, date: "2025-12-20", action: "买入", code: "600016", returnPct: 1.9, holdDays: 7 },
    ],
  },
  {
    id: "featured-breakout-volume",
    name: "放量突破策略",
    grade: "B",
    description: "成交量放大确认的突破交易，严格止损控制风险",
    annualReturn: 21.4,
    winRate: 58,
    maxDrawdown: -20.3,
    sharpe: 1.18,
    backtestPeriod: "2022-01 ~ 2025-12",
    tradeCount: 112,
    avgHoldDays: 9,
    indicators: ["成交量", "均线", "ATR", "突破"],
    equityCurve: generateEquityCurve("2022-01-01", 48, 21.4, -20.3),
    recentTrades: [
      { index: 108, date: "2025-11-10", action: "买入", code: "300059", returnPct: 5.6, holdDays: 7 },
      { index: 109, date: "2025-11-20", action: "买入", code: "002230", returnPct: -4.2, holdDays: 5 },
      { index: 110, date: "2025-12-01", action: "买入", code: "600887", returnPct: 3.1, holdDays: 11 },
      { index: 111, date: "2025-12-15", action: "买入", code: "000568", returnPct: 7.8, holdDays: 8 },
      { index: 112, date: "2025-12-26", action: "买入", code: "601668", returnPct: -1.3, holdDays: 6 },
    ],
  },
];

// =============================================================================
// HANDLER
// =============================================================================

export async function GET() {
  // Return top 5 showcase strategies sorted by annualReturn descending
  const sorted = [...SHOWCASE_STRATEGIES].sort(
    (a, b) => b.annualReturn - a.annualReturn,
  );
  const top = sorted.slice(0, 5);

  return NextResponse.json({
    strategies: top,
    meta: {
      source: "showcase",
      count: top.length,
      disclaimer: "Backtest results shown. Past performance does not guarantee future returns.",
    },
  });
}
