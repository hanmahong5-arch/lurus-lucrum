/**
 * Template Quick Select Component
 *
 * Visual card-based template selector with category filtering.
 * Replaces dropdown-style selection with a chip grid for faster
 * template discovery. Categories: trend, mean-revert, momentum,
 * composite, pattern.
 *
 * Features:
 * - Category chip filter bar
 * - Card grid with strategy name, description, key indicator, expected score
 * - Unsaved changes confirmation before loading
 * - Remembers last selected category via user-preferences-store
 *
 * @module components/strategy-editor/template-quick-select
 */

"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  categoryInfo,
  type StrategyCategory,
} from "@/lib/strategy-templates";
import {
  BUILTIN_TEMPLATES,
  type BuiltinTemplate,
} from "@/lib/strategy-templates/builtin-templates";
import {
  useUserPreferencesStore,
  selectLastTemplateCategory,
} from "@/lib/stores/user-preferences-store";

// =============================================================================
// TYPES
// =============================================================================

interface TemplateQuickSelectProps {
  /** Callback when a template is selected */
  onSelectTemplate: (prompt: string, code?: string) => void;
  /** Whether the workspace has unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CATEGORY CHIP CONFIG
// =============================================================================

const FILTER_CATEGORIES: Array<{
  id: string;
  label: string;
  icon: string;
  match: StrategyCategory[];
}> = [
  { id: "all", label: "全部", icon: "📋", match: [] },
  { id: "trend", label: "趋势跟踪", icon: "📈", match: ["trend"] },
  { id: "mean-revert", label: "均值回归", icon: "🔄", match: ["mean-revert"] },
  { id: "momentum", label: "动量", icon: "🚀", match: ["momentum"] },
  { id: "composite", label: "混合", icon: "🔗", match: ["composite", "pattern", "factor"] },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function TemplateQuickSelect({
  onSelectTemplate,
  hasUnsavedChanges = false,
  className,
}: TemplateQuickSelectProps) {
  // Persist category selection
  const savedCategory = useUserPreferencesStore(selectLastTemplateCategory);
  const setLastCategory = useUserPreferencesStore((s) => s.setLastTemplateCategory);

  const [activeCategory, setActiveCategory] = useState(savedCategory || "all");
  const [confirmTarget, setConfirmTarget] = useState<BuiltinTemplate | null>(null);

  // Sync from store on mount
  useEffect(() => {
    if (savedCategory && savedCategory !== activeCategory) {
      setActiveCategory(savedCategory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter templates by category
  const filteredTemplates = useMemo(() => {
    if (activeCategory === "all") return BUILTIN_TEMPLATES;
    const config = FILTER_CATEGORIES.find((c) => c.id === activeCategory);
    if (!config || config.match.length === 0) return BUILTIN_TEMPLATES;
    return BUILTIN_TEMPLATES.filter((t) => config.match.includes(t.category));
  }, [activeCategory]);

  // Handle category switch
  const handleCategoryChange = useCallback(
    (catId: string) => {
      setActiveCategory(catId);
      setLastCategory(catId);
    },
    [setLastCategory]
  );

  // Handle template click with unsaved changes guard.
  // Pass `template.code` so the parent loads the curated Python directly
  // — the prompt-only path was forcing a redundant LLM round-trip that
  // produced strictly-worse output than the hand-written template code.
  const handleTemplateClick = useCallback(
    (template: BuiltinTemplate) => {
      if (hasUnsavedChanges) {
        setConfirmTarget(template);
        return;
      }
      onSelectTemplate(template.prompt, template.code);
    },
    [hasUnsavedChanges, onSelectTemplate]
  );

  // Confirm load despite unsaved changes
  const handleConfirmLoad = useCallback(() => {
    if (confirmTarget) {
      onSelectTemplate(confirmTarget.prompt, confirmTarget.code);
  setConfirmTarget(null);
    }
  }, [confirmTarget, onSelectTemplate]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all btn-tactile border",
              activeCategory === cat.id
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-surface border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10"
            )}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template card grid */}
      <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "bg-surface/50 border-white/5 hover:border-primary/30 hover:bg-surface",
              "group cursor-pointer"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{template.icon}</span>
                  <span className="text-sm font-medium text-neutral-200 truncate">
                    {template.name}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
                  {template.description}
                </p>
                {/* Key indicator chips */}
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {template.conditions.buy.slice(0, 2).map((cond, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 text-[10px] bg-profit/10 text-profit/80 rounded font-mono"
                    >
                      {cond.length > 20 ? cond.slice(0, 20) + "..." : cond}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {/* Expected score range */}
                <span className="text-[10px] font-mono text-neutral-500">
                  {template.expectedScoreRange.min}-{template.expectedScoreRange.max}
                </span>
                {/* Use arrow */}
                <span className="text-neutral-600 group-hover:text-primary transition-colors text-xs">
                  &rarr;
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Unsaved changes confirmation overlay */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-modal border border-white/10 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-sm font-medium text-neutral-200 mb-2">
              有未保存的更改
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              加载模板「{confirmTarget.name}」将覆盖当前策略，是否继续？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 text-xs rounded-lg bg-surface border border-white/10 text-neutral-300 hover:bg-surface-hover transition btn-tactile"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLoad}
                className="px-4 py-2 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 transition btn-tactile"
              >
                确认加载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
