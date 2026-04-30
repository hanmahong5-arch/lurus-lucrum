/**
 * Structured LLM-call telemetry. Emits one JSON line per attempt to stdout
 * so it's harvested by Loki / kubectl logs without extra infra.
 *
 * Why log here instead of relying on newapi's request log: the gateway log
 * shows raw HTTP requests, but cannot correlate with our task class or
 * fallback decision. Local telemetry is the only place those facts coexist.
 *
 * @module lib/llm/observability
 */

import type { LlmCallTelemetry } from './types';

export function emitLlmTelemetry(t: LlmCallTelemetry): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      kind: 'llm.call',
      ts: new Date().toISOString(),
      ...t,
    }),
  );
}

export interface RecorderOptions {
  /**
   * Sticky flag set at recorder construction (the floor decision is made
   * before the call begins, doesn't change across success/fallback paths,
   * and we don't want to forget to thread it through every `record()` call).
   */
  readonly maxTokensFloored?: boolean;
}

export function makeTelemetryRecorder(
  taskClass: LlmCallTelemetry['taskClass'],
  modelRequested: string,
  options?: RecorderOptions,
) {
  const start = Date.now();
  let fallbackUsed = false;
  const maxTokensFloored = options?.maxTokensFloored ?? false;
  return {
    markFallback() {
      fallbackUsed = true;
    },
    record(partial: Partial<LlmCallTelemetry>): void {
      emitLlmTelemetry({
        taskClass,
        modelRequested,
        modelActual: partial.modelActual ?? null,
        latencyMs: Date.now() - start,
        promptTokens: partial.promptTokens ?? null,
        completionTokens: partial.completionTokens ?? null,
        totalTokens: partial.totalTokens ?? null,
        success: partial.success ?? false,
        error: partial.error ?? null,
        fallbackUsed,
        cancelled: partial.cancelled ?? false,
        maxTokensFloored,
      });
    },
  };
}
