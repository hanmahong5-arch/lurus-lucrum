/**
 * Strategy Score Module
 * 策略评分模块
 *
 * Provides strategy scoring functionality that converts 30+ backtest metrics
 * into an intuitive S/A/B/C/D grade system.
 *
 * @module lib/backtest/score
 *
 * @example
 * ```typescript
 * import { calculateScore } from '@/lib/backtest/score';
 *
 * const score = calculateScore(backtestResult.summary);
 * console.log(score.grade);       // "A"
 * console.log(score.score);       // 78
 * console.log(score.description); // "优秀"
 * console.log(score.breakdown);   // { profitability: 85, risk: 72, ... }
 * ```
 */

// =============================================================================
// TYPE EXPORTS / 类型导出
// =============================================================================

export type {
  ScoreGrade,
  MetricDirection,
  ScoreBreakdown,
  CoreMetrics,
  StrategyScore,
  GradeThreshold,
  MetricThreshold,
} from "./types";

// =============================================================================
// CONSTANT EXPORTS / 常量导出
// =============================================================================

export {
  GRADE_CONFIG,
  DIMENSION_WEIGHTS,
  PROFITABILITY_THRESHOLDS,
  RISK_THRESHOLDS,
  STABILITY_THRESHOLDS,
  EFFICIENCY_THRESHOLDS,
} from "./types";

// =============================================================================
// FUNCTION EXPORTS / 函数导出
// =============================================================================

// Main calculator
export {
  calculateScore,
  calculateScoreWithWeights,
  getGradeFromScore,
  getGradeDescription,
} from "./score-calculator";

// Dimension scorers (for advanced usage)
export {
  scoreProfitability,
  scoreRisk,
  scoreStability,
  scoreEfficiency,
  scoreMetric,
  dimensionScorers,
} from "./dimension-scorers";
