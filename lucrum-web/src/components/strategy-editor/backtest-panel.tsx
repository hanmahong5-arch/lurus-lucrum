/**
 * Backtest Panel Component - Professional Fintech Terminal Style
 * 回测面板组件 - 专业金融终端风格
 *
 * Features:
 * - Glass morphism design with backdrop blur
 * - Tabular numbers for all financial data
 * - Profit/Loss color coding with pulse effects
 * - Terminal-style header with status indicators
 * - Professional metric cards with glow effects
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAsyncTask } from "@/hooks/use-async-task";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { parseApiError, toAppError } from "@/lib/errors/error-types";
import type { AppError, RecoveryAction } from "@/lib/errors/error-types";
import { KLineChart, type TradeMarkerInfo } from "@/components/charts/kline-chart";
import { EnhancedTradeCard } from "./enhanced-trade-card";
import { TradeTableView } from "./trade-table-view";
import { BacktestBasisPanel } from "./backtest-basis-panel";
import type { BacktestResult, DetailedTrade, BacktestTarget } from "@/lib/backtest/types";
import { TargetSelector } from "@/components/backtest/target-selector";
import { DataSourceBadge, mapDataSourceString, type DataSourceType } from "@/components/ui/data-source-badge";
import { SimulatedDataBanner } from "@/components/ui/simulated-data-banner";
import { ScoreCard } from "@/components/backtest/score-card";
import { PreCheckPanel, usePreCheckConditions } from "@/components/backtest/pre-check-panel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateScore } from "@/lib/backtest/score";
import { useFeatureUsage } from "@/hooks/use-feature-usage";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { SmartTooltip } from "@/components/ui/smart-tooltip";
import { ContextualHelp, CONTEXTUAL_HELP_CONTENT } from "@/components/ui/contextual-help";
import { BacktestDecisionBadges } from "@/components/ui/decision-badge";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

// Note: BacktestResult is now imported from @/lib/backtest/types
// This includes all fields needed for the enhanced UX (Phase 1):
// - backtestMeta for transparency
// - config, executionTime, etc.

interface BacktestConfig {
  symbol: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  startDate: string;
  endDate: string;
  timeframe: "1d" | "1w" | "60m" | "30m" | "15m" | "5m" | "1m";
  // A-share rules
  enableT1: boolean;
  enableCircuitBreaker: boolean;
  stampDuty: number;
  // Walk-forward
  wfSplitRatio: 0 | 0.7 | 0.8;
}

/**
 * Data source info from API response
 * API响应中的数据源信息
 */
interface DataSourceInfo {
  type: "real" | "simulated" | "mixed";
  provider: string;
  reason: string;
  fallbackUsed: boolean;
  realDataCount: number;
  simulatedDataCount: number;
  /** Database coverage rate / 数据库覆盖率 */
  dbCoverage?: number;
  /** Stock name from database / 数据库中的股票名称 */
  stockName?: string;
}

