import { describe, it, expect } from 'vitest';
import {
  detectMarketStatus,
  detectMarketStatusBatch,
  determineSignalStatus,
  findNextTradableDay,
  validateKlineData,
  isSTStock,
  isNewStock,
} from '../market-status';
import type { BacktestKline } from '../types';
import {
  createSingleKline,
  createFlatKlines,
  createZeroVolumeKlines,
} from './mock-factory';

describe('isSTStock', () => {
  it('should detect ST stock with ST prefix', () => {
    expect(isSTStock('ST东方')).toBe(true);
  });

  it('should detect *ST stock', () => {
    expect(isSTStock('*ST信威')).toBe(true);
  });

  it('should detect S*ST stock', () => {
    expect(isSTStock('S*ST金泰')).toBe(true);
  });

  it('should return false for normal stock', () => {
    expect(isSTStock('贵州茅台')).toBe(false);
  });

  it('should handle lowercase st prefix', () => {
    expect(isSTStock('st东方')).toBe(true);
  });
});

describe('isNewStock', () => {
  it('should return true when klines count is less than minDays', () => {
    const klines = createFlatKlines(30, 10);
    expect(isNewStock(klines, 60)).toBe(true);
  });

  it('should return false when klines count meets minDays requirement', () => {
    const klines = createFlatKlines(100, 10);
    expect(isNewStock(klines, 60)).toBe(false);
  });
});

describe('detectMarketStatus', () => {
  it('should return normal status for regular kline without previous data', () => {
    const kline = createSingleKline({
      volume: 10000,
      close: 10,
      open: 10,
      high: 10.5,
      low: 9.5,
    });

    const status = detectMarketStatus(kline);

    expect(status.isSuspended).toBe(false);
    expect(status.isLimitUp).toBe(false);
    expect(status.isLimitDown).toBe(false);
    expect(status.isAbnormal).toBe(false);
  });

  it('should detect suspended status when volume is zero', () => {
    const kline = createSingleKline({ volume: 0 });

    const status = detectMarketStatus(kline);

    expect(status.isSuspended).toBe(true);
  });

  it('should detect suspended status when volume is below threshold', () => {
    const kline = createSingleKline({ volume: 50 });

    const status = detectMarketStatus(kline);

    expect(status.isSuspended).toBe(true);
  });

  it('should detect limit up when price rises 10% from previous close', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      close: 11,
      open: 10,
      high: 11,
      low: 10,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline);

    expect(status.isLimitUp).toBe(true);
  });

  it('should detect limit down when price falls 10% from previous close', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      close: 9,
      open: 10,
      high: 10,
      low: 9,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline);

    expect(status.isLimitDown).toBe(true);
  });

  it('should not detect limit up/down for normal 5% change', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      close: 10.5,
      open: 10,
      high: 10.6,
      low: 9.8,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline);

    expect(status.isLimitUp).toBe(false);
    expect(status.isLimitDown).toBe(false);
  });

  it('should detect abnormal status when high < low (requires prevKline)', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      high: 9,
      low: 10,
      close: 9.5,
      open: 9.5,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline);

    expect(status.isAbnormal).toBe(true);
    // When high<low, open/close are also out of range, so first check that fires wins
    expect(status.isAbnormal).toBe(true);
  });

  it('should detect abnormal status for extreme price change (>50%)', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      close: 16,
      open: 10,
      high: 16,
      low: 10,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline);

    expect(status.isAbnormal).toBe(true);
    expect(status.abnormalReason).toContain('价格变化异常');
  });

  it('should use 5% limit for ST stocks', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      close: 10.5,
      open: 10,
      high: 10.5,
      low: 10,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline, 'ST东方', true);

    expect(status.isLimitUp).toBe(true);
  });
});

describe('detectMarketStatusBatch', () => {
  it('should track consecutive suspension days for halted klines', () => {
    const klines = createZeroVolumeKlines(5);
    const statuses = detectMarketStatusBatch(klines);

    expect(statuses[0]!.isSuspended).toBe(true);
    expect(statuses[0]!.suspensionDays).toBe(1);

    expect(statuses[1]!.isSuspended).toBe(true);
    expect(statuses[1]!.suspensionDays).toBe(2);

    expect(statuses[4]!.isSuspended).toBe(true);
    expect(statuses[4]!.suspensionDays).toBe(5);
  });

  it('should return all normal statuses for regular klines', () => {
    const klines = createFlatKlines(5, 10, 10000);
    const statuses = detectMarketStatusBatch(klines);

    statuses.forEach((status) => {
      expect(status.isSuspended).toBe(false);
      expect(status.isAbnormal).toBe(false);
    });
  });
});

describe('determineSignalStatus', () => {
  it('should return completed status for normal entry and exit', () => {
    const entryStatus = {
      isSuspended: false,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };
    const exitStatus = {
      isSuspended: false,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, exitStatus, 'buy', true);

    expect(result.status).toBe('completed');
  });

  it('should return cannot_buy when buy signal has limit up at entry', () => {
    const entryStatus = {
      isSuspended: false,
      isLimitUp: true,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, null, 'buy', true);

    expect(result.status).toBe('cannot_buy');
    expect(result.statusReason).toContain('涨停');
  });

  it('should return cannot_buy when entry is suspended', () => {
    const entryStatus = {
      isSuspended: true,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 1,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, null, 'buy', true);

    expect(result.status).toBe('cannot_buy');
    expect(result.statusReason).toContain('停牌');
  });

  it('should return suspended status when exit is suspended', () => {
    const entryStatus = {
      isSuspended: false,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };
    const exitStatus = {
      isSuspended: true,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 1,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, exitStatus, 'buy', true);

    expect(result.status).toBe('suspended');
  });

  it('should return holding when not enough data and no exit status', () => {
    const entryStatus = {
      isSuspended: false,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, null, 'buy', false);

    expect(result.status).toBe('holding');
  });
});

