/**
 * Smart Question Generator
 *
 * Generates context-aware recommended questions based on backtest
 * score breakdown and key metrics. Pure functions, no side effects.
 *
 * @module lib/advisor/question-generator
 */

import type { ScoreBreakdown } from "@/lib/backtest/score/types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context data used to generate smart questions.
 * Populated from backtest results and score breakdown.
 */
export interface QuestionContext {
  scoreBreakdown: ScoreBreakdown;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  maxDrawdownDuration: number;
  profitFactor: number;
}

/**
 * A generated question with metadata
 */
export interface GeneratedQuestion {
  /** Unique identifier */
  id: string;
  /** Question text in Chinese */
  text: string;
  /** Category of question */
  category: QuestionCategoryValue;
}

type QuestionCategoryValue = "metric" | "optimization" | "applicability";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Question category enum-like object */
export const QUESTION_CATEGORY = {
  METRIC: "metric" as QuestionCategoryValue,
  OPTIMIZATION: "optimization" as QuestionCategoryValue,
  APPLICABILITY: "applicability" as QuestionCategoryValue,
} as const;

/** Human-readable labels for score dimensions */
export const DIMENSION_LABELS: Record<keyof ScoreBreakdown, string> = {
  profitability: "收益能力",
  risk: "风险控制",
  stability: "稳定性",
  efficiency: "交易效率",
};

// Dimension-to-Chinese mapping for optimization question context
const DIMENSION_OPTIMIZATION_TOPICS: Record<keyof ScoreBreakdown, string[]> = {
  profitability: ["收益率", "盈利能力", "入场时机"],
  risk: ["回撤控制", "止损策略", "风险管理"],
  stability: ["收益稳定性", "夏普比率", "波动控制"],
  efficiency: ["胜率", "交易频率", "持仓周期"],
};

// Thresholds for identifying significant metrics
const METRIC_SIGNIFICANCE = {
  HIGH_DRAWDOWN: 0.25,
  LOW_WIN_RATE: 0.35,
  HIGH_RETURN: 0.50,
  NEGATIVE_RETURN: 0,
  LOW_SHARPE: 0.5,
  HIGH_SHARPE: 2.0,
  HIGH_PROFIT_FACTOR: 2.5,
  LONG_DRAWDOWN_DAYS: 60,
} as const;

// =============================================================================
// CORE LOGIC
// =============================================================================

/**
 * Find the weakest dimension in the score breakdown.
 * Returns the dimension key with the lowest score.
 *
 * @param breakdown - Score breakdown by dimension
 * @returns Key of the weakest dimension
 */
export function findWeakestDimension(
  breakdown: ScoreBreakdown
): keyof ScoreBreakdown {
  const entries = Object.entries(breakdown) as [keyof ScoreBreakdown, number][];
  let weakest = entries[0]!;
  for (const entry of entries) {
    if (entry[1] < weakest[1]) {
      weakest = entry;
    }
  }
  return weakest[0];
}

/**
 * Find the most significant metric from the context.
 * Returns the metric key and a significance descriptor.
 *
 * Priority: negative outliers first (problems to fix),
 * then positive outliers (strengths to understand).
 *
 * @param ctx - Question generation context
 * @returns Most significant metric info
 */
export function findMostSignificantMetric(ctx: QuestionContext): {
  key: string;
  direction: "positive" | "negative";
  value: number;
} {
  // Check negative outliers first (problems)
  if (ctx.maxDrawdown > METRIC_SIGNIFICANCE.HIGH_DRAWDOWN) {
    return { key: "maxDrawdown", direction: "negative", value: ctx.maxDrawdown };
  }
  if (ctx.winRate < METRIC_SIGNIFICANCE.LOW_WIN_RATE && ctx.totalTrades > 0) {
    return { key: "winRate", direction: "negative", value: ctx.winRate };
  }
  if (ctx.totalReturn < METRIC_SIGNIFICANCE.NEGATIVE_RETURN) {
    return { key: "totalReturn", direction: "negative", value: ctx.totalReturn };
  }
  if (ctx.sharpeRatio < METRIC_SIGNIFICANCE.LOW_SHARPE) {
    return { key: "sharpeRatio", direction: "negative", value: ctx.sharpeRatio };
  }
  if (ctx.maxDrawdownDuration > METRIC_SIGNIFICANCE.LONG_DRAWDOWN_DAYS) {
    return {
      key: "maxDrawdownDuration",
      direction: "negative",
      value: ctx.maxDrawdownDuration,
    };
  }

  // Check positive outliers (strengths)
  if (ctx.totalReturn > METRIC_SIGNIFICANCE.HIGH_RETURN) {
    return { key: "totalReturn", direction: "positive", value: ctx.totalReturn };
  }
  if (ctx.sharpeRatio > METRIC_SIGNIFICANCE.HIGH_SHARPE) {
    return { key: "sharpeRatio", direction: "positive", value: ctx.sharpeRatio };
  }
  if (ctx.profitFactor > METRIC_SIGNIFICANCE.HIGH_PROFIT_FACTOR) {
    return {
      key: "profitFactor",
      direction: "positive",
      value: ctx.profitFactor,
    };
  }

  // Default: total return is always relevant
  return {
    key: "totalReturn",
    direction: ctx.totalReturn >= 0 ? "positive" : "negative",
    value: ctx.totalReturn,
  };
}

