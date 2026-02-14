/**
 * Strategy Detail Panel Component
 *
 * Right-side sliding panel that shows complete strategy details
 * with quick preview backtest capability.
 * Desktop: 40%25 width side panel. Mobile: full-screen sheet.
 * Uses Radix Dialog for focus trap, ESC close, and accessibility.
 *
 * Story 3.3: Strategy Detail Panel & Quick Preview
 *
 * @module components/discovery/strategy-detail-panel
 */

"use client";

import React, { useCallback, useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  X, Star, Eye, ExternalLink, Github, Sparkles,
  Clock, Play, FileCode, Workflow, ArrowLeft, Tag, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodePreview } from "@/components/strategy-editor/code-preview";
import { QuickPreviewResult } from "./quick-preview-result";
import { useQuickPreview } from "@/hooks/use-quick-preview";
import type { StrategyDetail } from "@/hooks/use-strategy-detail";

// =============================================================================
// CONSTANTS
// =============================================================================

const STRATEGY_TYPE_LABELS: Record<string, string> = {
  trend: "Trend Following",
  "mean-revert": "Mean Reversion",
  momentum: "Momentum",
  composite: "Composite",
  factor: "Factor",
  pattern: "Pattern",
};

const STRATEGY_TYPE_COLORS: Record<string, string> = {
  trend: "bg-blue-500/20 text-blue-400",
  "mean-revert": "bg-purple-500/20 text-purple-400",
  momentum: "bg-green-500/20 text-green-400",
  composite: "bg-yellow-500/20 text-yellow-400",
  factor: "bg-cyan-500/20 text-cyan-400",
  pattern: "bg-pink-500/20 text-pink-400",
};

