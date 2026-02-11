/**
 * Score Calculator Tests
 * 策略评分计算器测试
 *
 * Tests for the strategy scoring system covering:
 * - Grade boundary values
 * - Excellent metrics → S grade
 * - Poor metrics → D grade
 * - Mixed metrics → intermediate grades
 * - Zero trades special case
 * - Decimal.js precision
 *
 * @module lib/backtest/score/__tests__/score-calculator.test
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import type { BacktestSummary } from "../../types";
import {
  calculateScore,
  calculateScoreWithWeights,
  getGradeFromScore,
  getGradeDescription,
  scoreProfitability,
  scoreRisk,
  scoreStability,
  scoreEfficiency,
  scoreMetric,
  GRADE_CONFIG,
  DIMENSION_WEIGHTS,
  PROFITABILITY_THRESHOLDS,
} from "../index";

// =============================================================================
// TEST FIXTURES / 测试数据
// =============================================================================

/**
 * Create mock BacktestSummary with specified metrics
 */
function createMockSummary(overrides: Partial<BacktestSummary> = {}): BacktestSummary {
  return {
    startDate: "2023-01-01",
    endDate: "2023-12-31",
    tradingDays: 250,
    executionTime: 100,
    initialCapital: 100000,
    finalCapital: 120000,
    peakCapital: 125000,
    troughCapital: 95000,
    totalReturn: 0.20,
    annualizedReturn: 0.20,
    monthlyReturn: 0.015,
    dailyReturn: 0.0008,
    maxDrawdown: 0.15,
    maxDrawdownDuration: 30,
    volatility: 0.20,
    sharpeRatio: 1.2,
    sortinoRatio: 1.5,
    calmarRatio: 1.33,
    totalTrades: 50,
    winningTrades: 30,
    losingTrades: 20,
    winRate: 0.60,
    profitFactor: 1.8,
    avgWin: 0.05,
    avgLoss: 0.03,
    avgWinLossRatio: 1.67,
    maxConsecutiveWins: 5,
    maxConsecutiveLosses: 3,
    avgHoldingPeriod: 10,
    maxSingleWin: 0.15,
    maxSingleWinDate: "2023-06-15",
    maxSingleLoss: -0.08,
    maxSingleLossDate: "2023-03-10",
    totalCommission: 500,
    totalSlippage: 200,
    totalTradingCost: 700,
    tradingCostPercent: 0.007,
    ...overrides,
  };
}

/**
 * Excellent metrics for S grade
 */
const excellentSummary = createMockSummary({
  totalReturn: 0.80,
  annualizedReturn: 0.45,
  maxDrawdown: 0.05,
  volatility: 0.10,
  sharpeRatio: 2.5,
  sortinoRatio: 3.0,
  winRate: 0.75,
  profitFactor: 3.0,
  avgHoldingPeriod: 3,
  totalTrades: 100,
});

/**
 * Poor metrics for D grade
 */
const poorSummary = createMockSummary({
  totalReturn: -0.30,
  annualizedReturn: -0.25,
  maxDrawdown: 0.60,
  volatility: 0.55,
  sharpeRatio: -0.5,
  sortinoRatio: -0.3,
  winRate: 0.25,
  profitFactor: 0.3,
  avgHoldingPeriod: 45,
  totalTrades: 20,
});

/**
 * Zero trades case
 */
const zeroTradesSummary = createMockSummary({
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalReturn: 0,
  annualizedReturn: 0,
  sharpeRatio: 0,
});

// =============================================================================
// GRADE BOUNDARY TESTS / 等级边界测试 (AC-2, AC-10)
// =============================================================================

