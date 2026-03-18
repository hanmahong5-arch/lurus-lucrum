/**
 * Diagnostics engine tests
 * 诊断引擎测试
 */

import { describe, it, expect } from "vitest";
import type { DiagnosticInput } from "../diagnostics";
import {
  runDiagnostics,
  getDiagnosticSummary,
  filterDiagnosticsByCategory,
  getMostCriticalIssues,
} from "../diagnostics";
import type { DiagnosticReport } from "../types";

// =============================================================================
// HELPERS / 辅助工具
// =============================================================================

/** Build a DiagnosticInput with sensible defaults, override as needed */
function makeInput(overrides?: Partial<{
  returnMetrics: Partial<DiagnosticInput["returnMetrics"]>;
  riskMetrics: Partial<DiagnosticInput["riskMetrics"]>;
  tradingMetrics: Partial<DiagnosticInput["tradingMetrics"]>;
}>): DiagnosticInput {
  return {
    returnMetrics: {
      totalReturn: 0.15,
      annualizedReturn: 0.12,
      monthlyReturns: [0.01, 0.02, -0.01],
      returnVolatility: 0.15,
      ...overrides?.returnMetrics,
    },
    riskMetrics: {
      maxDrawdown: 12,
      maxDrawdownDuration: 30,
      sharpeRatio: 1.2,
      sortinoRatio: 1.5,
      calmarRatio: 1.0,
      ...overrides?.riskMetrics,
    },
    tradingMetrics: {
      totalTrades: 50,
      winningTrades: 30,
      losingTrades: 20,
      winRate: 60,
      profitFactor: 1.5,
      avgWin: 3.0,
      avgLoss: -2.0,
      avgHoldingDays: 5,
      maxConsecutiveWins: 5,
      maxConsecutiveLosses: 3,
      maxSingleWin: 8,
      maxSingleLoss: -5,
      tradingFrequency: 4,
      ...overrides?.tradingMetrics,
    },
  };
}

/** Build a healthy input that triggers no issues and some highlights */
function makeHealthyInput(): DiagnosticInput {
  return makeInput({
    returnMetrics: { totalReturn: 0.3, annualizedReturn: 0.25, returnVolatility: 0.08 },
    riskMetrics: { maxDrawdown: 8, sharpeRatio: 2.0, calmarRatio: 2.5 },
    tradingMetrics: { winRate: 70, profitFactor: 2.5 },
  });
}

/** Build a terrible input that triggers many issues */
function makeBadInput(): DiagnosticInput {
  return makeInput({
    returnMetrics: { totalReturn: -0.2, annualizedReturn: -0.1, alpha: -8, returnVolatility: 0.4 },
    riskMetrics: { maxDrawdown: 45, maxDrawdownDuration: 90, sharpeRatio: -0.5, calmarRatio: 0.2 },
    tradingMetrics: {
      totalTrades: 15,
      winningTrades: 3,
      losingTrades: 12,
      winRate: 20,
      profitFactor: 0.5,
      avgWin: 2,
      avgLoss: -4,
      avgHoldingDays: 1,
      maxConsecutiveWins: 1,
      maxConsecutiveLosses: 8,
      maxSingleWin: 5,
      maxSingleLoss: -15,
      tradingFrequency: 10,
    },
  });
}

// =============================================================================
// runDiagnostics
// =============================================================================

