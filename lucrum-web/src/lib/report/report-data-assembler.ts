/**
 * Report Data Assembler
 * Extracts and transforms backtest result data into report-ready format.
 *
 * Each assemble*() function takes raw backtest data and returns a clean,
 * display-ready structure for the corresponding PDF page renderer.
 *
 * @module lib/report/report-data-assembler
 */

import type {
  UnifiedBacktestResult,
  DetailedTrade,
  StockBacktestResult,
} from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import type {
  CoverData,
  ScoreData,
  MetricsData,
  MetricRow,
  TradeListData,
  TradeRow,
  StockRankingData,
  StockRankingRow,
  ReportData,
} from "./types";
import { LIMITS } from "./constants";

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Format a number as a percentage string.
 * Returns "N/A" for null, undefined, or non-finite values.
 */
function fmtPct(value: number | undefined | null): string {
  if (value == null || !isFinite(value)) return "N/A";
  return (value * 100).toFixed(2) + "%";
}

/**
 * Format a number with fixed decimals.
 * Returns "N/A" for null, undefined, or non-finite values.
 */
function fmtNum(value: number | undefined | null, decimals = 2): string {
  if (value == null || !isFinite(value)) return "N/A";
  return value.toFixed(decimals);
}

/**
 * Determine highlight type based on sign of value.
 */
