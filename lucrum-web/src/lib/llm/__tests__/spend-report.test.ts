/**
 * Unit tests for the spend-report aggregation. The CLI wrapper is
 * (intentionally) thin and not covered here — pure logic only.
 */

import { describe, expect, it } from 'vitest';
import {
  aggregate,
  formatReport,
  parseTelemetryLine,
  percentile,
} from '../spend-report';
import type { LlmCallTelemetry } from '../types';

function ev(overrides: Partial<LlmCallTelemetry>): LlmCallTelemetry {
  return {
    taskClass: 'analytic',
    modelRequested: 'deepseek-v4-pro',
    modelActual: 'deepseek-v4-pro',
    latencyMs: 1000,
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    success: true,
    error: null,
    fallbackUsed: false,
    cancelled: false,
    maxTokensFloored: false,
    caller: null,
    ...overrides,
  };
}

describe('parseTelemetryLine', () => {
  it('parses a well-formed JSON telemetry line', () => {
    const line = JSON.stringify({
      kind: 'llm.call',
      ts: '2026-04-30T00:00:00Z',
      taskClass: 'analytic',
      modelRequested: 'deepseek-v4-pro',
      modelActual: 'deepseek-v4-pro',
      latencyMs: 1234,
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      success: true,
      error: null,
      fallbackUsed: false,
      cancelled: false,
      maxTokensFloored: false,
      caller: 'advisor.chat:diagnose',
    });
    const parsed = parseTelemetryLine(line);
    expect(parsed?.caller).toBe('advisor.chat:diagnose');
    expect(parsed?.totalTokens).toBe(12);
  });

  it('returns null for non-JSON lines (Next.js framework noise)', () => {
    expect(parseTelemetryLine('▲ Next.js 14.2.0')).toBeNull();
    expect(parseTelemetryLine('  ready - started server on...')).toBeNull();
    expect(parseTelemetryLine('')).toBeNull();
  });

  it('returns null for JSON with kind != "llm.call"', () => {
    const line = JSON.stringify({ kind: 'http.request', latencyMs: 50 });
    expect(parseTelemetryLine(line)).toBeNull();
  });

  it('returns null when required fields are missing/wrong-type', () => {
    expect(parseTelemetryLine(JSON.stringify({ kind: 'llm.call' }))).toBeNull();
    expect(
      parseTelemetryLine(
        JSON.stringify({
          kind: 'llm.call',
          taskClass: 'analytic',
          modelRequested: 'x',
          latencyMs: 'oops',
          success: true,
        }),
      ),
    ).toBeNull();
  });

  it('handles surrounding whitespace and indentation', () => {
    const line = '  ' + JSON.stringify(ev({ caller: 'x' }));
    // Note our parser only checks kind:'llm.call'; ev() doesn't include kind,
    // so we add it inline:
    const fullLine =
      '  ' +
      JSON.stringify({
        ...ev({ caller: 'x' }),
        kind: 'llm.call',
      });
    expect(parseTelemetryLine(line)).toBeNull(); // missing kind
    expect(parseTelemetryLine(fullLine)?.caller).toBe('x');
  });
});

describe('percentile', () => {
  it('returns 0 for empty input, single value for n=1', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([42], 0.95)).toBe(42);
  });

  it('matches expected interpolation for known cases', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.5)).toBeCloseTo(55, 5);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.95)).toBeCloseTo(95.5, 5);
  });
});

