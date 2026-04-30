/**
 * Unit tests for `RouterAwareChatOpenAI` — the LangChain ChatOpenAI subclass
 * that emits router telemetry and honors the cancellation contract.
 *
 * We stub `ChatOpenAI.prototype._generate` so the test never touches the
 * network or the openai SDK. `super._generate(...)` in the subclass resolves
 * through the prototype chain, so the spy fires.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

beforeEach(() => {
  process.env.LLM_API_BASE = 'https://newapi.test/v1';
  process.env.LLM_API_KEY = 'test-key';
});

const okResult = (): ChatResult => ({
  generations: [{ text: 'ok', message: new AIMessage('ok') }],
  llmOutput: { tokenUsage: { promptTokens: 11, completionTokens: 22, totalTokens: 33 } },
});

async function loadRouter() {
  return await import('../router');
}

interface TelemetryLine {
  kind?: string;
  taskClass?: string;
  modelRequested?: string;
  modelActual?: string | null;
  caller?: string | null;
  cancelled?: boolean;
  success?: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  fallbackUsed?: boolean;
  maxTokensFloored?: boolean;
  error?: string | null;
}

function lastTelemetry(logSpy: ReturnType<typeof vi.spyOn>): TelemetryLine {
  // Find the last call whose first arg parses as JSON with kind:'llm.call'.
  for (let i = logSpy.mock.calls.length - 1; i >= 0; i -= 1) {
    const arg = logSpy.mock.calls[i]?.[0];
    if (typeof arg !== 'string') continue;
    try {
      const parsed = JSON.parse(arg) as TelemetryLine;
      if (parsed.kind === 'llm.call') return parsed;
    } catch {
      /* not JSON — skip */
    }
  }
  throw new Error('no telemetry line captured');
}

describe('getChatModel construction', () => {
  it('returns an instance of RouterAwareChatOpenAI (and ChatOpenAI)', async () => {
    const { getChatModel } = await loadRouter();
    const { RouterAwareChatOpenAI } = await import('../router-aware-chat-model');
    const llm = getChatModel('analytic');
    expect(llm).toBeInstanceOf(RouterAwareChatOpenAI);
    expect(llm).toBeInstanceOf(ChatOpenAI);
  });

  it('stamps sticky taskClass / caller / maxTokensFloored on the instance', async () => {
    const { getChatModel } = await loadRouter();
    const { RouterAwareChatOpenAI } = await import('../router-aware-chat-model');
    const llm = getChatModel('analytic', { caller: 'advisor.graph:trader' }) as InstanceType<typeof RouterAwareChatOpenAI>;
    expect(llm.routerTaskClass).toBe('analytic');
    expect(llm.routerCaller).toBe('advisor.graph:trader');
    expect(llm.routerMaxTokensFloored).toBe(false);
  });

  it('marks maxTokensFloored:true when override is below the floor', async () => {
    // analytic floor is 1024; set 100 → must be floored.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getChatModel } = await loadRouter();
    const { RouterAwareChatOpenAI } = await import('../router-aware-chat-model');
    const llm = getChatModel('analytic', { maxTokens: 100 }) as InstanceType<typeof RouterAwareChatOpenAI>;
    expect(llm.routerMaxTokensFloored).toBe(true);
  });
});

