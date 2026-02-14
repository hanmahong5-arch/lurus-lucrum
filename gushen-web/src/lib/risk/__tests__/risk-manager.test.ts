/**
 * Tests for lib/risk/risk-manager.ts
 *
 * Covers RiskManager order validation, portfolio validation, risk scoring
 */
import { describe, it, expect, vi } from 'vitest';
import {
  RiskManager,
  CONSERVATIVE_LIMITS,
  MODERATE_LIMITS,
  AGGRESSIVE_LIMITS,
  type OrderRiskParams,
  type PortfolioState,
  type RiskLimits,
} from '../risk-manager';

// =============================================================================
// Test Fixtures
// =============================================================================

function makePortfolio(overrides: Partial<PortfolioState> = {}): PortfolioState {
  return {
    equity: 100000,
    balance: 80000,
    marginUsed: 20000,
    marginAvailable: 60000,
    positions: [],
    dailyPnL: 0,
    dailyStartBalance: 100000,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderRiskParams> = {}): OrderRiskParams {
  return {
    symbol: '600519',
    side: 'buy',
    price: 1800,
    size: 100,
    orderValue: 180000,
    ...overrides,
  };
}

// =============================================================================
// Risk Limits Constants
// =============================================================================

describe('Risk Limits Constants', () => {
  it('should define conservative limits with restrictive values', () => {
    expect(CONSERVATIVE_LIMITS.maxPositionPercent).toBe(20);
    expect(CONSERVATIVE_LIMITS.maxLeverage).toBe(1);
    expect(CONSERVATIVE_LIMITS.maxDailyLossPercent).toBe(3);
  });

  it('should define moderate limits', () => {
    expect(MODERATE_LIMITS.maxPositionPercent).toBe(30);
    expect(MODERATE_LIMITS.maxLeverage).toBe(2);
  });

  it('should define aggressive limits with higher thresholds', () => {
    expect(AGGRESSIVE_LIMITS.maxPositionPercent).toBe(50);
    expect(AGGRESSIVE_LIMITS.maxLeverage).toBe(3);
    expect(AGGRESSIVE_LIMITS.maxDailyLossPercent).toBe(10);
  });

  it('conservative should be more restrictive than moderate', () => {
    expect(CONSERVATIVE_LIMITS.maxPositionValue).toBeLessThan(MODERATE_LIMITS.maxPositionValue);
    expect(CONSERVATIVE_LIMITS.maxTotalExposure).toBeLessThan(MODERATE_LIMITS.maxTotalExposure);
  });

  it('moderate should be more restrictive than aggressive', () => {
    expect(MODERATE_LIMITS.maxPositionValue).toBeLessThan(AGGRESSIVE_LIMITS.maxPositionValue);
    expect(MODERATE_LIMITS.maxTotalExposure).toBeLessThan(AGGRESSIVE_LIMITS.maxTotalExposure);
  });
});

// =============================================================================
// RiskManager Construction
// =============================================================================

describe('RiskManager', () => {
  describe('constructor', () => {
    it('should use moderate limits by default', () => {
      const rm = new RiskManager();
      const limits = rm.getLimits();
      expect(limits.maxPositionPercent).toBe(MODERATE_LIMITS.maxPositionPercent);
    });

    it('should accept custom limits', () => {
      const rm = new RiskManager(CONSERVATIVE_LIMITS);
      const limits = rm.getLimits();
      expect(limits.maxPositionPercent).toBe(CONSERVATIVE_LIMITS.maxPositionPercent);
    });
  });

  describe('setLimits', () => {
    it('should update limits partially', () => {
      const rm = new RiskManager(MODERATE_LIMITS);
      rm.setLimits({ maxPositionValue: 99999 });
      const limits = rm.getLimits();
      expect(limits.maxPositionValue).toBe(99999);
      // Other limits should remain
      expect(limits.maxPositionPercent).toBe(MODERATE_LIMITS.maxPositionPercent);
    });
  });

  describe('getLimits', () => {
    it('should return a copy of limits', () => {
      const rm = new RiskManager(MODERATE_LIMITS);
      const limits = rm.getLimits();
      limits.maxPositionValue = 999;
      // Original should not be affected
      expect(rm.getLimits().maxPositionValue).toBe(MODERATE_LIMITS.maxPositionValue);
    });
  });
});

// =============================================================================
// Order Validation
// =============================================================================

describe('RiskManager.validateOrder', () => {
  const rm = new RiskManager(CONSERVATIVE_LIMITS);

  it('should allow valid small order with diversified portfolio', () => {
    // With existing positions, adding a new small one should not trigger concentration limit
    const portfolio = makePortfolio({
      equity: 500000,
      marginAvailable: 400000,
      positions: [
        { symbol: '000858', size: 500, currentPrice: 100, entryPrice: 95, unrealizedPnl: 2500, side: 'long' } as any,
        { symbol: '601398', size: 1000, currentPrice: 50, entryPrice: 48, unrealizedPnl: 2000, side: 'long' } as any,
      ],
    });
    // Existing exposure: 500*100 + 1000*50 = 100000
    // New exposure: 100000 + 10000 = 110000
    // Concentration: 10000/110000 ~ 9.1% (below 25%)
    const order = makeOrder({ size: 200, orderValue: 10000 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(true);
    expect(result.blockedBy).toHaveLength(0);
  });

  it('should block order below min size', () => {
    const portfolio = makePortfolio();
    const order = makeOrder({ size: 50, orderValue: 9000 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain('MIN_ORDER_SIZE');
  });

  it('should block order above max size', () => {
    const portfolio = makePortfolio({ equity: 1000000, marginAvailable: 800000 });
    const order = makeOrder({ size: 20000, orderValue: 36000000 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain('MAX_ORDER_SIZE');
  });

  it('should block order exceeding max position value', () => {
    const portfolio = makePortfolio({ equity: 100000, marginAvailable: 80000 });
    // CONSERVATIVE_LIMITS.maxPositionValue = 50000
    const order = makeOrder({ orderValue: 60000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain('MAX_POSITION_VALUE');
  });

  it('should block order exceeding max position percent', () => {
    const portfolio = makePortfolio({ equity: 100000, marginAvailable: 80000 });
    // CONSERVATIVE_LIMITS.maxPositionPercent = 20, so 25000 > 20%
    const order = makeOrder({ orderValue: 25000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain('MAX_POSITION_PERCENT');
  });

  it('should block order when equity is zero', () => {
    const portfolio = makePortfolio({ equity: 0, marginAvailable: 0 });
    const order = makeOrder({ orderValue: 1000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
  });

  it('should block order when insufficient margin', () => {
    const portfolio = makePortfolio({ marginAvailable: 1000 });
    const order = makeOrder({ orderValue: 5000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain('MARGIN_AVAILABLE');
  });

  it('should include daily loss check', () => {
    // CONSERVATIVE maxDailyLoss = 5000
    const portfolio = makePortfolio({ dailyPnL: -6000 });
    const order = makeOrder({ orderValue: 1000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain('MAX_DAILY_LOSS');
  });

  it('should report existing position as warning (not blocking)', () => {
    const portfolio = makePortfolio({
      equity: 500000,
      marginAvailable: 400000,
      positions: [
        { symbol: '600519', size: 100, currentPrice: 1800, entryPrice: 1750, unrealizedPnl: 5000, side: 'long' } as any,
      ],
    });
    const order = makeOrder({ symbol: '600519', orderValue: 10000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    const dupCheck = result.checks.find(c => c.rule === 'DUPLICATE_POSITION');
    expect(dupCheck).toBeDefined();
    expect(dupCheck!.passed).toBe(true);
    expect(dupCheck!.severity).toBe('warning');
  });

  it('should calculate risk score between 0-100', () => {
    const portfolio = makePortfolio({ equity: 500000, marginAvailable: 400000 });
    const order = makeOrder({ orderValue: 10000, size: 100 });
    const result = rm.validateOrder(order, portfolio);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// Portfolio Validation
// =============================================================================

describe('RiskManager.validatePortfolio', () => {
  const rm = new RiskManager(CONSERVATIVE_LIMITS);

  it('should pass for empty portfolio', () => {
    const portfolio = makePortfolio();
    const result = rm.validatePortfolio(portfolio);
    expect(result.allowed).toBe(true);
  });

  it('should detect excessive leverage', () => {
    const portfolio = makePortfolio({
      equity: 100000,
      positions: [
        { symbol: '600519', size: 200, currentPrice: 1000, entryPrice: 900, unrealizedPnl: 20000, side: 'long' } as any,
      ],
    });
    // Exposure = 200 * 1000 = 200000, equity = 100000, leverage = 2
    // CONSERVATIVE maxLeverage = 1
    const result = rm.validatePortfolio(portfolio);
    expect(result.blockedBy).toContain('MAX_LEVERAGE');
  });

  it('should detect daily loss breach', () => {
    const portfolio = makePortfolio({
      dailyPnL: -6000,
      dailyStartBalance: 100000,
    });
    const result = rm.validatePortfolio(portfolio);
    expect(result.blockedBy).toContain('MAX_DAILY_LOSS');
  });

  it('should detect excessive total exposure', () => {
    // CONSERVATIVE maxTotalExposure = 200000
    const portfolio = makePortfolio({
      positions: [
        { symbol: '600519', size: 200, currentPrice: 1500, entryPrice: 1400, unrealizedPnl: 0, side: 'long' } as any,
      ],
    });
    // Exposure = 200 * 1500 = 300000 > 200000
    const result = rm.validatePortfolio(portfolio);
    expect(result.blockedBy).toContain('MAX_TOTAL_EXPOSURE');
  });

  it('should calculate portfolio risk score between 0-100', () => {
    const portfolio = makePortfolio();
    const result = rm.validatePortfolio(portfolio);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// Risk Alert Callback
// =============================================================================

describe('RiskManager alert callback', () => {
  it('should trigger onRiskAlert for critical failures', () => {
    const alertFn = vi.fn();
    const rm = new RiskManager(CONSERVATIVE_LIMITS, { onRiskAlert: alertFn });

    const portfolio = makePortfolio({ equity: 0, marginAvailable: 0 });
    const order = makeOrder({ orderValue: 1000, size: 100 });
    rm.validateOrder(order, portfolio);

    expect(alertFn).toHaveBeenCalled();
    const call = alertFn.mock.calls[0]?.[0];
    expect(call?.severity).toBe('critical');
  });
});
