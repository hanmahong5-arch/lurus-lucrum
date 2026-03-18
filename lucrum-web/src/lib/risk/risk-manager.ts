/**
 * Risk Management System
 *
 * Design Philosophy (Two Sigma + Citadel):
 * - Pre-trade risk checks prevent catastrophic losses
 * - Position limits enforce diversification
 * - Real-time monitoring with alerts
 *
 * @module lib/risk/risk-manager
 */

import type { Position, Order, AccountSummary } from '@/lib/stores/trading-store';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Risk limit configuration
 */
export interface RiskLimits {
  /** Maximum value for a single position (in currency) */
  readonly maxPositionValue: number;
  /** Maximum percentage of equity for single position */
  readonly maxPositionPercent: number;
  /** Maximum total exposure (sum of all positions) */
  readonly maxTotalExposure: number;
  /** Maximum exposure as percentage of equity */
  readonly maxExposurePercent: number;
  /** Maximum daily loss before trading halt */
  readonly maxDailyLoss: number;
  /** Maximum daily loss percentage */
  readonly maxDailyLossPercent: number;
  /** Maximum drawdown percentage */
  readonly maxDrawdown: number;
  /** Maximum leverage ratio */
  readonly maxLeverage: number;
  /** Maximum concentration in single asset (%) */
  readonly maxConcentration: number;
  /** Minimum order size */
  readonly minOrderSize: number;
  /** Maximum order size */
  readonly maxOrderSize: number;
  /** Maximum number of open positions */
  readonly maxOpenPositions: number;
}

/**
 * Risk check result
 */
export interface RiskCheck {
  readonly rule: RiskRule;
  readonly passed: boolean;
  readonly message: string;
  readonly currentValue?: number;
  readonly limitValue?: number;
  readonly severity: 'info' | 'warning' | 'critical';
}

/**
 * Risk rule identifier
 */
export type RiskRule =
  | 'MAX_POSITION_VALUE'
  | 'MAX_POSITION_PERCENT'
  | 'MAX_TOTAL_EXPOSURE'
  | 'MAX_EXPOSURE_PERCENT'
  | 'MAX_DAILY_LOSS'
  | 'MAX_DAILY_LOSS_PERCENT'
  | 'MAX_DRAWDOWN'
  | 'MAX_LEVERAGE'
  | 'MAX_CONCENTRATION'
  | 'MIN_ORDER_SIZE'
  | 'MAX_ORDER_SIZE'
  | 'MAX_OPEN_POSITIONS'
  | 'MARGIN_AVAILABLE'
  | 'DUPLICATE_POSITION';

/**
 * Overall risk check result
 */
export interface RiskCheckResult {
  readonly allowed: boolean;
  readonly checks: RiskCheck[];
  readonly blockedBy: RiskRule[];
  readonly warnings: RiskCheck[];
  readonly riskScore: number;
}

/**
 * Order parameters for risk check
 */
export interface OrderRiskParams {
  readonly symbol: string;
  readonly side: 'buy' | 'sell';
  readonly price: number;
  readonly size: number;
  readonly orderValue: number;
}

/**
 * Current portfolio state for risk check
 */
export interface PortfolioState {
  readonly equity: number;
  readonly balance: number;
  readonly marginUsed: number;
  readonly marginAvailable: number;
  readonly positions: Position[];
  readonly dailyPnL: number;
  readonly dailyStartBalance: number;
}

// =============================================================================
// DEFAULT RISK LIMITS
// =============================================================================

/**
 * Conservative risk limits (suitable for retail investors)
 */
export const CONSERVATIVE_LIMITS: RiskLimits = {
  maxPositionValue: 50000,
  maxPositionPercent: 20,
  maxTotalExposure: 200000,
  maxExposurePercent: 80,
  maxDailyLoss: 5000,
  maxDailyLossPercent: 3,
  maxDrawdown: 10,
  maxLeverage: 1,
  maxConcentration: 25,
  minOrderSize: 100,
  maxOrderSize: 10000,
  maxOpenPositions: 10,
};