describe("runDiagnostics", () => {
  it("returns a valid report structure", () => {
    const report = runDiagnostics(makeInput());
    expect(report.timestamp).toBeGreaterThan(0);
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.highlights)).toBe(true);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high"]).toContain(report.riskLevel);
  });

  it("detects negative_return when totalReturn < 0", () => {
    const report = runDiagnostics(makeInput({ returnMetrics: { totalReturn: -0.1 } }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("negative_return");
  });

  it("detects low_annualized_return when between 0 and 5%", () => {
    const report = runDiagnostics(makeInput({ returnMetrics: { annualizedReturn: 0.03 } }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("low_annualized_return");
  });

  it("detects high_drawdown when maxDrawdown > 25", () => {
    const report = runDiagnostics(makeInput({ riskMetrics: { maxDrawdown: 30 } }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("high_drawdown");
  });

  it("detects very_high_drawdown when maxDrawdown > 40", () => {
    const report = runDiagnostics(makeInput({ riskMetrics: { maxDrawdown: 42 } }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("very_high_drawdown");
    // Should also trigger high_drawdown
    expect(ids).toContain("high_drawdown");
  });

  it("detects negative_sharpe when sharpeRatio < 0", () => {
    const report = runDiagnostics(makeInput({ riskMetrics: { sharpeRatio: -0.3 } }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("negative_sharpe");
  });

  it("detects few_trades when totalTrades < 20", () => {
    const report = runDiagnostics(makeInput({ tradingMetrics: { totalTrades: 10 } }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("few_trades");
  });

  it("detects overfit_risk with high sharpe and few trades", () => {
    const report = runDiagnostics(makeInput({
      riskMetrics: { sharpeRatio: 3.0 },
      tradingMetrics: { totalTrades: 10 },
    }));
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain("overfit_risk");
  });

  it("sorts issues by severity (error first, then warning, then info)", () => {
    const report = runDiagnostics(makeBadInput());
    const severities = report.issues.map((i) => i.severity);
    const order = { error: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]!]).toBeGreaterThanOrEqual(order[severities[i - 1]!]);
    }
  });

  it("produces highlights for a healthy strategy", () => {
    const report = runDiagnostics(makeHealthyInput());
    const ids = report.highlights.map((h) => h.id);
    expect(ids).toContain("excellent_sharpe");
    expect(ids).toContain("good_drawdown_control");
    expect(ids).toContain("high_win_rate");
    expect(ids).toContain("strong_annualized");
    expect(ids).toContain("high_profit_factor");
    expect(ids).toContain("consistent_returns");
  });

  it("returns riskLevel high for a terrible strategy", () => {
    const report = runDiagnostics(makeBadInput());
    expect(report.riskLevel).toBe("high");
  });

  it("returns riskLevel low for a healthy strategy", () => {
    const report = runDiagnostics(makeHealthyInput());
    expect(report.riskLevel).toBe("low");
  });

  it("clamps overallScore between 0 and 100", () => {
    const report = runDiagnostics(makeBadInput());
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// getDiagnosticSummary
// =============================================================================

describe("getDiagnosticSummary", () => {
  it("returns zh and en summary with issue counts", () => {
    const report = runDiagnostics(makeBadInput());
    const summary = getDiagnosticSummary(report);
    expect(summary.zh).toContain("严重问题");
    expect(summary.en).toContain("critical issue");
    expect(summary.zh).toContain("健康度");
    expect(summary.en).toContain("health score");
  });

  it("returns no-issue message when report is clean", () => {
    const report: DiagnosticReport = {
      timestamp: Date.now(),
      issues: [],
      highlights: [],
      overallScore: 85,
      riskLevel: "low",
    };
    const summary = getDiagnosticSummary(report);
    expect(summary.zh).toContain("无明显问题");
    expect(summary.en).toContain("no significant issues");
  });

  it("includes highlight count when highlights exist", () => {
    const report = runDiagnostics(makeHealthyInput());
    const summary = getDiagnosticSummary(report);
    expect(summary.zh).toContain("亮点");
    expect(summary.en).toContain("highlight");
  });
});

// =============================================================================
// filterDiagnosticsByCategory
// =============================================================================

describe("filterDiagnosticsByCategory", () => {
  it("filters return-category issues only", () => {
    const report = runDiagnostics(makeBadInput());
    const returnIssues = filterDiagnosticsByCategory(report, "return");
    const ids = returnIssues.map((i) => i.id);
    // negative_return and negative_alpha should be present
    expect(ids).toContain("negative_return");
    // No risk or trading ids should leak through
    for (const id of ids) {
      expect(["negative_return", "low_annualized_return", "negative_alpha", "high_return_volatility"]).toContain(id);
    }
  });

  it("returns empty array for category with no matching issues", () => {
    const report = runDiagnostics(makeHealthyInput());
    const generalIssues = filterDiagnosticsByCategory(report, "general");
    expect(generalIssues).toHaveLength(0);
  });
});

// =============================================================================
// getMostCriticalIssues
// =============================================================================

describe("getMostCriticalIssues", () => {
  it("returns at most maxCount issues", () => {
    const report = runDiagnostics(makeBadInput());
    const top3 = getMostCriticalIssues(report, 3);
    expect(top3.length).toBeLessThanOrEqual(3);
  });

  it("defaults to 3 when maxCount not specified", () => {
    const report = runDiagnostics(makeBadInput());
    const top = getMostCriticalIssues(report);
    expect(top.length).toBeLessThanOrEqual(3);
  });

  it("returns all issues when fewer than maxCount", () => {
    const input = makeInput({ tradingMetrics: { totalTrades: 10 } });
    const report = runDiagnostics(input);
    const top10 = getMostCriticalIssues(report, 10);
    expect(top10.length).toBe(report.issues.length);
  });

  it("returns most severe issues first (since report is sorted)", () => {
    const report = runDiagnostics(makeBadInput());
    const top = getMostCriticalIssues(report, 2);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0]!.severity).toBe("error");
  });
});
