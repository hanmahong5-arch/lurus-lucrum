"use client";

/**
 * RiskIndicator Component
 *
 * Displays a visual risk level indicator for the trading panel.
 * Shows overall risk level as a colored bar, plus individual risk factors:
 * - Position concentration
 * - Current drawdown vs stop-loss
 * - Daily trade count
 *
 * Risk levels: 0-40% green (low), 40-70% yellow (medium), 70-100% red (high)
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface RiskFactor {
  /** Factor label */
  label: string;
  /** Current value display */
  value: string;
  /** Risk contribution (0-100) */
  riskScore: number;
  /** Optional warning text */
  warning?: string;
}

export interface RiskIndicatorProps {
  /** Individual risk factors to display */
  factors: RiskFactor[];
  /** Additional className */
  className?: string;
}

/**
 * Convenience props for auto-computing risk from trading state
 */
export interface TradingRiskInput {
  /** Total portfolio value including cash */
  totalPortfolioValue: number;
  /** Largest single position value */
  largestPositionValue: number;
  /** Largest position symbol name */
  largestPositionName?: string;
  /** Current drawdown from peak (as a positive percentage, e.g. 3.2) */
  currentDrawdown: number;
  /** Stop-loss threshold percentage (e.g. 5.0) */
  stopLossThreshold: number;
  /** Number of trades executed today */
  todayTradeCount: number;
  /** Recommended max daily trades */
  maxDailyTrades?: number;
}

// =============================================================================
// Risk computation
// =============================================================================

const RISK_LEVEL_CONFIG = [
  { max: 40, label: "低", color: "text-step-done", barColor: "bg-step-done", bgColor: "bg-step-done/10" },
  { max: 70, label: "中等", color: "text-status-warn", barColor: "bg-status-warn", bgColor: "bg-status-warn/10" },
  { max: 100, label: "高", color: "text-status-block", barColor: "bg-status-block", bgColor: "bg-status-block/10" },
] as const;

function getRiskConfig(score: number) {
  const clamped = Math.max(0, Math.min(100, score));
  for (const level of RISK_LEVEL_CONFIG) {
    if (clamped <= level.max) return level;
  }
  return RISK_LEVEL_CONFIG[RISK_LEVEL_CONFIG.length - 1]!;
}

/**
 * Compute risk factors from trading state.
 */
export function computeTradingRiskFactors(input: TradingRiskInput): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const maxTrades = input.maxDailyTrades ?? 5;

  // 1. Position concentration
  if (input.totalPortfolioValue > 0) {
    const concentration =
      (input.largestPositionValue / input.totalPortfolioValue) * 100;
    const concentrationRisk = Math.min(100, (concentration / 50) * 100); // 50% = max risk
    const posName = input.largestPositionName ?? "";
    factors.push({
      label: "持仓集中度",
      value: `${concentration.toFixed(0)}%${posName ? ` (${posName})` : ""}`,
      riskScore: concentrationRisk,
      warning:
        concentration > 40
          ? "单只占比过高，建议分散持仓"
          : undefined,
    });
  }

  // 2. Current drawdown vs stop-loss
  if (input.stopLossThreshold > 0) {
    const ddRatio = (input.currentDrawdown / input.stopLossThreshold) * 100;
    const remaining = Math.max(
      0,
      input.stopLossThreshold - input.currentDrawdown,
    );
    factors.push({
      label: "当前回撤",
      value: `-${input.currentDrawdown.toFixed(1)}% (距止损线还有${remaining.toFixed(1)}%)`,
      riskScore: Math.min(100, ddRatio),
      warning:
        ddRatio > 80
          ? "接近止损线，请密切关注"
          : undefined,
    });
  }

  // 3. Daily trade count
  const tradeRatio = (input.todayTradeCount / maxTrades) * 100;
  factors.push({
    label: "今日交易",
    value: `${input.todayTradeCount}次 (建议<${maxTrades}次/天)`,
    riskScore: Math.min(100, tradeRatio),
    warning:
      input.todayTradeCount >= maxTrades
        ? "交易频繁，注意手续费和情绪化风险"
        : undefined,
  });

  return factors;
}

// =============================================================================
// Component
// =============================================================================

export function RiskIndicator({ factors, className }: RiskIndicatorProps) {
  // Compute overall risk as weighted average
  const overallRisk = useMemo(() => {
    if (factors.length === 0) return 0;
    const sum = factors.reduce((acc, f) => acc + f.riskScore, 0);
    return Math.round(sum / factors.length);
  }, [factors]);

  const config = getRiskConfig(overallRisk);

  if (factors.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 p-3 space-y-3",
        config.bgColor,
        className,
      )}
    >
      {/* Header: overall risk level */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">当前风险等级</span>
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      </div>

      {/* Overall risk bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              config.barColor,
            )}
            style={{ width: `${overallRisk}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-white/20 font-mono tabular-nums">
          <span>0%</span>
          <span>{overallRisk}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Individual risk factors */}
      <div className="space-y-2 pt-1 border-t border-white/5">
        {factors.map((factor, idx) => {
          const factorConfig = getRiskConfig(factor.riskScore);
          return (
            <div key={idx} className="space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-white/40">
                  {factor.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono tabular-nums",
                    factorConfig.color,
                  )}
                >
                  {factor.value}
                </span>
              </div>
              {factor.warning && (
                <p className="text-[10px] text-status-warn/80">
                  {factor.warning}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
