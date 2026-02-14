/**
 * Report Data Assembler Tests
 *
 * Covers: data extraction, formatting, edge cases (empty trades, zero trades,
 * missing optional fields), multi-stock mode ranking, and filename generation.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  assembleReportData,
  assembleCoverData,
  assembleScoreData,
  assembleMetricsData,
  assembleTradeListData,
  assembleStockRankingData,
  generateFilename,
} from "../report-data-assembler";
import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockResult(
  overrides: Partial<UnifiedBacktestResult> = {}
): UnifiedBacktestResult {
  return {
    jobId: "test-job-1",
    timestamp: Date.now(),
    executionTime: 1234,
    target: {
      mode: "stock",
      stock: { symbol: "600519", name: "\u8D35\u5DDE\u8305\u53F0", market: "SH" },
    },
    returnMetrics: {
      totalReturn: 25.5,
      annualizedReturn: 12.3,
      monthlyReturns: [2.1, -1.5, 3.0],
      returnVolatility: 0.18,
      bestMonth: 5.2,
      worstMonth: -3.8,
    },
    riskMetrics: {
      maxDrawdown: 15.2,
      maxDrawdownDuration: 30,
      sharpeRatio: 1.45,
      sortinoRatio: 1.8,
      calmarRatio: 0.81,
    },
    tradingMetrics: {
      totalTrades: 42,
      winningTrades: 25,
      losingTrades: 17,
      winRate: 59.5,
      profitFactor: 1.68,
      avgWin: 3.2,
      avgLoss: -2.1,
      avgHoldingDays: 8.5,
      maxConsecutiveWins: 6,
      maxConsecutiveLosses: 3,
      maxSingleWin: 12.5,
      maxSingleLoss: -7.8,
      tradingFrequency: 3.5,
    },
    equityCurve: [
      { date: "2024-01-01", equity: 100000, drawdown: 0 },
      { date: "2024-06-01", equity: 112500, drawdown: -2.5 },
    ],
    config: {
      symbol: "600519",
      initialCapital: 100000,
      commission: 0.0003,
      slippage: 0.001,
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      timeframe: "1d",
    },
    strategy: {
      name: "MACD Golden Cross",
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      indicators: ["MACD"],
      entryCondition: "macd > signal",
      exitCondition: "macd < signal",
    },
    ...overrides,
  };
}

function createMockScore(
  overrides: Partial<StrategyScore> = {}
): StrategyScore {
  return {
    grade: "A",
    score: 78,
    description: "\u4F18\u79C0",
    coreMetrics: {
      totalReturn: new Decimal(25.5),
      annualizedReturn: new Decimal(12.3),
      maxDrawdown: new Decimal(15.2),
      sharpeRatio: new Decimal(1.45),
    },
    breakdown: {
      profitability: 80,
      risk: 75,
      stability: 70,
      efficiency: 85,
    },
    ...overrides,
  };
}

// =============================================================================
// COVER DATA
// =============================================================================

describe("assembleCoverData", () => {
  it("should assemble cover data for single stock mode", () => {
    const result = createMockResult();
    const score = createMockScore();
    const cover = assembleCoverData(result, score);

    expect(cover.title).toBe("\u7B56\u7565\u56DE\u6D4B\u62A5\u544A");
    expect(cover.strategyName).toBe("MACD Golden Cross");
    expect(cover.parametersSummary).toContain("fastPeriod=12");
    expect(cover.dateRange).toContain("2024-01-01");
    expect(cover.dateRange).toContain("2024-12-31");
    expect(cover.targetInfo).toBe("\u8D35\u5DDE\u8305\u53F0 (600519)");
    expect(cover.grade).toBe("A");
    expect(cover.score).toBe(78);
    expect(cover.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("should handle sector mode target", () => {
    const result = createMockResult({
      target: {
        mode: "sector",
        sector: {
          code: "BK0475",
          name: "\u767D\u9152",
          type: "industry",
        },
      },
    });
    const cover = assembleCoverData(result, null);
    expect(cover.targetInfo).toBe("\u767D\u9152");
    expect(cover.grade).toBe("D");
    expect(cover.score).toBe(0);
  });

  it("should handle portfolio mode target", () => {
    const result = createMockResult({
      target: {
        mode: "portfolio",
        portfolio: {
          name: "My Portfolio",
          stocks: [
            { symbol: "600519", name: "\u8D35\u5DDE\u8305\u53F0" },
            { symbol: "000858", name: "\u4E94\u7CAE\u6DB2" },
          ],
        },
      },
    });
    const cover = assembleCoverData(result, null);
    expect(cover.targetInfo).toBe("My Portfolio (2 stocks)");
  });

  it("should truncate long strategy names", () => {
    const result = createMockResult({
      strategy: {
        name: "A".repeat(60),
        params: {},
        indicators: [],
        entryCondition: "",
        exitCondition: "",
      },
    });
    const cover = assembleCoverData(result, null);
    expect(cover.strategyName.length).toBeLessThanOrEqual(40);
    expect(cover.strategyName).toContain("\u2026");
  });

  it("should handle empty strategy params", () => {
    const result = createMockResult({
      strategy: {
        name: "Simple",
        params: {},
        indicators: [],
        entryCondition: "",
        exitCondition: "",
      },
    });
    const cover = assembleCoverData(result, null);
    expect(cover.parametersSummary).toBe("");
  });
});

// =============================================================================
// SCORE DATA
// =============================================================================

describe("assembleScoreData", () => {
  it("should return null when score is null", () => {
    expect(assembleScoreData(null)).toBeNull();
  });

  it("should assemble score data correctly", () => {
    const score = createMockScore();
    const data = assembleScoreData(score);

    expect(data).not.toBeNull();
    expect(data!.grade).toBe("A");
    expect(data!.score).toBe(78);
    expect(data!.breakdown.profitability).toBe(80);
  });
});

// =============================================================================
// METRICS DATA
// =============================================================================

describe("assembleMetricsData", () => {
  it("should assemble 3 categories of metrics", () => {
    const result = createMockResult();
    const data = assembleMetricsData(result);

    expect(data.returnMetrics.length).toBeGreaterThan(0);
    expect(data.riskMetrics.length).toBeGreaterThan(0);
    expect(data.tradingMetrics.length).toBeGreaterThan(0);
  });

  it("should format percentages correctly", () => {
    const result = createMockResult();
    const data = assembleMetricsData(result);

    // totalReturn is 25.5, stored as percentage already
    const totalReturnRow = data.returnMetrics.find((r) =>
      r.label.includes("\u603B\u6536\u76CA")
    );
    expect(totalReturnRow).toBeDefined();
    expect(totalReturnRow!.value).toMatch(/%$/);
  });

  it("should mark profitable metrics as profit highlight", () => {
    const result = createMockResult();
    const data = assembleMetricsData(result);

    const totalReturnRow = data.returnMetrics[0]!;
    expect(totalReturnRow.highlight).toBe("profit");
  });

  it("should handle N/A for missing optional fields", () => {
    const result = createMockResult({
      returnMetrics: {
        totalReturn: 10,
        annualizedReturn: 5,
        monthlyReturns: [],
        returnVolatility: 0.15,
        // bestMonth and worstMonth undefined
      },
      riskMetrics: {
        maxDrawdown: 10,
        maxDrawdownDuration: 20,
        sharpeRatio: 1.0,
        sortinoRatio: 1.2,
        calmarRatio: 0.5,
        // var95 undefined
      },
    });
    const data = assembleMetricsData(result);

    // Alpha should be N/A since it was not in returnMetrics
    const alphaRow = data.returnMetrics.find((r) => r.label.includes("Alpha"));
    expect(alphaRow?.value).toBe("N/A");

    // VaR should be N/A
    const varRow = data.riskMetrics.find((r) => r.label.includes("VaR"));
    expect(varRow?.value).toBe("N/A");
  });
});

// =============================================================================
// TRADE LIST DATA
// =============================================================================

describe("assembleTradeListData", () => {
  it("should return null for empty trades", () => {
    const result = createMockResult({ trades: [] });
    expect(assembleTradeListData(result)).toBeNull();
  });

  it("should return null for undefined trades", () => {
    const result = createMockResult({ trades: undefined });
    expect(assembleTradeListData(result)).toBeNull();
  });

  it("should cap at 20 trades and indicate hasMore", () => {
    const trades = Array.from({ length: 30 }, (_, i) => ({
      id: `t-${i}`,
      timestamp: 1704067200 + i * 86400,
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      type: i % 2 === 0 ? ("buy" as const) : ("sell" as const),
      symbol: "600519",
      symbolName: "\u8D35\u5DDE\u8305\u53F0",
      signalPrice: 1800 + i,
      executePrice: 1800.5 + i,
      slippage: 0.5,
      slippagePercent: 0.028,
      commission: 0.54,
      commissionPercent: 0.03,
      totalCost: 1.04,
      lotCalculation: {
        requestedQuantity: 100,
        lotSize: 100,
        actualLots: 1,
        actualQuantity: 100,
        roundingLoss: 0,
        roundingLossPercent: 0,
      },
      requestedQuantity: 100,
      actualQuantity: 100,
      lots: 1,
      lotSize: 100,
      quantityUnit: "\u80A1",
      orderValue: 180050,
      cashBefore: 100000,
      cashAfter: 82000,
      positionBefore: 0,
      positionAfter: 100,
      portfolioValueBefore: 100000,
      portfolioValueAfter: 100000,
      pnl: i % 2 === 1 ? (i > 15 ? 500 : -200) : undefined,
      pnlPercent: i % 2 === 1 ? (i > 15 ? 2.8 : -1.1) : undefined,
      holdingDays: i % 2 === 1 ? 5 : undefined,
      triggerReason: "Signal triggered",
      indicatorValues: {},
    }));

    const result = createMockResult({ trades });
    const data = assembleTradeListData(result);

    expect(data).not.toBeNull();
    expect(data!.trades).toHaveLength(20);
    expect(data!.totalTrades).toBe(30);
    expect(data!.hasMore).toBe(true);
    expect(data!.moreCount).toBe(10);
  });

  it("should not set hasMore when trades <= 20", () => {
    const trades = Array.from({ length: 5 }, (_, i) => ({
      id: `t-${i}`,
      timestamp: 1704067200,
      date: "2024-01-01",
      type: "buy" as const,
      symbol: "600519",
      symbolName: "\u8D35\u5DDE\u8305\u53F0",
      signalPrice: 1800,
      executePrice: 1800.5,
      slippage: 0.5,
      slippagePercent: 0.028,
      commission: 0.54,
      commissionPercent: 0.03,
      totalCost: 1.04,
      lotCalculation: {
        requestedQuantity: 100,
        lotSize: 100,
        actualLots: 1,
        actualQuantity: 100,
        roundingLoss: 0,
        roundingLossPercent: 0,
      },
      requestedQuantity: 100,
      actualQuantity: 100,
      lots: 1,
      lotSize: 100,
      quantityUnit: "\u80A1",
      orderValue: 180050,
      cashBefore: 100000,
      cashAfter: 82000,
      positionBefore: 0,
      positionAfter: 100,
      portfolioValueBefore: 100000,
      portfolioValueAfter: 100000,
      triggerReason: "Signal",
      indicatorValues: {},
    }));

    const result = createMockResult({ trades });
    const data = assembleTradeListData(result);

    expect(data!.hasMore).toBe(false);
    expect(data!.moreCount).toBe(0);
  });
});

// =============================================================================
// STOCK RANKING DATA
// =============================================================================

describe("assembleStockRankingData", () => {
  it("should return null for stock mode (single stock)", () => {
    const result = createMockResult();
    expect(assembleStockRankingData(result)).toBeNull();
  });

  it("should assemble ranking from sector result", () => {
    const result = createMockResult({
      target: {
        mode: "sector",
        sector: { code: "BK0475", name: "\u767D\u9152", type: "industry" },
      },
      sectorResult: {
        sectorCode: "BK0475",
        sectorName: "\u767D\u9152",
        stockCount: 5,
        backtestCount: 4,
        avgReturn: 15.0,
        medianReturn: 12.0,
        bestReturn: 35.0,
        worstReturn: -5.0,
        avgWinRate: 55.0,
        avgSharpeRatio: 1.1,
        stockResults: [
          {
            symbol: "600519",
            name: "\u8D35\u5DDE\u8305\u53F0",
            totalReturn: 35.0,
            winRate: 65.0,
            tradeCount: 10,
            contribution: 40,
            sharpeRatio: 1.8,
            maxDrawdown: 12.0,
          },
          {
            symbol: "000858",
            name: "\u4E94\u7CAE\u6DB2",
            totalReturn: 10.0,
            winRate: 50.0,
            tradeCount: 8,
            contribution: 20,
            sharpeRatio: 0.9,
            maxDrawdown: 18.0,
          },
          {
            symbol: "000568",
            name: "\u6CF8\u5DDE\u8001\u7A96",
            totalReturn: -5.0,
            winRate: 40.0,
            tradeCount: 6,
            contribution: -10,
            sharpeRatio: -0.2,
            maxDrawdown: 25.0,
          },
        ],
        topPerformers: [],
        bottomPerformers: [],
      },
    });

    const data = assembleStockRankingData(result);

    expect(data).not.toBeNull();
    expect(data!.totalStocks).toBe(3);
    expect(data!.stocks[0]!.rank).toBe(1);
    expect(data!.stocks[0]!.symbol).toBe("600519");
    // Should be sorted by return descending
    expect(data!.stocks[2]!.symbol).toBe("000568");
    expect(data!.failedCount).toBe(1); // 5 - 4
  });

  it("should assemble ranking from portfolio result", () => {
    const result = createMockResult({
      target: {
        mode: "portfolio",
        portfolio: {
          name: "Test",
          stocks: [
            { symbol: "600519", name: "\u8D35\u5DDE\u8305\u53F0" },
            { symbol: "000858", name: "\u4E94\u7CAE\u6DB2" },
          ],
        },
      },
      stockResults: [
        {
          symbol: "600519",
          name: "\u8D35\u5DDE\u8305\u53F0",
          totalReturn: 20.0,
          winRate: 60.0,
          tradeCount: 10,
          contribution: 60,
          sharpeRatio: 1.5,
          maxDrawdown: 10.0,
        },
        {
          symbol: "000858",
          name: "\u4E94\u7CAE\u6DB2",
          totalReturn: 5.0,
          winRate: 45.0,
          tradeCount: 8,
          contribution: 40,
          sharpeRatio: 0.6,
          maxDrawdown: 20.0,
        },
      ],
    });

    const data = assembleStockRankingData(result);
    expect(data).not.toBeNull();
    expect(data!.totalStocks).toBe(2);
    expect(data!.failedCount).toBeUndefined();
  });
});

// =============================================================================
// FULL ASSEMBLER
// =============================================================================

describe("assembleReportData", () => {
  it("should assemble complete report data", () => {
    const result = createMockResult();
    const score = createMockScore();
    const data = assembleReportData(result, score);

    expect(data.cover).toBeDefined();
    expect(data.score).not.toBeNull();
    expect(data.chartImage).toBeNull(); // Not populated by assembler
    expect(data.metrics.returnMetrics.length).toBeGreaterThan(0);
    expect(data.tradeList).toBeNull(); // No trades in mock
    expect(data.stockRanking).toBeNull(); // Single stock mode
  });

  it("should work without score", () => {
    const result = createMockResult();
    const data = assembleReportData(result);

    expect(data.cover.grade).toBe("D");
    expect(data.cover.score).toBe(0);
    expect(data.score).toBeNull();
  });
});

// =============================================================================
// FILENAME GENERATOR
// =============================================================================

describe("generateFilename", () => {
  it("should generate correct filename format", () => {
    const result = createMockResult();
    const filename = generateFilename(result);

    expect(filename).toMatch(
      /^\u56DE\u6D4B\u62A5\u544A_MACD_Golden_Cross_\d{8}$/
    );
  });

  it("should sanitize special characters in strategy name", () => {
    const result = createMockResult({
      strategy: {
        name: "Test/Strategy@v2",
        params: {},
        indicators: [],
        entryCondition: "",
        exitCondition: "",
      },
    });
    const filename = generateFilename(result);

    expect(filename).not.toContain("/");
    expect(filename).not.toContain("@");
  });

  it("should use fallback name for empty strategy", () => {
    const result = createMockResult({
      strategy: {
        name: "",
        params: {},
        indicators: [],
        entryCondition: "",
        exitCondition: "",
      },
    });
    const filename = generateFilename(result);

    expect(filename).toContain("strategy");
  });
});
