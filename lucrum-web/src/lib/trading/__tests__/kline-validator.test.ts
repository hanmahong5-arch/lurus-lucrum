/**
 * Tests for lib/trading/kline-validator.ts
 *
 * Covers validateKLineData(), quickValidate(), getValidationSummary()
 */
import { describe, it, expect, vi } from 'vitest';
import { quickValidate, getValidationSummary, type ValidationResult } from '../kline-validator';

// We test quickValidate and getValidationSummary which don't depend on
// external time parsing modules.

// =============================================================================
// KLineData fixture helper
// =============================================================================

interface TestKLine {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function makeBar(time: number, overrides: Partial<TestKLine> = {}): TestKLine {
  return {
    time,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 1000,
    ...overrides,
  };
}

function makeValidBars(count: number, startTime: number = 1000000): TestKLine[] {
  return Array.from({ length: count }, (_, i) =>
    makeBar(startTime + i * 86400) // 1 day apart
  );
}

// =============================================================================
// quickValidate
// =============================================================================

describe('quickValidate', () => {
  it('should return true for valid data', () => {
    const data = makeValidBars(5);
    expect(quickValidate(data)).toBe(true);
  });

  it('should return false for empty data', () => {
    expect(quickValidate([])).toBe(false);
  });

  it('should return false when high < low', () => {
    const data = [makeBar(1000, { high: 5, low: 10 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false when high < open', () => {
    const data = [makeBar(1000, { open: 15, high: 12, low: 9, close: 11 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false when high < close', () => {
    const data = [makeBar(1000, { close: 15, high: 12, low: 9, open: 10 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false when low > open', () => {
    const data = [makeBar(1000, { open: 8, low: 9, high: 12, close: 11 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false when low > close', () => {
    const data = [makeBar(1000, { close: 8, low: 9, high: 12, open: 10 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false for non-positive prices', () => {
    const data = [makeBar(1000, { open: 0 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false for negative prices', () => {
    const data = [makeBar(1000, { close: -1 })];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false for out-of-order timestamps', () => {
    const data = [
      makeBar(2000),
      makeBar(1000), // Earlier time = invalid
    ];
    expect(quickValidate(data)).toBe(false);
  });

  it('should return false for duplicate timestamps', () => {
    const data = [
      makeBar(1000),
      makeBar(1000), // Same time = invalid (time <= prev.time)
    ];
    expect(quickValidate(data)).toBe(false);
  });

  it('should accept single bar', () => {
    const data = [makeBar(1000)];
    expect(quickValidate(data)).toBe(true);
  });

  it('should accept ascending timestamps', () => {
    const data = [
      makeBar(1000),
      makeBar(2000),
      makeBar(3000),
    ];
    expect(quickValidate(data)).toBe(true);
  });

  it('should accept OHLC where open=close (doji)', () => {
    const data = [makeBar(1000, { open: 10, high: 12, low: 9, close: 10 })];
    expect(quickValidate(data)).toBe(true);
  });

  it('should accept OHLC where all prices equal', () => {
    const data = [makeBar(1000, { open: 10, high: 10, low: 10, close: 10 })];
    expect(quickValidate(data)).toBe(true);
  });
});

// =============================================================================
// getValidationSummary
// =============================================================================

describe('getValidationSummary', () => {
  it('should return passed message for valid result', () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };
    const summary = getValidationSummary(result);
    expect(summary).toContain('passed');
  });

  it('should include warning count in passed message', () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [
        { type: 'SUSPICIOUS_PRICE', message: 'test', index: 0 },
        { type: 'TIME_GAP', message: 'test', index: 1 },
      ],
    };
    const summary = getValidationSummary(result);
    expect(summary).toContain('2 warnings');
  });

  it('should return failed message with error breakdown', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [
        { type: 'TIME_SEQUENCE', message: 'out of order', index: 1 },
        { type: 'TIME_SEQUENCE', message: 'out of order', index: 5 },
        { type: 'OHLC_RELATIONSHIP', message: 'invalid', index: 3 },
      ],
      warnings: [],
    };
    const summary = getValidationSummary(result);
    expect(summary).toContain('failed');
    expect(summary).toContain('TIME_SEQUENCE: 2');
    expect(summary).toContain('OHLC_RELATIONSHIP: 1');
  });

  it('should handle single error type', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [
        { type: 'INVALID_DATA', message: 'test' },
      ],
      warnings: [],
    };
    const summary = getValidationSummary(result);
    expect(summary).toContain('INVALID_DATA: 1');
  });
});
