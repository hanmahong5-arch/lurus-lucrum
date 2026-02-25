/**
 * ScannerPanel Component
 * 并行扫描选板面板
 *
 * Left panel: strategy selector, scan target selector, parameters
 * Right panel: real-time progress, ranking table, AI insights
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { SW_SECTORS, CONCEPT_SECTORS } from "@/lib/data-service/sources/eastmoney-sector";
import type { ScanTarget, RankedResult, ScannerEvent } from "@/lib/agent/scanner-agent";

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
// Sub-components
// =============================================================================

function SectorSelector({
  selected,
  onChange,
}: {
  selected: ScanTarget[];
  onChange: (targets: ScanTarget[]) => void;
}) {
  function toggle(target: ScanTarget) {
    const exists = selected.some((t) => t.code === target.code);
    if (exists) {
      onChange(selected.filter((t) => t.code !== target.code));
    } else {
      onChange([...selected, target]);
    }
  }

  function isSelected(code: string) {
    return selected.some((t) => t.code === code);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">申万行业</p>
        <div className="flex flex-wrap gap-1.5">
          {SW_SECTORS.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() =>
                toggle({ type: "sector", code: s.code, name: s.name })
              }
              className={`px-2 py-1 rounded text-xs transition-colors ${
                isSelected(s.code)
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">热门概念</p>
        <div className="flex flex-wrap gap-1.5">
          {CONCEPT_SECTORS.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() =>
                toggle({ type: "sector", code: s.code, name: s.name })
              }
              className={`px-2 py-1 rounded text-xs transition-colors ${
                isSelected(s.code)
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankingTable({ items }: { items: RankedResult[] }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/40 text-xs">
            <th className="py-2 pr-3 text-left font-medium">排名</th>
            <th className="py-2 pr-3 text-left font-medium">板块/个股</th>
            <th className="py-2 pr-3 text-right font-medium tabular-nums">总收益</th>
            <th className="py-2 pr-3 text-right font-medium tabular-nums">夏普</th>
            <th className="py-2 text-right font-medium tabular-nums">最大回撤</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.target.code} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 pr-3 text-white/60 font-mono tabular-nums">
                {item.rank <= 3 ? (
                  <span className={`font-bold ${item.rank === 1 ? "text-yellow-400" : item.rank === 2 ? "text-white/70" : "text-amber-600"}`}>
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
              <td className={`py-2 pr-3 text-right font-mono tabular-nums ${item.totalReturn >= 0 ? "text-profit" : "text-loss"}`}>
                {item.totalReturn >= 0 ? "+" : ""}{(item.totalReturn * 100).toFixed(1)}%
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

// =============================================================================
// Main Component
// =============================================================================

export function ScannerPanel() {
  // Config state
  const [strategy, setStrategy] = useState(BUILTIN_STRATEGIES[0]!.id);
  const [scanTargets, setScanTargets] = useState<ScanTarget[]>([]);
  const [startDate, setStartDate] = useState(DEFAULT_DATE_RANGE.start);
  const [endDate, setEndDate] = useState(DEFAULT_DATE_RANGE.end);
  const [capital, setCapital] = useState(100000);

  // Results state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [ranking, setRanking] = useState<RankedResult[]>([]);
  const [insights, setInsights] = useState<string>("");
  const [error, setError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);

  const handleStart = useCallback(async () => {
    if (scanTargets.length === 0) {
      setError("请至少选择一个板块或股票");
      return;
    }

    setRunning(true);
    setError("");
    setRanking([]);
    setInsights("");
    setProgress({ done: 0, total: scanTargets.length, current: "" });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/agent/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          strategyName:
            BUILTIN_STRATEGIES.find((s) => s.id === strategy)?.name ?? strategy,
          scanTargets,
          dateRange: { start: startDate, end: endDate },
          capital,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`请求失败 (${res.status}): ${text}`);
        return;
      }

      for await (const event of parseSseStream(res)) {
        if (ac.signal.aborted) break;

        switch (event.type) {
          case "progress":
            setProgress({ done: event.done, total: event.total, current: event.current });
            break;
          case "ranking":
            setRanking(event.items);
            break;
          case "insights":
            setInsights(event.content);
            break;
          case "error":
            setError(event.message);
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [strategy, scanTargets, startDate, endDate, capital]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="flex gap-6 h-full">
      {/* Left panel — Configuration */}
      <div className="w-72 flex-shrink-0 space-y-5 overflow-y-auto pr-2">
        {/* Strategy selector */}
        <div>
          <label className="block text-xs text-white/40 font-medium uppercase tracking-wide mb-2">
            策略选择
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            disabled={running}
            className="w-full bg-surface border border-border text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-accent disabled:opacity-50"
          >
            {BUILTIN_STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scan targets */}
        <div>
          <label className="block text-xs text-white/40 font-medium uppercase tracking-wide mb-2">
            扫描范围（已选 {scanTargets.length} 个）
          </label>
          <SectorSelector selected={scanTargets} onChange={setScanTargets} />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/40 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={running}
              className="w-full bg-surface border border-border text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={running}
              className="w-full bg-surface border border-border text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        </div>

        {/* Capital */}
        <div>
          <label className="block text-xs text-white/40 mb-1">初始资金（元）</label>
          <input
            type="number"
            value={capital}
            min={10000}
            step={10000}
            onChange={(e) => setCapital(Number(e.target.value))}
            disabled={running}
            className="w-full bg-surface border border-border text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-accent disabled:opacity-50 font-mono tabular-nums"
          />
        </div>

        {/* Start / Stop button */}
        {running ? (
          <button
            type="button"
            onClick={handleStop}
            className="w-full py-2.5 rounded bg-loss/20 border border-loss/40 text-loss text-sm font-medium hover:bg-loss/30 transition-colors"
          >
            停止扫描
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={scanTargets.length === 0}
            className="w-full py-2.5 rounded bg-accent/20 border border-accent/40 text-accent text-sm font-medium hover:bg-accent/30 transition-colors btn-tactile disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ 开始扫描
          </button>
        )}
      </div>

      {/* Right panel — Results */}
      <div className="flex-1 space-y-5 overflow-y-auto">
        {/* Error */}
        {error && (
          <div className="p-3 rounded border border-loss/30 bg-loss/10 text-loss text-sm">
            {error}
          </div>
        )}

        {/* Progress bar */}
        {(running || progress.done > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">
                {running ? `扫描中：${progress.current}` : "扫描完成"}
              </span>
              <span className="text-white/40 font-mono tabular-nums">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Ranking table */}
        {ranking.length > 0 && (
          <div className="rounded-lg border border-border bg-surface/50 p-4">
            <h3 className="text-sm font-medium text-white mb-3">
              策略排名（共 {ranking.length} 个）
            </h3>
            <RankingTable items={ranking} />
          </div>
        )}

        {/* AI Insights */}
        {insights && (
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
            <h3 className="text-sm font-medium text-accent mb-3">AI 选板洞察</h3>
            <pre className="whitespace-pre-wrap text-sm text-white/80 font-sans leading-relaxed">
              {insights}
            </pre>
          </div>
        )}

        {/* Empty state */}
        {!running && ranking.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-white/30 text-sm space-y-2">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  );
}