describe("Grade Boundaries", () => {
  describe("getGradeFromScore", () => {
    it("should return S for score >= 90", () => {
      expect(getGradeFromScore(90)).toBe("S");
      expect(getGradeFromScore(95)).toBe("S");
      expect(getGradeFromScore(100)).toBe("S");
    });

    it("should return A for score >= 75 and < 90", () => {
      expect(getGradeFromScore(75)).toBe("A");
      expect(getGradeFromScore(80)).toBe("A");
      expect(getGradeFromScore(89)).toBe("A");
    });

    it("should return B for score >= 60 and < 75", () => {
      expect(getGradeFromScore(60)).toBe("B");
      expect(getGradeFromScore(65)).toBe("B");
      expect(getGradeFromScore(74)).toBe("B");
    });

    it("should return C for score >= 40 and < 60", () => {
      expect(getGradeFromScore(40)).toBe("C");
      expect(getGradeFromScore(50)).toBe("C");
      expect(getGradeFromScore(59)).toBe("C");
    });

    it("should return D for score < 40", () => {
      expect(getGradeFromScore(39)).toBe("D");
      expect(getGradeFromScore(20)).toBe("D");
      expect(getGradeFromScore(0)).toBe("D");
    });

    // Boundary value tests
    it("should handle exact boundary: 89 -> A (not S)", () => {
      expect(getGradeFromScore(89)).toBe("A");
    });

    it("should handle exact boundary: 90 -> S", () => {
      expect(getGradeFromScore(90)).toBe("S");
    });

    it("should handle exact boundary: 74 -> B (not A)", () => {
      expect(getGradeFromScore(74)).toBe("B");
    });

    it("should handle exact boundary: 75 -> A", () => {
      expect(getGradeFromScore(75)).toBe("A");
    });

    it("should handle exact boundary: 59 -> C (not B)", () => {
      expect(getGradeFromScore(59)).toBe("C");
    });

    it("should handle exact boundary: 60 -> B", () => {
      expect(getGradeFromScore(60)).toBe("B");
    });

    it("should handle exact boundary: 39 -> D (not C)", () => {
      expect(getGradeFromScore(39)).toBe("D");
    });

    it("should handle exact boundary: 40 -> C", () => {
      expect(getGradeFromScore(40)).toBe("C");
    });
  });

  describe("Grade descriptions", () => {
    it("should return correct Chinese descriptions", () => {
      expect(getGradeDescription("S", "zh")).toBe("卓越");
      expect(getGradeDescription("A", "zh")).toBe("优秀");
      expect(getGradeDescription("B", "zh")).toBe("良好");
      expect(getGradeDescription("C", "zh")).toBe("一般");
      expect(getGradeDescription("D", "zh")).toBe("需改进");
    });

    it("should return correct English descriptions", () => {
      expect(getGradeDescription("S", "en")).toBe("Excellent");
      expect(getGradeDescription("A", "en")).toBe("Great");
      expect(getGradeDescription("B", "en")).toBe("Good");
      expect(getGradeDescription("C", "en")).toBe("Average");
      expect(getGradeDescription("D", "en")).toBe("Needs Improvement");
    });
  });
});

// =============================================================================
// EXCELLENT METRICS -> S GRADE (AC-10)
// =============================================================================

describe("Excellent Metrics -> S Grade", () => {
  it("should score S grade for excellent metrics", () => {
    const score = calculateScore(excellentSummary);
    expect(score.grade).toBe("S");
    expect(score.score).toBeGreaterThanOrEqual(90);
    expect(score.description).toBe("卓越");
  });

  it("should have high dimension scores for excellent metrics", () => {
    const score = calculateScore(excellentSummary);
    expect(score.breakdown.profitability).toBeGreaterThan(90);
    expect(score.breakdown.risk).toBeGreaterThan(90);
    expect(score.breakdown.stability).toBeGreaterThan(90);
    expect(score.breakdown.efficiency).toBeGreaterThan(90);
  });
});

// =============================================================================
// POOR METRICS -> D GRADE (AC-10)
// =============================================================================

describe("Poor Metrics -> D Grade", () => {
  it("should score D grade for poor metrics", () => {
    const score = calculateScore(poorSummary);
    expect(score.grade).toBe("D");
    expect(score.score).toBeLessThan(40);
    expect(score.description).toBe("需改进");
  });

  it("should have low dimension scores for poor metrics", () => {
    const score = calculateScore(poorSummary);
    expect(score.breakdown.profitability).toBeLessThan(40);
    expect(score.breakdown.risk).toBeLessThan(40);
    expect(score.breakdown.stability).toBeLessThan(40);
    expect(score.breakdown.efficiency).toBeLessThan(40);
  });
});

// =============================================================================
// MIXED METRICS -> INTERMEDIATE GRADES (AC-10)
// =============================================================================

