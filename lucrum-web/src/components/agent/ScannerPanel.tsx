/**
 * ScannerPanel Component (Enhanced)
 *
 * Visual sector selection grid, heatmap scan results, and real-time progress.
 * Wired to analysis-store for state persistence.
 */

"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SW_SECTORS, CONCEPT_SECTORS } from "@/lib/data-service/sources/eastmoney-sector";
import type { ScanTarget, RankedResult, ScannerEvent } from "@/lib/agent/scanner-agent";
import { useAsyncTask } from "@/hooks/use-async-task";
import { useAnalysisStore } from "@/lib/stores/analysis-store";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { parseApiError, toAppError } from "@/lib/errors/error-types";
import type { AppError, RecoveryAction } from "@/lib/errors/error-types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Constants
// =============================================================================

const BUILTIN_STRATEGIES = [
  { id: "ma_cross", name: "双均线交叉" },
  { id: "rsi", name: "RSI 超买超卖" },
  { id: "macd", name: "MACD 趋势跟踪" },
  { id: "boll", name: "布林线突破" },
];

const DEFAULT_DATE_RANGE = {
  start: "2023-01-01",
  end: "2024-12-31",
};

// Popular sectors to show at the top with approximate stock counts
const POPULAR_SECTORS: Array<{
  code: string;
  name: string;
  stockCount: number;
  category: string;
}> = [
  { code: "BK0437", name: "金融", stockCount: 42, category: "传统" },
  { code: "BK0447", name: "科技", stockCount: 68, category: "成长" },
  { code: "BK0428", name: "医药", stockCount: 55, category: "消费" },
  { code: "BK0465", name: "食品饮料", stockCount: 45, category: "消费" },
  { code: "BK0493", name: "人工智能", stockCount: 86, category: "概念" },
  { code: "BK0448", name: "电子", stockCount: 62, category: "成长" },
  { code: "BK0679", name: "芯片", stockCount: 52, category: "概念" },
  { code: "BK0424", name: "汽车", stockCount: 38, category: "周期" },
  { code: "BK0891", name: "半导体", stockCount: 47, category: "概念" },
  { code: "BK0859", name: "机器人", stockCount: 34, category: "概念" },
];

// =============================================================================
// Helper: parse SSE stream
// =============================================================================

