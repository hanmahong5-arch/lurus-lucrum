"use client";

/**
 * Visual Debate Panel
 *
 * Left/right split layout for Bull vs Bear arguments with rounds.
 * Wraps the existing AdvisorChat in debate mode with a dedicated visual layer.
 * Wired to advisor-store for topic persistence.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useAbortController } from "@/hooks/use-abort-controller";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DisabledWithReason } from "@/components/ui/disabled-with-reason";
import { useAdvisorStore } from "@/lib/stores/advisor-store";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface DebateArgument {
  round: number;
  stance: "bull" | "bear";
  content: string;
  keyPoints: string[];
}

interface DebateConclusion {
  summary: string;
  verdict: "bullish" | "bearish" | "neutral";
  confidence: number;
  suggestion?: string;
}

interface DebatePanelProps {
  initialSymbol?: string;
  initialSymbolName?: string;
}

// =============================================================================
// Sub-components
// =============================================================================

function ArgumentColumn({
  stance,
  arguments: args,
  isActive,
}: {
  stance: "bull" | "bear";
  arguments: DebateArgument[];
  isActive: boolean;
}) {
  const isBull = stance === "bull";
  const stanceArgs = args.filter((a) => a.stance === stance);

  return (
    <div
      className={cn(
        "flex-1 min-w-0 rounded-xl border p-4 transition-all",
        isBull
          ? "bg-profit/5 border-profit/20"
          : "bg-loss/5 border-loss/20",
        isActive && (isBull ? "border-profit/40" : "border-loss/40")
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
        <span className="text-2xl">{isBull ? "🐂" : "🐻"}</span>
        <div>
          <div
            className={cn(
              "font-medium",
              isBull ? "text-profit" : "text-loss"
            )}
          >
            {isBull ? "看多方" : "看空方"}
          </div>
          <div className="text-[10px] text-white/40">
            {isBull ? "Bull Analyst" : "Bear Analyst"}
          </div>
        </div>
        {isActive && (
          <span
            className={cn(
              "ml-auto w-2 h-2 rounded-full animate-pulse",
              isBull ? "bg-profit" : "bg-loss"
            )}
          />
        )}
      </div>

      {/* Arguments */}
      <div className="space-y-4">
        {stanceArgs.length === 0 ? (
          <div className="text-xs text-white/20 text-center py-8">
            等待辩论开始...
          </div>
        ) : (
          stanceArgs.map((arg, idx) => (
            <div key={idx} className="space-y-2">
              <div className="text-[10px] text-white/30 uppercase tracking-wide">
                Round {arg.round}
              </div>
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {arg.content || '(思考中...)'}
              </div>
              {arg.keyPoints.length > 0 && (
                <ul className="space-y-1 mt-2">
                  {arg.keyPoints.map((point, pi) => (
                    <li
                      key={pi}
                      className="flex items-start gap-1.5 text-xs text-white/60"
                    >
                      <span
                        className={cn(
                          "mt-1.5 w-1 h-1 rounded-full shrink-0",
                          isBull ? "bg-profit" : "bg-loss"
                        )}
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ConclusionCard({
  conclusion,
}: {
  conclusion: DebateConclusion;
}) {
  const verdictConfig = {
    bullish: { text: "偏多", color: "text-profit", bg: "bg-profit/10" },
    bearish: { text: "偏空", color: "text-loss", bg: "bg-loss/10" },
    neutral: { text: "中性", color: "text-white/60", bg: "bg-white/5" },
  }[conclusion.verdict];

  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        </svg>
        <span className="text-sm font-medium text-white">评委总结</span>
        <span
          className={cn(
            "ml-auto text-xs px-2 py-0.5 rounded-full",
            verdictConfig.bg,
            verdictConfig.color
          )}
        >
          {verdictConfig.text}
          <span className="ml-1 font-mono tabular-nums">
            {conclusion.confidence}%
          </span>
        </span>
      </div>
      <p className="text-sm text-white/70 leading-relaxed">
        {conclusion.summary}
      </p>
      {conclusion.suggestion && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-accent mb-1">操作建议</div>
          <p className="text-sm text-white/80">{conclusion.suggestion}</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DebatePanel({
  initialSymbol,
  initialSymbolName,
}: DebatePanelProps) {
  const advisorStore = useAdvisorStore();
  const [topic, setTopic] = useState(
    initialSymbolName
      ? `${initialSymbolName}是否值得投资`
      : ""
  );
  const [isDebating, setIsDebating] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<
    "bull" | "bear" | null
  >(null);
  const [args, setArgs] = useState<DebateArgument[]>([]);
  const [conclusion, setConclusion] = useState<DebateConclusion | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Abort all debate requests on unmount
  const createDebateSignal = useAbortController();

  const handleCancelDebate = useCallback(() => {
    createDebateSignal(); // Aborts current signal
    setIsDebating(false);
    setCurrentSpeaker(null);
  }, [createDebateSignal]);

  const handleStartDebate = useCallback(async () => {
    if (!topic.trim() || isDebating) return;

    setIsDebating(true);
    setArgs([]);
    setConclusion(null);
    setError(null);

    // Persist topic
    advisorStore.setConversationTitle(topic);
    advisorStore.setMode("debate");

    // Create a single abort signal for the entire debate sequence
    const debateSignal = createDebateSignal();

    try {
      // Start debate session
      const startRes = await fetch("/api/advisor/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          topic: topic.trim(),
          rounds: 2,
        }),
        signal: debateSignal,
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to start debate"
        );
      }

      const startData = await startRes.json();
      const sessionId = startData.session?.id;
      if (!sessionId) throw new Error("Invalid session");

      const symbol = initialSymbol || "";
      const symbolName = topic.trim();

      // Round 1 - Bull
      setCurrentSpeaker("bull");
      const bullRes = await fetch("/api/advisor/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "argument",
          sessionId,
          stance: "bull",
          currentRound: 1,
          symbol,
          symbolName,
          topic: topic.trim(),
        }),
        signal: debateSignal,
      });

      let bullContent = "";
      let bullPoints: string[] = [];
      if (bullRes.ok) {
        const bullData = await bullRes.json();
        if (bullData.argument) {
          bullContent = bullData.argument.content || "";
          bullPoints = bullData.argument.keyPoints || [];
          setArgs((prev) => [
            ...prev,
            {
              round: 1,
              stance: "bull",
              content: bullContent,
              keyPoints: bullPoints,
            },
          ]);
        }
      }

      // Round 1 - Bear
      setCurrentSpeaker("bear");
      const bearRes = await fetch("/api/advisor/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "argument",
          sessionId,
          stance: "bear",
          currentRound: 1,
          symbol,
          symbolName,
          topic: topic.trim(),
          previousArguments: {
            bull: [bullContent],
            bear: [],
          },
        }),
        signal: debateSignal,
      });

      let bearContent = "";
      let bearPoints: string[] = [];
      if (bearRes.ok) {
        const bearData = await bearRes.json();
        if (bearData.argument) {
          bearContent = bearData.argument.content || "";
          bearPoints = bearData.argument.keyPoints || [];
          setArgs((prev) => [
            ...prev,
            {
              round: 1,
              stance: "bear",
              content: bearContent,
              keyPoints: bearPoints,
            },
          ]);
        }
      }

      // Conclusion
      setCurrentSpeaker(null);
      if (bullContent && bearContent) {
        const conclusionRes = await fetch("/api/advisor/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "conclusion",
            sessionId,
            bullArguments: [bullContent],
            bearArguments: [bearContent],
            symbol,
            symbolName,
            topic: topic.trim(),
          }),
          signal: debateSignal,
        });

        if (conclusionRes.ok) {
          const conclusionData = await conclusionRes.json();
          if (conclusionData.conclusion) {
            const c = conclusionData.conclusion;
            setConclusion({
              summary:
                c.consensus ||
                [
                  ...(c.keyBullPoints || []).slice(0, 2),
                  ...(c.keyBearPoints || []).slice(0, 2),
                ].join("；"),
              verdict: c.finalVerdict || "neutral",
              confidence: c.confidenceLevel || 50,
              suggestion: c.suggestedAction,
            });
          }
        }
      }

      // Persist last debate message to advisor store
      advisorStore.addMessage({
        id: `debate-${Date.now()}`,
        role: "assistant",
        content: `多空辩论完成: ${topic}`,
        agentId: null,
        agentName: "辩论系统",
        timestamp: Date.now(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "辩论过程中发生错误";
      setError(
        msg.includes('fetch') || msg.includes('network')
          ? '网络连接失败，请检查网络后重试'
          : msg.includes('timeout')
            ? 'AI 响应超时，建议简化辩论主题后重试'
            : `辩论失败: ${msg}`
      );
    } finally {
      setIsDebating(false);
      setCurrentSpeaker(null);
    }
  }, [topic, isDebating, initialSymbol, advisorStore, createDebateSignal]);

  return (
    <div className="space-y-4">
      {/* Input bar */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-white/40 mb-1 block">
              辩论主题
            </label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="输入辩论主题，如：600519 贵州茅台是否值得长期投资？"
              className="min-h-[60px] max-h-[100px] bg-background border-border text-white placeholder:text-white/30 resize-none"
              disabled={isDebating}
            />
          </div>
          <div className="flex gap-2">
            {isDebating && (
              <Button
                onClick={handleCancelDebate}
                variant="outline"
                className="border-loss/30 text-loss hover:bg-loss/10"
              >
                取消辩论
              </Button>
            )}
            <DisabledWithReason
              disabled={!topic.trim() || isDebating}
              reason={!topic.trim() ? '请输入辩论主题' : '辩论进行中'}
            >
              <Button
                onClick={handleStartDebate}
                disabled={!topic.trim() || isDebating}
                className="bg-accent hover:bg-accent/90 text-primary-600 font-medium btn-tactile"
              >
                {isDebating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
                    辩论中...
                  </span>
                ) : "开始辩论"}
              </Button>
            </DisabledWithReason>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg border border-loss/30 bg-loss/10">
          <p className="text-loss text-sm">{error}</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => { setError(null); if (topic.trim()) void handleStartDebate(); }}
              className="text-xs font-medium text-loss hover:text-loss/80 px-2 py-1 rounded bg-loss/10 transition"
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-medium text-white/40 hover:text-white/60 px-2 py-1 rounded transition"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isDebating && currentSpeaker && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/50">
          <div className="flex gap-1">
            <span
              className={cn(
                "w-2 h-2 rounded-full animate-bounce",
                currentSpeaker === "bull" ? "bg-profit" : "bg-loss"
              )}
              style={{ animationDelay: "0ms" }}
            />
            <span
              className={cn(
                "w-2 h-2 rounded-full animate-bounce",
                currentSpeaker === "bull" ? "bg-profit" : "bg-loss"
              )}
              style={{ animationDelay: "150ms" }}
            />
            <span
              className={cn(
                "w-2 h-2 rounded-full animate-bounce",
                currentSpeaker === "bull" ? "bg-profit" : "bg-loss"
              )}
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span>
            {currentSpeaker === "bull" ? "多头研究员" : "空头研究员"}
            正在发言...
          </span>
        </div>
      )}

      {/* Split debate view */}
      {(args.length > 0 || isDebating) && (
        <>
          <div className="flex gap-4">
            <ArgumentColumn
              stance="bull"
              arguments={args}
              isActive={currentSpeaker === "bull"}
            />
            <ArgumentColumn
              stance="bear"
              arguments={args}
              isActive={currentSpeaker === "bear"}
            />
          </div>

          {/* Round dividers */}
          {args.length >= 2 && (
            <div className="flex items-center gap-4 text-xs text-white/20">
              <div className="flex-1 h-px bg-white/10" />
              <span>Round 1 完成</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}
        </>
      )}

      {/* Conclusion */}
      {conclusion && <ConclusionCard conclusion={conclusion} />}

      {/* Empty state */}
      {!isDebating && args.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30 text-sm space-y-3">
          <div className="w-16 h-16 rounded-xl bg-surface-hover/50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
              />
            </svg>
          </div>
          <p>输入辩论主题，AI 多头和空头研究员将进行对决分析</p>
          <p className="text-white/20">
            支持个股分析、行业判断、宏观趋势等任意主题
          </p>
        </div>
      )}
    </div>
  );
}
