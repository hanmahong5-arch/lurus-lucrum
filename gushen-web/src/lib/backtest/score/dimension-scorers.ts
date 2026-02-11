/**
 * Dimension Scorers
 * 维度评分器
 *
 * Calculates individual dimension scores (0-100) for:
 * - Profitability (收益性)
 * - Risk Control (风险控制)
 * - Stability (稳定性)
 * - Trading Efficiency (交易效率)
 *
 * @module lib/backtest/score/dimension-scorers
 */

import Decimal from "decimal.js";
import type { BacktestSummary } from "../types";
import type { MetricThreshold } from "./types";
import {
  PROFITABILITY_THRESHOLDS,
  RISK_THRESHOLDS,
  STABILITY_THRESHOLDS,
  EFFICIENCY_THRESHOLDS,
} from "./types";

// =============================================================================
// CORE SCORING FUNCTIONS / 核心评分函数
// =============================================================================

/**
 * Calculate score for a single metric based on thresholds
 * 根据阈值计算单个指标的分数
 *
 * @param value - Metric value (指标值)
 * @param threshold - Threshold configuration (阈值配置)
 * @returns Score 0-100 (分数 0-100)
 */
export function scoreMetric(value: number, threshold: MetricThreshold): number {
  const { direction, thresholds } = threshold;
  const [excellent, good, average, poor] = thresholds;

  // Handle NaN or undefined
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (direction === "higher-better") {
    // Higher values are better (e.g., return, win rate, sharpe)
    if (value >= excellent) return 100;
    if (value >= good) {
      // Linear interpolation between good (80) and excellent (100)
      return linearInterpolate(value, good, excellent, 80, 100);
    }
    if (value >= average) {
      // Linear interpolation between average (60) and good (80)
      return linearInterpolate(value, average, good, 60, 80);
    }
    if (value >= poor) {
      // Linear interpolation between poor (40) and average (60)
      return linearInterpolate(value, poor, average, 40, 60);
    }
    // Below poor: scale from 0 to 40
    // Use a minimum floor to avoid extremely negative scores
    const minValue = poor - Math.abs(poor);
    if (value <= minValue) return 0;
    return linearInterpolate(value, minValue, poor, 0, 40);
  } else {
    // Lower values are better (e.g., drawdown, volatility)
    if (value <= excellent) return 100;
    if (value <= good) {
      return linearInterpolate(value, excellent, good, 100, 80);
    }
    if (value <= average) {
      return linearInterpolate(value, good, average, 80, 60);
    }
    if (value <= poor) {
      return linearInterpolate(value, average, poor, 60, 40);
    }
    // Above poor: scale from 40 to 0
    const maxValue = poor + Math.abs(poor);
    if (value >= maxValue) return 0;
    return linearInterpolate(value, poor, maxValue, 40, 0);
  }
}

/**
 * Linear interpolation between two points
 * 两点之间的线性插值
 */
function linearInterpolate(
  value: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number
): number {
  if (x2 === x1) return y1;
  const ratio = (value - x1) / (x2 - x1);
  const result = y1 + ratio * (y2 - y1);
  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(result)));
}

/**
 * Calculate weighted average of multiple metric scores
 * 计算多个指标分数的加权平均
 */
function weightedAverage(scores: number[], weights?: number[]): number {
  if (scores.length === 0) return 0;

  const effectiveWeights = weights ?? scores.map(() => 1 / scores.length);

  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = scores.reduce(
    (sum, score, i) => sum + score * (effectiveWeights[i] ?? 0),
    0
  );

  return new Decimal(weightedSum).dividedBy(totalWeight).toDecimalPlaces(2).toNumber();
}

// =============================================================================
// DIMENSION SCORERS / 维度评分器
// =============================================================================

/**
 * Calculate profitability dimension score
 * 计算收益性维度得分
 *
 * Considers:
 * - Annualized return (年化收益率) - weight 60%
 * - Total return (总收益率) - weight 40%
 *
 * @param summary - Backtest summary (回测摘要)
 * @returns Score 0-100 (分数 0-100)
 */
