/**
 * Strategy Comparison Module
 *
 * Provides strategy comparison functionality that compares two backtest
 * results across return, risk, and trading efficiency dimensions.
 *
 * @module lib/comparison
 *
 * @example
 * ```typescript
 * import { compareStrategies } from '@/lib/comparison';
 *
 * const comparison = compareStrategies(resultA, resultB, scoreA, scoreB);
 * console.log(comparison.winners.overall); // "a" | "b" | "tie"
 * console.log(comparison.summaryText);     // "Strategy A wins: ..."
 * ```
 */

// =============================================================================
// TYPE EXPORTS / 类型导出
// =============================================================================

export type {
  DiffDirection,
  MetricWinner,
  MetricDiff,
  MetricGroupKey,
  MetricGroup,
  ComparisonStrategyInfo,
  CategoryWinners,
  ComparisonResult,
  MetricDefinition,
} from "./types";

// =============================================================================
// FUNCTION EXPORTS / 函数导出
// =============================================================================

export { compareStrategies } from "./comparison-engine";
export { calculateMetricDiff, COMPARISON_METRICS } from "./metric-diff";
export {
  resolveGroupWinner,
  resolveCategoryWinners,
  generateSummaryText,
} from "./winner-resolver";
