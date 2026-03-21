"use client";

/**
 * Trading Center - Professional-grade trading dashboard
 *
 * Layout (3-column):
 * - Left (40%): Position list, Order list, Trade history
 * - Center (40%): K-line chart with orderbook
 * - Right (20%): Order panel, Risk settings, Strategy follow
 *
 * Features:
 * - Paper/live trading mode toggle
 * - Lot-based (手) order input with A-share rules
 * - Real-time cost/commission calculation
 * - Pre-order confirmation dialog
 * - Risk management settings
 * - Strategy auto-follow
 * - Integration with Zustand trading store
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useMajorIndices, useNorthBoundFlow } from "@/hooks/use-market-data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import type { SymbolInfo } from "@/components/trading/symbol-selector";
import { computeTradingRiskFactors } from "@/components/trading/risk-indicator";
import { PaperTradingBanner } from "@/components/trading/paper-trading-banner";
import { useTradingStore } from "@/lib/stores/trading-store";
import {
  getTradingStatusInfo,
  formatTimeRemaining,
  getTimeToNextEvent,
  isMarketOpen,
} from "@/lib/trading/time-utils";
import { cn } from "@/lib/utils";
import { ContextualHelp, CONTEXTUAL_HELP_CONTENT } from "@/components/ui/contextual-help";
import { ChartSkeleton, FormSkeleton, TableSkeleton, PanelSkeleton } from "@/components/ui/loading-skeleton";

// ---------------------------------------------------------------------------
// Dynamic imports — split heavy trading components into separate chunks
// ---------------------------------------------------------------------------

const KLineChart = dynamic(
  () => import("@/components/charts/kline-chart").then((m) => ({ default: m.KLineChart })),
  { ssr: false, loading: () => <ChartSkeleton height={520} /> },
);

const SymbolSelector = dynamic(
  () => import("@/components/trading/symbol-selector").then((m) => ({ default: m.SymbolSelector })),
  { ssr: false, loading: () => <FormSkeleton /> },
);

const OrderbookPanel = dynamic(
  () => import("@/components/trading/orderbook-panel").then((m) => ({ default: m.OrderbookPanel })),
  { ssr: false, loading: () => <TableSkeleton rows={5} /> },
);

const OrderPanel = dynamic(
  () => import("@/components/trading/order-panel").then((m) => ({ default: m.OrderPanel })),
  { ssr: false, loading: () => <FormSkeleton /> },
);

const PositionList = dynamic(
  () => import("@/components/trading/position-list").then((m) => ({ default: m.PositionList })),
  { ssr: false, loading: () => <TableSkeleton rows={3} /> },
);

const OrderList = dynamic(
  () => import("@/components/trading/order-list").then((m) => ({ default: m.OrderList })),
  { ssr: false, loading: () => <TableSkeleton rows={3} /> },
);

const RiskSettings = dynamic(
  () => import("@/components/trading/risk-settings").then((m) => ({ default: m.RiskSettings })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

const RiskIndicator = dynamic(
  () => import("@/components/trading/risk-indicator").then((m) => ({ default: m.RiskIndicator })),
  { ssr: false },
);

const StrategyFollow = dynamic(
  () => import("@/components/trading/strategy-follow").then((m) => ({ default: m.StrategyFollow })),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

// =============================================================================
// TYPES
// =============================================================================

type TradingMode = "paper" | "live";
type LeftTab = "positions" | "orders" | "history";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format large numbers to readable format
 */
