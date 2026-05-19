import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COSTS,
  ZERO_COSTS,
  CONSERVATIVE_COSTS,
  STANDARD_MARKETPLACE_COSTS,
  assertStandardCosts,
  calculateTradeCost,
  calculateRoundTripCost,
  calculateNetReturn,
  estimateEffectivePrice,
  calculateBreakEvenPrice,
  formatCostBreakdown,
  getCostSummary,
  createCostConfig,
  validateCostConfig,
} from '../transaction-costs';

describe('calculateTradeCost', () => {
  it('calculates buy trade costs correctly for 100000 value', () => {
    const result = calculateTradeCost(100000, 'buy', DEFAULT_COSTS);

    // commission = max(100000 * 0.0003, 5) = 30
    expect(result.commission).toBeCloseTo(30, 2);

    // stampDuty = 0 for buy
    expect(result.stampDuty).toBe(0);

    // transferFee = 100000 * 0.00001 = 1
    expect(result.transferFee).toBe(1);

    // slippage = 100000 * 0.001 = 100
    expect(result.slippage).toBe(100);

    // totalCost = 30 + 0 + 1 + 100 = 131
    expect(result.totalCost).toBe(131);

    // costRate = 131 / 100000 = 0.00131
    expect(result.costRate).toBeCloseTo(0.00131, 5);
  });

  it('calculates sell trade costs correctly for 100000 value', () => {
    const result = calculateTradeCost(100000, 'sell', DEFAULT_COSTS);

    // commission = max(100000 * 0.0003, 5) = 30
    expect(result.commission).toBeCloseTo(30, 2);

    // stampDuty = 100000 * 0.0005 = 50 for sell
    expect(result.stampDuty).toBe(50);

    // transferFee = 100000 * 0.00001 = 1
    expect(result.transferFee).toBe(1);

    // slippage = 100000 * 0.001 = 100
    expect(result.slippage).toBe(100);

    // totalCost = 30 + 50 + 1 + 100 = 181
    expect(result.totalCost).toBe(181);

    // costRate = 181 / 100000 = 0.00181
    expect(result.costRate).toBeCloseTo(0.00181, 5);
  });

  it('applies minimum commission for zero value trade', () => {
    const result = calculateTradeCost(0, 'buy', DEFAULT_COSTS);

    // commission = max(0 * 0.0003, 5) = 5
    expect(result.commission).toBe(5);

    // all other costs should be 0
    expect(result.stampDuty).toBe(0);
    expect(result.transferFee).toBe(0);
    expect(result.slippage).toBe(0);

    // totalCost = 5
    expect(result.totalCost).toBe(5);
  });

  it('calculates zero costs with ZERO_COSTS config', () => {
    const result = calculateTradeCost(100000, 'buy', ZERO_COSTS);

    // all costs including commission should be 0 (minCommission=0)
    expect(result.commission).toBe(0);
    expect(result.stampDuty).toBe(0);
    expect(result.transferFee).toBe(0);
    expect(result.slippage).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.costRate).toBe(0);
  });
});

describe('calculateRoundTripCost', () => {
  it('calculates profitable round trip correctly', () => {
    // Buy at 10, sell at 11, 1000 shares
    const result = calculateRoundTripCost(10, 11, 1000, DEFAULT_COSTS);

    // grossReturn = (11 - 10) * 1000 = 1000
    expect(result.grossReturn).toBe(1000);

    // totalCost should be > 0
    expect(result.totalCost).toBeGreaterThan(0);

    // netReturn should be less than grossReturn due to costs
    expect(result.netReturn).toBeLessThan(result.grossReturn);
    expect(result.netReturn).toBeCloseTo(1000 - result.totalCost, 2);

    // verify buy and sell costs exist
    expect(result.buyCost.totalCost).toBeGreaterThan(0);
    expect(result.sellCost.totalCost).toBeGreaterThan(0);

    // totalCostRate should be reasonable
    expect(result.totalCostRate).toBeGreaterThan(0);
  });

  it('calculates loss trade correctly', () => {
    // Buy at 10, sell at 9, 1000 shares (loss)
    const result = calculateRoundTripCost(10, 9, 1000, DEFAULT_COSTS);

    // grossReturn = (9 - 10) * 1000 = -1000
    expect(result.grossReturn).toBe(-1000);

    // netReturn should be even more negative (loss + costs)
    expect(result.netReturn).toBeLessThan(result.grossReturn);
    expect(result.netReturn).toBeCloseTo(-1000 - result.totalCost, 2);

    // costs should still be positive
    expect(result.totalCost).toBeGreaterThan(0);
  });
});

