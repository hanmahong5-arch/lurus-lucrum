"use client";

/**
 * Position List Component
 *
 * Displays current holdings with:
 * - Lot-based display (手)
 * - Color-coded PnL (red=profit, green=loss per CN convention)
 * - Action buttons (add/reduce/close position)
 * - Hover details (open date, holding days)
 * - Empty state
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useTradingStore } from "@/lib/stores/trading-store";
import type { Position } from "@/lib/stores/trading-store";

// =============================================================================
// CONSTANTS
// =============================================================================

const SHARES_PER_LOT = 100;

// =============================================================================
// TYPES
// =============================================================================

interface PositionListProps {
  onSymbolSelect?: (symbol: string) => void;
  onAddPosition?: (symbol: string) => void;
  onReducePosition?: (symbol: string) => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PositionList({
  onSymbolSelect,
  onAddPosition,
  onReducePosition,
  className,
}: PositionListProps) {
  const positions = useTradingStore((s) => s.getOpenPositions());
  const closePosition = useTradingStore((s) => s.closePosition);
  const balance = useTradingStore((s) => s.balance);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Compute total position value and PnL
  const totals = useMemo(() => {
    let totalValue = 0;
    let totalPnL = 0;
    let totalCost = 0;
    for (const pos of positions) {
      totalValue += pos.currentPrice * pos.size;
      totalPnL += pos.unrealizedPnL;
      totalCost += pos.entryPrice * pos.size;
    }
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    return { totalValue, totalPnL, totalCost, totalPnLPercent };
  }, [positions]);

  const handleClosePosition = (position: Position) => {
    closePosition(position.id, position.currentPrice);
  };

  // Calculate holding days
  const getHoldingDays = (openedAt: Date): number => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(openedAt).getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  if (positions.length === 0) {
    return (
      <div className={cn("", className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-white">
            持仓列表
            <span className="text-white/40 ml-1.5 text-xs">(0)</span>
          </h3>
        </div>
        {/* Enhanced empty state with actionable guidance */}
        <div className="flex flex-col items-center justify-center py-10 px-4">
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
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <p className="text-sm text-white/40">暂无持仓</p>
          <p className="text-xs text-white/25 mt-1 max-w-[200px] leading-relaxed">
            在左侧选择股票并下单，持仓将显示在这里。初始资金10万元。
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-white/20 px-2 py-1 rounded bg-white/[0.03] border border-white/5">
              1手 = 100股
            </span>
            <span className="text-[10px] text-white/20 px-2 py-1 rounded bg-white/[0.03] border border-white/5">
              T+1 交易
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-white">
          持仓列表
          <span className="text-white/40 ml-1.5 text-xs">({positions.length})</span>
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-white/40">
            总市值{" "}
            <span className="text-white font-mono tabular-nums">
              ¥{totals.totalValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
          <span className={cn("font-mono tabular-nums", totals.totalPnL >= 0 ? "text-profit" : "text-loss")}>
            {totals.totalPnL >= 0 ? "+" : ""}¥{totals.totalPnL.toFixed(2)}
            <span className="ml-1">
              ({totals.totalPnLPercent >= 0 ? "+" : ""}
              {totals.totalPnLPercent.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Position rows */}
      <div className="divide-y divide-border/50">
        {positions.map((pos) => {
          const lots = Math.floor(pos.size / SHARES_PER_LOT);
          const holdingDays = getHoldingDays(pos.openedAt);
          const marketValue = pos.currentPrice * pos.size;
          const isHovered = hoveredId === pos.id;

          return (
            <div
              key={pos.id}
              className="px-4 py-3 hover:bg-white/[0.02] transition cursor-pointer group"
              onMouseEnter={() => setHoveredId(pos.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSymbolSelect?.(pos.symbol)}
            >
              {/* Main row */}
              <div className="flex items-center justify-between">
                {/* Left: symbol info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {pos.name}
                    </span>
                    <span className="text-xs text-white/30">{pos.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
                    <span className="font-mono tabular-nums">
                      {lots}手 ({pos.size}股)
                    </span>
                    <span>
                      成本 <span className="font-mono tabular-nums">¥{pos.entryPrice.toFixed(2)}</span>
                    </span>
                    <span>
                      现价{" "}
                      <span className="font-mono tabular-nums text-white/60">
                        ¥{pos.currentPrice.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Right: PnL */}
                <div className="text-right flex-shrink-0 ml-4">
                  <div
                    className={cn(
                      "text-sm font-medium font-mono tabular-nums",
                      pos.unrealizedPnL >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {pos.unrealizedPnL >= 0 ? "+" : ""}¥{pos.unrealizedPnL.toFixed(2)}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-mono tabular-nums",
                      pos.unrealizedPnLPercent >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {pos.unrealizedPnLPercent >= 0 ? "+" : ""}
                    {pos.unrealizedPnLPercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Action buttons and hover details */}
              <div
                className={cn(
                  "flex items-center justify-between mt-2 transition-all",
                  isHovered
                    ? "opacity-100 max-h-10"
                    : "opacity-0 max-h-0 overflow-hidden",
                )}
              >
                {/* Hover details */}
                <div className="text-xs text-white/30 flex items-center gap-3">
                  <span>
                    开仓 {new Date(pos.openedAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span>持有 {holdingDays} 天</span>
                  <span>
                    市值{" "}
                    <span className="font-mono tabular-nums">
                      ¥{marketValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddPosition?.(pos.symbol);
                    }}
                    className="px-2.5 py-1 text-xs text-profit border border-profit/30 rounded hover:bg-profit/10 transition btn-tactile"
                  >
                    加仓
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReducePosition?.(pos.symbol);
                    }}
                    className="px-2.5 py-1 text-xs text-accent border border-accent/30 rounded hover:bg-accent/10 transition btn-tactile"
                  >
                    减仓
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClosePosition(pos);
                    }}
                    className="px-2.5 py-1 text-xs text-loss border border-loss/30 rounded hover:bg-loss/10 transition btn-tactile"
                  >
                    清仓
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
