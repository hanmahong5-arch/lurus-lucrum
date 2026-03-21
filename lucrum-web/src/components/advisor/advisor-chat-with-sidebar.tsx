"use client";

/**
 * Advisor Chat with Context Sidebar
 *
 * Wraps the existing AdvisorChat in a side-by-side layout:
 * - Left: full chat interface
 * - Right: context sidebar showing current strategy, last backtest, watchlist
 *
 * The sidebar reads from strategy-workspace-store for real-time strategy context.
 */

import { useState, useCallback } from "react";
import { AdvisorChat } from "./advisor-chat";
import {
  useStrategyWorkspaceStore,
  selectWorkspace,
} from "@/lib/stores/strategy-workspace-store";
import { useAdvisorStore } from "@/lib/stores/advisor-store";
import { cn } from "@/lib/utils";
import type { BacktestResult } from "@/lib/backtest/types";

// =============================================================================
// Props
// =============================================================================

interface AdvisorChatWithSidebarProps {
  initialSymbol?: string;
  initialSymbolName?: string;
}

// =============================================================================
// Context Sidebar
// =============================================================================

function ContextSidebar() {
  const workspace = useStrategyWorkspaceStore(selectWorkspace);
  const advisorStore = useAdvisorStore();

  // Extract strategy info from workspace
  const hasStrategy = workspace.generatedCode.length > 0;
  const strategyName = workspace.strategyInput || "未命名策略";
  const backtestResult = workspace.lastBacktestResult as
    | BacktestResult
    | undefined;
  const hasBacktest =
    backtestResult &&
    typeof backtestResult === "object" &&
    "totalReturn" in backtestResult;

  // Derive common watchlist stocks (from selected agents)
  const selectedAgents = advisorStore.selectedAgents;

  return (
    <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
      {/* Current Strategy */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h4 className="text-xs text-white/50 uppercase tracking-wide font-medium mb-3">
          当前策略
        </h4>
        {hasStrategy ? (
          <div className="space-y-2">
            <div className="text-sm text-white font-medium truncate">
              {strategyName.slice(0, 40)}
            </div>
            <div className="flex flex-wrap gap-1">
              {workspace.parameters.slice(0, 4).map((p) => (
                <span
                  key={p.name}
                  className="text-[10px] px-1.5 py-0.5 bg-white/5 text-white/50 rounded font-mono tabular-nums"
                >
                  {p.displayName}: {String(p.value)}
                </span>
              ))}
            </div>
            {workspace.parameters.length > 4 && (
              <span className="text-[10px] text-white/30">
                +{workspace.parameters.length - 4} 更多参数
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-white/30">
            暂未加载策略
            <br />
            前往策略工坊创建
          </div>
        )}
      </div>

      {/* Recent Backtest */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h4 className="text-xs text-white/50 uppercase tracking-wide font-medium mb-3">
          最近回测
        </h4>
        {hasBacktest ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-white/40">年化收益</span>
                <div
                  className={cn(
                    "font-mono tabular-nums font-medium",
                    (backtestResult.annualizedReturn ?? 0) >= 0
                      ? "text-profit"
                      : "text-loss"
                  )}
                >
                  {((backtestResult.annualizedReturn ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-white/40">夏普比</span>
                <div className="text-white font-mono tabular-nums font-medium">
                  {(backtestResult.sharpeRatio ?? 0).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-white/40">最大回撤</span>
                <div className="text-loss font-mono tabular-nums font-medium">
                  -{(Math.abs(backtestResult.maxDrawdown ?? 0) * 100).toFixed(1)}
                  %
                </div>
              </div>
              <div>
                <span className="text-white/40">胜率</span>
                <div className="text-white font-mono tabular-nums font-medium">
                  {(backtestResult.winRate ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-white/30">暂无回测结果</div>
        )}
      </div>

      {/* Active Agents */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h4 className="text-xs text-white/50 uppercase tracking-wide font-medium mb-3">
          活跃代理
        </h4>
        {selectedAgents.length > 0 ? (
          <div className="space-y-1.5">
            {selectedAgents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2 text-xs text-white/70"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="truncate">{agent.name}</span>
                {agent.school && (
                  <span className="text-white/30 ml-auto shrink-0">
                    {agent.school}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-white/30">未选择代理</div>
        )}
      </div>

      {/* Conversation Info */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h4 className="text-xs text-white/50 uppercase tracking-wide font-medium mb-3">
          对话信息
        </h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/40">消息数</span>
            <span className="text-white font-mono tabular-nums">
              {advisorStore.messages.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">模式</span>
            <span className="text-accent">
              {advisorStore.mode === "chat" ? "对话" : "辩论"}
            </span>
          </div>
          {advisorStore.conversationTitle && (
            <div className="pt-1 border-t border-border">
              <span className="text-white/40">主题: </span>
              <span className="text-white/70">
                {advisorStore.conversationTitle}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AdvisorChatWithSidebar({
  initialSymbol,
  initialSymbolName,
}: AdvisorChatWithSidebarProps) {
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <div className="flex gap-4">
      {/* Chat area */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 mb-2">
          <div className="text-xs text-white/40 flex items-center gap-2">
            <span className="text-accent">*</span>
            <span>
              <span className="text-white/60">决策质量</span> &gt; 执行速度
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className={cn(
              "p-1.5 rounded-lg text-xs transition-colors",
              showSidebar
                ? "bg-accent/10 text-accent"
                : "text-white/40 hover:text-white/60"
            )}
            title={showSidebar ? "隐藏上下文面板" : "显示上下文面板"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
        </div>

        <div className="h-[calc(100vh-300px)] min-h-[400px]">
          <AdvisorChat
            className="h-full"
            initialSymbol={initialSymbol}
            initialSymbolName={initialSymbolName}
          />
        </div>
      </div>

      {/* Context sidebar (collapsible) */}
      {showSidebar && (
        <div className="hidden lg:block">
          <ContextSidebar />
        </div>
      )}
    </div>
  );
}