describe('estimateEffectivePrice', () => {
  it('calculates effective buy price with slippage', () => {
    const price = 10;
    const slippage = 0.001;

    // Buy: price * (1 + slippage) = 10 * 1.001 = 10.01
    const effectivePrice = estimateEffectivePrice(price, 'buy', slippage);
    expect(effectivePrice).toBeCloseTo(10.01, 4);
  });

  it('calculates effective sell price with slippage', () => {
    const price = 10;
    const slippage = 0.001;

    // Sell: price * (1 - slippage) = 10 * 0.999 = 9.99
    const effectivePrice = estimateEffectivePrice(price, 'sell', slippage);
    expect(effectivePrice).toBeCloseTo(9.99, 4);
  });
});

describe('calculateBreakEvenPrice', () => {
  it('calculates break-even price higher than entry for buy trade', () => {
    const entryPrice = 10;
    const shares = 1000;

    const breakEvenPrice = calculateBreakEvenPrice(entryPrice, shares, 'buy', DEFAULT_COSTS);

    // Break-even should be higher than entry to cover costs
    expect(breakEvenPrice).toBeGreaterThan(entryPrice);

    // Should be a reasonable number (not too far from entry)
    expect(breakEvenPrice).toBeLessThan(entryPrice * 1.1);
  });

  it('calculates break-even price as reasonable value close to entry', () => {
    const entryPrice = 50;
    const shares = 500;

    const breakEvenPrice = calculateBreakEvenPrice(entryPrice, shares, 'buy', DEFAULT_COSTS);

    // Should be a finite, positive number
    expect(breakEvenPrice).toBeGreaterThan(0);
    expect(Number.isFinite(breakEvenPrice)).toBe(true);

    // Should be within reasonable range
    expect(breakEvenPrice).toBeGreaterThan(entryPrice);
    expect(breakEvenPrice).toBeLessThan(entryPrice * 1.05);
  });
});

describe('validateCostConfig', () => {
  it('validates DEFAULT_COSTS as valid', () => {
    const result = validateCostConfig(DEFAULT_COSTS);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects negative commission', () => {
    const invalidCosts = { ...DEFAULT_COSTS, commission: -0.001 };
    const result = validateCostConfig(invalidCosts);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(err => err.includes('佣金') || err.includes('commission'))).toBe(true);
  });

  it('rejects commission greater than 1%', () => {
    const invalidCosts = { ...DEFAULT_COSTS, commission: 0.02 }; // 2%
    const result = validateCostConfig(invalidCosts);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects slippage greater than 5%', () => {
    const invalidCosts = { ...DEFAULT_COSTS, slippage: 0.06 }; // 6%
    const result = validateCostConfig(invalidCosts);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(err => err.includes('滑点') || err.includes('slippage'))).toBe(true);
  });
});

describe('createCostConfig', () => {
  it('returns DEFAULT_COSTS when no arguments provided', () => {
    const config = createCostConfig();

    expect(config).toEqual(DEFAULT_COSTS);
  });

  it('merges partial override with defaults', () => {
    const config = createCostConfig({ commission: 0.0005 });

    // commission should be overridden
    expect(config.commission).toBe(0.0005);

    // other fields should use defaults
    expect(config.stampDuty).toBe(DEFAULT_COSTS.stampDuty);
    expect(config.transferFee).toBe(DEFAULT_COSTS.transferFee);
    expect(config.slippage).toBe(DEFAULT_COSTS.slippage);
    expect(config.minCommission).toBe(DEFAULT_COSTS.minCommission);
  });
});

