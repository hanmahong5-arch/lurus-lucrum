"use client";

/**
 * Compact Backtest Config Bar
 *
 * Single horizontal bar with key parameters:
 * Capital | Commission | Date Range | Sensitivity | Benchmark | [Start]
 *
 * Loads defaults from user-preferences-store and validation-store.
 */

import { cn } from "@/lib/utils";
import { Play, Square, ChevronDown } from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import type { BacktestConfig } from "@/lib/stores/validation-store";

// =============================================================================
// Types
// =============================================================================

interface ConfigBarProps {
  config: BacktestConfig;
  onConfigChange: (patch: Partial<BacktestConfig>) => void;
  onStart: () => void | Promise<void>;
  onCancel: () => void;
  isRunning: boolean;
  disabled?: boolean;
  /** Reason displayed in tooltip when the start button is disabled */
  disabledReason?: string;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CAPITAL_OPTIONS = [
  { label: "10万", value: 100000 },
  { label: "50万", value: 500000 },
  { label: "100万", value: 1000000 },
  { label: "500万", value: 5000000 },
];

const COMMISSION_OPTIONS = [
  { label: "万二", value: 0.0002 },
  { label: "万三", value: 0.0003 },
  { label: "万五", value: 0.0005 },
];

const PERIOD_PRESETS = [
  { label: "近1年", startOffset: 365 },
  { label: "近2年", startOffset: 730 },
  { label: "2023~2025", start: "2023-01-01", end: "2025-12-31" },
  { label: "2024~2025", start: "2024-01-01", end: "2025-12-31" },
];

// =============================================================================
// Helpers
// =============================================================================

function dateFromOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0] ?? "";
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

// =============================================================================
// Component
// =============================================================================

export function ConfigBar({
  config,
  onConfigChange,
  onStart,
  onCancel,
  isRunning,
  disabled = false,
  disabledReason,
  className,
}: ConfigBarProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-surface/60 backdrop-blur-sm p-3",
        className,
      )}
    >
      {/* Row 1: Quick settings */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Capital */}
        <ConfigSelect
          label="资金"
          value={config.capital}
          options={CAPITAL_OPTIONS}
          onChange={(v) => onConfigChange({ capital: v })}
        />

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 hidden sm:block" />

        {/* Commission */}
        <ConfigSelect
          label="佣金"
          value={config.commission}
          options={COMMISSION_OPTIONS}
          onChange={(v) => onConfigChange({ commission: v })}
        />

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 hidden sm:block" />

        {/* Date range presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/40 shrink-0">周期:</span>
          {PERIOD_PRESETS.map((p) => {
            const isActive =
              p.start !== undefined
                ? config.startDate === p.start && config.endDate === p.end
                : false;
            return (
              <button
                key={p.label}
                onClick={() => {
                  if (p.start && p.end) {
                    onConfigChange({ startDate: p.start, endDate: p.end });
                  } else if (p.startOffset) {
                    onConfigChange({
                      startDate: dateFromOffset(p.startOffset),
                      endDate: todayStr(),
                    });
                  }
                }}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-all",
                  isActive
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-white/50 hover:text-white/70 hover:bg-white/5",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 hidden sm:block" />

        {/* Toggles */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.sensitivityAnalysis}
            onChange={(e) => onConfigChange({ sensitivityAnalysis: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent"
          />
          <span className="text-xs text-white/50">灵敏度分析</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.benchmarkComparison}
            onChange={(e) => onConfigChange({ benchmarkComparison: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent"
          />
          <span className="text-xs text-white/50">基准对比</span>
        </label>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action button */}
        {isRunning ? (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-loss/15 border border-loss/30 text-loss text-sm font-medium hover:bg-loss/25 transition-all btn-tactile"
          >
            <Square className="w-3.5 h-3.5" />
            取消验证
          </button>
        ) : (
          <DisabledWithReason
            disabled={disabled}
            reason={disabledReason ?? '请完善验证配置'}
          >
            <AsyncButton
              onClick={async () => { await onStart(); }}
              disabled={disabled}
              loadingText="正在验证..."
              successText="验证完成"
              variant="primary"
              className={cn(
                "px-5 py-2 text-sm",
                !disabled && "!bg-accent !text-void hover:brightness-110 shadow-[0_0_15px_rgba(var(--lucrum-accent-rgb,234,179,8),0.25)]",
              )}
            >
              <Play className="w-3.5 h-3.5" />
              开始验证
            </AsyncButton>
          </DisabledWithReason>
        )}
      </div>

      {/* Row 2: Date range inputs (compact) */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
        <span className="text-xs text-white/30 shrink-0">自定义区间:</span>
        <input
          type="date"
          value={config.startDate}
          onChange={(e) => onConfigChange({ startDate: e.target.value })}
          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-accent/50 w-32"
        />
        <span className="text-white/30 text-xs">~</span>
        <input
          type="date"
          value={config.endDate}
          onChange={(e) => onConfigChange({ endDate: e.target.value })}
          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-accent/50 w-32"
        />

        {config.startDate && config.endDate && (
          <span className="text-xs text-white/30 font-mono tabular-nums">
            {config.startDate} ~ {config.endDate}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface ConfigSelectProps<T extends number> {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}

function ConfigSelect<T extends number>({
  label,
  value,
  options,
  onChange,
}: ConfigSelectProps<T>) {
  const current = options.find((o) => o.value === value);

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs hover:bg-white/5 transition">
        <span className="text-white/40">{label}:</span>
        <span className="text-white font-medium">{current?.label ?? String(value)}</span>
        <ChevronDown className="w-3 h-3 text-white/30" />
      </button>

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 py-1 bg-surface border border-white/10 rounded-lg shadow-xl z-20 min-w-[100px] hidden group-hover:block">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "block w-full text-left px-3 py-1.5 text-xs transition-colors",
              value === opt.value
                ? "text-accent bg-accent/10"
                : "text-white/70 hover:bg-white/5",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
