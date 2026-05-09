"use client";

/**
 * PnLStatCard — KPI stat cards for live trading dashboard.
 *
 * Renders the four headline metrics visible at all times in the right column:
 * - Total equity
 * - Today's realised + unrealised PnL
 * - Floating (unrealised) PnL
 * - Win rate (% of closed trades in profit)
 *
 * Design rules (DESIGN_SYSTEM.md):
 * - Uses `.stat-card` component class from tailwind plugin
 * - `text-stat-xl` / `text-stat-md` for hero numbers
 * - `tabular-nums font-mono` mandatory on all numbers
 * - text-profit (red, CN: 涨) / text-loss (green, CN: 跌) for directional
 * - bg-surface base, glass-panel for elevated card variant
 */

import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface PnLStats {
  /** Total portfolio equity in CNY */
  totalEquity: number;
  /** Available cash balance */
  cash: number;
  /** Sum of unrealised PnL across all open positions */
  floatPnL: number;
  /** Today's total PnL (realised + unrealised delta since open) */
  todayPnL: number;
  /** Win rate of closed trades [0, 1] */
  winRate: number;
  /** Total closed trades count */
  closedTrades: number;
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  tone?: "profit" | "loss" | "neutral";
  size?: "xl" | "md" | "sm";
  className?: string;
}

// =============================================================================
// SINGLE STAT CARD (internal primitive)
// =============================================================================

function StatCard({ label, value, subValue, tone = "neutral", size = "md", className }: StatCardProps) {
  const valueColorClass =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
        ? "text-loss"
        : "text-white";

  const sizeClass =
    size === "xl"
      ? "text-stat-xl"
      : size === "md"
        ? "text-stat-md"
        : "text-stat-sm";

  return (
    <div className={cn("stat-card", className)}>
      <span className="stat-label">{label}</span>
      <span
        className={cn(
          "stat-value tabular-nums font-mono",
          sizeClass,
          valueColorClass,
          "mt-1",
        )}
      >
        {value}
      </span>
      {subValue && (
        <span className="text-xs text-neutral-500 font-mono tabular-nums mt-0.5">
          {subValue}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// PnL STAT PANEL
// =============================================================================

export interface PnLStatCardProps {
  stats: PnLStats;
  className?: string;
}

/**
 * Formats a CNY amount with sign prefix and ¥ symbol.
 * Uses CN locale for thousands separator.
 */
function fmtCNY(v: number, alwaysSign = false): string {
  const sign = v > 0 ? "+" : "";
  const absFormatted = Math.abs(v).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (v < 0) return `-¥${absFormatted}`;
  if (alwaysSign) return `${sign}¥${absFormatted}`;
  return `¥${absFormatted}`;
}

function fmtPct(v: number, alwaysSign = false): string {
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  if (!alwaysSign && v >= 0) return `${(v * 100).toFixed(2)}%`;
  return `${sign}${(v * 100).toFixed(2)}%`;
}

export function PnLStatCard({ stats, className }: PnLStatCardProps) {
  const todayTone: StatCardProps["tone"] =
    stats.todayPnL > 0 ? "profit" : stats.todayPnL < 0 ? "loss" : "neutral";

  const floatTone: StatCardProps["tone"] =
    stats.floatPnL > 0 ? "profit" : stats.floatPnL < 0 ? "loss" : "neutral";

  // Win rate: >= 50% is good (profit tone), below 40% is bad (loss tone)
  const winRateTone: StatCardProps["tone"] =
    stats.winRate >= 0.5 ? "profit" : stats.winRate < 0.4 ? "loss" : "neutral";

  return (
    <div className={cn("space-y-2", className)}>
      {/* Hero: Total equity — largest display */}
      <StatCard
        label="总资产"
        value={fmtCNY(stats.totalEquity)}
        subValue={`可用 ${fmtCNY(stats.cash)}`}
        tone="neutral"
        size="xl"
      />

      {/* 2-column grid for the three secondary metrics */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="今日盈亏"
          value={fmtCNY(stats.todayPnL, true)}
          tone={todayTone}
          size="md"
        />
        <StatCard
          label="浮动盈亏"
          value={fmtCNY(stats.floatPnL, true)}
          tone={floatTone}
          size="md"
        />
      </div>

      <StatCard
        label="胜率"
        value={fmtPct(stats.winRate)}
        subValue={`共 ${stats.closedTrades} 笔已平仓`}
        tone={winRateTone}
        size="md"
      />
    </div>
  );
}
