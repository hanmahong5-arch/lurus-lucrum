"use client";

/**
 * Trade Narrative Panel
 *
 * Shows the STORY of a specific trade: what indicators looked like,
 * why the signal fired, and the outcome. Designed to sit next to the K-line
 * chart as a side panel when a trade marker is clicked.
 *
 * Philosophy: show indicators with direction arrows so a trader can
 * self-derive the reasoning. No lengthy explanations.
 *
 * @module components/backtest/trade-narrative
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TradeMarkerInfo } from "@/components/charts/kline-chart";
import type { BacktestDailyLog } from "@/lib/backtest/types";

// =============================================================================
// TYPES
// =============================================================================

interface TradeNarrativeProps {
  /** The selected trade to display */
  trade: TradeMarkerInfo;
  /** The paired trade (exit for a buy, entry for a sell) */
  pairedTrade: TradeMarkerInfo | null;
  /** Daily log entry at the trade's bar (for full indicator context) */
  dailyLog: BacktestDailyLog | null;
  /** Close the narrative panel */
  onClose: () => void;
  /** Navigate chart to the paired trade */
  onNavigateToPaired: (timestamp: number) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Determine trend direction of a value vs previous */
function getTrend(
  current: number | undefined,
  previous: number | undefined,
): { arrow: string; label: string; className: string } {
  if (current === undefined || previous === undefined) {
    return {
      arrow: "\u2500\u2500",
      label: "\u2500\u2500",
      className: "text-white/30",
    };
  }
  const diff = current - previous;
  const pct = previous !== 0 ? Math.abs((diff / previous) * 100) : 0;

  if (Math.abs(diff) < 0.001) {
    return {
      arrow: "\u2500\u2500",
      label: "\u6a2a\u76d8",
      className: "text-white/40",
    };
  }
  if (diff > 0) {
    return {
      arrow: "\u2197",
      label:
        pct > 5
          ? "\u5f3a\u52bf\u4e0a\u884c"
          : "\u4e0a\u884c",
      className: "text-profit",
    };
  }
  return {
    arrow: "\u2198",
    label:
      pct > 5
        ? "\u5f3a\u52bf\u4e0b\u884c"
        : "\u4e0b\u884c",
    className: "text-loss",
  };
}

/** Classify RSI value into zones */
function classifyRsi(
  value: number | undefined,
): { label: string; className: string } {
  if (value === undefined)
    return { label: "\u2014", className: "text-white/30" };
  if (value >= 80)
    return {
      label: "\u6781\u5ea6\u8d85\u4e70",
      className: "text-loss font-medium",
    };
  if (value >= 70)
    return {
      label: "\u8d85\u4e70\u533a",
      className: "text-loss",
    };
  if (value <= 20)
    return {
      label: "\u6781\u5ea6\u8d85\u5356",
      className: "text-profit font-medium",
    };
  if (value <= 30)
    return {
      label: "\u8d85\u5356\u533a",
      className: "text-profit",
    };
  return {
    label: "\u4e2d\u6027\u533a\u95f4",
    className: "text-white/40",
  };
}

