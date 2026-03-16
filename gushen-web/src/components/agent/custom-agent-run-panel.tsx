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

import { useState, useRef, useCallback, useEffect } from "react";
import { AgentTokenBadge } from "./agent-token-badge";
import { UpgradeDialog } from "@/components/paywall/upgrade-dialog";
import { useAsyncTask } from "@/hooks/use-async-task";
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

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: "请求参数错误",
  401: "登录已过期，请重新登录",
  403: "无权限执行此操作",
  429: "请求过于频繁，请稍后再试",
  500: "服务内部错误，请稍后再试",
  502: "服务暂时不可用，请稍后再试",
  503: "系统维护中，请稍后再试",
  504: "请求超时，请检查网络后重试",
};

// =============================================================================
// Types
// =============================================================================

interface AgentError {
  message: string;
  code?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Props
// =============================================================================

interface CustomAgentRunPanelProps {
  agentId: string;
  agentName: string;
  agentColor?: string;
  onClose?: () => void;
  /** Callback to open the editor for this agent */
  onEditRequest?: () => void;
  /** When true, automatically start the run on mount */
  autoStart?: boolean;
}

// =============================================================================
// AgentErrorPanel Sub-component
// =============================================================================

interface AgentErrorPanelProps {
  error: AgentError;
  onRetry: () => void;
  onEditRequest?: () => void;
  onClose?: () => void;
}

function AgentErrorPanel({ error, onRetry, onEditRequest, onClose }: AgentErrorPanelProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [hasSeenUpgrade, setHasSeenUpgrade] = useState(false);

  const handleUpgradeClose = (open: boolean) => {
    setUpgradeOpen(open);
    if (!open) setHasSeenUpgrade(true);
  };

  const isQuotaError = error.code === "DAILY_LIMIT" || error.code === "QUOTA_EXCEEDED";
  const isValidationError = error.code === "VALIDATION_FAILED";

  let title: string;
  let description: string;

  if (error.code === "DAILY_LIMIT") {
    const used = error.metadata?.used as number | undefined;
    const limit = error.metadata?.limit as number | undefined;
    title = used !== undefined && limit !== undefined
      ? `今日运行次数已达上限（${used}/${limit}）`
      : "今日运行次数已达上限";
    description = "免费版每天可运行有限次分析任务。明天将自动重置，或升级计划后立即恢复。";
  } else if (error.code === "QUOTA_EXCEEDED") {
    title = "AI Token 配额不足";
    description = "当前计划的 AI Token 已用完。升级后可立即继续使用。";
  } else if (isValidationError) {
    title = "配置验证失败";
    description = error.message;
  } else {
    title = "运行中断";
    description = error.message;
  }

  const iconChar = isQuotaError ? "⏸" : isValidationError ? "⚠️" : "⚡";

  return (
    <div role="alert" aria-label={title} className="mb-4 rounded-lg border border-loss/20 bg-loss/5 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-lg mt-0.5 select-none">{iconChar}</span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white">{title}</h4>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {isQuotaError && hasSeenUpgrade && (
          <p className="text-xs text-white/40 mt-2 leading-relaxed">
            已了解升级方案？完成升级后刷新页面即可恢复使用。
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {isQuotaError && (
            <button
              aria-label="升级计划"
              onClick={() => setUpgradeOpen(true)}
              className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-white hover:bg-accent/80 transition btn-tactile"
            >
              ↑ 升级计划
            </button>
          )}
          {onEditRequest && (
            <button
              aria-label="修改参数"
              onClick={onEditRequest}
              className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/80 hover:bg-white/15 transition"
            >
              ✏️ 修改参数
            </button>
          )}
          {!isQuotaError && !isValidationError && (
            <button
              aria-label="再试一次"
              onClick={onRetry}
              className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/80 hover:bg-white/15 transition"
            >
              再试一次
            </button>
          )}
          {isQuotaError && onClose && (
            <button
              aria-label="明天再来"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs font-medium text-white/40 hover:text-white/60 transition"
            >
              → 明天再来
            </button>
          )}
        </div>
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={handleUpgradeClose}
        variant="limit"
        featureName="custom_agent_run"
        used={error.metadata?.used as number | undefined}
        limit={error.metadata?.limit as number | undefined}
      />
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function CustomAgentRunPanel({
  agentId,
  agentName,
  agentColor = "#6366f1",
  onClose,
  onEditRequest,
  autoStart = false,
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
  const [error, setError] = useState<AgentError | null>(null);

  // Abort controller
  const abortRef = useRef<AbortController | null>(null);
  const task = useAsyncTask();

  const handleStart = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    setInsights("");
    setSummary(null);
    setCurrentNode("");
    setCompletedNodes(new Set());
    setNodeMessages({});
    setProgress({ current: 0, total: 0, symbol: "" });
    setTokenUsed(0);

    task.registerTask({ type: 'agent', title: `分析任务 — ${agentName}` });

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
          try {
            const evt = JSON.parse(match[1]) as CustomAgentEvent;
            if (evt.type === "error") {
              setError({ message: evt.message, code: evt.code, metadata: evt.metadata });
              setRunning(false);
              return;
            }
          } catch {
            // fall through to generic error
          }
        }
        setError({ message: HTTP_STATUS_MESSAGES[res.status] ?? `请求失败 (${res.status})` });
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
            task.updateProgress(
              event.total > 0 ? Math.round((event.current / event.total) * 100) : 0,
              `${event.current}/${event.total} ${event.symbol ?? ''}`
            );
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
            task.complete({ summary: event.summary, resultCount: results.length });
            break;
          case "error":
            setError({ message: event.message, code: event.code, metadata: event.metadata });
            task.fail(event.message);
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errMsg = err instanceof Error ? err.message : "运行失败";
        setError({ message: errMsg });
        task.fail(errMsg);
      } else {
        task.cancel();
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [agentId, agentName, task, results.length]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    task.cancel();
  }, [task]);

  // Auto-start on mount if requested (e.g. after editing config and clicking "Save & Run")
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      void handleStart();
    }
  }, [autoStart, handleStart]);

  // Sort results by score descending
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  // Button label based on state
  const runButtonLabel = error ? "再次运行" : summary ? "重新运行" : "开始运行";

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
              {runButtonLabel}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-loss/20 text-loss hover:bg-loss/30 transition"
            >
              停止
            </button>
          )}

          {/* Edit parameters button — always visible */}
          {onEditRequest && (
            <button
              onClick={() => {
                if (running) handleStop();
                onEditRequest();
              }}
              className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition"
              title="修改参数"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
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
          {/* Structured error card */}
          {error && (
            <AgentErrorPanel
              error={error}
              onRetry={handleStart}
              onEditRequest={onEditRequest}
              onClose={onClose}
            />
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
export { AgentErrorPanel };
export type { AgentError, AgentErrorPanelProps };
