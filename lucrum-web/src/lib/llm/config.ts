/**
 * Centralized LLM gateway configuration.
 *
 * All Lucrum LLM calls funnel through `LLM_API_BASE` (Lurus newapi gateway,
 * https://newapi.lurus.cn/v1) using `LLM_API_KEY` (a `lucrum-router` token
 * provisioned in the newapi DB). Legacy env vars (`DEEPSEEK_API_BASE`,
 * `DEEPSEEK_API_KEY`, `LURUS_API_URL`, `LURUS_API_KEY`) remain readable as
 * fallbacks during the migration window — remove them after one stable
 * deploy.
 *
 * Why one gateway instead of direct DeepSeek: the newapi gateway provides
 * (1) per-token quota / kill-switch without code change,
 * (2) request log for observability,
 * (3) ability to swap upstream provider transparently (e.g. DeepSeek → Zhipu
 *     fallback) without redeploying lucrum.
 *
 * @module lib/llm/config
 */

import type { TaskClass, TaskProfile } from './types';

const DEFAULT_BASE = 'https://newapi.lurus.cn/v1';

export interface GatewayConfig {
  readonly baseURL: string;
  readonly apiKey: string;
  /** True if a real key is configured. Tests/dev may set false. */
  readonly hasKey: boolean;
}

export function loadGatewayConfig(): GatewayConfig {
  const baseURL =
    process.env.LLM_API_BASE ??
    process.env.DEEPSEEK_API_BASE ??
    process.env.LURUS_API_URL ??
    DEFAULT_BASE;
  const apiKey =
    process.env.LLM_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.LURUS_API_KEY ??
    '';
  return {
    baseURL: baseURL.endsWith('/v1') ? baseURL : `${baseURL.replace(/\/$/, '')}/v1`,
    apiKey,
    hasKey: apiKey.length > 0,
  };
}

/**
 * Task-class → profile registry. Override per env via
 *   LLM_MODEL_ROUTINE / LLM_MODEL_ANALYTIC / LLM_MODEL_REASONING
 * if you want to A/B a model without code change.
 *
 * Defaults pinned to DeepSeek family on Lurus newapi (April 2026):
 *   routine   → deepseek-chat       (alias to v4-flash *without* CoT —
 *                                    direct answer mode, fastest)
 *   analytic  → deepseek-v4-pro     (V4 with reasoning_content + content;
 *                                    needs generous max_tokens budget)
 *   reasoning → deepseek-reasoner   (R1-class CoT; very long reasoning_content)
 *
 * IMPORTANT: V4 and the reasoner emit `reasoning_content` *before* `content`.
 * Set max_tokens high enough that the visible answer still fits after the
 * model exhausts its CoT budget — otherwise `content` returns empty with
 * `finish_reason: "length"`. The router will fall back to `reasoning_content`
 * when `content` is empty (see router.ts) but that's a degraded UX since
 * reasoning text is typically internal monologue, not the user-facing answer.
 *
 * Fallback chain reasoning → analytic → routine: heavy model outage degrades
 * gracefully to a smarter-than-routine analytic, then to direct-answer chat.
 */
export const TASK_PROFILES: Readonly<Record<TaskClass, TaskProfile>> = {
  routine: {
    model: process.env.LLM_MODEL_ROUTINE ?? 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 1024,
    // routine = deepseek-chat (no CoT alias). A tiny budget just truncates
    // the answer; it doesn't trigger the empty-content trap. Pick a floor
    // generous enough for a usable short reply but not so high it wastes
    // budget on classification calls.
    minMaxTokens: 64,
    timeoutMs: 30_000,
  },
  analytic: {
    model: process.env.LLM_MODEL_ANALYTIC ?? 'deepseek-v4-pro',
    temperature: 0.5,
    // V4 burns several hundred tokens on reasoning_content; leave 4-6K for
    // the user-facing content after that.
    maxTokens: 8192,
    // Below this the V4 reasoning_content alone often consumes the whole
    // budget, leaving content empty. Documented in the llm-router skill;
    // now enforced here.
    minMaxTokens: 1024,
    timeoutMs: 90_000,
    fallback: 'routine',
  },
  reasoning: {
    model: process.env.LLM_MODEL_REASONING ?? 'deepseek-reasoner',
    // Reasoner ignores temperature internally; 0 documents intent.
    temperature: 0,
    // R1 routinely produces 4-8K of CoT before the final answer.
    maxTokens: 16384,
    // Same justification as analytic — and reasoner is even more CoT-heavy.
    minMaxTokens: 1024,
    timeoutMs: 240_000,
    fallback: 'analytic',
  },
};
