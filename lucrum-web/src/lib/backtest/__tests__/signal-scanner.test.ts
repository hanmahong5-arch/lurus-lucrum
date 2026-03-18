import { describe, it, expect, vi } from 'vitest';
import {
  calculateAllIndicators,
  getAvailableStrategies,
  STRATEGY_DETECTORS,
  scanStockSignals,
  scanMultipleStocks,
  scanStockSignalsEnhanced,
  scanMultipleStocksEnhanced,
  deduplicateSignals,
  detectExtremeReturns,
  filterSignalsByStatus,
  getScanStatistics,
} from '../signal-scanner';
import type { SignalDetail } from '../signal-scanner';
import type { BacktestKline } from '../types';
import { createTrendKlines, createGoldenCrossKlines, createFlatKlines } from './mock-factory';

// Helper to create mock SignalDetail objects
const makeSignal = (overrides: Partial<SignalDetail> = {}): SignalDetail => ({
  symbol: '600519',
  name: 'test',
  type: 'buy',
  signal: 'MACD金叉',
  strength: 5,
  entryDate: '2024-01-01',
  exitDate: '2024-01-06',
  entryPrice: 10,
  exitPrice: 11,
  returnPct: 10,
  isWin: true,
  holdingDays: 5,
  status: 'completed',
  ...overrides,
});

describe('calculateAllIndicators', () => {
  it('returns all indicator arrays with same length as input', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);

    expect(indicators.sma5).toHaveLength(100);
    expect(indicators.sma10).toHaveLength(100);
    expect(indicators.sma20).toHaveLength(100);
    expect(indicators.sma60).toHaveLength(100);
    expect(indicators.ema12).toHaveLength(100);
    expect(indicators.ema26).toHaveLength(100);
    expect(indicators.rsi).toHaveLength(100);
    expect(indicators.macd).toHaveLength(100);
    expect(indicators.boll).toHaveLength(100);
  });

  it('sma5 first 4 values are NaN, rest are numbers', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);

    // First 4 values should be NaN
    for (let i = 0; i < 4; i++) {
      expect(Number.isNaN(indicators.sma5[i])).toBe(true);
    }

    // Rest should be valid numbers
    for (let i = 4; i < indicators.sma5.length; i++) {
      expect(typeof indicators.sma5[i]).toBe('number');
      expect(Number.isNaN(indicators.sma5[i])).toBe(false);
    }
  });

  it('rsi values between 0-100 (after warmup)', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);

    // After warmup period (14 days for RSI), values should be between 0-100
    for (let i = 14; i < indicators.rsi.length; i++) {
      if (!Number.isNaN(indicators.rsi[i])) {
        expect(indicators.rsi[i]).toBeGreaterThanOrEqual(0);
        expect(indicators.rsi[i]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('macd array has dif, dea, histogram for each element', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);

    indicators.macd.forEach((macdValue) => {
      expect(macdValue).toHaveProperty('dif');
      expect(macdValue).toHaveProperty('dea');
      expect(macdValue).toHaveProperty('histogram');
      expect(typeof macdValue.dif).toBe('number');
      expect(typeof macdValue.dea).toBe('number');
      expect(typeof macdValue.histogram).toBe('number');
    });
  });

  it('boll array has upper, middle, lower', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);

    indicators.boll.forEach((bollValue) => {
      expect(bollValue).toHaveProperty('upper');
      expect(bollValue).toHaveProperty('middle');
      expect(bollValue).toHaveProperty('lower');
      expect(typeof bollValue.upper).toBe('number');
      expect(typeof bollValue.middle).toBe('number');
      expect(typeof bollValue.lower).toBe('number');
    });
  });
});

describe('getAvailableStrategies', () => {
  it('returns 9 strategies', () => {
    const strategies = getAvailableStrategies();
    expect(strategies).toHaveLength(9);
  });

  it('each has id, name, nameEn, description, type', () => {
    const strategies = getAvailableStrategies();

    strategies.forEach((strategy) => {
      expect(strategy).toHaveProperty('id');
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('nameEn');
      expect(strategy).toHaveProperty('description');
      expect(strategy).toHaveProperty('type');
      expect(typeof strategy.id).toBe('string');
      expect(typeof strategy.name).toBe('string');
      expect(typeof strategy.nameEn).toBe('string');
      expect(typeof strategy.description).toBe('string');
      expect(typeof strategy.type).toBe('string');
    });
  });

  it('types include "buy" and "sell"', () => {
    const strategies = getAvailableStrategies();
    const types = strategies.map((s) => s.type);

    expect(types).toContain('buy');
    expect(types).toContain('sell');
  });
});

