/**
 * Parallel Backtest Benchmark Tests
 *
 * Performance comparison: sequential vs chunked parallel execution.
 * Run manually: bun run test -- --run src/lib/backtest/__tests__/parallel-benchmark.test.ts
 */
import { describe, it, expect } from "vitest";
import { executeInChunks } from "../parallel/chunked-executor";
import { createTrendKlines } from "./mock-factory";
import type { BacktestKline } from "../types";

const STOCK_COUNT = 20;
const TRADING_DAYS = 252;

/** Simulate CPU-intensive backtest computation */
function simulateBacktest(
  symbol: string,
  klines: BacktestKline[],
): { symbol: string; signalCount: number; avgReturn: number } {
  if (klines.length < 30) return { symbol, signalCount: 0, avgReturn: 0 };

  const closes = klines.map((k) => k.close);
  let signalCount = 0;
  let totalReturn = 0;

  for (let i = 20; i < closes.length - 10; i++) {
    let sma5 = 0;
    for (let j = i - 4; j <= i; j++) sma5 += closes[j]!;
    sma5 /= 5;
    let sma5Prev = 0;
    for (let j = i - 5; j <= i - 1; j++) sma5Prev += closes[j]!;
    sma5Prev /= 5;
    let sma20 = 0;
    for (let j = i - 19; j <= i; j++) sma20 += closes[j]!;
    sma20 /= 20;
    let sma20Prev = 0;
    for (let j = i - 20; j <= i - 1; j++) sma20Prev += closes[j]!;
    sma20Prev /= 20;

    if (sma5Prev <= sma20Prev && sma5 > sma20) {
      const entryPrice = closes[i]!;
      const exitPrice = closes[Math.min(i + 10, closes.length - 1)]!;
      totalReturn += (exitPrice - entryPrice) / entryPrice;
      signalCount++;
    }
  }

  return {
    symbol,
    signalCount,
    avgReturn: signalCount > 0 ? totalReturn / signalCount : 0,
  };
}

function generateBenchmarkData(): Array<{ symbol: string; klines: BacktestKline[] }> {
  const stocks: Array<{ symbol: string; klines: BacktestKline[] }> = [];
  for (let i = 0; i < STOCK_COUNT; i++) {
    const symbol = String(600000 + i).padStart(6, "0");
    const startPrice = 10 + i * 3;
    const dailyChange = i % 2 === 0 ? 0.1 : -0.05;
    stocks.push({ symbol, klines: createTrendKlines(TRADING_DAYS, startPrice, dailyChange) });
  }
  return stocks;
}

describe("Parallel Backtest Benchmarks", () => {
  const stocks = generateBenchmarkData();

  it("should establish sequential baseline", async () => {
    const start = performance.now();
    const results = stocks.map((s) => simulateBacktest(s.symbol, s.klines));
    const elapsed = performance.now() - start;

    console.log("[Baseline] Sequential: " + STOCK_COUNT + " stocks in " + elapsed.toFixed(1) + "ms (" + (elapsed / STOCK_COUNT).toFixed(1) + "ms/stock)");
    expect(results).toHaveLength(STOCK_COUNT);
    expect(elapsed).toBeLessThan(30000);
  });

  it("should benchmark chunked executor with concurrency 4", async () => {
    const result = await executeInChunks(
      stocks,
      async (stock) => simulateBacktest(stock.symbol, stock.klines),
      { concurrency: 4 },
    );
    console.log("[Chunked-4] " + STOCK_COUNT + " stocks in " + result.summary.totalTimeMs.toFixed(1) + "ms");
    expect(result.summary.succeeded).toBe(STOCK_COUNT);
    expect(result.summary.totalTimeMs).toBeLessThan(30000);
  });

  it("should benchmark chunked executor with concurrency 8", async () => {
    const result = await executeInChunks(
      stocks,
      async (stock) => simulateBacktest(stock.symbol, stock.klines),
      { concurrency: 8 },
    );
    console.log("[Chunked-8] " + STOCK_COUNT + " stocks in " + result.summary.totalTimeMs.toFixed(1) + "ms");
    expect(result.summary.succeeded).toBe(STOCK_COUNT);
    expect(result.summary.totalTimeMs).toBeLessThan(30000);
  });

  it("should benchmark chunked executor with concurrency 12", async () => {
    const result = await executeInChunks(
      stocks,
      async (stock) => simulateBacktest(stock.symbol, stock.klines),
      { concurrency: 12 },
    );
    console.log("[Chunked-12] " + STOCK_COUNT + " stocks in " + result.summary.totalTimeMs.toFixed(1) + "ms");
    expect(result.summary.succeeded).toBe(STOCK_COUNT);
    expect(result.summary.totalTimeMs).toBeLessThan(30000);
  });

  it("should verify chunked results match sequential baseline", async () => {
    const seqResults = stocks.map((s) => simulateBacktest(s.symbol, s.klines));
    const chunkResult = await executeInChunks(
      stocks,
      async (stock) => simulateBacktest(stock.symbol, stock.klines),
      { concurrency: 4 },
    );
    for (let i = 0; i < STOCK_COUNT; i++) {
      const chunkR = chunkResult.results[i]!;
      expect(chunkR.success).toBe(true);
      if (chunkR.success) {
        expect(chunkR.data).toEqual(seqResults[i]);
      }
    }
  });
});
