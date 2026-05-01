/**
 * Tests for `nats-publisher.ts`.
 *
 * Strategy: mock the `nats` package at module level so we can drive
 * connect / publish behavior without a real broker. The publisher's
 * public surface is the helper functions; we assert envelope shape,
 * routing, gating, and failure containment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// `nats` module mock — lives at the top so it's hoisted before SUT import.
// ---------------------------------------------------------------------------

const publishMock = vi.fn(async (_subj: string, _data: Uint8Array) => ({ seq: 1 }));
const closeMock = vi.fn(async () => undefined);
const drainMock = vi.fn(async () => undefined);
const connectMock = vi.fn();

vi.mock('nats', () => {
  // Async iterator that immediately ends (no status events emitted).
  const statusIter = {
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true, value: undefined }),
      };
    },
  };
  return {
    connect: (...args: unknown[]) => connectMock(...args),
    JSONCodec: <T,>() => ({
      encode: (v: T) => new TextEncoder().encode(JSON.stringify(v)),
      decode: (d: Uint8Array) => JSON.parse(new TextDecoder().decode(d)) as T,
    }),
    // Type re-exports — runtime no-ops.
    Codec: undefined,
    JetStreamClient: undefined,
    NatsConnection: undefined,
  };
});

function defaultConnectImpl() {
  return Promise.resolve({
    jetstream: () => ({ publish: publishMock }),
    status: () => ({
      [Symbol.asyncIterator]() {
        return { next: async () => ({ done: true, value: undefined }) };
      },
    }),
    close: closeMock,
    drain: drainMock,
  });
}

// ---------------------------------------------------------------------------
// Helpers to import + reset SUT cleanly per test.
// ---------------------------------------------------------------------------

async function loadFreshModule(env: Record<string, string | undefined>) {
  // Apply env BEFORE first import (singleton snapshots NATS_URL on first call).
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  return import('../nats-publisher');
}

function decodePublished(): unknown {
  expect(publishMock).toHaveBeenCalled();
  const calls = publishMock.mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error('no publish calls recorded');
  const data = last[1];
  return JSON.parse(new TextDecoder().decode(data));
}

async function flushQueue(): Promise<void> {
  // Two ticks: one for the worker microtask, one for connect promise resolution,
  // plus a couple more for the publish ack microtask chain.
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('nats-publisher', () => {
  beforeEach(() => {
    publishMock.mockReset();
    publishMock.mockResolvedValue({ seq: 1 });
    closeMock.mockReset();
    drainMock.mockReset();
    connectMock.mockReset();
    connectMock.mockImplementation(defaultConnectImpl);
  });

  afterEach(async () => {
    // Best-effort teardown so cross-test state doesn't leak. Each test reloads
    // the module fresh anyway via loadFreshModule.
    delete process.env.NATS_URL;
  });

  it('is a no-op when NATS_URL is unset', async () => {
    const mod = await loadFreshModule({ NATS_URL: undefined });
    mod.publishAdvisorOutput({
      userId: 'u-1',
      accountId: 42,
      advisorId: 'buffett',
      advisorName: 'Buffett',
      symbol: '600519',
      summary: 'hold',
    });
    await flushQueue();
    expect(connectMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('publishAdvisorOutput emits envelope matching consumer LucrumEvent shape', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    mod.publishAdvisorOutput({
      userId: 'u-zitadel-sub',
      accountId: 42,
      advisorId: 'buffett',
      advisorName: 'Buffett',
      symbol: '600519',
      summary: 'maintain position; quality moat intact',
    });
    await flushQueue();

    const env = decodePublished() as Record<string, unknown>;
    expect(env.event_type).toBe('lucrum.advisor.output');
    expect(env.user_id).toBe('u-zitadel-sub');
    expect(env.account_id).toBe(42);
    expect(typeof env.event_id).toBe('string');
    expect((env.event_id as string).length).toBeGreaterThan(0);
    expect(typeof env.occurred_at).toBe('string');
    expect(() => new Date(env.occurred_at as string).toISOString()).not.toThrow();

    const payload = env.payload as Record<string, unknown>;
    expect(payload.advisor_id).toBe('buffett');
    expect(payload.advisor_name).toBe('Buffett');
    expect(payload.symbol).toBe('600519');
    expect(payload.summary).toBe('maintain position; quality moat intact');

    // Subject routing
    const calls = publishMock.mock.calls;
    expect(calls[0]?.[0]).toBe('lucrum.advisor.output');
  });

  it('truncates summary at 200 chars', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    const longSummary = 'x'.repeat(500);
    mod.publishAdvisorOutput({
      userId: 'u-1',
      accountId: 42,
      advisorId: 'buffett',
      advisorName: 'Buffett',
      symbol: '600519',
      summary: longSummary,
    });
    await flushQueue();

    const env = decodePublished() as { payload: { summary: string } };
    expect(env.payload.summary.length).toBe(200);
  });

  it('drops when accountId is 0 / negative / NaN', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    for (const accountId of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      mod.publishAdvisorOutput({
        userId: 'u-1',
        accountId,
        advisorId: 'buffett',
        advisorName: 'Buffett',
        symbol: '600519',
        summary: 'x',
      });
      mod.publishMarketEvent({
        userId: 'u-1',
        accountId,
        symbol: '600519',
        headline: 'stop loss',
        severity: 'critical',
      });
    }
    await flushQueue();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('publishMarketEvent only fires on warning / critical severity', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    mod.publishMarketEvent({
      userId: 'u-1',
      accountId: 42,
      symbol: '600519',
      headline: 'tick update',
      severity: 'info',
    });
    await flushQueue();
    expect(publishMock).not.toHaveBeenCalled();

    mod.publishMarketEvent({
      userId: 'u-1',
      accountId: 42,
      symbol: '600519',
      headline: 'stop loss triggered at 1620',
      severity: 'critical',
    });
    await flushQueue();
    expect(publishMock).toHaveBeenCalledTimes(1);

    const env = decodePublished() as { event_type: string; payload: Record<string, unknown> };
    expect(env.event_type).toBe('lucrum.market.event');
    expect(env.payload.symbol).toBe('600519');
    expect(env.payload.severity).toBe('critical');
    expect(env.payload.headline).toBe('stop loss triggered at 1620');
  });

  it('swallows publish failure without throwing to caller', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    publishMock.mockRejectedValue(new Error('ack timeout'));

    expect(() =>
      mod.publishAdvisorOutput({
        userId: 'u-1',
        accountId: 42,
        advisorId: 'buffett',
        advisorName: 'Buffett',
        symbol: '600519',
        summary: 'x',
      }),
    ).not.toThrow();

    // Allow worker + retries (3 attempts × backoff). Backoffs use real timers
    // since vitest fakeTimers config doesn't fake await sleep here. Wait
    // generously to let retries complete.
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    // 1 + retries(2) = 3 attempts total
    expect(publishMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('swallows connect failure without throwing to caller', async () => {
    connectMock.mockRejectedValueOnce(new Error('econnrefused'));
    const mod = await loadFreshModule({ NATS_URL: 'nats://unreachable:4222' });

    expect(() =>
      mod.publishAdvisorOutput({
        userId: 'u-1',
        accountId: 42,
        advisorId: 'buffett',
        advisorName: 'Buffett',
        symbol: '600519',
        summary: 'x',
      }),
    ).not.toThrow();

    await flushQueue();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('drops advisor output when symbol is empty', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    mod.publishAdvisorOutput({
      userId: 'u-1',
      accountId: 42,
      advisorId: 'buffett',
      advisorName: 'Buffett',
      symbol: '',
      summary: 'general advice',
    });
    await flushQueue();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('publishes both advisor.output and market.event in order', async () => {
    const mod = await loadFreshModule({ NATS_URL: 'nats://test:4222' });
    mod.publishAdvisorOutput({
      userId: 'u-1',
      accountId: 42,
      advisorId: 'buffett',
      advisorName: 'Buffett',
      symbol: '600519',
      summary: 'hold',
    });
    mod.publishMarketEvent({
      userId: 'u-1',
      accountId: 42,
      symbol: '600519',
      headline: 'target hit',
      severity: 'warning',
    });
    await flushQueue();

    expect(publishMock).toHaveBeenCalledTimes(2);
    expect(publishMock.mock.calls[0]?.[0]).toBe('lucrum.advisor.output');
    expect(publishMock.mock.calls[1]?.[0]).toBe('lucrum.market.event');
  });
});
