/**
 * Quick Preview Result Component
 *
 * Displays simplified backtest results for strategy quick preview.
 * Shows ScoreCard (compact) + total return + max drawdown + trade count.
 * Supports idle, loading, success, and error states.
 *
 * Story 3.3: Strategy Detail Panel & Quick Preview
 *
 * @module components/discovery/quick-preview-result
 */

"use client";

import React from "react";
import { AlertTriangle, RefreshCw, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreCard } from "@/components/backtest/score-card";
import { Button } from "@/components/ui/button";
import type { QuickPreviewData, QuickPreviewState } from "@/hooks/use-quick-preview";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Percentage threshold for positive return display */
const POSITIVE_RETURN_THRESHOLD = 0;

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function PreviewSkeleton() {
  return (
    <div
      className="space-y-3 animate-pulse"
      data-testid="quick-preview-loading"
      aria-label="Running quick preview backtest"
      role="status"
    >
      <div className="h-16 rounded-lg bg-surface-hover" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-hover" />
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-surface p-3 text-center"
      data-testid="preview-metric-card"
    >
      <div className="flex items-center justify-center gap-1 mb-1">
        <Icon className={cn("h-3.5 w-3.5", colorClass)} aria-hidden="true" />
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
      <span className={cn("text-sm font-mono tabular-nums font-semibold", colorClass)}>
        {value}
      </span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface QuickPreviewResultProps {
  data: QuickPreviewData | null;
  state: QuickPreviewState;
  errorMessage?: string;
  onRetry: () => void;
  className?: string;
}

export function QuickPreviewResult({
  data,
  state,
  errorMessage,
  onRetry,
  className,
}: QuickPreviewResultProps) {
  // Idle state: show nothing
  if (state === "idle") {
    return null;
  }

  // Loading state
  if (state === "loading") {
    return (
      <div className={cn("space-y-3", className)}>
        <h4 className="text-sm font-medium text-neutral-300">
          Quick preview running...
        </h4>
        <PreviewSkeleton />
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div
        className={cn(
          "rounded-lg border border-loss/30 bg-loss/5 p-4",
          className
        )}
        role="alert"
        data-testid="quick-preview-error"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-loss" aria-hidden="true" />
          <span className="text-sm font-medium text-loss">Preview failed</span>
        </div>
        <p className="text-xs text-neutral-400 mb-3">
          {errorMessage ?? "Unable to run quick preview backtest"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="btn-tactile"
          data-testid="quick-preview-retry"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  // Success state
  if (state === "success" && data) {
    const returnValue = parseFloat(data.totalReturn);
    const drawdownValue = parseFloat(data.maxDrawdown);
    const isPositiveReturn = returnValue > POSITIVE_RETURN_THRESHOLD;

    const returnDisplay = (returnValue >= 0 ? "+" : "") + returnValue.toFixed(2) + "%";
    const drawdownDisplay = "-" + Math.abs(drawdownValue).toFixed(2) + "%";

    return (
      <div
        className={cn("space-y-3", className)}
        data-testid="quick-preview-result"
      >
        <h4 className="text-sm font-medium text-neutral-300">
          Quick preview result
        </h4>

        {/* ScoreCard compact */}
        <ScoreCard
          score={data.score}
          variant="compact"
          state="default"
        />

        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Total Return"
            value={returnDisplay}
            icon={isPositiveReturn ? TrendingUp : TrendingDown}
            colorClass={isPositiveReturn ? "text-profit" : "text-loss"}
          />
          <MetricCard
            label="Max Drawdown"
            value={drawdownDisplay}
            icon={TrendingDown}
            colorClass="text-loss"
          />
          <MetricCard
            label="Trades"
            value={String(data.tradeCount)}
            icon={BarChart3}
            colorClass="text-neutral-300"
          />
        </div>
      </div>
    );
  }

  return null;
}
