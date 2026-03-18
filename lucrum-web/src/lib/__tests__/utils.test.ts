/**
 * Tests for lib/utils.ts
 *
 * Covers cn(), formatPnL(), formatCurrency() utility functions
 */
import { describe, it, expect } from 'vitest';
import { cn, formatPnL, formatCurrency } from '../utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('should merge tailwind classes correctly', () => {
    // twMerge deduplicates conflicting tailwind utilities
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
    expect(cn(undefined, null, false)).toBe('');
  });

  it('should handle array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle object inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });
});

describe('formatPnL', () => {
  it('should format positive values with + sign and profit class', () => {
    const result = formatPnL(32.5);
    expect(result.text).toBe('+32.50%');
    expect(result.className).toBe('text-profit');
  });

  it('should format negative values with - sign and loss class', () => {
    const result = formatPnL(-15.3);
    expect(result.text).toBe('-15.30%');
    expect(result.className).toBe('text-loss');
  });

  it('should format zero as positive with + sign', () => {
    const result = formatPnL(0);
    expect(result.text).toBe('+0.00%');
    expect(result.className).toBe('text-profit');
  });

  it('should handle very small positive values', () => {
    const result = formatPnL(0.001);
    expect(result.text).toBe('+0.00%');
    expect(result.className).toBe('text-profit');
  });

  it('should handle large numbers', () => {
    const result = formatPnL(999.99);
    expect(result.text).toBe('+999.99%');
    expect(result.className).toBe('text-profit');
  });

  it('should format to 2 decimal places', () => {
    const result = formatPnL(12.345);
    expect(result.text).toBe('+12.35%');
  });
});

describe('formatCurrency', () => {
  it('should format CNY by default', () => {
    const result = formatCurrency(1234.56);
    // Intl.NumberFormat zh-CN CNY format
    expect(result).toContain('1,234.56');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0.00');
  });

  it('should format negative values', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500.00');
  });

  it('should format with custom currency', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100.00');
  });

  it('should format large numbers with grouping', () => {
    const result = formatCurrency(1234567.89);
    expect(result).toContain('1,234,567.89');
  });

  it('should always show 2 decimal places', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100.00');
  });
});
