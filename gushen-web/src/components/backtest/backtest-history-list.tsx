/**
 * BacktestHistoryList Component
 *
 * Displays the most recent backtest records with grade, return, and strategy info.
 * Supports keyboard navigation (ArrowUp/ArrowDown) and click-to-restore.
 * Shows EmptyState preset when no records exist.
 *
 * @module components/backtest/backtest-history-list
 */

"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import type { BacktestHistoryEntry } from "@/lib/stores/backtest-history-store";
import type { ScoreGrade } from "@/lib/backtest/score";
import Decimal from "decimal.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grade text color classes matching ScoreCard design tokens */
const GRADE_COLOR_CLASS: Record<ScoreGrade, string> = {
  S: "text-score-s",
  A: "text-score-a",
  B: "text-score-b",
  C: "text-score-c",
  D: "text-score-d",
};

/** Grade background color classes */
const GRADE_BG_CLASS: Record<ScoreGrade, string> = {
  S: "bg-score-s/10",
  A: "bg-score-a/10",
  B: "bg-score-b/10",
  C: "bg-score-c/10",
  D: "bg-score-d/10",
};

/** Grade descriptions for accessibility */
const GRADE_DESCRIPTIONS: Record<ScoreGrade, string> = {
  S: "卓越",
  A: "优秀",
  B: "良好",
  C: "一般",
  D: "需改进",
};

// =============================================================================
// TYPES
// =============================================================================

export interface BacktestHistoryListProps {
  /** List of backtest history entries (sorted by timestamp desc) */
  entries: BacktestHistoryEntry[];
  /** Currently selected entry ID */
  selectedId?: string | null;
  /** Callback when a row is clicked/selected */
  onSelect: (id: string) => void;
  /** Callback for the "run first backtest" action (empty state) */
  onRunBacktest: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format a unix timestamp to a human-readable relative or absolute date.
 * Uses Chinese locale conventions.
 */
function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  // Beyond 7 days, show date
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

/**
 * Format a Decimal string return value as a percentage with sign.
 */
function formatReturn(value: string): { text: string; isPositive: boolean } {
  const dec = new Decimal(value);
  const pct = dec.times(100);
  const isPositive = dec.greaterThanOrEqualTo(0);
  const sign = isPositive ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    isPositive,
  };
}

// =============================================================================
// ROW COMPONENT
// =============================================================================

interface HistoryRowProps {
  entry: BacktestHistoryEntry;
  isSelected: boolean;
  onClick: () => void;
}

function HistoryRow({ entry, isSelected, onClick }: HistoryRowProps) {
  const returnInfo = formatReturn(entry.totalReturn);

  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`${entry.strategyName} ${entry.symbol} 评分${entry.grade}${GRADE_DESCRIPTIONS[entry.grade]} 收益${returnInfo.text}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
        "hover:bg-surface-hover",
        isSelected
          ? "bg-surface-hover ring-1 ring-primary/30"
          : "bg-transparent"
      )}
    >
      {/* Left: timestamp + strategy + symbol */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Grade badge */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold",
            GRADE_COLOR_CLASS[entry.grade],
            GRADE_BG_CLASS[entry.grade]
          )}
          aria-hidden="true"
        >
          {entry.grade}
        </div>

        {/* Strategy info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {entry.strategyName}
            </span>
            <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
              {entry.symbol}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTimestamp(entry.timestamp)}
            {entry.tradeCount > 0 && (
              <span className="ml-2 tabular-nums font-mono">
                {entry.tradeCount}笔交易
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: return */}
      <div className="shrink-0 ml-3 text-right">
        <span
          className={cn(
            "text-sm font-mono font-medium tabular-nums",
            returnInfo.isPositive ? "text-profit" : "text-loss"
          )}
        >
          {returnInfo.text}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BacktestHistoryList({
  entries,
  selectedId,
  onSelect,
  onRunBacktest,
  className,
}: BacktestHistoryListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation on the list container
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (entries.length === 0) return;

      const currentIndex = selectedId
        ? entries.findIndex((entry) => entry.id === selectedId)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex + 1;
        if (nextIndex < entries.length) {
          const nextEntry = entries[nextIndex];
          if (nextEntry) {
            onSelect(nextEntry.id);
          }
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          const prevEntry = entries[prevIndex];
          if (prevEntry) {
            onSelect(prevEntry.id);
          }
        }
      }
    },
    [entries, selectedId, onSelect]
  );

  // Empty state
  if (entries.length === 0) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="flex items-center justify-between px-3 py-2 mb-2">
          <h3 className="text-sm font-medium text-foreground">回测历史</h3>
        </div>
        <EmptyState
          icon={BarChart3}
          title="还没有回测记录"
          description="运行你的第一次回测，验证策略表现"
          actions={[
            {
              label: "运行第一次回测",
              onClick: onRunBacktest,
              variant: "primary",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 mb-1">
        <h3 className="text-sm font-medium text-foreground">回测历史</h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-mono tabular-nums text-primary">
          {entries.length}
        </span>
      </div>

      {/* List */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="回测历史列表"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-0.5 outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded-lg"
      >
        {entries.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            isSelected={selectedId === entry.id}
            onClick={() => onSelect(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}
