/**
 * Strategy Recommendation Engine — Reverse matching.
 *
 * Input: stocks + holding period
 * Output: ranked list of strategies with scores and evidence.
 *
 * Scoring formula (multi-indicator confluence):
 *   compositeScore = 0.35*winRate + 0.30*avgReturn + 0.20*consistency + 0.15*signalDensity
 *
 * Each dimension normalized to 0-100:
 *   winRateScore: 30%->0, 50%->50, 70%->100
 *   returnScore: negative->0, 0%->25, 5%->100
 *   consistencyScore: 1 - CV(per-stock returns), clamped to [0,1], x100
 *   signalDensityScore: signals per stock, 0->0, 3+->100
 *
 * @module lib/backtest/strategy-recommender
 */

import type { BacktestKline } from "./engine";
import {
  STRATEGY_DETECTORS,
  scanStockSignalsEnhanced,
  getScanStatistics,
  type StockSignalResult,
  type ScanOptions,
} from "./signal-scanner";
import type { ScoreGrade } from "./score/types";

// =============================================================================
// TYPES
// =============================================================================

export interface StrategyRecommendation {
  /** Strategy detector key */
  strategyId: string;
  /** Display name (Chinese) */
  strategyName: string;
  /** Strategy description */
  description: string;
  /** Composite score (0-100) */
  compositeScore: number;
  /** Grade (S/A/B/C/D) */
  grade: string;
  /** Average win rate across all stocks (%) */
  avgWinRate: number;
  /** Average return across all stocks (%) */
  avgReturn: number;
  /** Total signals detected */
  totalSignals: number;
  /** Number of stocks that had signals */
  stocksWithSignals: number;
  /** Total stocks scanned */
  totalStocksScanned: number;
  /** Consistency score (0-100) */
  consistency: number;
  /** Top 3 sample trades as evidence */
  sampleTrades: Array<{
    symbol: string;
    name: string;
    entryDate: string;
    returnPct: number;
  }>;
  /** Chinese explanation of why this strategy works for this sector */
  explanation: string;
}

export interface RecommendInput {
  /** Stock data with K-lines */
  stocks: Array<{
    symbol: string;
    name: string;
    klines: BacktestKline[];
  }>;
  /** Holding period in days */
  holdingDays: number;
  /** Optional: limit number of strategies to return */
  topN?: number;
  /** Optional: scan options override */
  scanOptions?: Partial<ScanOptions>;
  /** Progress callback */
  onProgress?: (strategyIdx: number, totalStrategies: number, strategyName: string) => void;
}

// =============================================================================
// SCORING WEIGHTS
// =============================================================================

const WEIGHTS = {
  winRate: 0.35,
  avgReturn: 0.30,
  consistency: 0.20,
  signalDensity: 0.15,
} as const;

// Grade thresholds for recommendation scoring (different from backtest GRADE_CONFIG)
const RECOMMEND_GRADE_THRESHOLDS: Array<{ min: number; grade: ScoreGrade }> = [
  { min: 85, grade: "S" },
  { min: 70, grade: "A" },
  { min: 55, grade: "B" },
  { min: 40, grade: "C" },
  { min: 0,  grade: "D" },
];

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Recommend the best strategies for a given set of stocks.
 *
 * For each strategy detector, scans all stocks and computes aggregate
 * performance metrics. Returns strategies ranked by composite score.
 */
