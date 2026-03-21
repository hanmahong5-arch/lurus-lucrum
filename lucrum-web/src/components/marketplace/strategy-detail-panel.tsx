"use client";

/**
 * StrategyDetailPanel - Slide-over panel for previewing marketplace strategy.
 *
 * Shows:
 * - Strategy description
 * - Code preview (read-only)
 * - Backtest results chart placeholder
 * - "Try this strategy" CTA
 */

import { useCallback, useEffect, useState } from "react";
import { X, Code2, BarChart3, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import type { MarketplaceStrategy } from "./strategy-card";

// =============================================================================
// TYPES
// =============================================================================

interface StrategyDetailPanelProps {
  strategy: MarketplaceStrategy | null;
  onClose: () => void;
  onTryStrategy: (strategy: MarketplaceStrategy) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StrategyDetailPanel({
  strategy,
  onClose,
  onTryStrategy,
}: StrategyDetailPanelProps) {
  const [activeSection, setActiveSection] = useState<"desc" | "code" | "results">("desc");

  // Reset section when strategy changes
  useEffect(() => {
    setActiveSection("desc");
  }, [strategy?.id]);

  // Close on Escape key
  useEffect(() => {
    if (!strategy) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [strategy, onClose]);

  const handleTry = useCallback(() => {
    if (strategy) onTryStrategy(strategy);
  }, [strategy, onTryStrategy]);

  if (!strategy) return null;

  const annualized = strategy.annualizedReturn ?? null;
  const winRate = strategy.winRate ?? null;
  const maxDD = strategy.maxDrawdown ?? null;
  const sharpe = strategy.sharpeRatio ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-surface border-l border-border shadow-card-lg animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {strategy.gradeScore && (
              <span className="text-xs font-bold text-score-a border border-score-a/30 bg-score-a/10 px-1.5 py-0.5 rounded">
                {strategy.gradeScore.charAt(0).toUpperCase()}
              </span>
            )}
            <h2 className="text-sm font-semibold text-white truncate">
              {strategy.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition shrink-0"
            aria-label="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-border shrink-0">
          <div className="text-center">
            <div className="text-[10px] text-white/40 mb-0.5">年化</div>
            <div
              className={cn(
                "text-sm font-mono tabular-nums font-medium",
                annualized != null
                  ? annualized >= 0
                    ? "text-profit"
                    : "text-loss"
                  : "text-white/40",
              )}
            >
              {annualized != null ? `${annualized >= 0 ? "+" : ""}${annualized.toFixed(1)}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-white/40 mb-0.5">胜率</div>
            <div className="text-sm font-mono tabular-nums text-white/80">
              {winRate != null ? `${winRate.toFixed(0)}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-white/40 mb-0.5">回撤</div>
            <div
              className={cn(
                "text-sm font-mono tabular-nums",
                maxDD != null && maxDD < 0 ? "text-loss" : "text-white/60",
              )}
            >
              {maxDD != null ? `${maxDD.toFixed(1)}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-white/40 mb-0.5">Sharpe</div>
            <div className="text-sm font-mono tabular-nums text-white/80">
              {sharpe != null ? sharpe.toFixed(2) : "--"}
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border shrink-0">
          {[
            { key: "desc" as const, label: "描述", icon: FileText },
            { key: "code" as const, label: "代码预览", icon: Code2 },
            { key: "results" as const, label: "回测结果", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition",
                activeSection === key
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5",
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeSection === "desc" && (
            <div className="space-y-4">
              <p className="text-sm text-white/70 leading-relaxed">
                {strategy.description ?? "该策略暂无详细描述。"}
              </p>

              <div className="flex items-center justify-between text-xs text-white/40">
                <span>
                  作者: {strategy.authorName ?? "匿名"}
                </span>
                <span>
                  运行 {strategy.totalRuns ?? 0} 次 | {strategy.totalSubscribers ?? 0} 订阅
                </span>
              </div>

              {strategy.publishedAt && (
                <div className="text-xs text-white/30">
                  发布于 {new Date(strategy.publishedAt).toLocaleDateString("zh-CN")}
                </div>
              )}
            </div>
          )}

          {activeSection === "code" && (
            <div className="terminal-block p-4 text-xs text-white/60 overflow-x-auto">
              <pre className="whitespace-pre-wrap break-words font-mono">
{`# Strategy code preview is not available in marketplace.
# Subscribe or try the strategy to load it into your workspace.
#
# This strategy uses the following indicators:
# - Technical analysis signals
# - Price action patterns
# - Volume confirmation
#
# Parameters can be customized after loading.`}
              </pre>
            </div>
          )}

          {activeSection === "results" && (
            <div className="space-y-4">
              {/* Large sparkline */}
              <div className="bg-void/50 rounded-lg p-4 border border-border">
                <div className="text-xs text-white/40 mb-2">净值曲线 (模拟)</div>
                <Sparkline
                  data={strategy.navHistory ?? generateDemoNav(strategy.id)}
                  width={400}
                  height={120}
                  positive={annualized != null ? annualized >= 0 : undefined}
                  className="w-full"
                />
              </div>

              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "年化收益", value: annualized != null ? `${annualized.toFixed(1)}%` : "--" },
                  { label: "胜率", value: winRate != null ? `${winRate.toFixed(1)}%` : "--" },
                  { label: "最大回撤", value: maxDD != null ? `${maxDD.toFixed(1)}%` : "--" },
                  { label: "Sharpe 比率", value: sharpe != null ? sharpe.toFixed(2) : "--" },
                  { label: "总运行次数", value: String(strategy.totalRuns ?? 0) },
                  { label: "订阅人数", value: String(strategy.totalSubscribers ?? 0) },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="bg-void/30 rounded-lg p-3 border border-white/5"
                  >
                    <div className="text-[10px] text-white/40 mb-1">{m.label}</div>
                    <div className="text-sm font-mono tabular-nums text-white/80">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={handleTry}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 rounded-lg text-sm font-medium transition btn-tactile"
          >
            试用此策略
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function generateDemoNav(seed: number): number[] {
  const points = 120;
  const result: number[] = [1.0];
  let value = 1.0;
  let s = seed * 7919 + 104729;
  for (let i = 1; i < points; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.47;
    value = value * (1 + r * 0.025);
    result.push(value);
  }
  return result;
}
