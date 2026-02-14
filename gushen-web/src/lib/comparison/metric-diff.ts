/**
 * Metric Difference Calculator
 *
 * Computes per-metric differences between two strategies using Decimal.js
 * for financial-grade precision.
 *
 * @module lib/comparison/metric-diff
 */

import Decimal from "decimal.js";
import type {
  MetricDiff,
  MetricWinner,
  DiffDirection,
  MetricDefinition,
} from "./types";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/**
 * All metrics available for comparison, grouped by category.
 * Each metric defines its direction (higher-is-better vs lower-is-better)
 * and a neutral threshold to avoid false "winner" for negligible differences.
 */
export const COMPARISON_METRICS: readonly MetricDefinition[] = [
  // Return metrics
  {
    key: "totalReturn",
    label: "总收益率",
    group: "return",
    higherIsBetter: true,
    neutralThreshold: 0.001,
    format: "percent",
  },
  {
    key: "annualizedReturn",
    label: "年化收益率",
    group: "return",
    higherIsBetter: true,
    neutralThreshold: 0.001,
    format: "percent",
  },
  {
    key: "returnVolatility",
    label: "收益波动率",
    group: "return",
    higherIsBetter: false,
    neutralThreshold: 0.001,
    format: "percent",
  },

  // Risk metrics
  {
    key: "maxDrawdown",
    label: "最大回撤",
    group: "risk",
    higherIsBetter: false,
    neutralThreshold: 0.001,
    format: "percent",
  },
  {
    key: "sharpeRatio",
    label: "夏普比率",
    group: "risk",
    higherIsBetter: true,
    neutralThreshold: 0.01,
    format: "ratio",
  },
  {
    key: "sortinoRatio",
    label: "索提诺比率",
    group: "risk",
    higherIsBetter: true,
    neutralThreshold: 0.01,
    format: "ratio",
  },
  {
    key: "calmarRatio",
    label: "卡玛比率",
    group: "risk",
    higherIsBetter: true,
    neutralThreshold: 0.01,
    format: "ratio",
  },

  // Trading metrics
  {
    key: "winRate",
    label: "胜率",
    group: "trading",
    higherIsBetter: true,
    neutralThreshold: 0.001,
    format: "percent",
  },
  {
    key: "profitFactor",
    label: "盈亏比",
    group: "trading",
    higherIsBetter: true,
    neutralThreshold: 0.01,
    format: "ratio",
  },
  {
    key: "totalTrades",
    label: "总交易次数",
    group: "trading",
    higherIsBetter: false,
    neutralThreshold: 1,
    format: "count",
  },
  {
    key: "avgHoldingDays",
    label: "平均持仓天数",
    group: "trading",
    higherIsBetter: false,
    neutralThreshold: 0.5,
    format: "days",
  },
  {
    key: "maxConsecutiveWins",
    label: "最大连胜",
    group: "trading",
    higherIsBetter: true,
    neutralThreshold: 0,
    format: "count",
  },
  {
    key: "maxConsecutiveLosses",
    label: "最大连亏",
    group: "trading",
    higherIsBetter: false,
    neutralThreshold: 0,
    format: "count",
  },
] as const;

// =============================================================================
// DIFF CALCULATION / 差异计算
// =============================================================================

/**
 * Determine winner for a single metric
 *
 * @param diff - Absolute difference (A - B)
 * @param higherIsBetter - Whether higher values are better
 * @param neutralThreshold - Threshold below which diff is considered neutral
 * @returns Which strategy wins
 */
function determineWinner(
  diff: Decimal,
  higherIsBetter: boolean,
  neutralThreshold: number
): MetricWinner {
  const absDiff = diff.abs();
  if (absDiff.lessThanOrEqualTo(neutralThreshold)) {
    return "tie";
  }
  if (higherIsBetter) {
    return diff.greaterThan(0) ? "a" : "b";
  }
  // Lower is better: A having lower value means diff < 0 is better for A
  return diff.lessThan(0) ? "a" : "b";
}

/**
 * Determine display direction for Strategy A
 *
 * @param winner - Which strategy wins
 * @returns Direction for Strategy A display
 */
function determineDirection(winner: MetricWinner): DiffDirection {
  if (winner === "tie") return "neutral";
  return winner === "a" ? "better" : "worse";
}

/**
 * Calculate percentage difference safely
 * Returns null if base value is zero (avoid division by zero)
 *
 * @param diff - Absolute difference (A - B)
 * @param baseValue - Base value (B) for percentage calculation
 * @returns Percentage difference or null
 */
function calculatePercentDiff(
  diff: Decimal,
  baseValue: Decimal
): number | null {
  if (baseValue.isZero()) {
    return null;
  }
  return diff.dividedBy(baseValue.abs()).times(100).toDecimalPlaces(2).toNumber();
}

/**
 * Calculate difference for a single metric
 *
 * @param definition - Metric definition
 * @param valueA - Strategy A value
 * @param valueB - Strategy B value
 * @returns MetricDiff result
 */
export function calculateMetricDiff(
  definition: MetricDefinition,
  valueA: number,
  valueB: number
): MetricDiff {
  const decA = new Decimal(valueA);
  const decB = new Decimal(valueB);
  const diff = decA.minus(decB);

  const winner = determineWinner(
    diff,
    definition.higherIsBetter,
    definition.neutralThreshold
  );

  return {
    key: definition.key,
    label: definition.label,
    valueA: decA.toDecimalPlaces(6).toNumber(),
    valueB: decB.toDecimalPlaces(6).toNumber(),
    absoluteDiff: diff.toDecimalPlaces(6).toNumber(),
    percentDiff: calculatePercentDiff(diff, decB),
    higherIsBetter: definition.higherIsBetter,
    winner,
    directionForA: determineDirection(winner),
  };
}