export function scoreProfitability(summary: BacktestSummary): number {
  const annualizedThreshold = PROFITABILITY_THRESHOLDS.annualizedReturn;
  const totalThreshold = PROFITABILITY_THRESHOLDS.totalReturn;

  const annualizedReturnScore = scoreMetric(summary.annualizedReturn, annualizedThreshold);
  const totalReturnScore = scoreMetric(summary.totalReturn, totalThreshold);

  // Weighted average: annualized (60%), total (40%)
  return weightedAverage([annualizedReturnScore, totalReturnScore], [0.6, 0.4]);
}

/**
 * Calculate risk control dimension score
 * 计算风险控制维度得分
 *
 * Considers:
 * - Max drawdown (最大回撤) - weight 70%
 * - Volatility (波动率) - weight 30%
 *
 * @param summary - Backtest summary (回测摘要)
 * @returns Score 0-100 (分数 0-100)
 */
export function scoreRisk(summary: BacktestSummary): number {
  const drawdownThreshold = RISK_THRESHOLDS.maxDrawdown;
  const volatilityThreshold = RISK_THRESHOLDS.volatility;

  // Max drawdown is stored as positive percentage (e.g., 0.15 for 15% drawdown)
  const maxDrawdownScore = scoreMetric(Math.abs(summary.maxDrawdown), drawdownThreshold);
  const volatilityScore = scoreMetric(summary.volatility, volatilityThreshold);

  // Weighted average: drawdown (70%), volatility (30%)
  return weightedAverage([maxDrawdownScore, volatilityScore], [0.7, 0.3]);
}

/**
 * Calculate stability dimension score
 * 计算稳定性维度得分
 *
 * Considers:
 * - Sharpe ratio (夏普比率) - weight 60%
 * - Sortino ratio (索提诺比率) - weight 40%
 *
 * @param summary - Backtest summary (回测摘要)
 * @returns Score 0-100 (分数 0-100)
 */
export function scoreStability(summary: BacktestSummary): number {
  const sharpeThreshold = STABILITY_THRESHOLDS.sharpeRatio;
  const sortinoThreshold = STABILITY_THRESHOLDS.sortinoRatio;

  const sharpeScore = scoreMetric(summary.sharpeRatio, sharpeThreshold);
  const sortinoScore = scoreMetric(summary.sortinoRatio, sortinoThreshold);

  // Weighted average: sharpe (60%), sortino (40%)
  return weightedAverage([sharpeScore, sortinoScore], [0.6, 0.4]);
}

/**
 * Calculate trading efficiency dimension score
 * 计算交易效率维度得分
 *
 * Considers:
 * - Win rate (胜率) - weight 40%
 * - Profit factor (盈亏比) - weight 40%
 * - Average holding period (平均持仓天数) - weight 20%
 *
 * @param summary - Backtest summary (回测摘要)
 * @returns Score 0-100 (分数 0-100)
 */
export function scoreEfficiency(summary: BacktestSummary): number {
  const winRateThreshold = EFFICIENCY_THRESHOLDS.winRate;
  const profitFactorThreshold = EFFICIENCY_THRESHOLDS.profitFactor;
  const holdingThreshold = EFFICIENCY_THRESHOLDS.avgHoldingPeriod;

  const winRateScore = scoreMetric(summary.winRate, winRateThreshold);
  const profitFactorScore = scoreMetric(summary.profitFactor, profitFactorThreshold);
  const holdingScore = scoreMetric(summary.avgHoldingPeriod, holdingThreshold);

  // Weighted average: winRate (40%), profitFactor (40%), holding (20%)
  return weightedAverage(
    [winRateScore, profitFactorScore, holdingScore],
    [0.4, 0.4, 0.2]
  );
}

// =============================================================================
// EXPORTS / 导出
// =============================================================================

export const dimensionScorers = {
  profitability: scoreProfitability,
  risk: scoreRisk,
  stability: scoreStability,
  efficiency: scoreEfficiency,
};
