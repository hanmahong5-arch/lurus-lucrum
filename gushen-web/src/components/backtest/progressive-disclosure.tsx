/**
 * Progressive Disclosure Component
 * 渐进披露组件
 *
 * Implements three-layer progressive disclosure for backtest results:
 * - Layer 1 (immediate): ScoreCard with grade + 3 core metrics + benchmark
 * - Layer 2 (0.5s delay): Equity curve chart placeholder
 * - Layer 3 (collapsed): Full 30+ metrics table, trade list, signal details
 *
 * Also includes:
 * - AI Insight placeholder (Epic 5 future feature)
 * - Next step guide cards (optimize / ask AI / validate more)
 * - Auto-focus ScoreCard on completion
 * - prefers-reduced-motion: skip delay for Layer 2
 *
 * @module components/backtest/progressive-disclosure
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, BarChart3, List, Signal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreCard } from "./score-card";
import { NextStepGuide } from "./next-step-guide";
import { AiInsightPlaceholder } from "./ai-insight-placeholder";
import type { StrategyScore } from "@/lib/backtest/score";
import type { UnifiedBacktestResult } from "@/lib/backtest/types";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface ProgressiveDisclosureProps {
  /** Strategy score from calculateScore() */
  score: StrategyScore | null;
  /** Excess return vs benchmark */
  excessReturn?: number;
  /** Equity curve data for Layer 2 chart */
  equityCurveData?: Array<{ time: number; value: number }>;
  /** Full result for Layer 3 expanded metrics */
  fullResult?: UnifiedBacktestResult;
  /** Whether backtest is complete (triggers progressive reveal) */
  isComplete: boolean;
  /** Callbacks */
  onOptimizeParams?: () => void;
  onAskAI?: () => void;
  onValidateMore?: () => void;
  onExpandDetails?: () => void;
  onExport?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/** Delay before showing Layer 2 (equity curve) in milliseconds */
const LAYER_2_DELAY_MS = 500;

/** Delay before auto-focusing ScoreCard in milliseconds */
const AUTO_FOCUS_DELAY_MS = 100;

// =============================================================================
// HOOKS / 自定义 Hooks
// =============================================================================

/**
 * Detect user preference for reduced motion
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

// =============================================================================
// EQUITY CURVE PLACEHOLDER / 权益曲线占位
// =============================================================================

interface EquityCurveSectionProps {
  data: Array<{ time: number; value: number }>;
}

/**
 * Equity curve display section.
 * Currently renders a summary placeholder; full chart integration
 * will be handled by the charts module (lightweight-charts).
 */
