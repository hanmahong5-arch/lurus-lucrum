"use client";

/**
 * Risk Settings Panel Component
 *
 * Displays and allows configuration of risk management parameters:
 * - Stop loss percentage
 * - Take profit percentage
 * - Maximum position as percentage of total equity
 * - Risk score indicator from trading-store
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTradingStore } from "@/lib/stores/trading-store";

// =============================================================================
// TYPES
// =============================================================================

interface RiskSettingsProps {
  className?: string;
}

interface RiskConfig {
  stopLossPercent: number;
  takeProfitPercent: number;
  maxPositionPercent: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RISK_CONFIG_STORAGE_KEY = "lucrum-risk-config";

const DEFAULT_RISK_CONFIG: RiskConfig = {
  stopLossPercent: 5,
  takeProfitPercent: 15,
  maxPositionPercent: 30,
};

// =============================================================================
// HELPERS
// =============================================================================

function loadRiskConfig(): RiskConfig {
  if (typeof window === "undefined") return DEFAULT_RISK_CONFIG;
  try {
    const raw = localStorage.getItem(RISK_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_RISK_CONFIG;
    const parsed = JSON.parse(raw) as Partial<RiskConfig>;
    return {
      stopLossPercent: parsed.stopLossPercent ?? DEFAULT_RISK_CONFIG.stopLossPercent,
      takeProfitPercent: parsed.takeProfitPercent ?? DEFAULT_RISK_CONFIG.takeProfitPercent,
      maxPositionPercent: parsed.maxPositionPercent ?? DEFAULT_RISK_CONFIG.maxPositionPercent,
    };
  } catch {
    return DEFAULT_RISK_CONFIG;
  }
}

function saveRiskConfig(config: RiskConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RISK_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RiskSettings({ className }: RiskSettingsProps) {
  const [config, setConfig] = useState<RiskConfig>(loadRiskConfig);
  const riskMetrics = useTradingStore((s) => s.getRiskMetrics());

  const updateConfig = useCallback(
    (key: keyof RiskConfig, value: number) => {
      const newConfig = { ...config, [key]: value };
      setConfig(newConfig);
      saveRiskConfig(newConfig);
    },
    [config],
  );

  // Risk score color
  const riskScoreColor =
    riskMetrics.riskScore <= 3
      ? "text-profit"
      : riskMetrics.riskScore <= 6
        ? "text-accent"
        : "text-loss";

  const riskScoreBg =
    riskMetrics.riskScore <= 3
      ? "bg-profit/10"
      : riskMetrics.riskScore <= 6
        ? "bg-accent/10"
        : "bg-loss/10";

  return (
    <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">风控设置</h3>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
            riskScoreBg,
            riskScoreColor,
          )}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "currentColor" }}
          />
          风险 {riskMetrics.riskScore}/10
        </div>
      </div>

      <div className="space-y-3">
        {/* Stop loss */}
        <RiskSlider
          label="止损线"
          value={config.stopLossPercent}
          min={1}
          max={20}
          step={0.5}
          suffix="%"
          color="text-loss"
          description={`亏损超过 ${config.stopLossPercent}% 触发止损`}
          onChange={(v) => updateConfig("stopLossPercent", v)}
        />

        {/* Take profit */}
        <RiskSlider
          label="止盈线"
          value={config.takeProfitPercent}
          min={3}
          max={50}
          step={1}
          suffix="%"
          color="text-profit"
          description={`盈利达到 ${config.takeProfitPercent}% 触发止盈`}
          onChange={(v) => updateConfig("takeProfitPercent", v)}
        />

        {/* Max position */}
        <RiskSlider
          label="单票最大仓位"
          value={config.maxPositionPercent}
          min={5}
          max={100}
          step={5}
          suffix="%"
          color="text-accent"
          description={`单只股票最多占总资产 ${config.maxPositionPercent}%`}
          onChange={(v) => updateConfig("maxPositionPercent", v)}
        />
      </div>

      {/* Current risk metrics summary */}
      <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-white/50">当前回撤</span>
          <span
            className={cn(
              "font-mono tabular-nums",
              riskMetrics.currentDrawdown > 5 ? "text-loss" : "text-white/70",
            )}
          >
            {riskMetrics.currentDrawdown.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">仓位集中度</span>
          <span
            className={cn(
              "font-mono tabular-nums",
              riskMetrics.positionConcentration > 50 ? "text-loss" : "text-white/70",
            )}
          >
            {riskMetrics.positionConcentration.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">最大单仓占比</span>
          <span
            className={cn(
              "font-mono tabular-nums",
              riskMetrics.largestPosition > config.maxPositionPercent
                ? "text-loss"
                : "text-white/70",
            )}
          >
            {riskMetrics.largestPosition.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: RiskSlider
// =============================================================================

interface RiskSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  color: string;
  description: string;
  onChange: (value: number) => void;
}

function RiskSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  color,
  description,
  onChange,
}: RiskSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/60">{label}</span>
        <span className={cn("text-xs font-mono tabular-nums font-medium", color)}>
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:cursor-pointer"
      />
      <p className="text-xs text-white/30 mt-0.5">{description}</p>
    </div>
  );
}
