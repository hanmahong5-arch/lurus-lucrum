/**
 * Backtest Results View — Full-Width Professional Results Page
 *
 * The hero component: replaces the split-panel editor with a full-width,
 * immersive backtest results experience. K-line chart is the hero element.
 *
 * Sections:
 * 1. Header — back button + strategy/target name
 * 2. Score Summary — grade badge + key metrics ribbon
 * 3. K-Line Chart — full-width hero with buy/sell markers
 * 4. Trade Records — card or table view
 * 5. Equity Analysis — equity curve, return distribution, drawdown
 * 6. Action Bar — save, export, portfolio validate, re-run
 *
 * @module components/backtest/backtest-results-view
 */

"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { KLineChart, type TradeMarkerInfo, type KLineChartHandle } from "@/components/charts/kline-chart";
import { EnhancedTradeCard } from "@/components/strategy-editor/enhanced-trade-card";
import { TradeTableView } from "@/components/strategy-editor/trade-table-view";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import type { BacktestResult, DetailedTrade, BacktestTrade } from "@/lib/backtest/types";
import type { StrategyScore } from "@/lib/backtest/score/types";
import { calculateScore } from "@/lib/backtest/score";
import Link from "next/link";

// Lazy-load ScoreCard since it has heavy deps
const ScoreCard = dynamic(
  () =>
    import("@/components/backtest/score-card").then((m) => ({
      default: m.ScoreCard,
    })),
  { ssr: false },
);

// =============================================================================
// TYPES
// =============================================================================

