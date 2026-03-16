"use client";

/**
 * Signal Timeline Component
 * 信号时间线组件
 *
 * Displays signal distribution over time with return indicators
 * 展示信号随时间的分布以及收益指标
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface TimelinePoint {
  date: string;
  signalCount: number;
  avgReturn: number;
  winCount: number;
  lossCount: number;
}

interface SignalTimelineProps {
  data: TimelinePoint[];
  className?: string;
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function SignalTimeline({ data, className = "" }: SignalTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"signals" | "returns">("signals");

  // Calculate statistics
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return { maxSignals: 0, minReturn: 0, maxReturn: 0, totalSignals: 0 };
    }

    const maxSignals = Math.max(...data.map((d) => d.signalCount));
    const returns = data.filter((d) => d.signalCount > 0).map((d) => d.avgReturn);
    const minReturn = returns.length > 0 ? Math.min(...returns) : 0;
    const maxReturn = returns.length > 0 ? Math.max(...returns) : 0;
    const totalSignals = data.reduce((sum, d) => sum + d.signalCount, 0);

    return { maxSignals, minReturn, maxReturn, totalSignals };
  }, [data]);

  // Get display data (last N days based on screen)
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(-60); // Show last 60 data points
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <span className="text-sm font-medium text-white">
              信号时间线 / Signal Timeline
            </span>
          </div>
        </div>
        <div className="p-8 text-center text-white/40">
          <p>暂无数据 / No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className="text-sm font-medium text-white">
            信号时间线 / Signal Timeline
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-primary/30 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("signals")}
              className={cn(
                "px-2 py-1 text-xs rounded transition",
                viewMode === "signals"
                  ? "bg-accent text-primary-600"
                  : "text-white/50 hover:text-white"
              )}
            >
              信号数
            </button>
            <button
              onClick={() => setViewMode("returns")}
              className={cn(
                "px-2 py-1 text-xs rounded transition",
                viewMode === "returns"
                  ? "bg-accent text-primary-600"
                  : "text-white/50 hover:text-white"
              )}
            >
              收益率
            </button>
          </div>
          <span className="text-xs text-white/40 ml-2">
            共 {stats.totalSignals} 个信号
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Timeline Chart */}
        <div className="relative h-32">
          {/* Y-axis */}
          <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-white/30">
            {viewMode === "signals" ? (
              <>
                <span>{stats.maxSignals}</span>
                <span>{Math.floor(stats.maxSignals / 2)}</span>
                <span>0</span>
              </>
            ) : (
              <>
                <span className="text-profit">{stats.maxReturn.toFixed(1)}%</span>
                <span>0%</span>
                <span className="text-loss">{stats.minReturn.toFixed(1)}%</span>
              </>
            )}
          </div>

          {/* Chart Area */}
          <div className="ml-12 h-full relative">
            {/* Zero line for returns view */}
            {viewMode === "returns" && (
              <div
                className="absolute left-0 right-0 h-px bg-white/20"
                style={{
                  top: `${
                    stats.maxReturn === stats.minReturn
                      ? 50
                      : (stats.maxReturn / (stats.maxReturn - stats.minReturn)) * 100
                  }%`,
                }}
              />
            )}

            {/* Bars */}
            <div className="flex items-end h-[calc(100%-24px)] gap-px">
              {displayData.map((point, index) => {
                let height: number;
                let barColor: string;

                if (viewMode === "signals") {
                  height = stats.maxSignals > 0 ? (point.signalCount / stats.maxSignals) * 100 : 0;
                  barColor =
                    point.signalCount === 0
                      ? "bg-white/5"
                      : point.avgReturn >= 0
                      ? "bg-profit/60 hover:bg-profit/80"
                      : "bg-loss/60 hover:bg-loss/80";
                } else {
                  // Returns view - show bar from zero line
                  const range = stats.maxReturn - stats.minReturn;
                  const zeroPosition = range > 0 ? (stats.maxReturn / range) * 100 : 50;

                  if (point.signalCount === 0) {
                    height = 0;
                    barColor = "bg-white/5";
                  } else if (point.avgReturn >= 0) {
                    height = range > 0 ? (point.avgReturn / stats.maxReturn) * zeroPosition : 0;
                    barColor = "bg-profit/60 hover:bg-profit/80";
                  } else {
                    height = range > 0 ? (Math.abs(point.avgReturn) / Math.abs(stats.minReturn)) * (100 - zeroPosition) : 0;
                    barColor = "bg-loss/60 hover:bg-loss/80";
                  }
                }

                const isHovered = hoveredIndex === index;

                return (
                  <div
                    key={index}
                    className="flex-1 relative flex flex-col justify-end h-full"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {viewMode === "signals" ? (
                      <div
                        className={cn(
                          "w-full rounded-t transition-all cursor-pointer",
                          barColor,
                          isHovered && "ring-1 ring-white/30"
                        )}
                        style={{
                          height: `${height}%`,
                          minHeight: point.signalCount > 0 ? "2px" : "0",
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-center">
                        {point.avgReturn >= 0 ? (
                          <div
                            className={cn(
                              "w-full rounded-t transition-all cursor-pointer",
                              barColor,
                              isHovered && "ring-1 ring-white/30"
                            )}
                            style={{
                              height: `${height}%`,
                              minHeight: point.signalCount > 0 ? "2px" : "0",
                            }}
                          />
                        ) : (
                          <div className="flex-1" />
                        )}
                        {point.avgReturn < 0 && (
                          <div
                            className={cn(
                              "w-full rounded-b transition-all cursor-pointer",
                              barColor,
                              isHovered && "ring-1 ring-white/30"
                            )}
                            style={{
                              height: `${height}%`,
                              minHeight: point.signalCount > 0 ? "2px" : "0",
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Tooltip */}
                    {isHovered && point.signalCount > 0 && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-surface border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-20 shadow-lg">
                        <div className="text-white font-medium">{point.date}</div>
                        <div className="text-white/60">
                          信号: {point.signalCount}个
                        </div>
                        <div className={point.avgReturn >= 0 ? "text-profit" : "text-loss"}>
                          平均: {point.avgReturn >= 0 ? "+" : ""}{point.avgReturn.toFixed(2)}%
                        </div>
                        <div className="text-white/40">
                          胜/负: {point.winCount}/{point.lossCount}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between mt-1 text-xs text-white/40">
              <span>{displayData[0]?.date ?? ""}</span>
              <span>{displayData[Math.floor(displayData.length / 2)]?.date ?? ""}</span>
              <span>{displayData[displayData.length - 1]?.date ?? ""}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-xs text-white/40">总信号</div>
            <div className="text-sm font-medium text-accent">{stats.totalSignals}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">有信号天数</div>
            <div className="text-sm font-medium text-white">
              {data.filter((d) => d.signalCount > 0).length}天
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">日均信号</div>
            <div className="text-sm font-medium text-white">
              {(stats.totalSignals / Math.max(data.filter((d) => d.signalCount > 0).length, 1)).toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">最多单日</div>
            <div className="text-sm font-medium text-white">{stats.maxSignals}个</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignalTimeline;