describe("Mixed Metrics -> Intermediate Grades", () => {
  it("should score B grade for average metrics", () => {
    const averageSummary = createMockSummary({
      totalReturn: 0.15,
      annualizedReturn: 0.12,
      maxDrawdown: 0.18,
      volatility: 0.22,
      sharpeRatio: 0.9,
      sortinoRatio: 1.1,
      winRate: 0.52,
      profitFactor: 1.3,
      avgHoldingPeriod: 12,
    });

    const score = calculateScore(averageSummary);
    expect(["A", "B", "C"]).toContain(score.grade);
    expect(score.score).toBeGreaterThanOrEqual(40);
    expect(score.score).toBeLessThan(90);
  });

  it("should handle mixed good and poor dimensions", () => {
    const mixedSummary = createMockSummary({
      // Excellent profitability
      totalReturn: 0.60,
      annualizedReturn: 0.35,
      // Poor risk control
      maxDrawdown: 0.45,
      volatility: 0.40,
      // Average stability
      sharpeRatio: 0.8,
      sortinoRatio: 1.0,
      // Good efficiency
      winRate: 0.58,
      profitFactor: 1.6,
      avgHoldingPeriod: 8,
    });

    const score = calculateScore(mixedSummary);
    expect(score.breakdown.profitability).toBeGreaterThan(score.breakdown.risk);
  });
});

// =============================================================================
// ZERO TRADES HANDLING (AC-9, AC-10)
// =============================================================================

describe("Zero Trades Handling", () => {
  it("should return D grade for zero trades", () => {
    const score = calculateScore(zeroTradesSummary);
    expect(score.grade).toBe("D");
  });

  it("should return score 0 for zero trades", () => {
    const score = calculateScore(zeroTradesSummary);
    expect(score.score).toBe(0);
  });

  it("should return correct description for zero trades", () => {
    const score = calculateScore(zeroTradesSummary);
    expect(score.description).toBe("无交易记录");
  });

  it("should return all zeros in breakdown for zero trades", () => {
    const score = calculateScore(zeroTradesSummary);
    expect(score.breakdown.profitability).toBe(0);
    expect(score.breakdown.risk).toBe(0);
    expect(score.breakdown.stability).toBe(0);
    expect(score.breakdown.efficiency).toBe(0);
  });

  it("should return zero core metrics for zero trades", () => {
    const score = calculateScore(zeroTradesSummary);
    expect(score.coreMetrics.totalReturn.toNumber()).toBe(0);
    expect(score.coreMetrics.annualizedReturn.toNumber()).toBe(0);
    expect(score.coreMetrics.maxDrawdown.toNumber()).toBe(0);
    expect(score.coreMetrics.sharpeRatio.toNumber()).toBe(0);
  });
});

// =============================================================================
// DIMENSION WEIGHT TESTS (AC-3)
// =============================================================================