// =============================================================================
// QUESTION GENERATION
// =============================================================================

/**
 * Format a number as percentage string for display in questions
 */
function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Generate the metric-focused question (Question 1)
 * Based on the most significant metric from the backtest
 */
function generateMetricQuestion(ctx: QuestionContext): GeneratedQuestion {
  const metric = findMostSignificantMetric(ctx);

  let text: string;
  switch (metric.key) {
    case "maxDrawdown":
      text = `最大回撤达到 ${formatPct(ctx.maxDrawdown)}，主要发生在什么时段？可能的原因是什么？`;
      break;
    case "winRate":
      text = `胜率只有 ${formatPct(ctx.winRate)}，是信号质量问题还是止盈止损设置不合理？`;
      break;
    case "totalReturn":
      if (metric.direction === "negative") {
        text = `策略总收益为 ${formatPct(ctx.totalReturn)}，亏损的主要原因是什么？`;
      } else {
        text = `策略总收益达到 ${formatPct(ctx.totalReturn)}，这个收益水平是否可持续？`;
      }
      break;
    case "sharpeRatio":
      if (metric.direction === "negative") {
        text = `夏普比率仅为 ${ctx.sharpeRatio.toFixed(2)}，如何提高风险调整后收益？`;
      } else {
        text = `夏普比率高达 ${ctx.sharpeRatio.toFixed(2)}，这是否存在过拟合风险？`;
      }
      break;
    case "maxDrawdownDuration":
      text = `最大回撤持续了 ${ctx.maxDrawdownDuration} 个交易日，如何缩短回撤恢复周期？`;
      break;
    case "profitFactor":
      text = `盈亏比达到 ${ctx.profitFactor.toFixed(2)}，策略的核心优势在哪里？`;
      break;
    default:
      text = `策略年化收益 ${formatPct(ctx.annualizedReturn)}，这个表现如何评价？`;
  }

  return {
    id: "sq-metric",
    text,
    category: QUESTION_CATEGORY.METRIC,
  };
}

/**
 * Generate the optimization question (Question 2)
 * Based on the weakest dimension in the score breakdown
 */
function generateOptimizationQuestion(
  ctx: QuestionContext
): GeneratedQuestion {
  const weakest = findWeakestDimension(ctx.scoreBreakdown);
  const topics = DIMENSION_OPTIMIZATION_TOPICS[weakest];
  const dimensionLabel = DIMENSION_LABELS[weakest];

  let text: string;
  switch (weakest) {
    case "profitability":
      text = `${dimensionLabel}评分较低，如何优化${topics.join("和")}来提升收益？`;
      break;
    case "risk":
      text = `${dimensionLabel}评分较低，如何优化${topics.join("和")}来降低回撤风险？`;
      break;
    case "stability":
      text = `${dimensionLabel}评分较低，如何改善${topics.join("和")}让收益更稳定？`;
      break;
    case "efficiency":
      text = `${dimensionLabel}评分较低，如何提高${topics.join("和")}来改善交易效率？`;
      break;
    default:
      text = `策略的${dimensionLabel}需要改善，有什么优化建议？`;
  }

  return {
    id: "sq-optimization",
    text,
    category: QUESTION_CATEGORY.OPTIMIZATION,
  };
}

/**
 * Generate the applicability question (Question 3)
 * Based on strategy characteristics and market context
 */
function generateApplicabilityQuestion(
  ctx: QuestionContext
): GeneratedQuestion {
  let text: string;

  if (ctx.totalTrades === 0) {
    text = "策略没有产生任何交易信号，是参数设置过于严格还是策略逻辑有问题？";
  } else if (ctx.maxDrawdown > 0.3) {
    text = "这个策略在极端行情（如暴跌或熔断）下表现如何？是否需要增加风控机制？";
  } else if (ctx.winRate > 0.6 && ctx.profitFactor > 2.0) {
    text = "策略表现优异，但在不同市场环境（牛市、熊市、震荡市）下是否都适用？";
  } else if (ctx.totalReturn < 0) {
    text = "策略当前处于亏损状态，是市场环境不匹配还是策略本身有缺陷？应该修改策略还是等待市场转向？";
  } else if (ctx.sharpeRatio > 1.5) {
    text = "策略的风险调整收益很好，是否适合增加仓位？在不同板块之间迁移效果如何？";
  } else {
    text = "这个策略更适合哪种市场环境？在震荡市和单边市中表现有什么差异？";
  }

  return {
    id: "sq-applicability",
    text,
    category: QUESTION_CATEGORY.APPLICABILITY,
  };
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Generate 3 smart questions based on backtest context.
 *
 * Returns an empty array if context is null/undefined (no backtest data).
 * Each question addresses a different aspect:
 * 1. Most prominent metric (strength or weakness)
 * 2. Parameter optimization for the weakest dimension
 * 3. Strategy applicability and market environment
 *
 * @param context - Backtest context data, or null/undefined
 * @returns Array of 3 generated questions, or empty array
 */
export function generateSmartQuestions(
  context: QuestionContext | null | undefined
): GeneratedQuestion[] {
  if (!context) {
    return [];
  }

  return [
    generateMetricQuestion(context),
    generateOptimizationQuestion(context),
    generateApplicabilityQuestion(context),
  ];
}
