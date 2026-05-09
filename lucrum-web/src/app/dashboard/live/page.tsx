"use client";

/**
 * Live Trading Workbench — /dashboard/live
 *
 * Three-column layout for real-time portfolio monitoring:
 *   Left  (240px) : Strategy list + quick navigation
 *   Center (flex) : K-line chart placeholder + live PositionsTable
 *   Right (300px) : PnL StatCards + risk alerts
 *
 * Wired to the existing Zustand trading store so paper-trading state
 * populates the stats and positions table out of the box.
 *
 * Footer: "Powered by vnpy + DeepSeek APIs" per product brief.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PositionsTable } from "@/components/trading/positions-table";
import { PnLStatCard } from "@/components/trading/pnl-stat-card";
import { useTradingStore } from "@/lib/stores/trading-store";
import { cn } from "@/lib/utils";

// =============================================================================
// MOCK STRATEGY LIST (populated from store in a real integration)
// =============================================================================

interface StrategyEntry {
  id: string;
  name: string;
  status: "running" | "paused" | "stopped";
  returnPct: number;
}

const DEMO_STRATEGIES: StrategyEntry[] = [
  { id: "s1", name: "双均线穿越", status: "running", returnPct: 0.0842 },
  { id: "s2", name: "RSI 反转", status: "paused", returnPct: -0.0217 },
  { id: "s3", name: "布林通道", status: "running", returnPct: 0.1563 },
  { id: "s4", name: "MACD 动量", status: "stopped", returnPct: 0.0031 },
];

// =============================================================================
// HELPERS
// =============================================================================

const STATUS_BADGE: Record<StrategyEntry["status"], string> = {
  running: "bg-status-ready/20 text-status-ready",
  paused: "bg-status-warn/20 text-status-warn",
  stopped: "bg-white/5 text-white/30",
};

const STATUS_LABEL: Record<StrategyEntry["status"], string> = {
  running: "运行",
  paused: "暂停",
  stopped: "停止",
};

function fmtReturnPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

// =============================================================================
// RISK ALERT PANEL (right column bottom)
// =============================================================================

interface RiskAlert {
  id: string;
  severity: "warn" | "block";
  message: string;
}

function RiskAlertPanel({ alerts }: { alerts: RiskAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-border p-3">
        <div className="text-xs font-medium text-neutral-400 mb-2">风险告警</div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span className="w-1.5 h-1.5 rounded-full bg-status-ready" />
          风控正常，无告警
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border p-3 space-y-2">
      <div className="text-xs font-medium text-neutral-400">
        风险告警{" "}
        <span className="text-status-block font-mono tabular-nums">
          ({alerts.length})
        </span>
      </div>
      {alerts.map((a) => (
        <div
          key={a.id}
          className={cn(
            "flex items-start gap-2 rounded p-2 text-xs",
            a.severity === "block"
              ? "bg-status-block/10 text-status-block"
              : "bg-status-warn/10 text-status-warn",
          )}
        >
          <span className="mt-px shrink-0">
            {a.severity === "block" ? "🔴" : "⚠️"}
          </span>
          <span className="leading-relaxed">{a.message}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// STRATEGY NAV (left column)
// =============================================================================

function StrategyNav({
  strategies,
  activeId,
  onSelect,
}: {
  strategies: StrategyEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">策略列表</span>
        <Link
          href="/dashboard"
          className="text-xs text-primary hover:text-primary/80 transition"
        >
          + 新建
        </Link>
      </div>

      <div className="divide-y divide-border/40">
        {strategies.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 text-left transition hover:bg-white/[0.025]",
              activeId === s.id && "bg-primary/10 glow-active",
            )}
          >
            <div className="min-w-0">
              <div
                className={cn(
                  "text-xs font-medium truncate",
                  activeId === s.id ? "text-white" : "text-white/70",
                )}
              >
                {s.name}
              </div>
              <div
                className={cn(
                  "text-[11px] font-mono tabular-nums mt-0.5",
                  s.returnPct >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {fmtReturnPct(s.returnPct)}
              </div>
            </div>
            <span
              className={cn(
                "ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium",
                STATUS_BADGE[s.status],
              )}
            >
              {STATUS_LABEL[s.status]}
            </span>
          </button>
        ))}
      </div>

      {/* Quick nav to other dashboard sections */}
      <div className="border-t border-border/40 p-2 space-y-0.5">
        {[
          { href: "/dashboard", label: "策略工作台" },
          { href: "/dashboard/trading", label: "交易中心" },
          { href: "/dashboard/history", label: "回测历史" },
          { href: "/dashboard/advisor", label: "AI 顾问" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function LiveWorkbenchPage() {
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(
    DEMO_STRATEGIES[0]?.id ?? null,
  );

  // Read live state from trading store (paper-trading by default)
  const getOpenPositions = useTradingStore((s) => s.getOpenPositions);
  const getAccountSummary = useTradingStore((s) => s.getAccountSummary);
  const getTradeHistory = useTradingStore((s) => s.getTradeHistory);

  const positions = useMemo(() => getOpenPositions(), [getOpenPositions]);
  const account = useMemo(() => getAccountSummary(), [getAccountSummary]);
  const tradeHistory = useMemo(() => getTradeHistory(500), [getTradeHistory]);

  const floatPnL = account.unrealizedPnL;

  const pnlStats = useMemo(
    () => ({
      totalEquity: account.equity,
      cash: account.balance,
      floatPnL: account.unrealizedPnL,
      todayPnL: account.dailyPnL,
      winRate: account.winRate,
      closedTrades: tradeHistory.filter((e) => e.type === "POSITION_CLOSED")
        .length,
    }),
    [account, tradeHistory],
  );

  // Map trading store positions to PositionsTable row shape
  const positionRows = useMemo(
    () =>
      positions.map((p) => ({
        symbol: p.symbol,
        name: p.name,
        size: p.size,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        unrealizedPnL: p.unrealizedPnL,
        unrealizedPnLPercent: p.unrealizedPnLPercent,
        marketValue: p.currentPrice * p.size,
      })),
    [positions],
  );

  // Risk alerts — simple heuristic (extend with real risk-manager in production)
  const riskAlerts = useMemo<RiskAlert[]>(() => {
    const alerts: RiskAlert[] = [];

    // Flag if any single position > 30% of equity
    for (const p of positions) {
      const weight = (p.currentPrice * p.size) / (account.equity || 1);
      if (weight > 0.3) {
        alerts.push({
          id: `conc-${p.symbol}`,
          severity: "warn",
          message: `${p.name} 集中度 ${(weight * 100).toFixed(1)}%，超过 30% 阈值`,
        });
      }
    }

    // Flag drawdown > 10%
    if (floatPnL < 0 && account.equity > 0) {
      const dd = Math.abs(floatPnL) / account.equity;
      if (dd > 0.1) {
        alerts.push({
          id: "drawdown",
          severity: "block",
          message: `当前浮亏 ${(dd * 100).toFixed(1)}%，已超过 10% 回撤警戒线`,
        });
      }
    }

    return alerts;
  }, [positions, floatPnL, account.equity]);

  return (
    <div className="min-h-screen bg-void flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-[1920px] mx-auto w-full px-3 sm:px-4 py-3 flex flex-col gap-3">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">实盘监控</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              实时持仓 · PnL · 风险告警
            </p>
          </div>
          <Link
            href="/dashboard/trading"
            className="text-xs px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition btn-tactile"
          >
            前往交易中心 →
          </Link>
        </div>

        {/* 3-column layout */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* ===== LEFT: Strategy nav (240px fixed) ===== */}
          <div className="w-[240px] shrink-0 space-y-3">
            <StrategyNav
              strategies={DEMO_STRATEGIES}
              activeId={activeStrategyId}
              onSelect={setActiveStrategyId}
            />
          </div>

          {/* ===== CENTER: Chart placeholder + Positions table ===== */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* K-line chart placeholder */}
            <div className="bg-surface rounded-lg border border-border h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
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
                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-neutral-500">TradingView Widget</p>
                <p className="text-xs text-neutral-600 mt-1">
                  接入{" "}
                  <Link
                    href="/dashboard/trading"
                    className="text-primary hover:underline"
                  >
                    交易中心
                  </Link>{" "}
                  查看完整 K 线图
                </p>
              </div>
            </div>

            {/* Live positions table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">
                  实时持仓
                </span>
                <span className="text-[11px] text-white/30 font-mono tabular-nums">
                  {positions.length} 只
                </span>
              </div>
              <PositionsTable
                positions={positionRows}
                onSymbolClick={(sym) => {
                  // Navigate to trading page with selected symbol
                  window.location.href = `/dashboard/trading?symbol=${sym}`;
                }}
              />
            </div>
          </div>

          {/* ===== RIGHT: PnL stats + risk alerts (300px fixed) ===== */}
          <div className="w-[300px] shrink-0 space-y-3">
            {/* PnL stat cards */}
            <PnLStatCard stats={pnlStats} />

            {/* Risk alerts */}
            <RiskAlertPanel alerts={riskAlerts} />

            {/* Quick links */}
            <div className="bg-surface rounded-lg border border-border p-3 space-y-2">
              <div className="text-xs font-medium text-neutral-400 mb-1">
                快速操作
              </div>
              {[
                {
                  href: "/dashboard",
                  label: "策略编辑器",
                  desc: "创建 / 调整策略",
                },
                {
                  href: "/dashboard/history",
                  label: "回测历史",
                  desc: "查看历史回测结果",
                },
                {
                  href: "/dashboard/advisor",
                  label: "AI 顾问",
                  desc: "多 agent 投资建议",
                },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between group rounded-md px-2 py-2 hover:bg-white/[0.04] transition"
                >
                  <div>
                    <div className="text-xs text-white/70 group-hover:text-white transition">
                      {label}
                    </div>
                    <div className="text-[11px] text-neutral-600 mt-0.5">
                      {desc}
                    </div>
                  </div>
                  <svg
                    className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-2 px-4">
        <p className="text-[11px] text-neutral-600 text-center">
          Powered by vnpy + DeepSeek APIs
        </p>
      </footer>
    </div>
  );
}
