/**
 * Batch Backtest Service Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyFailure, buildFailureBreakdown, calculateBatchSummary } from "../parallel/batch-backtest-service";
import type { FailureRecord } from "../parallel/batch-backtest-types";
import type { StockSignalResult } from "../signal-scanner";

// =============================================================================
// classifyFailure
// =============================================================================

describe("classifyFailure", () => {
  it("should classify missing data errors", () => {
    expect(classifyFailure("No data available")).toBe("data_insufficient");
    expect(classifyFailure("Missing kline data")).toBe("data_insufficient");
    expect(classifyFailure("Insufficient data points")).toBe("data_insufficient");
    expect(classifyFailure("empty kline array")).toBe("data_insufficient");
  });

  it("should classify suspended stock errors", () => {
    expect(classifyFailure("Stock halted")).toBe("suspended");
    expect(classifyFailure("Trading suspended")).toBe("suspended");
    expect(classifyFailure("Delisted stock")).toBe("suspended");
  });

  it("should classify format errors", () => {
    expect(classifyFailure("Invalid date format")).toBe("format_error");
    expect(classifyFailure("Parse error")).toBe("format_error");
    expect(classifyFailure("Malformed response")).toBe("format_error");
  });

  it("should classify timeout errors", () => {
    expect(classifyFailure("Request timeout")).toBe("timeout");
    expect(classifyFailure("Operation aborted")).toBe("timeout");
    expect(classifyFailure("Cancelled")).toBe("timeout");
  });

  it("should classify unknown errors", () => {
    expect(classifyFailure("Something went wrong")).toBe("unknown");
    expect(classifyFailure("Unexpected")).toBe("unknown");
  });
});

// =============================================================================
// buildFailureBreakdown
// =============================================================================

describe("buildFailureBreakdown", () => {
  it("should group failures by reason", () => {
    const failures: FailureRecord[] = [
      { symbol: "000001", reason: "data_insufficient", message: "no data" },
      { symbol: "000002", reason: "data_insufficient", message: "missing" },
      { symbol: "000003", reason: "suspended", message: "halted" },
    ];
    const breakdown = buildFailureBreakdown(failures);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]!.reason).toBe("data_insufficient");
    expect(breakdown[0]!.count).toBe(2);
    expect(breakdown[0]!.symbols).toEqual(["000001", "000002"]);
    expect(breakdown[1]!.reason).toBe("suspended");
    expect(breakdown[1]!.count).toBe(1);
  });

  it("should sort by count descending", () => {
    const failures: FailureRecord[] = [
      { symbol: "A", reason: "timeout", message: "t" },
      { symbol: "B", reason: "suspended", message: "s" },
      { symbol: "C", reason: "suspended", message: "s" },
      { symbol: "D", reason: "suspended", message: "s" },
    ];
    const breakdown = buildFailureBreakdown(failures);
    expect(breakdown[0]!.reason).toBe("suspended");
    expect(breakdown[0]!.count).toBe(3);
  });

  it("should return empty array for no failures", () => {
    expect(buildFailureBreakdown([])).toEqual([]);
  });
});

// =============================================================================
// calculateBatchSummary
// =============================================================================

function mockStockResult(signals: Array<{ returnPct?: number }>): StockSignalResult {
  return {
    symbol: "TEST",
    name: "Test Stock",
    totalSignals: signals.length,
    signals: signals.map((s) => ({
      symbol: "TEST", name: "Test", type: "buy" as const, signal: "test",
      strength: 50, entryDate: "2024-01-01", exitDate: "2024-01-05",
      entryPrice: 10, exitPrice: 11, returnPct: s.returnPct ?? 0,
      isWin: (s.returnPct ?? 0) > 0, holdingDays: 5, status: "completed" as const,
    })),
    avgReturn: 0,
    winRate: 0,
    winSignals: 0,
    maxReturn: 0,
    minReturn: 0,
  };
}

describe("calculateBatchSummary", () => {
  it("should calculate correct summary from successful results", () => {
    const results = [
      mockStockResult([{ returnPct: 5.0 }, { returnPct: -2.0 }]),
      mockStockResult([{ returnPct: 3.0 }]),
    ];
    const summary = calculateBatchSummary(results, 3, 1, 5000);
    expect(summary.totalStocks).toBe(3);
    expect(summary.succeededStocks).toBe(2);
    expect(summary.failedStocks).toBe(1);
    expect(summary.totalSignals).toBe(3);
    expect(summary.positiveReturns).toBe(2);
    expect(summary.negativeReturns).toBe(1);
    expect(summary.maxReturn).toBe(5.0);
    expect(summary.minReturn).toBe(-2.0);
    expect(summary.winRate).toBeCloseTo(2 / 3);
  });

  it("should handle empty results", () => {
    const summary = calculateBatchSummary([], 0, 0, 0);
    expect(summary.totalSignals).toBe(0);
    expect(summary.avgReturn).toBe(0);
    expect(summary.winRate).toBe(0);
    expect(summary.maxReturn).toBe(0);
    expect(summary.minReturn).toBe(0);
  });

  it("should handle results with no return data", () => {
    const results = [mockStockResult([])];
    const summary = calculateBatchSummary(results, 1, 0, 1000);
    expect(summary.totalSignals).toBe(0);
    expect(summary.avgReturn).toBe(0);
  });

  it("should calculate correct timing", () => {
    const summary = calculateBatchSummary([], 10, 0, 20000);
    expect(summary.totalTimeMs).toBe(20000);
    expect(summary.avgTimePerStockMs).toBe(2000);
  });
});
