"use client";

/**
 * Postmortem Launcher — 4-persona selector + dispatch button.
 *
 * Renders 4 toggle chips (default all selected). The user picks which
 * personas they want to spend LB on, then clicks "开始复盘"; the parent
 * `onDispatch` callback wires the SSE flow.
 *
 * @module components/postmortem/postmortem-launcher
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  POSTMORTEM_PERSONAS,
  POSTMORTEM_COST_PER_PERSONA_LB,
  type PostmortemPersonaId,
} from "@/lib/services/postmortem-personas";

interface Props {
  /** Disabled while a dispatch is mid-flight. */
  busy?: boolean;
  /** Called with the user-selected subset; parent owns the SSE fetch. */
  onDispatch: (personaIds: PostmortemPersonaId[]) => void;
  className?: string;
}

const ALL_IDS: PostmortemPersonaId[] = POSTMORTEM_PERSONAS.map((p) => p.id);

export function PostmortemLauncher({ busy, onDispatch, className }: Props) {
  const [selected, setSelected] = useState<Set<PostmortemPersonaId>>(
    () => new Set(ALL_IDS),
  );

  const toggle = useCallback((id: PostmortemPersonaId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Don't allow zero selection — clicking the last active chip is a no-op.
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const totalCost = useMemo(
    () => selected.size * POSTMORTEM_COST_PER_PERSONA_LB,
    [selected],
  );

  const handleDispatch = useCallback(() => {
    if (busy || selected.size === 0) return;
    const payload = ALL_IDS.filter((id) => selected.has(id));
    onDispatch(payload);
  }, [busy, selected, onDispatch]);

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🧠</span>
            <span className="text-sm font-semibold text-white">
              让 AI 大师复盘
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5">
            4 位视角并行分析，各给出 verdict + 证据 + 改进建议
          </p>
        </div>
        <button
          type="button"
          onClick={handleDispatch}
          disabled={busy || selected.size === 0}
          className={cn(
            "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition btn-tactile",
            busy
              ? "bg-white/10 text-white/40 cursor-wait"
              : "bg-accent text-void hover:bg-accent/90",
          )}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-void/40 border-t-void rounded-full animate-spin" />
              复盘中…
            </span>
          ) : (
            <>开始复盘（{totalCost} LB）</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {POSTMORTEM_PERSONAS.map((persona) => {
          const active = selected.has(persona.id);
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => toggle(persona.id)}
              disabled={busy}
              aria-pressed={active}
              className={cn(
                "text-left p-2.5 rounded-lg border transition-all btn-tactile",
                active
                  ? "border-primary/40 bg-primary/10"
                  : "border-white/5 bg-surface/30 hover:border-white/10",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-primary" : "text-white/60",
                  )}
                >
                  {persona.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono tabular-nums",
                    active ? "text-primary/60" : "text-white/30",
                  )}
                >
                  {POSTMORTEM_COST_PER_PERSONA_LB} LB
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                {persona.viewpoint}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PostmortemLauncher;
