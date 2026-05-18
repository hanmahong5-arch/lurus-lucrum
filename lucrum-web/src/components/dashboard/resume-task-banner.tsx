/**
 * Resume-task banner.
 *
 * Shown when the user returns to the workbench while an `inflightTask` is
 * still recorded in the workspace store. The actual fetch promise died with
 * the previous mount, so we offer the user a chance to resume (re-trigger
 * the operation) or dismiss it.
 *
 * Stale tasks (>10min old) are dropped automatically by the store's
 * rehydration logic, so this only renders for recent navigations.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useStrategyWorkspaceStore,
  selectInflightTask,
} from "@/lib/stores/strategy-workspace-store";

interface ResumeTaskBannerProps {
  /** Called when the user clicks "resume". Implementation differs per task kind. */
  onResume: (task: { kind: "generate" | "backtest"; label: string }) => void;
  className?: string;
}

export function ResumeTaskBanner({ onResume, className }: ResumeTaskBannerProps) {
  const inflightTask = useStrategyWorkspaceStore(selectInflightTask);
  const clearInflightTask = useStrategyWorkspaceStore((s) => s.clearInflightTask);

  const ageLabel = useMemo(() => {
    if (!inflightTask) return null;
    const ms = Date.now() - new Date(inflightTask.startedAt).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    return `${hours} 小时前`;
  }, [inflightTask]);

  if (!inflightTask) return null;

  return (
    <div
      className={cn(
        "mx-4 mt-2 flex items-center justify-between gap-3 p-3 rounded-lg",
        "bg-primary/10 border border-primary/30",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <svg
          className="w-5 h-5 text-primary shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="min-w-0">
          <p className="text-xs text-neutral-300">
            上次离开时正在 <span className="text-primary font-medium">{inflightTask.label}</span>
            <span className="text-neutral-500 ml-2">{ageLabel}</span>
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            后台任务已中断，是否重新发起？
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            onResume({ kind: inflightTask.kind, label: inflightTask.label });
            clearInflightTask();
          }}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg btn-tactile",
            "bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30",
          )}
        >
          重新发起
        </button>
        <button
          onClick={clearInflightTask}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg btn-tactile",
            "bg-surface border border-white/5 text-neutral-400 hover:text-neutral-200",
          )}
        >
          忽略
        </button>
      </div>
    </div>
  );
}
