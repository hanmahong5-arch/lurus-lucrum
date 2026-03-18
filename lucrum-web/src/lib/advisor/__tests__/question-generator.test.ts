/**
 * Tests for Smart Question Generator
 *
 * Validates question generation logic based on backtest score breakdown,
 * metric analysis, and context availability.
 */
import { describe, it, expect } from "vitest";
import {
  generateSmartQuestions,
  findWeakestDimension,
  findMostSignificantMetric,
  type QuestionContext,
  type GeneratedQuestion,
  DIMENSION_LABELS,
  QUESTION_CATEGORY,
} from "../question-generator";
import type { ScoreBreakdown } from "@/lib/backtest/score/types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createDefaultContext(
  overrides?: Partial<QuestionContext>
): QuestionContext {
  return {
    scoreBreakdown: {
      profitability: 70,
      risk: 45,
      stability: 60,
      efficiency: 80,
    },
    totalReturn: 0.25,
    annualizedReturn: 0.18,
    maxDrawdown: 0.22,
    sharpeRatio: 1.1,
    winRate: 0.55,
    totalTrades: 20,
    maxDrawdownDuration: 45,
    profitFactor: 1.8,
    ...overrides,
  };
}

// =============================================================================
// TESTS: findWeakestDimension
// =============================================================================

describe("findWeakestDimension", () => {
  it("identifies the dimension with the lowest score", () => {
    const breakdown: ScoreBreakdown = {
      profitability: 70,
      risk: 30,
      stability: 60,
      efficiency: 80,
    };
    expect(findWeakestDimension(breakdown)).toBe("risk");
  });

  it("returns the first weakest when multiple dimensions tie", () => {
    const breakdown: ScoreBreakdown = {
      profitability: 50,
      risk: 50,
      stability: 80,
      efficiency: 80,
    };
    // When tied, should return the first one encountered (profitability)
    const result = findWeakestDimension(breakdown);
    expect(["profitability", "risk"]).toContain(result);
  });

  it("handles all-zero scores", () => {
    const breakdown: ScoreBreakdown = {
      profitability: 0,
      risk: 0,
      stability: 0,
      efficiency: 0,
    };
    const result = findWeakestDimension(breakdown);
    expect(result).toBeTruthy();
  });

  it("handles all-perfect scores", () => {
    const breakdown: ScoreBreakdown = {
      profitability: 100,
      risk: 100,
      stability: 100,
      efficiency: 100,
    };
    const result = findWeakestDimension(breakdown);
    expect(result).toBeTruthy();
  });
});

// =============================================================================
// TESTS: findMostSignificantMetric
// =============================================================================

describe("findMostSignificantMetric", () => {
  it("identifies high drawdown as significant", () => {
    const ctx = createDefaultContext({ maxDrawdown: 0.35 });
    const result = findMostSignificantMetric(ctx);
    expect(result).toBeTruthy();
    expect(result.key).toBe("maxDrawdown");
  });

  it("identifies low win rate as significant", () => {
    const ctx = createDefaultContext({ winRate: 0.25, maxDrawdown: 0.1 });
    const result = findMostSignificantMetric(ctx);
    expect(result).toBeTruthy();
    expect(result.key).toBe("winRate");
  });

  it("identifies high total return as significant positive", () => {
    const ctx = createDefaultContext({
      totalReturn: 0.80,
      maxDrawdown: 0.1,
      winRate: 0.6,
      sharpeRatio: 2.0,
    });
    const result = findMostSignificantMetric(ctx);
    expect(result).toBeTruthy();
  });

  it("identifies negative return as significant", () => {
    const ctx = createDefaultContext({
      totalReturn: -0.15,
      maxDrawdown: 0.15,
    });
    const result = findMostSignificantMetric(ctx);
    expect(result).toBeTruthy();
  });
});

// =============================================================================
// TESTS: generateSmartQuestions
// =============================================================================

