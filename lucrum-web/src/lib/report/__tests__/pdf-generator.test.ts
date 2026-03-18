/**
 * PDF Generator Integration Tests
 *
 * Tests the PDF generation pipeline with mocked jsPDF and html2canvas.
 * Verifies page composition, error handling, and download trigger.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";

// =============================================================================
// MOCK jsPDF
// =============================================================================

const mockJsPdfInstance = {
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  text: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  circle: vi.fn(),
  line: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  addFileToVFS: vi.fn(),
  addFont: vi.fn(),
  output: vi.fn().mockReturnValue(new Blob(["pdf-content"], { type: "application/pdf" })),
};

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => mockJsPdfInstance),
}));

// =============================================================================
// FIXTURES
// =============================================================================

function createMockResult(): UnifiedBacktestResult {
  return {
    jobId: "test-job-1",
    timestamp: Date.now(),
    executionTime: 500,
    target: {
      mode: "stock",
      stock: { symbol: "600519", name: "\u8D35\u5DDE\u8305\u53F0", market: "SH" },
    },
    returnMetrics: {
      totalReturn: 20.0,
      annualizedReturn: 10.0,
      monthlyReturns: [],
      returnVolatility: 0.15,
    },
    riskMetrics: {
      maxDrawdown: 12.0,
      maxDrawdownDuration: 15,
      sharpeRatio: 1.2,
      sortinoRatio: 1.5,
      calmarRatio: 0.83,
    },
    tradingMetrics: {
      totalTrades: 10,
      winningTrades: 6,
      losingTrades: 4,
      winRate: 60.0,
      profitFactor: 1.5,
      avgWin: 3.0,
      avgLoss: -2.0,
      avgHoldingDays: 7,
      maxConsecutiveWins: 4,
      maxConsecutiveLosses: 2,
      maxSingleWin: 8.0,
      maxSingleLoss: -5.0,
      tradingFrequency: 2.0,
    },
    equityCurve: [],
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
      name: "Test Strategy",
      params: { period: 20 },
      indicators: ["SMA"],
      entryCondition: "close > sma",
      exitCondition: "close < sma",
    },
  };
}

function createMockScore(): StrategyScore {
  return {
    grade: "B",
    score: 65,
    description: "\u826F\u597D",
    coreMetrics: {
      totalReturn: new Decimal(20),
      annualizedReturn: new Decimal(10),
      maxDrawdown: new Decimal(12),
      sharpeRatio: new Decimal(1.2),
    },
    breakdown: {
      profitability: 70,
      risk: 65,
      stability: 60,
      efficiency: 68,
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("generatePdfReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock font fetch (will return non-ok to trigger fallback)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
  });

  it("should generate PDF successfully with score", async () => {
    const { generatePdfReport } = await import("../pdf-generator");
    const result = createMockResult();
    const score = createMockScore();

    const genResult = await generatePdfReport(result, score, {
      includeChart: false,
    });

    expect(genResult.success).toBe(true);
    expect(genResult.filename).toMatch(/\.pdf$/);
    expect(genResult.error).toBeUndefined();
  });

  it("should generate PDF without score (cover + metrics only)", async () => {
    const { generatePdfReport } = await import("../pdf-generator");
    const result = createMockResult();

    const genResult = await generatePdfReport(result, null, {
      includeChart: false,
    });

    expect(genResult.success).toBe(true);
    // Should still have cover and metrics pages
    // Score page should be skipped
    expect(mockJsPdfInstance.addPage).toHaveBeenCalled();
  });

  it("should use custom filename when provided", async () => {
    const { generatePdfReport } = await import("../pdf-generator");
    const result = createMockResult();

    const genResult = await generatePdfReport(result, null, {
      includeChart: false,
      filename: "custom_report",
    });

    expect(genResult.filename).toBe("custom_report.pdf");
  });

  it("should handle jsPDF construction errors gracefully", async () => {
    // Make jsPDF constructor throw
    const jspdfModule = await import("jspdf");
    vi.mocked(jspdfModule.jsPDF).mockImplementationOnce(() => {
      throw new Error("jsPDF init failed");
    });

    const { generatePdfReport } = await import("../pdf-generator");
    const result = createMockResult();

    const genResult = await generatePdfReport(result, null, {
      includeChart: false,
    });

    expect(genResult.success).toBe(false);
    expect(genResult.error).toContain("jsPDF init failed");
  });

  it("should render trade list page when trades exist", async () => {
    const { generatePdfReport } = await import("../pdf-generator");
    const result = createMockResult();
    result.trades = [
      {
        id: "t1",
        timestamp: 1704067200,
        date: "2024-01-01",
        type: "buy",
        symbol: "600519",
        symbolName: "\u8D35\u5DDE\u8305\u53F0",
        signalPrice: 1800,
        executePrice: 1801,
        slippage: 1,
        slippagePercent: 0.055,
        commission: 0.54,
        commissionPercent: 0.03,
        totalCost: 1.54,
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
        orderValue: 180100,
        cashBefore: 200000,
        cashAfter: 19900,
        positionBefore: 0,
        positionAfter: 100,
        portfolioValueBefore: 200000,
        portfolioValueAfter: 200000,
        triggerReason: "MACD crossover",
        indicatorValues: { macd: 0.5 },
      },
    ];

    const genResult = await generatePdfReport(result, null, {
      includeChart: false,
    });

    expect(genResult.success).toBe(true);
    // More pages should be added (metrics + trades)
    expect(mockJsPdfInstance.addPage.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("generatePdfReport - stock ranking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
  });

  it("should include stock ranking page for sector mode", async () => {
    const { generatePdfReport } = await import("../pdf-generator");
    const result = createMockResult();
    result.target = {
      mode: "sector",
      sector: { code: "BK0475", name: "\u767D\u9152", type: "industry" },
    };
    result.sectorResult = {
      sectorCode: "BK0475",
      sectorName: "\u767D\u9152",
      stockCount: 3,
      backtestCount: 3,
      avgReturn: 15.0,
      medianReturn: 12.0,
      bestReturn: 25.0,
      worstReturn: 5.0,
      avgWinRate: 55.0,
      avgSharpeRatio: 1.1,
      stockResults: [
        {
          symbol: "600519",
          name: "\u8D35\u5DDE\u8305\u53F0",
          totalReturn: 25.0,
          winRate: 60.0,
          tradeCount: 10,
          contribution: 50,
          sharpeRatio: 1.5,
          maxDrawdown: 10.0,
        },
        {
          symbol: "000858",
          name: "\u4E94\u7CAE\u6DB2",
          totalReturn: 15.0,
          winRate: 55.0,
          tradeCount: 8,
          contribution: 30,
          sharpeRatio: 1.0,
          maxDrawdown: 15.0,
        },
      ],
      topPerformers: [],
      bottomPerformers: [],
    };

    const genResult = await generatePdfReport(result, null, {
      includeChart: false,
    });

    expect(genResult.success).toBe(true);
  });
});
