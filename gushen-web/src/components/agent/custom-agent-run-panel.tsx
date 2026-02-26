/**
 * Custom Agent Run Panel Component
 * Agent execution panel with live progress and results
 *
 * Responsive two-column layout (reuses ScannerPanel pattern):
 * - Left: Progress timeline (5 nodes) + token badge
 * - Right: Streaming results table + insights
 * - Mobile: single-column vertical layout
 *
 * @module components/agent/custom-agent-run-panel
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { AgentTokenBadge } from "./agent-token-badge";
import type {
  CustomAgentEvent,
  CustomAgentStep,
  StockResult,
  RunSummary,
} from "@/lib/agent/custom-agent-types";

// =============================================================================
// SSE Stream Parser (same pattern as ScannerPanel)
// =============================================================================

async function* parseSseStream(
  response: Response
): AsyncGenerator<CustomAgentEvent> {
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
            yield JSON.parse(line.slice(6)) as CustomAgentEvent;
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
// Constants
// =============================================================================

const NODE_LABELS: Record<string, string> = {
  validateConfig: "配置验证",
  resolveTargets: "解析标的",
  parallelBacktest: "并行回测",
  rankAndAggregate: "排名聚合",
  generateInsights: "综合研判",
};

const NODE_ORDER: string[] = [
  "validateConfig",
  "resolveTargets",
  "parallelBacktest",
  "rankAndAggregate",
  "generateInsights",
];

// =============================================================================
// Props
// =============================================================================

interface CustomAgentRunPanelProps {
  agentId: string;
  agentName: string;
  agentColor?: string;
  onClose?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function CustomAgentRunPanel({
  agentId,
  agentName,
  agentColor = "#6366f1",
  onClose,
}: CustomAgentRunPanelProps) {
  // Run state
  const [running, setRunning] = useState(false);
  const [currentNode, setCurrentNode] = useState<string>("");
  const [nodeMessages, setNodeMessages] = useState<Record<string, string>>({});
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());

  // Progress
  const [progress, setProgress] = useState({ current: 0, total: 0, symbol: "" });

  // Token tracking
  const [tokenUsed, setTokenUsed] = useState(0);
  const [tokenEstimate, setTokenEstimate] = useState(0);

  // Results
  const [results, setResults] = useState<StockResult[]>([]);
  const [insights, setInsights] = useState("");
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState("");

  // Abort controller
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = useCallback(async () => {
    setRunning(true);
    setError("");
    setResults([]);
    setInsights("");
    setSummary(null);
    setCurrentNode("");
    setCompletedNodes(new Set());
    setNodeMessages({});
    setProgress({ current: 0, total: 0, symbol: "" });
    setTokenUsed(0);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch(`/api/agent/custom/${agentId}/run`, {
        method: "POST",
        signal: ac.signal,
      });

      if (!res.ok) {
        // Try to parse SSE error
        const text = await res.text();
        const match = text.match(/data: (.+)/);
        if (match?.[1]) {
          const evt = JSON.parse(match[1]) as CustomAgentEvent;
          if (evt.type === "error") {
            setError(evt.message);
            setRunning(false);
            return;
          }
        }
        setError(`HTTP ${res.status}: 请求失败`);
        setRunning(false);
        return;
      }

      let lastNode = "";

      for await (const event of parseSseStream(res)) {
        switch (event.type) {
          case "status": {
            // Mark previous node as completed
            if (lastNode && lastNode !== event.node) {
              setCompletedNodes((prev) => new Set(prev).add(lastNode));
            }
            lastNode = event.node;
            setCurrentNode(event.node);
            setNodeMessages((prev) => ({
              ...prev,
              [event.node]: event.message,
            }));
            break;
          }
          case "progress":
            setProgress({
              current: event.current,
              total: event.total,
              symbol: event.symbol ?? "",
            });
            break;
          case "stock_result":
            setResults((prev) => [...prev, event.data]);
            break;
          case "token_update":
            setTokenUsed(event.used);
            setTokenEstimate(event.estimate);
            break;
          case "insights":
            setInsights(event.text);
            break;
          case "complete":
            // Mark all nodes as completed
            setCompletedNodes(new Set(NODE_ORDER));
            setSummary(event.summary);
            break;
          case "error":
            setError(event.message);
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "运行失败");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [agentId]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  // Sort results by score descending
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: agentColor + "30" }}
          >
            {agentName[0]}
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">{agentName}</h2>
            {summary && (
              <span className="text-xs text-white/40">
                {summary.analyzed}/{summary.totalStocks} 只 ·{" "}
                {(summary.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Token badge */}
          {running ? (
            <AgentTokenBadge
              mode="live"
              used={tokenUsed}
              estimate={tokenEstimate}
            />
          ) : summary ? (
            <AgentTokenBadge
              mode="receipt"
              used={summary.totalTokenCost}
              breakdown={{ insights: summary.totalTokenCost }}
            />
          ) : null}

          {!running ? (
            <button
              onClick={handleStart}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent/80 text-white btn-tactile transition"
            >
              {summary ? "重新运行" : "开始运行"}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-loss/20 text-loss hover:bg-loss/30 transition"
            >
              停止
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded text-white/40 hover:text-white/70 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout: responsive — stack vertically on mobile */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left: Progress timeline */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border p-4 overflow-y-auto">
          <h3 className="text-xs font-medium text-white/40 uppercase mb-4">
            运行进度
          </h3>

          <div className="space-y-1">
            {NODE_ORDER.map((node, i) => {
              const isCompleted = completedNodes.has(node);
              const isActive = currentNode === node && running;
              const isPending = !isCompleted && !isActive;
              const message = nodeMessages[node];

              return (
                <div key={node} className="flex gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 transition-all ${
                        isCompleted
                          ? "bg-step-done border-step-done"
                          : isActive
                            ? "bg-step-active border-step-active animate-pulse"
                            : "bg-transparent border-step-pending"
                      }`}
                    />
                    {i < NODE_ORDER.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 min-h-[24px] ${
                          isCompleted ? "bg-step-done" : "bg-step-pending/30"
                        }`}
                      />
                    )}
                  </div>

                  {/* Label + message */}
                  <div className="pb-3">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted
                          ? "text-step-done"
                          : isActive
                            ? "text-step-active"
                            : "text-step-pending"
                      }`}
                    >
                      {NODE_LABELS[node]}
                    </span>
                    {message && (
                      <p className="text-xs text-white/40 mt-0.5">{message}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar during backtest */}
          {running && progress.total > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>{progress.symbol}</span>
                <span className="font-mono tabular-nums">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
              {error}
            </div>
          )}

          {/* Results Table */}
          {sortedResults.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-white/40 uppercase mb-3">
                回测结果 ({sortedResults.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/40 border-b border-border">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">股票</th>
                      <th className="pb-2 pr-3 text-right">总收益</th>
                      <th className="pb-2 pr-3 text-right">夏普</th>
                      <th className="pb-2 pr-3 text-right">最大回撤</th>
                      <th className="pb-2 text-right">胜率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r, i) => (
                      <tr
                        key={r.symbol}
                        className="border-b border-border/50 hover:bg-surface-hover/30 transition"
                      >
                        <td className="py-2 pr-3 text-white/40 font-mono tabular-nums">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-white font-medium">
                            {r.name}
                          </span>
                          <span className="text-white/40 text-xs ml-1">
                            {r.symbol}
                          </span>
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono tabular-nums ${
                            r.totalReturn >= 0 ? "text-profit" : "text-loss"
                          }`}
                        >
                          {(r.totalReturn * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-white/70">
                          {r.sharpeRatio.toFixed(2)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-loss">
                          {(r.maxDrawdown * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-white/70">
                          {(r.winRate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Insights */}
          {insights && (
            <div className="bg-surface-elevated border border-border rounded-lg p-4">
              <h3 className="text-xs font-medium text-white/50 uppercase mb-2">
                综合分析洞察
              </h3>
              <div className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {insights}
              </div>
            </div>
          )}

          {/* Summary card */}
          {summary && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <span className="stat-label">分析标的</span>
                <span className="stat-value font-mono tabular-nums">
                  {summary.analyzed}/{summary.totalStocks}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">平均收益</span>
                <span
                  className={`stat-value font-mono tabular-nums ${
                    summary.avgReturn >= 0 ? "text-profit" : "text-loss"
                  }`}
                >
                  {(summary.avgReturn * 100).toFixed(1)}%
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">最佳标的</span>
                <span className="stat-value text-sm">{summary.bestSymbol}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">耗时</span>
                <span className="stat-value font-mono tabular-nums">
                  {(summary.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!running && sortedResults.length === 0 && !error && !summary && (
            <div className="flex flex-col items-center justify-center h-64 text-white/30">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <p className="text-sm">点击「开始运行」启动分析任务</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomAgentRunPanel;