/** Format price concisely */
function fmtPrice(v: number): string {
  if (v >= 10000) return `\u00a5${(v / 10000).toFixed(2)}\u4e07`;
  return `\u00a5${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TradeNarrative({
  trade,
  pairedTrade,
  dailyLog,
  onClose,
  onNavigateToPaired,
}: TradeNarrativeProps) {
  const isBuy = trade.type === "buy";
  const date = new Date(trade.timestamp * 1000).toLocaleDateString(
    "zh-CN",
    { year: "numeric", month: "2-digit", day: "2-digit" },
  );

  // Build indicator display from dailyLog or trade's indicatorValues
  const indicators = useMemo(() => {
    const ind = dailyLog?.indicators ?? {};
    const tradeInd = trade.indicatorValues;
    const items: Array<{
      key: string;
      label: string;
      value: string;
      trend: ReturnType<typeof getTrend>;
      highlight: boolean;
    }> = [];

    // SMA indicators
    const smaKeys = [
      ["sma5", "SMA5"],
      ["sma10", "SMA10"],
      ["sma20", "SMA20"],
      ["sma60", "SMA60"],
    ] as const;
    for (const [key, label] of smaKeys) {
      const val = ind[key] ?? tradeInd[key];
      if (val !== undefined && isFinite(val)) {
        // Determine if this SMA is being crossed by another
        const isCrossed =
          trade.triggerReason.includes(label) ||
          trade.triggerReason.includes(key);
        items.push({
          key,
          label,
          value: val.toFixed(2),
          trend: getTrend(val, undefined), // No previous available in single log
          highlight: isCrossed,
        });
      }
    }

    // RSI
    const rsiVal = ind.rsi ?? tradeInd["rsi"] ?? tradeInd["RSI"];
    if (rsiVal !== undefined && isFinite(rsiVal)) {
      const rsiClass = classifyRsi(rsiVal);
      items.push({
        key: "rsi",
        label: "RSI",
        value: rsiVal.toFixed(1),
        trend: {
          arrow: "",
          label: rsiClass.label,
          className: rsiClass.className,
        },
        highlight: trade.triggerReason.toLowerCase().includes("rsi"),
      });
    }

    // MACD
    const macdDif =
      ind.macdDif ?? tradeInd["macdDif"] ?? tradeInd["MACD_DIF"];
    const macdDea =
      ind.macdDea ?? tradeInd["macdDea"] ?? tradeInd["MACD_DEA"];
    const macdHist =
      ind.macdHist ?? tradeInd["macdHist"] ?? tradeInd["MACD_HIST"];

    if (macdDif !== undefined && isFinite(macdDif)) {
      const macdRelation =
        macdDea !== undefined
          ? macdDif > macdDea
            ? "DIF > DEA"
            : macdDif < macdDea
              ? "DIF < DEA"
              : "DIF = DEA"
          : "";
      items.push({
        key: "macdDif",
        label: "MACD",
        value: `${macdDif.toFixed(2)} ${macdRelation}`,
        trend: {
          arrow:
            macdHist !== undefined
              ? macdHist >= 0
                ? "\u25b2"
                : "\u25bc"
              : "\u2500\u2500",
          label:
            macdHist !== undefined
              ? macdHist >= 0
                ? "\u591a\u5934"
                : "\u7a7a\u5934"
              : "",
          className:
            macdHist !== undefined
              ? macdHist >= 0
                ? "text-profit"
                : "text-loss"
              : "text-white/30",
        },
        highlight:
          trade.triggerReason.toLowerCase().includes("macd") ||
          trade.triggerReason.includes("\u91d1\u53c9") ||
          trade.triggerReason.includes("\u6b7b\u53c9"),
      });
    }

    // Bollinger Bands
    const bollUpper = ind.bollUpper ?? tradeInd["bollUpper"];
    const bollMiddle = ind.bollMiddle ?? tradeInd["bollMiddle"];
    const bollLower = ind.bollLower ?? tradeInd["bollLower"];
    if (
      bollUpper !== undefined &&
      bollMiddle !== undefined &&
      bollLower !== undefined
    ) {
      const closePrice = dailyLog?.close ?? trade.executePrice;
      let bandPos = "";
      if (closePrice >= bollUpper)
        bandPos = "\u2265 \u4e0a\u8f68";
      else if (closePrice <= bollLower)
        bandPos = "\u2264 \u4e0b\u8f68";
      else bandPos = "\u4e2d\u8f68\u9644\u8fd1";

      items.push({
        key: "boll",
        label: "BOLL",
        value: `${bollMiddle.toFixed(1)} ${bandPos}`,
        trend: {
          arrow: "",
          label: bandPos,
          className:
            closePrice >= bollUpper
              ? "text-loss"
              : closePrice <= bollLower
                ? "text-profit"
                : "text-white/40",
        },
        highlight:
          trade.triggerReason.includes("\u5e03\u6797") ||
          trade.triggerReason.includes("BOLL") ||
          trade.triggerReason.includes("\u7a81\u7834") ||
          trade.triggerReason.includes("\u8dcc\u7834"),
      });
    }

    // If no structured indicators, fall back to trade.indicatorValues
    if (items.length === 0) {
      for (const [k, v] of Object.entries(tradeInd)) {
        if (isFinite(v)) {
          items.push({
            key: k,
            label: k,
            value: v.toFixed(2),
            trend: {
              arrow: "\u2500\u2500",
              label: "",
              className: "text-white/30",
            },
            highlight: false,
          });
        }
      }
    }

    return items;
  }, [trade, dailyLog]);

  // Trade index (approximate from count of trades before this one)
  const tradeDate = new Date(trade.timestamp * 1000);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{
          background: isBuy
            ? "rgba(239,68,68,0.08)"
            : "rgba(16,185,129,0.08)",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-bold text-sm"
              style={{ color: isBuy ? "#ef4444" : "#10b981" }}
            >
              {isBuy
                ? "\u25b2 \u4e70\u5165"
                : "\u25bc \u5356\u51fa"}
            </span>
            <span className="text-white/40 text-xs font-mono tabular-nums">
              {date}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Close narrative panel"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Trigger reason */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
          {"\u89e6\u53d1"}
        </div>
        <div
          className="text-sm text-white/80 leading-relaxed"
          style={{
            color: isBuy
              ? "rgba(239,68,68,0.9)"
              : "rgba(16,185,129,0.9)",
          }}
        >
          {trade.triggerReason || "\u2014"}
        </div>
      </div>

      {/* Indicator snapshot */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
          {"\u4fe1\u53f7\u5f62\u6210\u65f6\u7684\u6307\u6807\u72b6\u6001"}
        </div>
        <div className="space-y-1.5">
          {indicators.map((ind) => (
            <div
              key={ind.key}
              className={cn(
                "flex items-center justify-between text-xs px-2 py-1 rounded",
                ind.highlight
                  ? "bg-white/5 border border-white/10"
                  : "",
              )}
            >
              <span
                className={cn(
                  "font-mono",
                  ind.highlight
                    ? "text-white/80 font-medium"
                    : "text-white/50",
                )}
              >
                {ind.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-white/70 font-mono tabular-nums">
                  {ind.value}
                </span>
                {ind.trend.label && (
                  <span
                    className={cn(
                      "text-[10px]",
                      ind.trend.className,
                    )}
                  >
                    {ind.trend.arrow} {ind.trend.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution details */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
          {"\u6267\u884c"}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">
              {"\u6210\u4ea4\u4ef7"}
            </span>
            <span className="text-white font-mono tabular-nums">
              {fmtPrice(trade.executePrice)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">
              {"\u6570\u91cf"}
            </span>
            <span className="text-white font-mono tabular-nums">
              {trade.lots}
              {"\u624b"} ({trade.quantity.toLocaleString()}
              {"\u80a1"})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">
              {"\u6210\u672c"}
            </span>
            <span className="text-white/50 font-mono tabular-nums">
              {"\u624b\u7eed\u8d39"}
              {fmtPrice(trade.commission)} +{" "}
              {"\u6ed1\u70b9"}
              {fmtPrice(trade.slippage)}
            </span>
          </div>
        </div>
      </div>

      {/* Outcome — for sell trades or paired result */}
      {!isBuy && trade.pnl !== undefined && (
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            {"\u7ed3\u679c"}
          </div>
          <div
            className={cn(
              "text-lg font-bold font-mono tabular-nums",
              (trade.pnl ?? 0) >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {(trade.pnl ?? 0) >= 0 ? "+" : ""}
            {fmtPrice(trade.pnl ?? 0)}
            {trade.pnlPercent !== undefined && (
              <span className="text-sm ml-1">
                ({trade.pnlPercent >= 0 ? "+" : ""}
                {trade.pnlPercent.toFixed(1)}%)
              </span>
            )}
          </div>
          {trade.holdingDays !== undefined && (
            <div className="text-xs text-white/40 mt-1">
              {"\u6301\u4ed3"} {trade.holdingDays}{" "}
              {"\u5929"}
            </div>
          )}
        </div>
      )}

      {isBuy && pairedTrade && pairedTrade.pnl !== undefined && (
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            {"\u5356\u51fa\u7ed3\u679c"}
          </div>
          <div
            className={cn(
              "text-lg font-bold font-mono tabular-nums",
              (pairedTrade.pnl ?? 0) >= 0
                ? "text-profit"
                : "text-loss",
            )}
          >
            {(pairedTrade.pnl ?? 0) >= 0 ? "+" : ""}
            {fmtPrice(pairedTrade.pnl ?? 0)}
            {pairedTrade.pnlPercent !== undefined && (
              <span className="text-sm ml-1">
                ({pairedTrade.pnlPercent >= 0 ? "+" : ""}
                {pairedTrade.pnlPercent.toFixed(1)}%)
              </span>
            )}
          </div>
          {pairedTrade.holdingDays !== undefined && (
            <div className="text-xs text-white/40 mt-1">
              {"\u6301\u4ed3"} {pairedTrade.holdingDays}{" "}
              {"\u5929\u540e\u5356\u51fa"}
            </div>
          )}
        </div>
      )}

      {/* Link to paired trade */}
      {pairedTrade && (
        <div className="px-4 py-3">
          <button
            onClick={() => onNavigateToPaired(pairedTrade.timestamp)}
            className="w-full text-xs text-primary hover:text-primary/80 transition-colors text-left flex items-center gap-1"
          >
            <span className="text-white/20">{"\u21b3"}</span>
            {isBuy
              ? `\u67e5\u770b\u5356\u51fa\u8be6\u60c5 (${new Date(pairedTrade.timestamp * 1000).toLocaleDateString("zh-CN")})`
              : `\u67e5\u770b\u4e70\u5165\u8be6\u60c5 (${new Date(pairedTrade.timestamp * 1000).toLocaleDateString("zh-CN")})`}
          </button>
        </div>
      )}
    </div>
  );
}