describe('RouterAwareChatOpenAI._generate telemetry', () => {
  it('emits success telemetry with token usage and caller', async () => {
    vi.spyOn(ChatOpenAI.prototype, '_generate').mockResolvedValue(okResult());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel } = await loadRouter();
    const llm = getChatModel('analytic', { caller: 'agent.backtest:parseIntent' });
    await llm.invoke([new HumanMessage('q')]);

    const t = lastTelemetry(logSpy);
    expect(t.success).toBe(true);
    expect(t.cancelled).toBe(false);
    expect(t.taskClass).toBe('analytic');
    expect(t.caller).toBe('agent.backtest:parseIntent');
    expect(t.promptTokens).toBe(11);
    expect(t.completionTokens).toBe(22);
    expect(t.totalTokens).toBe(33);
    expect(t.fallbackUsed).toBe(false);
  });

  it('emits caller=null when caller not supplied', async () => {
    vi.spyOn(ChatOpenAI.prototype, '_generate').mockResolvedValue(okResult());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel } = await loadRouter();
    const llm = getChatModel('routine');
    await llm.invoke([new HumanMessage('q')]);

    const t = lastTelemetry(logSpy);
    expect(t.caller).toBeNull();
  });

  it('emits failure telemetry with error string when super throws', async () => {
    vi.spyOn(ChatOpenAI.prototype, '_generate').mockRejectedValue(new Error('upstream 500'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel } = await loadRouter();
    const llm = getChatModel('routine');
    await expect(llm.invoke([new HumanMessage('q')])).rejects.toThrow(/upstream 500/);

    const t = lastTelemetry(logSpy);
    expect(t.success).toBe(false);
    expect(t.cancelled).toBe(false);
    expect(t.error).toMatch(/upstream 500/);
  });

  it('marks maxTokensFloored:true on telemetry when override was sub-floor', async () => {
    vi.spyOn(ChatOpenAI.prototype, '_generate').mockResolvedValue(okResult());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel } = await loadRouter();
    const llm = getChatModel('analytic', { maxTokens: 50 }); // under analytic floor (1024)
    await llm.invoke([new HumanMessage('q')]);

    const t = lastTelemetry(logSpy);
    expect(t.maxTokensFloored).toBe(true);
  });
});

describe('RouterAwareChatOpenAI cancellation contract', () => {
  it('throws LlmCancelledError before calling super when signal is pre-aborted', async () => {
    const superSpy = vi.spyOn(ChatOpenAI.prototype, '_generate').mockResolvedValue(okResult());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel, LlmCancelledError } = await loadRouter();
    const llm = getChatModel('analytic', { caller: 'test:precancel' });
    const ctrl = new AbortController();
    ctrl.abort();

    await expect(
      llm.invoke([new HumanMessage('q')], { signal: ctrl.signal }),
    ).rejects.toBeInstanceOf(LlmCancelledError);

    expect(superSpy).not.toHaveBeenCalled();
    const t = lastTelemetry(logSpy);
    expect(t.cancelled).toBe(true);
    expect(t.success).toBe(false);
    expect(t.error).toBeNull();
    expect(t.caller).toBe('test:precancel');
  });

  it('translates mid-flight AbortError into LlmCancelledError + cancelled telemetry', async () => {
    // Simulate the underlying openai SDK reacting to options.signal aborting:
    // it rejects with an AbortError-shaped exception.
    vi.spyOn(ChatOpenAI.prototype, '_generate').mockImplementation(async (_msgs, options) => {
      const sig = (options as { signal?: AbortSignal }).signal;
      return await new Promise((_, reject) => {
        sig?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel, LlmCancelledError } = await loadRouter();
    const llm = getChatModel('analytic');
    const ctrl = new AbortController();
    const promise = llm.invoke([new HumanMessage('q')], { signal: ctrl.signal });
    queueMicrotask(() => ctrl.abort());

    await expect(promise).rejects.toBeInstanceOf(LlmCancelledError);
    const t = lastTelemetry(logSpy);
    expect(t.cancelled).toBe(true);
    expect(t.success).toBe(false);
  });

  it('does NOT mark cancelled for an unrelated upstream timeout', async () => {
    // `signal` never aborts here; super throws a generic timeout-shaped error.
    vi.spyOn(ChatOpenAI.prototype, '_generate').mockRejectedValue(
      Object.assign(new Error('Request timed out after 60000ms'), { code: 'ETIMEDOUT' }),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { getChatModel, LlmCancelledError } = await loadRouter();
    const llm = getChatModel('analytic');
    const err: unknown = await llm.invoke([new HumanMessage('q')]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(LlmCancelledError);

    const t = lastTelemetry(logSpy);
    expect(t.cancelled).toBe(false);
    expect(t.success).toBe(false);
    expect(t.error).toMatch(/timed out/);
  });
});
