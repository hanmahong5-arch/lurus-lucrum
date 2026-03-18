/**
 * Tests for lib/comparison/metric-diff.ts
 *
 * Covers calculateMetricDiff() and COMPARISON_METRICS constant
 */
import { describe, it, expect } from 'vitest';
import { calculateMetricDiff, COMPARISON_METRICS } from '../metric-diff';
import type { MetricDefinition } from '../types';

// Helper: create a metric definition for testing
function makeMetric(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    key: 'testMetric',
    label: 'Test Metric',
    group: 'return',
    higherIsBetter: true,
    neutralThreshold: 0.001,
    format: 'percent',
    ...overrides,
  };
}

describe('COMPARISON_METRICS', () => {
  it('should define at least 10 metrics', () => {
    expect(COMPARISON_METRICS.length).toBeGreaterThanOrEqual(10);
  });

  it('should cover all metric groups', () => {
    const groups = new Set(COMPARISON_METRICS.map(m => m.group));
    expect(groups.has('return')).toBe(true);
    expect(groups.has('risk')).toBe(true);
    expect(groups.has('trading')).toBe(true);
  });

  it('should have unique keys', () => {
    const keys = COMPARISON_METRICS.map(m => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('calculateMetricDiff', () => {
  describe('higher-is-better metrics', () => {
    const metric = makeMetric({ higherIsBetter: true, neutralThreshold: 0.001 });

    it('should determine A wins when A > B', () => {
      const result = calculateMetricDiff(metric, 0.15, 0.10);
      expect(result.winner).toBe('a');
      expect(result.directionForA).toBe('better');
      expect(result.absoluteDiff).toBeCloseTo(0.05, 6);
    });

    it('should determine B wins when B > A', () => {
      const result = calculateMetricDiff(metric, 0.10, 0.15);
      expect(result.winner).toBe('b');
      expect(result.directionForA).toBe('worse');
      expect(result.absoluteDiff).toBeCloseTo(-0.05, 6);
    });

    it('should be tie when difference is within neutral threshold', () => {
      const result = calculateMetricDiff(metric, 0.1005, 0.1000);
      expect(result.winner).toBe('tie');
      expect(result.directionForA).toBe('neutral');
    });

    it('should be tie when values are exactly equal', () => {
      const result = calculateMetricDiff(metric, 0.10, 0.10);
      expect(result.winner).toBe('tie');
    });
  });

  describe('lower-is-better metrics', () => {
    const metric = makeMetric({ higherIsBetter: false, neutralThreshold: 0.001 });

    it('should determine A wins when A < B (lower is better)', () => {
      const result = calculateMetricDiff(metric, 0.05, 0.10);
      expect(result.winner).toBe('a');
      expect(result.directionForA).toBe('better');
    });

    it('should determine B wins when B < A', () => {
      const result = calculateMetricDiff(metric, 0.15, 0.10);
      expect(result.winner).toBe('b');
      expect(result.directionForA).toBe('worse');
    });

    it('should be tie when within threshold', () => {
      const result = calculateMetricDiff(metric, 0.1005, 0.1000);
      expect(result.winner).toBe('tie');
    });
  });

  describe('percent diff calculation', () => {
    const metric = makeMetric({ neutralThreshold: 0 });

    it('should calculate percentage difference relative to B', () => {
      const result = calculateMetricDiff(metric, 120, 100);
      expect(result.percentDiff).toBeCloseTo(20, 1);
    });

    it('should return null when B is zero (avoid division by zero)', () => {
      const result = calculateMetricDiff(metric, 10, 0);
      expect(result.percentDiff).toBeNull();
    });

    it('should handle negative base values', () => {
      const result = calculateMetricDiff(metric, -5, -10);
      // diff = -5 - (-10) = 5, |base| = 10, percentDiff = 50
      expect(result.percentDiff).toBeCloseTo(50, 1);
    });
  });

  describe('precision', () => {
    const metric = makeMetric({ neutralThreshold: 0 });

    it('should preserve financial precision', () => {
      const result = calculateMetricDiff(metric, 0.1, 0.2);
      // Decimal.js should give exact -0.1, not floating point error
      expect(result.absoluteDiff).toBe(-0.1);
    });

    it('should handle very small differences', () => {
      const result = calculateMetricDiff(metric, 0.000001, 0.000002);
      expect(result.absoluteDiff).toBeCloseTo(-0.000001, 6);
    });
  });

  describe('output shape', () => {
    it('should include all required fields', () => {
      const metric = makeMetric();
      const result = calculateMetricDiff(metric, 1, 2);
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('valueA');
      expect(result).toHaveProperty('valueB');
      expect(result).toHaveProperty('absoluteDiff');
      expect(result).toHaveProperty('percentDiff');
      expect(result).toHaveProperty('higherIsBetter');
      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('directionForA');
    });

    it('should propagate metric key and label', () => {
      const metric = makeMetric({ key: 'sharpeRatio', label: 'Sharpe' });
      const result = calculateMetricDiff(metric, 1, 2);
      expect(result.key).toBe('sharpeRatio');
      expect(result.label).toBe('Sharpe');
    });
  });
});
