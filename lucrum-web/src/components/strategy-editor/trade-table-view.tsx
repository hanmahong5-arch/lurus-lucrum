/**
 * Trade Table View Component
 *
 * Tabular display of trade records with sortable columns.
 * Columns: Date | Direction | Price | Lots | Amount | Commission | P&L | Holding Days
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { DetailedTrade } from "@/lib/backtest/types";

// =============================================================================
// TYPES
// =============================================================================

type SortKey = "date" | "type" | "price" | "lots" | "amount" | "commission" | "pnl" | "holdingDays";
type SortDir = "asc" | "desc";

interface TradeRow {
  id: string;
  date: string;
  type: "buy" | "sell";
  price: number;
  lots: number;
  amount: number;
  commission: number;
  pnl: number | null;
  holdingDays: number | null;
}

interface TradeTableViewProps {
  trades: DetailedTrade[];
  dataIncomplete?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function toRows(trades: DetailedTrade[]): TradeRow[] {
  return trades.map((t) => ({
    id: t.id,
    date: new Date(t.timestamp).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    type: t.type as "buy" | "sell",
    price: t.executePrice,
    lots: t.lots,
    amount: t.orderValue,
    commission: t.commission,
    pnl: t.pnl ?? null,
    holdingDays: t.holdingDays ?? null,
  }));
}

function sortRows(rows: TradeRow[], key: SortKey, dir: SortDir): TradeRow[] {
  return [...rows].sort((a, b) => {
    let av: number | string | null = null;
    let bv: number | string | null = null;

    switch (key) {
      case "date":      av = a.date; bv = b.date; break;
      case "type":      av = a.type; bv = b.type; break;
      case "price":     av = a.price; bv = b.price; break;
      case "lots":      av = a.lots; bv = b.lots; break;
      case "amount":    av = a.amount; bv = b.amount; break;
      case "commission":av = a.commission; bv = b.commission; break;
      case "pnl":       av = a.pnl ?? -Infinity; bv = b.pnl ?? -Infinity; break;
      case "holdingDays": av = a.holdingDays ?? -Infinity; bv = b.holdingDays ?? -Infinity; break;
    }

    if (av === null || bv === null) return 0;
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// =============================================================================
// HEADER CELL
// =============================================================================

function TH({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className,
  scope = "col",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  scope?: "col" | "row";
}) {
  const active = currentKey === sortKey;
  return (
    <th
      scope={scope}
      className={cn(
        "px-2 py-2 text-[10px] font-medium uppercase tracking-wide cursor-pointer select-none whitespace-nowrap",
        "hover:text-neutral-200 transition-colors",
        active ? "text-neutral-200" : "text-neutral-500",
        className
      )}
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="flex items-center gap-1">
        {label}
        {active && (
          <span className="text-[8px]">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TradeTableView({ trades, dataIncomplete }: TradeTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const rows = sortRows(toRows(trades), sortKey, sortDir);

  // Compute summary stats for screen reader
  const winCount = rows.filter((r) => r.pnl !== null && r.pnl >= 0).length;
  const sellCount = rows.filter((r) => r.pnl !== null).length;
  const winRate = sellCount > 0 ? ((winCount / sellCount) * 100).toFixed(1) : "0";

  return (
    <div role="region" aria-label="交易记录" className="overflow-x-auto">
      <table className="w-full text-xs font-mono tabular-nums">
        <thead>
          <tr className="border-b border-white/5">
            <TH label="日期" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={handleSort} scope="col" />
            <TH label="方向" sortKey="type" currentKey={sortKey} dir={sortDir} onSort={handleSort} scope="col" />
            <TH label="股价" sortKey="price" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" scope="col" />
            <TH label="手数" sortKey="lots" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" scope="col" />
            <TH label="金额" sortKey="amount" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" scope="col" />
            <TH label="手续费" sortKey="commission" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" scope="col" />
            <TH label="盈亏" sortKey="pnl" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" scope="col" />
            <TH label="持仓天" sortKey="holdingDays" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" scope="col" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-2 py-1.5 text-neutral-400 whitespace-nowrap">
                {dataIncomplete && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-600 mr-1 mb-0.5 align-middle"
                    title="数据不完整"
                    aria-label="数据不完整"
                  />
                )}
                {row.date}
              </td>
              <td className="px-2 py-1.5">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    row.type === "buy"
                      ? "bg-profit/20 text-profit"
                      : "bg-loss/20 text-loss"
                  )}
                >
                  {row.type === "buy" ? "买入" : "卖出"}
                </span>
              </td>
              <td className="px-2 py-1.5 text-right text-neutral-300">
                ¥{row.price.toFixed(2)}
              </td>
              <td className="px-2 py-1.5 text-right text-neutral-300">
                {row.lots.toLocaleString()}
              </td>
              <td className="px-2 py-1.5 text-right text-neutral-300">
                ¥{row.amount.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}
              </td>
              <td className="px-2 py-1.5 text-right text-neutral-500">
                ¥{row.commission.toFixed(2)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {row.pnl !== null ? (
                  <span
                    className={cn(
                      "font-medium",
                      row.pnl >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {row.pnl >= 0 ? "+" : ""}
                    {row.pnl.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-neutral-600">—</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right text-neutral-400">
                {row.holdingDays !== null ? `${row.holdingDays}天` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sr-only" aria-live="polite">
        共 {rows.length} 笔交易，胜率 {winRate}%
      </div>
    </div>
  );
}
