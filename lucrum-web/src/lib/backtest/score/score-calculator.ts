/**
 * Score Calculator
 * 策略评分计算器
 *
 * Converts 30+ backtest metrics into an intuitive S/A/B/C/D grade.
 * Uses Decimal.js for all financial calculations (ADR-006).
 *
 * @module lib/backtest/score/score-calculator
 */

import Decimal from "decimal.js";
import type { BacktestSummary } from "../types";
import type {
  StrategyScore,
  ScoreGrade,
  ScoreBreakdown,
  CoreMetrics,
  GradeThreshold,
} from "./types";
import { GRADE_CONFIG, DIMENSION_WEIGHTS } from "./types";
import {
  scoreProfitability,
  scoreRisk,
  scoreStability,
  scoreEfficiency,
} from "./dimension-scorers";

// =============================================================================
// GRADE DETERMINATION / 等级判定
// =============================================================================

/**
 * Determine grade from numeric score
 * 从数值评分确定等级
 *
 * @param score - Numeric score 0-100 (数值评分)
 * @returns Grade configuration (等级配置)
 */
function determineGrade(score: number): GradeThreshold {
  // GRADE_CONFIG is sorted descending by minScore
  for (const threshold of GRADE_CONFIG) {
    if (score >= threshold.minScore) {
      return threshold;
    }
  }
  // Fallback to D grade (always exists as GRADE_CONFIG has 5 elements)
  return GRADE_CONFIG[GRADE_CONFIG.length - 1]!;
}

/**
 * Calculate weighted total score from breakdown
 * 从分解计算加权总分
 *
 * @param breakdown - Score breakdown by dimension (各维度得分)
 * @returns Total weighted score 0-100 (加权总分)
 */
