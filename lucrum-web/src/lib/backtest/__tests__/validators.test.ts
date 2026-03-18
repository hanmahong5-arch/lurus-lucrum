import { describe, it, expect } from 'vitest';
import {
  MIN_CAPITAL,
  MAX_CAPITAL,
  MAX_PORTFOLIO_SIZE,
  MIN_BACKTEST_DAYS,
  MAX_BACKTEST_YEARS,
  VALID_MARKETS,
  VALID_TIMEFRAMES,
  VALID_STRATEGY_TYPES,
  StockSymbolSchema,
  DateStringSchema,
  validateBacktestRequest,
  validateTarget,
  validateConfig,
  validateStrategy,
  safeDivide,
  safePercent,
  sanitizeMetric,
  isValidNumber,
  clamp,
  getDefaultStartDate,
  getToday,
  formatDateString,
  parseDateString,
  estimateTradingDays,
} from '../core/validators';

describe('Zod Schemas', () => {
  describe('StockSymbolSchema', () => {
    it('should accept valid 6-digit stock symbol', () => {
      const result = StockSymbolSchema.safeParse('600519');
      expect(result.success).toBe(true);
    });

    it('should reject 5-digit symbol', () => {
      const result = StockSymbolSchema.safeParse('60051');
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric symbol', () => {
      const result = StockSymbolSchema.safeParse('abcdef');
      expect(result.success).toBe(false);
    });
  });

  describe('DateStringSchema', () => {
    it('should accept valid YYYY-MM-DD format', () => {
      const result = DateStringSchema.safeParse('2024-01-15');
      expect(result.success).toBe(true);
    });

    it('should reject slash-separated format', () => {
      const result = DateStringSchema.safeParse('2024/01/15');
      expect(result.success).toBe(false);
    });

    it('should reject invalid month', () => {
      const result = DateStringSchema.safeParse('2024-13-01');
      expect(result.success).toBe(false);
    });
  });
});

describe('validateBacktestRequest', () => {
  it('should accept valid full request', () => {
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(true);
  });

  it('should reject request with missing target', () => {
    const request = {
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
  });

  it('should map invalid symbol error correctly', () => {
    // Trigger error path: target.stock.symbol
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: 'invalid', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'target.stock.symbol' which contains 'symbol'
      expect(result.error.code).toBe('BT107'); // INVALID_SYMBOL
    }
  });

  it('should map config date error correctly', () => {
    // Trigger error path: config.startDate
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: 'invalid-date',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'config.startDate' which contains 'Date'
      expect(result.error.code).toBe('BT102'); // INVALID_DATE_RANGE
    }
  });

  it('should map config capital error correctly', () => {
    // Trigger error path: config.initialCapital
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100, // below MIN_CAPITAL
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'config.initialCapital' which contains 'initialCapital'
      expect(result.error.code).toBe('BT103'); // INVALID_CAPITAL
    }
  });

  it('should map config general error correctly', () => {
    // Trigger error path: config.commission (out of range)
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
        commission: 0.5, // exceeds 1% max
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'config.commission' which contains 'config' but not Date or initialCapital
      expect(result.error.code).toBe('BT100'); // INVALID_REQUEST (fallback for config)
    }
  });

  it('should map strategy error correctly', () => {
    // Trigger error path: strategy (missing builtinId triggers refine check)
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        // missing builtinId
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'strategy' which contains 'strategy' but not 'params'
      expect(result.error.code).toBe('BT104'); // INVALID_STRATEGY
    }
  });

  it('should map strategy params error correctly', () => {
    // Trigger error path: strategy.params
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
        params: { invalid: 'not a number' }, // params should be Record<string, number>
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'strategy.params.invalid' which contains 'params'
      expect(result.error.code).toBe('BT108'); // INVALID_PARAMS
    }
  });

  it('should map portfolio stocks error for empty portfolio', () => {
    // Trigger error path: target.portfolio.stocks (empty array)
    // Note: Zod's error path for min length check doesn't include "length",
    // so this falls through to PORTFOLIO_TOO_LARGE in mapZodErrorToCode
    const request = {
      target: {
        mode: 'portfolio',
        portfolio: {
          name: 'Test Portfolio',
          stocks: [], // empty portfolio
        },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'target.portfolio.stocks' which triggers the portfolio.stocks branch
      // Since Zod doesn't include "length" in the path, it falls to PORTFOLIO_TOO_LARGE
      expect(result.error.code).toBe('BT106'); // PORTFOLIO_TOO_LARGE (default for portfolio.stocks)
    }
  });

  it('should map portfolio too large error correctly', () => {
    // Trigger error path: target.portfolio.stocks (too many)
    const tooManyStocks = Array.from({ length: 51 }, (_, i) => ({
      symbol: String(600000 + i).slice(0, 6),
      name: `Stock ${i}`,
    }));

    const request = {
      target: {
        mode: 'portfolio',
        portfolio: {
          name: 'Test Portfolio',
          stocks: tooManyStocks, // exceeds MAX_PORTFOLIO_SIZE (50)
        },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path contains 'target.portfolio.stocks' - max length check
      expect(result.error.code).toBe('BT106'); // PORTFOLIO_TOO_LARGE
    }
  });

  it('should return default INVALID_REQUEST for unknown error paths', () => {
    // Trigger error with an unknown field to cover the default fallback
    const request = {
      target: {
        mode: 'stock',
        stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
      },
      config: {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 100000,
      },
      strategy: {
        type: 'builtin',
        builtinId: 'macd_golden_cross',
      },
      options: {
        sensitivityParams: [
          { name: 'param1', values: ['not', 'numbers'] }, // values should be number[]
        ],
      },
    };

    const result = validateBacktestRequest(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Error path is 'options.sensitivityParams.0.values.0' which doesn't match
      // target, config, or strategy patterns, so falls back to INVALID_REQUEST
      expect(result.error.code).toBe('BT100'); // INVALID_REQUEST (default fallback)
    }
  });
});

