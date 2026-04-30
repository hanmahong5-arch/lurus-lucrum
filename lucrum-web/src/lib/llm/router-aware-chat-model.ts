/**
 * Router-aware ChatOpenAI subclass — extends LangChain's ChatOpenAI with the
 * router's contracts so LangGraph nodes get the same observability as raw
 * `chatComplete` calls:
 *
 *   1. Telemetry — one JSON line per attempt, same shape as `chatComplete`
 *      (taskClass, modelRequested, latencyMs, token usage, success, etc.).
 *      Without this, LangChain agents (backtest / scanner / advisor-graph /
 *      custom-agent) were a black hole — newapi billed, but local logs
 *      couldn't attribute spend to a specific agent path.
 *
 *   2. Cancellation contract — when the caller's AbortSignal aborts mid-call,
 *      we surface `LlmCancelledError` (not a generic abort) and tag telemetry
 *      `cancelled:true`, matching `chatComplete`. This keeps error-rate dashboards
 *      honest: a tab close is not a model failure.
 *
 *   3. Caller attribution — sticky `caller` field set at instance construction
 *      (one per LangGraph node typically). Lets ops grep
 *      `caller="advisor.graph:trader"` for spend by graph node.
 *
 * NOT in scope here (deliberate):
 *   - Cross-class fallback (analytic→routine on failure). LangChain's retry
 *     logic and graph-level error handling give nodes their own recovery
 *     story; bolting fallback in here would surprise graph state machines.
 *     Use `chatComplete` directly when you want fallback.
 *   - Streaming token-by-token telemetry. We record once per stream completion.
 *
 * @module lib/llm/router-aware-chat-model
 */

import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult, ChatGenerationChunk } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { makeTelemetryRecorder } from './observability';
import { LlmCancelledError, type TaskClass } from './types';

export interface RouterAwareChatOpenAIFields {
  /** Task class this instance was constructed for — propagated to telemetry. */
  readonly taskClass: TaskClass;
  /** True iff the caller-supplied maxTokens was floored — propagated to telemetry. */
  readonly maxTokensFloored: boolean;
  /** Sticky caller identifier — see ModelOverrides.caller in router.ts. */
  readonly caller: string | null;
}

/**
 * Best-effort detector for "this exception means the caller cancelled, not the
 * model exploded". LangChain wraps the underlying fetch error, so the abort
 * signature shifts across versions:
 *   - Native fetch: `error.name === 'AbortError'`
 *   - openai SDK: `APIUserAbortError` with name `AbortError`
 *   - LangChain wrapped: message contains `"aborted"` / `"AbortError"`
 * Combined with `signal.aborted` as the authoritative truth.
 */
function isCallerAbort(err: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted) return true;
  if (!err || typeof err !== 'object') return false;
  const obj = err as { name?: unknown; message?: unknown };
  if (obj.name === 'AbortError') return true;
  if (typeof obj.message === 'string' && /abort/i.test(obj.message)) return true;
  return false;
}

interface LlmOutputTokenUsage {
  readonly tokenUsage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalTokens?: number;
  };
}

function extractTokens(llmOutput: unknown): {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
} {
  if (!llmOutput || typeof llmOutput !== 'object') {
    return { promptTokens: null, completionTokens: null, totalTokens: null };
  }
  const usage = (llmOutput as LlmOutputTokenUsage).tokenUsage;
  return {
    promptTokens: usage?.promptTokens ?? null,
    completionTokens: usage?.completionTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
  };
}

export class RouterAwareChatOpenAI extends ChatOpenAI {
  readonly routerTaskClass: TaskClass;
  readonly routerMaxTokensFloored: boolean;
  readonly routerCaller: string | null;

  constructor(
    fields: ConstructorParameters<typeof ChatOpenAI>[0] & RouterAwareChatOpenAIFields,
  ) {
    const { taskClass, maxTokensFloored, caller, ...rest } = fields;
    super(rest);
    this.routerTaskClass = taskClass;
    this.routerMaxTokensFloored = maxTokensFloored;
    this.routerCaller = caller;
  }

  override async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const tel = makeTelemetryRecorder(this.routerTaskClass, this.model, {
      maxTokensFloored: this.routerMaxTokensFloored,
      caller: this.routerCaller,
    });
    const signal = options.signal;

    if (signal?.aborted) {
      tel.record({ success: false, cancelled: true, error: null });
      throw new LlmCancelledError('caller already aborted');
    }

    try {
      const result = await super._generate(messages, options, runManager);
      const tokens = extractTokens(result.llmOutput);
      tel.record({
        modelActual: this.model,
        ...tokens,
        success: true,
      });
      return result;
    } catch (err) {
      if (isCallerAbort(err, signal)) {
        tel.record({ success: false, cancelled: true, error: null });
        throw new LlmCancelledError('caller aborted mid-flight');
      }
      tel.record({ success: false, error: String(err) });
      throw err;
    }
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const tel = makeTelemetryRecorder(this.routerTaskClass, this.model, {
      maxTokensFloored: this.routerMaxTokensFloored,
      caller: this.routerCaller,
    });
    const signal = options.signal;

    if (signal?.aborted) {
      tel.record({ success: false, cancelled: true, error: null });
      throw new LlmCancelledError('caller already aborted');
    }

    let chunkCount = 0;
    let lastTokens = { promptTokens: null as number | null, completionTokens: null as number | null, totalTokens: null as number | null };
    try {
      for await (const chunk of super._streamResponseChunks(messages, options, runManager)) {
        chunkCount += 1;
        // Final chunks may carry token usage in generationInfo.
        const info = chunk.generationInfo as { tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } } | undefined;
        if (info?.tokenUsage) {
          lastTokens = {
            promptTokens: info.tokenUsage.promptTokens ?? lastTokens.promptTokens,
            completionTokens: info.tokenUsage.completionTokens ?? lastTokens.completionTokens,
            totalTokens: info.tokenUsage.totalTokens ?? lastTokens.totalTokens,
          };
        }
        yield chunk;
      }
      tel.record({
        modelActual: this.model,
        ...lastTokens,
        success: true,
      });
    } catch (err) {
      // Streams that emit chunks before erroring still count as a (partial)
      // success from the user's perspective, but we tag the call as failed
      // because the caller's promise rejected. Telemetry consumers can use
      // chunkCount-aware queries when needed; we keep the field set minimal.
      void chunkCount; // kept for future "partial-success" telemetry field
      if (isCallerAbort(err, signal)) {
        tel.record({ success: false, cancelled: true, error: null });
        throw new LlmCancelledError('caller aborted mid-stream');
      }
      tel.record({ success: false, error: String(err) });
      throw err;
    }
  }
}
