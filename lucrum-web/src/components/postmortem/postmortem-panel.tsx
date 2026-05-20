"use client";

/**
 * Postmortem orchestrator.
 *
 * Owns the SSE connection to `POST /api/postmortem` and drives both the
 * launcher (chip + button) and the results panel. Lives directly under
 * the backtest results header.
 *
 * Behaviour:
 *   - Idle           → render <PostmortemLauncher /> and a hint line.
 *   - Dispatched     → render <PostmortemResults /> with whatever persona
 *                     payloads have streamed in so far + per-pending spinner
 *                     cards for the persona ids the user selected but that
 *                     haven't arrived yet.
 *   - Settled        → keep the results visible plus a "再来一次" affordance.
 *   - Errored        → inline error + retry.
 *
 * @module components/postmortem/postmortem-panel
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PostmortemLauncher } from "./postmortem-launcher";
import { PostmortemResults } from "./postmortem-results";
import {
  POSTMORTEM_PERSONAS,
  type PostmortemPersonaId,
} from "@/lib/services/postmortem-personas";
import type {
  PersonaResultPayload,
  PersonaFailure,
} from "@/lib/services/postmortem-service";

interface Props {
  /** Persisted backtest id — only present after `/api/history` round-trip. */
  backtestId: number | null;
  strategyName?: string;
  className?: string;
}

interface StreamSummary {
  runId: number;
  divergenceSummary: string;
  totalCostLb: number;
}

interface SsePayload<T> {
  kind: string;
  payload: T;
}

const PERSONA_LABEL_BY_ID = new Map(
  POSTMORTEM_PERSONAS.map((p) => [p.id, p.label]),
);

export function PostmortemPanel({ backtestId, strategyName, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<PostmortemPersonaId[] | null>(null);
  const [results, setResults] = useState<PersonaResultPayload[]>([]);
  const [failures, setFailures] = useState<PersonaFailure[]>([]);
  const [summary, setSummary] = useState<StreamSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setResults([]);
    setFailures([]);
    setSummary(null);
    setError(null);
    setRequested(null);
  }, []);

  const handleDispatch = useCallback(
    async (personaIds: PostmortemPersonaId[]) => {
      if (!backtestId) {
        setError("当前回测尚未持久化，无法复盘 — 请重新运行回测后再试。");
        return;
      }
      reset();
      setBusy(true);
      setRequested(personaIds);

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/postmortem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backtestId, personaIds, strategyName }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => "");
          throw new Error(`postmortem 接口 ${res.status}: ${body || "无响应体"}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.startsWith("data: ")
              ? line.slice(6).trim()
              : line.slice(5).trim();
            if (!data) continue;
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as SsePayload<unknown>;
              if (parsed.kind === "persona") {
                setResults((prev) => [
                  ...prev,
                  parsed.payload as PersonaResultPayload,
                ]);
              } else if (parsed.kind === "failure") {
                setFailures((prev) => [
                  ...prev,
                  parsed.payload as PersonaFailure,
                ]);
              } else if (parsed.kind === "summary") {
                setSummary(parsed.payload as StreamSummary);
              } else if (parsed.kind === "error") {
                const msg =
                  (parsed.payload as { message?: string }).message ?? "复盘失败";
                setError(msg);
              }
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [backtestId, strategyName, reset],
  );

  // Pending list = requested set minus what arrived (success or failure).
  const pendingLabels = useMemo(() => {
    if (!requested || requested.length === 0) return [];
    const settled = new Set([
      ...results.map((r) => r.personaId),
      ...failures.map((f) => f.personaId),
    ]);
    return requested
      .filter((id) => !settled.has(id))
      .map((id) => ({ id, label: PERSONA_LABEL_BY_ID.get(id) ?? id }));
  }, [requested, results, failures]);

  const hasOutput = results.length > 0 || failures.length > 0 || summary != null;

  return (
    <div className={cn("space-y-3", className)}>
      {!backtestId && (
        <p className="text-[11px] text-white/40">
          复盘需要持久化的回测 — 请等待结果保存后再试。
        </p>
      )}

      {requested == null ? (
        <PostmortemLauncher onDispatch={handleDispatch} busy={busy} />
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={reset}
                className="text-loss/80 hover:text-loss underline underline-offset-2"
              >
                重新选择
              </button>
            </div>
          )}
          <PostmortemResults
            results={results}
            failures={failures}
            divergenceSummary={summary?.divergenceSummary}
            totalCostLb={summary?.totalCostLb}
            pendingLabels={pendingLabels}
          />
          {hasOutput && !busy && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={reset}
                className="text-xs text-white/50 hover:text-white/80 px-2 py-1 rounded transition"
              >
                重新选择视角
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PostmortemPanel;
