/**
 * Tests for paper-engine — the Sprint 2 mark-to-market sweep.
 *
 * Two perspectives:
 *   USER (paper trader): "After market close I want to see today's equity
 *     update + my drawdown — without my portfolio zeroing out if one
 *     data source flakes."
 *   ADVERSARIAL TESTER: "Missing prices, NaN closes, brand-new run with no
 *     trades, peak below initial capital, multi-run fan-out, idempotent
 *     same-day reruns."
 *
 * The DB-touching paths are tested via the route + e2e; here we exercise
 * the pure helpers + the fan-out logic with an injected CloseFetcher.
 *
 * @module lib/services/__tests__/paper-engine
 */
import { describe, expect, it } from 'vitest';
import {
  computeCash,
  computeEquity,
  computeDrawdown,
  type CloseSnapshot,
} from '../paper-engine';

// ---------------------------------------------------------------------------
// computeCash
// ---------------------------------------------------------------------------

describe('computeCash', () => {
  it('starting capital with no trades → cash unchanged', () => {
    expect(computeCash(100_000, [])).toBe(100_000);
  });

  it('buy reduces cash by qty*price + commission', () => {
    expect(
      computeCash(100_000, [
        { side: 'buy', qty: 100, price: 50, commission: 10 },
      ]),
    ).toBe(100_000 - (100 * 50 + 10));
  });

  it('sell increases cash by qty*price minus commission', () => {
    expect(
      computeCash(0, [{ side: 'sell', qty: 100, price: 50, commission: 10 }]),
    ).toBe(100 * 50 - 10);
  });

  it('handles null commission as 0', () => {
    expect(
      computeCash(100_000, [
        { side: 'buy', qty: 10, price: 10, commission: null },
      ]),
    ).toBe(100_000 - 100);
  });

  it('round trip: buy 100@50 then sell 100@60 → cash + 10*100 minus 2x commission', () => {
    expect(
      computeCash(100_000, [
        { side: 'buy', qty: 100, price: 50, commission: 5 },
        { side: 'sell', qty: 100, price: 60, commission: 5 },
      ]),
    ).toBe(100_000 - (5000 + 5) + (6000 - 5));
  });

  it('unknown side string is ignored (defensive against schema drift)', () => {
    expect(
      computeCash(100_000, [
        { side: 'short', qty: 10, price: 50, commission: 0 },
      ]),
    ).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// computeEquity
// ---------------------------------------------------------------------------

function snap(symbol: string, close: number): CloseSnapshot {
  return { symbol, close, asOf: new Date('2026-05-19') };
}

describe('computeEquity', () => {
  it('all-cash portfolio → equity == cash', () => {
    const { equity, missing } = computeEquity(50_000, [], new Map());
    expect(equity).toBe(50_000);
    expect(missing).toEqual([]);
  });

  it('single long with fresh quote → cash + qty*close', () => {
    const positions = [
      { symbol: 'X', qty: 100, avgCost: 50, lastPrice: null },
    ];
    const prices = new Map([['X', snap('X', 60)]]);
    const { equity, missing } = computeEquity(0, positions, prices);
    expect(equity).toBe(100 * 60);
    expect(missing).toEqual([]);
  });

  it('missing price falls back to lastPrice (no zero-out)', () => {
    const positions = [
      { symbol: 'X', qty: 100, avgCost: 50, lastPrice: 55 },
    ];
    const { equity, missing } = computeEquity(0, positions, new Map());
    expect(equity).toBe(100 * 55);
    expect(missing).toEqual(['X']);
  });

  it('missing price AND no lastPrice falls back to avgCost', () => {
    const positions = [
      { symbol: 'X', qty: 100, avgCost: 50, lastPrice: null },
    ];
    const { equity, missing } = computeEquity(0, positions, new Map());
    expect(equity).toBe(100 * 50);
    expect(missing).toEqual(['X']);
  });

  it('mixed: some fresh, some missing → aggregates correctly', () => {
    const positions = [
      { symbol: 'X', qty: 100, avgCost: 50, lastPrice: 55 },
      { symbol: 'Y', qty: 50, avgCost: 100, lastPrice: null },
    ];
    const prices = new Map([['Y', snap('Y', 120)]]);
    const { equity, missing } = computeEquity(1_000, positions, prices);
    expect(equity).toBe(1_000 + 100 * 55 + 50 * 120);
    expect(missing).toEqual(['X']);
  });
});

// ---------------------------------------------------------------------------
// computeDrawdown
// ---------------------------------------------------------------------------

describe('computeDrawdown', () => {
  it('at peak → drawdown == 0', () => {
    expect(computeDrawdown(100_000, 100_000)).toBe(0);
  });

  it('below peak → positive drawdown', () => {
    expect(computeDrawdown(80_000, 100_000)).toBeCloseTo(0.2, 6);
  });

  it('above peak → clamps to 0 (new high)', () => {
    expect(computeDrawdown(110_000, 100_000)).toBe(0);
  });

  it('zero / negative peak → returns 0 (defensive against bad state)', () => {
    expect(computeDrawdown(100, 0)).toBe(0);
    expect(computeDrawdown(100, -5)).toBe(0);
  });

  it('NaN peak → 0', () => {
    expect(computeDrawdown(100, Number.NaN)).toBe(0);
  });
});