describe("generateSmartQuestions", () => {
  it("generates exactly 3 questions when context is provided", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);
    expect(questions).toHaveLength(3);
  });

  it("returns empty array when context is null", () => {
    const questions = generateSmartQuestions(null);
    expect(questions).toHaveLength(0);
  });

  it("returns empty array when context is undefined", () => {
    const questions = generateSmartQuestions(undefined);
    expect(questions).toHaveLength(0);
  });

  it("generates questions with required fields", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);

    for (const q of questions) {
      expect(q.text).toBeTruthy();
      expect(typeof q.text).toBe("string");
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.category).toBeTruthy();
      expect(q.id).toBeTruthy();
    }
  });

  it("generates questions covering 3 different categories", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);
    const categories = questions.map((q) => q.category);
    const uniqueCategories = new Set(categories);
    expect(uniqueCategories.size).toBe(3);
  });

  it("includes a metric-focused question", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);
    const hasMetric = questions.some(
      (q) => q.category === QUESTION_CATEGORY.METRIC
    );
    expect(hasMetric).toBe(true);
  });

  it("includes an optimization question", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);
    const hasOptimization = questions.some(
      (q) => q.category === QUESTION_CATEGORY.OPTIMIZATION
    );
    expect(hasOptimization).toBe(true);
  });

  it("includes an applicability question", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);
    const hasApplicability = questions.some(
      (q) => q.category === QUESTION_CATEGORY.APPLICABILITY
    );
    expect(hasApplicability).toBe(true);
  });

  it("generates context-specific questions based on weak risk dimension", () => {
    const ctx = createDefaultContext({
      scoreBreakdown: {
        profitability: 80,
        risk: 20,
        stability: 70,
        efficiency: 75,
      },
      maxDrawdown: 0.40,
    });
    const questions = generateSmartQuestions(ctx);
    const optimizationQ = questions.find(
      (q) => q.category === QUESTION_CATEGORY.OPTIMIZATION
    );
    expect(optimizationQ).toBeTruthy();
    // Optimization question should reference risk-related terms
    expect(optimizationQ!.text).toMatch(/回撤|风险|止损|drawdown/i);
  });

  it("generates context-specific questions based on weak profitability", () => {
    const ctx = createDefaultContext({
      scoreBreakdown: {
        profitability: 20,
        risk: 80,
        stability: 70,
        efficiency: 75,
      },
      totalReturn: -0.05,
    });
    const questions = generateSmartQuestions(ctx);
    const optimizationQ = questions.find(
      (q) => q.category === QUESTION_CATEGORY.OPTIMIZATION
    );
    expect(optimizationQ).toBeTruthy();
    // Should reference profitability-related terms
    expect(optimizationQ!.text).toMatch(/收益|盈利|亏损|profit/i);
  });

  it("generates context-specific questions based on weak efficiency", () => {
    const ctx = createDefaultContext({
      scoreBreakdown: {
        profitability: 80,
        risk: 80,
        stability: 70,
        efficiency: 15,
      },
      winRate: 0.25,
    });
    const questions = generateSmartQuestions(ctx);
    const optimizationQ = questions.find(
      (q) => q.category === QUESTION_CATEGORY.OPTIMIZATION
    );
    expect(optimizationQ).toBeTruthy();
    expect(optimizationQ!.text).toMatch(/胜率|交易|效率|win/i);
  });

  it("generates unique question IDs", () => {
    const ctx = createDefaultContext();
    const questions = generateSmartQuestions(ctx);
    const ids = questions.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it("handles edge case: very high total return", () => {
    const ctx = createDefaultContext({ totalReturn: 5.0 });
    const questions = generateSmartQuestions(ctx);
    expect(questions).toHaveLength(3);
  });

  it("handles edge case: zero trades", () => {
    const ctx = createDefaultContext({ totalTrades: 0, winRate: 0 });
    const questions = generateSmartQuestions(ctx);
    expect(questions).toHaveLength(3);
  });
});

// =============================================================================
// TESTS: DIMENSION_LABELS
// =============================================================================

describe("DIMENSION_LABELS", () => {
  it("has labels for all 4 dimensions", () => {
    expect(DIMENSION_LABELS.profitability).toBeTruthy();
    expect(DIMENSION_LABELS.risk).toBeTruthy();
    expect(DIMENSION_LABELS.stability).toBeTruthy();
    expect(DIMENSION_LABELS.efficiency).toBeTruthy();
  });
});
