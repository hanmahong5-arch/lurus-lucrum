"use client";

/**
 * BacktestTimeline - Visual timeline view for backtest history.
 *
 * Renders entries grouped by date with vertical timeline connector.
 * Each entry shows: strategy name x symbol [grade] annualized return.
 *
 * Supports:
 * - Multi-select checkbox for comparison
 * - Re-run button
 * - Grouped by date
 */

import { useMemo, useCallback } from "react";
import { RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartTooltip } from "@/components/ui/smart-tooltip";

// =============================================================================
// TYPES
// =============================================================================

export interface BacktestTimelineEntry {
  id: string;
  timestamp: string;
  strategyName: string;
  symbol: string;
  symbolName: string;
  grade: string | null;
  annualizedReturn: number | null;
  winRate: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  /** Number of stocks if batch/sector backtest */
  stockCount?: number;
  /** Average return for batch runs */
  averageReturn?: number | null;
}

interface BacktestTimelineProps {
  entries: BacktestTimelineEntry[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRerun: (entry: BacktestTimelineEntry) => void;
  onViewDetail: (entry: BacktestTimelineEntry) => void;
}

// =============================================================================
// DATE GROUPING
// =============================================================================

function groupByDate(
  entries: BacktestTimelineEntry[],
): { date: string; items: BacktestTimelineEntry[] }[] {
  const map = new Map<string, BacktestTimelineEntry[]>();

  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const key = isNaN(d.getTime())
      ? "Unknown"
      : d.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(entry);
  }

  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

// =============================================================================
// GRADE BADGE
// =============================================================================

const GRADE_COLORS: Record<string, string> = {
  S: "text-score-s bg-score-s/10 border-score-s/30",
  A: "text-score-a bg-score-a/10 border-score-a/30",
  B: "text-score-b bg-score-b/10 border-score-b/30",
  C: "text-score-c bg-score-c/10 border-score-c/30",
  D: "text-score-d bg-score-d/10 border-score-d/30",
};

function GradePill({ grade }: { grade: string | null }) {
  if (!grade) return null;
  const letter = grade.charAt(0).toUpperCase();
  const color = GRADE_COLORS[letter] ?? "text-white/40 bg-white/5 border-white/10";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded border",
        color,
      )}
    >
      {letter}级
    </span>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BacktestTimeline({
  entries,
  selectedIds,
  onToggleSelect,
  onRerun,
  onViewDetail,
}: BacktestTimelineProps) {
  const groups = useMemo(() => groupByDate(entries), [entries]);

  const handleCheckbox = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onToggleSelect(id);
    },
    [onToggleSelect],
  );

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.date} className="relative">
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-2">
            <span className="text-xs font-medium text-white/50 font-mono tabular-nums">
              {group.date}
            </span>
          </div>

          {/* Timeline items */}
          <div className="relative pl-6 space-y-2">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-white/10" />

            {group.items.map((entry) => {
              const isSelected = selectedIds.has(entry.id);
              const annualized = entry.stockCount
                ? entry.averageReturn
                : entry.annualizedReturn;
              const isPositive = annualized != null && annualized >= 0;

              return (
                <div
                  key={entry.id}
                  onClick={() => onViewDetail(entry)}
                  className={cn(
                    "relative group flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer transition",
                    isSelected
                      ? "bg-accent/5 border border-accent/20"
                      : "hover:bg-white/[0.03] border border-transparent",
                  )}
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "absolute -left-[17px] w-3 h-3 rounded-full border-2 transition",
                      isSelected
                        ? "bg-accent border-accent"
                        : isPositive
                          ? "bg-profit/30 border-profit/50"
                          : "bg-loss/30 border-loss/50",
                    )}
                  />

                  {/* Select checkbox */}
                  <button
                    onClick={(e) => handleCheckbox(e, entry.id)}
                    className={cn(
                      "shrink-0 w-4 h-4 rounded border flex items-center justify-center transition",
                      isSelected
                        ? "bg-accent border-accent text-void"
                        : "border-white/20 hover:border-white/40 opacity-0 group-hover:opacity-100",
                    )}
                    aria-label={isSelected ? "Deselect" : "Select for comparison"}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M2 5L4 7L8 3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Main content */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate max-w-[160px]">
                      {entry.strategyName}
                    </span>
                    <span className="text-xs text-white/30">x</span>
                    <span className="text-xs text-white/60 truncate max-w-[120px]">
                      {entry.symbolName || entry.symbol}
                      {entry.stockCount && entry.stockCount > 1 && (
                        <span className="text-white/30 ml-1">
                          ({entry.stockCount}只)
                        </span>
                      )}
                    </span>
                    <GradePill grade={entry.grade} />
                  </div>

                  {/* Metrics with tooltips */}
                  <div className="shrink-0 flex items-center gap-2.5">
                    {entry.winRate != null && (
                      <SmartTooltip term="winRate" className="text-[10px] text-white/40 font-mono tabular-nums">
                        {entry.winRate.toFixed(0)}%
                      </SmartTooltip>
                    )}
                    {entry.sharpeRatio != null && (
                      <SmartTooltip term="sharpe" className="text-[10px] text-white/40 font-mono tabular-nums">
                        {entry.sharpeRatio.toFixed(2)}
                      </SmartTooltip>
                    )}
                    <span
                      className={cn(
                        "text-sm font-mono tabular-nums font-medium",
                        annualized != null
                          ? isPositive
                            ? "text-profit"
                            : "text-loss"
                          : "text-white/30",
                      )}
                    >
                      {annualized != null
                        ? `${entry.stockCount ? "平均" : ""}${isPositive ? "+" : ""}${annualized.toFixed(1)}%`
                        : "--"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRerun(entry);
                      }}
                      className="p-1 rounded text-white/30 hover:text-accent hover:bg-accent/10 transition"
                      title="重新运行"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