describe('findNextTradableDay', () => {
  it('should return start index when all klines are normal', () => {
    const klines = createFlatKlines(10, 10, 10000);
    const statuses = detectMarketStatusBatch(klines);

    const nextIndex = findNextTradableDay(klines, statuses, 0);

    expect(nextIndex).toBe(0);
  });

  it('should return index after suspension when first few days are suspended', () => {
    const suspended = createZeroVolumeKlines(3);
    const normal = createFlatKlines(5, 10, 10000);
    const klines = [...suspended, ...normal];
    const statuses = detectMarketStatusBatch(klines);

    const nextIndex = findNextTradableDay(klines, statuses, 0);

    expect(nextIndex).toBe(3);
    expect(statuses[nextIndex]!.isSuspended).toBe(false);
  });

  it('should return -1 when all klines within maxLookAhead are suspended', () => {
    const klines = createZeroVolumeKlines(40);
    const statuses = detectMarketStatusBatch(klines);

    const nextIndex = findNextTradableDay(klines, statuses, 0, 30);

    expect(nextIndex).toBe(-1);
  });
});

describe('validateKlineData', () => {
  it('should return valid for normal klines', () => {
    const klines = createFlatKlines(10, 10, 10000);

    const validation = validateKlineData(klines);

    expect(validation.isValid).toBe(true);
    expect(validation.issues).toHaveLength(0);
    expect(validation.validCount).toBe(10);
  });

  it('should count suspended klines with zero volume', () => {
    const klines = createZeroVolumeKlines(5);

    const validation = validateKlineData(klines);

    expect(validation.suspendedCount).toBe(5);
    expect(validation.issues.length).toBeGreaterThan(0);
  });

  it('should detect data gaps greater than 10 days', () => {
    const DAY_SECONDS = 86400;
    const BASE_TIME = 1704067200;
    const klines = [
      { time: BASE_TIME, open: 10, high: 10, low: 10, close: 10, volume: 10000 },
      { time: BASE_TIME + 15 * DAY_SECONDS, open: 10, high: 10, low: 10, close: 10, volume: 10000 },
    ];

    const validation = validateKlineData(klines);

    expect(validation.isValid).toBe(false);
    expect(validation.issues.some(i => i.includes('数据缺口'))).toBe(true);
    expect(validation.issues.some(i => i.includes('15'))).toBe(true);
  });

  it('should count abnormal klines with data violations', () => {
    // Abnormal detection (high<low) requires prevKline, so we need >= 2 klines
    // The first kline has no prevKline so abnormal OHLC won't be detected
    // Only klines with prevKline can detect abnormalities
    const DAY_SECONDS = 86400;
    const BASE_TIME = 1704067200;
    const klines = [
      { time: BASE_TIME, open: 10, high: 10, low: 10, close: 10, volume: 10000 },
      { time: BASE_TIME + DAY_SECONDS, open: 9.5, high: 9, low: 10, close: 9.5, volume: 10000 },
      { time: BASE_TIME + 2 * DAY_SECONDS, open: 10, high: 8, low: 11, close: 9, volume: 10000 },
    ];

    const validation = validateKlineData(klines);

    expect(validation.abnormalCount).toBe(2);
    expect(validation.isValid).toBe(false);
  });
});

describe('determineSignalStatus - sell signal with limit-up exit', () => {
  it('should return completed with limit-up reason for sell signal + limit-up exit', () => {
    const entryStatus = {
      isSuspended: false,
      isLimitUp: false,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };
    const exitStatus = {
      isSuspended: false,
      isLimitUp: true,
      isLimitDown: false,
      suspensionDays: 0,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, exitStatus, 'sell', true);

    expect(result.status).toBe('completed');
    expect(result.statusReason).toBe('出场时涨停，按涨停价回补');
  });

  it('should return cannot_sell when sell signal has limit-down at entry', () => {
    const entryStatus = {
      isSuspended: false,
      isLimitUp: false,
      isLimitDown: true,
      suspensionDays: 0,
      isAbnormal: false,
    };

    const result = determineSignalStatus(entryStatus, null, 'sell', true);

    expect(result.status).toBe('cannot_sell');
    expect(result.statusReason).toContain('跌停');
  });
});

describe('getLimitRatio via detectMarketStatus', () => {
  it('should use 20% limit for KCB stock (688xxx)', () => {
    const prevKline = createSingleKline({ close: 10 });
    // 20% limit up = 12.0
    const kline = createSingleKline({
      close: 12,
      open: 10,
      high: 12,
      low: 10,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline, '688001');

    expect(status.isLimitUp).toBe(true);
  });

  it('should use 20% limit for CYB stock (30xxxx)', () => {
    const prevKline = createSingleKline({ close: 10 });
    const kline = createSingleKline({
      close: 12,
      open: 10,
      high: 12,
      low: 10,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline, '300001');

    expect(status.isLimitUp).toBe(true);
  });

  it('should use 30% limit for BJ stock (8xxxxx)', () => {
    const prevKline = createSingleKline({ close: 10 });
    // 30% limit up = 13.0
    const kline = createSingleKline({
      close: 13,
      open: 10,
      high: 13,
      low: 10,
      volume: 10000,
    });

    const status = detectMarketStatus(kline, prevKline, '830001');

    expect(status.isLimitUp).toBe(true);
  });
});