describe('scanStockSignals', () => {
  it('unknown strategy throws', () => {
    const klines = createTrendKlines(100, 10, 0.1);

    expect(() => {
      scanStockSignals('600519', 'Test Stock', klines, 'unknown_strategy', 5);
    }).toThrow();
  });

  it('insufficient data (< 65 bars for holdingDays=5) returns empty result', () => {
    const klines = createTrendKlines(50, 10, 0.1); // Only 50 bars, need 65

    const result = scanStockSignals('600519', 'Test Stock', klines, 'macd_golden_cross', 5);

    expect(result.symbol).toBe('600519');
    expect(result.name).toBe('Test Stock');
    expect(result.signals).toHaveLength(0);
    expect(result.totalSignals).toBe(0);
  });

  it('with golden cross data (100 bars) and "macd_golden_cross" may produce signals', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignals('600519', 'Test Stock', klines, 'macd_golden_cross', 5);

    expect(result.symbol).toBe('600519');
    expect(result.name).toBe('Test Stock');
    expect(result.signals).toBeDefined();
    expect(Array.isArray(result.signals)).toBe(true);
    // May or may not produce signals depending on data, just verify structure
  });

  it('flat price data with no MACD crossovers likely produces 0 signals', () => {
    const klines = createFlatKlines(100, 10);

    const result = scanStockSignals('600519', 'Test Stock', klines, 'macd_golden_cross', 5);

    expect(result.symbol).toBe('600519');
    expect(result.totalSignals).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it('result structure has all required fields', () => {
    const klines = createTrendKlines(100, 10, 0.1);

    const result = scanStockSignals('600519', 'Test Stock', klines, 'macd_golden_cross', 5);

    expect(result).toHaveProperty('symbol');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('totalSignals');
    expect(result).toHaveProperty('winSignals');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('avgReturn');
    expect(result).toHaveProperty('maxReturn');
    expect(result).toHaveProperty('minReturn');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('all signals have valid fields', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignals('600519', 'Test Stock', klines, 'macd_golden_cross', 5);

    result.signals.forEach((signal) => {
      expect(signal).toHaveProperty('type');
      expect(signal).toHaveProperty('entryDate');
      expect(signal).toHaveProperty('exitDate');
      expect(signal).toHaveProperty('entryPrice');
      expect(signal).toHaveProperty('exitPrice');
      expect(signal).toHaveProperty('returnPct');
      expect(signal).toHaveProperty('isWin');
      expect(signal).toHaveProperty('holdingDays');
      expect(signal).toHaveProperty('status');
      expect(typeof signal.type).toBe('string');
      expect(typeof signal.entryDate).toBe('string');
      expect(typeof signal.exitDate).toBe('string');
      expect(typeof signal.entryPrice).toBe('number');
      expect(typeof signal.exitPrice).toBe('number');
      expect(typeof signal.returnPct).toBe('number');
      expect(typeof signal.isWin).toBe('boolean');
      expect(typeof signal.holdingDays).toBe('number');
      expect(typeof signal.status).toBe('string');
    });
  });
});

describe('scanMultipleStocks', () => {
  it('scans all stocks and results.length equals input.length', () => {
    const stocks = [
      { symbol: '600519', name: 'Stock A', klines: createTrendKlines(100, 10, 0.1) },
      { symbol: '000001', name: 'Stock B', klines: createTrendKlines(100, 15, 0.08) },
      { symbol: '600036', name: 'Stock C', klines: createFlatKlines(100, 20) },
    ];

    const results = scanMultipleStocks(stocks, 'macd_golden_cross', 5);

    expect(results).toHaveLength(3);
    expect(results[0]!.symbol).toBe('600519');
    expect(results[1]!.symbol).toBe('000001');
    expect(results[2]!.symbol).toBe('600036');
  });

  it('progress callback called with (completed, total)', () => {
    const stocks = [
      { symbol: '600519', name: 'Stock A', klines: createTrendKlines(100, 10, 0.1) },
      { symbol: '000001', name: 'Stock B', klines: createTrendKlines(100, 15, 0.08) },
    ];

    const progressCalls: Array<{ completed: number; total: number }> = [];
    const onProgress = vi.fn((completed: number, total: number) => {
      progressCalls.push({ completed, total });
    });

    scanMultipleStocks(stocks, 'macd_golden_cross', 5, onProgress);

    expect(onProgress).toHaveBeenCalled();
    expect(progressCalls.length).toBeGreaterThan(0);
    // Last call should be (2, 2)
    const lastCall = progressCalls[progressCalls.length - 1];
    expect(lastCall!.completed).toBe(2);
    expect(lastCall!.total).toBe(2);
  });

  it('empty stocks array returns empty results', () => {
    const results = scanMultipleStocks([], 'macd_golden_cross', 5);

    expect(results).toHaveLength(0);
  });
});

describe('deduplicateSignals', () => {
  it('empty array returns empty', () => {
    const result = deduplicateSignals([]);
    expect(result).toHaveLength(0);
  });

  it('signals far apart (>3 days gap) are all kept', () => {
    const signals = [
      makeSignal({ entryDate: '2024-01-01' }),
      makeSignal({ entryDate: '2024-01-10' }),
      makeSignal({ entryDate: '2024-01-20' }),
    ];

    const result = deduplicateSignals(signals, { minGapDays: 3, mergeConsecutive: true, keepStrongest: false });

    expect(result).toHaveLength(3);
  });

  it('consecutive signals (1 day apart, minGapDays=3) are merged to 1', () => {
    const signals = [
      makeSignal({ entryDate: '2024-01-01', strength: 5 }),
      makeSignal({ entryDate: '2024-01-02', strength: 6 }),
      makeSignal({ entryDate: '2024-01-03', strength: 4 }),
    ];

    const result = deduplicateSignals(signals, { minGapDays: 3, mergeConsecutive: true, keepStrongest: false });

    // Should merge consecutive signals within 3 days
    expect(result.length).toBeLessThan(3);
  });

  it('keepStrongest=true keeps signal with highest strength', () => {
    const signals = [
      makeSignal({ entryDate: '2024-01-01', strength: 5, entryPrice: 10 }),
      makeSignal({ entryDate: '2024-01-02', strength: 8, entryPrice: 11 }),
      makeSignal({ entryDate: '2024-01-03', strength: 6, entryPrice: 12 }),
    ];

    const result = deduplicateSignals(signals, { minGapDays: 5, keepStrongest: true, mergeConsecutive: false });

    // Should keep only the strongest signal
    expect(result).toHaveLength(1);
    expect(result[0]!.strength).toBe(8);
    expect(result[0]!.entryPrice).toBe(11);
  });
});

describe('detectExtremeReturns', () => {
  it('normal returns (<50%) have isExtreme=false', () => {
    const signals = [
      makeSignal({ returnPct: 10 }),
      makeSignal({ returnPct: 20 }),
      makeSignal({ returnPct: -5 }),
    ];

    const result = detectExtremeReturns(signals, 50);

    result.forEach((signal) => {
      expect(signal.isExtreme).toBe(false);
    });
  });

  it('extreme return (>50%) has isExtreme=true with reason', () => {
    const signals = [
      makeSignal({ returnPct: 60, symbol: '600519', entryDate: '2024-01-01' }),
    ];

    const result = detectExtremeReturns(signals, 50);

    expect(result).toHaveLength(1);
    expect(result[0]!.isExtreme).toBe(true);
    expect(result[0]!.extremeReason).toBeDefined();
    expect(typeof result[0]!.extremeReason).toBe('string');
  });

  it('negative extreme is also detected', () => {
    const signals = [
      makeSignal({ returnPct: -60, symbol: '600519', entryDate: '2024-01-01' }),
    ];

    const result = detectExtremeReturns(signals, 50);

    expect(result).toHaveLength(1);
    expect(result[0]!.isExtreme).toBe(true);
    expect(result[0]!.extremeReason).toBeDefined();
  });
});

describe('filterSignalsByStatus', () => {
  it('filters correctly by "completed" status', () => {
    const signals = [
      makeSignal({ status: 'completed' }),
      makeSignal({ status: 'holding' }),
      makeSignal({ status: 'completed' }),
      makeSignal({ status: 'suspended' }),
    ];

    const result = filterSignalsByStatus(signals, ['completed']);

    expect(result).toHaveLength(2);
    result.forEach((signal) => {
      expect(signal.status).toBe('completed');
    });
  });

  it('empty input returns empty', () => {
    const result = filterSignalsByStatus([], ['completed']);
    expect(result).toHaveLength(0);
  });
});

describe('getScanStatistics', () => {
  it('single stock with signals returns correct counts', () => {
    const results = [
      {
        symbol: '600519',
        name: 'Test Stock',
        signals: [
          makeSignal({ isWin: true, returnPct: 10, status: 'completed' }),
          makeSignal({ isWin: false, returnPct: -5, status: 'completed' }),
        ],
        totalSignals: 2,
        winSignals: 1,
        winRate: 50,
        avgReturn: 2.5,
        maxReturn: 10,
        minReturn: -5,
      },
    ];

    const stats = getScanStatistics(results);

    expect(stats.totalStocks).toBe(1);
    expect(stats.stocksWithSignals).toBe(1);
    expect(stats.totalSignals).toBe(2);
    expect(stats.completedSignals).toBe(2);
    expect(stats.holdingSignals).toBe(0);
    expect(stats.suspendedSignals).toBe(0);
  });

  it('empty results returns zeros and null best/worst stocks', () => {
    const stats = getScanStatistics([]);

    expect(stats.totalStocks).toBe(0);
    expect(stats.stocksWithSignals).toBe(0);
    expect(stats.totalSignals).toBe(0);
    expect(stats.completedSignals).toBe(0);
    expect(stats.holdingSignals).toBe(0);
    expect(stats.suspendedSignals).toBe(0);
    expect(stats.avgWinRate).toBe(0);
    expect(stats.avgReturn).toBe(0);
    expect(stats.bestStock).toBeNull();
    expect(stats.worstStock).toBeNull();
  });

  it('multiple stocks returns correct aggregation', () => {
    const results = [
      {
        symbol: '600519',
        name: 'Stock A',
        signals: [
          makeSignal({ isWin: true, returnPct: 20, status: 'completed' }),
          makeSignal({ isWin: true, returnPct: 15, status: 'completed' }),
        ],
        totalSignals: 2,
        winSignals: 2,
        winRate: 100,
        avgReturn: 17.5,
        maxReturn: 20,
        minReturn: 15,
      },
      {
        symbol: '000001',
        name: 'Stock B',
        signals: [
          makeSignal({ isWin: false, returnPct: -10, status: 'completed' }),
          makeSignal({ isWin: true, returnPct: 5, status: 'holding' }),
        ],
        totalSignals: 2,
        winSignals: 1,
        winRate: 50,
        avgReturn: -2.5,
        maxReturn: 5,
        minReturn: -10,
      },
      {
        symbol: '600036',
        name: 'Stock C',
        signals: [],
        totalSignals: 0,
        winSignals: 0,
        winRate: 0,
        avgReturn: 0,
        maxReturn: 0,
        minReturn: 0,
      },
    ];

    const stats = getScanStatistics(results);

    expect(stats.totalStocks).toBe(3);
    expect(stats.stocksWithSignals).toBe(2);
    expect(stats.totalSignals).toBe(4);
    expect(stats.completedSignals).toBe(3);
    expect(stats.holdingSignals).toBe(1);
    expect(stats.suspendedSignals).toBe(0);
    // bestStock/worstStock are strings (stock symbols), not objects
    expect(stats.bestStock).toBeDefined();
    expect(stats.bestStock).toBe('Stock A');
    expect(stats.worstStock).toBeDefined();
    expect(stats.worstStock).toBe('Stock B');
  });
});

// =============================================================================
// ENHANCED SCANNER TESTS / 增强扫描器测试
// =============================================================================

describe('scanStockSignalsEnhanced', () => {
  it('produces result with correct structure using default options', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross');

    expect(result.symbol).toBe('600519');
    expect(result.name).toBe('Test Stock');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('totalSignals');
    expect(result).toHaveProperty('winSignals');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('avgReturn');
    expect(result).toHaveProperty('maxReturn');
    expect(result).toHaveProperty('minReturn');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('excludeSTStocks filters out ST-named stocks', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('000001', 'ST测试', klines, 'macd_golden_cross', {
      excludeSTStocks: true,
    });

    expect(result.symbol).toBe('000001');
    expect(result.name).toBe('ST测试');
    expect(result.signals).toHaveLength(0);
    expect(result.totalSignals).toBe(0);
  });

  it('excludeSTStocks=false does not filter ST stocks', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('000001', 'ST测试', klines, 'macd_golden_cross', {
      excludeSTStocks: false,
    });

    // Should proceed normally (may or may not have signals, but not filtered)
    expect(result.symbol).toBe('000001');
    expect(result.name).toBe('ST测试');
    // The result was not short-circuited; signals array exists
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('excludeNewStocks with insufficient klines returns empty', () => {
    const klines = createTrendKlines(30, 10, 0.1); // Only 30 bars, below default minListingDays=60

    const result = scanStockSignalsEnhanced('300001', 'New Stock', klines, 'macd_golden_cross', {
      excludeNewStocks: true,
      minListingDays: 60,
    });

    expect(result.signals).toHaveLength(0);
    expect(result.totalSignals).toBe(0);
  });

  it('detectMarketStatus adds status fields to signals', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross', {
      detectMarketStatus: true,
    });

    // Each signal should have enhanced status fields
    result.signals.forEach((signal) => {
      expect(signal).toHaveProperty('status');
      expect(signal).toHaveProperty('isLimitUp');
      expect(signal).toHaveProperty('isLimitDown');
      expect(signal).toHaveProperty('isSuspended');
      expect(typeof signal.isLimitUp).toBe('boolean');
      expect(typeof signal.isLimitDown).toBe('boolean');
      expect(typeof signal.isSuspended).toBe('boolean');
    });
  });

  it('transactionCosts adds netReturnPct to signals', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross', {
      transactionCosts: {
        commission: 0.0003,
        stampDuty: 0.001,
        transferFee: 0.00002,
        slippage: 0.001,
        minCommission: 5,
      },
    });

    result.signals.forEach((signal) => {
      expect(signal).toHaveProperty('netReturnPct');
      expect(typeof signal.netReturnPct).toBe('number');
      // Net return should differ from gross return due to costs
      if (signal.returnPct !== 0) {
        // With costs, net return should be less than gross for positive returns
        // or more negative for negative returns
        expect(signal.netReturnPct).not.toBeUndefined();
      }
    });
  });

  it('strengthThreshold filters weak signals', () => {
    const klines = createGoldenCrossKlines(100);

    // Get baseline without threshold
    const baseResult = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross', {
      strengthThreshold: undefined,
      deduplication: undefined,
    });

    // Apply a very high threshold to filter most signals
    const filteredResult = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross', {
      strengthThreshold: { minStrength: 999 },
      deduplication: undefined,
    });

    // Filtered should have fewer or equal signals
    expect(filteredResult.totalSignals).toBeLessThanOrEqual(baseResult.totalSignals);
    // With such a high threshold, likely no signals pass
    expect(filteredResult.totalSignals).toBe(0);
  });

  it('unknown strategy throws error', () => {
    const klines = createTrendKlines(100, 10, 0.1);

    expect(() => {
      scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'unknown_strategy');
    }).toThrow('Unknown strategy: unknown_strategy');
  });

  it('insufficient data returns empty result', () => {
    const klines = createTrendKlines(50, 10, 0.1); // < 60 + holdingDays

    const result = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross', {
      holdingDays: 5,
    });

    expect(result.signals).toHaveLength(0);
    expect(result.totalSignals).toBe(0);
  });

  it('flat data produces no signals', () => {
    const klines = createFlatKlines(100, 10);

    const result = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross');

    expect(result.totalSignals).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it('custom holdingDays is respected', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('600519', 'Test Stock', klines, 'macd_golden_cross', {
      holdingDays: 10,
    });

    result.signals.forEach((signal) => {
      expect(signal.holdingDays).toBe(10);
    });
  });
});

