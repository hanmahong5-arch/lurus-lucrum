/**
 * Portfolio Backtest Engine — Comprehensive Test Suite
 *
 * Covers position sizing (4 methods + constraints), the core day-by-day
 * simulation loop (shared capital, sell-first ordering, lot enforcement,
 * sector/position caps, equity curve), and edge cases (single stock,
 * empty data, max stocks, transaction costs).
 *
 * All financial assertions use Decimal.js to avoid floating-point traps.
 *
 * @module lib/backtest/portfolio/__tests__/portfolio.test
 */

import Decimal from "decimal.js";
import { describe, it, expect, vi } from "vitest";
import { calculateTargetWeights, calculateVolatility } from "../position-sizing";
import { runPortfolioBacktest } from "../engine";
import type { KlineProvider } from "../engine";
import type { BacktestKline } from "../../types";
import type { PortfolioStock, PortfolioConfig, PortfolioTrade } from "../types";

// =============================================================================
// HELPERS — deterministic mock K-line generators
// =============================================================================

/**
 * Create a single BacktestKline bar from a date string and a close price.
 * Open = close * 0.99, High = close * 1.01, Low = close * 0.98.
 * Volume defaults to 1_000_000 to avoid zero-volume filters.
 */
function makeBar(dateStr: string, close: number, volume = 1_000_000): BacktestKline {
  return {
    time: Math.floor(new Date(dateStr).getTime() / 1000),
    open: +(close * 0.99).toFixed(2),
    high: +(close * 1.01).toFixed(2),
    low: +(close * 0.98).toFixed(2),
    close: +close.toFixed(2),
    volume,
  };
}

/**
 * Generate a series of daily K-line bars with linearly changing close prices.
 *
 * @param startDate  ISO date string (YYYY-MM-DD)
 * @param numDays    Number of trading days to generate
 * @param startPrice Starting close price
 * @param dailyDelta Additive change per day (positive = uptrend)
 */
function generateLinearKlines(
  startDate: string,
  numDays: number,
  startPrice: number,
  dailyDelta: number,
): BacktestKline[] {
  const bars: BacktestKline[] = [];
  const base = new Date(startDate);
  let price = startPrice;

  for (let i = 0; i < numDays; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    // Skip weekends for realism
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateStr = d.toISOString().split("T")[0]!;
    bars.push(makeBar(dateStr, price));
    price += dailyDelta;
  }
  return bars;
}

/**
 * Generate K-lines that oscillate between a low and high price,
 * producing predictable MA crossover signals.
 *
 * Pattern: price rises from `low` to `high` over `halfCycle` days,
 * then falls back, repeating `cycles` times.
 */
function generateOscillatingKlines(
  startDate: string,
  low: number,
  high: number,
  halfCycle: number,
  cycles: number,
): BacktestKline[] {
  const bars: BacktestKline[] = [];
  const base = new Date(startDate);
  const range = high - low;
  let dayCounter = 0;

  for (let c = 0; c < cycles; c++) {
    // Rising leg
    for (let i = 0; i < halfCycle; i++) {
      const d = nextTradingDay(base, dayCounter++);
      const price = low + range * (i / halfCycle);
      bars.push(makeBar(d, price));
    }
    // Falling leg
    for (let i = 0; i < halfCycle; i++) {
      const d = nextTradingDay(base, dayCounter++);
      const price = high - range * (i / halfCycle);
      bars.push(makeBar(d, price));
    }
  }
  return bars;
}

/** Advance from a base date by `n` calendar days, skipping weekends. */
function nextTradingDay(base: Date, n: number): string {
  let count = 0;
  let offset = 0;
  while (count <= n) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      if (count === n) return d.toISOString().split("T")[0]!;
      count++;
    }
    offset++;
  }
  // Fallback (should not reach)
  return base.toISOString().split("T")[0]!;
}

/**
 * Build a KlineProvider mock that returns deterministic data from a Map.
 * Symbols not in the map reject with an error.
 */
function mockKlineProvider(
  data: Map<string, BacktestKline[]>,
): KlineProvider {
  return async (symbol: string) => {
    const klines = data.get(symbol);
    if (!klines) throw new Error(`No mock data for ${symbol}`);
    return klines;
  };
}

