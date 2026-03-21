/**
 * Strategy Workbench Panel
 *
 * Unified panel combining Strategy Templates and AI Assistant.
 * Smart tab switching: shows Templates when no code exists,
 * auto-switches to AI Assistant after code is generated.
 *
 * @module components/strategy-editor/strategy-workbench-panel
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { AIStrategyAssistant } from "@/components/strategy-editor/ai-strategy-assistant";
import { StrategyTemplateList } from "@/components/strategy-editor/strategy-templates";
import {
  BuiltinTemplateGrid,
  type BuiltinTemplateSelection,
} from "@/components/strategy-editor/builtin-template-grid";
import type { PlanTier } from "@/lib/config/plan-limits";
import { ContextualHelp, CONTEXTUAL_HELP_CONTENT } from "@/components/ui/contextual-help";

// =============================================================================
// TYPES
// =============================================================================

interface StrategyWorkbenchPanelProps {
  strategyCode: string;
  backtestResult?: unknown;
  currentParameters?: Array<{ name: string; value: number | string | boolean | number[] }>;
  onSelectTemplate: (prompt: string) => void;
  onApplyParameter?: (name: string, value: number | string | boolean) => void;
  onApplyAllSuggestions?: (
    suggestions: Array<{ name: string; value: number | string | boolean }>
  ) => void;
  userPlan?: PlanTier;
  className?: string;
}

type TabId = "templates" | "ai";

// =============================================================================
// COMPONENT
// =============================================================================

export function StrategyWorkbenchPanel({
  strategyCode,
  backtestResult,
  currentParameters,
  onSelectTemplate,
  onApplyParameter,
  onApplyAllSuggestions,
  userPlan,
  className,
}: StrategyWorkbenchPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("templates");
  // Track previous hasCode to detect the first code generation
  const prevHasCodeRef = useRef(!!strategyCode);

  // Smart switch: auto-switch to AI tab when code is generated for the first time
  useEffect(() => {
    const hasCode = !!strategyCode;
    if (hasCode && !prevHasCodeRef.current) {
      setActiveTab("ai");
    }
    prevHasCodeRef.current = hasCode;
  }, [strategyCode]);

  const handleBuiltinTemplateSelect = (template: BuiltinTemplateSelection) => {
    onSelectTemplate(template.prompt);
  };

  return (
    <div className={cn("glass-panel rounded-xl overflow-hidden", className)}>
      {/* Terminal-style header with tab navigation */}
      <div className="terminal-header flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="dot dot-red" />
            <div className="dot dot-yellow" />
            <div className="dot dot-green" />
          </div>
          {/* Tab buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("templates")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all btn-tactile",
                activeTab === "templates"
                  ? "bg-primary/20 text-primary"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
              )}
            >
              📚 模板库
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all btn-tactile",
                activeTab === "ai"
                  ? "bg-primary/20 text-primary"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5",
                !strategyCode && "opacity-50"
              )}
              title={!strategyCode ? "请先生成策略代码" : undefined}
            >
              🤖 AI 助手
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hint when no code */}
          {!strategyCode && (
            <span className="text-[10px] text-neutral-600 font-mono">
              生成代码后解锁 AI 优化
            </span>
          )}
          <ContextualHelp
            sections={CONTEXTUAL_HELP_CONTENT.strategyWorkbench ?? []}
            title="策略工作台帮助"
          />
        </div>
      </div>

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="overflow-auto">
          {/* Builtin template grid — quick-start section */}
          <div className="p-4 border-b border-white/5">
            <BuiltinTemplateGrid
              onSelectTemplate={handleBuiltinTemplateSelect}
              userPlan={userPlan}
            />
          </div>

          {/* Full strategy template library */}
          <div className="p-4">
            <StrategyTemplateList onSelectTemplate={onSelectTemplate} />
          </div>
        </div>
      )}

      {/* AI Assistant Tab */}
      {activeTab === "ai" && (
        strategyCode ? (
          <AIStrategyAssistant
            strategyCode={strategyCode}
            backtestResult={backtestResult as Parameters<typeof AIStrategyAssistant>[0]["backtestResult"]}
            currentParameters={currentParameters}
            onApplyParameter={onApplyParameter}
            onApplyAllSuggestions={onApplyAllSuggestions}
          />
        ) : (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-hover/50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-neutral-400 text-sm mb-1">请先从模板库选择或生成策略代码</p>
            <p className="text-neutral-600 text-xs">AI 助手将在代码生成后自动激活</p>
            <button
              onClick={() => setActiveTab("templates")}
              className="mt-4 px-4 py-1.5 text-xs rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition btn-tactile"
            >
              前往模板库
            </button>
          </div>
        )
      )}
    </div>
  );
}
