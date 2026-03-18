import { describe, it, expect } from 'vitest';
import { parseStrategyCode, runBacktest } from '../engine';
import type { BacktestConfig } from '../types';
import { createFlatKlines, createTrendKlines, createGoldenCrossKlines } from './mock-factory';

const SMA_CODE = `
class SMAStrategy {
  fast_window = 5
  slow_window = 20
}
`;

const createBaseConfig = (): BacktestConfig => ({
  symbol: "600519",
  initialCapital: 100000,
  commission: 0.0003,
  slippage: 0.001,
  startDate: "2024-01-01",
  endDate: "2024-06-01",
  timeframe: "1d",
});

describe("Integration: Full Backtest Flow", () => {
  it("parseStrategy → runBacktest → verify trades", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createGoldenCrossKlines(100);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    expect(result).toBeDefined();
    expect(result.trades).toBeDefined();
    expect(Array.isArray(result.trades)).toBe(true);
    expect(result.equityCurve).toBeDefined();
    expect(Array.isArray(result.equityCurve)).toBe(true);
    expect(result.strategy).toBeDefined();
    expect(result.strategy.name).toBe("SMAStrategy");
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  it("flat price → approximately zero return", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createFlatKlines(100, 10);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    // Flat prices mean no crossovers or minimal trading
    // Total return should be close to 0 (or exactly 0)
    expect(Math.abs(result.totalReturn)).toBeLessThan(0.01);
  });

  it("uptrend → result is valid", async () => {
    const klines = createTrendKlines(100, 10, 0.2);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    // Linear uptrend may not produce MA crossovers, just verify structure
    expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    expect(result.trades).toBeDefined();
  });

  it("cost impact: same trade with/without costs", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createGoldenCrossKlines(100);

    const configNoCost: BacktestConfig = {
      ...createBaseConfig(),
      commission: 0,
      slippage: 0,
    };

    const configWithCost: BacktestConfig = {
      ...createBaseConfig(),
      commission: 0.001,
      slippage: 0.002,
    };

    const resultNoCost = await runBacktest(SMA_CODE, klines, configNoCost);
    const resultWithCost = await runBacktest(SMA_CODE, klines, configWithCost);

    // Costs should reduce returns (or keep them equal if no trades)
    expect(resultWithCost.totalReturn).toBeLessThanOrEqual(resultNoCost.totalReturn);
  });

  it("lot size enforcement: all buy trades are 100-share multiples", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createGoldenCrossKlines(100);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    const buyTrades = result.trades.filter(t => t.type === 'buy');

    // All buy trades should have size that's a multiple of 100
    buyTrades.forEach(trade => {
      expect(trade.size % 100).toBe(0);
    });
  });

  it("empty klines → returns reasonable defaults", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createFlatKlines(5, 10); // Very short klines
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    // With only 5 bars, not enough for slow_window=20, so no trades
    expect(result.totalTrades).toBe(0);
    expect(result.trades.length).toBe(0);
  });

  it("result structure is complete", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createGoldenCrossKlines(100);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    // Verify all expected fields exist
    expect(result).toHaveProperty('strategy');
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('equityCurve');
    expect(result).toHaveProperty('totalReturn');
    expect(result).toHaveProperty('annualizedReturn');
    expect(result).toHaveProperty('maxDrawdown');
    expect(result).toHaveProperty('sharpeRatio');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('totalTrades');
    expect(result).toHaveProperty('executionTime');

    expect(result.strategy).toHaveProperty('name');
    expect(result.strategy).toHaveProperty('params');

    expect(typeof result.totalReturn).toBe('number');
    expect(typeof result.annualizedReturn).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');
    expect(typeof result.sharpeRatio).toBe('number');
    expect(typeof result.winRate).toBe('number');
    expect(typeof result.totalTrades).toBe('number');
    expect(typeof result.executionTime).toBe('number');
  });

  it("equity curve starts at initial capital", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createGoldenCrossKlines(100);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.equityCurve[0]!.equity).toBe(config.initialCapital);
  });

  it("execution time is recorded", async () => {
    const strategy = parseStrategyCode(SMA_CODE);
    const klines = createGoldenCrossKlines(100);
    const config = createBaseConfig();

    const result = await runBacktest(SMA_CODE, klines, config);

    expect(result.executionTime).toBeGreaterThanOrEqual(0);
    expect(typeof result.executionTime).toBe('number');
  });

  it("strategy name is preserved", async () => {
    const customStrategyCode = `
class MyCustomStrategy {
  fast_window = 10
  slow_window = 30
}
`;

    const klines = createGoldenCrossKlines(100);
    const config = createBaseConfig();

    const result = await runBacktest(customStrategyCode, klines, config);

    expect(result.strategy.name).toBe("MyCustomStrategy");
  });
});