export function recommendStrategies(input: RecommendInput): StrategyRecommendation[] {
  const { stocks, holdingDays, topN, scanOptions, onProgress } = input;

  if (stocks.length === 0) return [];

  const strategyIds = Object.keys(STRATEGY_DETECTORS);
  const recommendations: StrategyRecommendation[] = [];

  for (let si = 0; si < strategyIds.length; si++) {
    const strategyId = strategyIds[si]!;
    const detector = STRATEGY_DETECTORS[strategyId]!;

    onProgress?.(si + 1, strategyIds.length, detector.name);

    // Scan all stocks with this strategy
    const results: StockSignalResult[] = [];
    for (const stock of stocks) {
      const result = scanStockSignalsEnhanced(
        stock.symbol,
        stock.name,
        stock.klines,
        strategyId,
        { holdingDays, ...scanOptions },
      );
      results.push(result);
    }

    const stats = getScanStatistics(results);

    // Skip strategies with no signals at all
    if (stats.totalSignals === 0) continue;

    // Compute sub-scores (0-100 each)
    const winRateScore = normalizeWinRate(stats.avgWinRate);
    const returnScore = normalizeReturn(stats.avgReturn);
    const consistencyScore = computeConsistencyScore(results);
    const signalDensityScore = normalizeSignalDensity(
      stats.totalSignals,
      stocks.length,
    );

    const compositeScore =
      WEIGHTS.winRate * winRateScore +
      WEIGHTS.avgReturn * returnScore +
      WEIGHTS.consistency * consistencyScore +
      WEIGHTS.signalDensity * signalDensityScore;

    const grade = scoreToGrade(compositeScore);

    // Collect top sample trades
    const sampleTrades = extractTopTrades(results, 3);

    // Compute consistency score (0-100)
    const consistencyValue = Math.round(consistencyScore * 10) / 10;

    recommendations.push({
      strategyId,
      strategyName: detector.name,
      description: detector.description,
      compositeScore: Math.round(compositeScore * 10) / 10,
      grade,
      avgWinRate: Math.round(stats.avgWinRate * 10) / 10,
      avgReturn: Math.round(stats.avgReturn * 100) / 100,
      totalSignals: stats.totalSignals,
      stocksWithSignals: stats.stocksWithSignals,
      totalStocksScanned: stocks.length,
      consistency: consistencyValue,
      sampleTrades,
      explanation: generateExplanation(
        strategyId,
        detector.name,
        stats.avgWinRate,
        stats.avgReturn,
        stats.totalSignals,
        stats.stocksWithSignals,
        stocks.length,
      ),
    });
  }

  // Sort by composite score descending
  recommendations.sort((a, b) => b.compositeScore - a.compositeScore);

  return topN ? recommendations.slice(0, topN) : recommendations;
}

// =============================================================================
// SCORING HELPERS
// =============================================================================

/**
 * Normalize win rate to 0-100 score.
 * 30% -> 0, 50% -> 50, 70% -> 100. Linear interpolation between anchors.
 */
function normalizeWinRate(winRate: number): number {
  if (winRate <= 30) return 0;
  if (winRate >= 70) return 100;
  // Linear: 30->0, 50->50, 70->100 => slope = 100/40 = 2.5 per %
  return ((winRate - 30) / 40) * 100;
}

/**
 * Normalize average return to 0-100 score.
 * negative -> 0, 0% -> 25, 5% -> 100. Linear between anchors.
 */
function normalizeReturn(avgReturn: number): number {
  if (avgReturn <= 0) return avgReturn < 0 ? 0 : 25;
  if (avgReturn >= 5) return 100;
  // Linear: 0 -> 25, 5 -> 100 => slope = 75/5 = 15 per %
  return 25 + (avgReturn / 5) * 75;
}

/**
 * Compute consistency score from per-stock return variance.
 * Uses coefficient of variation (CV). Lower CV = higher consistency.
 * Score = (1 - CV) * 100, clamped to [0, 100].
 */
function computeConsistencyScore(results: StockSignalResult[]): number {
  const stockReturns = results
    .filter((r) => r.totalSignals > 0)
    .map((r) => r.avgReturn);

  if (stockReturns.length < 2) return 50; // Not enough data for meaningful CV

  const mean = stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length;
  const stdDev = computeStdDev(stockReturns);

  // Avoid division by zero — if mean is near zero, use absolute std dev mapping
  if (Math.abs(mean) < 0.01) {
    // Fallback: stdDev 0 -> 100, stdDev >= 30 -> 0
    return Math.max(0, Math.min(100, 100 - (stdDev / 30) * 100));
  }

  const cv = stdDev / Math.abs(mean);
  // cv = 0 -> score 100, cv >= 1 -> score 0
  return Math.max(0, Math.min(100, (1 - cv) * 100));
}

/**
 * Normalize signal density (avg signals per stock).
 * 0 signals/stock -> 0, 3+ signals/stock -> 100.
 */
function normalizeSignalDensity(totalSignals: number, totalStocks: number): number {
  if (totalStocks === 0) return 0;
  const density = totalSignals / totalStocks;
  if (density <= 0) return 0;
  if (density >= 3) return 100;
  return (density / 3) * 100;
}

/** Convert composite score to grade using recommendation-specific thresholds. */
function scoreToGrade(score: number): ScoreGrade {
  for (const entry of RECOMMEND_GRADE_THRESHOLDS) {
    if (score >= entry.min) return entry.grade;
  }
  return "D";
}

/** Population standard deviation of an array. */
function computeStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return Math.sqrt(squaredDiffs / values.length);
}

// =============================================================================
// SAMPLE TRADES
// =============================================================================