function EquityCurveSection({ data }: EquityCurveSectionProps) {
  if (data.length === 0) return null;

  const startValue = data[0]?.value ?? 0;
  const endValue = data[data.length - 1]?.value ?? 0;
  const change = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <Card data-testid="equity-curve-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          权益曲线
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 flex items-center justify-center rounded-md bg-muted/30 border border-dashed">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {data.length} 个数据点
            </p>
            <p
              className={cn(
                "text-lg font-mono tabular-nums font-semibold mt-1",
                isPositive ? "text-profit" : "text-loss"
              )}
            >
              {isPositive ? "+" : ""}{change.toFixed(2)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// LAYER 3 CONTENT / 第三层内容
// =============================================================================

interface Layer3ContentProps {
  fullResult?: UnifiedBacktestResult;
}

/**
 * Layer 3 expandable content: full metrics summary placeholder.
 * Detailed metric tables, trade lists, and signal details will be
 * populated when fullResult is provided from the parent backtest workflow.
 */
function Layer3Content({ fullResult }: Layer3ContentProps) {
  return (
    <div className="space-y-4 pt-4" data-testid="progressive-layer-3-content">
      {fullResult ? (
        <div className="grid gap-4">
          {/* Full metrics summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <List className="h-4 w-4" aria-hidden="true" />
                完整指标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">总收益率</span>
                  <p className="font-mono tabular-nums font-medium">
                    {fullResult.returnMetrics.totalReturn.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">夏普比率</span>
                  <p className="font-mono tabular-nums font-medium">
                    {fullResult.riskMetrics.sharpeRatio.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">最大回撤</span>
                  <p className="font-mono tabular-nums font-medium">
                    -{fullResult.riskMetrics.maxDrawdown.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">胜率</span>
                  <p className="font-mono tabular-nums font-medium">
                    {fullResult.tradingMetrics.winRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trade list placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Signal className="h-4 w-4" aria-hidden="true" />
                交易明细
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                共 {fullResult.tradingMetrics.totalTrades} 笔交易
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          详细指标数据加载中...
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT / 主组件
// =============================================================================

export function ProgressiveDisclosure({
  score,
  excessReturn,
  equityCurveData,
  fullResult,
  isComplete,
  onOptimizeParams,
  onAskAI,
  onValidateMore,
  onExpandDetails,
  onExport,
  className,
}: ProgressiveDisclosureProps) {
  const [showLayer2, setShowLayer2] = useState(false);
  const [layer3Expanded, setLayer3Expanded] = useState(false);
  const scoreCardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Layer 2 delayed reveal
  useEffect(() => {
    if (!isComplete) {
      setShowLayer2(false);
      return;
    }

    // With reduced motion, show immediately
    if (prefersReducedMotion) {
      setShowLayer2(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowLayer2(true);
    }, LAYER_2_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isComplete, prefersReducedMotion]);

  // Auto-focus ScoreCard on completion
  useEffect(() => {
    if (!isComplete) return;

    const timer = setTimeout(() => {
      scoreCardRef.current?.focus();
    }, AUTO_FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isComplete]);

  // Toggle Layer 3
  const handleToggleLayer3 = useCallback(() => {
    setLayer3Expanded((prev) => !prev);
  }, []);

  // Not complete yet - don't render disclosure layers
  if (!isComplete) {
    return (
      <div
        data-testid="progressive-disclosure"
        className={cn("space-y-6", className)}
        aria-live="polite"
      />
    );
  }

  return (
    <div
      data-testid="progressive-disclosure"
      className={cn("space-y-6", className)}
      aria-live="polite"
    >
      {/* Layer 1: ScoreCard (immediate) */}
      <div data-testid="progressive-layer-1">
        <ScoreCard
          ref={scoreCardRef}
          score={score}
          variant="full"
          excessReturn={excessReturn}
          onExpandDetails={onExpandDetails}
          onAskAI={onAskAI}
          onExport={onExport}
        />
      </div>

      {/* Layer 2: Equity curve (delayed 500ms or immediate with reduced motion) */}
      {showLayer2 && (
        <div
          data-testid="progressive-layer-2"
          className={cn(
            !prefersReducedMotion && "animate-in fade-in duration-500",
            "motion-reduce:animate-none"
          )}
        >
          {equityCurveData && equityCurveData.length > 0 && (
            <EquityCurveSection data={equityCurveData} />
          )}
        </div>
      )}

      {/* Layer 3: Full metrics (collapsible) */}
      <div>
        <Button
          data-testid="progressive-layer-3-trigger"
          variant="outline"
          className="w-full justify-between"
          aria-expanded={layer3Expanded}
          aria-controls="progressive-layer-3-panel"
          onClick={handleToggleLayer3}
        >
          <span className="flex items-center gap-2">
            <List className="h-4 w-4" aria-hidden="true" />
            {layer3Expanded ? "收起完整指标" : "展开完整指标 (30+ 项)"}
          </span>
          {layer3Expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        {layer3Expanded && (
          <div
            id="progressive-layer-3-panel"
            data-testid="progressive-layer-3-panel"
            role="region"
            aria-label="完整回测指标"
          >
            <Layer3Content fullResult={fullResult} />
          </div>
        )}
      </div>

      {/* AI Insight Placeholder */}
      <AiInsightPlaceholder />

      {/* Next Step Guide */}
      <NextStepGuide
        onOptimizeParams={onOptimizeParams}
        onAskAI={onAskAI}
        onValidateMore={onValidateMore}
      />
    </div>
  );
}
