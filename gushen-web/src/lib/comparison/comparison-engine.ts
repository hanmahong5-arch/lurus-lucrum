/**
 * Comparison Engine
 *
 * Orchestrates the comparison of two strategy backtest results.
 * Pure function with no side effects — suitable for both server and client.
 *
 * @module lib/comparison/comparison-engine
 */

import type { UnifiedBacktestResult } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import type {
  ComparisonResult,
  ComparisonStrategyInfo,
  MetricGroup,
  MetricGroupKey,
  MetricDiff,
} from "./types";
import { calculateMetricDiff, COMPARISON_METRICS } from "./metric-diff";
import { resolveGroupWinner, resolveCategoryWinners, generateSummaryText } from "./winner-resolver";

// =============================================================================
// METRIC EXTRACTION / 指标提取
// =============================================================================

/** Group labels in Chinese */
const GROUP_LABELS: Record<MetricGroupKey, string> = {
  return: "收益指标",
  risk: "风险指标",
  trading: "交易指标",
};

/**
 * Extract a flat metric map from UnifiedBacktestResult
 * Safely handles missing or undefined values by defaulting to 0.
 *
 * @param result - Backtest result
 * @returns Key-value map of metric values
 */
function extractMetricValues(result: UnifiedBacktestResult): Record<string, number> {
  const r = result.returnMetrics;
  const k = result.riskMetrics;
  const t = result.tradingMetrics;

  return {
    totalReturn: r.totalReturn ?? 0,
    annualizedReturn: r.annualizedReturn ?? 0,
    returnVolatility: r.returnVolatility ?? 0,
    maxDrawdown: k.maxDrawdown ?? 0,
    sharpeRatio: k.sharpeRatio ?? 0,
    sortinoRatio: k.sortinoRatio ?? 0,
    calmarRatio: k.calmarRatio ?? 0,
    winRate: t.winRate ?? 0,
    profitFactor: t.profitFactor ?? 0,
    totalTrades: t.totalTrades ?? 0,
    avgHoldingDays: t.avgHoldingDays ?? 0,
    maxConsecutiveWins: t.maxConsecutiveWins ?? 0,
    maxConsecutiveLosses: t.maxConsecutiveLosses ?? 0,
  };
}

/**
 * Extract equity curve data for chart overlay
 *
 * @param result - Backtest result
 * @returns Array of date/equity points
 */
function extractEquityCurve(
  result: UnifiedBacktestResult
): Array<{ date: string; equity: number }> {
  if (!result.equityCurve || result.equityCurve.length === 0) {
    return [];
  }
  return result.equityCurve.map((point) => ({
    date: point.date,
    equity: point.equity,
  }));
}

/**
 * Build strategy info for comparison display
 *
 * @param result - Backtest result
 * @param score - Pre-computed strategy score (null if not available)
 * @returns Strategy info for comparison
 */
function buildStrategyInfo(
  result: UnifiedBacktestResult,
  score: StrategyScore | null
): ComparisonStrategyInfo {
  return {
    name: result.strategy.name || "Unknown Strategy",
    score,
    equityCurve: extractEquityCurve(result),
  };
}

// =============================================================================
// MAIN COMPARISON / 主对比函数
// =============================================================================

/**
 * Compare two strategy backtest results
 *
 * This is the main entry point for the comparison engine.
 * It takes two UnifiedBacktestResult objects and optional pre-computed scores,
 * and produces a comprehensive ComparisonResult.
 *
 * @param resultA - Strategy A backtest result
 * @param resultB - Strategy B backtest result
 * @param scoreA - Strategy A pre-computed score (optional)
 * @param scoreB - Strategy B pre-computed score (optional)
 * @returns Complete comparison result
 *
 * @example
 * ```typescript
 * import { compareStrategies } from '@/lib/comparison';
 * const result = compareStrategies(backtestA, backtestB, scoreA, scoreB);
 * console.log(result.winners.overall); // "a" or "b" or "tie"
 * ```
 */
export function compareStrategies(
  resultA: UnifiedBacktestResult,
  resultB: UnifiedBacktestResult,
  scoreA: StrategyScore | null = null,
  scoreB: StrategyScore | null = null
): ComparisonResult {
  // Extract metric values
  const valuesA = extractMetricValues(resultA);
  const valuesB = extractMetricValues(resultB);

  // Calculate diffs for all metrics
  const allMetrics: MetricDiff[] = [];
  for (const def of COMPARISON_METRICS) {
    const vA = valuesA[def.key] ?? 0;
    const vB = valuesB[def.key] ?? 0;
    allMetrics.push(calculateMetricDiff(def, vA, vB));
  }

  // Group metrics
  const groupKeys: MetricGroupKey[] = ["return", "risk", "trading"];
  const metricGroups: MetricGroup[] = groupKeys.map((key) => {
    const groupMetrics = allMetrics.filter(
      (m) => COMPARISON_METRICS.find((def) => def.key === m.key)?.group === key
    );
    return {
      key,
      label: GROUP_LABELS[key],
      metrics: groupMetrics,
      winner: resolveGroupWinner(groupMetrics),
    };
  });

  // Build strategy info
  const strategyA = buildStrategyInfo(resultA, scoreA);
  const strategyB = buildStrategyInfo(resultB, scoreB);

  // Resolve winners
  const winners = resolveCategoryWinners(metricGroups);

  // Generate summary
  const summaryText = generateSummaryText(strategyA, strategyB, winners, allMetrics);

  return {
    strategyA,
    strategyB,
    metricGroups,
    allMetrics,
    winners,
    summaryText,
  };
}