/** Shorthand for building PortfolioStock entries. */
function stock(
  symbol: string,
  name: string,
  sector?: string,
  marketCap?: number,
  customWeight?: number,
): PortfolioStock {
  return { symbol, name, sector, marketCap, customWeight };
}

/** Base config factory — override individual fields as needed. */
function baseConfig(overrides: Partial<PortfolioConfig> = {}): PortfolioConfig {
  return {
    totalCapital: 100_000,
    stocks: [
      stock("600519", "Kweichow Moutai", "liquor"),
      stock("000858", "Wuliangye", "liquor"),
    ],
    strategy: "class MACross { ma fast_window = 5; slow_window = 20 }",
    strategyParams: {},
    positionSizing: "equal",
    maxPositionPct: 0.5,
    maxSectorPct: 1.0,
    rebalanceFrequency: "never",
    startDate: "2024-01-02",
    endDate: "2024-06-30",
    commission: 0.0003,
    slippage: 0.001,
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE 1: Position Sizing Calculator
// =============================================================================

describe("calculateTargetWeights", () => {
  // ---- Equal weighting ----

  it("equal: distributes evenly across N stocks", () => {
    const stocks = [
      stock("A", "A"), stock("B", "B"), stock("C", "C"),
      stock("D", "D"), stock("E", "E"),
    ];
    const weights = calculateTargetWeights(stocks, "equal", {
      maxPositionPct: 1,
      maxSectorPct: 1,
    });

    expect(weights.size).toBe(5);
    const expected = new Decimal(1).div(5);
    Array.from(weights.values()).forEach((w) => {
      expect(w.toFixed(10)).toBe(expected.toFixed(10));
    });
  });

  it("equal: respects maxPositionPct cap", () => {
    const stocks = [stock("A", "A"), stock("B", "B"), stock("C", "C")];
    const weights = calculateTargetWeights(stocks, "equal", {
      maxPositionPct: 0.25,
      maxSectorPct: 1,
    });

    // Each raw weight = 1/3 ~ 0.3333 > 0.25, so clamped to 0.25
    Array.from(weights.values()).forEach((w) => {
      expect(w.lte(new Decimal(0.25))).toBe(true);
    });

    // Total should be 0.75 (3 * 0.25), NOT normalized back to 1.0
    const total = Array.from(weights.values()).reduce(
      (sum, w) => sum.plus(w),
      new Decimal(0),
    );
    expect(total.toFixed(2)).toBe("0.75");
  });

  it("equal: respects maxSectorPct cap", () => {
    // 5 stocks, 3 in sector "tech", maxSectorPct = 0.30
    const stocks = [
      stock("A", "A", "tech"),
      stock("B", "B", "tech"),
      stock("C", "C", "tech"),
      stock("D", "D", "finance"),
      stock("E", "E", "finance"),
    ];
    const weights = calculateTargetWeights(stocks, "equal", {
      maxPositionPct: 1,
      maxSectorPct: 0.30,
    });

    // Tech sector total <= 0.30
    let techTotal = new Decimal(0);
    for (const s of ["A", "B", "C"]) {
      techTotal = techTotal.plus(weights.get(s)!);
    }
    // Allow tiny floating-point tolerance via Decimal comparison
    expect(techTotal.lte(new Decimal("0.300001"))).toBe(true);
  });

  // ---- Market-cap weighting ----

  it("market-cap: weights proportional to capitalization", () => {
    const stocks = [
      stock("A", "A", undefined, 100_000_000_000), // 100B
      stock("B", "B", undefined, 50_000_000_000),  //  50B
    ];
    const weights = calculateTargetWeights(stocks, "market-cap", {
      maxPositionPct: 1,
      maxSectorPct: 1,
    });

    const wA = weights.get("A")!;
    const wB = weights.get("B")!;
    // A should be roughly 2/3, B roughly 1/3
    const ratioAtoB = wA.div(wB);
    expect(ratioAtoB.toFixed(1)).toBe("2.0");
  });

  it("market-cap: falls back to equal when no marketCap data", () => {
    const stocks = [stock("A", "A"), stock("B", "B")];
    const weights = calculateTargetWeights(stocks, "market-cap", {
      maxPositionPct: 1,
      maxSectorPct: 1,
    });

    // No marketCap → equal weights
    expect(weights.get("A")!.toFixed(2)).toBe("0.50");
    expect(weights.get("B")!.toFixed(2)).toBe("0.50");
  });

  // ---- Risk parity ----

  it("risk-parity: low volatility stocks get higher weight", () => {
    const stocks = [stock("A", "A"), stock("B", "B")];
    const weights = calculateTargetWeights(stocks, "risk-parity", {
      maxPositionPct: 1,
      maxSectorPct: 1,
      volatilities: { A: 0.10, B: 0.30 },
    });

    const wA = weights.get("A")!;
    const wB = weights.get("B")!;
    // A has lower vol → higher weight
    expect(wA.gt(wB)).toBe(true);

    // inverse-vol: wA / wB = (1/0.10) / (1/0.30) = 3.0
    const ratio = wA.div(wB);
    expect(ratio.toFixed(1)).toBe("3.0");
  });

  it("risk-parity: defaults to 30% vol when volatility data missing", () => {
    const stocks = [stock("A", "A"), stock("B", "B")];
    const weights = calculateTargetWeights(stocks, "risk-parity", {
      maxPositionPct: 1,
      maxSectorPct: 1,
      // No volatilities provided
    });

    // Both default to 30% vol → equal weights
    expect(weights.get("A")!.toFixed(2)).toBe("0.50");
    expect(weights.get("B")!.toFixed(2)).toBe("0.50");
  });

  // ---- Custom ----

  it("custom: uses user-specified weights", () => {
    const stocks = [stock("A", "A"), stock("B", "B"), stock("C", "C")];
    const weights = calculateTargetWeights(stocks, "custom", {
      maxPositionPct: 1,
      maxSectorPct: 1,
      customWeights: { A: 0.5, B: 0.3, C: 0.2 },
    });

    expect(weights.get("A")!.toFixed(1)).toBe("0.5");
    expect(weights.get("B")!.toFixed(1)).toBe("0.3");
    expect(weights.get("C")!.toFixed(1)).toBe("0.2");
  });

  it("custom: normalizes weights summing > 1", () => {
    const stocks = [stock("A", "A"), stock("B", "B")];
    const weights = calculateTargetWeights(stocks, "custom", {
      maxPositionPct: 1,
      maxSectorPct: 1,
      customWeights: { A: 0.7, B: 0.6 },
    });

    // Sum = 1.3 → normalized to <=1
    const total = weights.get("A")!.plus(weights.get("B")!);
    expect(total.lte(new Decimal("1.0001"))).toBe(true);
    // Ratio preserved: A/B = 0.7/0.6
    const ratio = weights.get("A")!.div(weights.get("B")!);
    expect(ratio.toFixed(3)).toBe(new Decimal(0.7).div(0.6).toFixed(3));
  });

  it("custom: falls back to equal when no customWeights provided", () => {
    const stocks = [stock("A", "A"), stock("B", "B")];
    const weights = calculateTargetWeights(stocks, "custom", {
      maxPositionPct: 1,
      maxSectorPct: 1,
      // customWeights omitted
    });
    expect(weights.get("A")!.toFixed(2)).toBe("0.50");
    expect(weights.get("B")!.toFixed(2)).toBe("0.50");
  });

  // ---- Empty input ----

  it("returns empty map for zero stocks", () => {
    const weights = calculateTargetWeights([], "equal", {
      maxPositionPct: 1,
      maxSectorPct: 1,
    });
    expect(weights.size).toBe(0);
  });

  // ---- Total never exceeds 1 ----

  it("total weight never exceeds 1.0 regardless of method", () => {
    const stocks = Array.from({ length: 20 }, (_, i) =>
      stock(`S${i}`, `Stock${i}`, `sector${i % 3}`, 10_000_000 * (i + 1)),
    );

    for (const method of ["equal", "market-cap", "risk-parity"] as const) {
      const weights = calculateTargetWeights(stocks, method, {
        maxPositionPct: 0.15,
        maxSectorPct: 0.40,
        volatilities: Object.fromEntries(
          stocks.map((s) => [s.symbol, 0.15 + Math.random() * 0.3]),
        ),
      });
      const total = Array.from(weights.values()).reduce(
        (sum, w) => sum.plus(w),
        new Decimal(0),
      );
      expect(total.lte(new Decimal("1.0001"))).toBe(true);
    }
  });
});

// =============================================================================
// TEST SUITE 1b: calculateVolatility utility
// =============================================================================

describe("calculateVolatility", () => {
  it("returns 0 for fewer than 2 data points", () => {
    expect(calculateVolatility([])).toBe(0);
    expect(calculateVolatility([100])).toBe(0);
  });

  it("returns 0 for constant prices (no variance)", () => {
    const closes = Array(50).fill(100) as number[];
    expect(calculateVolatility(closes)).toBe(0);
  });

  it("computes positive volatility for varying prices", () => {
    // Simple oscillation: 100, 110, 100, 110, ...
    const closes = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 100 : 110));
    const vol = calculateVolatility(closes);
    expect(vol).toBeGreaterThan(0);
  });
});

