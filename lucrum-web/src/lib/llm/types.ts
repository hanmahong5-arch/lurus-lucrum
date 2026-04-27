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
}