describe('formatCostBreakdown', () => {
  it('returns formatted string with Chinese labels', () => {
    const cost = calculateTradeCost(100000, 'buy', DEFAULT_COSTS);
    const formatted = formatCostBreakdown(cost);

    // Should contain Chinese labels
    expect(formatted).toContain('佣金');
    expect(formatted).toContain('总成本');

    // Should be a non-empty string
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('getCostSummary', () => {
  it('returns "无交易成本" for ZERO_COSTS', () => {
    const summary = getCostSummary(ZERO_COSTS);

    expect(summary).toContain('无交易成本');
  });

  it('includes commission and round-trip info for DEFAULT_COSTS', () => {
    const summary = getCostSummary(DEFAULT_COSTS);

    // Should mention commission
    expect(summary).toContain('佣金');

    // Should mention round-trip cost
    expect(summary).toContain('往返约');
  });

  it('should show only commission when stamp duty and slippage are zero', () => {
    const partialCosts = {
      commission: 0.0003,
      stampDuty: 0,
      transferFee: 0,
      slippage: 0,
      minCommission: 5,
    };
    const summary = getCostSummary(partialCosts);

    expect(summary).toContain('佣金');
    expect(summary).not.toContain('印花税');
    expect(summary).not.toContain('滑点');
    expect(summary).toContain('往返约');
  });
});

describe('calculateBreakEvenPrice - sell/short trades', () => {
  it('should calculate break-even price lower than entry for sell/short trade', () => {
    const entryPrice = 10;
    const shares = 1000;

    const breakEvenPrice = calculateBreakEvenPrice(entryPrice, shares, 'sell', DEFAULT_COSTS);

    // For short position, break-even should be lower than entry
    expect(breakEvenPrice).toBeLessThan(entryPrice);
    expect(breakEvenPrice).toBeGreaterThan(0);
    expect(Number.isFinite(breakEvenPrice)).toBe(true);
  });

  it('should produce lower break-even for sell with higher costs', () => {
    const entryPrice = 50;
    const shares = 500;

    const beDefault = calculateBreakEvenPrice(entryPrice, shares, 'sell', DEFAULT_COSTS);
    const beConservative = calculateBreakEvenPrice(entryPrice, shares, 'sell', CONSERVATIVE_COSTS);

    // Higher costs -> need to buy back at even lower price
    expect(beConservative).toBeLessThan(beDefault);
  });
});

describe('validateCostConfig - boundary values', () => {
  it('should accept commission exactly at 0.01 (1%) boundary', () => {
    const costs = { ...DEFAULT_COSTS, commission: 0.01 };
    const result = validateCostConfig(costs);

    expect(result.isValid).toBe(true);
  });

  it('should reject negative stamp duty', () => {
    const costs = { ...DEFAULT_COSTS, stampDuty: -0.001 };
    const result = validateCostConfig(costs);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('印花税'))).toBe(true);
  });

  it('should reject minCommission greater than 100', () => {
    const costs = { ...DEFAULT_COSTS, minCommission: 150 };
    const result = validateCostConfig(costs);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('最低佣金'))).toBe(true);
  });
});

// ===========================================================================
// Sprint 1 招 B — marketplace standardized cost profile (added 2026-05-18)
// ===========================================================================
//
// Test design from two perspectives:
//   USER (publisher): "I want my strategy listed; tell me clearly if and
//     where my cost config doesn't match the marketplace baseline."
//   ADVERSARIAL TESTER: "Can I sneak past the gate with floats just under
//     the epsilon, NaN, negatives, missing keys, string coercion?"

describe('STANDARD_MARKETPLACE_COSTS — published constant shape', () => {
  it('has all 5 required fields, all numeric', () => {
    for (const field of ['commission', 'stampDuty', 'transferFee', 'slippage', 'minCommission']) {
      expect(typeof STANDARD_MARKETPLACE_COSTS[field as keyof typeof STANDARD_MARKETPLACE_COSTS]).toBe('number');
    }
  });

  it('matches the documented 2026 A-share retail baseline', () => {
    expect(STANDARD_MARKETPLACE_COSTS.commission).toBe(0.00025);
    expect(STANDARD_MARKETPLACE_COSTS.stampDuty).toBe(0.0005);
    expect(STANDARD_MARKETPLACE_COSTS.transferFee).toBe(0.00001);
    expect(STANDARD_MARKETPLACE_COSTS.slippage).toBe(0.001);
    expect(STANDARD_MARKETPLACE_COSTS.minCommission).toBe(5);
  });

  it('is frozen — caller cannot mutate the published baseline', () => {
    expect(Object.isFrozen(STANDARD_MARKETPLACE_COSTS)).toBe(true);
    expect(() => {
      // Type cast required to express the runtime mutation attempt that
      // Object.freeze is meant to prevent.
      (STANDARD_MARKETPLACE_COSTS as { commission: number }).commission = 0;
    }).toThrow();
  });
});

