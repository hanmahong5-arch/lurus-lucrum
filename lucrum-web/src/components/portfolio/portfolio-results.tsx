"use client";

/**
 * Portfolio Backtest Results Display
 *
 * Shows comprehensive portfolio backtest results in progressive disclosure:
 *   1. Summary banner: total return, annualized, sharpe, max drawdown, trade count
 *   2. Equity curve: portfolio NAV vs benchmark (CSI 300)
 *   3. Sector contribution bars
 *   4. Stock detail table (sortable, by contribution)
 *   5. Diversification assessment (HHI, correlation, sector concentration)
 *   6. Action bar: export, save, re-run
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Download,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import type { PortfolioBacktestResult } from "@/lib/stores/validation-store";

// =============================================================================
// Types
// =============================================================================

interface PortfolioResultsProps {
  result: PortfolioBacktestResult;
  onExport?: () => void;
  onSave?: () => void;
  onRerun?: () => void;
  className?: string;
}

type SortKey = "rank" | "returnPct" | "pnl" | "allocation";
type SortDir = "asc" | "desc";

// =============================================================================
// Component
// =============================================================================

export function PortfolioResults({
  result,
  onExport,
  onSave,
  onRerun,
  className,
}: PortfolioResultsProps) {
  const [showDetailTable, setShowDetailTable] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Sort stock details
  const sortedStocks = useMemo(() => {
    if (!result?.stockDetails?.length) return [];
    const items = [...result.stockDetails];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "rank":
          cmp = a.rank - b.rank;
          break;
        case "returnPct":
          cmp = a.returnPct - b.returnPct;
          break;
        case "pnl":
          cmp = a.pnl - b.pnl;
          break;
        case "allocation":
          cmp = a.allocation - b.allocation;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [result.stockDetails, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "rank" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  // Diversification assessment
  const diversificationGrade = useMemo(() => {
    const hhi = result?.hhi ?? 0;
    const avgCorrelation = result?.avgCorrelation ?? 0;
    if (hhi < 0.06 && avgCorrelation < 0.3) return "excellent";
    if (hhi < 0.1 && avgCorrelation < 0.5) return "good";
    if (hhi < 0.15) return "moderate";
    return "poor";
  }, [result]);

  const diversificationLabel: Record<string, { label: string; color: string }> =
    {
      excellent: { label: "优秀", color: "text-profit" },
      good: { label: "良好", color: "text-score-a" },
      moderate: { label: "一般", color: "text-accent" },
      poor: { label: "不足", color: "text-loss" },
    };

  const gradeInfo = diversificationLabel[diversificationGrade] ?? {
    label: "未知",
    color: "text-white/50",
  };

  // Max sector contribution for bar chart scaling
  const maxSectorContribution = useMemo(
    () => {
      const contributions = result?.sectorContributions ?? [];
      if (contributions.length === 0) return 1;
      return Math.max(
        ...contributions.map((s) => Math.abs(s.returnPct)),
        1,
      );
    },
    [result?.sectorContributions],
  );

  return (
    <div className={cn("space-y-5", className)}>
      {/* ================================================================= */}
      {/* 1. Summary Banner                                                  */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
        <div className="p-4">
          <div className="text-xs text-white/40 mb-3">组合回测结果</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricItem
              label="总收益"
              value={`${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(1)}%`}
              color={result.totalReturn >= 0 ? "text-profit" : "text-loss"}
            />
            <MetricItem
              label="年化收益"
              value={`${result.annualizedReturn >= 0 ? "+" : ""}${result.annualizedReturn.toFixed(1)}%`}
              color={
                result.annualizedReturn >= 0 ? "text-profit" : "text-loss"
              }
            />
            <MetricItem
              label="夏普比率"
              value={result.sharpeRatio.toFixed(2)}
              color={
                result.sharpeRatio >= 1
                  ? "text-profit"
                  : result.sharpeRatio >= 0
                    ? "text-accent"
                    : "text-loss"
              }
            />
            <MetricItem
              label="最大回撤"
              value={`${result.maxDrawdown.toFixed(1)}%`}
              color="text-loss"
            />
            <MetricItem
              label="有效股数"
              value={`${result.effectiveStocks}/${result.totalStocks}`}
              color="text-white"
            />
            <MetricItem
              label="总交易"
              value={`${result.totalTrades}次`}
              color="text-white"
            />
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. Equity Curve (placeholder with data points)                     */}
      {/* ================================================================= */}
      {result.equityCurve.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-surface/50 p-4">
          <div className="text-sm font-medium text-white mb-3">
            组合净值曲线 (与沪深300对比)
          </div>
          <EquityCurveChart data={result.equityCurve} />
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. Sector Contribution                                             */}
      {/* ================================================================= */}
      {result.sectorContributions.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-surface/50 p-4">
          <div className="text-sm font-medium text-white mb-3">行业贡献</div>
          <div className="space-y-2.5">
            {result.sectorContributions.map((sc) => (
              <div key={sc.sector} className="flex items-center gap-3">
                <span className="text-xs text-white/60 w-16 shrink-0 truncate">
                  {sc.sector}
                </span>
                <div className="flex-1 h-5 rounded-full bg-white/5 overflow-hidden relative">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      sc.returnPct >= 0 ? "bg-profit/40" : "bg-loss/40",
                    )}
                    style={{
                      width: `${Math.min(Math.abs(sc.returnPct) / maxSectorContribution * 100, 100)}%`,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums w-16 text-right shrink-0",
                    sc.returnPct >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {sc.returnPct >= 0 ? "+" : ""}
                  {sc.returnPct.toFixed(1)}%
                </span>
                <span className="text-xs text-white/40 font-mono tabular-nums w-14 text-right shrink-0">
                  ({Math.round(sc.contributionPct * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. Stock Detail Table                                              */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-white/10 bg-surface/50 overflow-hidden">
        <button
          onClick={() => setShowDetailTable((v) => !v)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.02] transition"
        >
          <span>
            个股明细{" "}
            <span className="text-xs text-white/40 font-mono tabular-nums">
              ({result?.stockDetails?.length ?? 0}只)
            </span>
          </span>
          {showDetailTable ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {showDetailTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-white/10 text-white/40">
                  <SortableHeader
                    label="排名"
                    sortKey="rank"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="w-12"
                  />
                  <th className="px-3 py-2 text-left font-normal">代码</th>
                  <th className="px-3 py-2 text-left font-normal">名称</th>
                  <th className="px-3 py-2 text-left font-normal">行业</th>
                  <SortableHeader
                    label="分配"
                    sortKey="allocation"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="收益"
                    sortKey="returnPct"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="盈亏"
                    sortKey="pnl"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <th className="px-3 py-2 text-center font-normal">状态</th>
                </tr>
              </thead>
              <tbody>
                {sortedStocks.map((stock) => (
                  <tr
                    key={stock.symbol}
                    className="border-t border-white/5 hover:bg-white/[0.02] transition"
                  >
                    <td className="px-3 py-2 text-center font-mono tabular-nums text-white/40">
                      {stock.rank}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-white/70">
                      {stock.symbol}
                    </td>
                    <td className="px-3 py-2 text-white/80">{stock.name}</td>
                    <td className="px-3 py-2 text-white/40">{stock.sector}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white/60">
                      {"\u00A5"}
                      {(stock.allocation / 10000).toFixed(1)}万
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono tabular-nums",
                        stock.status === "traded"
                          ? stock.returnPct >= 0
                            ? "text-profit"
                            : "text-loss"
                          : "text-white/30",
                      )}
                    >
                      {stock.status === "traded"
                        ? `${stock.returnPct >= 0 ? "+" : ""}${stock.returnPct.toFixed(1)}%`
                        : "--"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono tabular-nums",
                        stock.status === "traded"
                          ? stock.pnl >= 0
                            ? "text-profit"
                            : "text-loss"
                          : "text-white/30",
                      )}
                    >
                      {stock.status === "traded"
                        ? `${stock.pnl >= 0 ? "+" : ""}${"\u00A5"}${(Math.abs(stock.pnl) / 10000).toFixed(2)}万`
                        : "--"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StockStatusBadge status={stock.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 5. Diversification Assessment                                      */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-white/10 bg-surface/50 p-4">
        <div className="text-sm font-medium text-white mb-3">分散化评估</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-white/40">有效分散度</div>
            <div className={cn("text-sm font-bold", gradeInfo.color)}>
              {gradeInfo.label}
            </div>
            <div className="text-xs text-white/30 font-mono tabular-nums">
              HHI: {(result?.hhi ?? 0).toFixed(3)}
              {(result?.hhi ?? 0) < 0.1 ? " (好)" : (result?.hhi ?? 0) < 0.15 ? " (一般)" : " (集中)"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/40">行业集中度</div>
            {result.sectorContributions.length > 0 && (
              <>
                {(() => {
                  const topSector = result.sectorContributions[0];
                  if (!topSector) return null;
                  const isWarning = topSector.contributionPct > 0.3;
                  return (
                    <div
                      className={cn(
                        "text-xs flex items-center gap-1.5",
                        isWarning ? "text-accent" : "text-profit",
                      )}
                    >
                      {isWarning ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      {topSector.sector}板块贡献
                      <span className="font-mono tabular-nums">
                        {Math.round(topSector.contributionPct * 100)}%
                      </span>
                      {isWarning && ", 建议<30%"}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-xs text-white/40">相关性</div>
            <div
              className={cn(
                "text-xs flex items-center gap-1.5",
                (result?.avgCorrelation ?? 0) < 0.3
                  ? "text-profit"
                  : (result?.avgCorrelation ?? 0) < 0.5
                    ? "text-accent"
                    : "text-loss",
              )}
            >
              <Info className="w-3 h-3" />
              {(result?.avgCorrelation ?? 0) < 0.3
                ? "低"
                : (result?.avgCorrelation ?? 0) < 0.5
                  ? "中等"
                  : "较高"}
              <span className="font-mono tabular-nums text-white/40">
                (平均: {(result?.avgCorrelation ?? 0).toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 6. Action Bar                                                      */}
      {/* ================================================================= */}
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <Download className="w-3.5 h-3.5" />
            导出报告
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <Save className="w-3.5 h-3.5" />
            保存到历史
          </button>
        )}
        {onRerun && (
          <button
            onClick={onRerun}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            调整组合后重跑
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function MetricItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-xs text-white/40">{label}</div>
      <div className={cn("text-lg font-bold font-mono tabular-nums", color)}>
        {value}
      </div>
    </div>
  );
}

function StockStatusBadge({
  status,
}: {
  status: "traded" | "no_signal" | "insufficient_data";
}) {
  const config = {
    traded: {
      label: "已交易",
      className: "bg-profit/10 text-profit border-profit/20",
    },
    no_signal: {
      label: "无信号",
      className: "bg-white/5 text-white/40 border-white/10",
    },
    insufficient_data: {
      label: "数据不足",
      className: "bg-accent/10 text-accent/70 border-accent/20",
    },
  };

  const c = config[status];
  return (
    <span
      className={cn(
        "inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

function SortableHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = key === currentKey;
  return (
    <th
      className={cn(
        "px-3 py-2 font-normal cursor-pointer hover:text-white/60 transition select-none",
        isActive ? "text-accent" : "",
        className,
      )}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-[10px]">
            {currentDir === "asc" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </span>
    </th>
  );
}

/**
 * Simple text-based equity curve visualization.
 * In production, this would use lightweight-charts or recharts.
 * For now, renders a summary of the curve endpoints and min/max.
 */
function EquityCurveChart({
  data,
}: {
  data: Array<{ date: string; value: number; benchmark: number }>;
}) {
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const first = data[0]!;
    const last = data[data.length - 1]!;
    const minVal = Math.min(...data.map((d) => d.value));
    const maxVal = Math.max(...data.map((d) => d.value));
    return {
      startDate: first.date,
      endDate: last.date,
      startValue: first.value,
      endValue: last.value,
      minValue: minVal,
      maxValue: maxVal,
      benchmarkEnd: last.benchmark,
      benchmarkStart: first.benchmark,
    };
  }, [data]);

  // Draw a simple sparkline using CSS
  const normalizedData = useMemo(() => {
    if (!stats) return [];
    const range = stats.maxValue - stats.minValue || 1;
    return data.map((d) => ({
      pctPortfolio: ((d.value - stats.minValue) / range) * 100,
      pctBenchmark:
        ((d.benchmark - stats.minValue) / range) * 100,
    }));
  }, [data, stats]);

  if (!stats) return null;

  const portfolioReturn =
    ((stats.endValue - stats.startValue) / stats.startValue) * 100;
  const benchmarkReturn =
    ((stats.benchmarkEnd - stats.benchmarkStart) / stats.benchmarkStart) * 100;

  return (
    <div className="space-y-3">
      {/* Sparkline area */}
      <div className="relative h-40 rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden">
        {/* Portfolio line */}
        <svg
          viewBox={`0 0 ${normalizedData.length} 100`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* Benchmark line */}
          <polyline
            points={normalizedData
              .map((d, i) => `${i},${100 - d.pctBenchmark}`)
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          {/* Portfolio area */}
          <polyline
            points={`0,100 ${normalizedData
              .map((d, i) => `${i},${100 - d.pctPortfolio}`)
              .join(" ")} ${normalizedData.length - 1},100`}
            fill="rgba(234,179,8,0.1)"
            stroke="none"
          />
          {/* Portfolio line */}
          <polyline
            points={normalizedData
              .map((d, i) => `${i},${100 - d.pctPortfolio}`)
              .join(" ")}
            fill="none"
            stroke="rgba(234,179,8,0.8)"
            strokeWidth="1.5"
          />
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-3 flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-accent rounded-full inline-block" />
            <span className="text-white/50">组合</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-white/30 rounded-full inline-block" />
            <span className="text-white/30">沪深300</span>
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40 font-mono tabular-nums">
          {stats.startDate} ~ {stats.endDate}
        </span>
        <div className="flex gap-4">
          <span className="text-white/50">
            组合:{" "}
            <span
              className={cn(
                "font-mono tabular-nums font-medium",
                portfolioReturn >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {portfolioReturn >= 0 ? "+" : ""}
              {portfolioReturn.toFixed(1)}%
            </span>
          </span>
          <span className="text-white/40">
            沪深300:{" "}
            <span className="font-mono tabular-nums">
              {benchmarkReturn >= 0 ? "+" : ""}
              {benchmarkReturn.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