/** Extract top N trades by return from all results as evidence. */
function extractTopTrades(
  results: StockSignalResult[],
  n: number,
): Array<{ symbol: string; name: string; entryDate: string; returnPct: number }> {
  const allTrades: Array<{
    symbol: string;
    name: string;
    entryDate: string;
    returnPct: number;
  }> = [];

  for (const result of results) {
    for (const signal of result.signals) {
      if (signal.status !== "completed") continue;
      allTrades.push({
        symbol: signal.symbol,
        name: signal.name,
        entryDate: signal.entryDate,
        returnPct: Math.round((signal.netReturnPct ?? signal.returnPct) * 100) / 100,
      });
    }
  }

  // Sort by return descending, take top N
  allTrades.sort((a, b) => b.returnPct - a.returnPct);
  return allTrades.slice(0, n);
}

// =============================================================================
// EXPLANATION GENERATOR
// =============================================================================

/** Strategy-specific Chinese explanation templates */
const STRATEGY_EXPLANATION_TEMPLATES: Record<string, (wr: number, ar: number, signals: number) => string> = {
  macd_golden_cross: (wr, ar, signals) =>
    `MACD趋势跟踪在该板块表现稳定，${wr.toFixed(0)}%胜率说明趋势信号在此类股票中较为可靠，共捕捉到${signals}次交易机会，平均收益${ar.toFixed(1)}%`,
  macd_death_cross: (wr, ar, signals) =>
    `MACD死叉做空信号在该板块检测到${signals}次卖出时机，${wr.toFixed(0)}%胜率，平均收益${ar.toFixed(1)}%，可用于止盈或风险规避`,
  rsi_oversold: (wr, ar, signals) =>
    `RSI超卖反弹策略捕捉到${signals}次有效低点，平均收益${ar.toFixed(1)}%，${wr.toFixed(0)}%胜率表明该板块存在明显的超跌反弹规律`,
  rsi_overbought: (wr, ar, signals) =>
    `RSI超买策略在该板块发现${signals}次过热信号，${wr.toFixed(0)}%胜率，平均收益${ar.toFixed(1)}%，适用于高位减仓或反向操作`,
  ma_golden_cross: (wr, ar, signals) =>
    `均线金叉趋势确认信号在该板块产生${signals}次买入机会，${wr.toFixed(0)}%胜率和${ar.toFixed(1)}%平均收益显示中期趋势跟踪有效`,
  ma_death_cross: (wr, ar, signals) =>
    `均线死叉趋势反转信号检测到${signals}次卖出时机，${wr.toFixed(0)}%胜率，平均收益${ar.toFixed(1)}%，可用于中期趋势拐点判断`,
  boll_lower_break: (wr, ar, signals) =>
    `布林带下轨支撑策略在该板块捕获${signals}次触底反弹信号，${wr.toFixed(0)}%胜率和${ar.toFixed(1)}%平均收益说明价格均值回归特征明显`,
  boll_upper_break: (wr, ar, signals) =>
    `布林带上轨压力策略发现${signals}次超涨信号，${wr.toFixed(0)}%胜率，平均收益${ar.toFixed(1)}%，适用于短期过热判断`,
  volume_breakout: (wr, ar, signals) =>
    `放量突破策略在该板块捕获${signals}次量价齐升信号，${wr.toFixed(0)}%胜率和${ar.toFixed(1)}%平均收益表明突破信号在此类股票中较为有效`,
};

function generateExplanation(
  strategyId: string,
  strategyName: string,
  winRate: number,
  avgReturn: number,
  totalSignals: number,
  stocksWithSignals: number,
  totalStocks: number,
): string {
  // Use strategy-specific template if available
  const template = STRATEGY_EXPLANATION_TEMPLATES[strategyId];
  if (template) {
    return template(winRate, avgReturn, totalSignals);
  }

  // Generic fallback
  const coverage = totalStocks > 0
    ? Math.round((stocksWithSignals / totalStocks) * 100)
    : 0;

  let verdict: string;
  if (winRate >= 60 && avgReturn >= 5) {
    verdict = "表现优异，信号可靠";
  } else if (winRate >= 50 && avgReturn >= 0) {
    verdict = "表现稳健，值得关注";
  } else if (winRate >= 40) {
    verdict = "表现一般，需结合其他指标";
  } else {
    verdict = "信号较弱，不建议单独使用";
  }

  return (
    `${strategyName}在${totalStocks}只股票中覆盖${coverage}%，` +
    `胜率${winRate.toFixed(0)}%，平均收益${avgReturn.toFixed(1)}%，` +
    `共产生${totalSignals}个信号。${verdict}`
  );
}
