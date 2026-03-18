"use client";

/**
 * Indicator Quick Panel Component - Technical indicator summary display
 * 技术指标快速面板组件 - 技术指标摘要显示
 *
 * Displays key technical indicators with signals for quick reference.
 * 显示关键技术指标及信号，便于快速参考
 */

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Signal type for indicators
 */
export type SignalType = "bullish" | "bearish" | "neutral";

/**
 * Single indicator data
 */
export interface IndicatorData {
  name: string;
  nameEn: string;
  value: number | string;
  signal: SignalType;
  description: string;
}

/**
 * Complete indicator set for a symbol
 */
export interface IndicatorSet {
  symbol: string;
  price: number;
  timestamp: Date;
  indicators: {
    trend: IndicatorData[];
    momentum: IndicatorData[];
    volatility: IndicatorData[];
  };
  overallSignal: SignalType;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}

/**
 * Component props
 */
export interface IndicatorQuickPanelProps {
  symbol: string;
  className?: string;
  compact?: boolean;
}

// =============================================================================
// MOCK DATA GENERATOR / 模拟数据生成器
// =============================================================================

/**
 * Generate mock indicator data for demonstration
 * 生成模拟指标数据用于演示
 */
function generateMockIndicators(symbol: string): IndicatorSet {
  // Randomize for variation
  const randomSignal = (): SignalType => {
    const r = Math.random();
    if (r < 0.35) return "bullish";
    if (r < 0.65) return "neutral";
    return "bearish";
  };

  const rsi = 30 + Math.random() * 40;
  const rsiSignal: SignalType = rsi < 30 ? "bullish" : rsi > 70 ? "bearish" : "neutral";

  const macd = -2 + Math.random() * 4;
  const macdSignal = macd > 0.5 ? "bullish" : macd < -0.5 ? "bearish" : "neutral";

  const kdj = {
    k: 30 + Math.random() * 40,
    d: 30 + Math.random() * 40,
    j: 20 + Math.random() * 60,
  };
  const kdjSignal: SignalType = kdj.k > kdj.d && kdj.j > 50 ? "bullish" :
    kdj.k < kdj.d && kdj.j < 50 ? "bearish" : "neutral";

  const maStatus = Math.random() > 0.5 ? "bullish" : Math.random() > 0.5 ? "neutral" : "bearish";
  const bollingerStatus = Math.random() > 0.6 ? "neutral" : randomSignal();
  const atrPercent = 1.5 + Math.random() * 3;

  const indicators: IndicatorSet["indicators"] = {
    trend: [
      {
        name: "均线系统",
        nameEn: "MA",
        value: maStatus === "bullish" ? "多头排列" : maStatus === "bearish" ? "空头排列" : "交叉整理",
        signal: maStatus,
        description: maStatus === "bullish" ? "5日>10日>20日，上升趋势"
          : maStatus === "bearish" ? "5日<10日<20日，下降趋势"
          : "均线缠绕，方向不明",
      },
      {
        name: "MACD",
        nameEn: "MACD",
        value: macd.toFixed(3),
        signal: macdSignal,
        description: macdSignal === "bullish" ? "DIFF上穿DEA，金叉"
          : macdSignal === "bearish" ? "DIFF下穿DEA，死叉"
          : "DIFF与DEA接近，观望",
      },
    ],
    momentum: [
      {
        name: "RSI(14)",
        nameEn: "RSI",
        value: rsi.toFixed(1),
        signal: rsiSignal,
        description: rsiSignal === "bullish" ? "超卖区域，可能反弹"
          : rsiSignal === "bearish" ? "超买区域，注意回调"
          : "中性区域，震荡为主",
      },
      {
        name: "KDJ",
        nameEn: "KDJ",
        value: `K:${kdj.k.toFixed(0)} D:${kdj.d.toFixed(0)}`,
        signal: kdjSignal,
        description: kdjSignal === "bullish" ? "K上穿D，金叉向上"
          : kdjSignal === "bearish" ? "K下穿D，死叉向下"
          : "K/D交织，方向待定",
      },
    ],
    volatility: [
      {
        name: "布林带",
        nameEn: "BOLL",
        value: bollingerStatus === "bullish" ? "下轨支撑"
          : bollingerStatus === "bearish" ? "上轨压力"
          : "中轨运行",
        signal: bollingerStatus,
        description: bollingerStatus === "bullish" ? "价格触及下轨，反弹概率大"
          : bollingerStatus === "bearish" ? "价格触及上轨，回落概率大"
          : "价格在中轨附近，震荡运行",
      },
      {
        name: "ATR波动",
        nameEn: "ATR",
        value: atrPercent.toFixed(2) + "%",
        signal: atrPercent > 3 ? "bearish" : atrPercent < 2 ? "bullish" : "neutral",
        description: atrPercent > 3 ? "波动率高，风险较大"
          : atrPercent < 2 ? "波动率低，适合持仓"
          : "波动率适中",
      },
    ],
  };

  // Count signals
  const allIndicators = [...indicators.trend, ...indicators.momentum, ...indicators.volatility];
  const bullishCount = allIndicators.filter((i) => i.signal === "bullish").length;
  const bearishCount = allIndicators.filter((i) => i.signal === "bearish").length;
  const neutralCount = allIndicators.filter((i) => i.signal === "neutral").length;

  // Determine overall signal
  let overallSignal: SignalType = "neutral";
  if (bullishCount > bearishCount + 1) overallSignal = "bullish";
  else if (bearishCount > bullishCount + 1) overallSignal = "bearish";

  return {
    symbol,
    price: 100 + Math.random() * 1000,
    timestamp: new Date(),
    indicators,
    overallSignal,
    bullishCount,
    bearishCount,
    neutralCount,
  };
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function IndicatorQuickPanel({
  symbol,
  className,
  compact = false,
}: IndicatorQuickPanelProps) {
  const [indicatorSet, setIndicatorSet] = useState<IndicatorSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trend" | "momentum" | "volatility">("trend");

  // Fetch indicator data
  useEffect(() => {
    setIsLoading(true);

    // Simulate API delay
    const timer = setTimeout(() => {
      const mockData = generateMockIndicators(symbol);
      setIndicatorSet(mockData);
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [symbol]);

  // Update periodically
  useEffect(() => {
    if (!indicatorSet) return;

    const interval = setInterval(() => {
      setIndicatorSet(generateMockIndicators(symbol));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [symbol, indicatorSet !== null]);

  if (isLoading) {
    return (
      <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
        <div className="text-sm font-medium text-white mb-3">技术指标 / Indicators</div>
        <div className="flex items-center justify-center h-32">
          <div className="text-white/50 text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  if (!indicatorSet) {
    return (
      <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
        <div className="text-sm font-medium text-white mb-3">技术指标 / Indicators</div>
        <div className="flex items-center justify-center h-32">
          <div className="text-white/50 text-sm">暂无数据</div>
        </div>
      </div>
    );
  }

  const currentIndicators = indicatorSet.indicators[activeTab];

  return (
    <div className={cn("bg-surface rounded-xl border border-border p-4", className)}>
      {/* Header with overall signal */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-white">技术指标 / Indicators</div>
        <SignalBadge signal={indicatorSet.overallSignal} size="sm" />
      </div>

      {/* Signal summary bar */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-profit"></span>
          <span className="text-profit">{indicatorSet.bullishCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-white/30"></span>
          <span className="text-white/50">{indicatorSet.neutralCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-loss"></span>
          <span className="text-loss">{indicatorSet.bearishCount}</span>
        </div>
        <div className="flex-1"></div>
        <span className="text-white/40">
          {indicatorSet.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Category tabs */}
      {!compact && (
        <div className="flex gap-1 mb-3">
          {([
            { key: "trend", label: "趋势" },
            { key: "momentum", label: "动量" },
            { key: "volatility", label: "波动" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium rounded transition",
                activeTab === tab.key
                  ? "bg-accent/10 text-accent"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Indicators list */}
      <div className="space-y-2">
        {(compact
          ? [...indicatorSet.indicators.trend, ...indicatorSet.indicators.momentum].slice(0, 4)
          : currentIndicators
        ).map((indicator, index) => (
          <IndicatorRow key={index} indicator={indicator} compact={compact} />
        ))}
      </div>

      {/* Footer tip */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="text-xs text-white/40 text-center">
            {indicatorSet.overallSignal === "bullish"
              ? "多数指标看涨，注意逢低布局"
              : indicatorSet.overallSignal === "bearish"
                ? "多数指标看跌，建议谨慎操作"
                : "指标分歧，建议观望等待"}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS / 子组件
// =============================================================================

interface SignalBadgeProps {
  signal: SignalType;
  size?: "sm" | "md";
}

function SignalBadge({ signal, size = "md" }: SignalBadgeProps) {
  const config = {
    bullish: {
      bg: "bg-profit/10",
      text: "text-profit",
      label: "看涨",
      labelEn: "Bullish",
    },
    bearish: {
      bg: "bg-loss/10",
      text: "text-loss",
      label: "看跌",
      labelEn: "Bearish",
    },
    neutral: {
      bg: "bg-white/10",
      text: "text-white/70",
      label: "中性",
      labelEn: "Neutral",
    },
  };

  const c = config[signal];

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded",
        c.bg,
        size === "sm" ? "px-2 py-0.5" : "px-3 py-1"
      )}
    >
      <span
        className={cn(
          "rounded-full",
          c.text,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
        style={{ backgroundColor: "currentColor" }}
      ></span>
      <span className={cn(c.text, size === "sm" ? "text-xs" : "text-sm", "font-medium")}>
        {c.label}
      </span>
    </div>
  );
}

interface IndicatorRowProps {
  indicator: IndicatorData;
  compact?: boolean;
}

function IndicatorRow({ indicator, compact = false }: IndicatorRowProps) {
  const signalColors = {
    bullish: "text-profit",
    bearish: "text-loss",
    neutral: "text-white/70",
  };

  return (
    <div className="flex items-center justify-between p-2 rounded bg-background/50 hover:bg-background transition">
      <div className="flex items-center gap-2 flex-1">
        {/* Signal indicator dot */}
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            indicator.signal === "bullish" && "bg-profit",
            indicator.signal === "bearish" && "bg-loss",
            indicator.signal === "neutral" && "bg-white/30"
          )}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white font-medium">{indicator.name}</span>
            <span className="text-xs text-white/40">{indicator.nameEn}</span>
          </div>
          {!compact && (
            <div className="text-xs text-white/40 mt-0.5 line-clamp-1">
              {indicator.description}
            </div>
          )}
        </div>
      </div>
      <div className={cn("text-sm font-mono font-medium", signalColors[indicator.signal])}>
        {indicator.value}
      </div>
    </div>
  );
}

export default IndicatorQuickPanel;
