/**
 * Public surface of the LLM router. Import from here, not internal modules.
 *
 *   getChatModel('analytic')          // LangChain ChatOpenAI
 *   chatComplete('routine', msgs)     // one-shot completion
 *   streamChat('reasoning', msgs)     // forward SSE stream
 *
 * Task-class semantics live in `./types.ts`. Override defaults via env:
 *   LLM_API_BASE / LLM_API_KEY               — gateway selection
 *   LLM_MODEL_{ROUTINE,ANALYTIC,REASONING}    — A/B a model in-place
 *
 * @module lib/llm
 */

export {
  chatComplete,
  streamChat,
  getChatModel,
  loadGatewayConfig,
  TASK_PROFILES,
  LlmCancelledError,
} from './router';
export type {
  ChatMessage,
  ChatCompletionResult,
  ModelOverrides,
} from './router';
export type { TaskClass, TaskProfile, LlmCallTelemetry } from './types';
