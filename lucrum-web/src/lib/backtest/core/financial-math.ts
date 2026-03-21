/**
 * Financial Math Utilities
 * 金融数学工具
 *
 * Provides precise financial calculations using Decimal.js
 * 使用Decimal.js提供精确的金融计算
 *
 * @module lib/backtest/core/financial-math
 */

import Decimal from "decimal.js";

// =============================================================================
// DECIMAL CONFIGURATION / Decimal配置
// =============================================================================

// Configure Decimal for financial calculations
Decimal.set({
  precision: 20,           // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP, // Standard financial rounding
  toExpNeg: -9,           // Prevent scientific notation for small numbers
  toExpPos: 15,           // Prevent scientific notation for large numbers
});

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Lot calculation result
 * 手数计算结果
 */
export interface LotCalculationResult {
  /** Original requested quantity (原始请求数量) */
  requestedQuantity: number;
  /** Actual lots (实际手数) */
  actualLots: number;
  /** Actual quantity after rounding (圆整后实际数量) */
  actualQuantity: number;
  /** Lot size (每手股数) */
  lotSize: number;
  /** Rounding loss in currency (圆整损失金额) */
  roundingLoss: number;
  /** Rounding loss percentage (圆整损失百分比) */
  roundingLossPercent: number;
}

/**
 * Transaction cost breakdown
 * 交易成本明细
 */
export interface TransactionCost {
  /** Commission (手续费) */
  commission: number;
  /** Stamp duty - sell only (印花税 - 仅卖出) */
  stampDuty: number;
  /** Transfer fee (过户费) */
  transferFee: number;
  /** Total cost (总成本) */
  total: number;
  /** Total cost as percentage (总成本百分比) */
  totalPercent: number;
}

/**
 * A-share market rules
 * A股市场规则
 */
export interface MarketRules {
  /** Lot size (每手股数) */
  lotSize: number;
  /** Commission rate (手续费率) */
  commissionRate: number;
  /** Minimum commission (最低手续费) */
  minCommission: number;
  /** Stamp duty rate for sell (卖出印花税率) */
  stampDutyRate: number;
  /** Transfer fee rate (过户费率) */
  transferFeeRate: number;
  /** Price limit percentage (涨跌停幅度) */
  priceLimit: number;
}

// =============================================================================
// MARKET RULES / 市场规则
// =============================================================================

/** Default A-share market rules (A股默认规则) */
export const A_SHARE_RULES: MarketRules = {
  lotSize: 100,
  commissionRate: 0.0003,    // 0.03% (万三)
  minCommission: 5,          // 5元最低
  stampDutyRate: 0.0005,     // 0.05% 印花税 (2023-08-28起)
  transferFeeRate: 0.00001,  // 0.001% 过户费
  priceLimit: 0.1,           // 10% 涨跌停
};

/** Science and Technology Innovation Board rules (科创板规则) */
export const STAR_RULES: MarketRules = {
  ...A_SHARE_RULES,
  lotSize: 200,              // 科创板200股起
  priceLimit: 0.2,           // 20% 涨跌停
};

/** ChiNext Board rules (创业板规则) */
export const CHINEXT_RULES: MarketRules = {
  ...A_SHARE_RULES,
  priceLimit: 0.2,           // 20% 涨跌停
};

// =============================================================================
// FINANCIAL AMOUNT CLASS / 金融金额类
// =============================================================================

/**
 * Financial Amount class with precise calculations
 * 金融金额类，提供精确计算
 */
export class FinancialAmount {
  private readonly value: Decimal;

  constructor(value: number | string | Decimal | FinancialAmount) {
    if (value instanceof FinancialAmount) {
      this.value = value.value;
    } else {
      this.value = new Decimal(value);
    }
  }

  /**
   * Add another amount
   * 加法
   */
  add(other: FinancialAmount | number | string): FinancialAmount {
    const otherValue = other instanceof FinancialAmount ? other.value : new Decimal(other);
    return new FinancialAmount(this.value.plus(otherValue));
  }

  /**
   * Subtract another amount
   * 减法
   */
  subtract(other: FinancialAmount | number | string): FinancialAmount {
    const otherValue = other instanceof FinancialAmount ? other.value : new Decimal(other);
    return new FinancialAmount(this.value.minus(otherValue));
  }

  /**
   * Multiply by another amount or number
   * 乘法
   */
  multiply(other: FinancialAmount | number | string): FinancialAmount {
    const otherValue = other instanceof FinancialAmount ? other.value : new Decimal(other);
    return new FinancialAmount(this.value.times(otherValue));
  }