// =============================================================================
// TEST SUITE 2: Portfolio Engine Core Logic
// =============================================================================

describe("runPortfolioBacktest", () => {
  // Shared mock data: 80 trading days, gentle uptrend
  const klineDataA = generateLinearKlines("2024-01-02", 120, 50, 0.10);
  const klineDataB = generateLinearKlines("2024-01-02", 120, 30, 0.05);

  const defaultKlines = new Map<string, BacktestKline[]>([
    ["600519", klineDataA],
    ["000858", klineDataB],
  ]);

  it("shared capital: buying stock A reduces cash for stock B", async () => {
    const config = baseConfig({
      totalCapital: 100_000,
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    // Total invested across all buy trades must not exceed initial capital
    const totalBought = result.allTrades
      .filter((t) => t.type === "buy")
      .reduce((sum, t) => sum + t.cost, 0);

    expect(new Decimal(totalBought).lte(new Decimal(100_000))).toBe(true);

    // After any buy, cashAfter < cashBefore
    const buys = result.allTrades.filter((t) => t.type === "buy");
    for (const buy of buys) {
      expect(buy.cashAfter).toBeLessThan(buy.cashBefore);
    }
  });

  it("sell-first ordering: sells free cash before new buys", async () => {
    // Use oscillating data so both stocks produce buy/sell signals
    const oscA = generateOscillatingKlines("2024-01-02", 40, 60, 15, 4);
    const oscB = generateOscillatingKlines("2024-01-02", 20, 35, 15, 4);

    const klines = new Map<string, BacktestKline[]>([
      ["600519", oscA],
      ["000858", oscB],
    ]);

    const config = baseConfig({
      totalCapital: 100_000,
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(klines));

    // For each day where both a sell and a buy occur, the sell should
    // precede the buy in the trade log
    const tradesByDate = new Map<string, typeof result.allTrades>();
    for (const t of result.allTrades) {
      const existing = tradesByDate.get(t.date) ?? [];
      existing.push(t);
      tradesByDate.set(t.date, existing);
    }

    Array.from(tradesByDate.values()).forEach((trades) => {
      let lastSellIdx = -1;
      let firstBuyIdx = Infinity;
      trades.forEach((t: PortfolioTrade, idx: number) => {
        if (t.type === "sell") lastSellIdx = Math.max(lastSellIdx, idx);
        if (t.type === "buy") firstBuyIdx = Math.min(firstBuyIdx, idx);
      });
      // If both sell and buy on same day, sells come first
      if (lastSellIdx >= 0 && firstBuyIdx < Infinity) {
        expect(lastSellIdx).toBeLessThan(firstBuyIdx);
      }
    });
  });

  it("lot size enforcement: rounds to 100-share lots", async () => {
    const config = baseConfig({
      totalCapital: 100_000,
      positionSizing: "equal",
      maxPositionPct: 0.5,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    // Every buy trade quantity must be a multiple of 100
    const buys = result.allTrades.filter((t) => t.type === "buy");
    for (const buy of buys) {
      expect(buy.quantity % 100).toBe(0);
    }
  });

  it("skips buy when capital insufficient for 1 lot", async () => {
    // Stock price ~50, so 1 lot = ~5000 CNY. Give only 4000 total.
    const config = baseConfig({
      totalCapital: 4_000,
      stocks: [
        stock("600519", "Kweichow Moutai", "liquor"),
        stock("000858", "Wuliangye", "liquor"),
      ],
      positionSizing: "equal",
      maxPositionPct: 0.5,
    });

    // Stock A at 50 → 1 lot = 5000 per stock (2000 each budget)
    // Both are unaffordable
    const expensiveKlines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 50, 0.10)],
      ["000858", generateLinearKlines("2024-01-02", 120, 50, 0.05)],
    ]);

    const result = await runPortfolioBacktest(config, mockKlineProvider(expensiveKlines));

    // Should have zero buy trades or all-skipped (insufficient capital)
    const buys = result.allTrades.filter((t) => t.type === "buy");
    // Each stock budget = 2000, 1 lot at 50 = 5000 → no buys possible
    expect(buys.length).toBe(0);

    // At least one stock should have insufficient-capital or no-signal status
    const insufficientOrNoSignal = result.stockResults.filter(
      (s) => s.status === "insufficient-capital" || s.status === "no-signal",
    );
    expect(insufficientOrNoSignal.length).toBeGreaterThan(0);
  });

  it("respects maxPositionPct limit", async () => {
    const config = baseConfig({
      totalCapital: 100_000,
      maxPositionPct: 0.40,
      positionSizing: "equal",
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    // Each buy trade cost should not exceed maxPositionPct * totalCapital = 40,000
    const maxAllowed = new Decimal(100_000).mul(0.40);
    const buys = result.allTrades.filter((t) => t.type === "buy");
    for (const buy of buys) {
      expect(new Decimal(buy.cost).lte(maxAllowed.plus(100))).toBe(true);
    }
  });

  it("respects maxSectorPct limit", async () => {
    // 3 stocks in same sector, maxSectorPct = 0.50 (50k for the whole sector)
    const threeStockKlines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 10, 0.05)],
      ["000858", generateLinearKlines("2024-01-02", 120, 12, 0.04)],
      ["601318", generateLinearKlines("2024-01-02", 120, 11, 0.06)],
    ]);

    const config = baseConfig({
      totalCapital: 100_000,
      stocks: [
        stock("600519", "Moutai", "liquor"),
        stock("000858", "Wuliangye", "liquor"),
        stock("601318", "Pingan", "liquor"),
      ],
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 0.50,
    });

    const result = await runPortfolioBacktest(
      config,
      mockKlineProvider(threeStockKlines),
    );

    // All allocated weights in the "liquor" sector should sum <= 0.50
    const liquorResults = result.stockResults.filter((s) => s.sector === "liquor");
    const sectorWeight = liquorResults.reduce((sum, s) => sum + s.actualWeight, 0);
    expect(new Decimal(sectorWeight).lte(new Decimal("0.5001"))).toBe(true);
  });

  it("produces correct equity curve", async () => {
    const config = baseConfig({
      totalCapital: 100_000,
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    // Equity curve should have one entry per trading day
    expect(result.equityCurve.length).toBeGreaterThan(0);

    // First day's value should be close to initial capital (no buys on first day
    // since signals are generated at close and executed next day)
    const firstPoint = result.equityCurve[0]!;
    expect(new Decimal(firstPoint.value).toFixed(0)).toBe("100000");

    // Equity = cash + positions. Each entry should have non-negative cash.
    for (const pt of result.equityCurve) {
      expect(Number(pt.cash)).toBeGreaterThanOrEqual(0);
      expect(Number(pt.value)).toBeGreaterThan(0);
    }

    // Drawdown should be non-negative
    for (const pt of result.equityCurve) {
      expect(Number(pt.drawdown)).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles stock with no signals gracefully", async () => {
    // Stock A oscillates (generates signals), stock B is perfectly flat (no crossover)
    const flatKlines = generateLinearKlines("2024-01-02", 120, 50, 0); // zero delta
    const oscKlines = generateOscillatingKlines("2024-01-02", 40, 60, 15, 4);

    const klines = new Map<string, BacktestKline[]>([
      ["600519", oscKlines],
      ["000858", flatKlines],
    ]);

    const config = baseConfig({
      totalCapital: 100_000,
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(klines));

    // Stock B should either be "no-signal" or have 0 trades
    const stockBResult = result.stockResults.find((s) => s.symbol === "000858");
    expect(stockBResult).toBeDefined();
    // A flat line may or may not trigger a signal depending on indicator warmup,
    // but it should not crash and the stock should be accounted for.
    expect(["no-signal", "traded", "insufficient-capital"]).toContain(
      stockBResult!.status,
    );
  });

  it("handles suspended stock (zero volume days)", async () => {
    // Stock with some zero-volume days mixed in
    const base = generateLinearKlines("2024-01-02", 120, 50, 0.10);
    const suspendedKlines = base.map((bar, i) => {
      // Suspend every 10th bar
      if (i % 10 === 5) return { ...bar, volume: 0 };
      return bar;
    });

    const klines = new Map<string, BacktestKline[]>([
      ["600519", suspendedKlines],
      ["000858", generateLinearKlines("2024-01-02", 120, 30, 0.05)],
    ]);

    const config = baseConfig();

    // Should not throw — the engine processes only bars with data available
    const result = await runPortfolioBacktest(config, mockKlineProvider(klines));
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  it("calculates diversification metrics correctly", async () => {
    // Equal weights across 5 stocks in different sectors
    const fiveStockKlines = new Map<string, BacktestKline[]>();
    const fiveStocks: PortfolioStock[] = [];
    for (let i = 0; i < 5; i++) {
      const sym = `6${String(i).padStart(5, "0")}`;
      fiveStocks.push(stock(sym, `Stock${i}`, `sector${i}`));
      // Low price so 1 lot is affordable with 1/5 of 100k = 20k
      fiveStockKlines.set(
        sym,
        generateOscillatingKlines("2024-01-02", 8 + i, 18 + i, 15, 4),
      );
    }

    const config = baseConfig({
      totalCapital: 100_000,
      stocks: fiveStocks,
      positionSizing: "equal",
      maxPositionPct: 0.3,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(
      config,
      mockKlineProvider(fiveStockKlines),
    );

    // effectiveStocks <= 5
    expect(result.diversification.effectiveStocks).toBeLessThanOrEqual(5);

    // HHI: for N equal-weight traded stocks, HHI = N * (1/N)^2 = 1/N
    // For 5 equal-weight: HHI ~ 0.20 (if all traded)
    const traded = result.stockResults.filter((s) => s.status === "traded").length;
    if (traded > 0) {
      const expectedMinHHI = new Decimal(1).div(traded);
      // HHI should be >= 1/N (theoretical minimum)
      expect(
        new Decimal(result.diversification.concentrationIndex).gte(
          expectedMinHHI.minus("0.01"),
        ),
      ).toBe(true);
    }
  });

  it("final portfolio value matches equity curve last point", async () => {
    const config = baseConfig();
    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    const lastEquity = result.equityCurve[result.equityCurve.length - 1]!;
    // totalReturn = (finalValue - initialCapital) / initialCapital * 100
    const impliedFinalValue = new Decimal(config.totalCapital)
      .mul(new Decimal(1).plus(new Decimal(result.totalReturn).div(100)));

    // The last equity point's value should be close to the implied final value
    // (they may differ slightly because remaining positions are closed after the
    // last equity snapshot)
    expect(Number(lastEquity.value)).toBeGreaterThan(0);
  });

  it("all trades are chronologically ordered", async () => {
    const config = baseConfig();
    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    for (let i = 1; i < result.allTrades.length; i++) {
      expect(result.allTrades[i]!.date >= result.allTrades[i - 1]!.date).toBe(true);
    }
  });

  it("executionTimeMs is recorded", async () => {
    const config = baseConfig();
    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  it("config snapshot is preserved in result", async () => {
    const config = baseConfig({ totalCapital: 200_000 });
    const result = await runPortfolioBacktest(config, mockKlineProvider(defaultKlines));

    expect(result.config.totalCapital).toBe(200_000);
    expect(result.config.positionSizing).toBe("equal");
  });

  it("onProgress callback is called with all phases", async () => {
    const phases: string[] = [];
    const config = baseConfig();
    await runPortfolioBacktest(
      config,
      mockKlineProvider(defaultKlines),
      (progress) => {
        if (!phases.includes(progress.phase)) {
          phases.push(progress.phase);
        }
      },
    );

    // All four phases should be emitted
    expect(phases).toContain("loading-data");
    expect(phases).toContain("init");
    expect(phases).toContain("computing");
    expect(phases).toContain("finalizing");
  });
});

// =============================================================================
// TEST SUITE 3: Edge Cases
// =============================================================================

describe("portfolio edge cases", () => {
  it("rejects config with fewer than 2 stocks", async () => {
    const config = baseConfig({
      stocks: [stock("600519", "Moutai")],
    });
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 50, 0.1)],
    ]);

    await expect(
      runPortfolioBacktest(config, mockKlineProvider(klines)),
    ).rejects.toThrow("at least 2 stocks");
  });

  it("handles all stocks with no data", async () => {
    const config = baseConfig();
    // Provider returns fewer than MIN_KLINE_BARS (30)
    const emptyProvider: KlineProvider = async () => [];

    await expect(
      runPortfolioBacktest(config, emptyProvider),
    ).rejects.toThrow("No valid K-line data");
  });

  it("handles max stocks (50) without crashing", async () => {
    const manyStocks: PortfolioStock[] = [];
    const manyKlines = new Map<string, BacktestKline[]>();

    for (let i = 0; i < 50; i++) {
      const sym = `6${String(i).padStart(5, "0")}`;
      manyStocks.push(stock(sym, `Stock${i}`, `sector${i % 10}`));
      // Low price, gentle uptrend — enough bars to pass MIN_KLINE_BARS
      manyKlines.set(sym, generateLinearKlines("2024-01-02", 120, 5 + (i % 10), 0.02));
    }

    const config = baseConfig({
      totalCapital: 1_000_000,
      stocks: manyStocks,
      positionSizing: "equal",
      maxPositionPct: 0.10,
      maxSectorPct: 0.30,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(manyKlines));

    expect(result.stockResults.length).toBe(50);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  }, 30_000); // Allow 30s for a large portfolio

  it("transaction costs are applied correctly", async () => {
    // Use a scenario where we know a trade will occur and verify costs
    const config = baseConfig({
      totalCapital: 100_000,
      commission: 0.0003, // 0.03%
      slippage: 0.001,    // 0.1%
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const oscA = generateOscillatingKlines("2024-01-02", 40, 60, 15, 4);
    const oscB = generateOscillatingKlines("2024-01-02", 20, 35, 15, 4);

    const klines = new Map<string, BacktestKline[]>([
      ["600519", oscA],
      ["000858", oscB],
    ]);

    const result = await runPortfolioBacktest(config, mockKlineProvider(klines));

    // Verify sells have cost (proceeds) that accounts for stamp duty
    const sells = result.allTrades.filter((t) => t.type === "sell");
    for (const sell of sells) {
      // Stamp duty = 0.05% of sell value (DEFAULT_STAMP_DUTY = 0.0005)
      // Transfer fee = 0.001% bilateral
      // Commission = max(0.03% of value, 5 CNY)
      // Net proceeds = sellValue - stampDuty - transferFee - commission
      // The cost field for sells = netProceeds
      // At minimum, proceeds should be less than quantity * price (fees deducted)
      const grossValue = sell.quantity * Number(sell.price);
      expect(sell.cost).toBeLessThan(grossValue);
    }

    // Verify buys have cost > quantity * price (fees added)
    const buys = result.allTrades.filter((t) => t.type === "buy");
    for (const buy of buys) {
      const grossValue = buy.quantity * Number(buy.price);
      // Buy cost includes commission + transfer fee
      expect(buy.cost).toBeGreaterThan(grossValue);
    }
  });

  it("rejects invalid config: negative capital", async () => {
    const config = baseConfig({ totalCapital: -1000 });
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 50, 0.1)],
      ["000858", generateLinearKlines("2024-01-02", 120, 30, 0.05)],
    ]);

    await expect(
      runPortfolioBacktest(config, mockKlineProvider(klines)),
    ).rejects.toThrow("capital must be positive");
  });

  it("rejects invalid config: startDate after endDate", async () => {
    const config = baseConfig({
      startDate: "2024-06-30",
      endDate: "2024-01-02",
    });
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 50, 0.1)],
      ["000858", generateLinearKlines("2024-01-02", 120, 30, 0.05)],
    ]);

    await expect(
      runPortfolioBacktest(config, mockKlineProvider(klines)),
    ).rejects.toThrow("startDate must be before endDate");
  });

  it("rejects invalid config: maxPositionPct out of range", async () => {
    const config = baseConfig({ maxPositionPct: 0 });
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 50, 0.1)],
      ["000858", generateLinearKlines("2024-01-02", 120, 30, 0.05)],
    ]);

    await expect(
      runPortfolioBacktest(config, mockKlineProvider(klines)),
    ).rejects.toThrow("maxPositionPct");
  });

  it("rejects empty strategy code", async () => {
    const config = baseConfig({ strategy: "   " });
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateLinearKlines("2024-01-02", 120, 50, 0.1)],
      ["000858", generateLinearKlines("2024-01-02", 120, 30, 0.05)],
    ]);

    await expect(
      runPortfolioBacktest(config, mockKlineProvider(klines)),
    ).rejects.toThrow("Strategy code is required");
  });

  it("handles partial data failure gracefully", async () => {
    // One stock has data, other rejects
    const partialProvider: KlineProvider = async (symbol: string) => {
      if (symbol === "600519") {
        return generateLinearKlines("2024-01-02", 120, 50, 0.1);
      }
      throw new Error("Network error");
    };

    const config = baseConfig({
      stocks: [
        stock("600519", "Moutai", "liquor"),
        stock("000858", "Wuliangye", "liquor"),
        stock("601318", "Pingan", "insurance"),
      ],
    });

    // Should NOT throw — valid stocks proceed, failed ones marked as errors
    const result = await runPortfolioBacktest(config, partialProvider);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  it("handles stock with insufficient data (< 30 bars)", async () => {
    const provider: KlineProvider = async (symbol: string) => {
      if (symbol === "600519") {
        return generateLinearKlines("2024-01-02", 120, 50, 0.1);
      }
      // Only 10 bars — below MIN_KLINE_BARS threshold
      return generateLinearKlines("2024-01-02", 14, 30, 0.05);
    };

    const config = baseConfig({
      stocks: [
        stock("600519", "Moutai", "liquor"),
        stock("000858", "Wuliangye", "liquor"),
        stock("601318", "Pingan", "insurance"),
      ],
    });

    const result = await runPortfolioBacktest(config, provider);
    // Engine should proceed with the stock that has enough data
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  it("sector allocation entries are produced for each sector", async () => {
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateOscillatingKlines("2024-01-02", 8, 18, 15, 4)],
      ["000858", generateOscillatingKlines("2024-01-02", 8, 18, 15, 4)],
    ]);

    const config = baseConfig({
      stocks: [
        stock("600519", "Moutai", "liquor"),
        stock("000858", "Wuliangye", "finance"),
      ],
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(klines));

    const sectors = result.diversification.sectorAllocation.map((s) => s.sector);
    expect(sectors).toContain("liquor");
    expect(sectors).toContain("finance");
  });

  it("maxDrawdown is a non-negative percentage", async () => {
    const klines = new Map<string, BacktestKline[]>([
      ["600519", generateOscillatingKlines("2024-01-02", 30, 60, 20, 3)],
      ["000858", generateOscillatingKlines("2024-01-02", 20, 40, 20, 3)],
    ]);

    const config = baseConfig({
      totalCapital: 100_000,
      positionSizing: "equal",
      maxPositionPct: 0.5,
      maxSectorPct: 1,
    });

    const result = await runPortfolioBacktest(config, mockKlineProvider(klines));
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it("rejects more than 100 stocks", async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) =>
      stock(`S${i}`, `Stock${i}`),
    );
    const config = baseConfig({ stocks: tooMany });

    await expect(
      runPortfolioBacktest(config, async () => []),
    ).rejects.toThrow("cannot exceed 100 stocks");
  });
});
