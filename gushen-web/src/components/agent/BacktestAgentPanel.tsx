"use client";

/**
 * BacktestAgentPanel
 *
 * Two-column layout:
 * - Left: Agent chat (user input + streaming status + AI messages)
 * - Right: Backtest result visualization (equity curve, metrics, trades)
 *
 * Communicates with POST /api/agent/backtest via SSE.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, TrendingUp, BarChart2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BacktestAgentResult } from "@/lib/agent/backtest-agent";
import { useAsyncTask } from "@/hooks/use-async-task";

// =============================================================================
// Types
// =============================================================================

interface ChatMessage {
  role: "user" | "agent" | "status";
  content: string;
  timestamp: number;
}

interface AgentStreamEvent {
  type: "status" | "result" | "report" | "error" | "followUp";
  step?: string;
  message?: string;
  backtestResult?: BacktestAgentResult;
  content?: string;
  code?: string;
}

// =============================================================================
// Helpers
// =============================================================================

const STRATEGY_LABELS: Record<string, string> = {
  ma_cross: "均线交叉",
  rsi: "RSI 策略",
  macd: "MACD 策略",
  boll: "布林线策略",
};

function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

// =============================================================================
// Sub-components
// =============================================================================

function MetricCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  const colorClass =
    positive === undefined
      ? "text-white"
      : positive
        ? "text-emerald-400"
        : "text-red-400";

  return (
    <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-base font-mono font-semibold tabular-nums ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}

function EquityCurveChart({
  equityCurve,
  initialCapital,
}: {
  equityCurve: BacktestAgentResult["equityCurve"];
  initialCapital: number;
}) {
  if (equityCurve.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
        数据不足
      </div>
    );
  }

  const values = equityCurve.map((p) => p.equity);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Build SVG polyline points (normalized to 100×40 viewport)
  const points = equityCurve
    .map((p, i) => {
      const x = (i / (equityCurve.length - 1)) * 100;
      const y = 40 - ((p.equity - minVal) / range) * 36;
      return `${x},${y}`;
    })
    .join(" ");

  const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? initialCapital;
  const isPositive = finalEquity >= initialCapital;
  const strokeColor = isPositive ? "#34d399" : "#f87171";

  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 40"
        className="w-full h-28"
        preserveAspectRatio="none"
      >
        {/* Baseline */}
        <line
          x1="0"
          y1="40"
          x2="100"
          y2="40"
          stroke="#374151"
          strokeWidth="0.5"
        />
        {/* Equity curve */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-xs text-slate-500 font-mono tabular-nums">
        <span>{equityCurve[0]?.date}</span>
        <span>{equityCurve[equityCurve.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  report,
}: {
  result: BacktestAgentResult;
  report?: string;
}) {
  const finalEquity =
    result.equityCurve[result.equityCurve.length - 1]?.equity ?? 0;
  const totalReturn = result.returnMetrics.totalReturn;

  return (
    <div className="space-y-4">
      {/* Equity curve */}
      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-300">净值曲线</span>
          <span
            className={`ml-auto text-sm font-mono tabular-nums ${totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatPercent(totalReturn)}
          </span>
        </div>
        <EquityCurveChart
          equityCurve={result.equityCurve}
          initialCapital={100000}
        />
      </div>

      {/* Key metrics grid */}
      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-300">关键指标</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="总收益率"
            value={formatPercent(result.returnMetrics.totalReturn)}
            positive={result.returnMetrics.totalReturn >= 0}
          />
          <MetricCard
            label="年化收益"
            value={formatPercent(result.returnMetrics.annualizedReturn)}
            positive={result.returnMetrics.annualizedReturn >= 0}
          />
          <MetricCard
            label="最大回撤"
            value={`-${Math.abs(result.riskMetrics.maxDrawdown).toFixed(2)}%`}
            positive={false}
          />
          <MetricCard
            label="夏普比率"
            value={result.riskMetrics.sharpeRatio.toFixed(4)}
            positive={result.riskMetrics.sharpeRatio >= 1}
          />
          <MetricCard
            label="胜率"
            value={`${(result.tradingMetrics.winRate * 100).toFixed(1)}%`}
            positive={result.tradingMetrics.winRate >= 0.5}
          />
          <MetricCard
            label="交易次数"
            value={`${result.tradingMetrics.totalTrades} 次`}
          />
        </div>
      </div>

      {/* Recent trades */}
      {result.trades && result.trades.length > 0 && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">
              最近交易（最多 10 条）
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono tabular-nums">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left pb-2 pr-3">日期</th>
                  <th className="text-left pb-2 pr-3">方向</th>
                  <th className="text-right pb-2">盈亏</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.slice(-10).map((trade, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="py-1 pr-3 text-slate-400">{trade.date}</td>
                    <td className="py-1 pr-3">
                      <span
                        className={
                          trade.type === "buy"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }
                      >
                        {trade.type === "buy" ? "买入" : "卖出"}
                      </span>
                    </td>
                    <td className="py-1 text-right">
                      {trade.pnlPercent !== undefined ? (
                        <span
                          className={
                            trade.pnlPercent >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {formatPercent(trade.pnlPercent)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Report */}
      {report && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-amber-500/20">
          <p className="text-xs text-amber-400/70 mb-2 font-medium">AI 解读报告</p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {report}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function BacktestAgentPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      content:
        "你好！我是 AI 回测助手。请告诉我你想回测的股票、策略和时间范围，例如：\n\n「帮我回测平安银行 2023 年全年，使用双均线策略，初始资金 10 万」",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestAgentResult | undefined>();
  const [report, setReport] = useState<string | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const task = useAsyncTask();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setBacktestResult(undefined);
    setReport(undefined);

    addMessage({ role: "user", content: text, timestamp: Date.now() });
    task.registerTask({ type: 'agent', title: `AI 回测 — ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}` });

    try {
      const response = await fetch("/api/agent/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.body) throw new Error("No stream body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as AgentStreamEvent;

            if (event.type === "status" && event.message) {
              addMessage({
                role: "status",
                content: event.message,
                timestamp: Date.now(),
              });
            } else if (event.type === "followUp" && event.content) {
              addMessage({
                role: "agent",
                content: event.content,
                timestamp: Date.now(),
              });
            } else if (event.type === "result" && event.backtestResult) {
              setBacktestResult(event.backtestResult);
              task.updateProgress(80, '回测完成，生成报告...');
            } else if (event.type === "report" && event.content) {
              setReport(event.content);
              addMessage({
                role: "agent",
                content: "回测完成！右栏已显示详细结果和分析报告。",
                timestamp: Date.now(),
              });
              task.complete({ hasResult: true, reportLength: event.content.length });
            } else if (event.type === "error") {
              addMessage({
                role: "agent",
                content: `出现错误: ${event.message ?? "请重试"}`,
                timestamp: Date.now(),
              });
              task.fail(event.message ?? '回测失败');
            }
          } catch {
            // Ignore JSON parse errors for partial lines
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "请重试";
      addMessage({
        role: "agent",
        content: `连接失败: ${errMsg}`,
        timestamp: Date.now(),
      });
      task.fail(`连接失败: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full gap-4 p-4 min-h-0">
      {/* Left Column — Chat */}
      <div className="flex flex-col w-[420px] flex-shrink-0 bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-white">AI 回测 Agent</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            用自然语言描述你的回测需求
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "status" ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{msg.content}</span>
                </div>
              ) : msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-amber-600/20 border border-amber-600/30 rounded-xl rounded-br-sm px-3 py-2">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="max-w-[85%] bg-slate-700/40 border border-slate-600/30 rounded-xl rounded-bl-sm px-3 py-2">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你的回测需求... (Enter 发送)"
              disabled={isLoading}
              rows={2}
              className="flex-1 resize-none bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 transition"
            />
            <Button
              type="button"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-3 py-2 h-auto bg-amber-600 hover:bg-amber-500 text-slate-900 rounded-lg disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Column — Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {backtestResult ? (
          <ResultPanel result={backtestResult} report={report} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-600">
            <TrendingUp className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">回测结果将在此处显示</p>
            <p className="text-xs mt-1 opacity-70">
              在左侧输入回测需求即可开始
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