function formatAmount(num: number): string {
  if (Math.abs(num) >= 100000000)
    return (num / 100000000).toFixed(2) + "\u4ebf";
  if (Math.abs(num) >= 10000) return (num / 10000).toFixed(2) + "\u4e07";
  return num.toFixed(2);
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TradingPage() {
  // ------ Global state from trading store ------
  const balance = useTradingStore((s) => s.balance);
  const getAccountSummary = useTradingStore((s) => s.getAccountSummary);
  const getTradeHistory = useTradingStore((s) => s.getTradeHistory);
  const getOpenPositions = useTradingStore((s) => s.getOpenPositions);
  const todayTradeCountRef = useRef(0);

  // ------ Local state ------
  const [selectedSymbol, setSelectedSymbol] = useState("600519");
  const [selectedSymbolInfo, setSelectedSymbolInfo] =
    useState<SymbolInfo | null>(null);
  const [tradingMode, setTradingMode] = useState<TradingMode>("paper");
  const [leftTab, setLeftTab] = useState<LeftTab>("positions");
  const [tradingStatus, setTradingStatus] = useState(getTradingStatusInfo());
  const [timeToNext, setTimeToNext] = useState(getTimeToNextEvent());

  // ------ Market data ------
  const {
    data: indices,
    loading: indicesLoading,
    error: indicesError,
  } = useMajorIndices({
    refreshInterval: isMarketOpen() ? 10000 : 60000,
  });

  const { data: northBound } = useNorthBoundFlow({
    refreshInterval: 60000,
  });

  // ------ Trading status ticker (1s) ------
  useEffect(() => {
    const interval = setInterval(() => {
      setTradingStatus(getTradingStatusInfo());
      setTimeToNext(getTimeToNextEvent());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ------ Account summary ------
  const accountSummary = useMemo(() => getAccountSummary(), [getAccountSummary]);

  // ------ Risk indicator factors ------
  const riskFactors = useMemo(() => {
    const positions = getOpenPositions();
    if (positions.length === 0) return [];

    const totalValue = positions.reduce((sum, p) => sum + p.currentPrice * p.size, 0) + balance;
    let largestValue = 0;
    let largestName = "";
    for (const p of positions) {
      const val = p.currentPrice * p.size;
      if (val > largestValue) {
        largestValue = val;
        largestName = p.name;
      }
    }

    // Simple drawdown estimate from positions
    const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0);
    const currentDrawdown = totalPnL < 0 && totalCost > 0 ? Math.abs(totalPnL / totalCost) * 100 : 0;

    return computeTradingRiskFactors({
      totalPortfolioValue: totalValue,
      largestPositionValue: largestValue,
      largestPositionName: largestName,
      currentDrawdown,
      stopLossThreshold: 5,
      todayTradeCount: todayTradeCountRef.current,
    });
  }, [getOpenPositions, balance]);

  // ------ Trade history for bottom tab ------
  const tradeHistory = useMemo(
    () => getTradeHistory(50),
    [getTradeHistory],
  );

  // ------ Computed ------
  const currentPrice = selectedSymbolInfo?.price ?? 0;
  const prevClose = currentPrice; // Fallback; will be overridden by real data from orderbook

  // ------ Handlers ------
  const handleSymbolChange = useCallback(
    (symbol: string, info?: SymbolInfo) => {
      setSelectedSymbol(symbol);
      if (info) setSelectedSymbolInfo(info);
    },
    [],
  );

  // Trading status indicator
  const statusColor = {
    green: "bg-profit",
    yellow: "bg-yellow-400",
    red: "bg-loss",
    gray: "bg-white/30",
  }[tradingStatus.color];

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <DashboardHeader />

      {/* Main content */}
      <main className="max-w-[1920px] mx-auto px-3 sm:px-4 pb-6">
        {/* ============================================================ */}
        {/* TOP BAR: Mode toggle + Balance + Market status */}
        {/* ============================================================ */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Title + Mode toggle */}
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-medium text-white">交易中心</h1>
            <ContextualHelp
              sections={CONTEXTUAL_HELP_CONTENT.trading ?? []}
              title="交易帮助"
            />
            <div className="flex items-center bg-surface rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setTradingMode("paper")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition btn-tactile",
                  tradingMode === "paper"
                    ? "bg-yellow-500/15 text-yellow-300"
                    : "text-white/40 hover:text-white/60",
                )}
              >
                模拟交易
              </button>
              <button
                type="button"
                onClick={() => setTradingMode("live")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition btn-tactile",
                  tradingMode === "live"
                    ? "bg-profit/15 text-profit"
                    : "text-white/40 hover:text-white/60",
                )}
              >
                实盘交易
              </button>
            </div>
          </div>

          {/* Center: Market indices ticker */}
          <div className="flex items-center gap-4 overflow-x-auto flex-1 justify-center min-w-0">
            {!indicesLoading && !indicesError && indices && indices.length > 0
              ? indices.slice(0, 4).map((idx) => (
                  <div
                    key={idx.symbol}
                    className="flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span className="text-xs text-white/40">{idx.name}</span>
                    <span className="text-xs font-mono tabular-nums text-white/70">
                      {idx.price.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-mono tabular-nums",
                        idx.changePercent >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {idx.changePercent >= 0 ? "+" : ""}
                      {idx.changePercent.toFixed(2)}%
                    </span>
                  </div>
                ))
              : null}
            {northBound && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-white/40">北向</span>
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums",
                    northBound.total >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {northBound.total >= 0 ? "+" : ""}
                  {formatAmount(northBound.total)}
                </span>
              </div>
            )}
          </div>

          {/* Right: Balance + Status */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-xs text-white/40">总资产</div>
              <div className="text-sm font-medium text-white font-mono tabular-nums">
                ¥{accountSummary.equity.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn("w-2 h-2 rounded-full", statusColor)}
              />
              <span className="text-white/60">{tradingStatus.label}</span>
              {timeToNext > 0 && (
                <span className="text-white/30 font-mono tabular-nums">
                  {formatTimeRemaining(timeToNext)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Paper trading banner */}
        {tradingMode === "paper" && <PaperTradingBanner className="mb-3" />}

        {/* ============================================================ */}
        {/* MAIN 3-COLUMN LAYOUT */}
        {/* ============================================================ */}
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-12 gap-3",
            tradingMode === "paper" && "lg:[&>*]:border-yellow-500/10",
          )}
        >
          {/* ========== LEFT COLUMN: Positions / Orders / History ========== */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-3">
            {/* Symbol selector */}
            <div className="bg-surface rounded-xl border border-border p-3">
              <SymbolSelector
                value={selectedSymbol}
                onChange={handleSymbolChange}
                showQuote={true}
              />
            </div>

            {/* Tabs: Positions / Orders / History */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="flex border-b border-border">
                {(
                  [
                    { key: "positions" as LeftTab, label: "持仓" },
                    { key: "orders" as LeftTab, label: "委托" },
                    { key: "history" as LeftTab, label: "成交" },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLeftTab(key)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-medium transition relative",
                      leftTab === key
                        ? "text-accent"
                        : "text-white/40 hover:text-white/60",
                    )}
                  >
                    {label}
                    {leftTab === key && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="max-h-[520px] overflow-y-auto">
                {leftTab === "positions" && (
                  <PositionList
                    onSymbolSelect={(symbol) =>
                      handleSymbolChange(symbol)
                    }
                    onAddPosition={(symbol) =>
                      handleSymbolChange(symbol)
                    }
                    onReducePosition={(symbol) =>
                      handleSymbolChange(symbol)
                    }
                  />
                )}
                {leftTab === "orders" && <OrderList />}
                {leftTab === "history" && (
                  <TradeHistoryList history={tradeHistory} />
                )}
              </div>
            </div>
          </div>

          {/* ========== CENTER COLUMN: Chart + Orderbook ========== */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-3">
            {/* K-Line chart */}
            <KLineChart
              symbol={selectedSymbol}
              height={520}
              showVolume={true}
              showMA={true}
              maWindows={[5, 20, 60]}
              onSymbolChange={handleSymbolChange}
            />

            {/* Orderbook */}
            <OrderbookPanel
              symbol={selectedSymbol}
              onPriceClick={() => {
                // Price click handled by order panel
              }}
              levels={5}
            />
          </div>

          {/* ========== RIGHT COLUMN: Order Panel + Risk + Strategy ========== */}
          <div className="lg:col-span-3 xl:col-span-3 space-y-3">
            {/* Order panel */}
            <OrderPanel
              symbol={selectedSymbol}
              symbolName={
                selectedSymbolInfo?.name ?? selectedSymbol
              }
              currentPrice={currentPrice}
              prevClose={prevClose}
              disabled={tradingMode === "live"}
            />

            {/* Risk indicator */}
            {riskFactors.length > 0 && (
              <RiskIndicator factors={riskFactors} />
            )}

            {/* Risk settings */}
            <RiskSettings />

            {/* Strategy auto-follow */}
            <StrategyFollow />
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: Trade History List
// =============================================================================

interface TradeHistoryListProps {
  history: Array<{
    id: string;
    type: string;
    timestamp: Date;
    data: Record<string, unknown>;
    symbol?: string;
  }>;
}

function TradeHistoryList({ history }: TradeHistoryListProps) {
  // Filter to only show relevant trade events
  const relevantEvents = useMemo(
    () =>
      history.filter(
        (e) =>
          e.type === "POSITION_OPENED" ||
          e.type === "POSITION_CLOSED" ||
          e.type === "ORDER_FILLED",
      ),
    [history],
  );

  if (relevantEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-white/40">暂无成交记录</p>
        <p className="text-xs text-white/25 mt-1">交易完成后记录将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {relevantEvents.map((event) => {
        const isOpen = event.type === "POSITION_OPENED";
        const isClose = event.type === "POSITION_CLOSED";
        const isFill = event.type === "ORDER_FILLED";

        const typeLabel = isOpen
          ? "开仓"
          : isClose
            ? "平仓"
            : "成交";
        const typeColor = isOpen
          ? "text-profit bg-profit/15"
          : isClose
            ? "text-loss bg-loss/15"
            : "text-accent bg-accent/15";

        const symbolName =
          (event.data.name as string) ??
          (event.data.position as Record<string, unknown>)?.name ??
          event.symbol ??
          "--";
        const price =
          (event.data.entryPrice as number) ??
          (event.data.closePrice as number) ??
          (event.data.fillPrice as number) ??
          0;
        const size =
          (event.data.size as number) ??
          (event.data.fillSize as number) ??
          0;
        const lots = Math.floor(size / 100);

        // PnL for close events
        const pnl = isClose ? (event.data.netPnL as number) ?? 0 : null;

        return (
          <div
            key={event.id}
            className="px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
                    typeColor,
                  )}
                >
                  {typeLabel}
                </span>
                <span className="text-sm text-white font-medium truncate">
                  {String(symbolName)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 font-mono tabular-nums">
                {lots > 0 && <span>{lots}手</span>}
                {price > 0 && <span>¥{price.toFixed(2)}</span>}
                <span>
                  {new Date(event.timestamp).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            {pnl !== null && (
              <span
                className={cn(
                  "text-xs font-mono tabular-nums font-medium",
                  pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {pnl >= 0 ? "+" : ""}¥{pnl.toFixed(2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