export interface BacktestResultsViewProps {
  /** Backtest result data */
  result: BacktestResult;
  /** Strategy name for display */
  strategyName?: string;
  /** Callback: go back to edit mode */
  onBackToEdit: () => void;
  /** Callback: re-run with modified strategy */
  onRerunWithEdit: () => void;
  /** Callback: save to history */
  onSaveToHistory?: () => void;
  /** Callback: export report */
  onExportReport?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SCORE HELPERS
// =============================================================================

const SCORE_GRADES = [
  { min: 80, label: "S", desc: "卓越", color: "text-score-s", bg: "bg-score-s/15", border: "border-score-s/30" },
  { min: 60, label: "A", desc: "优秀", color: "text-score-a", bg: "bg-score-a/15", border: "border-score-a/30" },
  { min: 40, label: "B", desc: "良好", color: "text-score-b", bg: "bg-score-b/15", border: "border-score-b/30" },
  { min: 20, label: "C", desc: "一般", color: "text-score-c", bg: "bg-score-c/15", border: "border-score-c/30" },
  { min: 0, label: "D", desc: "需改进", color: "text-score-d", bg: "bg-score-d/15", border: "border-score-d/30" },
] as const;

function getQuickGrade(score: number) {
  for (const g of SCORE_GRADES) {
    if (score >= g.min) return g;
  }
  return SCORE_GRADES[SCORE_GRADES.length - 1]!;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BacktestResultsView({
  result,
  strategyName,
  onBackToEdit,
  onRerunWithEdit,
  onSaveToHistory,
  onExportReport,
  className,
}: BacktestResultsViewProps) {
  // UI state
  const [tradeView, setTradeView] = useState<"card" | "table">("card");
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<"equity" | "distribution" | "drawdown">("equity");

  // Chart ref for scrolling to trade on click
  const chartRef = useRef<KLineChartHandle>(null);

  // Compute strategy score
  const strategyScore = useMemo<StrategyScore | null>(() => {
    if (!result) return null;
    try {
      const winningTrades = Math.round(
        result.totalTrades * (result.winRate / 100),
      );
      return calculateScore({
        startDate: result?.config?.startDate ?? '',
        endDate: result?.config?.endDate ?? '',
        tradingDays:
          result?.backtestMeta?.timeRange?.tradingDays ?? 0,
        executionTime: result?.executionTime ?? 0,
        initialCapital: result?.config?.initialCapital ?? 0,
        finalCapital: 0,
        peakCapital: 0,
        troughCapital: 0,
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        monthlyReturn: 0,
        dailyReturn: 0,
        maxDrawdown: result.maxDrawdown,
        maxDrawdownDuration: 0,
        volatility: 0,
        sharpeRatio: result.sharpeRatio,
        sortinoRatio: result.sortinoRatio,
        calmarRatio: 0,
        totalTrades: result.totalTrades,
        winningTrades,
        losingTrades: result.totalTrades - winningTrades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        avgWin: result.avgWin,
        avgLoss: result.avgLoss,
        avgWinLossRatio:
          result.avgLoss !== 0
            ? result.avgWin / result.avgLoss
            : 0,
        maxConsecutiveWins: result.maxConsecutiveWins,
        maxConsecutiveLosses: result.maxConsecutiveLosses,
        avgHoldingPeriod: result.avgHoldingPeriod,
        maxSingleWin: result.maxSingleWin,
        maxSingleWinDate: "",
        maxSingleLoss: result.maxSingleLoss,
        maxSingleLossDate: "",
        totalCommission: 0,
        totalSlippage: 0,
        totalTradingCost: 0,
        tradingCostPercent: 0,
      });
    } catch {
      return null;
    }
  }, [result]);

  // Quick grade from score
  const quickGrade = useMemo(() => {
    const scoreValue = strategyScore?.score ?? 0;
    return getQuickGrade(scoreValue);
  }, [strategyScore]);

  // Build trade markers for K-line chart
  const tradeMarkers = useMemo<TradeMarkerInfo[]>(() => {
    const detailedTrades = result.enhanced?.trades ?? [];
    return detailedTrades
      .filter((t) => t && typeof t === "object" && "triggerReason" in t)
      .map((t) => ({
        timestamp: t.timestamp,
        type: t.type,
        executePrice: t.executePrice,
        signalPrice: t.signalPrice,
        quantity: t.actualQuantity,
        lots: t.lots,
        commission: t.commission,
        slippage: t.slippage,
        triggerReason: t.triggerReason,
        indicatorValues: t.indicatorValues,
        pnl: t.pnl,
        pnlPercent: t.pnlPercent,
        holdingDays: t.holdingDays,
      }));
  }, [result]);

  // Trade stats
  const tradeStats = useMemo(() => {
    const buyCount = tradeMarkers.filter((m) => m.type === "buy").length;
    const sellCount = tradeMarkers.filter((m) => m.type === "sell").length;
    const profitCount = tradeMarkers.filter(
      (m) => m.type === "sell" && (m.pnl ?? 0) > 0,
    ).length;
    return { buyCount, sellCount, profitCount };
  }, [tradeMarkers]);

  // Daily logs for indicator sub-panels
  const dailyLogs = useMemo(
    () => result.enhanced?.dailyLogs ?? [],
    [result],
  );

  // Handle trade click from trade list — scroll chart to that trade
  const handleTradeClick = useCallback(
    (trade: DetailedTrade | BacktestTrade) => {
      const timestamp =
        "timestamp" in trade ? trade.timestamp : 0;
      if (timestamp > 0) {
        chartRef.current?.scrollToTrade(timestamp);
      }
    },
    [],
  );

  // Target info
  const targetSymbol =
    result.backtestMeta?.targetSymbol ?? result.config.symbol;
  const targetName = result.backtestMeta?.targetName ?? targetSymbol;

  // Trades to display (with pagination)
  // Trades can be DetailedTrade[] (enhanced) or BacktestTrade[] (legacy)
  const allTrades: Array<DetailedTrade | BacktestTrade> =
    (result.enhanced?.trades as Array<DetailedTrade | BacktestTrade>) ??
    (result.trades as Array<DetailedTrade | BacktestTrade>) ??
    [];
  const displayedTrades = showAllTrades ? allTrades : allTrades.slice(0, 10);

  // Export handler
  const handleExport = useCallback(() => {
    if (onExportReport) {
      onExportReport();
      return;
    }
    // Default export behavior
    const report = {
      generatedAt: new Date().toISOString(),
      platform: "Lucrum AI Trading",
      config: result.config,
      strategy: result.strategy,
      results: {
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio,
        sortinoRatio: result.sortinoRatio,
        winRate: result.winRate,
        totalTrades: result.totalTrades,
        profitFactor: result.profitFactor,
      },
      trades: result.trades,
      equityCurve: result.equityCurve,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest-report-${targetSymbol}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [onExportReport, result, targetSymbol]);

  return (
    <div
      className={cn(
        "max-w-[1920px] mx-auto px-4 sm:px-6 py-4 space-y-6",
        className,
      )}
    >
      {/* ================================================================= */}
      {/* HEADER                                                            */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToEdit}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回编辑
        </button>

        <div className="text-center">
          <h1 className="text-lg font-semibold text-neutral-100">
            回测结果
            {strategyName && (
              <span className="text-primary ml-2">{strategyName}</span>
            )}
          </h1>
          <p className="text-xs text-neutral-500 font-mono tabular-nums mt-0.5">
            {targetName}
            {targetName !== targetSymbol && (
              <span className="ml-1.5 text-neutral-600">{targetSymbol}</span>
            )}
            <span className="mx-1.5 text-neutral-700">|</span>
            {result?.config?.startDate ?? ''} ~ {result?.config?.endDate ?? ''}
          </p>
        </div>

        {/* Placeholder for symmetry */}
        <div className="w-20" />
      </div>

      {/* ================================================================= */}
      {/* SCORE SUMMARY RIBBON                                              */}
      {/* ================================================================= */}
      <div
        className={cn(
          "rounded-xl border p-4 sm:p-5",
          quickGrade.bg,
          quickGrade.border,
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          {/* Grade badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={cn(
                "w-14 h-14 rounded-lg flex items-center justify-center text-4xl font-mono font-bold",
                quickGrade.color,
                quickGrade.bg,
              )}
            >
              {quickGrade.label}
            </div>
            <div>
              <span
                className={cn("text-sm font-medium", quickGrade.color)}
              >
                {quickGrade.desc}
              </span>
              <span className="block text-xs text-neutral-500 font-mono tabular-nums">
                综合评分 {strategyScore?.score ?? 0}/100
              </span>
            </div>
          </div>

          {/* Key metrics ribbon */}
          <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            <MetricPill
              label="总收益"
              value={`${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`}
              isProfit={result.totalReturn >= 0}
              tooltipTerm="totalReturn"
            />
            <MetricPill
              label="年化"
              value={`${result.annualizedReturn >= 0 ? "+" : ""}${result.annualizedReturn.toFixed(1)}%`}
              isProfit={result.annualizedReturn >= 0}
              tooltipTerm="annualReturn"
            />
            <MetricPill
              label="回撤"
              value={`-${Math.abs(result.maxDrawdown).toFixed(1)}%`}
              isProfit={false}
              tooltipTerm="maxDrawdown"
            />
            <MetricPill
              label="胜率"
              value={`${result.winRate.toFixed(1)}%`}
              isProfit={result.winRate >= 50}
              tooltipTerm="winRate"
            />
            <MetricPill
              label="夏普"
              value={result.sharpeRatio.toFixed(2)}
              isProfit={result.sharpeRatio >= 1}
              neutral={result.sharpeRatio < 1 && result.sharpeRatio > 0}
              tooltipTerm="sharpe"
            />
            <MetricPill
              label="交易"
              value={`${result.totalTrades}次`}
              neutral
              tooltipTerm="tradeCount"
              detail={`持仓 ${result.avgHoldingPeriod.toFixed(0)}天`}
            />
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* K-LINE CHART (HERO)                                               */}
      {/* ================================================================= */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
            K线走势与交易信号
          </h2>
          {tradeMarkers.length > 0 && (
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <span className="text-profit">
                ▲ 买入 {tradeStats.buyCount}
              </span>
              <span className="text-loss">
                ▼ 卖出 {tradeStats.sellCount}
              </span>
              <span className="text-neutral-400">
                盈利 {tradeStats.profitCount}
              </span>
            </div>
          )}
        </div>
        <KLineChart
          ref={chartRef}
          symbol={targetSymbol}
          initialTimeFrame={result.config.timeframe}
          tradeMarkers={tradeMarkers.length > 0 ? tradeMarkers : undefined}
          dailyLogs={dailyLogs.length > 0 ? dailyLogs : undefined}
          height={460}
          showVolume={true}
          showMA={true}
        />
      </div>

      {/* ================================================================= */}
      {/* DETAILED METRICS                                                  */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <DetailMetricCard
          label="盈利因子"
          labelEn="Profit Factor"
          value={(result.profitFactor ?? 0).toFixed(2)}
          isProfit={(result.profitFactor ?? 0) >= 1}
          neutral={(result.profitFactor ?? 0) < 1 && (result.profitFactor ?? 0) > 0}
        />
        <DetailMetricCard
          label="索提诺比率"
          labelEn="Sortino"
          value={(result.sortinoRatio ?? 0).toFixed(2)}
          isProfit={(result.sortinoRatio ?? 0) >= 1.5}
          neutral
        />
        <DetailMetricCard
          label="平均盈利"
          labelEn="Avg Win"
          value={`+${(result.avgWin ?? 0).toFixed(2)}%`}
          isProfit
        />
        <DetailMetricCard
          label="平均亏损"
          labelEn="Avg Loss"
          value={`-${Math.abs(result.avgLoss ?? 0).toFixed(2)}%`}
          isProfit={false}
        />
        <DetailMetricCard
          label="最大连胜"
          labelEn="Max Streak"
          value={`${result.maxConsecutiveWins ?? 0}次`}
          isProfit
        />
        <DetailMetricCard
          label="最大连亏"
          labelEn="Max Losses"
          value={`${result.maxConsecutiveLosses ?? 0}次`}
          isProfit={false}
        />
      </div>

      {/* ================================================================= */}
      {/* TRADE RECORDS                                                     */}
      {/* ================================================================= */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            交易记录
            <span className="text-neutral-600 text-xs font-normal font-mono tabular-nums">
              共 {allTrades.length} 笔
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* View toggle: card / table */}
            <div className="flex items-center rounded bg-surface border border-white/5 overflow-hidden">
              <button
                onClick={() => setTradeView("card")}
                className={cn(
                  "px-2.5 py-1 text-xs transition-colors",
                  tradeView === "card"
                    ? "bg-white/10 text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-300",
                )}
                aria-label="卡片视图"
              >
                卡片
              </button>
              <button
                onClick={() => setTradeView("table")}
                className={cn(
                  "px-2.5 py-1 text-xs transition-colors",
                  tradeView === "table"
                    ? "bg-white/10 text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-300",
                )}
                aria-label="表格视图"
              >
                表格
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {allTrades.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              暂无交易记录
            </div>
          ) : tradeView === "table" && result.enhanced?.trades ? (
            <TradeTableView
              trades={
                showAllTrades
                  ? result.enhanced.trades
                  : result.enhanced.trades.slice(0, 10)
              }
              dataIncomplete={
                (result.backtestMeta?.dataQuality?.completeness ?? 1) < 1
              }
            />
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {displayedTrades.map((trade, index) => {
                const isDetailed =
                  trade &&
                  typeof trade === "object" &&
                  "triggerReason" in trade;
                if (isDetailed) {
                  return (
                    <div
                      key={trade.id || `trade-${index}`}
                      className="cursor-pointer hover:ring-1 hover:ring-white/10 rounded-lg transition-all"
                      onClick={() => handleTradeClick(trade)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          handleTradeClick(trade);
                      }}
                    >
                      <EnhancedTradeCard
                        trade={trade as unknown as DetailedTrade}
                      />
                    </div>
                  );
                }
                // Legacy trade card fallback
                return (
                  <div
                    key={trade.id || `trade-${index}`}
                    className="cursor-pointer hover:ring-1 hover:ring-white/10 rounded-lg transition-all"
                    onClick={() => handleTradeClick(trade)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleTradeClick(trade);
                    }}
                  >
                    <LegacyTradeRow
                      trade={trade as BacktestTrade}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Show more / less */}
          {allTrades.length > 10 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setShowAllTrades((v) => !v)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {showAllTrades
                  ? "收起"
                  : `查看全部 ${allTrades.length} 笔交易`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* EQUITY ANALYSIS                                                   */}
      {/* ================================================================= */}
      {result.equityCurve && result.equityCurve.length > 0 && (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-medium text-neutral-200">
              收益分析
            </h2>
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "equity", label: "净值曲线" },
                  { key: "distribution", label: "收益分布" },
                  { key: "drawdown", label: "回撤分析" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAnalysisTab(tab.key)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    analysisTab === tab.key
                      ? "bg-primary/20 text-primary font-medium"
                      : "text-neutral-500 hover:text-neutral-300",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 min-h-[200px]">
            {analysisTab === "equity" && (
              <EquityCurveDisplay equityCurve={result.equityCurve} />
            )}
            {analysisTab === "distribution" && (
              <ReturnDistributionDisplay trades={result.trades} />
            )}
            {analysisTab === "drawdown" && (
              <DrawdownDisplay equityCurve={result.equityCurve} />
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* ACTION BAR                                                        */}
      {/* ================================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 glass-panel rounded-xl border border-white/5">
        <div className="flex items-center gap-2">
          {onSaveToHistory && (
            <button
              onClick={onSaveToHistory}
              className="px-4 py-2 text-sm text-neutral-300 bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-lg transition-all btn-tactile flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              保存到历史
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm text-neutral-300 bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-lg transition-all btn-tactile flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            导出报告
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/strategy-validation"
            className="px-4 py-2 text-sm text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-lg transition-all btn-tactile flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            去组合验证
          </Link>
          <button
            onClick={onRerunWithEdit}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 glow-active"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            修改策略并重跑
          </button>
        </div>
      </div>

      {/* Risk Disclaimer */}
      <div className="p-3 bg-loss/5 border border-loss/20 rounded-xl">
        <p className="text-xs text-white/50 leading-relaxed">
          <span className="text-loss font-medium">风险提示</span>
          {" "}历史回测结果不代表未来收益。本工具生成的策略代码仅供学习研究使用，不构成任何投资建议。
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MetricPillProps {
  label: string;
  value: string;
  isProfit?: boolean;
  neutral?: boolean;
  tooltipTerm?: string;
  detail?: string;
}

function MetricPill({
  label,
  value,
  isProfit = true,
  neutral = false,
  tooltipTerm,
  detail,
}: MetricPillProps) {
  const colorClass = neutral
    ? "text-neutral-200"
    : isProfit
      ? "text-profit"
      : "text-loss";

  return (
    <div className="text-center">
      <div className="text-[10px] text-neutral-500 mb-0.5">
        {tooltipTerm ? (
          <SmartTooltip term={tooltipTerm}>{label}</SmartTooltip>
        ) : (
          label
        )}
      </div>
      <div
        className={cn(
          "text-lg font-bold font-mono tabular-nums",
          colorClass,
        )}
      >
        {value}
      </div>
      {detail && (
        <div className="text-[10px] text-neutral-600 font-mono tabular-nums">
          {detail}
        </div>
      )}
    </div>
  );
}

interface DetailMetricCardProps {
  label: string;
  labelEn: string;
  value: string;
  isProfit?: boolean;
  neutral?: boolean;
}

function DetailMetricCard({
  label,
  labelEn,
  value,
  isProfit = true,
  neutral = false,
}: DetailMetricCardProps) {
  const colorClass = neutral
    ? "text-neutral-200"
    : isProfit
      ? "text-profit"
      : "text-loss";

  return (
    <div className="stat-card">
      <div className="text-xs text-neutral-500 mb-1">
        {label}
        <span className="block text-[10px] text-neutral-600">{labelEn}</span>
      </div>
      <div
        className={cn("text-xl font-bold font-mono tabular-nums", colorClass)}
      >
        {value}
      </div>
    </div>
  );
}

// Legacy trade row fallback for non-detailed trades
function LegacyTradeRow({ trade }: { trade: BacktestTrade }) {
  const tradeType = trade.type;
  const price = isFinite(trade.price) ? trade.price : 0;
  const size = isFinite(trade.size) ? trade.size : 0;
  const pnlPercent =
    trade.pnlPercent !== undefined && isFinite(trade.pnlPercent)
      ? trade.pnlPercent
      : null;

  return (
    <div
      className={cn(
        "p-3 rounded-lg text-xs",
        tradeType === "buy" ? "bg-profit/5 border border-profit/10" : "bg-loss/5 border border-loss/10",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-medium px-2 py-0.5 rounded",
            tradeType === "buy"
              ? "text-profit bg-profit/20"
              : "text-loss bg-loss/20",
          )}
        >
          {tradeType === "buy" ? "买入" : "卖出"}
        </span>
        {pnlPercent !== null && (
          <span
            className={cn(
              "font-mono tabular-nums font-medium",
              pnlPercent >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {pnlPercent >= 0 ? "+" : ""}
            {pnlPercent.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-white/60 font-mono tabular-nums">
        ¥{price.toFixed(2)} x {size.toLocaleString()}股
      </div>
    </div>
  );
}

// =============================================================================
// EQUITY / ANALYSIS DISPLAYS
// =============================================================================

function EquityCurveDisplay({
  equityCurve,
}: {
  equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
}) {
  if (equityCurve.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        无净值数据
      </div>
    );
  }

  // Simple ASCII-style bar chart representation for equity curve
  const minEquity = Math.min(...equityCurve.map((p) => p.equity));
  const maxEquity = Math.max(...equityCurve.map((p) => p.equity));
  const range = maxEquity - minEquity || 1;
  const first = equityCurve[0]!;
  const last = equityCurve[equityCurve.length - 1]!;
  const totalReturn =
    ((last.equity - first.equity) / first.equity) * 100;

  // Sample points for sparkline display
  const sampleCount = Math.min(80, equityCurve.length);
  const step = Math.max(1, Math.floor(equityCurve.length / sampleCount));
  const samples = [];
  for (let i = 0; i < equityCurve.length; i += step) {
    samples.push(equityCurve[i]!);
  }
  // Always include last point
  if (samples[samples.length - 1] !== last) {
    samples.push(last);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-neutral-500">
          {first.date} ~ {last.date}
        </div>
        <div
          className={cn(
            "text-sm font-mono tabular-nums font-medium",
            totalReturn >= 0 ? "text-profit" : "text-loss",
          )}
        >
          {totalReturn >= 0 ? "+" : ""}
          {totalReturn.toFixed(2)}%
        </div>
      </div>

      {/* Sparkline via SVG */}
      <div className="w-full h-40 bg-surface/50 rounded-lg p-2">
        <svg
          viewBox={`0 0 ${samples.length - 1} 100`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Gradient fill */}
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={totalReturn >= 0 ? "#10b981" : "#ef4444"}
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor={totalReturn >= 0 ? "#10b981" : "#ef4444"}
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path
            d={`M0,${100 - ((samples[0]!.equity - minEquity) / range) * 100} ${samples
              .map(
                (p, i) =>
                  `L${i},${100 - ((p.equity - minEquity) / range) * 100}`,
              )
              .join(" ")} L${samples.length - 1},100 L0,100 Z`}
            fill="url(#eq-fill)"
          />
          {/* Line */}
          <polyline
            points={samples
              .map(
                (p, i) =>
                  `${i},${100 - ((p.equity - minEquity) / range) * 100}`,
              )
              .join(" ")}
            fill="none"
            stroke={totalReturn >= 0 ? "#10b981" : "#ef4444"}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-neutral-600 font-mono tabular-nums">
        <span>起始 ¥{first.equity.toLocaleString()}</span>
        <span>终值 ¥{last.equity.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ReturnDistributionDisplay({
  trades,
}: {
  trades: Array<{ pnlPercent?: number }>;
}) {
  const returns = trades
    .filter(
      (t) =>
        t.pnlPercent !== undefined &&
        t.pnlPercent !== null &&
        isFinite(t.pnlPercent),
    )
    .map((t) => t.pnlPercent!);

  if (returns.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        无收益分布数据
      </div>
    );
  }

  // Create histogram buckets
  const bucketSize = 2; // 2% per bucket
  const minR = Math.floor(Math.min(...returns) / bucketSize) * bucketSize;
  const maxR = Math.ceil(Math.max(...returns) / bucketSize) * bucketSize;
  const buckets: Array<{ range: string; count: number; pct: number }> = [];

  for (let low = minR; low < maxR; low += bucketSize) {
    const high = low + bucketSize;
    const count = returns.filter((r) => r >= low && r < high).length;
    buckets.push({
      range: `${low >= 0 ? "+" : ""}${low}~${high >= 0 ? "+" : ""}${high}%`,
      count,
      pct: low,
    });
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div>
      <div className="text-xs text-neutral-500 mb-3">
        收益分布 (共 {returns.length} 笔交易)
      </div>
      <div className="flex items-end gap-1 h-32">
        {buckets.map((bucket, i) => {
          const height = (bucket.count / maxCount) * 100;
          const isProfit = bucket.pct >= 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${bucket.range}: ${bucket.count}笔`}
            >
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all min-h-[2px]",
                  isProfit ? "bg-profit/60" : "bg-loss/60",
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-neutral-600 font-mono tabular-nums">
        <span>{minR}%</span>
        <span>0%</span>
        <span>{maxR}%</span>
      </div>
    </div>
  );
}

function DrawdownDisplay({
  equityCurve,
}: {
  equityCurve: Array<{ date: string; drawdown: number }>;
}) {
  if (equityCurve.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        无回撤数据
      </div>
    );
  }

  const maxDD = Math.max(...equityCurve.map((p) => Math.abs(p.drawdown)));
  const maxDDRange = maxDD || 1;
  const first = equityCurve[0]!;
  const last = equityCurve[equityCurve.length - 1]!;

  // Sample points
  const sampleCount = Math.min(80, equityCurve.length);
  const step = Math.max(1, Math.floor(equityCurve.length / sampleCount));
  const samples = [];
  for (let i = 0; i < equityCurve.length; i += step) {
    samples.push(equityCurve[i]!);
  }
  if (samples[samples.length - 1] !== last) {
    samples.push(last);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-neutral-500">水下曲线</div>
        <div className="text-sm font-mono tabular-nums text-loss font-medium">
          最大回撤 -{maxDD.toFixed(2)}%
        </div>
      </div>

      <div className="w-full h-32 bg-surface/50 rounded-lg p-2">
        <svg
          viewBox={`0 0 ${samples.length - 1} 100`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Zero line */}
          <line
            x1="0"
            y1="0"
            x2={samples.length - 1}
            y2="0"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
          {/* Area fill */}
          <path
            d={`M0,0 ${samples
              .map(
                (p, i) =>
                  `L${i},${(Math.abs(p.drawdown) / maxDDRange) * 100}`,
              )
              .join(" ")} L${samples.length - 1},0 Z`}
            fill="url(#dd-fill)"
          />
          {/* Line */}
          <polyline
            points={samples
              .map(
                (p, i) =>
                  `${i},${(Math.abs(p.drawdown) / maxDDRange) * 100}`,
              )
              .join(" ")}
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-neutral-600 font-mono tabular-nums">
        <span>{first.date}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
