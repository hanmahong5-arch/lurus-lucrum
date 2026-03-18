"use client";

/**
 * BatchProgressBar Component
 * Displays real-time progress during parallel batch backtest execution.
 * Shows: completed/total count, progress bar, failure badge, elapsed/remaining time, cancel button.
 */

import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export type BatchStatus = "idle" | "running" | "complete" | "cancelled" | "error";

export interface BatchProgressBarProps {
  status: BatchStatus;
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
  currentItem?: string;
  onCancel?: () => void;
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return ms.toFixed(0) + "ms";
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + "s";
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return m + "m " + rs + "s";
}

function estimateRemaining(completed: number, total: number, elapsedMs: number): string {
  if (completed === 0 || completed >= total) return "--";
  const avgPerItem = elapsedMs / completed;
  const remaining = (total - completed) * avgPerItem;
  return "~" + formatDuration(remaining);
}

// =============================================================================
// Component
// =============================================================================

export function BatchProgressBar({
  status, completed, total, failed, elapsedMs, currentItem, onCancel, className,
}: BatchProgressBarProps) {
  if (status === "idle") return null;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isRunning = status === "running";
  const isDone = status === "complete";
  const isCancelled = status === "cancelled";

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isDone ? "border-accent/30 bg-accent/5" : isCancelled ? "border-yellow-500/30 bg-yellow-500/5" : status === "error" ? "border-loss/30 bg-loss/5" : "border-white/10 bg-surface",
        className,
      )}
      data-testid="batch-progress-bar"
    >
      {/* Header row: status text + cancel button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/80">
            {isDone && "已完成"}
            {isCancelled && "已取消 - "}
            {isRunning && "正在验证..."}
            {status === "error" && "执行出错"}
          </span>
          <span className="font-mono tabular-nums text-sm text-white">
            {completed}/{total}
          </span>
          {failed > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs font-mono tabular-nums bg-loss/20 text-loss" data-testid="failed-badge">
              {failed} 失败
            </span>
          )}
        </div>
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="btn-tactile px-3 py-1 text-xs rounded border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition"
            data-testid="cancel-button"
          >
            取消
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-void/50 rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isDone ? "bg-accent" : isCancelled ? "bg-yellow-500" : status === "error" ? "bg-loss" : "bg-accent",
          )}
          style={{ width: pct + "%" }}
          data-testid="progress-fill"
        />
      </div>

      {/* Footer: timing info + current item */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <div className="flex gap-3">
          <span className="font-mono tabular-nums">
            已用: {formatDuration(elapsedMs)}
          </span>
          {isRunning && (
            <span className="font-mono tabular-nums">
              剩余: {estimateRemaining(completed, total, elapsedMs)}
            </span>
          )}
        </div>
        {currentItem && isRunning && (
          <span className="font-mono text-white/30 truncate max-w-[200px]">
            {currentItem}
          </span>
        )}
      </div>
    </div>
  );
}
