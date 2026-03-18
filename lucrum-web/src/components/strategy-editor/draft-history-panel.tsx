/**
 * Draft History Panel Component
 * 草稿历史面板组件
 *
 * Displays saved strategy editing drafts with timestamps and preview.
 * Allows users to restore previous versions or delete drafts.
 *
 * Features:
 * - List of all saved drafts with timestamps
 * - Preview of strategy input and parameters
 * - One-click restore functionality
 * - Delete individual drafts
 * - Clear all drafts option
 *
 * @module components/strategy-editor/draft-history-panel
 */

"use client";

import { useState } from "react";
import { useStrategyWorkspaceStore } from "@/lib/stores/strategy-workspace-store";
import { cn } from "@/lib/utils";
import {
  Clock,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
} from "lucide-react";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface DraftHistoryPanelProps {
  className?: string;
}

// =============================================================================
// COMPONENT / 组件实现
// =============================================================================

/**
 * Draft History Panel
 * Displays and manages saved strategy editing drafts
 */
export function DraftHistoryPanel({ className }: DraftHistoryPanelProps) {
  const { drafts, loadDraft, deleteDraft, clearAllDrafts } =
    useStrategyWorkspaceStore();

  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Handle draft restoration
  const handleRestoreDraft = (draftId: string) => {
    loadDraft(draftId);
    setExpandedDraftId(null);
  };

  // Handle draft deletion
  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDraft(draftId);
    if (expandedDraftId === draftId) {
      setExpandedDraftId(null);
    }
  };

  // Handle clear all drafts
  const handleClearAll = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3000);
      return;
    }
    clearAllDrafts();
    setConfirmClearAll(false);
    setExpandedDraftId(null);
  };

  // Toggle draft expansion
  const toggleExpand = (draftId: string) => {
    setExpandedDraftId(expandedDraftId === draftId ? null : draftId);
  };

  // Format time ago
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}秒前`;
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    return `${diffDay}天前`;
  };

  // Format date
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Truncate text for preview
  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-surface/50 border border-white/10 rounded-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold text-white">
            草稿历史 Draft History
          </h3>
          <span className="text-xs text-text-secondary">
            ({drafts.length}/10)
          </span>
        </div>

        {drafts.length > 0 && (
          <button
            onClick={handleClearAll}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              confirmClearAll
                ? "bg-loss/20 text-loss hover:bg-loss/30"
                : "bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white"
            )}
          >
            {confirmClearAll ? (
              <>
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                确认清空？
              </>
            ) : (
              "清空全部"
            )}
          </button>
        )}
      </div>

      {/* Draft List */}
      <div className="flex-1 overflow-y-auto max-h-[500px]">
        {drafts.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FileText className="w-12 h-12 text-white/20 mb-3" />
            <p className="text-sm text-text-secondary">
              暂无保存的草稿
              <br />
              No saved drafts yet
            </p>
          </div>
        ) : (
          // Draft items
          <div className="divide-y divide-white/5">
            {drafts.map((draft) => {
              const isExpanded = expandedDraftId === draft.id;
              const workspace = draft.workspace;

              return (
                <div
                  key={draft.id}
                  className="hover:bg-white/5 transition-colors"
                >
                  {/* Draft header - clickable to expand */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => toggleExpand(draft.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Expand/collapse icon */}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      )}

                      {/* Draft info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-white">
                            {formatDate(draft.timestamp)}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {getTimeAgo(draft.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary truncate">
                          {workspace.strategyInput ||
                            workspace.generatedCode
                              .split("\n")
                              .find((line) => line.trim().startsWith("# "))
                              ?.replace("# ", "") ||
                            "(未命名策略)"}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreDraft(draft.id);
                        }}
                        className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                        title="恢复此草稿"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                        className="p-1.5 rounded-lg bg-white/5 text-text-secondary hover:bg-loss/20 hover:text-loss transition-colors"
                        title="删除此草稿"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content - preview */}
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2">
                      {/* Strategy input preview */}
                      {workspace.strategyInput && (
                        <div className="bg-white/5 rounded-lg p-3">
                          <div className="text-xs font-medium text-text-secondary mb-1">
                            策略描述:
                          </div>
                          <div className="text-xs text-white leading-relaxed">
                            {truncateText(workspace.strategyInput, 200)}
                          </div>
                        </div>
                      )}

                      {/* Generated code preview */}
                      {workspace.generatedCode && (
                        <div className="bg-white/5 rounded-lg p-3">
                          <div className="text-xs font-medium text-text-secondary mb-1">
                            生成的代码:
                          </div>
                          <pre className="text-xs text-white/80 overflow-x-auto">
                            {truncateText(workspace.generatedCode, 300)}
                          </pre>
                        </div>
                      )}

                      {/* Parameters count */}
                      {workspace.parameters.length > 0 && (
                        <div className="text-xs text-text-secondary">
                          参数: {workspace.parameters.length} 个 | 修改:{" "}
                          {workspace.modifiedParams.size} 个
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with tips */}
      {drafts.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10 bg-white/5">
          <p className="text-xs text-text-secondary">
            💡 提示: 点击草稿可展开预览，点击
            <RotateCcw className="w-3 h-3 inline mx-1" />
            恢复草稿
          </p>
        </div>
      )}
    </div>
  );
}