const PARAM_DESCRIPTIONS: Record<string, string> = {
  fast_window: "Short-term moving average period",
  slow_window: "Long-term moving average period",
  stop_loss_pct: "Stop loss percentage threshold",
  fixed_size: "Fixed position size in lots",
  kdj_period: "KDJ indicator calculation period",
  kdj_slow: "KDJ slow stochastic period",
  kdj_smooth: "KDJ smoothing period",
  oversold_threshold: "Oversold signal threshold",
  overbought_threshold: "Overbought signal threshold",
  fast_period: "MACD fast EMA period",
  slow_period: "MACD slow EMA period",
  signal_period: "MACD signal line period",
  volume_ratio_threshold: "Volume ratio trigger threshold",
  volume_ma_period: "Volume moving average period",
  rsi_period: "RSI calculation period",
  rsi_oversold: "RSI oversold threshold",
  rsi_overbought: "RSI overbought threshold",
  atr_period: "ATR calculation period",
  atr_multiplier: "ATR-based stop loss multiplier",
  bb_period: "Bollinger Bands period",
  bb_std: "Bollinger Bands standard deviation",
};

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function SourceLink({ source, url }: { source: string; url: string | null }) {
  const Icon = source === "github" ? Github : Sparkles;
  const label = source === "github" ? "GitHub" : source === "builtin" ? "Built-in" : source;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary transition-colors"
        aria-label={"View on " + label} data-testid="strategy-source-link">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500" data-testid="strategy-source-link">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function MetaInfoRow({ strategy }: { strategy: StrategyDetail }) {
  const updatedDate = useMemo(() => {
    try { return new Date(strategy.updatedAt).toLocaleDateString("zh-CN"); }
    catch { return strategy.updatedAt; }
  }, [strategy.updatedAt]);
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500" data-testid="strategy-meta-info">
      <span className="inline-flex items-center gap-1">
        <Star className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{strategy.likes}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">{strategy.views}</span>
      </span>
      {strategy.popularityScore && (
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3 w-3" aria-hidden="true" />
          <span className="tabular-nums">{parseFloat(strategy.popularityScore).toFixed(1)}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" aria-hidden="true" />
        <span>{updatedDate}</span>
      </span>
    </div>
  );
}

function IndicatorsList({ indicators }: { indicators: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="strategy-indicators">
      {indicators.map((indicator) => (
        <Badge key={indicator} variant="outline" className="text-xs">{indicator}</Badge>
      ))}
    </div>
  );
}

function ParameterList({ params }: { params: Record<string, number | string> }) {
  return (
    <div className="space-y-1.5" data-testid="strategy-params">
      {Object.entries(params).map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-2 py-1 border-b border-neutral-800 last:border-0">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono text-neutral-300">{key}</span>
            {PARAM_DESCRIPTIONS[key] && (
              <p className="text-xs text-neutral-600 mt-0.5">{PARAM_DESCRIPTIONS[key]}</p>
            )}
          </div>
          <span className="text-xs font-mono tabular-nums text-primary shrink-0">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

function ConditionsSummary({ conditions }: { conditions: { buy: string[]; sell: string[]; position?: string } }) {
  return (
    <div className="space-y-2" data-testid="strategy-conditions">
      <div>
        <span className="text-xs font-medium text-profit">Buy Conditions:</span>
        <ul className="mt-1 space-y-0.5">
          {conditions.buy.map((c, i) => (<li key={i} className="text-xs text-neutral-400 pl-3">{c}</li>))}
        </ul>
      </div>
      <div>
        <span className="text-xs font-medium text-loss">Sell Conditions:</span>
        <ul className="mt-1 space-y-0.5">
          {conditions.sell.map((c, i) => (<li key={i} className="text-xs text-neutral-400 pl-3">{c}</li>))}
        </ul>
      </div>
      {conditions.position && (
        <div>
          <span className="text-xs font-medium text-neutral-400">Position Control:</span>
          <p className="text-xs text-neutral-500 mt-0.5">{conditions.position}</p>
        </div>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse p-6" data-testid="detail-skeleton">
      <div className="h-6 w-48 rounded bg-surface-hover" />
      <div className="h-4 w-32 rounded bg-surface-hover" />
      <div className="h-px bg-neutral-800" />
      <div className="h-4 w-full rounded bg-surface-hover" />
      <div className="h-4 w-3/4 rounded bg-surface-hover" />
      <div className="h-px bg-neutral-800" />
      <div className="h-24 rounded bg-surface-hover" />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface StrategyDetailPanelProps {
  strategy: StrategyDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportToEditor: (strategy: StrategyDetail) => void;
  onImportToWorkflow: (strategy: StrategyDetail) => void;
  isLoading?: boolean;
  className?: string;
}

export function StrategyDetailPanel({
  strategy, open, onOpenChange, onImportToEditor, onImportToWorkflow, isLoading = false, className,
}: StrategyDetailPanelProps) {
  const { result, state, error, runPreview, reset } = useQuickPreview();
  const previewCode = strategy?.veighnaCode ?? strategy?.originalCode ?? null;

  const handleQuickPreview = useCallback(() => {
    if (!previewCode) return;
    runPreview(previewCode, strategy?.defaultParams ?? {});
  }, [previewCode, strategy?.defaultParams, runPreview]);

  const handleRetryPreview = useCallback(() => {
    if (!previewCode) return;
    runPreview(previewCode, strategy?.defaultParams ?? {});
  }, [previewCode, strategy?.defaultParams, runPreview]);

  const handleImportToEditor = useCallback(() => {
    if (strategy) { onImportToEditor(strategy); onOpenChange(false); }
  }, [strategy, onImportToEditor, onOpenChange]);

  const handleImportToWorkflow = useCallback(() => {
    if (strategy) { onImportToWorkflow(strategy); onOpenChange(false); }
  }, [strategy, onImportToWorkflow, onOpenChange]);

  const handleClose = useCallback(() => { onOpenChange(false); reset(); }, [onOpenChange, reset]);

  const typeLabel = strategy?.strategyType
    ? STRATEGY_TYPE_LABELS[strategy.strategyType] ?? strategy.strategyType : null;
  const typeColor = strategy?.strategyType
    ? STRATEGY_TYPE_COLORS[strategy.strategyType] ?? "bg-neutral-500/20 text-neutral-400" : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-testid="detail-panel-overlay" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 bg-void border-l border-neutral-800",
            "right-0 top-0 h-full",
            "w-full md:w-[45%] lg:w-[40%]",
            "max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:h-[90vh] max-md:rounded-t-xl max-md:border-t max-md:border-l-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
            "max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom",
            "duration-300", className
          )}
          aria-label={strategy ? "Strategy detail: " + strategy.name : "Strategy detail panel"}
          data-testid="strategy-detail-panel">
          <DialogPrimitive.Close
            className="absolute right-4 top-4 z-10 rounded-sm p-1 text-neutral-500 hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close detail panel" data-testid="detail-panel-close">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
          <DialogPrimitive.Title className="sr-only">
            {strategy?.name ?? "Strategy Detail"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Detailed information and quick preview for the selected strategy.
          </DialogPrimitive.Description>
          <div className="h-full overflow-y-auto">
            {isLoading ? <DetailSkeleton /> : strategy ? (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100 pr-8" data-testid="detail-strategy-name">{strategy.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <SourceLink source={strategy.source} url={strategy.originalUrl} />
                    {typeLabel && (<span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", typeColor)} data-testid="detail-type-badge">{typeLabel}</span>)}
                    {strategy.isFeatured && (<span className="text-xs px-2 py-0.5 rounded-full bg-score-s/20 text-score-s font-medium">Featured</span>)}
                  </div>
                </div>
                <MetaInfoRow strategy={strategy} />
                {strategy.description && <p className="text-sm text-neutral-400">{strategy.description}</p>}
                <div className="h-px bg-neutral-800" />
                {strategy.indicators && strategy.indicators.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 mb-2 flex items-center gap-1">
                      <Info className="h-3 w-3" aria-hidden="true" /> Indicators
                    </h3>
                    <IndicatorsList indicators={strategy.indicators} />
                  </div>
                )}
                {strategy.conditions && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 mb-2">Trading Logic</h3>
                    <ConditionsSummary conditions={strategy.conditions} />
                  </div>
                )}
                {strategy.defaultParams && Object.keys(strategy.defaultParams).length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 mb-2">Parameters</h3>
                    <ParameterList params={strategy.defaultParams} />
                  </div>
                )}
                {(strategy.conditions || strategy.defaultParams) && <div className="h-px bg-neutral-800" />}
                {previewCode && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 mb-2 flex items-center gap-1">
                      <FileCode className="h-3 w-3" aria-hidden="true" /> Strategy Code
                    </h3>
                    <CodePreview code={previewCode} collapsible defaultCollapsed />
                  </div>
                )}
                <div className="h-px bg-neutral-800" />
                <div>
                  {state === "idle" && previewCode && (
                    <Button onClick={handleQuickPreview} variant="outline" className="w-full btn-tactile" data-testid="quick-preview-button">
                      <Play className="h-4 w-4 mr-2" aria-hidden="true" /> Quick Preview (600519 - 1 Year)
                    </Button>
                  )}
                  <QuickPreviewResult data={result} state={state} errorMessage={error ?? undefined} onRetry={handleRetryPreview} />
                </div>
                <div className="h-px bg-neutral-800" />
                <div className="flex flex-col gap-2" data-testid="detail-actions">
                  <Button onClick={handleImportToEditor} className="w-full btn-tactile glow-active" data-testid="import-to-editor-button">
                    <FileCode className="h-4 w-4 mr-2" aria-hidden="true" /> Import to Editor
                  </Button>
                  <Button onClick={handleImportToWorkflow} variant="outline" className="w-full btn-tactile" data-testid="import-to-workflow-button">
                    <Workflow className="h-4 w-4 mr-2" aria-hidden="true" /> Import to Workflow
                  </Button>
                  <Button onClick={handleClose} variant="ghost" className="w-full" data-testid="back-to-list-button">
                    <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" /> Back to List
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