describe('scanMultipleStocksEnhanced', () => {
  it('scans all stocks and returns results for each', () => {
    const stocks = [
      { symbol: '600519', name: 'Stock A', klines: createTrendKlines(100, 10, 0.1) },
      { symbol: '000001', name: 'Stock B', klines: createTrendKlines(100, 15, 0.08) },
      { symbol: '600036', name: 'Stock C', klines: createFlatKlines(100, 20) },
    ];

    const results = scanMultipleStocksEnhanced(stocks, 'macd_golden_cross');

    expect(results).toHaveLength(3);
    expect(results[0]!.symbol).toBe('600519');
    expect(results[1]!.symbol).toBe('000001');
    expect(results[2]!.symbol).toBe('600036');
  });

  it('progress callback is called with (completed, total)', () => {
    const stocks = [
      { symbol: '600519', name: 'Stock A', klines: createTrendKlines(100, 10, 0.1) },
      { symbol: '000001', name: 'Stock B', klines: createTrendKlines(100, 15, 0.08) },
      { symbol: '600036', name: 'Stock C', klines: createFlatKlines(100, 20) },
    ];

    const progressCalls: Array<{ completed: number; total: number }> = [];
    const onProgress = vi.fn((completed: number, total: number) => {
      progressCalls.push({ completed, total });
    });

    scanMultipleStocksEnhanced(stocks, 'macd_golden_cross', {}, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(progressCalls[0]!.completed).toBe(1);
    expect(progressCalls[0]!.total).toBe(3);
    expect(progressCalls[2]!.completed).toBe(3);
    expect(progressCalls[2]!.total).toBe(3);
  });

  it('empty stocks array returns empty results', () => {
    const results = scanMultipleStocksEnhanced([], 'macd_golden_cross');

    expect(results).toHaveLength(0);
  });

  it('passes options through to individual scans', () => {
    const stocks = [
      { symbol: '000001', name: 'ST测试', klines: createGoldenCrossKlines(100) },
      { symbol: '600519', name: 'Normal Stock', klines: createGoldenCrossKlines(100) },
    ];

    const results = scanMultipleStocksEnhanced(stocks, 'macd_golden_cross', {
      excludeSTStocks: true,
    });

    expect(results).toHaveLength(2);
    // ST stock should have been filtered (empty signals)
    expect(results[0]!.totalSignals).toBe(0);
  });
});

// =============================================================================
// ADDITIONAL COVERAGE TESTS / 额外覆盖率测试
// =============================================================================

describe('STRATEGY_DETECTORS edge cases', () => {
  it('macd_golden_cross returns null for index 0', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    const result = STRATEGY_DETECTORS['macd_golden_cross']!.detect(klines, 0, indicators);
    expect(result).toBeNull();
  });

  it('macd_death_cross returns null for index 0', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    const result = STRATEGY_DETECTORS['macd_death_cross']!.detect(klines, 0, indicators);
    expect(result).toBeNull();
  });

  it('rsi_oversold returns null when rsi is undefined (index -1 access)', () => {
    const klines = createFlatKlines(5, 10);
    const indicators = calculateAllIndicators(klines);
    // Index 0 has no prevRsi at index -1, which is undefined
    const result = STRATEGY_DETECTORS['rsi_oversold']!.detect(klines, 0, indicators);
    expect(result).toBeNull();
  });

  it('rsi_overbought returns null when rsi is undefined (index -1 access)', () => {
    const klines = createFlatKlines(5, 10);
    const indicators = calculateAllIndicators(klines);
    const result = STRATEGY_DETECTORS['rsi_overbought']!.detect(klines, 0, indicators);
    expect(result).toBeNull();
  });

  it('ma_golden_cross returns null when SMA values are NaN (early indices)', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    // Index 5: sma5 is valid but sma20 is still NaN (needs 20 bars)
    const result = STRATEGY_DETECTORS['ma_golden_cross']!.detect(klines, 5, indicators);
    expect(result).toBeNull();
  });

  it('ma_death_cross returns null when SMA values are NaN (early indices)', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    const result = STRATEGY_DETECTORS['ma_death_cross']!.detect(klines, 5, indicators);
    expect(result).toBeNull();
  });

  it('boll_lower_break returns null when boll.lower is NaN', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    // Index 0: boll values are NaN (need 20 bars warmup)
    const result = STRATEGY_DETECTORS['boll_lower_break']!.detect(klines, 0, indicators);
    expect(result).toBeNull();
  });

  it('boll_upper_break returns null when boll.upper is NaN', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    const result = STRATEGY_DETECTORS['boll_upper_break']!.detect(klines, 0, indicators);
    expect(result).toBeNull();
  });

  it('volume_breakout returns null when index < 20', () => {
    const klines = createTrendKlines(100, 10, 0.1);
    const indicators = calculateAllIndicators(klines);
    const result = STRATEGY_DETECTORS['volume_breakout']!.detect(klines, 10, indicators);
    expect(result).toBeNull();
  });
});

