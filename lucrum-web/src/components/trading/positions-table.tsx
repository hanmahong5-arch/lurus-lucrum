"use client";

/**
 * PositionsTable — standalone reusable positions display component.
 *
 * Accepts position data as props (no store coupling) so it can be embedded
 * in any page: live dashboard, backtest results, paper-trading review, etc.
 *
 * Design rules (DESIGN_SYSTEM.md):
 * - tabular-nums on every financial number
 * - text-profit (red in CN) for positive PnL
 * - text-loss (green in CN) for negative PnL
 * - bg-surface cards, bg-void background
 * - font-mono for all prices / amounts
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface PositionRow {
  /** Stock code, e.g. "600519" */
  symbol: string;
  /** Display name, e.g. "贵州茅台" */
  name: string;
  /** Number of shares (multiples of 100 for A-shares) */
  size: number;
  /** Average cost price */
  entryPrice: number;
  /** Latest market price */
  currentPrice: number;
  /** Unrealised PnL in CNY */
  unrealizedPnL: number;
  /** Unrealised PnL as fraction (0.05 = 5%) */
  unrealizedPnLPercent: number;
  /** Market value = currentPrice * size */
  marketValue?: number;
}

export interface PositionsTableProps {
  positions: PositionRow[];
  /** Show compact column set (hides cost/market-value on narrow panels) */
  compact?: boolean;
  /** Callback when user clicks a row symbol */
  onSymbolClick?: (symbol: string) => void;
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const SHARES_PER_LOT = 100;

function fmtPrice(v: number): string {
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function fmtPnL(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}¥${fmtPrice(Math.abs(v))}${v < 0 ? "" : ""}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PositionsTable({
  positions,
  compact = false,
  onSymbolClick,
  className,
}: PositionsTableProps) {
  // Aggregate totals across all rows
  const totals = useMemo(() => {
    let totalValue = 0;
    let totalPnL = 0;
    let totalCost = 0;
    for (const p of positions) {
      const mv = p.marketValue ?? p.currentPrice * p.size;
      totalValue += mv;
      totalPnL += p.unrealizedPnL;
      totalCost += p.entryPrice * p.size;
    }
    const pct = totalCost > 0 ? totalPnL / totalCost : 0;
    return { totalValue, totalPnL, totalCost, pct };
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-10 px-4",
          className,
        )}
      >
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <svg
            className="w-5 h-5 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-sm text-white/40">暂无持仓</p>
        <p className="text-xs text-white/25 mt-1">持仓数据将在此显示</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-surface/50">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">持仓</span>
          <span className="text-xs text-white/40">({positions.length})</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-neutral-400">
            总市值{" "}
            <span className="font-mono tabular-nums text-white/80">
              ¥{fmtPrice(totals.totalValue)}
            </span>
          </span>
          <span
            className={cn(
              "font-mono tabular-nums font-medium",
              totals.totalPnL >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {fmtPnL(totals.totalPnL)}{" "}
            <span className="opacity-70">({fmtPct(totals.pct)})</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-border/40">
              <th className="px-3 py-2 font-normal">股票</th>
              <th className="px-2 py-2 font-normal text-right">手数</th>
              {!compact && (
                <th className="px-2 py-2 font-normal text-right">成本</th>
              )}
              <th className="px-2 py-2 font-normal text-right">现价</th>
              {!compact && (
                <th className="px-2 py-2 font-normal text-right">市值</th>
              )}
              <th className="px-2 py-2 font-normal text-right">盈亏</th>
              <th className="px-3 py-2 font-normal text-right">涨跌幅</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {positions.map((pos) => {
              const lots = Math.floor(pos.size / SHARES_PER_LOT);
              const mv = pos.marketValue ?? pos.currentPrice * pos.size;
              const isProfit = pos.unrealizedPnL >= 0;

              return (
                <tr
                  key={`${pos.symbol}-${pos.entryPrice}`}
                  className={cn(
                    "hover:bg-white/[0.025] transition-colors",
                    onSymbolClick && "cursor-pointer",
                  )}
                  onClick={() => onSymbolClick?.(pos.symbol)}
                >
                  {/* Stock name + code */}
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-white/90 leading-tight">
                      {pos.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {pos.symbol}
                    </div>
                  </td>

                  {/* Lot count */}
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-white/70">
                    {lots}手
                  </td>

                  {/* Cost (hidden in compact mode) */}
                  {!compact && (
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-neutral-400">
                      ¥{fmtPrice(pos.entryPrice)}
                    </td>
                  )}

                  {/* Current price */}
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-white/90">
                    ¥{fmtPrice(pos.currentPrice)}
                  </td>

                  {/* Market value (hidden in compact mode) */}
                  {!compact && (
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-white/60">
                      ¥{fmtPrice(mv)}
                    </td>
                  )}

                  {/* Unrealized PnL */}
                  <td
                    className={cn(
                      "px-2 py-2.5 text-right font-mono tabular-nums font-medium",
                      isProfit ? "text-profit" : "text-loss",
                    )}
                  >
                    {fmtPnL(pos.unrealizedPnL)}
                  </td>

                  {/* PnL % */}
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono tabular-nums",
                      isProfit ? "text-profit" : "text-loss",
                    )}
                  >
                    {fmtPct(pos.unrealizedPnLPercent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
