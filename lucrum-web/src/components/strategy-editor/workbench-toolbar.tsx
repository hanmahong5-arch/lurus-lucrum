/**
 * Workbench Toolbar Component
 *
 * Top toolbar for the strategy workbench with:
 * - Strategy name (editable inline)
 * - Save dropdown (save draft / save to database)
 * - History button (opens draft history)
 * - Export button
 * - Auto-save status indicator
 *
 * @module components/strategy-editor/workbench-toolbar
 */

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { AutoSaveIndicator } from "./auto-save-indicator";
import {
  useStrategyWorkspaceStore,
  selectAutoSaveStatus,
  selectDrafts,
} from "@/lib/stores/strategy-workspace-store";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

// =============================================================================
// VERSION TIMELINE DROPDOWN
// =============================================================================

/**
 * Time-Travel dropdown — surfaces the last 5 auto-saved drafts as a one-click
 * rollback list. Reads from `useStrategyWorkspaceStore.drafts` (already
 * persisted) so this is a pure UI layer; no new state.
 *
 * Sprint 0 W3-4 #5 — Replit-style checkpoint UX, lightweight version.
 */
function VersionTimeline() {
  const drafts = useStrategyWorkspaceStore(selectDrafts);
  const loadDraft = useStrategyWorkspaceStore((s) => s.loadDraft);

  const items = useMemo(() => drafts.slice(0, 5), [drafts]);

  if (items.length === 0) {
    return null; // Hide entirely on first session — nothing to time-travel to.
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile",
            "flex items-center gap-1.5 border outline-none",
            "bg-surface border-white/5 text-neutral-400",
            "hover:text-neutral-200 hover:border-white/10",
            "data-[state=open]:text-neutral-100 data-[state=open]:border-white/15",
          )}
          aria-label="版本时间线"
          title="回到此前任意自动保存的版本"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6"
            />
          </svg>
          版本
          <span className="text-[10px] text-white/40 font-mono ml-0.5">
            ({items.length})
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[16rem] rounded-lg p-1",
            "bg-surface border border-white/10 shadow-lg",
            "animate-slide-down",
          )}
        >
          <DropdownMenu.Label className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500">
            最近 {items.length} 次自动保存
          </DropdownMenu.Label>
          {items.map((draft, idx) => {
            const ts = new Date(draft.timestamp);
            const timeAgo = formatTimeAgo(ts);
            const preview =
              draft.workspace.strategyName?.trim() ||
              draft.workspace.strategyInput?.slice(0, 28).trim() ||
              "未命名草稿";
            return (
              <DropdownMenu.Item
                key={draft.id}
                onSelect={(e) => {
                  e.preventDefault();
                  loadDraft(draft.id);
                }}
                className={cn(
                  "flex items-start justify-between gap-3 px-2 py-1.5 text-xs rounded cursor-pointer outline-none",
                  "text-neutral-300 hover:text-neutral-100 hover:bg-white/5 focus:bg-white/5",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white/50 w-6 shrink-0">
                      v{items.length - idx}
                    </span>
                    <span className="truncate">{preview}</span>
                  </div>
                  <div className="text-[10px] text-white/40 pl-8">
                    {timeAgo} ·{" "}
                    {(draft.workspace.generatedCode?.length ?? 0).toLocaleString()} 字符
                  </div>
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function formatTimeAgo(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec} 秒前`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

// =============================================================================
// TYPES
// =============================================================================

interface WorkbenchToolbarProps {
  /** Current strategy name */
  strategyName: string;
  /** Callback when strategy name changes */
  onNameChange: (name: string) => void;
  /** Callback for save action */
  onSave: () => void;
  /** Callback to toggle draft history panel */
  onToggleHistory: () => void;
  /** Whether history panel is visible */
  historyVisible: boolean;
  /** Callback for export */
  onExport: () => void;
  /** Whether there is generated code */
  hasCode: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function WorkbenchToolbar({
  strategyName,
  onNameChange,
  onSave,
  onToggleHistory,
  historyVisible,
  onExport,
  hasCode,
  className,
}: WorkbenchToolbarProps) {
  const autoSaveStatus = useStrategyWorkspaceStore(selectAutoSaveStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(strategyName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit value when prop changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(strategyName);
    }
  }, [strategyName, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== strategyName) {
      onNameChange(trimmed);
    } else {
      setEditValue(strategyName);
    }
    setIsEditing(false);
  }, [editValue, strategyName, onNameChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleNameSubmit();
      } else if (e.key === "Escape") {
        setEditValue(strategyName);
        setIsEditing(false);
      }
    },
    [handleNameSubmit, strategyName]
  );

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2",
        "bg-surface/60 backdrop-blur-sm border-b border-white/5",
        className
      )}
    >
      {/* Left side: title + strategy name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <h1 className="text-sm font-semibold text-neutral-200 shrink-0">
          策略工作台
        </h1>

        <span className="text-neutral-600">|</span>

        {/* Editable strategy name */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className={cn(
              "bg-surface border border-primary/30 rounded px-2 py-0.5",
              "text-sm text-neutral-200 font-medium",
              "focus:outline-none focus:border-primary/60",
              "min-w-[120px] max-w-[300px]"
            )}
            maxLength={50}
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-neutral-300 hover:text-neutral-100 transition truncate max-w-[250px] group flex items-center gap-1"
            title="点击编辑策略名称"
          >
            <span className="truncate">{strategyName || "未命名策略"}</span>
            <svg
              className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}

        {/* Auto-save indicator */}
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      {/* Right side: action buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Save button */}
        <button
          onClick={onSave}
          disabled={autoSaveStatus === "saved"}
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile",
            "flex items-center gap-1.5 border",
            autoSaveStatus === "saved"
              ? "bg-surface border-white/5 text-neutral-500"
              : "bg-primary/20 border-primary/30 text-primary hover:bg-primary/30"
          )}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          保存
        </button>

        {/* Time-Travel version dropdown — quick rollback to recent drafts */}
        <VersionTimeline />

        {/* History button */}
        <button
          onClick={onToggleHistory}
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile",
            "flex items-center gap-1.5 border",
            historyVisible
              ? "bg-primary/20 border-primary/30 text-primary"
              : "bg-surface border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10"
          )}
        >
          <svg
            className="w-3.5 h-3.5"
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
          历史
        </button>

        {/* Theme switcher - sits alongside other right-cluster toolbar buttons */}
        <ThemeSwitcher />

        {/* Export button */}
        <button
          onClick={onExport}
          disabled={!hasCode}
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile",
            "flex items-center gap-1.5 border",
            "bg-surface border-white/5",
            hasCode
              ? "text-neutral-400 hover:text-neutral-200 hover:border-white/10"
              : "text-neutral-600 cursor-not-allowed"
          )}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          导出
        </button>
      </div>
    </div>
  );
}
