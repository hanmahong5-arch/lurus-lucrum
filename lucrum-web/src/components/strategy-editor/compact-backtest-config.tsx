/**
 * Compact Backtest Config Component
 *
 * Progressive disclosure backtest configuration panel:
 * - Level 1 (always visible): Symbol, Capital, Date Range, Run button
 * - Level 2 (expandable): Commission, Slippage, T+1, Circuit breaker, Walk-forward
 *
 * Uses user-preferences-store for defaults and remembers last config.
 *
 * @module components/strategy-editor/compact-backtest-config
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { TargetSelector } from "@/components/backtest/target-selector";
import type { BacktestTarget } from "@/lib/backtest/types";
import {
  useUserPreferencesStore,
  selectDefaultCapital,
  selectDefaultCommission,
  selectDefaultSlippage,
  selectPreferredBacktestTimeframe,
} from "@/lib/stores/user-preferences-store";

// =============================================================================
// TYPES
// =============================================================================

export interface CompactBacktestConfigData {
  symbol: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  startDate: string;
  endDate: string;
  timeframe: "1d" | "1w" | "60m" | "30m" | "15m" | "5m" | "1m";
  enableT1: boolean;
  enableCircuitBreaker: boolean;
  stampDuty: number;
  wfSplitRatio: 0 | 0.7 | 0.8;
}

interface CompactBacktestConfigProps {
  /** Callback to start backtest */
  onRunBacktest: (config: CompactBacktestConfigData) => void;
  /** Whether backtest is running */
  isRunning: boolean;
  /** Whether there is strategy code to test */
  hasStrategyCode: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DATE_RANGE_CHIPS = [
  { label: "近1年", days: 365 },
  { label: "近3年", days: 1095 },
  { label: "近5年", days: 1825 },
] as const;

const CAPITAL_PRESETS = [
  { label: "10万", value: 100000 },
  { label: "50万", value: 500000 },
  { label: "100万", value: 1000000 },
] as const;

const PRIMARY_TIMEFRAMES = [
  { value: "1d" as const, label: "日K" },
  { value: "1w" as const, label: "周K" },
  { value: "60m" as const, label: "时K" },
] as const;

const COMMISSION_PRESETS = [
  { label: "低0.015%", value: 0.00015 },
  { label: "标准0.03%", value: 0.0003 },
  { label: "高0.1%", value: 0.001 },
] as const;

const SLIPPAGE_PRESETS = [
  { label: "无", value: 0 },
  { label: "低0.05%", value: 0.0005 },
  { label: "中0.1%", value: 0.001 },
] as const;

