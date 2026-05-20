"use client";

/**
 * Postmortem results panel.
 *
 * Stateless presentation of `PersonaResultPayload[]` + summary / failures.
 * The parent component owns SSE state and feeds this with what's landed
 * so far; this component just renders.
 *
 * @module components/postmortem/postmortem-results
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  PersonaResultPayload,
  PersonaFailure,
} from "@/lib/services/postmortem-service";

interface Props {
  results: ReadonlyArray<PersonaResultPayload>;
  failures: ReadonlyArray<PersonaFailure>;
  /** When undefined the bar shows "进行中"; otherwise renders the text. */
  divergenceSummary?: string;
  /** Total LB charged so far. */
  totalCostLb?: number;
  /** When true, shows the per-card spinner placeholders for not-yet-arrived
   * personas. We never know the full set client-side, so we accept it as a
   * prop. */
  pendingLabels?: ReadonlyArray<{ id: string; label: string }>;
  className?: string;
}

type VerdictTone =
  | "profit-strong"
  | "profit-mild"
  | "neutral"
  | "loss-mild"
  | "loss-strong";

const VERDICT_META: Record<
  PersonaResultPayload["verdict"],
  { label: string; tone: VerdictTone }
> = {
  strong_win: { label: "强胜 · 有 alpha", tone: "profit-strong" },
  weak_win: { label: "弱胜 · 有 edge 但容量有限", tone: "profit-mild" },
  neutral: { label: "中性 · 结论不明", tone: "neutral" },
  weak_loss: { label: "弱负 · 偶发亏损", tone: "loss-mild" },
  strong_loss: { label: "强负 · 系统性问题", tone: "loss-strong" },
};

function toneClass(tone: VerdictTone): string {
  switch (tone) {
    case "profit-strong":
      return "text-profit bg-profit/15 border-profit/30";
    case "profit-mild":
      return "text-profit/80 bg-profit/10 border-profit/20";
    case "neutral":
      return "text-white/70 bg-white/5 border-white/10";
    case "loss-mild":
      return "text-loss/80 bg-loss/10 border-loss/20";
    case "loss-strong":
      return "text-loss bg-loss/15 border-loss/30";
  }
}

export function PostmortemResults({
  results,
  failures,
  divergenceSummary,
  totalCostLb,
  pendingLabels,
  className,
}: Props) {
  const banner = (() => {
    if (!divergenceSummary) {
      return {
        cls: "border-primary/30 bg-primary/10 text-primary/80",
        text: "复盘进行中…",
      };
    }
    if (divergenceSummary.startsWith("意见分歧")) {
      return {
        cls: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
        text: divergenceSummary,
      };
    }
    return {
      cls: "border-profit/30 bg-profit/10 text-profit",
      text: divergenceSummary,
    };
  })();

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "rounded-lg border px-3 py-2 flex items-center justify-between text-xs",
          banner.cls,
        )}
      >
        <span className="font-medium">{banner.text}</span>
        {typeof totalCostLb === "number" && totalCostLb > 0 && (
          <span className="font-mono tabular-nums opacity-70">
            本次花费 {totalCostLb.toFixed(2)} LB
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {results.map((r) => (
          <PersonaCard key={r.personaId} result={r} />
        ))}
        {pendingLabels?.map((p) => (
          <PendingCard key={p.id} label={p.label} />
        ))}
        {failures.map((f) => (
          <FailureCard key={f.personaId} failure={f} />
        ))}
      </div>
    </div>
  );
}

function PersonaCard({ result }: { result: PersonaResultPayload }) {
  const meta = VERDICT_META[result.verdict];
  const [showEvidence, setShowEvidence] = useState(false);
  const [showImprovements, setShowImprovements] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-surface/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{result.label}</div>
          <p className="text-[10px] text-white/40 line-clamp-1">{result.viewpoint}</p>
        </div>
        {result.cached && (
          <span className="text-[10px] text-white/40 px-1.5 py-0.5 rounded bg-white/5">
            缓存
          </span>
        )}
      </div>

      <div
        className={cn(
          "rounded-lg border px-2 py-1 text-[11px] font-medium",
          toneClass(meta.tone),
        )}
      >
        {meta.label}
      </div>

      <p className="text-xs text-white/80 leading-relaxed">{result.summary}</p>

      <button
        type="button"
        onClick={() => setShowEvidence((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] text-white/50 hover:text-white/80 transition pt-1"
      >
        <span>证据 ({result.evidence.length})</span>
        <span>{showEvidence ? "−" : "+"}</span>
      </button>
      {showEvidence && (
        <ul className="space-y-1.5 text-[11px] text-white/70">
          {result.evidence.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-white/40 shrink-0">▸</span>
              <span>
                {e.point}
                <span className="ml-1 text-white/40 font-mono">{e.data}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowImprovements((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] text-white/50 hover:text-white/80 transition pt-1"
      >
        <span>改进建议 ({result.improvements.length})</span>
        <span>{showImprovements ? "−" : "+"}</span>
      </button>
      {showImprovements && (
        <ul className="space-y-1 text-[11px] text-white/70 list-decimal list-inside">
          {result.improvements.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary/60 rounded-full"
            style={{ width: `${Math.round(result.confidence * 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-white/40 font-mono">
          conf {(result.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function PendingCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface/30 p-3 flex items-center justify-center min-h-[160px]">
      <div className="flex flex-col items-center gap-2 text-white/40 text-xs">
        <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        <span>{label} 分析中…</span>
      </div>
    </div>
  );
}

function FailureCard({ failure }: { failure: PersonaFailure }) {
  return (
    <div className="rounded-xl border border-loss/30 bg-loss/5 p-3 space-y-1">
      <div className="text-sm font-semibold text-loss">{failure.label}</div>
      <p className="text-[11px] text-white/60">该视角分析失败，对应 LB 已退回。</p>
      <p className="text-[10px] text-white/40 font-mono break-all">{failure.error}</p>
    </div>
  );
}

export default PostmortemResults;
