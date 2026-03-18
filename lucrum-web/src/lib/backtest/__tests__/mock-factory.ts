/**
 * Shared Mock Data Factory for Backtest Tests
 * Deterministic K-line generators (no randomness)
 */

import type { BacktestKline } from "../types";

const DAY_SECONDS = 86400;
const BASE_TIME = 1704067200; // 2024-01-01 00:00:00 UTC

/**
 * Create flat-price K-lines (same OHLC each day)
 */
export function createFlatKlines(
  days: number,
  price: number,
  volume: number = 10000,
): BacktestKline[] {
  return Array.from({ length: days }, (_, i) => ({
    time: BASE_TIME + i * DAY_SECONDS,
    open: price,
    high: price,
    low: price,
    close: price,
    volume,
  }));
}

/**
 * Create linearly trending K-lines
 */
export function createTrendKlines(
  days: number,
  startPrice: number,
  dailyChange: number,
  volume: number = 10000,
): BacktestKline[] {
  return Array.from({ length: days }, (_, i) => {
    const price = +(startPrice + i * dailyChange).toFixed(2);
    const low = +(price - Math.abs(dailyChange) * 0.5).toFixed(2);
    const high = +(price + Math.abs(dailyChange) * 0.5).toFixed(2);
    return {
      time: BASE_TIME + i * DAY_SECONDS,
      open: +(price - dailyChange * 0.5).toFixed(2),
      high: Math.max(high, price),
      low: Math.min(low, price),
      close: price,
      volume,
    };
  });
}

/**
 * Create a single K-line with overrides
 */
export function createSingleKline(
  overrides: Partial<BacktestKline> = {},
): BacktestKline {
  return {
    time: BASE_TIME,
    open: 10,
    high: 10.5,
    low: 9.5,
    close: 10,
    volume: 10000,
    ...overrides,
  };
}

/**
 * Create K-lines with a halted (zero volume) period
 */
export function createHaltedKlines(
  days: number,
  haltStart: number,
  haltEnd: number,
  price: number = 10,
): BacktestKline[] {
  return Array.from({ length: days }, (_, i) => ({
    time: BASE_TIME + i * DAY_SECONDS,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: i >= haltStart && i < haltEnd ? 0 : 10000,
  }));
}

/**
 * Create K-lines with a limit-up day (10% rise)
 */
export function createLimitUpKlines(
  days: number,
  limitDay: number,
  basePrice: number = 10,
): BacktestKline[] {
  return Array.from({ length: days }, (_, i) => {
    const prevClose = i === 0 ? basePrice : basePrice;
    const close = i === limitDay ? +(basePrice * 1.1).toFixed(2) : basePrice;
    const high = i === limitDay ? close : basePrice;
    return {
      time: BASE_TIME + i * DAY_SECONDS,
      open: prevClose,
      high,
      low: basePrice,
      close,
      volume: 10000,
    };
  });
}

/**
 * Create K-lines with a limit-down day (10% fall)
 */
export function createLimitDownKlines(
  days: number,
  limitDay: number,
  basePrice: number = 10,
): BacktestKline[] {
  return Array.from({ length: days }, (_, i) => {
    const close = i === limitDay ? +(basePrice * 0.9).toFixed(2) : basePrice;
    const low = i === limitDay ? close : basePrice;
    return {
      time: BASE_TIME + i * DAY_SECONDS,
      open: basePrice,
      high: basePrice,
      low,
      close,
      volume: 10000,
    };
  });
}

/**
 * Create K-lines with zero volume (suspension-like)
 */
export function createZeroVolumeKlines(
  days: number,
  price: number = 10,
): BacktestKline[] {
  return Array.from({ length: days }, (_, i) => ({
    time: BASE_TIME + i * DAY_SECONDS,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
  }));
}

/**
 * Create K-lines suitable for MACD golden cross detection.
 * Prices: declining then rising to produce DIF crossing DEA.
 */
export function createGoldenCrossKlines(days: number = 100): BacktestKline[] {
  const result: BacktestKline[] = [];
  const midpoint = Math.floor(days / 2);
  for (let i = 0; i < days; i++) {
    let price: number;
    if (i < midpoint) {
      // Declining phase
      price = +(50 - i * 0.3).toFixed(2);
    } else {
      // Rising phase
      price = +(50 - midpoint * 0.3 + (i - midpoint) * 0.5).toFixed(2);
    }
    result.push({
      time: BASE_TIME + i * DAY_SECONDS,
      open: price,
      high: +(price + 0.5).toFixed(2),
      low: +(price - 0.5).toFixed(2),
      close: price,
      volume: 10000,
    });
  }
  return result;
}
