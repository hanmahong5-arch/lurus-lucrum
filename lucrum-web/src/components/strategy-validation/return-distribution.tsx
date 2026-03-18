"use client";

/**
 * Return Distribution Chart Component
 * 收益分布图组件
 *
 * Displays histogram of return distribution across signals
 * 展示信号收益的分布直方图
 */

import { cn } from "@/lib/utils";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface DistributionBucket {
  range: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  percentage: number;
}

interface ReturnDistributionProps {
  data: DistributionBucket[];
  avgReturn?: number;
  medianReturn?: number;
  className?: string;
}

// =============================================================================
// COMPONENT / 组件
// =============================================================================

export function ReturnDistribution({
  data,
  avgReturn,
  medianReturn,
  className = "",
}: ReturnDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium text-white">
              收益分布 / Return Distribution
            </span>
          </div>
        </div>
        <div className="p-8 text-center text-white/40">
          <p>暂无数据 / No data available</p>
        </div>
      </div>
    );
  }

  // Find max count for scaling
  const maxCount = Math.max(...data.map((d) => d.count));

  // Calculate position for average and median lines
  const getLinePosition = (value: number): number | null => {
    if (data.length === 0) return null;
    const first = data[0];
    const last = data[data.length - 1];
    if (!first || !last) return null;
    const totalRange = last.rangeEnd - first.rangeStart;
    if (totalRange === 0) return null;
    return ((value - first.rangeStart) / totalRange) * 100;
  };

  const avgPosition = avgReturn !== undefined ? getLinePosition(avgReturn) : null;
  const medianPosition = medianReturn !== undefined ? getLinePosition(medianReturn) : null;

  return (
    <div className={`bg-surface/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="text-sm font-medium text-white">
            收益分布 / Return Distribution
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {avgReturn !== undefined && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-accent" />
              <span className="text-white/50">
                平均: <span className={avgReturn >= 0 ? "text-profit" : "text-loss"}>
                  {avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(2)}%
                </span>
              </span>
            </div>
          )}
          {medianReturn !== undefined && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-blue-400" />
              <span className="text-white/50">
                中位: <span className={medianReturn >= 0 ? "text-profit" : "text-loss"}>
                  {medianReturn >= 0 ? "+" : ""}{medianReturn.toFixed(2)}%
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Chart */}
        <div className="relative h-40">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-white/30">
            <span>{maxCount}</span>
            <span>{Math.floor(maxCount / 2)}</span>
            <span>0</span>
          </div>

          {/* Chart area */}
          <div className="ml-10 h-full relative">
            {/* Zero line */}
            <div
              className="absolute top-0 bottom-6 w-px bg-white/20"
              style={{ left: `${getLinePosition(0) ?? 50}%` }}
            />

            {/* Average line */}
            {avgPosition !== null && (
              <div
                className="absolute top-0 bottom-6 w-0.5 bg-accent z-10"
                style={{ left: `${avgPosition}%` }}
                title={`平均收益: ${avgReturn?.toFixed(2)}%`}
              />
            )}

            {/* Median line */}
            {medianPosition !== null && (
              <div
                className="absolute top-0 bottom-6 w-0.5 bg-blue-400 z-10"
                style={{ left: `${medianPosition}%` }}
                title={`中位收益: ${medianReturn?.toFixed(2)}%`}
              />
            )}

            {/* Bars */}
            <div className="flex items-end h-[calc(100%-24px)] gap-0.5">
              {data.map((bucket, index) => {
                const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                const isNegative = bucket.rangeEnd <= 0;
                const isPositive = bucket.rangeStart >= 0;
                const isMixed = !isNegative && !isPositive;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center group"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t transition-all cursor-pointer",
                        isNegative
                          ? "bg-loss/60 hover:bg-loss/80"
                          : isPositive
                          ? "bg-profit/60 hover:bg-profit/80"
                          : "bg-white/30 hover:bg-white/50"
                      )}
                      style={{ height: `${height}%`, minHeight: bucket.count > 0 ? "4px" : "0" }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-surface border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-20">
                      <div className="text-white">{bucket.range}</div>
                      <div className="text-white/60">
                        {bucket.count}次 ({bucket.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between mt-1 text-xs text-white/40">
              <span>{data[0]?.range.split("~")[0] ?? "-10%"}</span>
              <span>0%</span>
              <span>{data[data.length - 1]?.range.split("~")[1] ?? "+10%"}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-loss/60" />
            <span className="text-white/50">亏损 / Loss</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-profit/60" />
            <span className="text-white/50">盈利 / Profit</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-xs text-white/40">亏损区间</div>
            <div className="text-sm text-loss">
              {data.filter((d) => d.rangeEnd <= 0).reduce((sum, d) => sum + d.count, 0)}次
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">盈亏平衡</div>
            <div className="text-sm text-white/70">
              {data.filter((d) => d.rangeStart < 0 && d.rangeEnd > 0).reduce((sum, d) => sum + d.count, 0)}次
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40">盈利区间</div>
            <div className="text-sm text-profit">
              {data.filter((d) => d.rangeStart >= 0).reduce((sum, d) => sum + d.count, 0)}次
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReturnDistribution;
