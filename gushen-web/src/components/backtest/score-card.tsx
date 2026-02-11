/**
 * ScoreCard Component
 * Strategy score display card with three variants (full/compact/mini)
 *
 * Provides triple-encoded accessibility: letter + description + icon
 * Supports 4 states: default, loading, error, comparison-mode
 *
 * @module components/backtest/score-card
 */

"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { SimpleFinancialValue } from "@/components/financial/financial-value";
import Decimal from "decimal.js";
import type { StrategyScore, ScoreGrade } from "@/lib/backtest/score";
import { DIMENSION_WEIGHTS, GRADE_CONFIG } from "@/lib/backtest/score";
import { Button } from "@/components/ui/button";

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/** Grade icon mapping for triple-encoded accessibility */
const GRADE_ICONS: Record<ScoreGrade, string> = {
  S: "★★★",
  A: "★★",
  B: "★",
  C: "○",
  D: "✕",
};

/** Grade text color classes using design tokens */
const GRADE_COLOR_CLASS: Record<ScoreGrade, string> = {
  S: "text-score-s",
  A: "text-score-a",
  B: "text-score-b",
  C: "text-score-c",
  D: "text-score-d",
};

/** Grade background color classes */
const GRADE_BG_CLASS: Record<ScoreGrade, string> = {
  S: "bg-score-s/10",
  A: "bg-score-a/10",
  B: "bg-score-b/10",
  C: "bg-score-c/10",
  D: "bg-score-d/10",
};

/** Grade border color classes */
const GRADE_BORDER_CLASS: Record<ScoreGrade, string> = {
  S: "border-score-s/30",
  A: "border-score-a/30",
  B: "border-score-b/30",
  C: "border-score-c/30",
  D: "border-score-d/30",
};

/** Grade descriptions for display */
const GRADE_DESCRIPTIONS: Record<ScoreGrade, string> = {
  S: "卓越",
  A: "优秀",
  B: "良好",
  C: "一般",
  D: "需改进",
};

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface ScoreCardProps {
  /** Score data from calculateScore() */
  score: StrategyScore | null;
  /** Display variant */
  variant?: "full" | "compact" | "mini";
  /** Component state */
  state?: "default" | "loading" | "error" | "comparison";
  /** Error message (when state='error') */
  errorMessage?: string;
  /** Previous score for comparison mode (left column) */
  previousScore?: StrategyScore | null;
  /** Excess return vs CSI 300 benchmark (full variant only) */
  excessReturn?: number;
  /** Callback: expand details */
  onExpandDetails?: () => void;
  /** Callback: ask AI */
  onAskAI?: () => void;
  /** Callback: export */
  onExport?: () => void;
  /** Callback: retry on error */
  onRetry?: () => void;
  /** Additional className */
  className?: string;
}

// =============================================================================
// ARIA LABEL GENERATOR
// =============================================================================

/**
 * Generate accessible aria-label from score data
 * Format: "策略评分 A 优秀，总收益率 上涨 23.5%，最大回撤 下跌 8.3%"
 */