/**
 * Moderate risk limits (balanced approach)
 */
export const MODERATE_LIMITS: RiskLimits = {
  maxPositionValue: 100000,
  maxPositionPercent: 30,
  maxTotalExposure: 500000,
  maxExposurePercent: 100,
  maxDailyLoss: 10000,
  maxDailyLossPercent: 5,
  maxDrawdown: 15,
  maxLeverage: 2,
  maxConcentration: 35,
  minOrderSize: 100,
  maxOrderSize: 50000,
  maxOpenPositions: 20,
};

/**
 * Aggressive risk limits (for experienced traders)
 */
export const AGGRESSIVE_LIMITS: RiskLimits = {
  maxPositionValue: 250000,
  maxPositionPercent: 50,
  maxTotalExposure: 1000000,
  maxExposurePercent: 150,
  maxDailyLoss: 25000,
  maxDailyLossPercent: 10,
  maxDrawdown: 25,
  maxLeverage: 3,
  maxConcentration: 50,
  minOrderSize: 100,
  maxOrderSize: 100000,
  maxOpenPositions: 50,
};

// =============================================================================
// RISK MANAGER IMPLEMENTATION
// =============================================================================

/**
 * Risk Manager Class
 *
 * Provides pre-trade and post-trade risk validation
 *
 * Usage:
 * ```typescript
 * const riskManager = new RiskManager(CONSERVATIVE_LIMITS);
 * const result = riskManager.validateOrder(orderParams, portfolioState);
 * if (!result.allowed) {
 *   console.log('Order blocked:', result.blockedBy);
 * }
 * ```
 */
export class RiskManager {
  private limits: RiskLimits;
  private onRiskAlert?: (check: RiskCheck) => void;

  constructor(
    limits: RiskLimits = MODERATE_LIMITS,
    options?: { onRiskAlert?: (check: RiskCheck) => void }
  ) {
    this.limits = limits;
    this.onRiskAlert = options?.onRiskAlert;
  }

