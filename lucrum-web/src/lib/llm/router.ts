/**
 * LLM router — single source of truth for model selection.
 *
 * Two consumers:
 *   1. LangChain agents call `getChatModel(taskClass, overrides?)` → ChatOpenAI
 *   2. Raw fetch sites call `chatComplete(taskClass, messages, overrides?)`
 *      → returns a normalized completion plus usage metadata.
 *
 * Both paths emit telemetry and apply the same fallback chain. New code
 * SHOULD prefer one of these helpers — direct construction of `ChatOpenAI`
 * or hand-rolled `fetch` against a hard-coded URL is a regression.
 *
 * @module lib/llm/router
 */

import { ChatOpenAI } from '@langchain/openai';
import { loadGatewayConfig, TASK_PROFILES } from './config';
import { makeTelemetryRecorder } from './observability';
import type { TaskClass, TaskProfile } from './types';

export interface ModelOverrides {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly streaming?: boolean;
}

function resolveProfile(taskClass: TaskClass, overrides?: ModelOverrides): TaskProfile {
  const base = TASK_PROFILES[taskClass];
  if (!overrides) return base;
  return {
    ...base,
    temperature: overrides.temperature ?? base.temperature,
    maxTokens: overrides.maxTokens ?? base.maxTokens,
  };
}

/**
 * Build a LangChain ChatOpenAI bound to the Lurus newapi gateway with the
 * task-class profile applied. Used by LangGraph agents (backtest, scanner,
 * advisor-graph, custom-agent).
 */
export function getChatModel(
  taskClass: TaskClass,
  overrides?: ModelOverrides & { streaming?: boolean },
): ChatOpenAI {
  const cfg = loadGatewayConfig();
  const profile = resolveProfile(taskClass, overrides);
  return new ChatOpenAI({
    model: profile.model,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
    streaming: overrides?.streaming ?? false,
    timeout: profile.timeoutMs,
    configuration: {
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey,
    },
    apiKey: cfg.apiKey,
  });
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatCompletionResult {
  readonly content: string;
  readonly model: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly totalTokens: number | null;
  readonly fallbackUsed: boolean;
}

interface OpenAIChatResponse {
  readonly model?: string;
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string;
      // DeepSeek V4 / reasoner emit chain-of-thought separately from the
      // final answer. Surface it as a fallback when `content` is empty due
      // to token-budget exhaustion (`finish_reason: "length"`).
      readonly reasoning_content?: string;
    };
    readonly finish_reason?: string;
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly error?: { readonly message?: string };
}

/**
 * Extract the user-visible answer. DeepSeek V4 / reasoner sometimes return
 * empty `content` if max_tokens is too small (the budget is exhausted by
 * `reasoning_content`). When that happens we degrade to reasoning_content so
 * the user gets *something* — better than a blank reply — even though it's
 * usually internal monologue rather than a polished answer.
 */
function extractContent(choice: NonNullable<OpenAIChatResponse['choices']>[number] | undefined): string {
  const msg = choice?.message;
  if (!msg) return '';
  if (msg.content && msg.content.length > 0) return msg.content;
  if (msg.reasoning_content && msg.reasoning_content.length > 0) {
    return msg.reasoning_content;
  }
  return '';
}

async function postChat(
  baseURL: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<OpenAIChatResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`gateway ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as OpenAIChatResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Non-streaming chat completion with task-class routing + fallback.
 * Throws if both primary and fallback fail.
 */
export async function chatComplete(
  taskClass: TaskClass,
  messages: ReadonlyArray<ChatMessage>,
  overrides?: ModelOverrides,
): Promise<ChatCompletionResult> {
  const cfg = loadGatewayConfig();
  if (!cfg.hasKey) {
    throw new Error('LLM gateway key not configured (set LLM_API_KEY)');
  }
  const profile = resolveProfile(taskClass, overrides);
  const tel = makeTelemetryRecorder(taskClass, profile.model);

  const attempt = async (model: string, timeoutMs: number) =>
    postChat(
      cfg.baseURL,
      cfg.apiKey,
      {
        model,
        messages,
        temperature: profile.temperature,
        max_tokens: profile.maxTokens,
        stream: false,
      },
      timeoutMs,
    );

  try {
    const data = await attempt(profile.model, profile.timeoutMs);
    const content = extractContent(data.choices?.[0]);
    tel.record({
      modelActual: data.model ?? profile.model,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
      success: true,
    });
    return {
      content,
      model: data.model ?? profile.model,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
      fallbackUsed: false,
    };
  } catch (primaryErr) {
    if (!profile.fallback) {
      tel.record({ success: false, error: String(primaryErr) });
      throw primaryErr;
    }
    tel.markFallback();
    const fb = TASK_PROFILES[profile.fallback];
    try {
      const data = await attempt(fb.model, fb.timeoutMs);
      const content = extractContent(data.choices?.[0]);
      tel.record({
        modelActual: data.model ?? fb.model,
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
        success: true,
      });
      return {
        content,
        model: data.model ?? fb.model,
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
        fallbackUsed: true,
      };
    } catch (fbErr) {
      tel.record({ success: false, error: `primary=${primaryErr}; fallback=${fbErr}` });
      throw fbErr;
    }
  }
}

/**
 * Streaming chat — pipes the OpenAI SSE response straight back. The router
 * does not parse the body so callers can stream-forward to the client. Adds
 * task-class to the URL as a query string for log correlation only (newapi
 * ignores unknown query strings).
 */
export async function streamChat(
  taskClass: TaskClass,
  messages: ReadonlyArray<ChatMessage>,
  overrides?: ModelOverrides,
): Promise<Response> {
  const cfg = loadGatewayConfig();
  if (!cfg.hasKey) {
    throw new Error('LLM gateway key not configured (set LLM_API_KEY)');
  }
  const profile = resolveProfile(taskClass, overrides);
  // No wall-clock abort for streams — reasoning replies can legitimately run
  // for minutes. Newapi enforces its own STREAMING_TIMEOUT (300s) upstream,
  // and the client's fetch will surface idle disconnects via res.body.
  return fetch(`${cfg.baseURL}/chat/completions?lucrum_task=${taskClass}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: profile.model,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      stream: true,
    }),
  });
}

export { loadGatewayConfig, TASK_PROFILES };
export type { TaskClass };