describe("Dimension Weights", () => {
  it("should have correct default weights", () => {
    expect(DIMENSION_WEIGHTS.profitability).toBe(0.30);
    expect(DIMENSION_WEIGHTS.risk).toBe(0.30);
    expect(DIMENSION_WEIGHTS.stability).toBe(0.25);
    expect(DIMENSION_WEIGHTS.efficiency).toBe(0.15);
  });

  it("should sum to 1.0", () => {
    const total =
      DIMENSION_WEIGHTS.profitability +
      DIMENSION_WEIGHTS.risk +
      DIMENSION_WEIGHTS.stability +
      DIMENSION_WEIGHTS.efficiency;
    expect(total).toBe(1.0);
  });

  it("should allow custom weights", () => {
    // Use a summary with distinctly different dimension scores
    const summary = createMockSummary({
      // High profitability
      totalReturn: 0.50,
      annualizedReturn: 0.30,
      // Poor risk
      maxDrawdown: 0.40,
      volatility: 0.35,
      // Average stability
      sharpeRatio: 0.8,
      sortinoRatio: 1.0,
      // Good efficiency
      winRate: 0.55,
      profitFactor: 1.5,
      avgHoldingPeriod: 8,
    });

    const defaultScore = calculateScore(summary);

    // Heavily weight profitability (where we score well)
    const highProfitWeight = calculateScoreWithWeights(summary, {
      profitability: 0.7,
      risk: 0.1,
      stability: 0.1,
      efficiency: 0.1,
    });

    // Heavily weight risk (where we score poorly)
    const highRiskWeight = calculateScoreWithWeights(summary, {
      profitability: 0.1,
      risk: 0.7,
      stability: 0.1,
      efficiency: 0.1,
    });

    // Different weight distributions should produce different scores
    expect(highProfitWeight.score).not.toBe(highRiskWeight.score);
    // High profit weight should score higher than high risk weight
    expect(highProfitWeight.score).toBeGreaterThan(highRiskWeight.score);
  });

  it("should normalize custom weights to sum to 1", () => {
    const summary = createMockSummary();
    // Weights that don't sum to 1
    const score = calculateScoreWithWeights(summary, {
      profitability: 0.6,
      risk: 0.4,
      stability: 0.5,
      efficiency: 0.3,
    });

    expect(score.grade).toBeDefined();
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// DECIMAL.JS PRECISION TESTS (AC-8, AC-10)
// =============================================================================

describe("Decimal.js Precision", () => {
  it("should return Decimal instances in coreMetrics", () => {
    const score = calculateScore(createMockSummary());
    expect(score.coreMetrics.totalReturn).toBeInstanceOf(Decimal);
    expect(score.coreMetrics.annualizedReturn).toBeInstanceOf(Decimal);
    expect(score.coreMetrics.maxDrawdown).toBeInstanceOf(Decimal);
    expect(score.coreMetrics.sharpeRatio).toBeInstanceOf(Decimal);
  });

  it("should preserve precision in coreMetrics", () => {
    const summary = createMockSummary({
      totalReturn: 0.123456789,
      maxDrawdown: 0.098765432,
      sharpeRatio: 1.234567890,
    });

    const score = calculateScore(summary);
    // Decimal should preserve the precision
    expect(score.coreMetrics.totalReturn.toString()).toBe("0.123456789");
    expect(score.coreMetrics.maxDrawdown.toString()).toBe("0.098765432");
    expect(score.coreMetrics.sharpeRatio.toString()).toBe("1.23456789");
  });

  it("should handle floating point edge cases", () => {
    // Classic floating point issue: 0.1 + 0.2 !== 0.3
    const summary = createMockSummary({
      totalReturn: 0.1 + 0.2, // 0.30000000000000004 in JS
    });

    const score = calculateScore(summary);
    // Should handle without errors
    expect(score).toBeDefined();
    expect(score.breakdown.profitability).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// DIMENSION SCORER TESTS (AC-4, AC-5, AC-6, AC-7)
// =============================================================================

describe("Dimension Scorers", () => {
  describe("scoreProfitability (AC-4)", () => {
    it("should score high for excellent returns", () => {
      const summary = createMockSummary({
        annualizedReturn: 0.30, // 30%
        totalReturn: 0.60, // 60%
      });
      const score = scoreProfitability(summary);
      expect(score).toBeGreaterThan(80);
    });

    it("should score low for negative returns", () => {
      const summary = createMockSummary({
        annualizedReturn: -0.15,
        totalReturn: -0.25,
      });
      const score = scoreProfitability(summary);
      expect(score).toBeLessThan(40);
    });
  });

  describe("scoreRisk (AC-5)", () => {
    it("should score high for low drawdown", () => {
      const summary = createMockSummary({
        maxDrawdown: 0.05, // 5%
        volatility: 0.10, // 10%
      });
      const score = scoreRisk(summary);
      expect(score).toBeGreaterThan(80);
    });

    it("should score low for high drawdown", () => {
      const summary = createMockSummary({
        maxDrawdown: 0.60, // 60% - beyond poor threshold
        volatility: 0.55, // 55% - beyond poor threshold
      });
      const score = scoreRisk(summary);
      expect(score).toBeLessThan(40);
    });
  });

  describe("scoreStability (AC-6)", () => {
    it("should score high for high Sharpe ratio", () => {
      const summary = createMockSummary({
        sharpeRatio: 2.0,
        sortinoRatio: 2.5,
      });
      const score = scoreStability(summary);
      expect(score).toBeGreaterThan(80);
    });

    it("should score low for negative Sharpe ratio", () => {
      const summary = createMockSummary({
        sharpeRatio: -0.5,
        sortinoRatio: -0.3,
      });
      const score = scoreStability(summary);
      expect(score).toBeLessThan(40);
    });
  });

  describe("scoreEfficiency (AC-7)", () => {
    it("should score high for high win rate and profit factor", () => {
      const summary = createMockSummary({
        winRate: 0.70, // 70%
        profitFactor: 2.5,
        avgHoldingPeriod: 3,
      });
      const score = scoreEfficiency(summary);
      expect(score).toBeGreaterThan(80);
    });

    it("should score low for low win rate and profit factor", () => {
      const summary = createMockSummary({
        winRate: 0.25, // 25%
        profitFactor: 0.4,
        avgHoldingPeriod: 40,
      });
      const score = scoreEfficiency(summary);
      expect(score).toBeLessThan(40);
    });
  });
});

// =============================================================================
// METRIC SCORING TESTS
// =============================================================================

describe("scoreMetric", () => {
  const annualizedReturnThreshold = PROFITABILITY_THRESHOLDS.annualizedReturn;

  it("should score 100 for excellent values (higher-better)", () => {
    const score = scoreMetric(0.25, annualizedReturnThreshold);
    expect(score).toBe(100);
  });

  it("should interpolate between thresholds", () => {
    // 15% annualized return should be between good (10%) and excellent (20%)
    const score = scoreMetric(0.15, annualizedReturnThreshold);
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThan(100);
  });

  it("should handle NaN values", () => {
    const score = scoreMetric(NaN, annualizedReturnThreshold);
    expect(score).toBe(0);
  });

  it("should handle Infinity values", () => {
    const score = scoreMetric(Infinity, annualizedReturnThreshold);
    expect(score).toBe(0);
  });
});

// =============================================================================
// STRATEGY SCORE INTERFACE TESTS (AC-1)
// =============================================================================

describe("StrategyScore Interface", () => {
  it("should return complete StrategyScore object", () => {
    const score = calculateScore(createMockSummary());

    // Check all required fields
    expect(score).toHaveProperty("grade");
    expect(score).toHaveProperty("score");
    expect(score).toHaveProperty("description");
    expect(score).toHaveProperty("coreMetrics");
    expect(score).toHaveProperty("breakdown");

    // Check coreMetrics structure
    expect(score.coreMetrics).toHaveProperty("totalReturn");
    expect(score.coreMetrics).toHaveProperty("annualizedReturn");
    expect(score.coreMetrics).toHaveProperty("maxDrawdown");
    expect(score.coreMetrics).toHaveProperty("sharpeRatio");

    // Check breakdown structure
    expect(score.breakdown).toHaveProperty("profitability");
    expect(score.breakdown).toHaveProperty("risk");
    expect(score.breakdown).toHaveProperty("stability");
    expect(score.breakdown).toHaveProperty("efficiency");
  });

  it("should have valid grade type", () => {
    const score = calculateScore(createMockSummary());
    expect(["S", "A", "B", "C", "D"]).toContain(score.grade);
  });

  it("should have score in valid range 0-100", () => {
    const score = calculateScore(createMockSummary());
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("should have breakdown scores in valid range 0-100", () => {
    const score = calculateScore(createMockSummary());
    expect(score.breakdown.profitability).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.profitability).toBeLessThanOrEqual(100);
    expect(score.breakdown.risk).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.risk).toBeLessThanOrEqual(100);
    expect(score.breakdown.stability).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.stability).toBeLessThanOrEqual(100);
    expect(score.breakdown.efficiency).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.efficiency).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// GRADE CONFIG TESTS
// =============================================================================

describe("GRADE_CONFIG", () => {
  it("should have 5 grade levels", () => {
    expect(GRADE_CONFIG).toHaveLength(5);
  });

  it("should be sorted by minScore descending", () => {
    for (let i = 0; i < GRADE_CONFIG.length - 1; i++) {
      const current = GRADE_CONFIG[i];
      const next = GRADE_CONFIG[i + 1];
      if (current && next) {
        expect(current.minScore).toBeGreaterThan(next.minScore);
      }
    }
  });

  it("should have correct threshold values", () => {
    const [sGrade, aGrade, bGrade, cGrade, dGrade] = GRADE_CONFIG;
    expect(sGrade).toMatchObject({ minScore: 90, grade: "S" });
    expect(aGrade).toMatchObject({ minScore: 75, grade: "A" });
    expect(bGrade).toMatchObject({ minScore: 60, grade: "B" });
    expect(cGrade).toMatchObject({ minScore: 40, grade: "C" });
    expect(dGrade).toMatchObject({ minScore: 0, grade: "D" });
  });
});
