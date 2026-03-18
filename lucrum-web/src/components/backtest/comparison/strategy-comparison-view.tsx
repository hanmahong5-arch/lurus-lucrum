/**
 * StrategyComparisonView Component
 *
 * Side-by-side comparison view for two strategy backtest results.
 * Displays ScoreCard(compact) for each strategy, a metric comparison table,
 * winner summary banner, and equity curve overlay area.
 *
 * Layout:
 * - Desktop (>=1024px): side-by-side split
 * - Tablet/Mobile (<1024px): vertical stack
 *
 * @module components/backtest/comparison/strategy-comparison-view
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScoreCard } from "@/components/backtest/score-card";
import { MetricComparisonTable } from "./metric-comparison-table";
import { WinnerSummary } from "./winner-summary";
import type { ComparisonResult } from "@/lib/comparison/types";

// =============================================================================
// TYPES / 类型
// =============================================================================

export interface StrategyComparisonViewProps {
  /** Pre-computed comparison result from compareStrategies() */
  comparison: ComparisonResult;
  /** Additional className */
  className?: string;
}

// =============================================================================
// EQUITY CURVE PLACEHOLDER
// =============================================================================

function EquityCurvePlaceholder({
  nameA,
  nameB,
  hasDataA,
  hasDataB,
}: {
  nameA: string;
  nameB: string;
  hasDataA: boolean;
  hasDataB: boolean;
}) {
  if (!hasDataA && !hasDataB) {
    return null;
  }

  return (
    <Card className="border-muted">
      <CardHeader className="pb-2">
        <h3 className="text-sm font-medium text-foreground">权益曲线对比</h3>
      </CardHeader>
      <CardContent>
        <div
          className="flex h-48 items-center justify-center rounded-md border border-dashed border-muted bg-muted/10 text-sm text-muted-foreground"
          role="img"
          aria-label={`${nameA} 和 ${nameB} 权益曲线对比图`}
          data-testid="equity-curve-placeholder"
        >
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-blue-500" />
                <span className="text-xs">{nameA}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-purple-400" />
                <span className="text-xs">{nameB}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60">
              权益曲线叠加图 (集成后可用)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// SCORE SECTION
// =============================================================================

function StrategyScoreSection({
  label,
  name,
  score,
  isWinner,
}: {
  label: string;
  name: string;
  score: ComparisonResult["strategyA"]["score"];
  isWinner: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0",
        isWinner && "ring-1 ring-profit/20 rounded-lg"
      )}
      data-testid={`strategy-section-${label.toLowerCase()}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground truncate">
          {name}
        </span>
        {isWinner && (
          <span
            className="rounded bg-profit/10 px-1.5 py-0.5 text-[10px] font-medium text-profit"
            aria-label="Winner"
          >
            WIN
          </span>
        )}
      </div>
      <ScoreCard score={score} variant="compact" />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function StrategyComparisonView({
  comparison,
  className,
}: StrategyComparisonViewProps) {
  const { strategyA, strategyB, metricGroups, winners, summaryText } =
    comparison;

  const isAWinner = winners.overall === "a";
  const isBWinner = winners.overall === "b";

  // Determine mobile metric subset (top 6 for compact display)
  const mobileMetricKeys = useMemo(
    () =>
      new Set([
        "totalReturn",
        "annualizedReturn",
        "maxDrawdown",
        "sharpeRatio",
        "winRate",
        "profitFactor",
      ]),
    []
  );

  const mobileGroups = useMemo(
    () =>
      metricGroups.map((g) => ({
        ...g,
        metrics: g.metrics.filter((m) => mobileMetricKeys.has(m.key)),
      })).filter((g) => g.metrics.length > 0),
    [metricGroups, mobileMetricKeys]
  );

  return (
    <div
      className={cn("space-y-4", className)}
      role="region"
      aria-label="策略对比"
      data-testid="strategy-comparison-view"
    >
      {/* Winner Summary Banner */}
      <WinnerSummary
        winners={winners}
        nameA={strategyA.name}
        nameB={strategyB.name}
        summaryText={summaryText}
      />

      {/* Strategy Score Cards — side by side on desktop, stacked on mobile */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <StrategyScoreSection
          label="策略 A"
          name={strategyA.name}
          score={strategyA.score}
          isWinner={isAWinner}
        />

        {/* VS Divider — visible on desktop */}
        <div className="hidden lg:flex lg:items-center lg:justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-muted bg-surface text-xs font-bold text-muted-foreground">
            VS
          </div>
        </div>

        {/* VS Divider — visible on mobile */}
        <div className="flex items-center justify-center lg:hidden">
          <div className="h-px flex-1 bg-border" />
          <span className="px-3 text-xs font-medium text-muted-foreground">
            VS
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <StrategyScoreSection
          label="策略 B"
          name={strategyB.name}
          score={strategyB.score}
          isWinner={isBWinner}
        />
      </div>

      {/* Metric Comparison Table — full on desktop, reduced on mobile */}
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-medium text-foreground">指标对比</h3>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {/* Desktop: full metrics */}
          <div className="hidden md:block">
            <MetricComparisonTable
              groups={metricGroups}
              nameA={strategyA.name}
              nameB={strategyB.name}
            />
          </div>
          {/* Mobile: reduced metrics */}
          <div className="block md:hidden">
            <MetricComparisonTable
              groups={mobileGroups}
              nameA={strategyA.name}
              nameB={strategyB.name}
            />
          </div>
        </CardContent>
      </Card>

      {/* Equity Curve Overlay (placeholder for chart integration) */}
      <EquityCurvePlaceholder
        nameA={strategyA.name}
        nameB={strategyB.name}
        hasDataA={strategyA.equityCurve.length > 0}
        hasDataB={strategyB.equityCurve.length > 0}
      />
    </div>
  );
}