function calculateTotalScore(breakdown: ScoreBreakdown): number {
  const total = new Decimal(breakdown.profitability)
    .times(DIMENSION_WEIGHTS.profitability)
    .plus(new Decimal(breakdown.risk).times(DIMENSION_WEIGHTS.risk))
    .plus(new Decimal(breakdown.stability).times(DIMENSION_WEIGHTS.stability))
    .plus(new Decimal(breakdown.efficiency).times(DIMENSION_WEIGHTS.efficiency));

  // Round to integer for final score
  return total.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Extract core metrics for display
 * 提取核心指标用于展示
 *
 * @param summary - Backtest summary (回测摘要)
 * @returns Core metrics (核心指标)
 */
function extractCoreMetrics(summary: BacktestSummary): CoreMetrics {
  return {
    totalReturn: new Decimal(summary.totalReturn),
    annualizedReturn: new Decimal(summary.annualizedReturn),
    maxDrawdown: new Decimal(summary.maxDrawdown),
    sharpeRatio: new Decimal(summary.sharpeRatio),
  };
}

// =============================================================================
// ZERO TRADES HANDLING / 零交易处理
// =============================================================================

/**
 * Create score for zero trades case
 * 创建零交易情况的评分
 *
 * @returns Strategy score for zero trades (零交易策略评分)
 */
function createZeroTradesScore(): StrategyScore {
  return {
    grade: "D",
    score: 0,
    description: "无交易记录",
    coreMetrics: {
      totalReturn: new Decimal(0),
      annualizedReturn: new Decimal(0),
      maxDrawdown: new Decimal(0),
      sharpeRatio: new Decimal(0),
    },
    breakdown: {
      profitability: 0,
      risk: 0,
      stability: 0,
      efficiency: 0,
    },
  };
}

/**
 * Check if backtest has zero trades
 * 检查回测是否零交易
 *
 * @param summary - Backtest summary (回测摘要)
 * @returns True if zero trades (是否零交易)
 */
function hasZeroTrades(summary: BacktestSummary): boolean {
  return summary.totalTrades === 0;
}

// =============================================================================
// MAIN CALCULATOR / 主计算器
// =============================================================================

/**
 * Calculate strategy score from backtest summary
 * 从回测摘要计算策略评分
 *
 * Converts 30+ metrics into an intuitive S/A/B/C/D grade using:
 * - Profitability (30%): annualized return, total return
 * - Risk Control (30%): max drawdown, volatility
 * - Stability (25%): Sharpe ratio, Sortino ratio
 * - Efficiency (15%): win rate, profit factor, holding period
 *
 * @param summary - Backtest summary with metrics (包含指标的回测摘要)
 * @returns Complete strategy score (完整策略评分)
 *
 * @example
 * ```typescript
 * const score = calculateScore(backtestResult.summary);
 * console.log(score.grade); // "A"
 * console.log(score.score); // 78
 * console.log(score.description); // "优秀"
 * ```
 */
export function calculateScore(summary: BacktestSummary): StrategyScore {
  // Handle zero trades special case
  if (hasZeroTrades(summary)) {
    return createZeroTradesScore();
  }

  // Calculate dimension scores
  const breakdown: ScoreBreakdown = {
    profitability: scoreProfitability(summary),
    risk: scoreRisk(summary),
    stability: scoreStability(summary),
    efficiency: scoreEfficiency(summary),
  };

  // Calculate weighted total score
  const totalScore = calculateTotalScore(breakdown);

  // Determine grade from score
  const gradeConfig = determineGrade(totalScore);

  // Extract core metrics
  const coreMetrics = extractCoreMetrics(summary);

  return {
    grade: gradeConfig.grade,
    score: totalScore,
    description: gradeConfig.description,
    coreMetrics,
    breakdown,
  };
}

/**
 * Calculate score with custom weights
 * 使用自定义权重计算评分
 *
 * Allows overriding default dimension weights for specialized use cases.
 *
 * @param summary - Backtest summary (回测摘要)
 * @param weights - Custom dimension weights (自定义权重)
 * @returns Strategy score (策略评分)
 */
export function calculateScoreWithWeights(
  summary: BacktestSummary,
  weights: {
    profitability?: number;
    risk?: number;
    stability?: number;
    efficiency?: number;
  }
): StrategyScore {
  // Handle zero trades special case
  if (hasZeroTrades(summary)) {
    return createZeroTradesScore();
  }

  // Merge with default weights
  const effectiveWeights = {
    profitability: weights.profitability ?? DIMENSION_WEIGHTS.profitability,
    risk: weights.risk ?? DIMENSION_WEIGHTS.risk,
    stability: weights.stability ?? DIMENSION_WEIGHTS.stability,
    efficiency: weights.efficiency ?? DIMENSION_WEIGHTS.efficiency,
  };

  // Normalize weights to sum to 1
  const totalWeight =
    effectiveWeights.profitability +
    effectiveWeights.risk +
    effectiveWeights.stability +
    effectiveWeights.efficiency;

  // Guard against zero total weight
  if (totalWeight === 0) {
    return createZeroTradesScore();
  }

  const normalizedWeights = {
    profitability: effectiveWeights.profitability / totalWeight,
    risk: effectiveWeights.risk / totalWeight,
    stability: effectiveWeights.stability / totalWeight,
    efficiency: effectiveWeights.efficiency / totalWeight,
  };

  // Calculate dimension scores
  const breakdown: ScoreBreakdown = {
    profitability: scoreProfitability(summary),
    risk: scoreRisk(summary),
    stability: scoreStability(summary),
    efficiency: scoreEfficiency(summary),
  };

  // Calculate weighted total with custom weights
  const total = new Decimal(breakdown.profitability)
    .times(normalizedWeights.profitability)
    .plus(new Decimal(breakdown.risk).times(normalizedWeights.risk))
    .plus(new Decimal(breakdown.stability).times(normalizedWeights.stability))
    .plus(new Decimal(breakdown.efficiency).times(normalizedWeights.efficiency));

  const totalScore = total.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

  // Determine grade
  const gradeConfig = determineGrade(totalScore);

  // Extract core metrics
  const coreMetrics = extractCoreMetrics(summary);

  return {
    grade: gradeConfig.grade,
    score: totalScore,
    description: gradeConfig.description,
    coreMetrics,
    breakdown,
  };
}

/**
 * Get grade from score
 * 从分数获取等级
 *
 * Utility function to convert numeric score to grade without full calculation.
 *
 * @param score - Numeric score 0-100 (数值评分)
 * @returns Grade S/A/B/C/D (等级)
 */
export function getGradeFromScore(score: number): ScoreGrade {
  return determineGrade(score).grade;
}

/**
 * Get grade description
 * 获取等级描述
 *
 * @param grade - Score grade (评分等级)
 * @param language - Language for description (描述语言)
 * @returns Description string (描述字符串)
 */
export function getGradeDescription(
  grade: ScoreGrade,
  language: "zh" | "en" = "zh"
): string {
  const config = GRADE_CONFIG.find((g) => g.grade === grade);
  if (!config) return "";
  return language === "zh" ? config.description : config.descriptionEn;
}

// =============================================================================
// EXPORTS / 导出
// =============================================================================

export { calculateTotalScore, determineGrade, extractCoreMetrics };