describe('validateTarget', () => {
  it('should accept valid stock target', () => {
    const target = {
      mode: 'stock',
      stock: { symbol: '600519', name: 'Test Stock', market: 'SH' },
    };

    const result = validateTarget(target);
    expect(result.success).toBe(true);
  });

  it('should reject stock mode without stock field', () => {
    const target = {
      mode: 'stock',
    };

    const result = validateTarget(target);
    expect(result.success).toBe(false);
  });

  it('should accept sector mode with sector data', () => {
    const target = {
      mode: 'sector',
      sector: { code: 'tech', name: 'Technology', type: 'industry' },
    };

    const result = validateTarget(target);
    expect(result.success).toBe(true);
  });

  it('should reject invalid symbol format', () => {
    const target = {
      mode: 'stock',
      stock: { symbol: '12345', name: 'Test Stock', market: 'SH' },
    };

    const result = validateTarget(target);
    expect(result.success).toBe(false);
  });
});

describe('validateConfig', () => {
  it('should accept valid config', () => {
    const config = {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      initialCapital: 100000,
    };

    const result = validateConfig(config);
    expect(result.success).toBe(true);
  });

  it('should reject capital below minimum', () => {
    const config = {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      initialCapital: MIN_CAPITAL - 1,
    };

    const result = validateConfig(config);
    expect(result.success).toBe(false);
  });

  it('should reject capital above maximum', () => {
    const config = {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      initialCapital: MAX_CAPITAL + 1,
    };

    const result = validateConfig(config);
    expect(result.success).toBe(false);
  });

  it('should reject end date before start date', () => {
    const config = {
      startDate: '2024-06-01',
      endDate: '2024-01-01',
      initialCapital: 100000,
    };

    const result = validateConfig(config);
    expect(result.success).toBe(false);
  });
});

describe('validateStrategy', () => {
  it('should accept valid builtin strategy', () => {
    const strategy = {
      type: 'builtin',
      builtinId: 'macd_golden_cross',
    };

    const result = validateStrategy(strategy);
    expect(result.success).toBe(true);
  });

  it('should accept valid custom strategy with code', () => {
    const strategy = {
      type: 'custom',
      customCode: 'function execute() { return []; }',
    };

    const result = validateStrategy(strategy);
    expect(result.success).toBe(true);
  });

  it('should reject builtin type without builtinId', () => {
    const strategy = {
      type: 'builtin',
    };

    const result = validateStrategy(strategy);
    expect(result.success).toBe(false);
  });

  it('should reject custom type without customCode', () => {
    const strategy = {
      type: 'custom',
    };

    const result = validateStrategy(strategy);
    expect(result.success).toBe(false);
  });
});

describe('safeDivide', () => {
  it('should perform normal division', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('should return default when denominator is zero', () => {
    expect(safeDivide(10, 0)).toBe(0);
  });

  it('should return custom default when denominator is zero', () => {
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });

  it('should return default when result is Infinity', () => {
    expect(safeDivide(10, Infinity)).toBe(0);
  });
});

describe('safePercent', () => {
  it('should calculate percentage correctly', () => {
    expect(safePercent(1, 2)).toBe(50);
  });

  it('should return 0 when whole is zero', () => {
    expect(safePercent(0, 0)).toBe(0);
  });
});

describe('sanitizeMetric', () => {
  it('should return default for NaN', () => {
    expect(sanitizeMetric(NaN)).toBe(0);
  });

  it('should return default for Infinity', () => {
    expect(sanitizeMetric(Infinity)).toBe(0);
  });

  it('should round to specified decimal places', () => {
    expect(sanitizeMetric(3.14159, { decimalPlaces: 2 })).toBe(3.14);
  });

  it('should clamp value to min/max', () => {
    expect(sanitizeMetric(150, { min: 0, max: 100 })).toBe(100);
    expect(sanitizeMetric(-10, { min: 0, max: 100 })).toBe(0);
  });
});

describe('isValidNumber', () => {
  it('should return true for valid number', () => {
    expect(isValidNumber(42)).toBe(true);
  });

  it('should return false for NaN', () => {
    expect(isValidNumber(NaN)).toBe(false);
  });

  it('should return false for Infinity', () => {
    expect(isValidNumber(Infinity)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isValidNumber('string' as any)).toBe(false);
  });
});

describe('clamp', () => {
  it('should return value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should clamp to minimum', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('should clamp to maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('Date Utilities', () => {
  it('should format date to YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15); // Month is 0-indexed
    expect(formatDateString(date)).toBe('2024-01-15');
  });

  it('should parse valid date string', () => {
    const result = parseDateString('2024-01-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(0); // January
    expect(result?.getDate()).toBe(15);
  });

  it('should return null for invalid date string', () => {
    const result = parseDateString('invalid');
    expect(result).toBeNull();
  });

  it('should estimate trading days correctly', () => {
    const days = estimateTradingDays('2024-01-01', '2025-01-01');
    // Approximately 365 * 0.7 = 255 trading days
    expect(days).toBeGreaterThan(240);
    expect(days).toBeLessThan(270);
  });

  it('should return valid default start date', () => {
    const startDate = getDefaultStartDate();
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Should be approximately 1 year ago
    const parsed = parseDateString(startDate);
    expect(parsed).toBeInstanceOf(Date);
  });

  it('should return valid today date', () => {
    const today = getToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Should be parseable
    const parsed = parseDateString(today);
    expect(parsed).toBeInstanceOf(Date);
  });
});