interface BacktestPanelProps {
  strategyCode: string;
  result?: BacktestResult;
  isRunning?: boolean;
  onRunBacktest?: (config: BacktestConfig) => Promise<void>;
  /** Callback when backtest starts / 回测开始时的回调 */
  onBacktestStart?: () => void;
  /** Callback when backtest ends / 回测结束时的回调 */
  onBacktestEnd?: () => void;
  /** Callback with result data when backtest completes successfully */
  onResult?: (result: BacktestResult) => void;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

const TIMEFRAME_OPTIONS = [
  { value: "1m", label: "1分钟", labelEn: "1min" },
  { value: "5m", label: "5分钟", labelEn: "5min" },
  { value: "15m", label: "15分钟", labelEn: "15min" },
  { value: "30m", label: "30分钟", labelEn: "30min" },
  { value: "60m", label: "1小时", labelEn: "1hour" },
  { value: "1d", label: "日线", labelEn: "Daily" },
  { value: "1w", label: "周线", labelEn: "Weekly" },
] as const;

// Primary timeframes shown as 3-segment button group
const PRIMARY_TIMEFRAMES = [
  { value: "1d" as const, label: "日K" },
  { value: "1w" as const, label: "周K" },
  { value: "60m" as const, label: "时K" },
] as const;

const PRESET_PERIODS = [
  { label: "1个月", days: 30 },
  { label: "3个月", days: 90 },
  { label: "6个月", days: 180 },
  { label: "1年", days: 365 },
  { label: "2年", days: 730 },
  { label: "3年", days: 1095 },
] as const;

// Date range quick-select chips (approximate)
const DATE_RANGE_CHIPS = [
  { label: "近1年", days: 365 },
  { label: "近3年", days: 1095 },
  { label: "近5年", days: 1825 },
] as const;

// Capital quick-select buttons
const CAPITAL_PRESETS = [
  { label: "10万", value: 100000 },
  { label: "50万", value: 500000 },
  { label: "100万", value: 1000000 },
  { label: "300万", value: 3000000 },
] as const;

// Commission quick-select
const COMMISSION_PRESETS = [
  { label: "低0.015%", value: 0.00015 },
  { label: "标准0.03%", value: 0.0003 },
  { label: "高0.1%", value: 0.001 },
] as const;

// Slippage quick-select
const SLIPPAGE_PRESETS = [
  { label: "无", value: 0 },
  { label: "低0.05%", value: 0.0005 },
  { label: "中0.1%", value: 0.001 },
  { label: "高0.2%", value: 0.002 },
] as const;

// Walk-forward split options
const WFO_OPTIONS = [
  { label: "全量", value: 0 as const },
  { label: "80/20", value: 0.8 as const },
  { label: "70/30", value: 0.7 as const },
] as const;

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Map DataSourceInfo object to badge type.
 * Uses shared mapDataSourceString for provider-level mapping,
 * with type-level shortcuts for "real" and "simulated".
 */
function mapDataSourceType(info: DataSourceInfo): DataSourceType {
  if (info.type === "real") return "db";
  if (info.type === "simulated") return "simulated";
  return mapDataSourceString(info.provider);
}

function getDefaultDates(days: number = 365): {
  startDate: string;
  endDate: string;
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split("T")[0] ?? "",
    endDate: endDate.toISOString().split("T")[0] ?? "",
  };
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN");
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function BacktestPanel({
  strategyCode,
  result: externalResult,
  isRunning: externalIsRunning = false,
  onRunBacktest,
  onBacktestStart,
  onBacktestEnd,
  onResult,
}: BacktestPanelProps) {
  // Config state
  const defaultDates = getDefaultDates(365);
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: "",
    initialCapital: 100000,
    commission: 0.0003,
    slippage: 0.001,
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    timeframe: "1d",
    enableT1: true,
    enableCircuitBreaker: true,
    stampDuty: 0.0005,
    wfSplitRatio: 0,
  });

  // Target selector state
  const [backtestTarget, setBacktestTarget] = useState<BacktestTarget>({ mode: "stock" });

  // Derive symbol from target selection
  const effectiveSymbol = useMemo(() => {
    if (backtestTarget.mode === "stock" && backtestTarget.stock?.symbol) {
      return backtestTarget.stock.symbol;
    }
    if (backtestTarget.mode === "sector" && backtestTarget.sector?.code) {
      return backtestTarget.sector.code;
    }
    return ""; // No default - user must select a stock
  }, [backtestTarget]);

  // Data range state (fetched from DB when stock is selected)
  const [dateRange, setDateRange] = useState<{
    minDate: string;
    maxDate: string;
    dataPoints: number;
  } | null>(null);

  // Fetch date range when stock selection changes
  useEffect(() => {
    if (!effectiveSymbol || backtestTarget.mode !== "stock") {
      setDateRange(null);
      return;
    }

    let cancelled = false;
    const fetchRange = async () => {
      try {
        const res = await fetch(
          `/api/stocks/date-range?symbol=${encodeURIComponent(effectiveSymbol)}`,
        );
        const data = await res.json();
        if (!cancelled && data.success && data.data) {
          setDateRange(data.data);
          // Auto-constrain dates to available range
          setConfig((prev) => ({
            ...prev,
            startDate:
              prev.startDate < data.data.minDate
                ? data.data.minDate
                : prev.startDate,
            endDate:
              prev.endDate > data.data.maxDate
                ? data.data.maxDate
                : prev.endDate,
          }));
        } else if (!cancelled) {
          setDateRange(null);
        }
      } catch {
        if (!cancelled) setDateRange(null);
      }
    };
    fetchRange();
    return () => {
      cancelled = true;
    };
  }, [effectiveSymbol, backtestTarget.mode]);

  // Usage tracking
  const { usage, plan, refresh: refreshUsage, isBlocked, getRemaining } = useFeatureUsage();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeVariant, setUpgradeVariant] = useState<"limit" | "aha" | "upsell">("limit");
  const [ahaSharpRatio, setAhaSharpRatio] = useState(0);

  // UI state
  const [showConfig, setShowConfig] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const [tradeView, setTradeView] = useState<"card" | "table">("card");
  const [showKlineChart, setShowKlineChart] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [dataSourceInfo, setDataSourceInfo] = useState<DataSourceInfo | null>(null);
  const backtestTask = useAsyncTask();
  const router = useRouter();

  const displayResult = externalResult ?? result;
  const running = externalIsRunning || isRunning;

  // PreCheck: evaluate prerequisite conditions
  const preCheckItems = usePreCheckConditions({
    strategyCode,
    symbol: effectiveSymbol,
    startDate: config.startDate,
    endDate: config.endDate,
    initialCapital: config.initialCapital,
  });
  const hasBlocker = preCheckItems.some((item) => item.status === "block");
  const allReady = preCheckItems.every((item) => item.status === "ready");

  // Refs for focus-field navigation
  const targetSelectorRef = useRef<HTMLDivElement>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);
  const capitalRef = useRef<HTMLInputElement>(null);

  const handleFocusField = useCallback((field: string) => {
    switch (field) {
      case "strategy":
        // Strategy input is in parent component; open config and scroll up
        setShowConfig(true);
        break;
      case "target":
        setShowConfig(true);
        requestAnimationFrame(() => targetSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
        break;
      case "dateRange":
        setShowConfig(true);
        requestAnimationFrame(() => dateRangeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
        break;
      case "capital":
        setShowConfig(true);
        requestAnimationFrame(() => capitalRef.current?.focus());
        break;
    }
  }, []);

  // ScoreCard: compute strategy score from backtest result
  const scoreCardRef = useRef<HTMLDivElement>(null);
  const strategyScore = useMemo(() => {
    if (!displayResult) return null;
    try {
      return calculateScore({
        startDate: displayResult.config.startDate,
        endDate: displayResult.config.endDate,
        tradingDays: displayResult.backtestMeta?.timeRange?.tradingDays ?? 0,
        executionTime: displayResult.executionTime,
        initialCapital: displayResult.config.initialCapital,
        finalCapital: displayResult.finalCapital,
        peakCapital: displayResult.peakCapital,
        troughCapital: displayResult.troughCapital,
        totalReturn: displayResult.totalReturn,
        annualizedReturn: displayResult.annualizedReturn,
        monthlyReturn: displayResult.monthlyReturn,
        dailyReturn: displayResult.dailyReturn,
        maxDrawdown: displayResult.maxDrawdown,
        maxDrawdownDuration: displayResult.maxDrawdownDuration,
        volatility: displayResult.volatility,
        sharpeRatio: displayResult.sharpeRatio,
        sortinoRatio: displayResult.sortinoRatio,
        calmarRatio: displayResult.calmarRatio,
        totalTrades: displayResult.totalTrades,
        winningTrades: displayResult.winningTrades,
        losingTrades: displayResult.losingTrades,
        winRate: displayResult.winRate,
        profitFactor: displayResult.profitFactor,
        avgWin: displayResult.avgWin,
        avgLoss: displayResult.avgLoss,
        avgWinLossRatio: displayResult.avgWinLossRatio,
        maxConsecutiveWins: displayResult.maxConsecutiveWins,
        maxConsecutiveLosses: displayResult.maxConsecutiveLosses,
        avgHoldingPeriod: displayResult.avgHoldingPeriod,
        maxSingleWin: displayResult.maxSingleWin,
        maxSingleWinDate: "",
        maxSingleLoss: displayResult.maxSingleLoss,
        maxSingleLossDate: "",
        totalCommission: 0,
        totalSlippage: 0,
        totalTradingCost: 0,
        tradingCostPercent: 0,
      });
    } catch {
      return null;
    }
  }, [displayResult]);

  // Auto-focus ScoreCard when backtest completes
  useEffect(() => {
    if (strategyScore && scoreCardRef.current) {
      scoreCardRef.current.focus();
    }
  }, [strategyScore]);

  /**
   * Set date range from preset
   */
  const setPresetPeriod = (days: number) => {
    const dates = getDefaultDates(days);
    setConfig((prev) => ({
      ...prev,
      startDate: dates.startDate,
      endDate: dates.endDate,
    }));
  };

  /**
   * Run backtest
   */
  const handleRunBacktest = useCallback(async () => {
    // Guard: PreCheckPanel's hasBlocker disables the button, but defend against programmatic calls
    if (hasBlocker) return;

    // Quota check (client-side pre-flight)
    if (isBlocked("backtest")) {
      setUpgradeVariant("limit");
      setUpgradeDialogOpen(true);
      return;
    }

    setIsRunning(true);
    setError(null);
    onBacktestStart?.();
    backtestTask.registerTask({
      type: 'backtest',
      title: `回测 — ${effectiveSymbol || '未知标的'}`,
    });

    try {
      if (onRunBacktest) {
        await onRunBacktest(config);
      } else {
        // Call API directly
        const response = await fetch("/api/backtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategyCode,
            config: {
              ...config,
              symbol: effectiveSymbol,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setResult(data.data);
            onResult?.(data.data);
            backtestTask.complete({ symbol: effectiveSymbol });
            // Store data source info from API response
            if (data.meta?.dataSource) {
              setDataSourceInfo(data.meta.dataSource);
            }

            // Aha moment: Sharpe > 1.5 and free plan
            const sharpe = data.data.sharpeRatio ?? data.data.riskMetrics?.sharpeRatio ?? 0;
            if (sharpe > 1.5 && plan === "free") {
              setAhaSharpRatio(sharpe);
              setUpgradeVariant("aha");
              setUpgradeDialogOpen(true);
            }
          } else {
            // 200 OK but unsuccessful payload — degrade gracefully into a
            // structured error so the user gets a retry button.
            const description = data.error?.message ?? data.error?.description ?? "回测失败 / Backtest failed";
            setError({
              code: data.error?.code ?? "BACKTEST_FAILED",
              title: "回测失败",
              description,
              severity: "error",
              recoveryActions: [
                { type: "retry", label: "重试" },
                { type: "custom", label: "调整参数" },
              ],
            });
            backtestTask.fail(description);
          }
        } else if (response.status === 429) {
          // Peek the body to differentiate rate-limit (transient, just wait)
          // from quota-exceeded (needs upgrade dialog).
          const cloned = response.clone();
          let errorCode: string | undefined;
          try {
            const body = await cloned.json();
            errorCode = body?.error?.code;
          } catch {
            // ignore parse errors
          }
          if (errorCode === 'RATE_LIMITED' || errorCode === 'CONCURRENCY_LIMIT') {
            // parseApiError already handles 429 with Retry-After header
            // and emits a warning-severity AppError with dismiss action.
            const appErr = await parseApiError(response, errorCode);
            setError(appErr);
            backtestTask.fail(appErr.description);
          } else {
            // Quota exceeded — keep existing upgrade-dialog flow (paywall UX
            // is already first-class and lives outside the ErrorCard system).
            setUpgradeVariant("limit");
            setUpgradeDialogOpen(true);
            backtestTask.fail('配额超限');
          }
        } else {
          // Server-side failure (4xx / 5xx) — backtest API speaks the
          // canonical error envelope, so parseApiError pulls
          // {code, title, description, recoveryActions} directly.
          const appErr = await parseApiError(response, "BACKTEST_FAILED");
          setError(appErr);
          backtestTask.fail(appErr.description);
        }
      }
    } catch (err) {
      // Network-level / unexpected throw.
      const errMsg = err instanceof Error ? err.message : "回测出错 / Backtest error";
      const isTimeout = /timeout/i.test(errMsg);
      const isNetwork = /fetch|network/i.test(errMsg);
      const appErr = toAppError(err, "BACKTEST_NETWORK");
      const next: AppError = {
        ...appErr,
        title: isTimeout
          ? "回测请求超时"
          : isNetwork
            ? "网络连接失败"
            : "回测出错",
        description: isTimeout
          ? "回测耗时较长，请缩短时间范围或重试。"
          : isNetwork
            ? "无法连接到回测服务，请检查网络后重试。"
            : errMsg,
        severity: "error",
        recoveryActions: [
          { type: "retry", label: "重试" },
          { type: "custom", label: "调整参数" },
        ],
      };
      setError(next);
      backtestTask.fail(next.description);
    } finally {
      setIsRunning(false);
      onBacktestEnd?.();
      // Refresh usage data after backtest
      void refreshUsage();
    }
  }, [hasBlocker, isBlocked, plan, strategyCode, config, effectiveSymbol, onRunBacktest, onBacktestStart, onBacktestEnd, onResult, refreshUsage]);

  /**
   * Export backtest report
   */
  const handleExport = () => {
    if (!displayResult) return;

    const report = {
      generatedAt: new Date().toISOString(),
      platform: "Lucrum AI Trading",
      config,
      strategy: displayResult.strategy,
      results: {
        totalReturn: displayResult.totalReturn,
        annualizedReturn: displayResult.annualizedReturn,
        maxDrawdown: displayResult.maxDrawdown,
        sharpeRatio: displayResult.sharpeRatio,
        sortinoRatio: displayResult.sortinoRatio,
        winRate: displayResult.winRate,
        totalTrades: displayResult.totalTrades,
        profitFactor: displayResult.profitFactor,
        avgWin: displayResult.avgWin,
        avgLoss: displayResult.avgLoss,
        maxSingleWin: displayResult.maxSingleWin,
        maxSingleLoss: displayResult.maxSingleLoss,
      },
      trades: displayResult.trades,
      equityCurve: displayResult.equityCurve,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-full">
      {/* Terminal-style Header / 终端风格头部 */}
      <div className="terminal-header flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Traffic lights / 交通灯 */}
          <div className="flex items-center gap-1.5">
            <div className="dot dot-red" />
            <div className="dot dot-yellow" />
            <div className="dot dot-green" />
          </div>
          {/* Title / 标题 */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-medium text-neutral-200">
              回测结果
            </span>
            <span className="text-xs text-neutral-500">Backtest Results</span>
          </div>
          {/* Status indicator / 状态指示器 */}
          {running && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              <span className="text-[10px] text-accent font-mono">RUNNING</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className={cn(
              "text-neutral-400 hover:text-neutral-200 text-xs gap-1.5",
              showConfig && "text-primary bg-primary/10"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            设置
          </Button>
          <DisabledWithReason
            disabled={hasBlocker && !running}
            reason={
              !strategyCode
                ? "请先生成策略代码"
                : !effectiveSymbol
                  ? "请先选择一只股票"
                  : "请先完成所有必要配置"
            }
            action={
              !strategyCode
                ? "去模板库选择"
                : !effectiveSymbol
                  ? "在上方搜索框输入股票代码"
                  : undefined
            }
          >
            <button
              onClick={handleRunBacktest}
              disabled={running || hasBlocker}
              className={cn(
                "btn-primary px-4 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary",
                allReady && !running && "glow-active"
              )}
            >
              {running ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-mono">运行中...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  运行回测
                  {usage.backtest && isFinite(usage.backtest.limit) && (
                    <span className="font-mono text-xs opacity-70">
                      {usage.backtest.remaining}/{usage.backtest.limit}
                    </span>
                  )}
                </>
              )}
            </button>
          </DisabledWithReason>
        </div>
      </div>

      {/* Simulated Data Warning Banner */}
      <SimulatedDataBanner
        visible={dataSourceInfo?.type === "simulated"}
        onSwitchToReal={() => setShowConfig(true)}
      />

      {/* PreCheck Panel / 前置条件检查面板 */}
      {!displayResult && (
        <PreCheckPanel
          items={preCheckItems}
          onFocusField={handleFocusField}
          className="mx-4 mt-3"
        />
      )}

      {/* Config Panel / 配置面板 */}
      {showConfig && (
        <div className="p-4 bg-void/50 border-b border-white/5 space-y-4">
          {/* Target Selector / 标的选择 */}
          <div ref={targetSelectorRef}>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              回测标的
              <span className="text-neutral-600 ml-1">Target</span>
              {effectiveSymbol && (
                <>
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-profit/20 text-profit rounded">
                    {effectiveSymbol}
                  </span>
                  {dataSourceInfo && (
                    <DataSourceBadge
                      type={mapDataSourceType(dataSourceInfo)}
                      detail={dataSourceInfo.reason}
                      className="ml-1.5"
                    />
                  )}
                </>
              )}
              {!effectiveSymbol && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                  未选择
                </span>
              )}
            </label>
            <TargetSelector
              value={backtestTarget}
              onChange={setBacktestTarget}
              className="bg-surface/50 rounded-lg border border-white/5 p-3"
            />
            {/* Data range display */}
            {dateRange && (
              <div className="mt-2 px-3 py-1.5 bg-source-db/10 rounded-md flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-source-db shrink-0" />
                <span className="text-source-db font-medium">
                  数据范围: {dateRange.minDate} ~ {dateRange.maxDate}
                </span>
                <span className="text-neutral-500">
                  ({dateRange.dataPoints.toLocaleString()} 条)
                </span>
              </div>
            )}
          </div>

          {/* Timeframe — 3-segment button group / 时间颗粒度三段按钮组 */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              时间颗粒度
              <span className="text-neutral-600 ml-1">Timeframe</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PRIMARY_TIMEFRAMES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, timeframe: opt.value }))}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile border",
                    config.timeframe === opt.value
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-surface border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10",
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {/* More timeframes dropdown */}
              {!PRIMARY_TIMEFRAMES.some((t) => t.value === config.timeframe) && (
                <span className="px-2 py-1 text-xs bg-primary/20 border border-primary/50 text-primary rounded-lg font-mono">
                  {TIMEFRAME_OPTIONS.find((t) => t.value === config.timeframe)?.label ?? config.timeframe}
                </span>
              )}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setConfig((prev) => ({ ...prev, timeframe: e.target.value as BacktestConfig["timeframe"] }));
                  }
                }}
                className="px-2 py-1 text-xs bg-surface border border-white/5 rounded-lg text-neutral-500 hover:border-white/10 focus:outline-none cursor-pointer"
              >
                <option value="">更多...</option>
                {TIMEFRAME_OPTIONS.filter((t) => !PRIMARY_TIMEFRAMES.some((p) => p.value === t.value)).map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-surface-dark">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Initial Capital — button group / 初始资金按钮组 */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              初始资金
              <span className="text-neutral-600 ml-1">Capital</span>
              <span className="ml-2 text-primary font-mono tabular-nums text-[10px]">
                ¥{config.initialCapital.toLocaleString()}
              </span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {CAPITAL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, initialCapital: preset.value }))}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile border",
                    config.initialCapital === preset.value
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-surface border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10",
                  )}
                >
                  {preset.label}
                </button>
              ))}
              {/* Custom input */}
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">¥</span>
                <input
                  ref={capitalRef}
                  type="number"
                  placeholder="自定义"
                  value={CAPITAL_PRESETS.some((p) => p.value === config.initialCapital) ? "" : config.initialCapital}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v > 0) setConfig((prev) => ({ ...prev, initialCapital: v }));
                  }}
                  className="w-24 pl-5 pr-2 py-1.5 bg-surface border border-white/5 rounded-lg text-neutral-200 text-xs font-mono tabular-nums focus:outline-none focus:border-primary/50 transition-colors placeholder:text-neutral-600"
                />
              </div>
            </div>
          </div>

          {/* Date Range / 回测区间 */}
          <div ref={dateRangeRef}>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">
              回测区间
              <span className="text-neutral-600 ml-1">Date Range</span>
            </label>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DATE_RANGE_CHIPS.map((chip) => (
                <button
                  key={chip.days}
                  type="button"
                  onClick={() => setPresetPeriod(chip.days)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10 transition-all btn-tactile"
                >
                  {chip.label}
                </button>
              ))}
              {dateRange && (
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, startDate: dateRange.minDate, endDate: dateRange.maxDate }))}
                  className="px-2.5 py-1 text-xs rounded-lg bg-source-db/10 border border-source-db/20 text-source-db hover:bg-source-db/20 transition-all btn-tactile"
                >
                  全部
                </button>
              )}
              {/* Existing presets as smaller chips */}
              {PRESET_PERIODS.slice(0, 3).map((period) => (
                <button
                  key={period.days}
                  type="button"
                  onClick={() => setPresetPeriod(period.days)}
                  className="px-2.5 py-1 text-xs rounded-md bg-surface hover:bg-surface-hover text-neutral-500 hover:text-neutral-300 border border-white/5 hover:border-white/10 transition-all btn-tactile"
                >
                  {period.label}
                </button>
              ))}
            </div>
            {/* Custom date range (collapsible) */}
            <details className="group">
              <summary className="text-[10px] text-neutral-600 cursor-pointer hover:text-neutral-400 flex items-center gap-1 transition-colors">
                <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                自定义区间 ({config.startDate} ~ {config.endDate})
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <input
                  type="date"
                  value={config.startDate}
                  min={dateRange?.minDate}
                  max={dateRange?.maxDate}
                  onChange={(e) => setConfig((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="px-3 py-2 bg-surface border border-white/10 rounded-lg text-neutral-200 text-sm font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                <input
                  type="date"
                  value={config.endDate}
                  min={dateRange?.minDate}
                  max={dateRange?.maxDate}
                  onChange={(e) => setConfig((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="px-3 py-2 bg-surface border border-white/10 rounded-lg text-neutral-200 text-sm font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </details>
          </div>

          {/* Advanced Settings / 高级设置 */}
          <details className="text-xs group">
            <summary className="text-neutral-500 cursor-pointer hover:text-neutral-300 flex items-center gap-1.5 transition-colors">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              高级设置 / Advanced
            </summary>
            <div className="mt-3 pt-3 border-t border-white/5 space-y-3">

              {/* Commission / 手续费率 */}
              <div>
                <label className="block text-neutral-500 mb-1.5">手续费率</label>
                <div className="flex gap-1.5 flex-wrap">
                  {COMMISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, commission: preset.value }))}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all btn-tactile border",
                        config.commission === preset.value
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-surface border-white/5 text-neutral-500 hover:text-neutral-300",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slippage / 滑点率 */}
              <div>
                <label className="block text-neutral-500 mb-1.5">滑点率</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SLIPPAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, slippage: preset.value }))}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all btn-tactile border",
                        config.slippage === preset.value
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-surface border-white/5 text-neutral-500 hover:text-neutral-300",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* A-share rules / A股规则 */}
              <div>
                <label className="block text-neutral-500 mb-1.5">A股规则</label>
                <div className="flex flex-col gap-2">
                  {/* T+1 toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">T+1 限制（买入当天不可卖出）</span>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, enableT1: !prev.enableT1 }))}
                      className={cn(
                        "relative w-9 h-5 rounded-full transition-colors",
                        config.enableT1 ? "bg-primary/60" : "bg-surface-hover",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                          config.enableT1 ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                  {/* Circuit breaker toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">涨跌停限制（±10%成交失败）</span>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, enableCircuitBreaker: !prev.enableCircuitBreaker }))}
                      className={cn(
                        "relative w-9 h-5 rounded-full transition-colors",
                        config.enableCircuitBreaker ? "bg-primary/60" : "bg-surface-hover",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                          config.enableCircuitBreaker ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                  {/* Stamp duty — fixed display */}
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">印花税（仅卖出）</span>
                    <span className="px-2 py-0.5 text-[10px] rounded bg-surface border border-white/5 text-neutral-400 font-mono">
                      0.05%（固定）
                    </span>
                  </div>
                </div>
              </div>

              {/* Walk-Forward / 样本分割 */}
              <div>
                <label className="block text-neutral-500 mb-1.5">样本分割 (Walk-Forward)</label>
                <div className="flex gap-1.5">
                  {WFO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, wfSplitRatio: opt.value }))}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all btn-tactile border",
                        config.wfSplitRatio === opt.value
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-surface border-white/5 text-neutral-500 hover:text-neutral-300",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Error — backtest API emits structured BT-codes (BT201/etc) with
          recoveryActions like 调整参数 / 升级套餐; ErrorCard renders them
          with retry + navigate semantics so the user gets one click out. */}
      {error && (
        <div className="px-4 py-3 border-b border-loss/30">
          <ErrorCard
            error={error}
            onAction={(action: RecoveryAction) => {
              if (action.type === "retry") {
                setError(null);
                void handleRunBacktest();
                return;
              }
              if (action.type === "navigate" && action.href) {
                router.push(action.href);
                return;
              }
              // dismiss / custom — banner advisory, user adjusts the form.
              setError(null);
            }}
          />
        </div>
      )}

      {/* Results / 结果区域 */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {running ? (
          <div className="py-12 flex flex-col items-center justify-center">
            {/* Loading animation / 加载动画 */}
            <div className="relative w-16 h-16 mb-6">
              {/* Outer ring */}
              <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
              {/* Spinning ring */}
              <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin" />
              {/* Inner pulse */}
              <div className="absolute inset-3 bg-primary/10 rounded-full animate-pulse" />
              {/* Center dot */}
              <div className="absolute inset-[26px] bg-primary rounded-full" />
            </div>
            <span className="text-neutral-300 font-medium mb-1">正在运行回测...</span>
            <span className="text-xs text-neutral-500 font-mono tabular-nums">
              处理 {config.startDate} 至 {config.endDate} 的数据
            </span>
            {/* Progress bar */}
            <div className="w-48 h-1 mt-4 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/50 via-primary to-primary/50 animate-data-stream"
                style={{ width: "200%", marginLeft: "-100%" }}
              />
            </div>
          </div>
        ) : displayResult ? (
          <>
            {/* Strategy Info / 策略信息 */}
            {displayResult.strategy && (
              <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-primary">
                        {displayResult.strategy.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {displayResult.strategy.indicators.map((ind, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[10px] bg-surface rounded font-mono text-neutral-400">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 font-mono tabular-nums text-right">
                    {Object.entries(displayResult.strategy.params)
                      .slice(0, 3)
                      .map(([k, v]) => (
                        <div key={k}>
                          <span className="text-neutral-600">{k}=</span>
                          <span className="text-neutral-400">{v}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Backtest Basis Panel - Show data source and configuration transparency */}
            <BacktestBasisPanel
              result={displayResult}
              dataSourceInfo={dataSourceInfo}
              className="mb-4"
            />

            {/* Strategy ScoreCard - Primary result display */}
            {strategyScore && (
              <ScoreCard
                ref={scoreCardRef}
                score={strategyScore}
                variant="full"
                onExpandDetails={() => {
                  // Scroll to detailed metrics below
                  const metricsGrid = document.querySelector("[data-metrics-grid]");
                  metricsGrid?.scrollIntoView({ behavior: "smooth" });
                }}
                onExport={handleExport}
                className="mb-2"
              />
            )}

            {/* Decision badges - auto-computed from metrics */}
            {displayResult && (
              <BacktestDecisionBadges
                metrics={{
                  annualizedReturn: displayResult.annualizedReturn,
                  maxDrawdown: displayResult.maxDrawdown,
                  winRate: displayResult.winRate,
                  sharpeRatio: displayResult.sharpeRatio,
                  tradeCount: displayResult.totalTrades,
                }}
                className="mb-4"
              />
            )}

            {/* Main Metrics Grid / 核心指标网格 */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-metrics-grid>
              <MetricCard
                label="总收益率"
                labelEn="Total Return"
                tooltipTerm="totalReturn"
                value={`${displayResult.totalReturn >= 0 ? "+" : ""}${displayResult.totalReturn.toFixed(2)}%`}
                isProfit={displayResult.totalReturn >= 0}
                highlight
                size="large"
              />
              <MetricCard
                label="年化收益"
                labelEn="Annualized"
                tooltipTerm="annualReturn"
                value={`${displayResult.annualizedReturn >= 0 ? "+" : ""}${displayResult.annualizedReturn.toFixed(1)}%`}
                isProfit={displayResult.annualizedReturn >= 0}
              />
              <MetricCard
                label="最大回撤"
                labelEn="Max Drawdown"
                tooltipTerm="maxDrawdown"
                value={`-${Math.abs(displayResult.maxDrawdown).toFixed(1)}%`}
                isProfit={false}
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                }
              />
              <MetricCard
                label="夏普比率"
                labelEn="Sharpe Ratio"
                tooltipTerm="sharpe"
                value={displayResult.sharpeRatio.toFixed(2)}
                isProfit={displayResult.sharpeRatio >= 1}
                neutral={displayResult.sharpeRatio < 1 && displayResult.sharpeRatio > 0}
              />
              <MetricCard
                label="胜率"
                labelEn="Win Rate"
                tooltipTerm="winRate"
                value={`${displayResult.winRate.toFixed(1)}%`}
                isProfit={displayResult.winRate >= 50}
              />
              <MetricCard
                label="交易次数"
                labelEn="Total Trades"
                tooltipTerm="tradeCount"
                value={displayResult.totalTrades.toString()}
                neutral
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                }
              />
            </div>

            {/* Detailed Stats / 详细统计 */}
            {showDetails && (
              <div className="mt-4 p-4 bg-surface/50 rounded-lg border border-white/5">
                <h4 className="text-sm font-medium text-neutral-200 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  详细统计
                  <span className="text-neutral-600 text-xs font-normal">Detailed Stats</span>
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <StatRow label="盈利因子" value={(displayResult.profitFactor ?? 0).toFixed(2)} neutral />
                  <StatRow label="索提诺比率" value={(displayResult.sortinoRatio ?? 0).toFixed(2)} neutral />
                  <StatRow label="平均盈利" value={`+${(displayResult.avgWin ?? 0).toFixed(2)}%`} profit />
                  <StatRow label="平均亏损" value={`-${(displayResult.avgLoss ?? 0).toFixed(2)}%`} loss />
                  <StatRow label="最大连胜" value={`${displayResult.maxConsecutiveWins ?? 0}次`} profit />
                  <StatRow label="最大连亏" value={`${displayResult.maxConsecutiveLosses ?? 0}次`} loss />
                  <StatRow label="最大单笔盈利" value={`+${(displayResult.maxSingleWin ?? 0).toFixed(2)}%`} profit />
                  <StatRow label="最大单笔亏损" value={`${(displayResult.maxSingleLoss ?? 0).toFixed(2)}%`} loss />
                  <StatRow label="平均持仓时间" value={`${(displayResult.avgHoldingPeriod ?? 0).toFixed(1)}天`} neutral />
                </div>
              </div>
            )}

            {/* Trade List - Enhanced with detailed information / 交易记录 */}
            {showTrades &&
              displayResult.trades &&
              displayResult.trades.length > 0 && (
                <div className="mt-4 p-4 bg-surface/50 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
                      <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      交易记录
                      <span className="text-neutral-600 text-xs font-normal">Trade History</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      {/* Adjustment type badge */}
                      <span className="px-1.5 py-0.5 text-[10px] bg-surface rounded border border-white/5 text-neutral-400 font-mono">
                        前复权
                      </span>
                      {/* Total count */}
                      <span className="px-2 py-0.5 text-[10px] bg-surface rounded-full text-neutral-500 font-mono">
                        共 {displayResult.trades.length} 笔
                      </span>
                      {/* View toggle: card / table */}
                      <div className="flex items-center rounded bg-surface border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setTradeView("card")}
                          className={cn(
                            "px-2 py-1 text-[10px] transition-colors",
                            tradeView === "card"
                              ? "bg-white/10 text-neutral-200"
                              : "text-neutral-500 hover:text-neutral-300"
                          )}
                          aria-label="卡片视图"
                          title="卡片视图"
                        >
                          ⊞
                        </button>
                        <button
                          onClick={() => setTradeView("table")}
                          className={cn(
                            "px-2 py-1 text-[10px] transition-colors",
                            tradeView === "table"
                              ? "bg-white/10 text-neutral-200"
                              : "text-neutral-500 hover:text-neutral-300"
                          )}
                          aria-label="表格视图"
                          title="表格视图"
                        >
                          ☰
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto space-y-3">
                    {(() => {
                      try {
                        // Use enhanced trades if available (DetailedTrade[])
                        const tradesToDisplay = displayResult.enhanced?.trades ?? displayResult.trades;

                        // Validate trades array
                        if (!Array.isArray(tradesToDisplay) || tradesToDisplay.length === 0) {
                          return (
                            <div className="text-center text-white/40 py-4">
                              暂无交易记录
                            </div>
                          );
                        }

                        // Table view: use TradeTableView if trades are DetailedTrade
                        if (tradeView === "table" && displayResult.enhanced?.trades) {
                          const dataIncomplete =
                            (displayResult.backtestMeta?.dataQuality?.completeness ?? 1) < 1;
                          return (
                            <TradeTableView
                              trades={displayResult.enhanced.trades}
                              dataIncomplete={dataIncomplete}
                            />
                          );
                        }

                        // Card view: show all trades without limit
                        return tradesToDisplay
                          .slice(0)
                          .filter(trade => trade && typeof trade === "object")
                          .map((trade, index) => {
                            try {
                              // Generate safe key
                              const safeKey = trade.id || `trade-${index}`;

                              // Check if trade has DetailedTrade structure
                              const isDetailedTrade =
                                trade &&
                                typeof trade === "object" &&
                                "triggerReason" in trade &&
                                "indicatorValues" in trade &&
                                "cashBefore" in trade;

                              // If trade has detailed structure, use EnhancedTradeCard
                              if (isDetailedTrade) {
                                return (
                                  <EnhancedTradeCard
                                    key={safeKey}
                                    trade={trade as unknown as DetailedTrade}
                                    onError={(error) => {
                                      console.error("[BacktestPanel] EnhancedTradeCard error:", error);
                                    }}
                                  />
                                );
                              }

                              // Fallback to legacy display for backward compatibility
                              // Validate legacy trade fields
                              const displayPrice = typeof trade.price === "number" && isFinite(trade.price)
                                ? trade.price
                                : 0;
                              const displayQty = typeof trade.size === "number" && isFinite(trade.size)
                                ? trade.size
                                : 0;
                              const unit = "股";
                              const tradeType = trade.type === "buy" || trade.type === "sell" ? trade.type : "buy";
                              const pnlPercent = typeof trade.pnlPercent === "number" && isFinite(trade.pnlPercent)
                                ? trade.pnlPercent
                                : null;
                              const reason = typeof trade.reason === "string" ? trade.reason : null;

                              return (
                                <div
                                  key={safeKey}
                                  className={cn(
                                    "p-2 rounded text-xs",
                                    tradeType === "buy" ? "bg-profit/10" : "bg-loss/10"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "font-medium px-1.5 py-0.5 rounded",
                                          tradeType === "buy"
                                            ? "text-profit bg-profit/20"
                                            : "text-loss bg-loss/20"
                                        )}
                                      >
                                        {tradeType === "buy" ? "买入" : "卖出"}
                                      </span>
                                    </div>
                                    {pnlPercent !== null && (
                                      <span
                                        className={cn(
                                          "font-medium",
                                          pnlPercent >= 0 ? "text-profit" : "text-loss"
                                        )}
                                      >
                                        {pnlPercent >= 0 ? "+" : ""}
                                        {pnlPercent.toFixed(2)}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-white/60">
                                    ¥{displayPrice.toFixed(2)} × {displayQty.toLocaleString()}{unit}
                                    {reason && (
                                      <span className="ml-2 text-white/40">{reason}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            } catch (tradeError) {
                              console.error("[BacktestPanel] Trade render error:", tradeError, trade);
                              return (
                                <div key={`error-${index}`} className="p-2 rounded text-xs bg-error/10 border border-error/20">
                                  <span className="text-error text-xs">交易记录渲染失败</span>
                                </div>
                              );
                            }
                          });
                      } catch (error) {
                        console.error("[BacktestPanel] Trades display error:", error);
                        return (
                          <div className="text-center text-error py-4">
                            交易记录加载失败
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

            {/* Action Buttons / 操作按钮 */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={cn(
                  "flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all btn-tactile",
                  "bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10",
                  showDetails ? "text-primary" : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className={cn("w-4 h-4 transition-transform", showDetails && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showDetails ? "收起详情" : "查看详情"}
                </span>
              </button>
              <button
                onClick={() => setShowTrades(!showTrades)}
                className={cn(
                  "flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all btn-tactile",
                  "bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10",
                  showTrades ? "text-primary" : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  {showTrades ? "隐藏记录" : "交易记录"}
                </span>
              </button>
              <button
                onClick={() => setShowKlineChart(!showKlineChart)}
                className={cn(
                  "flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all btn-tactile",
                  "bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10",
                  showKlineChart ? "text-accent" : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  {showKlineChart ? "隐藏K线" : "K线分析"}
                </span>
              </button>
              <button
                onClick={handleExport}
                className="flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all btn-tactile bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 text-neutral-400 hover:text-neutral-200"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  导出报告
                </span>
              </button>
            </div>

            {/* K-line Chart with Trade Markers / K 线图含买卖标记 */}
            {showKlineChart && effectiveSymbol && (() => {
              // Build trade markers from detailed trades when available
              const detailedTrades = displayResult.enhanced?.trades ?? [];
              const markers: TradeMarkerInfo[] = detailedTrades
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

              // Trade summary stats
              const buyCount = markers.filter((m) => m.type === "buy").length;
              const sellCount = markers.filter((m) => m.type === "sell").length;
              const profitCount = markers.filter(
                (m) => m.type === "sell" && (m.pnl ?? 0) > 0
              ).length;
              const winRate = sellCount > 0 ? ((profitCount / sellCount) * 100).toFixed(1) : "—";

              return (
                <div className="mt-4 p-4 bg-surface/50 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      K 线分析
                    </h4>
                    {markers.length > 0 && (
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        <span className="text-profit">▲ 买入 {buyCount}</span>
                        <span className="text-loss">▼ 卖出 {sellCount}</span>
                        <span className="text-neutral-400">盈利 {profitCount} / 胜率 {winRate}%</span>
                      </div>
                    )}
                  </div>
                  <KLineChart
                    symbol={effectiveSymbol}
                    initialTimeFrame={config.timeframe}
                    tradeMarkers={markers.length > 0 ? markers : undefined}
                    height={400}
                    showVolume={true}
                    showMA={true}
                  />
                </div>
              );
            })()}
          </>
        ) : (
          /* Empty State / 空状态 */
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-surface-hover/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            {!effectiveSymbol ? (
              <>
                <p className="text-amber-400 text-sm mb-1 font-medium">
                  请先选择回测标的
                </p>
                <p className="text-neutral-600 text-xs">
                  Please select a stock target before running backtest
                </p>
              </>
            ) : (
              <>
                <p className="text-neutral-400 text-sm mb-1">
                  点击「运行回测」开始测试策略
                </p>
                <p className="text-neutral-600 text-xs">
                  Click Run Backtest to test your strategy
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pro upsell banner for free users with results */}
      {displayResult && plan === "free" && (
        <div className="mx-4 mb-4 p-3 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-lg flex items-center justify-between">
          <p className="text-xs text-gray-300">
            Pro 版提供 30+ 专业指标、更长历史数据和无限回测次数
          </p>
          <button
            onClick={() => { setUpgradeVariant("upsell"); setUpgradeDialogOpen(true); }}
            className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap ml-3"
          >
            了解更多 →
          </button>
        </div>
      )}

      {/* Upgrade dialog */}
      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        variant={upgradeVariant}
        featureName="backtest"
        used={usage.backtest?.used ?? 0}
        limit={usage.backtest?.limit ?? 0}
        resetAt={usage.backtest?.resetAt}
        sharpeRatio={ahaSharpRatio}
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS / 子组件
// =============================================================================

interface MetricCardProps {
  label: string;
  labelEn: string;
  value: string;
  isProfit?: boolean;
  neutral?: boolean;
  highlight?: boolean;
  size?: "default" | "large";
  icon?: React.ReactNode;
  /** Financial term key for SmartTooltip explanation */
  tooltipTerm?: string;
}

/**
 * Metric Card Component - Professional fintech data display
 * 指标卡片组件 - 专业金融数据展示
 */
function MetricCard({
  label,
  labelEn,
  value,
  isProfit = true,
  neutral = false,
  highlight = false,
  size = "default",
  icon,
  tooltipTerm,
}: MetricCardProps) {
  // Determine value color based on profit/loss state
  const valueColorClass = neutral
    ? "text-neutral-200"
    : isProfit
    ? "text-profit"
    : "text-loss";

  // Determine glow effect based on state
  const glowClass = !neutral && (
    isProfit ? "glow-profit" : "glow-loss"
  );

  return (
    <div
      className={cn(
        "stat-card relative overflow-hidden group",
        highlight && "ring-1 ring-primary/30 bg-primary/5",
        size === "large" && "col-span-1 lg:col-span-1"
      )}
    >
      {/* Background glow effect for highlighted cards */}
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      )}

      {/* Label / 标签 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-neutral-500">
          {tooltipTerm ? (
            <SmartTooltip term={tooltipTerm}>{label}</SmartTooltip>
          ) : (
            label
          )}
          <span className="block text-[10px] text-neutral-600">{labelEn}</span>
        </div>
        {icon && (
          <div className={cn("text-neutral-600 group-hover:text-neutral-400 transition-colors", valueColorClass)}>
            {icon}
          </div>
        )}
      </div>

      {/* Value / 数值 */}
      <div
        className={cn(
          "font-mono tabular-nums font-bold tracking-tight transition-all",
          size === "large" ? "text-2xl" : "text-xl",
          valueColorClass,
          highlight && glowClass
        )}
      >
        {value}
      </div>

      {/* Pulse indicator for profit/loss */}
      {!neutral && (
        <div className={cn(
          "absolute top-3 right-3 w-1.5 h-1.5 rounded-full",
          isProfit ? "bg-profit animate-pulse" : "bg-loss animate-pulse"
        )} />
      )}
    </div>
  );
}

/**
 * Stat Row Component - For detailed statistics display
 * 统计行组件 - 用于详细统计展示
 */
interface StatRowProps {
  label: string;
  value: string;
  profit?: boolean;
  loss?: boolean;
  neutral?: boolean;
}

function StatRow({ label, value, profit, loss, neutral }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-neutral-500 text-xs">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums text-sm font-medium",
          profit && "text-profit",
          loss && "text-loss",
          neutral && "text-neutral-300"
        )}
      >
        {value}
      </span>
    </div>
  );
}
