"use client";

/**
 * Live Signal Card
 *
 * Surfaces the "what should I be holding right now?" answer at the top of
 * the backtest results view — closing the loop between historical curve and
 * actionable intent (Trade Ideas Signal State pattern, adapted).
 *
 * Inputs the same BacktestResult the parent view already has; computes the
 * current position state by walking the trade log forward. No real-time data
 * dependency — this is the strategy's final state at backtest end, which
 * doubles as "if you ran this strategy today, this is where you'd stand".
 *
 * Includes a Sprint-0 compliance hedge: a "教育用途·非投资建议" badge so the
 * card never reads as a trading recommendation.
 *
 * @module components/backtest/live-signal-card
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { BacktestResult, BacktestTrade } from "@/lib/backtest/types";

// =============================================================================
// COMPUTATION
// =============================================================================

export interface SignalState {
  kind: "long" | "flat" | "no-trades";
  netSize: number;
  entryPrice?: number;
  lastTrade?: BacktestTrade;
  lastPriceContext?: number;
  unrealizedPnlPct?: number;
}

/**
 * Exported for unit tests — derives "what should I be holding right now?"
 * by walking the backtest trade log forward. Pure function, no side effects.
 */
export function computeSignalState(result: BacktestResult): SignalState {
  const trades = result.trades ?? [];
  if (trades.length === 0) {
    return { kind: "no-trades", netSize: 0 };
  }

  let netSize = 0;
  let entryCost = 0;
  for (const t of trades) {
    if (t.type === "buy") {
      netSize += t.size;
      entryCost += t.price * t.size;
    } else {
      netSize -= t.size;
      // when fully closed we'll re-zero entryCost below
    }
    if (netSize <= 0) {
      netSize = 0;
      entryCost = 0;
    }
  }

  const last = trades[trades.length - 1]!;
  const lastPriceContext =
    result.equityCurve?.[result.equityCurve.length - 1]?.equity ?? undefined;

  if (netSize > 0 && entryCost > 0) {
    const avgEntry = entryCost / netSize;
    // We don't have a true "current price" in the result — approximate using
    // the last trade's price as the most recent decisional price reference.
    const ref = last.price;
    const unrealizedPnlPct = ((ref - avgEntry) / avgEntry) * 100;
    return {
      kind: "long",
      netSize,
      entryPrice: avgEntry,
      lastTrade: last,
      lastPriceContext,
      unrealizedPnlPct,
    };
  }

  return {
    kind: "flat",
    netSize: 0,
    lastTrade: last,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export interface LiveSignalCardProps {
  result: BacktestResult;
  /** Symbol code, used in label (overrides result.config.symbol). */
  symbol?: string;
  /** Click handler for the "纸上跑一遍" CTA — wires to future Paper Trading. */
  onPaperRun?: () => void;
  className?: string;
}

export function LiveSignalCard({
  result,
  symbol,
  onPaperRun,
  className,
}: LiveSignalCardProps) {
  const state = useMemo(() => computeSignalState(result), [result]);
  const targetSymbol =
    symbol ??
    result.backtestMeta?.targetSymbol ??
    result.config?.symbol ??
    "—";
  const targetName = result.backtestMeta?.targetName ?? targetSymbol;
  const lastTradeDate = state.lastTrade
    ? new Date(state.lastTrade.timestamp).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface/60 backdrop-blur-sm px-4 py-3",
        state.kind === "long"
          ? "border-profit/30"
          : state.kind === "flat"
            ? "border-white/10"
            : "border-yellow-500/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full",
              state.kind === "long"
                ? "bg-profit animate-pulse"
                : state.kind === "flat"
                  ? "bg-white/40"
                  : "bg-yellow-500/70",
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-neutral-100">
            {state.kind === "long"
              ? "🟢 当前应持有"
              : state.kind === "flat"
                ? "⚪ 当前空仓 / 等待信号"
                : "⚠️ 策略在回测期未触发任何交易"}
          </span>
        </div>
        <span
          className="text-[9px] text-white/40 uppercase tracking-wide whitespace-nowrap"
          title="本平台不提供投资建议；本卡片是回测末日策略状态的快照，仅用于研究"
        >
          教育用途·非投资建议
        </span>
      </div>

      {state.kind === "long" && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-white/40 text-[10px]">标的</span>
            <span className="text-neutral-100 font-medium">{targetName}</span>
            <span className="text-white/40 font-mono text-[10px]">
              {targetSymbol}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-white/40 text-[10px]">入场价</span>
            <span className="font-mono tabular-nums text-neutral-100">
              ¥{state.entryPrice?.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-white/40 text-[10px]">最近信号价</span>
            <span className="font-mono tabular-nums text-neutral-100">
              ¥{state.lastTrade?.price.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-white/40 text-[10px]">浮动盈亏</span>
            <span
              className={cn(
                "font-mono tabular-nums font-medium",
                (state.unrealizedPnlPct ?? 0) >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {(state.unrealizedPnlPct ?? 0) >= 0 ? "+" : ""}
              {state.unrealizedPnlPct?.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {state.kind === "flat" && state.lastTrade && (
        <div className="mt-2 text-xs text-white/60">
          上次平仓 <span className="font-mono">{lastTradeDate}</span> · 平仓价{" "}
          <span className="font-mono tabular-nums">
            ¥{state.lastTrade.price.toFixed(2)}
          </span>
          {state.lastTrade.reason && (
            <span className="text-white/40"> · {state.lastTrade.reason}</span>
          )}
        </div>
      )}

      {state.kind === "no-trades" && (
        <p className="mt-2 text-xs text-yellow-300/70">
          策略在回测期间没有触发任何买入信号。检查参数边界是否过严，或换一个标的再试。
        </p>
      )}

      {onPaperRun && state.kind !== "no-trades" && (
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onPaperRun}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg font-medium transition btn-tactile",
              "bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30",
            )}
            title="即将上线：用今天的实时行情跑一遍这个策略（不动真钱）"
          >
            纸上跑一遍 →
          </button>
        </div>
      )}
    </div>
  );
}