function generateAriaLabel(score: StrategyScore): string {
  const grade = score.grade;
  const description = GRADE_DESCRIPTIONS[grade];
  const totalReturn = score.coreMetrics.totalReturn;
  const maxDrawdown = score.coreMetrics.maxDrawdown;

  const returnDirection = totalReturn.greaterThanOrEqualTo(0) ? "上涨" : "下跌";
  const drawdownDirection = "下跌";

  const returnPct = `${totalReturn.abs().times(100).toFixed(1)}%`;
  const drawdownPct = `${maxDrawdown.abs().times(100).toFixed(1)}%`;

  return `策略评分 ${grade} ${description}，总收益率 ${returnDirection} ${returnPct}，最大回撤 ${drawdownDirection} ${drawdownPct}`;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ScoreCardSkeleton({ variant }: { variant: "full" | "compact" | "mini" }) {
  if (variant === "mini") {
    return (
      <span className="inline-flex items-center gap-1.5" aria-label="评分加载中">
        <span className="h-5 w-5 animate-pulse rounded bg-muted" />
        <span className="h-4 w-12 animate-pulse rounded bg-muted" />
      </span>
    );
  }

  return (
    <Card className="border-muted" aria-label="评分加载中">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      {variant === "full" && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="h-px bg-border" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      )}
      {variant === "compact" && (
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// =============================================================================
// ERROR STATE
// =============================================================================

function ScoreCardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/30" role="alert">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-destructive">
          <span aria-hidden="true">⚠</span>
          <span className="text-sm">{message}</span>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0"
          >
            重试
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// HELP TOOLTIP
// =============================================================================

function ScoreHelpTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/30 text-[10px] text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
            aria-label="评分说明"
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <p className="font-medium">评分维度权重</p>
            <ul className="space-y-1">
              <li>收益性 {(DIMENSION_WEIGHTS.profitability * 100).toFixed(0)}%</li>
              <li>风险控制 {(DIMENSION_WEIGHTS.risk * 100).toFixed(0)}%</li>
              <li>稳定性 {(DIMENSION_WEIGHTS.stability * 100).toFixed(0)}%</li>
              <li>交易效率 {(DIMENSION_WEIGHTS.efficiency * 100).toFixed(0)}%</li>
            </ul>
            <p className="text-muted-foreground">
              {GRADE_CONFIG.map((g) => `${g.grade}≥${g.minScore}`).join(", ")}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// GRADE DISPLAY (shared header across full/compact)
// =============================================================================

function GradeDisplay({
  score,
  showHelp = false,
}: {
  score: StrategyScore;
  showHelp?: boolean;
}) {
  const grade = score.grade;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-lg text-5xl font-mono font-bold leading-none",
          GRADE_COLOR_CLASS[grade],
          GRADE_BG_CLASS[grade]
        )}
      >
        {grade}
      </div>
      <div>
        <div className="flex items-center gap-1">
          <span className={cn("text-sm font-medium", GRADE_COLOR_CLASS[grade])}>
            {GRADE_DESCRIPTIONS[grade]}
          </span>
          <span
            className={cn("text-sm", GRADE_COLOR_CLASS[grade])}
            aria-hidden="true"
          >
            {GRADE_ICONS[grade]}
          </span>
          {showHelp && <ScoreHelpTooltip />}
        </div>
        <span className="text-xs text-muted-foreground">
          综合评分 {score.score}/100
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// CORE METRICS DISPLAY
// =============================================================================

function CoreMetricsDisplay({ score }: { score: StrategyScore }) {
  const totalReturn = score.coreMetrics.totalReturn.toNumber();
  const annualizedReturn = score.coreMetrics.annualizedReturn.toNumber();
  const maxDrawdown = score.coreMetrics.maxDrawdown.toNumber();

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-0.5">
        <span className="text-xs text-muted-foreground">总收益率</span>
        <div>
          <SimpleFinancialValue
            value={totalReturn * 100}
            type="percent"
            showSign
            showArrow
            size="sm"
          />
        </div>
      </div>
      <div className="space-y-0.5">
        <span className="text-xs text-muted-foreground">年化收益率</span>
        <div>
          <SimpleFinancialValue
            value={annualizedReturn * 100}
            type="percent"
            showSign
            showArrow
            size="sm"
          />
        </div>
      </div>
      <div className="space-y-0.5">
        <span className="text-xs text-muted-foreground">最大回撤</span>
        <div>
          <SimpleFinancialValue
            value={-Math.abs(maxDrawdown * 100)}
            type="percent"
            showSign
            showArrow
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EXCESS RETURN DISPLAY
// =============================================================================

function ExcessReturnDisplay({ excessReturn }: { excessReturn: number }) {
  const decimalReturn = new Decimal(excessReturn);
  const isPositive = decimalReturn.greaterThanOrEqualTo(0);
  const arrow = isPositive ? "▲" : "▼";
  const colorClass = isPositive ? "text-profit" : "text-loss";
  const pct = decimalReturn.times(100).toFixed(2);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">vs 沪深300</span>
      <span className={cn("font-mono tabular-nums", colorClass)}>
        <span aria-hidden="true">{arrow}</span>{" "}
        {isPositive ? "+" : ""}
        {pct}%
      </span>
    </div>
  );
}

// =============================================================================
// ANIMATED VALUE (loading → loaded transition)
// =============================================================================

function useAnimatedTransition(isLoaded: boolean) {
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      setShowColors(false);
      return;
    }
    // Skip animation delay when user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setShowColors(true);
      return;
    }
    const timer = setTimeout(() => setShowColors(true), 100);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  return showColors;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ScoreCard = forwardRef<HTMLDivElement, ScoreCardProps>(
  function ScoreCard(
    {
      score,
      variant = "full",
      state = "default",
      errorMessage,
      previousScore,
      excessReturn,
      onExpandDetails,
      onAskAI,
      onExport,
      onRetry,
      className,
    },
    ref
  ) {
    // Hooks MUST be called before any conditional returns (React Hooks rules)
    const showColors = useAnimatedTransition(state === "default" && !!score);

    // Handle loading state
    if (state === "loading") {
      return (
        <div ref={ref} className={className} data-testid="score-card-loading">
          <ScoreCardSkeleton variant={variant} />
        </div>
      );
    }

    // Handle error state
    if (state === "error") {
      return (
        <div ref={ref} className={className} data-testid="score-card-error">
          <ScoreCardError
            message={errorMessage ?? "评分计算失败"}
            onRetry={onRetry}
          />
        </div>
      );
    }

    // Handle comparison mode — side-by-side old (left) vs new (right)
    if (state === "comparison") {
      if (!score) return null;
      return (
        <div
          ref={ref}
          className={cn("grid grid-cols-2 gap-4", className)}
          aria-label="策略评分对比"
          data-testid="score-card-comparison"
        >
          <Card className="border-muted">
            <CardHeader className="pb-3">
              <span className="text-xs text-muted-foreground mb-1">旧版本</span>
              {previousScore ? (
                <GradeDisplay score={previousScore} />
              ) : (
                <span className="text-sm text-muted-foreground">无数据</span>
              )}
            </CardHeader>
            {previousScore && (
              <CardContent>
                <CoreMetricsDisplay score={previousScore} />
              </CardContent>
            )}
          </Card>
          <Card className={cn(GRADE_BORDER_CLASS[score.grade])}>
            <CardHeader className="pb-3">
              <span className="text-xs text-muted-foreground mb-1">新版本</span>
              <GradeDisplay score={score} />
            </CardHeader>
            <CardContent>
              <CoreMetricsDisplay score={score} />
            </CardContent>
          </Card>
        </div>
      );
    }

    // No score data
    if (!score) {
      return null;
    }

    const ariaLabel = generateAriaLabel(score);

    // =========================================================================
    // MINI VARIANT
    // =========================================================================
    if (variant === "mini") {
      return (
        <span
          ref={ref}
          className={cn("inline-flex items-center gap-1.5", className)}
          aria-label={ariaLabel}
          data-testid="score-card-mini"
        >
          <span
            className={cn(
              "text-sm font-mono font-bold",
              GRADE_COLOR_CLASS[score.grade]
            )}
          >
            {score.grade}
          </span>
          <span className="text-xs text-muted-foreground">
            {GRADE_DESCRIPTIONS[score.grade]}
          </span>
        </span>
      );
    }

    // =========================================================================
    // COMPACT VARIANT
    // =========================================================================
    if (variant === "compact") {
      return (
        <Card
          ref={ref}
          className={cn(
            "transition-colors duration-500 motion-reduce:transition-none",
            showColors && GRADE_BORDER_CLASS[score.grade],
            className
          )}
          aria-label={ariaLabel}
          data-testid="score-card-compact"
        >
          <CardHeader className="pb-3">
            <GradeDisplay score={score} />
          </CardHeader>
          <CardContent>
            <CoreMetricsDisplay score={score} />
          </CardContent>
        </Card>
      );
    }

    // =========================================================================
    // FULL VARIANT
    // =========================================================================
    return (
      <Card
        ref={ref}
        className={cn(
          "transition-colors duration-500 motion-reduce:transition-none",
          showColors && GRADE_BORDER_CLASS[score.grade],
          className
        )}
        aria-label={ariaLabel}
        data-testid="score-card-full"
        tabIndex={-1}
      >
        <CardHeader className="pb-3">
          <GradeDisplay score={score} showHelp />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core Metrics */}
          <CoreMetricsDisplay score={score} />

          {/* Benchmark Comparison */}
          {excessReturn !== undefined && (
            <>
              <div className="h-px bg-border" />
              <ExcessReturnDisplay excessReturn={excessReturn} />
            </>
          )}

          {/* Action Buttons */}
          <div className="h-px bg-border" />
          <div className="flex gap-2">
            {onExpandDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExpandDetails}
                data-testid="score-card-expand"
              >
                展开详情
              </Button>
            )}
            {onAskAI && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAskAI}
                data-testid="score-card-ask-ai"
              >
                问AI
              </Button>
            )}
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                data-testid="score-card-export"
              >
                导出
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

// =============================================================================
// EXPORTS
// =============================================================================

export { GRADE_ICONS, GRADE_COLOR_CLASS, GRADE_BG_CLASS, GRADE_DESCRIPTIONS };
export { generateAriaLabel };
