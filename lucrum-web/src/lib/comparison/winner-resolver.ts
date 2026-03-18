/**
 * Winner Resolver
 *
 * Determines category and overall winners from metric diffs.
 * Uses weighted scoring to determine which strategy is better overall.
 *
 * @module lib/comparison/winner-resolver
 */

import Decimal from "decimal.js";
import type {
  MetricDiff,
  MetricGroup,
  MetricWinner,
  CategoryWinners,
  ComparisonStrategyInfo,
} from "./types";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/** Category weights for overall winner determination */
const CATEGORY_WEIGHTS = {
  return: new Decimal(0.4),
  risk: new Decimal(0.35),
  trading: new Decimal(0.25),
} as const;

// =============================================================================
// GROUP WINNER / 分组胜者
// =============================================================================

/**
 * Determine winner for a group of metrics by counting wins
 *
 * @param metrics - Metrics in the group
 * @returns Group winner
 */
export function resolveGroupWinner(metrics: MetricDiff[]): MetricWinner {
  if (metrics.length === 0) return "tie";

  let aWins = 0;
  let bWins = 0;

  for (const metric of metrics) {
    if (metric.winner === "a") aWins++;
    else if (metric.winner === "b") bWins++;
  }

  if (aWins > bWins) return "a";
  if (bWins > aWins) return "b";
  return "tie";
}

// =============================================================================
// OVERALL WINNER / 总体胜者
// =============================================================================

/**
 * Resolve category winners and overall winner
 *
 * @param groups - Metric groups with their diffs
 * @returns Category winners breakdown
 */
export function resolveCategoryWinners(
  groups: MetricGroup[]
): CategoryWinners {
  const returnGroup = groups.find((g) => g.key === "return");
  const riskGroup = groups.find((g) => g.key === "risk");
  const tradingGroup = groups.find((g) => g.key === "trading");

  const byReturn = returnGroup?.winner ?? "tie";
  const byRisk = riskGroup?.winner ?? "tie";
  const byTrading = tradingGroup?.winner ?? "tie";

  // Weighted scoring: a win = +1, b win = -1, tie = 0
  const winnerScore = (winner: MetricWinner): number => {
    if (winner === "a") return 1;
    if (winner === "b") return -1;
    return 0;
  };

  const overallScore = CATEGORY_WEIGHTS.return
    .times(winnerScore(byReturn))
    .plus(CATEGORY_WEIGHTS.risk.times(winnerScore(byRisk)))
    .plus(CATEGORY_WEIGHTS.trading.times(winnerScore(byTrading)));

  let overall: MetricWinner;
  if (overallScore.greaterThan(0)) {
    overall = "a";
  } else if (overallScore.lessThan(0)) {
    overall = "b";
  } else {
    overall = "tie";
  }

  return { byReturn, byRisk, byTrading, overall };
}

// =============================================================================
// SUMMARY TEXT / 摘要文本
// =============================================================================

/**
 * Generate human-readable summary text for the comparison
 *
 * @param strategyA - Strategy A info
 * @param strategyB - Strategy B info
 * @param winners - Category winners
 * @param allMetrics - All metric diffs
 * @returns Summary text in Chinese
 */
export function generateSummaryText(
  strategyA: ComparisonStrategyInfo,
  strategyB: ComparisonStrategyInfo,
  winners: CategoryWinners,
  allMetrics: MetricDiff[]
): string {
  const nameA = strategyA.name;
  const nameB = strategyB.name;

  if (winners.overall === "tie") {
    return `${nameA} 和 ${nameB} 总体表现相近，各有优劣`;
  }

  const winnerName = winners.overall === "a" ? nameA : nameB;

  // Find the most significant advantage
  const advantages: string[] = [];

  const totalReturnDiff = allMetrics.find((m) => m.key === "totalReturn");
  if (totalReturnDiff && totalReturnDiff.winner !== "tie") {
    const betterName = totalReturnDiff.winner === "a" ? nameA : nameB;
    const pct = new Decimal(totalReturnDiff.absoluteDiff).abs().times(100).toFixed(1);
    if (betterName === winnerName) {
      advantages.push(`收益率高 ${pct}%`);
    }
  }

  const maxDrawdownDiff = allMetrics.find((m) => m.key === "maxDrawdown");
  if (maxDrawdownDiff && maxDrawdownDiff.winner !== "tie") {
    const betterName = maxDrawdownDiff.winner === "a" ? nameA : nameB;
    const pct = new Decimal(maxDrawdownDiff.absoluteDiff).abs().times(100).toFixed(1);
    if (betterName === winnerName) {
      advantages.push(`回撤低 ${pct}%`);
    }
  }

  const sharpeDiff = allMetrics.find((m) => m.key === "sharpeRatio");
  if (sharpeDiff && sharpeDiff.winner !== "tie") {
    const betterName = sharpeDiff.winner === "a" ? nameA : nameB;
    if (betterName === winnerName) {
      advantages.push("夏普比率更优");
    }
  }

  const advantageText =
    advantages.length > 0 ? `：${advantages.join("、")}` : "";

  return `${winnerName} 综合表现更优${advantageText}`;
}
