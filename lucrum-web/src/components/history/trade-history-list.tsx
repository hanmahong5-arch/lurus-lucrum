"use client";

/**
 * TradeHistoryList - Display for trading records in the history hub.
 * Shows buy/sell records with P&L, status, and timestamps.
 */

import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface TradeHistoryItem {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  total: number;
  pnl?: number;
  timestamp: string;
  status: "completed" | "cancelled";
}

interface TradeHistoryListProps {
  entries: TradeHistoryItem[];
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (86_400_000));
  if (days === 0) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TradeHistoryList({ entries }: TradeHistoryListProps) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-border hover:border-white/15 transition"
        >
          {/* Side indicator */}
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
              entry.side === "buy"
                ? "bg-profit/10 text-profit"
                : "bg-loss/10 text-loss",
            )}
          >
            {entry.side === "buy" ? "买" : "卖"}
          </div>

          {/* Symbol + details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {entry.symbol}
              </span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded",
                  entry.status === "completed"
                    ? "bg-profit/10 text-profit"
                    : "bg-white/10 text-white/50",
                )}
              >
                {entry.status === "completed" ? "已完成" : "已取消"}
              </span>
            </div>
            <div className="text-xs text-white/40 font-mono tabular-nums mt-0.5">
              {entry.size} @ {entry.price.toLocaleString()}
            </div>
          </div>

          {/* Amount + PnL */}
          <div className="text-right shrink-0">
            <div className="text-sm text-white font-mono tabular-nums">
              {entry.total.toLocaleString()}
            </div>
            {entry.pnl != null && (
              <div
                className={cn(
                  "text-xs font-mono tabular-nums",
                  entry.pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {entry.pnl >= 0 ? "+" : ""}
                {entry.pnl.toFixed(2)}
              </div>
            )}
            <div className="text-[10px] text-white/30 mt-0.5">
              {formatTime(entry.timestamp)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
