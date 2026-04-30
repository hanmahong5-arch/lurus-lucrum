/**
 * LLM router task classes — pick by *cognitive load*, not by feature.
 *
 *   routine  — short, structured, low-stakes. Intent parsing, classification,
 *              JSON extraction, summary headlines. Fast cheap model.
 *   analytic — multi-step prose with domain knowledge. Investment commentary,
 *              scanner analysis, debate turns, code review. Smarter model.
 *   reasoning — explicit chain-of-thought required. Strategy critique, math,
 *              ambiguous trade-offs, agentic planning. Reasoner model.
 *
 * Add new classes only when an existing one no longer fits. Resist the urge
 * to introduce per-feature models — the whole point of the router is to keep
 * model selection *centralized* and reviewable.
 *
 * @module lib/llm/types
 */

export type TaskClass = 'routine' | 'analytic' | 'reasoning';

export interface TaskProfile {
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly fallback?: TaskClass;
  /**
   * Hard floor on `maxTokens` — caller-supplied overrides below this are
   * silently raised to this value (with a warn log + `maxTokensFloored:true`
   * telemetry flag). Exists to defend against the DeepSeek V4 reasoning_content
   * trap: the model burns several hundred tokens of CoT before emitting any
   * `content`, so a tiny budget yields an empty user-facing answer with
   * `finish_reason:"length"`. Routine class can take a much lower floor since
   * `deepseek-chat` is the no-CoT direct-answer alias.
   */
  readonly minMaxTokens: number;
}

export interface LlmCallTelemetry {
  readonly taskClass: TaskClass;
  readonly modelRequested: string;
  readonly modelActual: string | null;
  readonly latencyMs: number;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly totalTokens: number | null;
  readonly success: boolean;
  readonly error: string | null;
  readonly fallbackUsed: boolean;
  // True iff the call was aborted by the *caller* (e.g. user closed tab,
  // request.signal fired) — distinguished from server-side errors so that
  // monitoring can compute error rate as `success=false AND cancelled=false`.
  readonly cancelled: boolean;
  // True iff the caller-supplied `maxTokens` was below the task class's
  // documented floor and the router auto-raised it. Useful for grepping
  // out call sites that would otherwise silently produce empty content.
  readonly maxTokensFloored: boolean;
}

/**
 * Thrown when a chatComplete / streamChat call is aborted via the caller's
 * AbortSignal (browser tab closed, upstream Next.js request cancelled).
 * Distinct from a generic fetch error so the router can:
 *   1. skip the fallback chain (a cancel is intentional, not a model failure),
 *   2. tag telemetry `cancelled:true` instead of inflating error rate.
 */
export class LlmCancelledError extends Error {
  constructor(reason?: string) {
    super(reason ?? 'LLM call cancelled by caller');
    this.name = 'LlmCancelledError';
  }
}