async function* parseSseStream(
  response: Response
): AsyncGenerator<ScannerEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as ScannerEvent;
          } catch {
            // skip malformed line
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Heatmap color mapping (CN market: red = good, green = bad)
// =============================================================================

function getHeatmapColor(totalReturn: number): string {
  if (totalReturn >= 0.5) return "bg-profit/80 text-white";
  if (totalReturn >= 0.3) return "bg-profit/60 text-white";
  if (totalReturn >= 0.15) return "bg-profit/40 text-white";
  if (totalReturn >= 0.05) return "bg-profit/20 text-white/80";
  if (totalReturn >= 0) return "bg-profit/10 text-white/60";
  if (totalReturn >= -0.05) return "bg-loss/10 text-white/60";
  if (totalReturn >= -0.15) return "bg-loss/20 text-white/80";
  if (totalReturn >= -0.3) return "bg-loss/40 text-white";
  return "bg-loss/60 text-white";
}

function getHeatmapBorder(totalReturn: number): string {
  if (totalReturn >= 0.15) return "border-profit/40";
  if (totalReturn >= 0) return "border-profit/20";
  if (totalReturn >= -0.15) return "border-loss/20";
  return "border-loss/40";
}

// =============================================================================
// Sub-components
// =============================================================================

/** Popular sector card grid at the top */
function PopularSectorGrid({
  selected,
  onToggle,
  disabled,
}: {
  selected: ScanTarget[];
  onToggle: (target: ScanTarget) => void;
  disabled: boolean;
}) {
  function isSelected(code: string) {
    return selected.some((t) => t.code === code);
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">
        热门板块 (点击选择)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {POPULAR_SECTORS.map((sector) => {
          const active = isSelected(sector.code);
          return (
            <button
              key={sector.code}
              type="button"
              disabled={disabled}
              onClick={() =>
                onToggle({
                  type: "sector",
                  code: sector.code,
                  name: sector.name,
                })
              }
              className={cn(
                "relative flex flex-col items-center p-3 rounded-xl border transition-all",
                "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
                active
                  ? "bg-accent/10 border-accent/50 shadow-[0_0_12px_-4px] shadow-accent/30"
                  : "bg-surface border-border hover:border-white/20 hover:bg-surface-hover"
              )}
            >
              <span className="text-sm font-medium text-white">
                {sector.name}
              </span>
              <span className="text-[10px] text-white/40 font-mono tabular-nums mt-0.5">
                {sector.stockCount}只
              </span>
              <span className="text-[10px] text-white/30 mt-0.5">
                {sector.category}
              </span>
              {active && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compact sector chip selector */
function SectorChipSelector({
  selected,
  onToggle,
  disabled,
}: {
  selected: ScanTarget[];
  onToggle: (target: ScanTarget) => void;
  disabled: boolean;
}) {
  function isSelected(code: string) {
    return selected.some((t) => t.code === code);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">
          申万行业
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SW_SECTORS.map((s) => (
            <button
              key={s.code}
              type="button"
              disabled={disabled}
              onClick={() =>
                onToggle({ type: "sector", code: s.code, name: s.name })
              }
              className={cn(
                "px-2 py-1 rounded text-xs transition-colors disabled:opacity-50",
                isSelected(s.code)
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">
          热门概念
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CONCEPT_SECTORS.map((s) => (
            <button
              key={s.code}
              type="button"
              disabled={disabled}
              onClick={() =>
                onToggle({ type: "sector", code: s.code, name: s.name })
              }
              className={cn(
                "px-2 py-1 rounded text-xs transition-colors disabled:opacity-50",
                isSelected(s.code)
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Heatmap grid view for scan results */
function HeatmapGrid({ items }: { items: RankedResult[] }) {
  if (items.length === 0) return null;

  // Determine cell sizing by number of results
  const cellSize = items.length > 30 ? "min-w-[80px]" : "min-w-[100px]";

  return (
    <TooltipProvider>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">
            扫描热力图（共 {items.length} 个）
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-loss/40" />
              亏损
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-white/10" />
              持平
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-profit/40" />
              盈利
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Tooltip key={item.target.code}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg border transition-all",
                    "hover:scale-105 hover:z-10 cursor-pointer",
                    cellSize,
                    getHeatmapColor(item.totalReturn),
                    getHeatmapBorder(item.totalReturn)
                  )}
                >
                  <span className="text-xs font-medium truncate max-w-full">
                    {item.target.name}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums mt-0.5">
                    {item.totalReturn >= 0 ? "+" : ""}
                    {(item.totalReturn * 100).toFixed(1)}%
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-surface border-border text-white"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-medium">
                    {item.target.name}{" "}
                    <span className="text-white/40">{item.target.code}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono tabular-nums">
                    <span className="text-white/50">总收益</span>
                    <span
                      className={
                        item.totalReturn >= 0 ? "text-profit" : "text-loss"
                      }
                    >
                      {item.totalReturn >= 0 ? "+" : ""}
                      {(item.totalReturn * 100).toFixed(1)}%
                    </span>
                    <span className="text-white/50">夏普比</span>
                    <span>{item.sharpeRatio.toFixed(2)}</span>
                    <span className="text-white/50">最大回撤</span>
                    <span className="text-loss">
                      -{(Math.abs(item.maxDrawdown) * 100).toFixed(1)}%
                    </span>
                    <span className="text-white/50">排名</span>
                    <span>#{item.rank}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Traditional ranking table view */
function RankingTable({ items }: { items: RankedResult[] }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/40 text-xs">
            <th className="py-2 pr-3 text-left font-medium">排名</th>
            <th className="py-2 pr-3 text-left font-medium">板块/个股</th>
            <th className="py-2 pr-3 text-right font-medium tabular-nums">
              总收益
            </th>
            <th className="py-2 pr-3 text-right font-medium tabular-nums">
              夏普
            </th>
            <th className="py-2 text-right font-medium tabular-nums">
              最大回撤
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.target.code}
              className="border-b border-white/5 hover:bg-white/5"
            >
              <td className="py-2 pr-3 text-white/60 font-mono tabular-nums">
                {item.rank <= 3 ? (
                  <span
                    className={cn(
                      "font-bold",
                      item.rank === 1
                        ? "text-yellow-400"
                        : item.rank === 2
                          ? "text-white/70"
                          : "text-amber-600"
                    )}
                  >
                    #{item.rank}
                  </span>
                ) : (
                  <span>#{item.rank}</span>
                )}
              </td>
              <td className="py-2 pr-3 text-white">
                <div>{item.target.name}</div>
                <div className="text-xs text-white/30">{item.target.code}</div>
              </td>
              <td
                className={cn(
                  "py-2 pr-3 text-right font-mono tabular-nums",
                  item.totalReturn >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {item.totalReturn >= 0 ? "+" : ""}
                {(item.totalReturn * 100).toFixed(1)}%
              </td>
              <td className="py-2 pr-3 text-right font-mono tabular-nums text-white/70">
                {item.sharpeRatio.toFixed(2)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-loss">
                -{(Math.abs(item.maxDrawdown) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Scan progress with real-time feedback */
function ScanProgress({
  running,
  done,
  total,
  current,
  onCancel,
}: {
  running: boolean;
  done: number;
  total: number;
  current: string;
  onCancel: () => void;
}) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {running && (
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
          <span className="text-sm text-white/70">
            {running ? `正在扫描：${current}` : "扫描完成"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 font-mono tabular-nums">
            {done}/{total} ({percent}%)
          </span>
          {running && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs px-2.5 py-1 rounded border border-loss/30 text-loss hover:bg-loss/10 transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            running
              ? "bg-gradient-to-r from-accent via-accent/80 to-accent"
              : "bg-accent"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ScannerPanel() {
  // Analysis store integration
  const store = useAnalysisStore();
  const {
    scannerConfig,
    selectedSectors: persistedSectors,
    scanResults: persistedResults,
  } = store;

  // Config state
  const [strategy, setStrategy] = useState(BUILTIN_STRATEGIES[0]!.id);
  const [scanTargets, setScanTargets] = useState<ScanTarget[]>(() => {
    // Restore from persisted sectors
    if (persistedSectors.length > 0) {
      return persistedSectors.map((name) => {
        const all = [...SW_SECTORS, ...CONCEPT_SECTORS];
        const found = all.find((s) => s.name === name);
        return {
          type: "sector" as const,
          code: found?.code ?? name,
          name,
        };
      });
    }
    return [];
  });
  const [startDate, setStartDate] = useState(DEFAULT_DATE_RANGE.start);
  const [endDate, setEndDate] = useState(DEFAULT_DATE_RANGE.end);
  const [capital, setCapital] = useState(100000);

  // Results state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [ranking, setRanking] = useState<RankedResult[]>([]);
  const [insights, setInsights] = useState<string>("");
  const [error, setError] = useState<AppError | null>(null);

  const router = useRouter();

  // View mode for results
  const [viewMode, setViewMode] = useState<"heatmap" | "table">("heatmap");

  // Show expanded sector list
  const [showAllSectors, setShowAllSectors] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const task = useAsyncTask();

  // Abort SSE stream on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Toggle a scan target
  const handleToggle = useCallback(
    (target: ScanTarget) => {
      setScanTargets((prev) => {
        const exists = prev.some((t) => t.code === target.code);
        const next = exists
          ? prev.filter((t) => t.code !== target.code)
          : [...prev, target];
        // Persist selected sector names
        store.setSelectedSectors(next.map((t) => t.name));
        return next;
      });
    },
    [store]
  );

  const handleStart = useCallback(async () => {
    if (scanTargets.length === 0) {
      // Validation error stays as a structured warning rather than raw text;
      // there's no retry path so we offer dismiss only.
      setError({
        code: "SCANNER_NO_TARGET",
        title: "未选择扫描标的",
        description: "请至少选择一个板块或股票后再开始扫描。",
        severity: "warning",
        recoveryActions: [{ type: "dismiss", label: "知道了" }],
      });
      return;
    }

    setRunning(true);
    setError(null);
    setRanking([]);
    setInsights("");
    setProgress({ done: 0, total: scanTargets.length, current: "" });
    store.setScanning(true);

    const strategyName =
      BUILTIN_STRATEGIES.find((s) => s.id === strategy)?.name ?? strategy;
    task.registerTask({
      type: "scan",
      title: `扫描 — ${strategyName} (${scanTargets.length}个目标)`,
    });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/agent/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          strategyName,
          scanTargets,
          dateRange: { start: startDate, end: endDate },
          capital,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        // Server returns the structured envelope; parseApiError extracts it
        // into an AppError ErrorCard can render directly.
        const appErr = await parseApiError(res, "SCANNER_REQUEST_FAILED");
        setError(appErr);
        store.setError(appErr.description);
        task.fail(appErr.description);
        return;
      }

      let finalRanking: RankedResult[] = [];
      let finalInsights = "";

      for await (const event of parseSseStream(res)) {
        if (ac.signal.aborted) break;

        switch (event.type) {
          case "progress":
            setProgress({
              done: event.done,
              total: event.total,
              current: event.current,
            });
            task.updateProgress(
              event.total > 0
                ? Math.round((event.done / event.total) * 100)
                : 0,
              `${event.done}/${event.total} ${event.current}`
            );
            // Partial ranking results show incrementally
            break;
          case "ranking":
            setRanking(event.items);
            finalRanking = event.items;
            break;
          case "insights":
            setInsights(event.content);
            finalInsights = event.content;
            break;
          case "error":
            // SSE-emitted error during scan execution. Translate to AppError
            // with a meaningful retry path (re-run last scan params).
            setError({
              code: "SCANNER_RUN_FAILED",
              title: "扫描失败",
              description: event.message,
              severity: "error",
              recoveryActions: [
                { type: "retry", label: "重试" },
                { type: "custom", label: "调整参数" },
              ],
            });
            store.setError(event.message);
            task.fail(event.message);
            break;
        }
      }

      if (!ac.signal.aborted && !error) {
        // Persist scan results to analysis store
        store.setScanResults(
          finalRanking.map((r) => ({
            symbol: r.target.code,
            name: r.target.name,
            sector: "",
            score: Math.max(0, Math.min(100, (r.sharpeRatio / 3) * 100)),
            grade:
              r.sharpeRatio >= 2
                ? "S"
                : r.sharpeRatio >= 1.5
                  ? "A"
                  : r.sharpeRatio >= 1
                    ? "B"
                    : r.sharpeRatio >= 0.5
                      ? "C"
                      : "D",
            totalReturn: r.totalReturn,
            sharpeRatio: r.sharpeRatio,
            winRate: 0,
            maxDrawdown: r.maxDrawdown,
          }))
        );
        store.setScanning(false);
        task.complete({ ranking: finalRanking, insights: finalInsights });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // Network / unexpected throw — disambiguate timeout / network so the
        // banner shows targeted recovery copy.
        const errMsg = err instanceof Error ? err.message : String(err);
        const isTimeout = /timeout/i.test(errMsg);
        const isNetwork = /fetch|network/i.test(errMsg);
        const appErr = toAppError(err, "SCANNER_NETWORK");
        const next: AppError = {
          ...appErr,
          title: isTimeout
            ? "扫描请求超时"
            : isNetwork
              ? "网络连接失败"
              : "扫描出错",
          description: isTimeout
            ? "扫描耗时较长，请减少标的数量后重试。"
            : isNetwork
              ? "无法连接到扫描服务，请检查网络后重试。"
              : errMsg,
          severity: "error",
          recoveryActions: [
            { type: "retry", label: "重试" },
            { type: "custom", label: "调整参数" },
          ],
        };
        setError(next);
        store.setError(next.description);
        task.fail(next.description);
      } else {
        task.cancel();
      }
    } finally {
      setRunning(false);
      store.setScanning(false);
      abortRef.current = null;
    }
  }, [strategy, scanTargets, startDate, endDate, capital, task, error, store]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    store.setScanning(false);
    task.cancel();
  }, [task, store]);

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* Sector Selection Grid */}
      <PopularSectorGrid
        selected={scanTargets}
        onToggle={handleToggle}
        disabled={running}
      />

      {/* Expand for full sector list */}
      <div>
        <button
          type="button"
          onClick={() => setShowAllSectors(!showAllSectors)}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          {showAllSectors ? "收起全部板块 ▲" : "展开全部板块 ▼"} (已选{" "}
          {scanTargets.length} 个)
        </button>
        {showAllSectors && (
          <div className="mt-3">
            <SectorChipSelector
              selected={scanTargets}
              onToggle={handleToggle}
              disabled={running}
            />
          </div>
        )}
      </div>

      {/* Configuration bar */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-white/40 mb-1">策略</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            disabled={running}
            className="w-full bg-surface border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent disabled:opacity-50"
          >
            {BUILTIN_STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[130px]">
          <label className="block text-xs text-white/40 mb-1">开始</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={running}
            className="w-full bg-surface border border-border text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-accent disabled:opacity-50"
          />
        </div>
        <div className="w-[130px]">
          <label className="block text-xs text-white/40 mb-1">结束</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={running}
            className="w-full bg-surface border border-border text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-accent disabled:opacity-50"
          />
        </div>
        <div className="w-[130px]">
          <label className="block text-xs text-white/40 mb-1">
            初始资金（元）
          </label>
          <input
            type="number"
            value={capital}
            min={10000}
            step={10000}
            onChange={(e) => setCapital(Number(e.target.value))}
            disabled={running}
            className="w-full bg-surface border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent disabled:opacity-50 font-mono tabular-nums"
          />
        </div>
        <div>
          {running ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-6 py-2 rounded-lg bg-loss/20 border border-loss/40 text-loss text-sm font-medium hover:bg-loss/30 transition-colors"
            >
              停止扫描
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={scanTargets.length === 0}
              className="px-6 py-2 rounded-lg bg-accent/20 border border-accent/40 text-accent text-sm font-medium hover:bg-accent/30 transition-colors btn-tactile disabled:opacity-40 disabled:cursor-not-allowed"
            >
              开始扫描
            </button>
          )}
        </div>
      </div>

      {/* Error — structured AppError with retry / navigate / dismiss
          recovery actions. retry re-runs the same scan params. */}
      {error && (
        <ErrorCard
          error={error}
          onAction={(action: RecoveryAction) => {
            if (action.type === "retry") {
              setError(null);
              void handleStart();
              return;
            }
            if (action.type === "navigate" && action.href) {
              router.push(action.href);
              return;
            }
            // dismiss / custom — clear the banner; "调整参数" is advisory,
            // the user adjusts the inputs above.
            setError(null);
          }}
        />
      )}

      {/* Progress */}
      {(running || progress.done > 0) && (
        <ScanProgress
          running={running}
          done={progress.done}
          total={progress.total}
          current={progress.current}
          onCancel={handleStop}
        />
      )}

      {/* Results */}
      {ranking.length > 0 && (
        <div className="rounded-xl border border-border bg-surface/50 p-4">
          {/* View mode toggle */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">
              扫描结果（{ranking.length} 个标的）
            </h3>
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => setViewMode("heatmap")}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  viewMode === "heatmap"
                    ? "bg-accent/20 text-accent"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                热力图
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  viewMode === "table"
                    ? "bg-accent/20 text-accent"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                排名表
              </button>
            </div>
          </div>

          {viewMode === "heatmap" ? (
            <HeatmapGrid items={ranking} />
          ) : (
            <RankingTable items={ranking} />
          )}
        </div>
      )}

      {/* AI Insights */}
      {insights && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="text-sm font-medium text-accent mb-3">
            AI 选板洞察
          </h3>
          <pre className="whitespace-pre-wrap text-sm text-white/80 font-sans leading-relaxed">
            {insights}
          </pre>
        </div>
      )}

      {/* Empty state */}
      {!running && ranking.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30 text-sm space-y-2">
          <svg
            className="w-10 h-10 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p>选择板块并点击「开始扫描」查看策略在不同板块的表现排名</p>
        </div>
      )}
    </div>
  );
}