describe('assertStandardCosts — happy path', () => {
  it('treats null / undefined as compliant (legacy strategies, no override)', () => {
    expect(assertStandardCosts(null)).toEqual([]);
    expect(assertStandardCosts(undefined)).toEqual([]);
  });

  it('exact match returns empty mismatch list', () => {
    expect(assertStandardCosts({ ...STANDARD_MARKETPLACE_COSTS })).toEqual([]);
  });

  it('always returns an array (caller branches on .length, not truthiness)', () => {
    const result = assertStandardCosts({ ...STANDARD_MARKETPLACE_COSTS });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe('assertStandardCosts — single-field drift', () => {
  it('detects commission tweaked (the classic "zero fee" cheat)', () => {
    const result = assertStandardCosts({ ...STANDARD_MARKETPLACE_COSTS, commission: 0 });
    expect(result).toHaveLength(1);
    expect(result[0]?.field).toBe('commission');
    expect(result[0]?.expected).toBe(0.00025);
    expect(result[0]?.actual).toBe(0);
  });

  it('detects each field independently when only one differs', () => {
    for (const field of [
      'commission',
      'stampDuty',
      'transferFee',
      'slippage',
      'minCommission',
    ] as const) {
      const tweaked = { ...STANDARD_MARKETPLACE_COSTS, [field]: 999 };
      const result = assertStandardCosts(tweaked);
      expect(result).toHaveLength(1);
      expect(result[0]?.field).toBe(field);
    }
  });
});

describe('assertStandardCosts — float tolerance (EPS=1e-9)', () => {
  it('passes when drift is within numerical noise (1e-10)', () => {
    const noisy = { ...STANDARD_MARKETPLACE_COSTS, commission: 0.00025 + 1e-10 };
    expect(assertStandardCosts(noisy)).toEqual([]);
  });

  it('fails when drift exceeds the epsilon (1e-7)', () => {
    const tweaked = { ...STANDARD_MARKETPLACE_COSTS, commission: 0.00025 + 1e-7 };
    expect(assertStandardCosts(tweaked)).not.toEqual([]);
  });

  it('fails when drift is just over the epsilon boundary', () => {
    // 1e-9 + smallest representable increment must be > 1e-9 → fail
    const tweaked = {
      ...STANDARD_MARKETPLACE_COSTS,
      commission: 0.00025 + 1e-9 + 1e-12,
    };
    expect(assertStandardCosts(tweaked)).not.toEqual([]);
  });
});

describe('assertStandardCosts — adversarial inputs', () => {
  it('flags NaN field as mismatch with actual=NaN', () => {
    const tweaked = { ...STANDARD_MARKETPLACE_COSTS, commission: Number.NaN };
    const result = assertStandardCosts(tweaked);
    expect(result).toHaveLength(1);
    expect(Number.isNaN(result[0]?.actual)).toBe(true);
  });

  it('flags Infinity field as mismatch', () => {
    const tweaked = { ...STANDARD_MARKETPLACE_COSTS, commission: Number.POSITIVE_INFINITY };
    const result = assertStandardCosts(tweaked);
    expect(result.length).toBeGreaterThan(0);
  });

  it('flags negative slippage (no "subsidy" via inverted slippage)', () => {
    const tweaked = { ...STANDARD_MARKETPLACE_COSTS, slippage: -0.001 };
    const result = assertStandardCosts(tweaked);
    expect(result).toHaveLength(1);
    expect(result[0]?.field).toBe('slippage');
  });

  it('flags missing field — partial object trips actual=NaN check', () => {
    const partial = {
      commission: 0.00025,
      stampDuty: 0.0005,
      transferFee: 0.00001,
      // slippage missing
      minCommission: 5,
    } as Parameters<typeof assertStandardCosts>[0];
    const result = assertStandardCosts(partial);
    expect(result.find((m) => m.field === 'slippage')).toBeDefined();
  });

  it('flags string-coerced number ("0.001") as mismatch — does not silently coerce', () => {
    // Caller bypassing TS at the boundary (e.g. JSON.parse of user input).
    const tweaked = {
      ...STANDARD_MARKETPLACE_COSTS,
      slippage: '0.001' as unknown as number,
    };
    const result = assertStandardCosts(tweaked);
    expect(result.find((m) => m.field === 'slippage')).toBeDefined();
  });

  it('returns ALL mismatches when every field is off, not just the first', () => {
    const allBad = {
      commission: 0,
      stampDuty: 0,
      transferFee: 0,
      slippage: 0,
      minCommission: 0,
    };
    const result = assertStandardCosts(allBad);
    expect(result).toHaveLength(5);
    expect(new Set(result.map((m) => m.field))).toEqual(
      new Set(['commission', 'stampDuty', 'transferFee', 'slippage', 'minCommission']),
    );
  });
});

// ---------------------------------------------------------------------------
// calculateNetReturn — Net return after costs (95% coverage push)
//
// Test design from two perspectives:
//   USER (回测报告): "Show me what I actually earned, not the pre-fee number."
//   ADVERSARIAL TESTER: "Zero/negative entry, sell direction, lossy trades,
//     micro-cap stocks where minCommission dominates."
// ---------------------------------------------------------------------------

describe('calculateNetReturn', () => {
  it('returns 0 for entryPrice <= 0 (defensive)', () => {
    expect(calculateNetReturn(0, 100, 'buy')).toBe(0);
    expect(calculateNetReturn(-5, 100, 'buy')).toBe(0);
  });

  it('long trade: positive gross return is reduced by costs', () => {
    // Entry 100, exit 110, +10% gross. DEFAULT_COSTS round-trip ≈ 0.262%.
    const net = calculateNetReturn(100, 110, 'buy', DEFAULT_COSTS);
    expect(net).toBeGreaterThan(0); // still profitable after costs
    expect(net).toBeLessThan(10); // but not the full +10%
  });

  it('long trade: loss is amplified (larger magnitude) by costs', () => {
    // -10% gross, costs push it more negative.
    const net = calculateNetReturn(100, 90, 'buy', DEFAULT_COSTS);
    expect(net).toBeLessThan(-10);
  });

  it('short (sell) trade direction inverts gross-return sign', () => {
    // For a "sell" (short) signal, dropping from 100→90 is a +10% gross gain.
    const netShortWin = calculateNetReturn(100, 90, 'sell', DEFAULT_COSTS);
    const netLongWin = calculateNetReturn(100, 110, 'buy', DEFAULT_COSTS);
    expect(netShortWin).toBeGreaterThan(0);
    expect(netLongWin).toBeGreaterThan(0);
  });

  it('zero costs → net == gross', () => {
    const net = calculateNetReturn(100, 110, 'buy', ZERO_COSTS);
    expect(net).toBeCloseTo(10, 6);
  });

  it('flat trade (exit == entry) → only costs (negative)', () => {
    const net = calculateNetReturn(100, 100, 'buy', DEFAULT_COSTS);
    expect(net).toBeLessThan(0); // pure cost drag
    expect(net).toBeGreaterThan(-1); // but bounded
  });

  it('minCommission dominates on tiny prices (micro-cap stocks)', () => {
    // entryPrice = 1, exitPrice = 1.1. commission floor = 5 RMB per side
    // is huge relative to the 100-share lot value (100 * 1 = 100 RMB),
    // so the net should be much worse than the gross.
    const net = calculateNetReturn(1, 1.1, 'buy', DEFAULT_COSTS);
    expect(net).toBeLessThan(10); // gross would have been +10%
  });

  it('uses DEFAULT_COSTS when costs arg is omitted', () => {
    expect(calculateNetReturn(100, 110, 'buy')).toBeCloseTo(
      calculateNetReturn(100, 110, 'buy', DEFAULT_COSTS),
      6,
    );
  });
});

// ---------------------------------------------------------------------------
// validateCostConfig — config sanity (the 95% branches push)
// ---------------------------------------------------------------------------

describe('validateCostConfig — transferFee + minCommission branches', () => {
  it('rejects negative transferFee', () => {
    const result = validateCostConfig({ ...DEFAULT_COSTS, transferFee: -0.0001 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('过户费'))).toBe(true);
  });

  it('rejects transferFee above 0.1%', () => {
    const result = validateCostConfig({ ...DEFAULT_COSTS, transferFee: 0.01 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('过户费'))).toBe(true);
  });

  it('rejects slippage above 5%', () => {
    const result = validateCostConfig({ ...DEFAULT_COSTS, slippage: 0.1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('滑点'))).toBe(true);
  });

  it('rejects minCommission above 100 RMB', () => {
    const result = validateCostConfig({ ...DEFAULT_COSTS, minCommission: 150 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('最低佣金'))).toBe(true);
  });

  it('rejects negative minCommission', () => {
    const result = validateCostConfig({ ...DEFAULT_COSTS, minCommission: -1 });
    expect(result.isValid).toBe(false);
  });
});
