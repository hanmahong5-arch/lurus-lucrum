/**
 * Tests for mock-factory.ts
 * Ensures all generator functions work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  createFlatKlines,
  createTrendKlines,
  createSingleKline,
  createHaltedKlines,
  createLimitUpKlines,
  createLimitDownKlines,
  createZeroVolumeKlines,
  createGoldenCrossKlines,
} from './mock-factory';

const BASE_TIME = 1704067200; // 2024-01-01 00:00:00 UTC
const DAY_SECONDS = 86400;

describe('mock-factory', () => {
  describe('createFlatKlines', () => {
    it('should create K-lines with constant price', () => {
      const klines = createFlatKlines(5, 100);

      expect(klines).toHaveLength(5);
      for (let i = 0; i < klines.length; i++) {
        const kline = klines[i]!;
        expect(kline.open).toBe(100);
        expect(kline.high).toBe(100);
        expect(kline.low).toBe(100);
        expect(kline.close).toBe(100);
        expect(kline.volume).toBe(10000);
        expect(kline.time).toBe(BASE_TIME + i * DAY_SECONDS);
      }
    });

    it('should use custom volume', () => {
      const klines = createFlatKlines(3, 50, 5000);

      for (const kline of klines) {
        expect(kline.volume).toBe(5000);
      }
    });
  });

  describe('createTrendKlines', () => {
    it('should create uptrend K-lines', () => {
      const klines = createTrendKlines(5, 100, 1);

      expect(klines).toHaveLength(5);
      expect(klines[0]!.close).toBe(100);
      expect(klines[4]!.close).toBe(104);
    });

    it('should create downtrend K-lines', () => {
      const klines = createTrendKlines(5, 100, -1);

      expect(klines).toHaveLength(5);
      expect(klines[0]!.close).toBe(100);
      expect(klines[4]!.close).toBe(96);
    });
  });

  describe('createSingleKline', () => {
    it('should create a single K-line with defaults', () => {
      const kline = createSingleKline();

      expect(kline.time).toBe(BASE_TIME);
      expect(kline.open).toBe(10);
      expect(kline.high).toBe(10.5);
      expect(kline.low).toBe(9.5);
      expect(kline.close).toBe(10);
      expect(kline.volume).toBe(10000);
    });

    it('should apply overrides', () => {
      const kline = createSingleKline({ close: 15, volume: 50000 });

      expect(kline.close).toBe(15);
      expect(kline.volume).toBe(50000);
      expect(kline.open).toBe(10); // default unchanged
    });
  });

  describe('createHaltedKlines', () => {
    it('should create K-lines with zero volume during halt period', () => {
      const klines = createHaltedKlines(10, 3, 6);

      expect(klines).toHaveLength(10);
      // Before halt
      expect(klines[0]!.volume).toBe(10000);
      expect(klines[2]!.volume).toBe(10000);
      // During halt (indices 3, 4, 5)
      expect(klines[3]!.volume).toBe(0);
      expect(klines[4]!.volume).toBe(0);
      expect(klines[5]!.volume).toBe(0);
      // After halt
      expect(klines[6]!.volume).toBe(10000);
    });

    it('should use custom price', () => {
      const klines = createHaltedKlines(5, 1, 3, 50);

      for (const kline of klines) {
        expect(kline.close).toBe(50);
      }
    });
  });

  describe('createLimitUpKlines', () => {
    it('should create K-lines with 10% limit-up on specified day', () => {
      const klines = createLimitUpKlines(5, 2, 10);

      expect(klines).toHaveLength(5);
      // Before limit day
      expect(klines[0]!.close).toBe(10);
      expect(klines[1]!.close).toBe(10);
      // Limit-up day (index 2): 10 * 1.1 = 11
      expect(klines[2]!.close).toBe(11);
      expect(klines[2]!.high).toBe(11);
      // After limit day
      expect(klines[3]!.close).toBe(10);
      expect(klines[4]!.close).toBe(10);
    });

    it('should work with different base prices', () => {
      const klines = createLimitUpKlines(3, 1, 100);

      expect(klines[0]!.close).toBe(100);
      expect(klines[1]!.close).toBe(110); // 100 * 1.1
      expect(klines[2]!.close).toBe(100);
    });

    it('should have correct OHLC values on limit-up day', () => {
      const klines = createLimitUpKlines(3, 0, 20);

      const limitDay = klines[0]!;
      expect(limitDay.open).toBe(20);
      expect(limitDay.close).toBe(22); // 20 * 1.1
      expect(limitDay.high).toBe(22);
      expect(limitDay.low).toBe(20);
    });
  });

  describe('createLimitDownKlines', () => {
    it('should create K-lines with 10% limit-down on specified day', () => {
      const klines = createLimitDownKlines(5, 2, 10);

      expect(klines).toHaveLength(5);
      // Before limit day
      expect(klines[0]!.close).toBe(10);
      expect(klines[1]!.close).toBe(10);
      // Limit-down day (index 2): 10 * 0.9 = 9
      expect(klines[2]!.close).toBe(9);
      expect(klines[2]!.low).toBe(9);
      // After limit day
      expect(klines[3]!.close).toBe(10);
      expect(klines[4]!.close).toBe(10);
    });

    it('should work with different base prices', () => {
      const klines = createLimitDownKlines(3, 1, 100);

      expect(klines[0]!.close).toBe(100);
      expect(klines[1]!.close).toBe(90); // 100 * 0.9
      expect(klines[2]!.close).toBe(100);
    });

    it('should have correct OHLC values on limit-down day', () => {
      const klines = createLimitDownKlines(3, 0, 20);

      const limitDay = klines[0]!;
      expect(limitDay.open).toBe(20);
      expect(limitDay.close).toBe(18); // 20 * 0.9
      expect(limitDay.high).toBe(20);
      expect(limitDay.low).toBe(18);
    });

    it('should set low equal to base price for non-limit days', () => {
      const klines = createLimitDownKlines(3, 1, 50);

      expect(klines[0]!.low).toBe(50);
      expect(klines[1]!.low).toBe(45); // limit-down day
      expect(klines[2]!.low).toBe(50);
    });
  });

  describe('createZeroVolumeKlines', () => {
    it('should create K-lines with zero volume (suspension)', () => {
      const klines = createZeroVolumeKlines(5, 100);

      expect(klines).toHaveLength(5);
      for (const kline of klines) {
        expect(kline.volume).toBe(0);
        expect(kline.close).toBe(100);
      }
    });

    it('should use default price of 10', () => {
      const klines = createZeroVolumeKlines(3);

      for (const kline of klines) {
        expect(kline.close).toBe(10);
      }
    });
  });

  describe('createGoldenCrossKlines', () => {
    it('should create declining then rising pattern', () => {
      const klines = createGoldenCrossKlines(100);

      expect(klines).toHaveLength(100);

      // First half should be declining
      const midpoint = 50;
      expect(klines[0]!.close).toBe(50);
      expect(klines[midpoint - 1]!.close).toBeLessThan(klines[0]!.close);

      // Second half should be rising
      expect(klines[99]!.close).toBeGreaterThan(klines[midpoint]!.close);
    });

    it('should use default of 100 days', () => {
      const klines = createGoldenCrossKlines();

      expect(klines).toHaveLength(100);
    });

    it('should have valid OHLCV structure', () => {
      const klines = createGoldenCrossKlines(10);

      for (const kline of klines) {
        expect(kline.open).toBeDefined();
        expect(kline.high).toBeDefined();
        expect(kline.low).toBeDefined();
        expect(kline.close).toBeDefined();
        expect(kline.volume).toBe(10000);
        expect(kline.high).toBeGreaterThanOrEqual(kline.close);
        expect(kline.low).toBeLessThanOrEqual(kline.close);
      }
    });
  });
});