const WFO_OPTIONS = [
  { label: "全量", value: 0 as const },
  { label: "80/20", value: 0.8 as const },
  { label: "70/30", value: 0.7 as const },
] as const;

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultDates(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return {
    startDate: startDate.toISOString().split("T")[0] ?? "",
    endDate: endDate.toISOString().split("T")[0] ?? "",
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CompactBacktestConfig({
  onRunBacktest,
  isRunning,
  hasStrategyCode,
  className,
}: CompactBacktestConfigProps) {
  // User preferences
  const defaultCapital = useUserPreferencesStore(selectDefaultCapital);
  const defaultCommission = useUserPreferencesStore(selectDefaultCommission);
  const defaultSlippage = useUserPreferencesStore(selectDefaultSlippage);
  const preferredTimeframe = useUserPreferencesStore(selectPreferredBacktestTimeframe);

  const defaultDates = useMemo(() => getDefaultDates(365), []);

  const [config, setConfig] = useState<CompactBacktestConfigData>({
    symbol: "",
    initialCapital: defaultCapital,
    commission: defaultCommission,
    slippage: defaultSlippage,
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    timeframe: preferredTimeframe,
    enableT1: true,
    enableCircuitBreaker: true,
    stampDuty: 0.0005,
    wfSplitRatio: 0,
  });

  const [backtestTarget, setBacktestTarget] = useState<BacktestTarget>({ mode: "stock" });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Derive symbol from target
  const effectiveSymbol = useMemo(() => {
    if (backtestTarget.mode === "stock" && backtestTarget.stock?.symbol) {
      return backtestTarget.stock.symbol;
    }
    return "";
  }, [backtestTarget]);

  // Check readiness
  const canRun = hasStrategyCode && !!effectiveSymbol && !isRunning;

  const handleRun = useCallback(() => {
    if (!canRun) return;
    onRunBacktest({ ...config, symbol: effectiveSymbol });
  }, [canRun, config, effectiveSymbol, onRunBacktest]);

  const setPresetPeriod = useCallback((days: number) => {
    const dates = getDefaultDates(days);
    setConfig((prev) => ({ ...prev, startDate: dates.startDate, endDate: dates.endDate }));
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Level 1: Essential config (always visible) */}
      <div className="space-y-3">
        {/* Target selector (compact) */}
        <div>
          <label className="block text-[10px] text-neutral-500 mb-1.5 font-medium uppercase tracking-wider">
            回测标的
          </label>
          <TargetSelector
            value={backtestTarget}
            onChange={setBacktestTarget}
            className="bg-surface/50 rounded-lg border border-white/5 p-2"
          />
        </div>

        {/* Capital quick-select */}
        <div>
          <label className="block text-[10px] text-neutral-500 mb-1.5 font-medium uppercase tracking-wider">
            初始资金
            <span className="ml-2 text-primary font-mono tabular-nums normal-case">
              &yen;{config.initialCapital.toLocaleString()}
            </span>
          </label>
          <div className="flex gap-1.5">
            {CAPITAL_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, initialCapital: p.value }))}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-all btn-tactile border",
                  config.initialCapital === p.value
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-surface border-white/5 text-neutral-400 hover:text-neutral-200"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range chips */}
        <div>
          <label className="block text-[10px] text-neutral-500 mb-1.5 font-medium uppercase tracking-wider">
            回测区间
            <span className="ml-2 text-neutral-600 font-mono normal-case">
              {config.startDate} ~ {config.endDate}
            </span>
          </label>
          <div className="flex gap-1.5">
            {DATE_RANGE_CHIPS.map((chip) => (
              <button
                key={chip.days}
                type="button"
                onClick={() => setPresetPeriod(chip.days)}
                className="px-2.5 py-1 text-xs rounded-md bg-surface border border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10 transition-all btn-tactile"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-[10px] text-neutral-500 mb-1.5 font-medium uppercase tracking-wider">
            K线周期
          </label>
          <div className="flex gap-1.5">
            {PRIMARY_TIMEFRAMES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, timeframe: opt.value }))}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-all btn-tactile border",
                  config.timeframe === opt.value
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-surface border-white/5 text-neutral-400 hover:text-neutral-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Level 2: Advanced settings (collapsible) */}
      <details
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
        className="group"
      >
        <summary className="text-[10px] text-neutral-600 cursor-pointer hover:text-neutral-400 flex items-center gap-1 transition-colors select-none">
          <svg
            className="w-2.5 h-2.5 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          高级设置
        </summary>
        <div className="mt-2 pt-2 border-t border-white/5 space-y-3">
          {/* Commission */}
          <div>
            <label className="block text-[10px] text-neutral-500 mb-1.5">手续费率</label>
            <div className="flex gap-1.5 flex-wrap">
              {COMMISSION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, commission: p.value }))}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded-md transition-all btn-tactile border",
                    config.commission === p.value
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-surface border-white/5 text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slippage */}
          <div>
            <label className="block text-[10px] text-neutral-500 mb-1.5">滑点率</label>
            <div className="flex gap-1.5 flex-wrap">
              {SLIPPAGE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, slippage: p.value }))}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded-md transition-all btn-tactile border",
                    config.slippage === p.value
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-surface border-white/5 text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* T+1 and Circuit breaker toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-500">T+1 限制</span>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, enableT1: !prev.enableT1 }))}
                className={cn(
                  "relative w-8 h-4 rounded-full transition-colors",
                  config.enableT1 ? "bg-primary/60" : "bg-surface-hover"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm",
                    config.enableT1 ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-500">涨跌停限制</span>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, enableCircuitBreaker: !prev.enableCircuitBreaker }))}
                className={cn(
                  "relative w-8 h-4 rounded-full transition-colors",
                  config.enableCircuitBreaker ? "bg-primary/60" : "bg-surface-hover"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm",
                    config.enableCircuitBreaker ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Walk-forward */}
          <div>
            <label className="block text-[10px] text-neutral-500 mb-1.5">样本分割</label>
            <div className="flex gap-1.5">
              {WFO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, wfSplitRatio: opt.value }))}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded-md transition-all btn-tactile border",
                    config.wfSplitRatio === opt.value
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-surface border-white/5 text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!canRun}
        className={cn(
          "w-full px-4 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2",
          "transition-all btn-tactile",
          canRun
            ? "bg-primary text-white hover:bg-primary/90 glow-active"
            : "bg-surface text-neutral-500 cursor-not-allowed border border-white/5"
        )}
      >
        {isRunning ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            运行中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            开始回测
          </>
        )}
      </button>
    </div>
  );
}
