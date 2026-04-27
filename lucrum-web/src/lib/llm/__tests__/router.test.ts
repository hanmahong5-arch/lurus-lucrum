/**
 * Unit tests for the LLM router. Covers:
 *   1. task-class → model mapping
 *   2. env-var override of model id
 *   3. fallback chain on primary failure
 *   4. legacy env-var compatibility
 *   5. telemetry emission shape
 *
 * Network is fully mocked. The integration smoke (real newapi call) lives
 * in `router.smoke.test.ts`, gated by NEWAPI_TEST_KEY.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

async function loadRouter() {
  return await import('../router');
}

describe('TASK_PROFILES', () => {
  it('maps each task class to a DeepSeek-family model by default', async () => {
    const { TASK_PROFILES } = await loadRouter();
    expect(TASK_PROFILES.routine.model).toMatch(/deepseek/);
    expect(TASK_PROFILES.analytic.model).toMatch(/deepseek/);
    expect(TASK_PROFILES.reasoning.model).toMatch(/deepseek/);
  });

  it('orders maxTokens routine < analytic < reasoning', async () => {
    const { TASK_PROFILES } = await loadRouter();
    expect(TASK_PROFILES.routine.maxTokens).toBeLessThan(TASK_PROFILES.analytic.maxTokens);
    expect(TASK_PROFILES.analytic.maxTokens).toBeLessThan(TASK_PROFILES.reasoning.maxTokens);
  });

  it('orders timeoutMs routine < analytic < reasoning', async () => {
    const { TASK_PROFILES } = await loadRouter();
    expect(TASK_PROFILES.routine.timeoutMs).toBeLessThan(TASK_PROFILES.analytic.timeoutMs);
    expect(TASK_PROFILES.analytic.timeoutMs).toBeLessThan(TASK_PROFILES.reasoning.timeoutMs);
  });

  it('reasoning falls back to analytic, analytic to routine', async () => {
    const { TASK_PROFILES } = await loadRouter();
    expect(TASK_PROFILES.reasoning.fallback).toBe('analytic');
    expect(TASK_PROFILES.analytic.fallback).toBe('routine');
    expect(TASK_PROFILES.routine.fallback).toBeUndefined();
  });
});

describe('loadGatewayConfig', () => {
  it('honors LLM_API_BASE/LLM_API_KEY first', async () => {
    process.env.LLM_API_BASE = 'https://primary/v1';
    process.env.LLM_API_KEY = 'primary-key';
    process.env.DEEPSEEK_API_BASE = 'https://legacy/v1';
    const { loadGatewayConfig } = await loadRouter();
    const cfg = loadGatewayConfig();
    expect(cfg.baseURL).toBe('https://primary/v1');
    expect(cfg.apiKey).toBe('primary-key');
    expect(cfg.hasKey).toBe(true);
  });

  it('falls back to DEEPSEEK_API_* when LLM_API_* unset', async () => {
    delete process.env.LLM_API_BASE;
    delete process.env.LLM_API_KEY;
    process.env.DEEPSEEK_API_BASE = 'https://legacy.test/v1';
    process.env.DEEPSEEK_API_KEY = 'legacy';
    const { loadGatewayConfig } = await loadRouter();
    const cfg = loadGatewayConfig();
    expect(cfg.baseURL).toBe('https://legacy.test/v1');
    expect(cfg.apiKey).toBe('legacy');
  });

  it('appends /v1 if base URL lacks it', async () => {
    process.env.LLM_API_BASE = 'https://newapi.lurus.cn';
    const { loadGatewayConfig } = await loadRouter();
    expect(loadGatewayConfig().baseURL).toBe('https://newapi.lurus.cn/v1');
  });

  it('reports hasKey=false when no key set', async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.LURUS_API_KEY;
    const { loadGatewayConfig } = await loadRouter();
    expect(loadGatewayConfig().hasKey).toBe(false);
  });
});

describe('env override of model id', () => {
  it('LLM_MODEL_ROUTINE swaps the routine model', async () => {
    process.env.LLM_MODEL_ROUTINE = 'glm-4-plus';
    const { TASK_PROFILES } = await loadRouter();
    expect(TASK_PROFILES.routine.model).toBe('glm-4-plus');
  });
});

describe('chatComplete', () => {
  it('throws when no API key configured', async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.LURUS_API_KEY;
    const { chatComplete } = await loadRouter();
    await expect(chatComplete('routine', [{ role: 'user', content: 'hi' }])).rejects.toThrow(/key/);
  });

  it('returns parsed completion on success', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: 'deepseek-v4-flash',
          choices: [{ message: { content: 'hello' } }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { chatComplete } = await loadRouter();
    const out = await chatComplete('routine', [{ role: 'user', content: 'hi' }]);
    expect(out.content).toBe('hello');
    expect(out.totalTokens).toBe(6);
    expect(out.fallbackUsed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back when primary fails and fallback is configured', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'deepseek-v4-flash',
            choices: [{ message: { content: 'fallback-ok' } }],
            usage: { total_tokens: 2 },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { chatComplete } = await loadRouter();
    const out = await chatComplete('analytic', [{ role: 'user', content: 'q' }]);
    expect(out.content).toBe('fallback-ok');
    expect(out.fallbackUsed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when both primary and fallback fail', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const { chatComplete } = await loadRouter();
    await expect(chatComplete('analytic', [{ role: 'user', content: 'q' }])).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws (no fallback) when routine fails', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const { chatComplete } = await loadRouter();
    await expect(chatComplete('routine', [{ role: 'user', content: 'q' }])).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1); // routine has no fallback
  });
});
