/**
 * Agent Token Badge Component
 * Token consumption display badge
 *
 * Three modes:
 * - estimate: Static estimation during agent configuration
 * - live: Real-time consumption during agent run
 * - receipt: Final cost summary after completion
 *
 * @module components/agent/agent-token-badge
 */

"use client";

import { useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface EstimateProps {
  mode: "estimate";
  tokens: number;
}

interface LiveProps {
  mode: "live";
  used: number;
  estimate: number;
}

interface ReceiptProps {
  mode: "receipt";
  used: number;
  breakdown?: { resolveTargets?: number; insights?: number };
}

type AgentTokenBadgeProps = EstimateProps | LiveProps | ReceiptProps;

// =============================================================================
// Helpers
// =============================================================================

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// =============================================================================
// Component
// =============================================================================

export function AgentTokenBadge(props: AgentTokenBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (props.mode === "estimate") {
    if (props.tokens === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-step-done/10 text-step-done text-xs font-medium">
          <TokenIcon />
          免费
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-xs font-medium">
        <TokenIcon />
        <span className="font-mono tabular-nums">
          ~{formatTokens(props.tokens)}
        </span>
        <span className="text-white/40">tokens</span>
      </span>
    );
  }

  if (props.mode === "live") {
    const percent =
      props.estimate > 0
        ? Math.min(100, Math.round((props.used / props.estimate) * 100))
        : 0;

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
        <TokenIcon className="animate-pulse" />
        <span className="font-mono tabular-nums">
          {formatTokens(props.used)}
        </span>
        <span className="text-white/40">/</span>
        <span className="font-mono tabular-nums text-white/40">
          ~{formatTokens(props.estimate)}
        </span>
        {/* Mini progress bar */}
        <span className="w-8 h-1 rounded-full bg-white/10 overflow-hidden">
          <span
            className="block h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </span>
      </span>
    );
  }

  // receipt mode
  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated text-white/70 text-xs font-medium hover:bg-surface-hover transition cursor-pointer"
    >
      <TokenIcon />
      <span className="font-mono tabular-nums">
        {formatTokens(props.used)}
      </span>
      <span className="text-white/40">tokens</span>
      {props.breakdown && (
        <svg
          className={`w-3 h-3 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
      {expanded && props.breakdown && (
        <span className="absolute top-full left-0 mt-1 p-2 rounded bg-surface-modal border border-border text-xs whitespace-nowrap z-10">
          {props.breakdown.insights !== undefined && (
            <span className="block">
              综合研判: <span className="font-mono tabular-nums">{formatTokens(props.breakdown.insights)}</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** Small token/coin icon */
function TokenIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${className}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5v7M5.5 6.5h5M5.5 9.5h5" strokeLinecap="round" />
    </svg>
  );
}

export default AgentTokenBadge;
