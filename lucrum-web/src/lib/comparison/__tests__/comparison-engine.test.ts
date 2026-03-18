/**
 * Comparison Engine Tests
 *
 * Tests:
 * - Metric diff calculation with Decimal.js precision
 * - Winner determination (higher-is-better and lower-is-better)
 * - Group winner resolution
 * - Category and overall winner resolution
 * - Summary text generation
 * - Full comparison pipeline
 * - Edge cases: zero trades, identical strategies, missing metrics
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { compareStrategies } from "../comparison-engine";
import { calculateMetricDiff, COMPARISON_METRICS } from "../metric-diff";
import {
  resolveGroupWinner,
  resolveCategoryWinners,
  generateSummaryText,
} from "../winner-resolver";
import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import type { MetricDiff, MetricGroup, ComparisonStrategyInfo } from "../types";

// =============================================================================
// TEST FIXTURES / 测试数据
// =============================================================================

function createMockResult(
  overrides?: Partial<UnifiedBacktestResult>
): UnifiedBacktestResult {
  return {
    jobId: "test-job-1",
    timestamp: Date.now(),
    executionTime: 1500,
    target: {
      mode: "stock",
      stock: { symbol: "600519", name: "贵州茅台", market: "SH" },
    },
    returnMetrics: {
      totalReturn: 0.235,
      annualizedReturn: 0.18,
      monthlyReturns: [0.02, 0.03, -0.01],
      returnVolatility: 0.15,
      bestMonth: 0.08,
      worstMonth: -0.05,
    },
    riskMetrics: {
      maxDrawdown: 0.083,
      maxDrawdownDuration: 15,
      sharpeRatio: 1.45,
      sortinoRatio: 1.8,
      calmarRatio: 2.17,
    },
    tradingMetrics: {
      totalTrades: 24,
      winningTrades: 15,
      losingTrades: 9,
      winRate: 0.625,
      profitFactor: 1.85,
      avgWin: 0.035,
      avgLoss: -0.018,
      avgHoldingDays: 8,
      maxConsecutiveWins: 5,
      maxConsecutiveLosses: 3,
      maxSingleWin: 0.12,
      maxSingleLoss: -0.06,
      tradingFrequency: 2,
    },
    equityCurve: [
      { date: "2025-01-02", equity: 100000, drawdown: 0 },
      { date: "2025-06-30", equity: 112350, drawdown: 0.01 },
      { date: "2025-12-31", equity: 123500, drawdown: 0.02 },
    ],
    config: {
      symbol: "600519",
      initialCapital: 100000,
      commission: 0.0003,
      slippage: 0.001,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      timeframe: "1d",
    },
    strategy: {
      name: "MACD Golden Cross",
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      indicators: ["MACD"],
      entryCondition: "MACD golden cross",
      exitCondition: "MACD death cross",
    },
    ...overrides,
  };
}

function createMockResultB(): UnifiedBacktestResult {
  return createMockResult({
    jobId: "test-job-2",
    returnMetrics: {
      totalReturn: 0.15,
      annualizedReturn: 0.12,
      monthlyReturns: [0.01, 0.02, 0.0],
      returnVolatility: 0.2,
      bestMonth: 0.06,
      worstMonth: -0.08,
    },
    riskMetrics: {
      maxDrawdown: 0.12,
      maxDrawdownDuration: 25,
      sharpeRatio: 0.95,
      sortinoRatio: 1.2,
      calmarRatio: 1.0,
    },
    tradingMetrics: {
      totalTrades: 30,
      winningTrades: 14,
      losingTrades: 16,
      winRate: 0.467,
      profitFactor: 1.35,
      avgWin: 0.04,
      avgLoss: -0.025,
      avgHoldingDays: 12,
      maxConsecutiveWins: 4,
      maxConsecutiveLosses: 5,
      maxSingleWin: 0.15,
      maxSingleLoss: -0.09,
      tradingFrequency: 2.5,
    },
    strategy: {
      name: "KDJ Reversal",
      params: { kPeriod: 9, dPeriod: 3, smooth: 3 },
      indicators: ["KDJ"],
      entryCondition: "KDJ oversold cross",
      exitCondition: "KDJ overbought cross",
    },
  });
}

function createMockScore(grade: "S" | "A" | "B" | "C" | "D"): StrategyScore {
  const configs = {
    S: { score: 92, description: "卓越" },
    A: { score: 78, description: "优秀" },
    B: { score: 65, description: "良好" },
    C: { score: 45, description: "一般" },
    D: { score: 25, description: "需改进" },
  };
  const config = configs[grade];
  return {
    grade,
    score: config.score,
    description: config.description,
    coreMetrics: {
      totalReturn: new Decimal(0.235),
      annualizedReturn: new Decimal(0.18),
      maxDrawdown: new Decimal(0.083),
      sharpeRatio: new Decimal(1.45),
    },
    breakdown: { profitability: 85, risk: 72, stability: 80, efficiency: 65 },
  };
}

// =============================================================================
// METRIC DIFF TESTS / 指标差异测试
// =============================================================================

describe("calculateMetricDiff", () => {
  it("should calculate diff for higher-is-better metric (totalReturn)", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "totalReturn")!;
    const diff = calculateMetricDiff(def, 0.235, 0.15);

    expect(diff.key).toBe("totalReturn");
    expect(diff.valueA).toBeCloseTo(0.235, 5);
    expect(diff.valueB).toBeCloseTo(0.15, 5);
    expect(diff.absoluteDiff).toBeCloseTo(0.085, 5);
    expect(diff.winner).toBe("a");
    expect(diff.directionForA).toBe("better");
    expect(diff.higherIsBetter).toBe(true);
  });

  it("should calculate diff for lower-is-better metric (maxDrawdown)", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "maxDrawdown")!;
    // A has 0.083, B has 0.12 — A is lower, so A wins
    const diff = calculateMetricDiff(def, 0.083, 0.12);

    expect(diff.winner).toBe("a");
    expect(diff.directionForA).toBe("better");
    expect(diff.absoluteDiff).toBeCloseTo(-0.037, 5);
  });

  it("should determine tie when diff below threshold", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "totalReturn")!;
    // Diff = 0.0005, threshold = 0.001
    const diff = calculateMetricDiff(def, 0.1005, 0.1);

    expect(diff.winner).toBe("tie");
    expect(diff.directionForA).toBe("neutral");
  });

  it("should handle B winning for higher-is-better metric", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "sharpeRatio")!;
    const diff = calculateMetricDiff(def, 0.5, 1.5);

    expect(diff.winner).toBe("b");
    expect(diff.directionForA).toBe("worse");
  });

  it("should calculate percentage diff correctly", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "totalReturn")!;
    const diff = calculateMetricDiff(def, 0.30, 0.20);

    // (0.30 - 0.20) / 0.20 * 100 = 50%
    expect(diff.percentDiff).toBeCloseTo(50, 0);
  });

  it("should return null percentDiff when base value is zero", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "totalReturn")!;
    const diff = calculateMetricDiff(def, 0.10, 0);

    expect(diff.percentDiff).toBeNull();
  });

  it("should handle identical values as tie", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "winRate")!;
    const diff = calculateMetricDiff(def, 0.5, 0.5);

    expect(diff.winner).toBe("tie");
    expect(diff.absoluteDiff).toBe(0);
  });

  it("should handle negative values correctly", () => {
    const def = COMPARISON_METRICS.find((m) => m.key === "totalReturn")!;
    const diff = calculateMetricDiff(def, -0.05, -0.10);

    // A is -5%, B is -10%. A is better (higher).
    expect(diff.winner).toBe("a");
    expect(diff.absoluteDiff).toBeCloseTo(0.05, 5);
  });
});

// =============================================================================
// GROUP WINNER TESTS / 分组胜者测试
// =============================================================================

describe("resolveGroupWinner", () => {
  it("should return 'a' when A wins more metrics", () => {
    const metrics: MetricDiff[] = [
      { key: "m1", label: "M1", valueA: 0.2, valueB: 0.1, absoluteDiff: 0.1, percentDiff: 100, higherIsBetter: true, winner: "a", directionForA: "better" },
      { key: "m2", label: "M2", valueA: 0.3, valueB: 0.2, absoluteDiff: 0.1, percentDiff: 50, higherIsBetter: true, winner: "a", directionForA: "better" },
      { key: "m3", label: "M3", valueA: 0.1, valueB: 0.2, absoluteDiff: -0.1, percentDiff: -50, higherIsBetter: true, winner: "b", directionForA: "worse" },
    ];
    expect(resolveGroupWinner(metrics)).toBe("a");
  });

  it("should return 'b' when B wins more metrics", () => {
    const metrics: MetricDiff[] = [
      { key: "m1", label: "M1", valueA: 0.1, valueB: 0.2, absoluteDiff: -0.1, percentDiff: -50, higherIsBetter: true, winner: "b", directionForA: "worse" },
      { key: "m2", label: "M2", valueA: 0.1, valueB: 0.3, absoluteDiff: -0.2, percentDiff: -67, higherIsBetter: true, winner: "b", directionForA: "worse" },
    ];
    expect(resolveGroupWinner(metrics)).toBe("b");
  });

  it("should return 'tie' when equal wins", () => {
    const metrics: MetricDiff[] = [
      { key: "m1", label: "M1", valueA: 0.2, valueB: 0.1, absoluteDiff: 0.1, percentDiff: 100, higherIsBetter: true, winner: "a", directionForA: "better" },
      { key: "m2", label: "M2", valueA: 0.1, valueB: 0.2, absoluteDiff: -0.1, percentDiff: -50, higherIsBetter: true, winner: "b", directionForA: "worse" },
    ];
    expect(resolveGroupWinner(metrics)).toBe("tie");
  });

  it("should return 'tie' for empty metrics", () => {
    expect(resolveGroupWinner([])).toBe("tie");
  });
});

// =============================================================================
// CATEGORY WINNERS TESTS / 分类胜者测试
// =============================================================================

describe("resolveCategoryWinners", () => {
  it("should resolve all category winners", () => {
    const groups: MetricGroup[] = [
      { key: "return", label: "收益指标", metrics: [], winner: "a" },
      { key: "risk", label: "风险指标", metrics: [], winner: "a" },
      { key: "trading", label: "交易指标", metrics: [], winner: "b" },
    ];

    const result = resolveCategoryWinners(groups);

    expect(result.byReturn).toBe("a");
    expect(result.byRisk).toBe("a");
    expect(result.byTrading).toBe("b");
    // A wins return (0.4) + risk (0.35) = 0.75, B wins trading (0.25)
    // Overall: 0.75 - 0.25 = 0.50 > 0, so A wins
    expect(result.overall).toBe("a");
  });

  it("should return tie when balanced", () => {
    const groups: MetricGroup[] = [
      { key: "return", label: "收益指标", metrics: [], winner: "tie" },
      { key: "risk", label: "风险指标", metrics: [], winner: "tie" },
      { key: "trading", label: "交易指标", metrics: [], winner: "tie" },
    ];

    const result = resolveCategoryWinners(groups);
    expect(result.overall).toBe("tie");
  });

  it("should handle missing groups gracefully", () => {
    const groups: MetricGroup[] = [
      { key: "return", label: "收益指标", metrics: [], winner: "b" },
    ];

    const result = resolveCategoryWinners(groups);
    expect(result.byReturn).toBe("b");
    expect(result.byRisk).toBe("tie");
    expect(result.byTrading).toBe("tie");
  });
});

// =============================================================================
// SUMMARY TEXT TESTS / 摘要文本测试
// =============================================================================

describe("generateSummaryText", () => {
  const infoA: ComparisonStrategyInfo = {
    name: "MACD Golden Cross",
    score: null,
    equityCurve: [],
  };
  const infoB: ComparisonStrategyInfo = {
    name: "KDJ Reversal",
    score: null,
    equityCurve: [],
  };

  it("should generate tie summary", () => {
    const text = generateSummaryText(
      infoA,
      infoB,
      { byReturn: "tie", byRisk: "tie", byTrading: "tie", overall: "tie" },
      []
    );
    expect(text).toContain("MACD Golden Cross");
    expect(text).toContain("KDJ Reversal");
    expect(text).toContain("相近");
  });

  it("should generate winner summary with advantages", () => {
    const metrics: MetricDiff[] = [
      {
        key: "totalReturn",
        label: "总收益率",
        valueA: 0.235,
        valueB: 0.15,
        absoluteDiff: 0.085,
        percentDiff: 56.67,
        higherIsBetter: true,
        winner: "a",
        directionForA: "better",
      },
    ];

    const text = generateSummaryText(
      infoA,
      infoB,
      { byReturn: "a", byRisk: "a", byTrading: "b", overall: "a" },
      metrics
    );

    expect(text).toContain("MACD Golden Cross");
    expect(text).toContain("综合表现更优");
    expect(text).toContain("收益率高");
  });
});

// =============================================================================
// FULL COMPARISON TESTS / 完整对比测试
// =============================================================================

describe("compareStrategies", () => {
  it("should compare two strategies and produce complete result", () => {
    const resultA = createMockResult();
    const resultB = createMockResultB();
    const scoreA = createMockScore("A");
    const scoreB = createMockScore("B");

    const comparison = compareStrategies(resultA, resultB, scoreA, scoreB);

    // Strategy info
    expect(comparison.strategyA.name).toBe("MACD Golden Cross");
    expect(comparison.strategyB.name).toBe("KDJ Reversal");
    expect(comparison.strategyA.score?.grade).toBe("A");
    expect(comparison.strategyB.score?.grade).toBe("B");

    // Metric groups
    expect(comparison.metricGroups).toHaveLength(3);
    expect(comparison.metricGroups[0]!.key).toBe("return");
    expect(comparison.metricGroups[1]!.key).toBe("risk");
    expect(comparison.metricGroups[2]!.key).toBe("trading");

    // All metrics should be populated
    expect(comparison.allMetrics.length).toBe(COMPARISON_METRICS.length);

    // Winners should be resolved
    expect(comparison.winners).toBeDefined();
    expect(["a", "b", "tie"]).toContain(comparison.winners.overall);

    // Summary text
    expect(comparison.summaryText).toBeTruthy();
    expect(typeof comparison.summaryText).toBe("string");
  });

  it("should handle Strategy A winning clearly", () => {
    const resultA = createMockResult(); // Better metrics
    const resultB = createMockResultB(); // Worse metrics

    const comparison = compareStrategies(resultA, resultB);

    // A has better return, risk, so A should win overall
    expect(comparison.winners.byReturn).toBe("a");
    expect(comparison.winners.byRisk).toBe("a");
    expect(comparison.winners.overall).toBe("a");
  });

  it("should handle identical strategies as tie", () => {
    const result = createMockResult();
    const comparison = compareStrategies(result, result);

    // Every metric should be tie
    for (const metric of comparison.allMetrics) {
      expect(metric.winner).toBe("tie");
      expect(metric.absoluteDiff).toBe(0);
    }

    expect(comparison.winners.overall).toBe("tie");
    expect(comparison.summaryText).toContain("相近");
  });

  it("should extract equity curves from both results", () => {
    const resultA = createMockResult();
    const resultB = createMockResultB();

    const comparison = compareStrategies(resultA, resultB);

    expect(comparison.strategyA.equityCurve).toHaveLength(3);
    expect(comparison.strategyB.equityCurve).toHaveLength(3);
    expect(comparison.strategyA.equityCurve[0]!.date).toBe("2025-01-02");
  });

  it("should handle empty equity curve gracefully", () => {
    const resultA = createMockResult({ equityCurve: [] });
    const resultB = createMockResultB();

    const comparison = compareStrategies(resultA, resultB);

    expect(comparison.strategyA.equityCurve).toHaveLength(0);
    expect(comparison.strategyB.equityCurve).toHaveLength(3);
  });

  it("should handle zero-trade strategy", () => {
    const resultA = createMockResult({
      tradingMetrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        avgHoldingDays: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        maxSingleWin: 0,
        maxSingleLoss: 0,
        tradingFrequency: 0,
      },
      returnMetrics: {
        totalReturn: 0,
        annualizedReturn: 0,
        monthlyReturns: [],
        returnVolatility: 0,
      },
    });
    const resultB = createMockResultB();

    const comparison = compareStrategies(resultA, resultB);

    // Should not crash; B should win overall
    expect(comparison.winners.overall).toBe("b");
    expect(comparison.allMetrics.length).toBe(COMPARISON_METRICS.length);
  });

  it("should use null scores when not provided", () => {
    const resultA = createMockResult();
    const resultB = createMockResultB();

    const comparison = compareStrategies(resultA, resultB);

    expect(comparison.strategyA.score).toBeNull();
    expect(comparison.strategyB.score).toBeNull();
  });

  it("should use default strategy name when name is empty", () => {
    const resultA = createMockResult({
      strategy: {
        name: "",
        params: {},
        indicators: [],
        entryCondition: "",
        exitCondition: "",
      },
    });
    const resultB = createMockResultB();

    const comparison = compareStrategies(resultA, resultB);

    expect(comparison.strategyA.name).toBe("Unknown Strategy");
  });
});

// =============================================================================
// COMPARISON METRICS DEFINITION TESTS / 指标定义测试
// =============================================================================

describe("COMPARISON_METRICS", () => {
  it("should have all required metric keys", () => {
    const keys = COMPARISON_METRICS.map((m) => m.key);
    expect(keys).toContain("totalReturn");
    expect(keys).toContain("annualizedReturn");
    expect(keys).toContain("maxDrawdown");
    expect(keys).toContain("sharpeRatio");
    expect(keys).toContain("winRate");
    expect(keys).toContain("profitFactor");
    expect(keys).toContain("totalTrades");
  });

  it("should have valid group assignments", () => {
    const validGroups = ["return", "risk", "trading"];
    for (const metric of COMPARISON_METRICS) {
      expect(validGroups).toContain(metric.group);
    }
  });

  it("should have Chinese labels for all metrics", () => {
    for (const metric of COMPARISON_METRICS) {
      expect(metric.label).toBeTruthy();
      expect(metric.label.length).toBeGreaterThan(0);
    }
  });

  it("should have non-negative neutral thresholds", () => {
    for (const metric of COMPARISON_METRICS) {
      expect(metric.neutralThreshold).toBeGreaterThanOrEqual(0);
    }
  });
});