describe('aggregate — grouping & counts', () => {
  it('buckets by caller (default) and counts success/cancel/error', () => {
    const events = [
      ev({ caller: 'advisor.chat:diagnose', success: true, totalTokens: 100 }),
      ev({ caller: 'advisor.chat:diagnose', success: false, cancelled: true, totalTokens: null, error: null }),
      ev({ caller: 'advisor.chat:diagnose', success: false, error: 'boom', totalTokens: null }),
      ev({ caller: 'strategy.generate', success: true, totalTokens: 200 }),
    ];
    const r = aggregate(events);
    expect(r.totalEvents).toBe(4);
    expect(r.buckets.length).toBe(2);

    // Buckets are sorted by totalTokens desc — strategy.generate (200) first.
    expect(r.buckets[0]!.key).toBe('strategy.generate');
    expect(r.buckets[0]!.count).toBe(1);
    expect(r.buckets[0]!.successCount).toBe(1);
    expect(r.buckets[0]!.totalTokens).toBe(200);

    const advisor = r.buckets.find((b) => b.key === 'advisor.chat:diagnose')!;
    expect(advisor.count).toBe(3);
    expect(advisor.successCount).toBe(1);
    expect(advisor.cancelledCount).toBe(1);
    expect(advisor.erroredCount).toBe(1);
    expect(advisor.totalTokens).toBe(100);
  });

  it('substitutes <no-caller> for null callers', () => {
    const r = aggregate([ev({ caller: null }), ev({ caller: null })]);
    expect(r.buckets[0]!.key).toBe('<no-caller>');
    expect(r.buckets[0]!.count).toBe(2);
  });

  it('groupBy=taskClass collapses into three buckets', () => {
    const events = [
      ev({ taskClass: 'routine' }),
      ev({ taskClass: 'analytic' }),
      ev({ taskClass: 'analytic' }),
      ev({ taskClass: 'reasoning' }),
    ];
    const r = aggregate(events, { groupBy: 'taskClass' });
    expect(r.buckets.length).toBe(3);
    expect(r.buckets.find((b) => b.key === 'analytic')!.count).toBe(2);
  });

  it('groupBy=modelActual surfaces fallback flow', () => {
    const events = [
      ev({ modelRequested: 'deepseek-v4-pro', modelActual: 'deepseek-v4-pro' }),
      ev({ modelRequested: 'deepseek-v4-pro', modelActual: 'deepseek-chat', fallbackUsed: true }),
      ev({ modelRequested: 'deepseek-v4-pro', modelActual: 'deepseek-chat', fallbackUsed: true }),
    ];
    const r = aggregate(events, { groupBy: 'modelActual' });
    expect(r.buckets.find((b) => b.key === 'deepseek-chat')!.count).toBe(2);
    expect(r.buckets.find((b) => b.key === 'deepseek-chat')!.fallbackCount).toBe(2);
  });

  it('callerSubstring filter narrows to matching events', () => {
    const events = [
      ev({ caller: 'advisor.chat:quick' }),
      ev({ caller: 'advisor.debate:argument' }),
      ev({ caller: 'strategy.generate' }),
    ];
    const r = aggregate(events, { callerSubstring: 'advisor' });
    expect(r.totalEvents).toBe(2);
    expect(r.buckets.every((b) => b.key.startsWith('advisor.'))).toBe(true);
  });

  it('taskClassFilter narrows to allowlisted classes', () => {
    const events = [ev({ taskClass: 'routine' }), ev({ taskClass: 'analytic' })];
    const r = aggregate(events, { taskClassFilter: ['routine'] });
    expect(r.totalEvents).toBe(1);
  });
});

describe('aggregate — token + latency math', () => {
  it('totals tokens only across success:true events (failed calls have null usage)', () => {
    const events = [
      ev({ success: true, totalTokens: 100 }),
      ev({ success: true, totalTokens: 200 }),
      ev({ success: false, totalTokens: null, error: 'boom' }),
    ];
    const r = aggregate(events);
    expect(r.buckets[0]!.totalTokens).toBe(300);
    expect(r.buckets[0]!.avgTokens).toBe(150);
    expect(r.buckets[0]!.count).toBe(3);
    expect(r.buckets[0]!.successCount).toBe(2);
  });

  it('avgTokens is null when there are no successful events with usage', () => {
    const events = [ev({ success: false, totalTokens: null, error: 'x' })];
    const r = aggregate(events);
    expect(r.buckets[0]!.avgTokens).toBeNull();
  });

  it('p50 and p95 reflect bucket-local latency distribution', () => {
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const events = latencies.map((l) => ev({ latencyMs: l, totalTokens: 0 }));
    const r = aggregate(events);
    expect(r.buckets[0]!.p50LatencyMs).toBeGreaterThanOrEqual(500);
    expect(r.buckets[0]!.p50LatencyMs).toBeLessThanOrEqual(600);
    expect(r.buckets[0]!.p95LatencyMs).toBeGreaterThanOrEqual(950);
  });
});

describe('formatReport', () => {
  it('JSON mode round-trips through JSON.parse', () => {
    const r = aggregate([ev({ caller: 'x', totalTokens: 10 })]);
    const out = formatReport(r, { format: 'json' });
    expect(JSON.parse(out)).toMatchObject({
      groupBy: 'caller',
      totalEvents: 1,
    });
  });

  it('table mode includes all bucket keys + a TOTAL row', () => {
    const events = [
      ev({ caller: 'advisor.chat:diagnose', totalTokens: 100 }),
      ev({ caller: 'strategy.generate', totalTokens: 200 }),
    ];
    const r = aggregate(events);
    const out = formatReport(r, { format: 'table' });
    expect(out).toMatch(/advisor\.chat:diagnose/);
    expect(out).toMatch(/strategy\.generate/);
    expect(out).toMatch(/TOTAL/);
    expect(out).toMatch(/300/); // 100 + 200
  });

  it('table mode honors limit and shows truncation hint', () => {
    const events = Array.from({ length: 25 }, (_, i) => ev({ caller: `c${i}`, totalTokens: 100 - i }));
    const r = aggregate(events);
    const out = formatReport(r, { format: 'table', limit: 5 });
    expect(out).toMatch(/c0\b/); // top by tokens
    expect(out).toMatch(/c4\b/); // last visible
    expect(out).not.toMatch(/c10\b/); // beyond limit
    expect(out).toMatch(/20 more buckets/);
  });

  it('limit:null shows all buckets without truncation hint', () => {
    const events = Array.from({ length: 10 }, (_, i) => ev({ caller: `c${i}`, totalTokens: 1 }));
    const r = aggregate(events);
    const out = formatReport(r, { format: 'table', limit: null });
    expect(out).not.toMatch(/more buckets/);
    expect(out).toMatch(/c9/);
  });
});
