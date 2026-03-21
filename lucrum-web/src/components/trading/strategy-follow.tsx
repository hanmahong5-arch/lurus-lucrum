"use client";

/**
 * Strategy Auto-Follow Panel Component
 *
 * Allows users to bind a quantitative strategy for auto-following:
 * - Select strategy to follow
 * - Toggle between auto-execute and alert-only modes
 * - Show last signal information
 * - Status indicator
 */

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface StrategyFollowProps {
  className?: string;
}

interface StrategyConfig {
  strategyId: string;
  strategyName: string;
  autoExecute: boolean;
  alertOnly: boolean;
}

interface SignalRecord {
  timestamp: string;
  action: "buy" | "sell";
  symbol: string;
  symbolName: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STRATEGY_FOLLOW_STORAGE_KEY = "lucrum-strategy-follow";

const AVAILABLE_STRATEGIES = [
  { id: "macd-golden-cross", name: "MACD双金叉" },
  { id: "ma-breakout", name: "均线突破" },
  { id: "rsi-oversold", name: "RSI超卖反弹" },
  { id: "volume-breakout", name: "放量突破" },
  { id: "bollinger-squeeze", name: "布林收口" },
] as const;

// =============================================================================
// HELPERS
// =============================================================================

function loadStrategyConfig(): StrategyConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STRATEGY_FOLLOW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StrategyConfig;
  } catch {
    return null;
  }
}

function saveStrategyConfig(config: StrategyConfig | null) {
  if (typeof window === "undefined") return;
  if (config === null) {
    localStorage.removeItem(STRATEGY_FOLLOW_STORAGE_KEY);
  } else {
    localStorage.setItem(STRATEGY_FOLLOW_STORAGE_KEY, JSON.stringify(config));
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StrategyFollow({ className }: StrategyFollowProps) {
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [lastSignal] = useState<SignalRecord | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    setConfig(loadStrategyConfig());
    setIsInitialized(true);
  }, []);

  const handleSelectStrategy = useCallback(
    (strategyId: string, strategyName: string) => {
      const newConfig: StrategyConfig = {
        strategyId,
        strategyName,
        autoExecute: false,
        alertOnly: true,
      };
      setConfig(newConfig);
      saveStrategyConfig(newConfig);
      setShowSelector(false);
    },
    [],
  );

  const handleToggleMode = useCallback(
    (mode: "autoExecute" | "alertOnly") => {
      if (!config) return;
      const newConfig: StrategyConfig = {
        ...config,
        autoExecute: mode === "autoExecute" ? !config.autoExecute : false,
        alertOnly: mode === "alertOnly" ? !config.alertOnly : false,
      };
      // At least one must be active
      if (!newConfig.autoExecute && !newConfig.alertOnly) {
        newConfig.alertOnly = true;
      }
      setConfig(newConfig);
      saveStrategyConfig(newConfig);
    },
    [config],
  );

  const handleUnbind = useCallback(() => {
    setConfig(null);
    saveStrategyConfig(null);
  }, []);

  // Wait for hydration to avoid SSR mismatch
  if (!isInitialized) return null;

  return (
    <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">策略跟单</h3>
        {config && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-xs font-medium text-primary">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse"
            />
            监控中
          </div>
        )}
      </div>

      {config ? (
        <div className="space-y-3">
          {/* Bound strategy */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-white/50">绑定策略</span>
              <div className="text-sm text-white font-medium mt-0.5">
                {config.strategyName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="text-xs text-accent hover:text-accent/80 transition"
            >
              更换
            </button>
          </div>

          {/* Last signal */}
          {lastSignal ? (
            <div className="p-2 bg-background rounded-lg text-xs">
              <span className="text-white/50">上次信号: </span>
              <span className="text-white">
                {lastSignal.timestamp}{" "}
                <span
                  className={
                    lastSignal.action === "buy" ? "text-profit" : "text-loss"
                  }
                >
                  {lastSignal.action === "buy" ? "买入" : "卖出"}
                </span>{" "}
                {lastSignal.symbolName}
              </span>
            </div>
          ) : (
            <div className="p-2 bg-background rounded-lg text-xs text-white/40">
              暂无信号记录
            </div>
          )}

          {/* Mode toggles */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoExecute}
                onChange={() => handleToggleMode("autoExecute")}
                className="w-3.5 h-3.5 rounded border-border bg-background text-accent focus:ring-accent/50 cursor-pointer"
              />
              <span className="text-xs text-white/60">自动执行</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.alertOnly}
                onChange={() => handleToggleMode("alertOnly")}
                className="w-3.5 h-3.5 rounded border-border bg-background text-accent focus:ring-accent/50 cursor-pointer"
              />
              <span className="text-xs text-white/60">仅提醒</span>
            </label>
          </div>

          {/* Unbind */}
          <button
            type="button"
            onClick={handleUnbind}
            className="w-full text-xs text-white/30 hover:text-white/50 transition py-1"
          >
            解除绑定
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {!showSelector ? (
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="w-full py-6 border border-dashed border-border rounded-lg text-sm text-white/40 hover:text-white/60 hover:border-white/20 transition"
            >
              + 绑定跟单策略
            </button>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-white/50 mb-2">选择策略</div>
              {AVAILABLE_STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectStrategy(s.id, s.name)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
                >
                  {s.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowSelector(false)}
                className="w-full text-xs text-white/30 hover:text-white/50 transition py-1 mt-1"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