function highlightType(
  value: number | undefined | null
): "profit" | "loss" | "neutral" {
  if (value == null || !isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "profit" : "loss";
}

/**
 * Format a Date or timestamp to YYYY-MM-DD string.
 */
function fmtDate(dateStr: string | number): string {
  if (typeof dateStr === "number") {
    return new Date(dateStr * 1000).toISOString().slice(0, 10);
  }
  // Already a string, return first 10 chars (YYYY-MM-DD)
  return String(dateStr).slice(0, 10);
}

/**
 * Truncate a string to maxLen with ellipsis.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

// =============================================================================
// COVER DATA ASSEMBLY
// =============================================================================

/**
 * Assemble cover page data from backtest result and optional score.
 */
export function assembleCoverData(
  result: UnifiedBacktestResult,
  score: StrategyScore | null
): CoverData {
  const { config, strategy, target } = result;

  // Build target info string
  let targetInfo = "";
  if (target.mode === "stock" && target.stock) {
    targetInfo = `${target.stock.name} (${target.stock.symbol})`;
  } else if (target.mode === "sector" && target.sector) {
    targetInfo = target.sector.name;
  } else if (target.mode === "portfolio" && target.portfolio) {
    targetInfo = `${target.portfolio.name} (${target.portfolio.stocks.length} stocks)`;
  }

  // Build parameters summary
  const paramEntries = Object.entries(strategy.params || {});
  const paramsSummary =
    paramEntries.length > 0
      ? paramEntries.map(([k, v]) => `${k}=${v}`).join(", ")
      : "";

  return {
    title: "\u7B56\u7565\u56DE\u6D4B\u62A5\u544A",
    strategyName: truncate(
      strategy.name || "\u672A\u547D\u540D\u7B56\u7565",
      LIMITS.MAX_STRATEGY_NAME_LENGTH
    ),
    parametersSummary: paramsSummary,
    dateRange: `${fmtDate(config.startDate)} ~ ${fmtDate(config.endDate)}`,
    targetInfo,
    generatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    grade: score?.grade ?? "D",
    score: score?.score ?? 0,
  };
}

// =============================================================================
// SCORE DATA ASSEMBLY
// =============================================================================

/**
 * Assemble score summary data from StrategyScore.
 * Returns null if no score is available.
 */
export function assembleScoreData(
  score: StrategyScore | null,
  result?: UnifiedBacktestResult
): ScoreData | null {
  if (!score) return null;

  return {
    grade: score.grade,
    score: score.score,
    description: score.description,
    coreMetrics: score.coreMetrics,
    breakdown: score.breakdown,
    benchmarkAlpha: result?.riskMetrics?.beta,
    benchmarkBeta: result?.riskMetrics?.beta,
  };
}

// =============================================================================
// METRICS DATA ASSEMBLY
// =============================================================================

/**
 * Assemble the 3-category metrics table data.
 */
export function assembleMetricsData(
  result: UnifiedBacktestResult
): MetricsData {
  const { returnMetrics, riskMetrics, tradingMetrics } = result;

  const returnRows: MetricRow[] = [
    {
      label: "\u603B\u6536\u76CA\u7387",
      value: fmtPct(returnMetrics.totalReturn / 100),
      highlight: highlightType(returnMetrics.totalReturn),
    },
    {
      label: "\u5E74\u5316\u6536\u76CA\u7387",
      value: fmtPct(returnMetrics.annualizedReturn / 100),
      highlight: highlightType(returnMetrics.annualizedReturn),
    },
    {
      label: "\u8D85\u989D\u6536\u76CA (Alpha)",
      value:
        returnMetrics.alpha != null ? fmtPct(returnMetrics.alpha / 100) : "N/A",
      highlight: highlightType(returnMetrics.alpha ?? null),
    },
    {
      label: "\u6536\u76CA\u6CE2\u52A8\u7387",
      value: fmtPct(returnMetrics.returnVolatility),
      highlight: "neutral",
    },
    {
      label: "\u6700\u4F73\u6708\u5EA6\u6536\u76CA",
      value:
        returnMetrics.bestMonth != null
          ? fmtPct(returnMetrics.bestMonth / 100)
          : "N/A",
      highlight: "profit",
    },
    {
      label: "\u6700\u5DEE\u6708\u5EA6\u6536\u76CA",
      value:
        returnMetrics.worstMonth != null
          ? fmtPct(returnMetrics.worstMonth / 100)
          : "N/A",
      highlight: "loss",
    },
  ];

  const riskRows: MetricRow[] = [
    {
      label: "\u6700\u5927\u56DE\u64A4",
      value: fmtPct(riskMetrics.maxDrawdown / 100),
      highlight: "loss",
    },
    {
      label: "\u56DE\u64A4\u6301\u7EED\u5929\u6570",
      value: `${fmtNum(riskMetrics.maxDrawdownDuration, 0)} \u5929`,
      highlight: "neutral",
    },
    {
      label: "\u590F\u666E\u6BD4\u7387",
      value: fmtNum(riskMetrics.sharpeRatio),
      highlight: highlightType(riskMetrics.sharpeRatio),
    },
    {
      label: "\u7D22\u63D0\u8BFA\u6BD4\u7387",
      value: fmtNum(riskMetrics.sortinoRatio),
      highlight: highlightType(riskMetrics.sortinoRatio),
    },
    {
      label: "\u5361\u739B\u6BD4\u7387",
      value: fmtNum(riskMetrics.calmarRatio),
      highlight: highlightType(riskMetrics.calmarRatio),
    },
    {
      label: "VaR (95%)",
      value: riskMetrics.var95 != null ? fmtPct(riskMetrics.var95 / 100) : "N/A",
      highlight: "loss",
    },
  ];

  const tradingRows: MetricRow[] = [
    {
      label: "\u603B\u4EA4\u6613\u6B21\u6570",
      value: `${tradingMetrics.totalTrades} \u7B14`,
      highlight: "neutral",
    },
    {
      label: "\u80DC\u7387",
      value: fmtPct(tradingMetrics.winRate / 100),
      highlight: highlightType(tradingMetrics.winRate - 50),
    },
    {
      label: "\u76C8\u4E8F\u6BD4",
      value: fmtNum(tradingMetrics.profitFactor),
      highlight: highlightType(tradingMetrics.profitFactor - 1),
    },
    {
      label: "\u5E73\u5747\u6301\u4ED3\u5929\u6570",
      value: `${fmtNum(tradingMetrics.avgHoldingDays, 1)} \u5929`,
      highlight: "neutral",
    },
    {
      label: "\u6700\u5927\u8FDE\u80DC",
      value: `${tradingMetrics.maxConsecutiveWins} \u6B21`,
      highlight: "profit",
    },
    {
      label: "\u6700\u5927\u8FDE\u4E8F",
      value: `${tradingMetrics.maxConsecutiveLosses} \u6B21`,
      highlight: "loss",
    },
  ];

  return {
    returnMetrics: returnRows,
    riskMetrics: riskRows,
    tradingMetrics: tradingRows,
  };
}

// =============================================================================
// TRADE LIST DATA ASSEMBLY
// =============================================================================

/**
 * Assemble trade list data with a cap of MAX_TRADES.
 * Returns null if no trades are available.
 */
export function assembleTradeListData(
  result: UnifiedBacktestResult
): TradeListData | null {
  const trades = result.trades;
  if (!trades || trades.length === 0) return null;

  const totalTrades = trades.length;
  const cappedTrades = trades.slice(0, LIMITS.MAX_TRADES);

  const rows: TradeRow[] = cappedTrades.map((t: DetailedTrade) => ({
    date: fmtDate(t.date),
    type: t.type,
    symbol: t.symbol || "",
    price: fmtNum(t.executePrice),
    quantity: `${t.actualQuantity}`,
    pnl: t.pnl != null ? (t.pnl >= 0 ? "+" : "") + fmtNum(t.pnl) : "-",
    pnlHighlight: highlightType(t.pnl ?? null),
  }));

  return {
    trades: rows,
    totalTrades,
    hasMore: totalTrades > LIMITS.MAX_TRADES,
    moreCount: Math.max(0, totalTrades - LIMITS.MAX_TRADES),
  };
}

// =============================================================================
// STOCK RANKING DATA ASSEMBLY
// =============================================================================

/**
 * Assemble stock ranking data for multi-stock mode.
 * Returns null if not in sector/portfolio mode or no stock results.
 */
export function assembleStockRankingData(
  result: UnifiedBacktestResult
): StockRankingData | null {
  let stockResults: StockBacktestResult[] | undefined;

  if (result.target.mode === "sector" && result.sectorResult) {
    stockResults = result.sectorResult.stockResults;
  } else if (result.target.mode === "portfolio" && result.stockResults) {
    stockResults = result.stockResults;
  }

  if (!stockResults || stockResults.length === 0) return null;

  // Sort by totalReturn descending
  const sorted = [...stockResults].sort(
    (a, b) => b.totalReturn - a.totalReturn
  );

  const rows: StockRankingRow[] = sorted.map((s, i) => ({
    rank: i + 1,
    symbol: s.symbol,
    name: s.name,
    totalReturn: fmtPct(s.totalReturn / 100),
    totalReturnHighlight: highlightType(s.totalReturn),
    winRate: fmtPct(s.winRate / 100),
    sharpeRatio: fmtNum(s.sharpeRatio),
    maxDrawdown: fmtPct(s.maxDrawdown / 100),
    tradeCount: s.tradeCount,
  }));

  // Calculate averages
  const avgReturn =
    sorted.reduce((sum, s) => sum + s.totalReturn, 0) / sorted.length;
  const avgWinRate =
    sorted.reduce((sum, s) => sum + s.winRate, 0) / sorted.length;
  const avgSharpe =
    sorted.reduce((sum, s) => sum + s.sharpeRatio, 0) / sorted.length;

  return {
    stocks: rows,
    totalStocks: sorted.length,
    hasMore: sorted.length > LIMITS.MAX_STOCKS_PER_PAGE,
    averageReturn: fmtPct(avgReturn / 100),
    averageWinRate: fmtPct(avgWinRate / 100),
    averageSharpe: fmtNum(avgSharpe),
    failedCount: result.sectorResult
      ? result.sectorResult.stockCount - result.sectorResult.backtestCount
      : undefined,
  };
}

// =============================================================================
// MAIN ASSEMBLER
// =============================================================================

/**
 * Assemble complete report data from backtest result and optional score.
 *
 * @param result - The unified backtest result
 * @param score - Optional strategy score (null if not available)
 * @returns Complete ReportData structure ready for PDF rendering
 */
export function assembleReportData(
  result: UnifiedBacktestResult,
  score: StrategyScore | null = null
): ReportData {
  return {
    cover: assembleCoverData(result, score),
    score: assembleScoreData(score, result),
    chartImage: null, // Populated separately via captureChartImage
    metrics: assembleMetricsData(result),
    tradeList: assembleTradeListData(result),
    stockRanking: assembleStockRankingData(result),
  };
}

// =============================================================================
// FILENAME GENERATOR
// =============================================================================

/**
 * Generate PDF filename from backtest result.
 * Format: 回测报告_{strategyName}_{YYYYMMDD}.pdf
 */
export function generateFilename(result: UnifiedBacktestResult): string {
  const strategyName = (result.strategy.name || "strategy").replace(
    /[^\w\u4e00-\u9fff]/g,
    "_"
  );
  const dateStr = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return `\u56DE\u6D4B\u62A5\u544A_${strategyName}_${dateStr}`;
}