  /**
   * Update risk limits
   */
  setLimits(limits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Get current risk limits
   */
  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Validate an order against risk limits
   */
  validateOrder(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheckResult {
    const checks: RiskCheck[] = [
      this.checkMinOrderSize(order),
      this.checkMaxOrderSize(order),
      this.checkMaxPositionValue(order, portfolio),
      this.checkMaxPositionPercent(order, portfolio),
      this.checkMaxTotalExposure(order, portfolio),
      this.checkMaxExposurePercent(order, portfolio),
      this.checkMaxConcentration(order, portfolio),
      this.checkMaxOpenPositions(order, portfolio),
      this.checkMarginAvailable(order, portfolio),
      this.checkDailyLoss(portfolio),
      this.checkDuplicatePosition(order, portfolio),
    ];

    const failed = checks.filter((c) => !c.passed);
    const warnings = checks.filter((c) => c.passed && c.severity === 'warning');
    const blockedBy = failed.map((c) => c.rule);

    // Calculate risk score (0-100)
    const riskScore = this.calculateRiskScore(checks, order, portfolio);

    // Trigger alerts for critical issues
    failed
      .filter((c) => c.severity === 'critical')
      .forEach((c) => this.onRiskAlert?.(c));

    return {
      allowed: blockedBy.length === 0,
      checks,
      blockedBy,
      warnings,
      riskScore,
    };
  }

  /**
   * Validate portfolio against risk limits (post-trade check)
   */
  validatePortfolio(portfolio: PortfolioState): RiskCheckResult {
    const checks: RiskCheck[] = [
      this.checkMaxTotalExposurePortfolio(portfolio),
      this.checkMaxExposurePercentPortfolio(portfolio),
      this.checkMaxLeverage(portfolio),
      this.checkMaxDrawdown(portfolio),
      this.checkDailyLoss(portfolio),
      this.checkMaxOpenPositionsPortfolio(portfolio),
      this.checkConcentrationPortfolio(portfolio),
    ];

    const failed = checks.filter((c) => !c.passed);
    const warnings = checks.filter((c) => c.passed && c.severity === 'warning');

    return {
      allowed: failed.length === 0,
      checks,
      blockedBy: failed.map((c) => c.rule),
      warnings,
      riskScore: this.calculatePortfolioRiskScore(portfolio),
    };
  }

  // ===========================================================================
  // INDIVIDUAL RISK CHECKS
  // ===========================================================================

  private checkMinOrderSize(order: OrderRiskParams): RiskCheck {
    const passed = order.size >= this.limits.minOrderSize;
    return {
      rule: 'MIN_ORDER_SIZE',
      passed,
      message: passed
        ? 'Order size meets minimum requirement'
        : `Order size ${order.size} below minimum ${this.limits.minOrderSize}`,
      currentValue: order.size,
      limitValue: this.limits.minOrderSize,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkMaxOrderSize(order: OrderRiskParams): RiskCheck {
    const passed = order.size <= this.limits.maxOrderSize;
    return {
      rule: 'MAX_ORDER_SIZE',
      passed,
      message: passed
        ? 'Order size within limit'
        : `Order size ${order.size} exceeds maximum ${this.limits.maxOrderSize}`,
      currentValue: order.size,
      limitValue: this.limits.maxOrderSize,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkMaxPositionValue(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    // Find existing position for this symbol
    const existingPosition = portfolio.positions.find(
      (p) => p.symbol === order.symbol
    );
    const currentValue = existingPosition
      ? existingPosition.currentPrice * existingPosition.size
      : 0;
    const newTotalValue = currentValue + order.orderValue;

    const passed = newTotalValue <= this.limits.maxPositionValue;
    const severity = passed
      ? newTotalValue > this.limits.maxPositionValue * 0.8
        ? 'warning'
        : 'info'
      : 'critical';

    return {
      rule: 'MAX_POSITION_VALUE',
      passed,
      message: passed
        ? `Position value ${newTotalValue.toFixed(0)} within limit`
        : `Position value ${newTotalValue.toFixed(0)} exceeds limit ${this.limits.maxPositionValue}`,
      currentValue: newTotalValue,
      limitValue: this.limits.maxPositionValue,
      severity,
    };
  }

  private checkMaxPositionPercent(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    if (portfolio.equity <= 0) {
      return {
        rule: 'MAX_POSITION_PERCENT',
        passed: false,
        message: 'Equity is zero or negative',
        severity: 'critical',
      };
    }

    const existingPosition = portfolio.positions.find(
      (p) => p.symbol === order.symbol
    );
    const currentValue = existingPosition
      ? existingPosition.currentPrice * existingPosition.size
      : 0;
    const newTotalValue = currentValue + order.orderValue;
    const percent = (newTotalValue / portfolio.equity) * 100;

    const passed = percent <= this.limits.maxPositionPercent;
    const severity = passed
      ? percent > this.limits.maxPositionPercent * 0.8
        ? 'warning'
        : 'info'
      : 'critical';

    return {
      rule: 'MAX_POSITION_PERCENT',
      passed,
      message: passed
        ? `Position ${percent.toFixed(1)}% of equity within limit`
        : `Position ${percent.toFixed(1)}% exceeds limit ${this.limits.maxPositionPercent}%`,
      currentValue: percent,
      limitValue: this.limits.maxPositionPercent,
      severity,
    };
  }

  private checkMaxTotalExposure(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    const currentExposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const newExposure = currentExposure + order.orderValue;

    const passed = newExposure <= this.limits.maxTotalExposure;

    return {
      rule: 'MAX_TOTAL_EXPOSURE',
      passed,
      message: passed
        ? `Total exposure ${newExposure.toFixed(0)} within limit`
        : `Total exposure ${newExposure.toFixed(0)} exceeds limit ${this.limits.maxTotalExposure}`,
      currentValue: newExposure,
      limitValue: this.limits.maxTotalExposure,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkMaxExposurePercent(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    if (portfolio.equity <= 0) {
      return {
        rule: 'MAX_EXPOSURE_PERCENT',
        passed: false,
        message: 'Equity is zero or negative',
        severity: 'critical',
      };
    }

    const currentExposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const newExposure = currentExposure + order.orderValue;
    const percent = (newExposure / portfolio.equity) * 100;

    const passed = percent <= this.limits.maxExposurePercent;

    return {
      rule: 'MAX_EXPOSURE_PERCENT',
      passed,
      message: passed
        ? `Exposure ${percent.toFixed(1)}% of equity within limit`
        : `Exposure ${percent.toFixed(1)}% exceeds limit ${this.limits.maxExposurePercent}%`,
      currentValue: percent,
      limitValue: this.limits.maxExposurePercent,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkMaxConcentration(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    const totalExposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );

    if (totalExposure === 0 && order.orderValue === 0) {
      return {
        rule: 'MAX_CONCENTRATION',
        passed: true,
        message: 'No positions',
        severity: 'info',
      };
    }

    const existingPosition = portfolio.positions.find(
      (p) => p.symbol === order.symbol
    );
    const currentValue = existingPosition
      ? existingPosition.currentPrice * existingPosition.size
      : 0;
    const newPositionValue = currentValue + order.orderValue;
    const newTotalExposure = totalExposure + order.orderValue;

    const concentration = (newPositionValue / newTotalExposure) * 100;
    const passed = concentration <= this.limits.maxConcentration;

    return {
      rule: 'MAX_CONCENTRATION',
      passed,
      message: passed
        ? `Concentration ${concentration.toFixed(1)}% within limit`
        : `Concentration ${concentration.toFixed(1)}% exceeds limit ${this.limits.maxConcentration}%`,
      currentValue: concentration,
      limitValue: this.limits.maxConcentration,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkMaxOpenPositions(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    const existingPosition = portfolio.positions.find(
      (p) => p.symbol === order.symbol
    );
    const newPositionCount = existingPosition
      ? portfolio.positions.length
      : portfolio.positions.length + 1;

    const passed = newPositionCount <= this.limits.maxOpenPositions;

    return {
      rule: 'MAX_OPEN_POSITIONS',
      passed,
      message: passed
        ? `${newPositionCount} positions within limit`
        : `${newPositionCount} positions exceeds limit ${this.limits.maxOpenPositions}`,
      currentValue: newPositionCount,
      limitValue: this.limits.maxOpenPositions,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkMarginAvailable(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    const requiredMargin = order.orderValue; // Simplified, adjust based on margin requirements
    const passed = requiredMargin <= portfolio.marginAvailable;

    return {
      rule: 'MARGIN_AVAILABLE',
      passed,
      message: passed
        ? `Margin ${portfolio.marginAvailable.toFixed(0)} available`
        : `Insufficient margin: need ${requiredMargin.toFixed(0)}, available ${portfolio.marginAvailable.toFixed(0)}`,
      currentValue: portfolio.marginAvailable,
      limitValue: requiredMargin,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkDailyLoss(portfolio: PortfolioState): RiskCheck {
    const dailyLoss = Math.max(0, -portfolio.dailyPnL);
    const dailyLossPercent =
      portfolio.dailyStartBalance > 0
        ? (dailyLoss / portfolio.dailyStartBalance) * 100
        : 0;

    const passedValue = dailyLoss <= this.limits.maxDailyLoss;
    const passedPercent = dailyLossPercent <= this.limits.maxDailyLossPercent;
    const passed = passedValue && passedPercent;

    return {
      rule: 'MAX_DAILY_LOSS',
      passed,
      message: passed
        ? `Daily loss ${dailyLoss.toFixed(0)} (${dailyLossPercent.toFixed(1)}%) within limits`
        : `Daily loss ${dailyLoss.toFixed(0)} (${dailyLossPercent.toFixed(1)}%) exceeds limits`,
      currentValue: dailyLoss,
      limitValue: this.limits.maxDailyLoss,
      severity: passed
        ? dailyLossPercent > this.limits.maxDailyLossPercent * 0.7
          ? 'warning'
          : 'info'
        : 'critical',
    };
  }

  private checkDuplicatePosition(
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): RiskCheck {
    const existingPosition = portfolio.positions.find(
      (p) => p.symbol === order.symbol
    );

    // Just a warning, not blocking
    const hasExisting = !!existingPosition;

    return {
      rule: 'DUPLICATE_POSITION',
      passed: true, // Always pass, just informational
      message: hasExisting
        ? `Adding to existing position in ${order.symbol}`
        : `New position in ${order.symbol}`,
      severity: hasExisting ? 'warning' : 'info',
    };
  }

  // ===========================================================================
  // PORTFOLIO-LEVEL CHECKS
  // ===========================================================================

  private checkMaxTotalExposurePortfolio(portfolio: PortfolioState): RiskCheck {
    const exposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const passed = exposure <= this.limits.maxTotalExposure;

    return {
      rule: 'MAX_TOTAL_EXPOSURE',
      passed,
      message: passed
        ? `Total exposure ${exposure.toFixed(0)} within limit`
        : `Total exposure ${exposure.toFixed(0)} exceeds limit`,
      currentValue: exposure,
      limitValue: this.limits.maxTotalExposure,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkMaxExposurePercentPortfolio(portfolio: PortfolioState): RiskCheck {
    const exposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const percent = portfolio.equity > 0 ? (exposure / portfolio.equity) * 100 : 0;
    const passed = percent <= this.limits.maxExposurePercent;

    return {
      rule: 'MAX_EXPOSURE_PERCENT',
      passed,
      message: passed
        ? `Exposure ${percent.toFixed(1)}% of equity within limit`
        : `Exposure ${percent.toFixed(1)}% exceeds limit`,
      currentValue: percent,
      limitValue: this.limits.maxExposurePercent,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkMaxLeverage(portfolio: PortfolioState): RiskCheck {
    const exposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const leverage = portfolio.equity > 0 ? exposure / portfolio.equity : 0;
    const passed = leverage <= this.limits.maxLeverage;

    return {
      rule: 'MAX_LEVERAGE',
      passed,
      message: passed
        ? `Leverage ${leverage.toFixed(2)}x within limit`
        : `Leverage ${leverage.toFixed(2)}x exceeds limit ${this.limits.maxLeverage}x`,
      currentValue: leverage,
      limitValue: this.limits.maxLeverage,
      severity: passed ? 'info' : 'critical',
    };
  }

  private checkMaxDrawdown(portfolio: PortfolioState): RiskCheck {
    // Simplified drawdown calculation
    const peakEquity = Math.max(portfolio.dailyStartBalance, portfolio.equity);
    const drawdown =
      peakEquity > 0 ? ((peakEquity - portfolio.equity) / peakEquity) * 100 : 0;
    const passed = drawdown <= this.limits.maxDrawdown;

    return {
      rule: 'MAX_DRAWDOWN',
      passed,
      message: passed
        ? `Drawdown ${drawdown.toFixed(1)}% within limit`
        : `Drawdown ${drawdown.toFixed(1)}% exceeds limit ${this.limits.maxDrawdown}%`,
      currentValue: drawdown,
      limitValue: this.limits.maxDrawdown,
      severity: passed
        ? drawdown > this.limits.maxDrawdown * 0.7
          ? 'warning'
          : 'info'
        : 'critical',
    };
  }

  private checkMaxOpenPositionsPortfolio(portfolio: PortfolioState): RiskCheck {
    const count = portfolio.positions.length;
    const passed = count <= this.limits.maxOpenPositions;

    return {
      rule: 'MAX_OPEN_POSITIONS',
      passed,
      message: passed
        ? `${count} positions within limit`
        : `${count} positions exceeds limit`,
      currentValue: count,
      limitValue: this.limits.maxOpenPositions,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkConcentrationPortfolio(portfolio: PortfolioState): RiskCheck {
    const totalExposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );

    if (totalExposure === 0) {
      return {
        rule: 'MAX_CONCENTRATION',
        passed: true,
        message: 'No positions',
        severity: 'info',
      };
    }

    let maxConcentration = 0;
    portfolio.positions.forEach((p) => {
      const value = p.currentPrice * p.size;
      const concentration = (value / totalExposure) * 100;
      if (concentration > maxConcentration) {
        maxConcentration = concentration;
      }
    });

    const passed = maxConcentration <= this.limits.maxConcentration;

    return {
      rule: 'MAX_CONCENTRATION',
      passed,
      message: passed
        ? `Max concentration ${maxConcentration.toFixed(1)}% within limit`
        : `Max concentration ${maxConcentration.toFixed(1)}% exceeds limit`,
      currentValue: maxConcentration,
      limitValue: this.limits.maxConcentration,
      severity: passed ? 'info' : 'warning',
    };
  }

  // ===========================================================================
  // RISK SCORE CALCULATION
  // ===========================================================================

  private calculateRiskScore(
    checks: RiskCheck[],
    order: OrderRiskParams,
    portfolio: PortfolioState
  ): number {
    let score = 0;

    // Failed critical checks: +30 each
    const criticalFailed = checks.filter(
      (c) => !c.passed && c.severity === 'critical'
    ).length;
    score += criticalFailed * 30;

    // Failed warning checks: +15 each
    const warningFailed = checks.filter(
      (c) => !c.passed && c.severity === 'warning'
    ).length;
    score += warningFailed * 15;

    // Passed warnings: +5 each
    const warningPassed = checks.filter(
      (c) => c.passed && c.severity === 'warning'
    ).length;
    score += warningPassed * 5;

    // Position size relative to equity
    if (portfolio.equity > 0) {
      const positionPercent = (order.orderValue / portfolio.equity) * 100;
      if (positionPercent > 30) score += 20;
      else if (positionPercent > 20) score += 10;
      else if (positionPercent > 10) score += 5;
    }

    return Math.min(100, score);
  }

  private calculatePortfolioRiskScore(portfolio: PortfolioState): number {
    let score = 0;

    // Leverage
    const exposure = portfolio.positions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const leverage = portfolio.equity > 0 ? exposure / portfolio.equity : 0;
    if (leverage > 2) score += 25;
    else if (leverage > 1.5) score += 15;
    else if (leverage > 1) score += 5;

    // Daily loss
    const dailyLossPercent =
      portfolio.dailyStartBalance > 0
        ? (Math.max(0, -portfolio.dailyPnL) / portfolio.dailyStartBalance) * 100
        : 0;
    if (dailyLossPercent > 5) score += 25;
    else if (dailyLossPercent > 3) score += 15;
    else if (dailyLossPercent > 1) score += 5;

    // Concentration
    if (exposure > 0) {
      let maxConcentration = 0;
      portfolio.positions.forEach((p) => {
        const concentration = ((p.currentPrice * p.size) / exposure) * 100;
        if (concentration > maxConcentration) maxConcentration = concentration;
      });
      if (maxConcentration > 50) score += 20;
      else if (maxConcentration > 35) score += 10;
      else if (maxConcentration > 25) score += 5;
    }

    // Number of positions
    if (portfolio.positions.length > 20) score += 10;
    else if (portfolio.positions.length > 15) score += 5;

    // Margin utilization
    const marginUtil =
      portfolio.equity > 0 ? (portfolio.marginUsed / portfolio.equity) * 100 : 0;
    if (marginUtil > 80) score += 20;
    else if (marginUtil > 60) score += 10;
    else if (marginUtil > 40) score += 5;

    return Math.min(100, score);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Default risk manager instance with moderate limits
 */
export const defaultRiskManager = new RiskManager(MODERATE_LIMITS);