  /**
   * Divide by another amount or number
   * 除法
   */
  divide(other: FinancialAmount | number | string): FinancialAmount {
    const otherValue = other instanceof FinancialAmount ? other.value : new Decimal(other);
    if (otherValue.isZero()) {
      throw new Error("Division by zero");
    }
    return new FinancialAmount(this.value.dividedBy(otherValue));
  }

  /**
   * Safe divide (returns default on zero divisor)
   * 安全除法（除零时返回默认值）
   */
  safeDivide(other: FinancialAmount | number | string, defaultValue: number = 0): FinancialAmount {
    const otherValue = other instanceof FinancialAmount ? other.value : new Decimal(other);
    if (otherValue.isZero()) {
      return new FinancialAmount(defaultValue);
    }
    return new FinancialAmount(this.value.dividedBy(otherValue));
  }

  /**
   * Get absolute value
   * 绝对值
   */
  abs(): FinancialAmount {
    return new FinancialAmount(this.value.abs());
  }

  /**
   * Negate value
   * 取反
   */
  negate(): FinancialAmount {
    return new FinancialAmount(this.value.negated());
  }

  /**
   * Round to currency precision (2 decimal places for CNY)
   * 舍入到货币精度（人民币2位小数）
   */
  toCurrency(): number {
    return this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Round to percentage precision (4 decimal places)
   * 舍入到百分比精度（4位小数）
   */
  toPercent(): number {
    return this.value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Round to specified decimal places
   * 舍入到指定小数位
   */
  toFixed(decimalPlaces: number): number {
    return this.value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Get raw number value
   * 获取原始数值
   */
  toNumber(): number {
    return this.value.toNumber();
  }

  /**
   * Get string representation
   * 获取字符串表示
   */
  toString(): string {
    return this.value.toString();
  }

  /**
   * Check if positive
   * 检查是否为正
   */
  isPositive(): boolean {
    return this.value.isPositive();
  }

  /**
   * Check if negative
   * 检查是否为负
   */
  isNegative(): boolean {
    return this.value.isNegative();
  }

  /**
   * Check if zero
   * 检查是否为零
   */
  isZero(): boolean {
    return this.value.isZero();
  }

  /**
   * Compare to another value
   * 与另一个值比较
   * @returns -1 if less, 0 if equal, 1 if greater
   */
  compareTo(other: FinancialAmount | number | string): number {
    const otherValue = other instanceof FinancialAmount ? other.value : new Decimal(other);
    return this.value.comparedTo(otherValue);
  }

  /**
   * Check if greater than
   * 是否大于
   */
  gt(other: FinancialAmount | number | string): boolean {
    return this.compareTo(other) > 0;
  }

  /**
   * Check if greater than or equal
   * 是否大于等于
   */
  gte(other: FinancialAmount | number | string): boolean {
    return this.compareTo(other) >= 0;
  }

  /**
   * Check if less than
   * 是否小于
   */
  lt(other: FinancialAmount | number | string): boolean {
    return this.compareTo(other) < 0;
  }

  /**
   * Check if less than or equal
   * 是否小于等于
   */
  lte(other: FinancialAmount | number | string): boolean {
    return this.compareTo(other) <= 0;
  }

  /**
   * Check if equal
   * 是否相等
   */
  eq(other: FinancialAmount | number | string): boolean {
    return this.compareTo(other) === 0;
  }

  /**
   * Get maximum of values
   * 获取最大值
   */
  static max(...values: FinancialAmount[]): FinancialAmount {
    return values.reduce((max, v) => (v.gt(max) ? v : max));
  }

  /**
   * Get minimum of values
   * 获取最小值
   */
  static min(...values: FinancialAmount[]): FinancialAmount {
    return values.reduce((min, v) => (v.lt(min) ? v : min));
  }

  /**
   * Create from number
   * 从数字创建
   */
  static from(value: number | string): FinancialAmount {
    return new FinancialAmount(value);
  }

  /**
   * Create zero
   * 创建零值
   */
  static zero(): FinancialAmount {
    return new FinancialAmount(0);
  }
}

// =============================================================================
// LOT CALCULATION / 手数计算
// =============================================================================

/**
 * Calculate lot-adjusted quantity for A-share trading
 * 计算A股交易的手数调整数量
 *
 * @param requestedAmount - Amount in CNY to invest (要投资的金额)
 * @param price - Stock price (股票价格)
 * @param lotSize - Shares per lot (每手股数)
 * @returns Lot calculation result (手数计算结果)
 */
export function calculateLots(
  requestedAmount: number,
  price: number,
  lotSize: number = A_SHARE_RULES.lotSize
): LotCalculationResult {
  const amount = new FinancialAmount(requestedAmount);
  const priceFA = new FinancialAmount(price);

  // Calculate how many shares we could buy
  const requestedShares = Math.floor(amount.divide(priceFA).toNumber());

  // Round down to lot size
  const actualLots = Math.floor(requestedShares / lotSize);
  const actualQuantity = actualLots * lotSize;

  // Calculate actual amount and rounding loss
  const actualAmount = new FinancialAmount(actualQuantity).multiply(priceFA);
  const roundingLoss = amount.subtract(actualAmount);

  return {
    requestedQuantity: requestedShares,
    actualLots,
    actualQuantity,
    lotSize,
    roundingLoss: roundingLoss.toCurrency(),
    roundingLossPercent: actualQuantity > 0
      ? roundingLoss.divide(amount).multiply(100).toPercent()
      : 0,
  };
}

/**
 * Calculate shares from lot count
 * 从手数计算股数
 */
export function lotsToShares(lots: number, lotSize: number = A_SHARE_RULES.lotSize): number {
  return lots * lotSize;
}

/**
 * Calculate lots from shares
 * 从股数计算手数
 */
export function sharesToLots(shares: number, lotSize: number = A_SHARE_RULES.lotSize): number {
  return Math.floor(shares / lotSize);
}

// =============================================================================
// TRANSACTION COST CALCULATION / 交易成本计算
// =============================================================================

/**
 * Calculate commission with minimum fee
 * 计算手续费（含最低费用）
 */
export function calculateCommission(
  amount: number,
  rate: number = A_SHARE_RULES.commissionRate,
  minFee: number = A_SHARE_RULES.minCommission
): number {
  const commission = new FinancialAmount(amount).multiply(rate);
  return Math.max(commission.toCurrency(), minFee);
}

/**
 * Calculate stamp duty (sell only in A-share market)
 * 计算印花税（A股仅卖出时收取）
 */
export function calculateStampDuty(
  amount: number,
  isSell: boolean,
  rate: number = A_SHARE_RULES.stampDutyRate
): number {
  if (!isSell) return 0;
  return new FinancialAmount(amount).multiply(rate).toCurrency();
}

/**
 * Calculate transfer fee
 * 计算过户费
 */
export function calculateTransferFee(
  amount: number,
  rate: number = A_SHARE_RULES.transferFeeRate
): number {
  return new FinancialAmount(amount).multiply(rate).toCurrency();
}

/**
 * Calculate total transaction cost
 * 计算总交易成本
 */
export function calculateTransactionCost(
  amount: number,
  isSell: boolean,
  rules: MarketRules = A_SHARE_RULES
): TransactionCost {
  const commission = calculateCommission(amount, rules.commissionRate, rules.minCommission);
  const stampDuty = calculateStampDuty(amount, isSell, rules.stampDutyRate);
  const transferFee = calculateTransferFee(amount, rules.transferFeeRate);

  const total = new FinancialAmount(commission)
    .add(stampDuty)
    .add(transferFee)
    .toCurrency();

  const totalPercent = amount > 0
    ? new FinancialAmount(total).divide(amount).multiply(100).toPercent()
    : 0;

  return {
    commission,
    stampDuty,
    transferFee,
    total,
    totalPercent,
  };
}

/**
 * Calculate round-trip cost (buy + sell)
 * 计算往返成本（买入+卖出）
 */
export function calculateRoundTripCost(
  amount: number,
  rules: MarketRules = A_SHARE_RULES
): TransactionCost {
  const buyCost = calculateTransactionCost(amount, false, rules);
  const sellCost = calculateTransactionCost(amount, true, rules);

  const total = new FinancialAmount(buyCost.total).add(sellCost.total).toCurrency();

  return {
    commission: new FinancialAmount(buyCost.commission).add(sellCost.commission).toCurrency(),
    stampDuty: sellCost.stampDuty, // Only sell has stamp duty
    transferFee: new FinancialAmount(buyCost.transferFee).add(sellCost.transferFee).toCurrency(),
    total,
    totalPercent: amount > 0
      ? new FinancialAmount(total).divide(amount).multiply(100).toPercent()
      : 0,
  };
}

// =============================================================================
// PRICE CALCULATION / 价格计算
// =============================================================================

/**
 * Calculate price with slippage
 * 计算含滑点的价格
 */
export function calculateSlippagePrice(
  basePrice: number,
  slippageRate: number,
  isBuy: boolean
): number {
  const direction = isBuy ? 1 : -1;
  const slippage = new FinancialAmount(basePrice).multiply(slippageRate).multiply(direction);
  return new FinancialAmount(basePrice).add(slippage).toFixed(2);
}

/**
 * Check if price is at limit up
 * 检查是否涨停
 */
export function isLimitUp(
  currentPrice: number,
  prevClose: number,
  limitRate: number = A_SHARE_RULES.priceLimit
): boolean {
  const changePercent = new FinancialAmount(currentPrice)
    .subtract(prevClose)
    .divide(prevClose)
    .toNumber();
  return changePercent >= limitRate - 0.001; // Allow small tolerance
}

/**
 * Check if price is at limit down
 * 检查是否跌停
 */
export function isLimitDown(
  currentPrice: number,
  prevClose: number,
  limitRate: number = A_SHARE_RULES.priceLimit
): boolean {
  const changePercent = new FinancialAmount(currentPrice)
    .subtract(prevClose)
    .divide(prevClose)
    .toNumber();
  return changePercent <= -limitRate + 0.001; // Allow small tolerance
}

/**
 * Calculate limit up price
 * 计算涨停价
 */
export function calculateLimitUpPrice(
  prevClose: number,
  limitRate: number = A_SHARE_RULES.priceLimit
): number {
  return new FinancialAmount(prevClose).multiply(1 + limitRate).toFixed(2);
}

/**
 * Calculate limit down price
 * 计算跌停价
 */
export function calculateLimitDownPrice(
  prevClose: number,
  limitRate: number = A_SHARE_RULES.priceLimit
): number {
  return new FinancialAmount(prevClose).multiply(1 - limitRate).toFixed(2);
}

// =============================================================================
// RETURN CALCULATION / 收益计算
// =============================================================================

/**
 * Calculate return percentage
 * 计算收益率
 */
export function calculateReturn(entryPrice: number, exitPrice: number): number {
  return new FinancialAmount(exitPrice)
    .subtract(entryPrice)
    .divide(entryPrice)
    .multiply(100)
    .toPercent();
}

/**
 * Calculate return with costs
 * 计算含成本的收益率
 */
export function calculateReturnWithCosts(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  rules: MarketRules = A_SHARE_RULES
): { grossReturn: number; netReturn: number; totalCost: number } {
  const entryAmount = new FinancialAmount(entryPrice).multiply(quantity);
  const exitAmount = new FinancialAmount(exitPrice).multiply(quantity);

  const buyCost = calculateTransactionCost(entryAmount.toNumber(), false, rules);
  const sellCost = calculateTransactionCost(exitAmount.toNumber(), true, rules);
  const totalCost = buyCost.total + sellCost.total;

  const grossReturn = exitAmount
    .subtract(entryAmount)
    .divide(entryAmount)
    .multiply(100)
    .toPercent();

  const netPnL = exitAmount.subtract(entryAmount).subtract(totalCost);
  const netReturn = netPnL.divide(entryAmount).multiply(100).toPercent();

  return {
    grossReturn,
    netReturn,
    totalCost,
  };
}

/**
 * Calculate annualized return
 * 计算年化收益率
 */
export function calculateAnnualizedReturn(
  totalReturn: number,
  tradingDays: number,
  tradingDaysPerYear: number = 250
): number {
  if (tradingDays <= 0) return 0;

  const years = tradingDays / tradingDaysPerYear;
  const returnRate = 1 + totalReturn / 100;

  // Handle negative returns
  if (returnRate <= 0) {
    return -100; // Total loss
  }

  // (1 + r)^(1/years) - 1
  const annualizedRate = Math.pow(returnRate, 1 / years) - 1;
  return new FinancialAmount(annualizedRate).multiply(100).toPercent();
}

/**
 * Calculate compound return
 * 计算复合收益率
 */
export function calculateCompoundReturn(returns: number[]): number {
  if (returns.length === 0) return 0;

  let compound = new FinancialAmount(1);
  for (const r of returns) {
    compound = compound.multiply(1 + r / 100);
  }

  return compound.subtract(1).multiply(100).toPercent();
}

// =============================================================================
// INCREMENTAL INDICATOR CALCULATORS / 增量指标计算器
// =============================================================================

/**
 * Incremental SMA calculator - O(1) per bar instead of O(window) per bar.
 * Maintains a running sum and circular buffer.
 *
 * Usage:
 *   const sma = new IncrementalSMA(20);
 *   for (const price of prices) {
 *     const value = sma.update(price); // null until window is full
 *   }
 */
export class IncrementalSMA {
  private buffer: number[] = [];
  private sum = 0;
  private index = 0;
  private full = false;

  constructor(private readonly period: number) {}

  /**
   * Feed the next value and return the current SMA, or null if
   * fewer than `period` values have been supplied.
   */
  update(value: number): number | null {
    if (this.full) {
      this.sum -= this.buffer[this.index]!;
    }
    this.buffer[this.index] = value;
    this.sum += value;
    this.index = (this.index + 1) % this.period;
    if (!this.full && this.index === 0) this.full = true;
    return this.full ? this.sum / this.period : null;
  }

  /** Reset internal state for reuse. */
  reset(): void {
    this.buffer = [];
    this.sum = 0;
    this.index = 0;
    this.full = false;
  }
}

/**
 * Incremental EMA calculator - O(1) per bar.
 * Seeded with the first value; subsequent values use the EMA formula.
 *
 * Usage:
 *   const ema = new IncrementalEMA(12);
 *   for (const price of prices) {
 *     const value = ema.update(price); // always returns a number
 *   }
 */
export class IncrementalEMA {
  private value: number | null = null;
  private readonly multiplier: number;

  constructor(private readonly period: number) {
    this.multiplier = 2 / (period + 1);
  }

  /**
   * Feed the next price and return the current EMA.
   * The first call seeds the EMA with the price itself.
   */
  update(price: number): number {
    if (this.value === null) {
      this.value = price;
      return this.value;
    }
    this.value = (price - this.value) * this.multiplier + this.value;
    return this.value;
  }

  /** Return the current EMA value without feeding a new price. */
  current(): number | null {
    return this.value;
  }

  /** Reset internal state for reuse. */
  reset(): void {
    this.value = null;
  }
}

// =============================================================================
// O(n) MAX DRAWDOWN / O(n) 最大回撤
// =============================================================================

/**
 * Result of the single-pass max drawdown calculation.
 */
export interface MaxDrawdownResult {
  /** Max drawdown as a positive ratio (e.g., 0.15 = 15%) */
  maxDrawdown: number;
  /** Absolute amount of the max drawdown */
  maxDrawdownAmount: number;
  /** Index in the equity curve where the peak before max drawdown occurred */
  peakIndex: number;
  /** Index in the equity curve where the trough of max drawdown occurred */
  troughIndex: number;
  /** Index where equity recovered to peak level, or null if not recovered */
  recoveryIndex: number | null;
}

/**
 * Single-pass max drawdown - O(n) time, O(1) space.
 * Tracks running peak and computes drawdown at each point.
 *
 * @param equityCurve - Array of equity values (must have at least 1 element)
 * @returns MaxDrawdownResult with indices, ratio, and amount
 */
export function calculateMaxDrawdownOptimized(equityCurve: number[]): MaxDrawdownResult {
  if (equityCurve.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownAmount: 0,
      peakIndex: 0,
      troughIndex: 0,
      recoveryIndex: null,
    };
  }

  let peak = equityCurve[0]!;
  let peakIdx = 0;
  let maxDD = 0;
  let maxDDAmount = 0;
  let ddPeakIdx = 0;
  let ddTroughIdx = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    const value = equityCurve[i]!;
    if (value > peak) {
      peak = value;
      peakIdx = i;
    }
    // Avoid division by zero when peak is 0
    const dd = peak > 0 ? (peak - value) / peak : 0;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDAmount = peak - value;
      ddPeakIdx = peakIdx;
      ddTroughIdx = i;
    }
  }

  // Find recovery point: first index after trough where equity >= peak at ddPeakIdx
  let recoveryIdx: number | null = null;
  const peakValue = equityCurve[ddPeakIdx]!;
  for (let i = ddTroughIdx + 1; i < equityCurve.length; i++) {
    if (equityCurve[i]! >= peakValue) {
      recoveryIdx = i;
      break;
    }
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownAmount: maxDDAmount,
    peakIndex: ddPeakIdx,
    troughIndex: ddTroughIdx,
    recoveryIndex: recoveryIdx,
  };
}

/**
 * Batch SMA calculation using the sliding-window technique.
 * Returns the same output format as the naive version (NaN for warmup bars)
 * but runs in O(n) total instead of O(n * period).
 */
export function calculateSMAOptimized(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i]!;
    if (i >= period) {
      sum -= data[i - period]!;
    }
    if (i < period - 1) {
      result[i] = NaN;
    } else {
      result[i] = sum / period;
    }
  }
  return result;
}
