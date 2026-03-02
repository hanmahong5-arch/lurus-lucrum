import { describe, it, expect } from 'vitest';
import {
  FinancialAmount,
  calculateLots,
  lotsToShares,
  sharesToLots,
  calculateCommission,
  calculateStampDuty,
  calculateTransferFee,
  calculateTransactionCost,
  calculateRoundTripCost,
  calculateSlippagePrice,
  isLimitUp,
  isLimitDown,
  calculateLimitUpPrice,
  calculateLimitDownPrice,
  calculateReturn,
  calculateReturnWithCosts,
  calculateAnnualizedReturn,
  calculateCompoundReturn,
  A_SHARE_RULES,
  STAR_RULES,
  CHINEXT_RULES,
} from '../core/financial-math';

describe('FinancialAmount', () => {
  describe('arithmetic operations', () => {
    it('should add two amounts correctly', () => {
      const a = FinancialAmount.from(100.50);
      const b = FinancialAmount.from(50.25);
      const result = a.add(b);
      expect(result.toNumber()).toBe(150.75);
    });

    it('should subtract amounts correctly', () => {
      const a = FinancialAmount.from(100.50);
      const b = FinancialAmount.from(50.25);
      const result = a.subtract(b);
      expect(result.toNumber()).toBe(50.25);
    });

    it('should multiply amount by number', () => {
      const a = FinancialAmount.from(100.50);
      const result = a.multiply(2);
      expect(result.toNumber()).toBe(201.00);
    });

    it('should divide amount by number', () => {
      const a = FinancialAmount.from(100.50);
      const result = a.divide(2);
      expect(result.toNumber()).toBe(50.25);
    });

    it('should maintain precision in complex calculations', () => {
      const a = FinancialAmount.from(0.1);
      const b = FinancialAmount.from(0.2);
      const result = a.add(b);
      expect(result.toNumber()).toBe(0.3);
    });

    it('should handle abs for positive and negative values', () => {
      const positive = FinancialAmount.from(100);
      const negative = FinancialAmount.from(-100);
      expect(positive.abs().toNumber()).toBe(100);
      expect(negative.abs().toNumber()).toBe(100);
    });

    it('should negate amount', () => {
      const a = FinancialAmount.from(100);
      expect(a.negate().toNumber()).toBe(-100);
      expect(a.negate().negate().toNumber()).toBe(100);
    });
  });

  describe('formatting methods', () => {
    it('should format as currency (2dp number)', () => {
      const a = FinancialAmount.from(1234.56);
      expect(a.toCurrency()).toBe(1234.56);
    });

    it('should format as percent (4dp number)', () => {
      const a = FinancialAmount.from(0.1234);
      expect(a.toPercent()).toBe(0.1234);
    });

    it('should format with fixed decimals (number)', () => {
      const a = FinancialAmount.from(1234.5678);
      expect(a.toFixed(2)).toBe(1234.57);
      expect(a.toFixed(0)).toBe(1235);
    });

    it('should convert toString', () => {
      const a = FinancialAmount.from(1234.56);
      expect(a.toString()).toBe('1234.56');
    });
  });

  describe('comparison methods', () => {
    it('should compare greater than', () => {
      const a = FinancialAmount.from(100);
      const b = FinancialAmount.from(50);
      expect(a.gt(b)).toBe(true);
      expect(b.gt(a)).toBe(false);
    });

    it('should compare greater than or equal', () => {
      const a = FinancialAmount.from(100);
      const b = FinancialAmount.from(100);
      const c = FinancialAmount.from(50);
      expect(a.gte(b)).toBe(true);
      expect(a.gte(c)).toBe(true);
      expect(c.gte(a)).toBe(false);
    });

    it('should compare less than', () => {
      const a = FinancialAmount.from(50);
      const b = FinancialAmount.from(100);
      expect(a.lt(b)).toBe(true);
      expect(b.lt(a)).toBe(false);
    });

    it('should compare less than or equal', () => {
      const a = FinancialAmount.from(50);
      const b = FinancialAmount.from(50);
      const c = FinancialAmount.from(100);
      expect(a.lte(b)).toBe(true);
      expect(a.lte(c)).toBe(true);
      expect(c.lte(a)).toBe(false);
    });

    it('should compare equality', () => {
      const a = FinancialAmount.from(100);
      const b = FinancialAmount.from(100);
      const c = FinancialAmount.from(50);
      expect(a.eq(b)).toBe(true);
      expect(a.eq(c)).toBe(false);
    });

    it('should use compareTo correctly', () => {
      const a = FinancialAmount.from(100);
      const b = FinancialAmount.from(50);
      const c = FinancialAmount.from(100);
      expect(a.compareTo(b)).toBeGreaterThan(0);
      expect(b.compareTo(a)).toBeLessThan(0);
      expect(a.compareTo(c)).toBe(0);
    });
  });

  describe('state checking methods', () => {
    it('should check if positive', () => {
      expect(FinancialAmount.from(100).isPositive()).toBe(true);
      expect(FinancialAmount.from(-100).isPositive()).toBe(false);
      // Decimal.js considers 0 as positive
      expect(FinancialAmount.from(0).isPositive()).toBe(true);
    });

    it('should check if negative', () => {
      expect(FinancialAmount.from(-100).isNegative()).toBe(true);
      expect(FinancialAmount.from(100).isNegative()).toBe(false);
      expect(FinancialAmount.from(0).isNegative()).toBe(false);
    });

    it('should check if zero', () => {
      expect(FinancialAmount.from(0).isZero()).toBe(true);
      expect(FinancialAmount.from(100).isZero()).toBe(false);
      expect(FinancialAmount.from(-100).isZero()).toBe(false);
    });
  });

  describe('static methods', () => {
    it('should create from number', () => {
      const a = FinancialAmount.from(123.45);
      expect(a.toNumber()).toBe(123.45);
    });

    it('should create zero', () => {
      const zero = FinancialAmount.zero();
      expect(zero.toNumber()).toBe(0);
      expect(zero.isZero()).toBe(true);
    });

    it('should find maximum', () => {
      const a = FinancialAmount.from(100);
      const b = FinancialAmount.from(200);
      const c = FinancialAmount.from(50);
      const max = FinancialAmount.max(a, b, c);
      expect(max.toNumber()).toBe(200);
    });

    it('should find minimum', () => {
      const a = FinancialAmount.from(100);
      const b = FinancialAmount.from(200);
      const c = FinancialAmount.from(50);
      const min = FinancialAmount.min(a, b, c);
      expect(min.toNumber()).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('should throw error when dividing by zero', () => {
      const a = FinancialAmount.from(100);
      expect(() => a.divide(0)).toThrow();
    });

    it('should use default value in safeDivide when dividing by zero', () => {
      const a = FinancialAmount.from(100);
      const result = a.safeDivide(0, 999);
      expect(result.toNumber()).toBe(999);
    });

    it('should perform safeDivide normally with non-zero divisor', () => {
      const a = FinancialAmount.from(100);
      const result = a.safeDivide(2, 999);
      expect(result.toNumber()).toBe(50);
    });
  });
});

describe('lot calculations', () => {
  it('should calculate lots for normal amount', () => {
    const result = calculateLots(100000, 10, 100);
    expect(result.actualLots).toBe(100);
    expect(result.actualQuantity).toBe(10000);
    expect(result.lotSize).toBe(100);
  });

  it('should handle fractional lots', () => {
    const result = calculateLots(100000, 10.5, 100);
    expect(result.actualLots).toBe(95);
    expect(result.actualQuantity).toBe(9500);
  });

  it('should handle zero price edge case', () => {
    // Division by zero should throw
    expect(() => calculateLots(100000, 0, 100)).toThrow();
  });

  it('should handle large amounts', () => {
    const result = calculateLots(10000000, 50, 100);
    expect(result.actualLots).toBe(2000);
    expect(result.actualQuantity).toBe(200000);
  });

  it('should handle small amount that results in zero lots', () => {
    const result = calculateLots(500, 10, 100);
    expect(result.actualLots).toBe(0);
    expect(result.actualQuantity).toBe(0);
  });
});

describe('share/lot conversions', () => {
  it('should convert lots to shares', () => {
    expect(lotsToShares(10, 100)).toBe(1000);
    expect(lotsToShares(5, 100)).toBe(500);
  });

  it('should convert shares to lots', () => {
    expect(sharesToLots(1000, 100)).toBe(10);
    expect(sharesToLots(500, 100)).toBe(5);
  });

  it('should handle fractional shares to lots', () => {
    expect(sharesToLots(550, 100)).toBe(5);
    expect(sharesToLots(950, 100)).toBe(9);
  });
});

describe('commission calculation', () => {
  it('should calculate normal commission', () => {
    const commission = calculateCommission(100000, 0.0003, 5);
    expect(commission).toBe(30);
  });

  it('should apply minimum fee when calculated fee is too low', () => {
    const commission = calculateCommission(1000, 0.0003, 5);
    expect(commission).toBe(5);
  });

  it('should handle zero amount', () => {
    const commission = calculateCommission(0, 0.0003, 5);
    expect(commission).toBe(5);
  });

  it('should round to 2 decimal places', () => {
    const commission = calculateCommission(123456.78, 0.0003, 5);
    expect(commission).toBe(37.04);
  });
});

describe('stamp duty calculation', () => {
  it('should return zero for buy transactions', () => {
    const duty = calculateStampDuty(100000, false, 0.001);
    expect(duty).toBe(0);
  });

  it('should calculate stamp duty for sell transactions', () => {
    const duty = calculateStampDuty(100000, true, 0.001);
    expect(duty).toBe(100);
  });

  it('should handle zero amount sell', () => {
    const duty = calculateStampDuty(0, true, 0.001);
    expect(duty).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const duty = calculateStampDuty(123456.78, true, 0.001);
    expect(duty).toBe(123.46);
  });
});

describe('transfer fee calculation', () => {
  it('should calculate transfer fee correctly', () => {
    const fee = calculateTransferFee(100000, 0.00001);
    expect(fee).toBe(1);
  });

  it('should round to 2 decimal places', () => {
    const fee = calculateTransferFee(123456.78, 0.00001);
    expect(fee).toBe(1.23);
  });

  it('should handle zero amount', () => {
    const fee = calculateTransferFee(0, 0.00001);
    expect(fee).toBe(0);
  });
});

describe('transaction cost calculation', () => {
  it('should calculate buy transaction costs correctly', () => {
    const cost = calculateTransactionCost(100000, false, A_SHARE_RULES);
    expect(cost.commission).toBe(30);
    expect(cost.stampDuty).toBe(0);
    expect(cost.transferFee).toBe(1);
    expect(cost.total).toBe(31);
    expect(cost.totalPercent).toBeCloseTo(0.031, 3);
  });

  it('should calculate sell transaction costs correctly', () => {
    const cost = calculateTransactionCost(100000, true, A_SHARE_RULES);
    expect(cost.commission).toBe(30);
    expect(cost.stampDuty).toBe(50); // 100000 * 0.0005 = 50 (0.05% since 2023-08-28)
    expect(cost.transferFee).toBe(1);
    expect(cost.total).toBe(81); // 30 + 50 + 1
    expect(cost.totalPercent).toBeCloseTo(0.081, 3);
  });

  it('should verify total equals sum of components', () => {
    const cost = calculateTransactionCost(100000, true, A_SHARE_RULES);
    const sum = cost.commission + cost.stampDuty + cost.transferFee;
    expect(cost.total).toBe(sum);
  });
});

describe('round trip cost calculation', () => {
  it('should calculate combined buy and sell costs', () => {
    const cost = calculateRoundTripCost(100000, A_SHARE_RULES);
    // Buy: commission 30 + transfer 1 = 31
    // Sell: commission 30 + stamp 50 + transfer 1 = 81
    // Total: 112
    expect(cost.total).toBe(112);
    expect(cost.totalPercent).toBeCloseTo(0.112, 3);
  });

  it('should include both buy and sell stamp duty', () => {
    const cost = calculateRoundTripCost(100000, A_SHARE_RULES);
    expect(cost.stampDuty).toBe(50); // Only sell side: 100000 * 0.0005
  });

  it('should double commissions and transfer fees', () => {
    const cost = calculateRoundTripCost(100000, A_SHARE_RULES);
    expect(cost.commission).toBe(60); // 30 * 2
    expect(cost.transferFee).toBe(2); // 1 * 2
  });
});

describe('slippage price calculation', () => {
  it('should increase price for buy orders', () => {
    const price = calculateSlippagePrice(100, 0.01, true);
    expect(price).toBe(101);
  });

  it('should decrease price for sell orders', () => {
    const price = calculateSlippagePrice(100, 0.01, false);
    expect(price).toBe(99);
  });

  it('should handle zero slippage rate', () => {
    expect(calculateSlippagePrice(100, 0, true)).toBe(100);
    expect(calculateSlippagePrice(100, 0, false)).toBe(100);
  });

  it('should round to 2 decimal places', () => {
    const buyPrice = calculateSlippagePrice(100, 0.015, true);
    const sellPrice = calculateSlippagePrice(100, 0.015, false);
    expect(buyPrice).toBe(101.5);
    expect(sellPrice).toBe(98.5);
  });
});

describe('limit up/down detection', () => {
  it('should detect exact 10% limit up', () => {
    expect(isLimitUp(11, 10, 0.1)).toBe(true);
  });

  it('should not detect 9% as limit up', () => {
    expect(isLimitUp(10.9, 10, 0.1)).toBe(false);
  });

  it('should detect limit up with tolerance', () => {
    expect(isLimitUp(10.999, 10, 0.1)).toBe(true); // 9.99% within tolerance
  });

  it('should detect exact 10% limit down', () => {
    expect(isLimitDown(9, 10, 0.1)).toBe(true);
  });

  it('should not detect -9% as limit down', () => {
    expect(isLimitDown(9.1, 10, 0.1)).toBe(false);
  });

  it('should detect limit down with tolerance', () => {
    expect(isLimitDown(9.001, 10, 0.1)).toBe(true); // -9.99% within tolerance
  });

  it('should handle 20% limit for STAR market', () => {
    expect(isLimitUp(12, 10, 0.2)).toBe(true);
    expect(isLimitDown(8, 10, 0.2)).toBe(true);
  });
});

describe('limit price calculation', () => {
  it('should calculate 10% limit up price', () => {
    const price = calculateLimitUpPrice(10, 0.1);
    expect(price).toBe(11);
  });

  it('should calculate 10% limit down price', () => {
    const price = calculateLimitDownPrice(10, 0.1);
    expect(price).toBe(9);
  });

  it('should calculate 20% limit prices for STAR market', () => {
    expect(calculateLimitUpPrice(10, 0.2)).toBe(12);
    expect(calculateLimitDownPrice(10, 0.2)).toBe(8);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateLimitUpPrice(10.55, 0.1)).toBe(11.61);
    expect(calculateLimitDownPrice(10.55, 0.1)).toBe(9.5);
  });
});

describe('return calculation', () => {
  it('should calculate positive return', () => {
    const ret = calculateReturn(100, 110);
    expect(ret).toBeCloseTo(10, 4);
  });

  it('should calculate negative return', () => {
    const ret = calculateReturn(100, 90);
    expect(ret).toBeCloseTo(-10, 4);
  });

  it('should return zero for same entry and exit price', () => {
    const ret = calculateReturn(100, 100);
    expect(ret).toBe(0);
  });

  it('should have 4 decimal precision', () => {
    const ret = calculateReturn(100, 100.1234);
    expect(ret).toBeCloseTo(0.1234, 4);
  });
});

describe('return with costs calculation', () => {
  it('should calculate returns including transaction costs', () => {
    const result = calculateReturnWithCosts(10, 11, 10000, A_SHARE_RULES);
    expect(result.grossReturn).toBeGreaterThan(0);
    expect(result.netReturn).toBeLessThan(result.grossReturn);
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it('should verify net return is less than gross return', () => {
    const result = calculateReturnWithCosts(10, 11, 10000, A_SHARE_RULES);
    expect(result.netReturn).toBeLessThan(result.grossReturn);
  });

  it('should calculate total cost correctly', () => {
    const result = calculateReturnWithCosts(10, 11, 10000, A_SHARE_RULES);
    // Buy 10000 shares at 10 = 100000, sell at 11 = 110000
    // Round trip cost should be > 0
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it('should handle negative returns with costs', () => {
    const result = calculateReturnWithCosts(10, 9, 10000, A_SHARE_RULES);
    expect(result.grossReturn).toBeLessThan(0);
    expect(result.netReturn).toBeLessThan(result.grossReturn);
  });
});

describe('annualized return calculation', () => {
  it('should calculate return for less than one year', () => {
    // 10% in 100 days → annualized > 10%
    const annualized = calculateAnnualizedReturn(10, 100, 250);
    expect(annualized).toBeGreaterThan(10);
  });

  it('should calculate return for exactly one year', () => {
    // 10% in 250 days = 10% annualized
    const annualized = calculateAnnualizedReturn(10, 250, 250);
    expect(annualized).toBeCloseTo(10, 2);
  });

  it('should calculate return for more than one year', () => {
    // 50% in 500 days (2 years) → annualized < 50%
    const annualized = calculateAnnualizedReturn(50, 500, 250);
    expect(annualized).toBeLessThan(50);
  });

  it('should return zero for zero or negative trading days', () => {
    expect(calculateAnnualizedReturn(10, 0, 250)).toBe(0);
    expect(calculateAnnualizedReturn(10, -10, 250)).toBe(0);
  });

  it('should return -100 for total loss', () => {
    // -100% = total loss
    const annualized = calculateAnnualizedReturn(-100, 250, 250);
    expect(annualized).toBe(-100);
  });

  it('should return -100 for returns less than -100%', () => {
    const annualized = calculateAnnualizedReturn(-150, 250, 250);
    expect(annualized).toBe(-100);
  });
});

describe('compound return calculation', () => {
  it('should return zero for empty array', () => {
    const compound = calculateCompoundReturn([]);
    expect(compound).toBe(0);
  });

  it('should calculate single return correctly', () => {
    // Input/output in percentage: 10 means 10%
    const compound = calculateCompoundReturn([10]);
    expect(compound).toBeCloseTo(10, 2);
  });

  it('should compound multiple positive returns', () => {
    // (1.10 * 1.20 * 1.15) - 1 = 0.518 → 51.8%
    const compound = calculateCompoundReturn([10, 20, 15]);
    expect(compound).toBeCloseTo(51.8, 0);
  });

  it('should handle negative returns', () => {
    // (1.10 * 0.95 * 1.15) - 1 = 0.20175 → 20.175%
    const compound = calculateCompoundReturn([10, -5, 15]);
    expect(compound).toBeCloseTo(20.175, 1);
  });

  it('should handle all negative returns', () => {
    // (0.90 * 0.80 * 0.85) - 1 = -0.388 → -38.8%
    const compound = calculateCompoundReturn([-10, -20, -15]);
    expect(compound).toBeCloseTo(-38.8, 0);
  });

  it('should handle mix of large positive and negative returns', () => {
    // (1.50 * 0.70 * 1.20) - 1 = 0.26 → 26%
    const compound = calculateCompoundReturn([50, -30, 20]);
    expect(compound).toBeCloseTo(26, 0);
  });
});

describe('rule constants', () => {
  it('should have A_SHARE_RULES defined', () => {
    expect(A_SHARE_RULES).toBeDefined();
    expect(A_SHARE_RULES.commissionRate).toBe(0.0003);
    expect(A_SHARE_RULES.minCommission).toBe(5);
    expect(A_SHARE_RULES.priceLimit).toBe(0.1);
  });

  it('should have STAR_RULES defined', () => {
    expect(STAR_RULES).toBeDefined();
    expect(STAR_RULES.priceLimit).toBe(0.2);
    expect(STAR_RULES.lotSize).toBe(200);
  });

  it('should have CHINEXT_RULES defined', () => {
    expect(CHINEXT_RULES).toBeDefined();
    expect(CHINEXT_RULES.priceLimit).toBe(0.2);
  });
});
