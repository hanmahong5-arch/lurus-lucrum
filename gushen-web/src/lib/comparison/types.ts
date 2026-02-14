/**
 * Strategy Comparison Types
 *
 * Type definitions for the strategy comparison engine that compares
 * two backtest results across multiple metric dimensions.
 *
 * @module lib/comparison/types
 */

import type { StrategyScore } from "@/lib/backtest/score/types";

// =============================================================================
// METRIC DIFF TYPES / 指标差异类型
// =============================================================================

/**
 * Direction of metric difference relative to Strategy A
 * positive = Strategy A is better, negative = Strategy B is better
 */
export type DiffDirection = "better" | "worse" | "neutral";

/**
 * Which strategy wins for a given metric
 */
export type MetricWinner = "a" | "b" | "tie";

/**
 * Single metric difference result
 */
export interface MetricDiff {
  /** Metric identifier key */
  key: string;
  /** Chinese label for display */
  label: string;
  /** Strategy A value (as number for display) */
  valueA: number;
  /** Strategy B value (as number for display) */
  valueB: number;
  /** Absolute difference (A - B) */
  absoluteDiff: number;
  /** Percentage difference relative to B: ((A - B) / |B|) * 100, NaN-safe */
  percentDiff: number | null;
  /** Whether higher is better for this metric */
  higherIsBetter: boolean;
  /** Which strategy wins for this metric */
  winner: MetricWinner;
  /** Direction for Strategy A: better/worse/neutral */
  directionForA: DiffDirection;
}

// =============================================================================
// METRIC GROUP TYPES / 指标分组类型
// =============================================================================

/**
 * Metric group category
 */
export type MetricGroupKey = "return" | "risk" | "trading";

/**
 * Group of metrics for display
 */
export interface MetricGroup {
  /** Group key */
  key: MetricGroupKey;
  /** Chinese label */
  label: string;
  /** Metrics in this group */
  metrics: MetricDiff[];
  /** Group-level winner */
  winner: MetricWinner;
}

// =============================================================================
// COMPARISON RESULT / 对比结果
// =============================================================================

/**
 * Strategy info for comparison display
 */
export interface ComparisonStrategyInfo {
  /** Strategy name */
  name: string;
  /** Strategy score (if available) */
  score: StrategyScore | null;
  /** Equity curve data for chart overlay */
  equityCurve: Array<{ date: string; equity: number }>;
}

/**
 * Category winner breakdown
 */
export interface CategoryWinners {
  /** Winner by return metrics */
  byReturn: MetricWinner;
  /** Winner by risk metrics */
  byRisk: MetricWinner;
  /** Winner by trading efficiency */
  byTrading: MetricWinner;
  /** Overall winner (weighted) */
  overall: MetricWinner;
}

/**
 * Complete comparison result
 */
export interface ComparisonResult {
  /** Strategy A info */
  strategyA: ComparisonStrategyInfo;
  /** Strategy B info */
  strategyB: ComparisonStrategyInfo;
  /** Metric groups with diffs */
  metricGroups: MetricGroup[];
  /** All metric diffs (flat list) */
  allMetrics: MetricDiff[];
  /** Category winners */
  winners: CategoryWinners;
  /** Human-readable summary of key advantage */
  summaryText: string;
}

// =============================================================================
// METRIC DEFINITION / 指标定义
// =============================================================================

/**
 * Metric definition for comparison configuration
 */
export interface MetricDefinition {
  /** Unique key matching metric field name */
  key: string;
  /** Chinese label */
  label: string;
  /** Which group this metric belongs to */
  group: MetricGroupKey;
  /** Whether higher values are better */
  higherIsBetter: boolean;
  /** Threshold for "neutral" (absolute diff below this = tie) */
  neutralThreshold: number;
  /** Format type for display */
  format: "percent" | "ratio" | "count" | "days" | "currency";
}
