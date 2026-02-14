/**
 * Tests for lib/comparison/winner-resolver.ts
 *
 * Covers resolveGroupWinner(), resolveCategoryWinners(), generateSummaryText()
 */
import { describe, it, expect } from 'vitest';
import {
  resolveGroupWinner,
  resolveCategoryWinners,
  generateSummaryText,
} from '../winner-resolver';
import type { MetricDiff, MetricGroup, ComparisonStrategyInfo } from '../types';

// Helper to create a MetricDiff with given winner
function makeDiff(
  key: string,
  winner: 'a' | 'b' | 'tie',
  overrides: Partial<MetricDiff> = {}
): MetricDiff {
  return {
    key,
    label: key,
    valueA: winner === 'a' ? 0.2 : 0.1,
    valueB: winner === 'b' ? 0.2 : 0.1,
    absoluteDiff: winner === 'a' ? 0.1 : winner === 'b' ? -0.1 : 0,
    percentDiff: winner === 'tie' ? 0 : 10,
    higherIsBetter: true,
    winner,
    directionForA: winner === 'a' ? 'better' : winner === 'b' ? 'worse' : 'neutral',
    ...overrides,
  };
}

// Helper to create MetricGroup
function makeGroup(
  key: 'return' | 'risk' | 'trading',
  winner: 'a' | 'b' | 'tie'
): MetricGroup {
  return {
    key,
    label: key,
    metrics: [makeDiff(`${key}_metric`, winner)],
    winner,
  };
}

// Helper to create strategy info
function makeStrategyInfo(name: string): ComparisonStrategyInfo {
  return {
    name,
    score: null,
    equityCurve: [],
  };
}

describe('resolveGroupWinner', () => {
  it('should return tie for empty metrics', () => {
    expect(resolveGroupWinner([])).toBe('tie');
  });

  it('should return A when A has more wins', () => {
    const metrics = [
      makeDiff('m1', 'a'),
      makeDiff('m2', 'a'),
      makeDiff('m3', 'b'),
    ];
    expect(resolveGroupWinner(metrics)).toBe('a');
  });

  it('should return B when B has more wins', () => {
    const metrics = [
      makeDiff('m1', 'b'),
      makeDiff('m2', 'b'),
      makeDiff('m3', 'a'),
    ];
    expect(resolveGroupWinner(metrics)).toBe('b');
  });

  it('should return tie when wins are equal', () => {
    const metrics = [
      makeDiff('m1', 'a'),
      makeDiff('m2', 'b'),
    ];
    expect(resolveGroupWinner(metrics)).toBe('tie');
  });

  it('should count ties as neither A nor B', () => {
    const metrics = [
      makeDiff('m1', 'a'),
      makeDiff('m2', 'tie'),
      makeDiff('m3', 'tie'),
    ];
    expect(resolveGroupWinner(metrics)).toBe('a');
  });

  it('should handle all ties', () => {
    const metrics = [
      makeDiff('m1', 'tie'),
      makeDiff('m2', 'tie'),
    ];
    expect(resolveGroupWinner(metrics)).toBe('tie');
  });
});

describe('resolveCategoryWinners', () => {
  it('should determine overall winner A when A wins most categories', () => {
    const groups = [
      makeGroup('return', 'a'),
      makeGroup('risk', 'a'),
      makeGroup('trading', 'b'),
    ];
    const result = resolveCategoryWinners(groups);
    expect(result.overall).toBe('a');
    expect(result.byReturn).toBe('a');
    expect(result.byRisk).toBe('a');
    expect(result.byTrading).toBe('b');
  });

  it('should determine overall winner B when B wins most categories', () => {
    const groups = [
      makeGroup('return', 'b'),
      makeGroup('risk', 'b'),
      makeGroup('trading', 'a'),
    ];
    const result = resolveCategoryWinners(groups);
    expect(result.overall).toBe('b');
  });

  it('should return tie when weighted scores cancel out', () => {
    // return(0.4) for A + risk(0.35) for B + trading(0.25) for B
    // 0.4 - 0.35 - 0.25 = -0.2 => B wins
    const groups = [
      makeGroup('return', 'a'),
      makeGroup('risk', 'b'),
      makeGroup('trading', 'b'),
    ];
    const result = resolveCategoryWinners(groups);
    expect(result.overall).toBe('b');
  });

  it('should handle missing groups gracefully', () => {
    const groups: MetricGroup[] = [];
    const result = resolveCategoryWinners(groups);
    expect(result.overall).toBe('tie');
    expect(result.byReturn).toBe('tie');
    expect(result.byRisk).toBe('tie');
    expect(result.byTrading).toBe('tie');
  });

  it('should handle all categories tied', () => {
    const groups = [
      makeGroup('return', 'tie'),
      makeGroup('risk', 'tie'),
      makeGroup('trading', 'tie'),
    ];
    const result = resolveCategoryWinners(groups);
    expect(result.overall).toBe('tie');
  });
});

describe('generateSummaryText', () => {
  const stratA = makeStrategyInfo('MACD Strategy');
  const stratB = makeStrategyInfo('RSI Strategy');

  it('should mention tie for equal strategies', () => {
    const winners = { byReturn: 'tie' as const, byRisk: 'tie' as const, byTrading: 'tie' as const, overall: 'tie' as const };
    const text = generateSummaryText(stratA, stratB, winners, []);
    expect(text).toContain('MACD Strategy');
    expect(text).toContain('RSI Strategy');
    expect(text).toContain('\u76F8\u8FD1'); // "similar" in Chinese
  });

  it('should name A as winner', () => {
    const winners = { byReturn: 'a' as const, byRisk: 'a' as const, byTrading: 'b' as const, overall: 'a' as const };
    const metrics = [
      makeDiff('totalReturn', 'a', { absoluteDiff: 0.1 }),
      makeDiff('maxDrawdown', 'tie'),
      makeDiff('sharpeRatio', 'a'),
    ];
    const text = generateSummaryText(stratA, stratB, winners, metrics);
    expect(text).toContain('MACD Strategy');
    expect(text).toContain('\u66F4\u4F18'); // "better" in Chinese
  });

  it('should name B as winner', () => {
    const winners = { byReturn: 'b' as const, byRisk: 'b' as const, byTrading: 'a' as const, overall: 'b' as const };
    const metrics = [
      makeDiff('totalReturn', 'b', { absoluteDiff: -0.05 }),
    ];
    const text = generateSummaryText(stratA, stratB, winners, metrics);
    expect(text).toContain('RSI Strategy');
    expect(text).toContain('\u66F4\u4F18');
  });

  it('should include advantage details when available', () => {
    const winners = { byReturn: 'a' as const, byRisk: 'a' as const, byTrading: 'a' as const, overall: 'a' as const };
    const metrics = [
      makeDiff('totalReturn', 'a', { absoluteDiff: 0.1 }),
      makeDiff('sharpeRatio', 'a', { absoluteDiff: 0.5 }),
    ];
    const text = generateSummaryText(stratA, stratB, winners, metrics);
    expect(text).toContain('\u6536\u76CA\u7387'); // "return rate"
    expect(text).toContain('\u590F\u666E\u6BD4\u7387'); // "Sharpe ratio"
  });
});