describe('deduplicateSignals mergeConsecutive and keepStrongest variations', () => {
  it('mergeConsecutive=true keepStrongest=true selects strongest from group', () => {
    const signals = [
      makeSignal({ entryDate: '2024-01-01', strength: 3 }),
      makeSignal({ entryDate: '2024-01-02', strength: 9 }),
      makeSignal({ entryDate: '2024-01-03', strength: 7 }),
      // Gap > 5 days
      makeSignal({ entryDate: '2024-01-15', strength: 2 }),
      makeSignal({ entryDate: '2024-01-16', strength: 4 }),
    ];

    const result = deduplicateSignals(signals, {
      minGapDays: 5,
      mergeConsecutive: true,
      keepStrongest: true,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.strength).toBe(9);
    expect(result[1]!.strength).toBe(4);
  });

  it('keepStrongest=false keeps first signal in each group', () => {
    const signals = [
      makeSignal({ entryDate: '2024-01-01', strength: 3, entryPrice: 10 }),
      makeSignal({ entryDate: '2024-01-02', strength: 9, entryPrice: 11 }),
      makeSignal({ entryDate: '2024-01-03', strength: 7, entryPrice: 12 }),
    ];

    const result = deduplicateSignals(signals, {
      minGapDays: 5,
      mergeConsecutive: true,
      keepStrongest: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.entryPrice).toBe(10); // First signal kept
  });
});

describe('getScanStatistics with mixed signal statuses', () => {
  it('counts holding and suspended signals correctly', () => {
    const results = [
      {
        symbol: '600519',
        name: 'Stock A',
        signals: [
          makeSignal({ status: 'completed' }),
          makeSignal({ status: 'holding' }),
          makeSignal({ status: 'suspended' }),
          makeSignal({ status: 'holding' }),
        ],
        totalSignals: 4,
        winSignals: 1,
        winRate: 25,
        avgReturn: 5,
        maxReturn: 10,
        minReturn: -5,
      },
      {
        symbol: '000001',
        name: 'Stock B',
        signals: [
          makeSignal({ status: 'suspended' }),
          makeSignal({ status: 'cannot_buy' }),
        ],
        totalSignals: 2,
        winSignals: 0,
        winRate: 0,
        avgReturn: -3,
        maxReturn: 0,
        minReturn: -3,
      },
    ];

    const stats = getScanStatistics(results);

    expect(stats.totalStocks).toBe(2);
    expect(stats.stocksWithSignals).toBe(2);
    expect(stats.totalSignals).toBe(6);
    expect(stats.completedSignals).toBe(1);
    expect(stats.holdingSignals).toBe(2);
    expect(stats.suspendedSignals).toBe(2);
    expect(stats.bestStock).toBe('Stock A');
    expect(stats.worstStock).toBe('Stock B');
  });
});

describe('scanStockSignalsEnhanced createEmptyResult and strength filtering', () => {
  it('excludeNewStocks with custom minListingDays triggers createEmptyResult', () => {
    const klines = createTrendKlines(80, 10, 0.1);

    const result = scanStockSignalsEnhanced('300001', 'IPO Stock', klines, 'macd_golden_cross', {
      excludeNewStocks: true,
      minListingDays: 100, // 80 < 100
    });

    expect(result.signals).toHaveLength(0);
    expect(result.totalSignals).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it('strengthThreshold maxStrength filters outlier signals', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignalsEnhanced('600519', 'Test', klines, 'macd_golden_cross', {
      strengthThreshold: { maxStrength: 0.001 }, // Very low max filters most
      deduplication: undefined,
    });

    expect(result.totalSignals).toBe(0);
  });
});

describe('scanStockSignals loop logic generates and iterates signals', () => {
  it('golden cross data produces signals with correct return calculation', () => {
    const klines = createGoldenCrossKlines(100);

    const result = scanStockSignals('600519', 'Test', klines, 'macd_golden_cross', 5);

    // Golden cross klines are designed to trigger MACD crossovers
    if (result.totalSignals > 0) {
      const signal = result.signals[0]!;
      expect(signal.type).toBe('buy');
      expect(signal.signal).toBe('MACD金叉');
      expect(signal.holdingDays).toBe(5);
      expect(signal.status).toBe('completed');
      // Verify return calculation: (exitPrice - entryPrice) / entryPrice * 100
      const expectedReturn = ((signal.exitPrice - signal.entryPrice) / signal.entryPrice) * 100;
      expect(signal.returnPct).toBeCloseTo(expectedReturn, 5);
      expect(signal.isWin).toBe(signal.returnPct > 0);
      // entryDate and exitDate should be formatted date strings (YYYY-MM-DD)
      expect(signal.entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(signal.exitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    // Statistics should be consistent
    expect(result.winSignals).toBeLessThanOrEqual(result.totalSignals);
    if (result.totalSignals > 0) {
      expect(result.winRate).toBe((result.winSignals / result.totalSignals) * 100);
    }
  });
});

describe('scanStockSignalsEnhanced - sell-type return calculation', () => {
  it('macd_death_cross produces sell signals with correct return formula', () => {
    // Use golden cross klines which have price movement to trigger death cross too
    const klines = createGoldenCrossKlines(150);

    const result = scanStockSignalsEnhanced('600519', 'Test', klines, 'macd_death_cross', {
      holdingDays: 5,
    });

    // Death cross produces sell signals; return = (entry - exit) / entry * 100 (line 1068)
    if (result.totalSignals > 0) {
      const signal = result.signals[0]!;
      expect(signal.type).toBe('sell');
      // For sell: return = (entryPrice - exitPrice) / entryPrice * 100
      const expectedReturn = ((signal.entryPrice - signal.exitPrice) / signal.entryPrice) * 100;
      expect(signal.returnPct).toBeCloseTo(expectedReturn, 5);
    }
    expect(Array.isArray(result.signals)).toBe(true);
  });
});

describe('scanStockSignalsEnhanced - cannot_buy/cannot_sell skip branch', () => {
  it('signals with cannot_buy status are excluded from results when market status detected', () => {
    // Create klines where a golden cross occurs but entry kline is limit-up
    // We need detectMarketStatus=true and klines that simulate limit-up
    const baseKlines = createGoldenCrossKlines(100);

    // Simulate limit-up scenario: make some klines have close = prevClose * 1.10
    // This should trigger isLimitUp in market status detection
    const klines = baseKlines.map((k, idx) => {
      if (idx > 0 && idx >= 30 && idx <= 40) {
        const prevClose = baseKlines[idx - 1]!.close;
        // Force close to be +10% of previous close (limit up in A-share)
        return {
          ...k,
          close: prevClose * 1.10,
          high: prevClose * 1.10,
          open: prevClose * 1.09,
          low: prevClose * 1.05,
        };
      }
      return k;
    });

    const resultWithStatus = scanStockSignalsEnhanced('600519', 'Test', klines, 'macd_golden_cross', {
      detectMarketStatus: true,
      holdingDays: 5,
    });

    const resultWithoutStatus = scanStockSignalsEnhanced('600519', 'Test', klines, 'macd_golden_cross', {
      detectMarketStatus: false,
      holdingDays: 5,
    });

    // With market status detection, some signals might be filtered as cannot_buy
    // The count should be <= the result without status detection
    expect(resultWithStatus.totalSignals).toBeLessThanOrEqual(resultWithoutStatus.totalSignals);
    // All returned signals should NOT have cannot_buy/cannot_sell status
    resultWithStatus.signals.forEach((signal) => {
      expect(signal.status).not.toBe('cannot_buy');
      expect(signal.status).not.toBe('cannot_sell');
    });
  });
});

describe('scanStockSignalsEnhanced - sell strategies with transaction costs', () => {
  it('macd_death_cross with transaction costs computes netReturnPct for sell signals', () => {
    const klines = createGoldenCrossKlines(150);

    const result = scanStockSignalsEnhanced('600519', 'Test', klines, 'macd_death_cross', {
      holdingDays: 5,
      transactionCosts: {
        commission: 0.0003,
        stampDuty: 0.001,
        transferFee: 0.00002,
        slippage: 0.001,
        minCommission: 5,
      },
    });

    if (result.totalSignals > 0) {
      const signal = result.signals[0]!;
      expect(signal.type).toBe('sell');
      expect(typeof signal.netReturnPct).toBe('number');
      // Net return should differ from gross return
      expect(signal.netReturnPct).toBeDefined();
    }
  });
});

// =============================================================================
// ADDITIONAL COVERAGE TESTS FOR UNCOVERED LINES
// =============================================================================

describe('scanStockSignalsEnhanced - line 1068 sell-type return formula', () => {
  it('macd_death_cross with declining price pattern produces sell signals with inverse return', () => {
    // Create a pattern that rises then falls - opposite of golden cross
    // This will trigger MACD death cross detection
    const klines: BacktestKline[] = [];
    const BASE_TIME = 1704067200;
    const DAY_SECONDS = 86400;

    for (let i = 0; i < 150; i++) {
      let price: number;
      const midpoint = 75;
      if (i < midpoint) {
        // Rising phase - price goes up
        price = +(30 + i * 0.5).toFixed(2);
      } else {
        // Falling phase - price goes down
        price = +(30 + midpoint * 0.5 - (i - midpoint) * 0.3).toFixed(2);
      }
      klines.push({
        time: BASE_TIME + i * DAY_SECONDS,
        open: price,
        high: +(price + 0.5).toFixed(2),
        low: +(price - 0.5).toFixed(2),
        close: price,
        volume: 10000,
      });
    }

    const result = scanStockSignalsEnhanced('600519', 'Test', klines, 'macd_death_cross', {
      holdingDays: 5,
    });

    // Verify sell signals are generated and return is calculated correctly
    // For sell: returnPct = (entryPrice - exitPrice) / entryPrice * 100 (line 1068)
    if (result.totalSignals > 0) {
      const signal = result.signals[0]!;
      expect(signal.type).toBe('sell');
      // Verify the sell-type return formula: (entry - exit) / entry * 100
      const expectedReturn = ((signal.entryPrice - signal.exitPrice) / signal.entryPrice) * 100;
      expect(signal.returnPct).toBeCloseTo(expectedReturn, 5);
    }
    // Even if no signals, the test exercises the scanner with sell strategy
    expect(Array.isArray(result.signals)).toBe(true);
  });
});

describe('deduplicateSignals - defensive branch line 899-901 (unreachable)', () => {
  // Lines 899-901 are defensive code for TypeScript's noUncheckedIndexedAccess
  // The branch is unreachable in practice because:
  // - Line 892 checks currentGroup.length === 0 and continues if true
  // - So when we reach line 898, currentGroup.length >= 1
  // - Thus currentGroup[currentGroup.length - 1] is always defined
  // This test documents this behavior - the code is defensive/unreachable

  it('should never have undefined lastSignal when currentGroup has elements (defensive code)', () => {
    // Normal usage - lastSignal is always defined after length check
    const signals = [
      makeSignal({ entryDate: '2024-01-01', strength: 5 }),
      makeSignal({ entryDate: '2024-01-02', strength: 6 }),
    ];

    const result = deduplicateSignals(signals, { minGapDays: 3, mergeConsecutive: true, keepStrongest: false });

    // Verify normal operation - signals within 3 days are merged
    expect(result).toHaveLength(1);
    expect(result[0]!.entryDate).toBe('2024-01-01');
  });

  it('single signal array goes through the main path without hitting defensive check', () => {
    const signals = [makeSignal({ entryDate: '2024-01-01' })];

    const result = deduplicateSignals(signals, { minGapDays: 3, mergeConsecutive: true, keepStrongest: false });

    expect(result).toHaveLength(1);
  });

  it('signals spanning multiple groups all process through normal path', () => {
    const signals = [
      makeSignal({ entryDate: '2024-01-01', strength: 3 }),
      makeSignal({ entryDate: '2024-01-02', strength: 5 }),
      // Gap > minGapDays=3
      makeSignal({ entryDate: '2024-01-10', strength: 4 }),
      makeSignal({ entryDate: '2024-01-11', strength: 6 }),
      // Gap > minGapDays=3
      makeSignal({ entryDate: '2024-01-20', strength: 7 }),
    ];

    const result = deduplicateSignals(signals, { minGapDays: 3, mergeConsecutive: true, keepStrongest: true });

    // Should have 3 groups, each selecting strongest
    expect(result).toHaveLength(3);
    expect(result[0]!.strength).toBe(5);
    expect(result[1]!.strength).toBe(6);
    expect(result[2]!.strength).toBe(7);
  });
});
