/**
 * Transaction Costs Calculator
 * 交易成本计算器
 *
 * Calculates realistic transaction costs for A-share trading including
 * commission, stamp duty, transfer fee, and slippage.
 *
 * 计算A股交易的实际交易成本，包括佣金、印花税、过户费和滑点
 */

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Transaction cost configuration
 * 交易成本配置
 */
export interface TransactionCosts {
  commission: number; // Commission rate (default 0.0003 = 0.03%) / 佣金率
  stampDuty: number; // Stamp duty rate (sell only, 0.001 = 0.1%) / 印花税率
  transferFee: number; // Transfer fee rate (0.00002 = 0.002%) / 过户费率
  slippage: number; // Slippage rate (default 0.001 = 0.1%) / 滑点率
  minCommission: number; // Minimum commission per trade (default 5 CNY) / 最低佣金
}

/**
 * Cost calculation result
 * 成本计算结果
 */
export interface CostBreakdown {
  commission: number; // Commission amount / 佣金金额
  stampDuty: number; // Stamp duty amount / 印花税金额
  transferFee: number; // Transfer fee amount / 过户费金额
  slippage: number; // Estimated slippage amount / 预估滑点金额
  totalCost: number; // Total cost / 总成本
  costRate: number; // Total cost as percentage of trade value / 总成本率
}

/**
 * Round trip cost result (buy + sell)
 * 往返交易成本结果(买入+卖出)
 */
export interface RoundTripCost {
  buyCost: CostBreakdown; // Buy side cost / 买入成本
  sellCost: CostBreakdown; // Sell side cost / 卖出成本
  totalCost: number; // Total round trip cost / 往返总成本
  totalCostRate: number; // Total cost as percentage / 总成本率
  netReturn: number; // Net return after costs / 扣除成本后净收益
  grossReturn: number; // Gross return before costs / 扣除成本前毛收益
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

/**
 * Default transaction cost configuration for A-shares
 * A股默认交易成本配置
 */
export const DEFAULT_COSTS: TransactionCosts = {
  commission: 0.0003, // 0.03% (typical online broker rate)
  stampDuty: 0.0005, // 0.05% (sell only, reduced since 2023-08-28)
  transferFee: 0.00001, // 0.001% (both buy and sell)
  slippage: 0.001, // 0.1% (estimated market impact)
  minCommission: 5, // 5 CNY minimum commission
};

/**
 * Zero cost configuration (for comparison)
 * 零成本配置(用于对比)
 */
export const ZERO_COSTS: TransactionCosts = {
  commission: 0,
  stampDuty: 0,
  transferFee: 0,
  slippage: 0,
  minCommission: 0,
};

/**
 * Standardized marketplace cost profile — REQUIRED when publishing.
 *
 * Sprint 1 reverse-cherry-pick guard 招 B: 90% of marketplace cheating
 * comes from running backtests with unrealistic (or zero) costs to inflate
 * Sharpe / return. By forcing every marketplace listing through a single
 * audited cost profile, the user-supplied "我的策略年化 200%" becomes
 * directly comparable to every other listing.
 *
 * Values (2026, mainland A-share retail):
 *   - commission   : 0.025% (typical online broker, post-2024 floor)
 *   - stampDuty    : 0.05%  (sell only, reduced 2023-08-28)
 *   - transferFee  : 0.001% (Shanghai only since 2022-04, applied to both)
 *   - slippage     : 0.10%  (10 bps, conservative retail mid-cap estimate)
 *   - minCommission: 5 CNY  (industry-wide minimum)
 *
 * DO NOT mutate. Adjust the constants only via a versioned migration so
 * historical listings stay reproducible.
 */
export const STANDARD_MARKETPLACE_COSTS: Readonly<TransactionCosts> = Object.freeze({
  commission: 0.00025,
  stampDuty: 0.0005,
  transferFee: 0.00001,
  slippage: 0.001,
  minCommission: 5,
});

/**
 * Validate that a supplied cost configuration matches the standardized
 * marketplace profile exactly. Returns the list of mismatched fields, or
 * an empty array on success. Throws nothing — call sites should branch on
 * the array length and decide how strict to be.
 *
 * No costs supplied → caller used defaults; treated as compliant rather
 * than forcing every legacy strategy to fail. Publishers who explicitly
 * override costs are the ones we're guarding against.
 */
export function assertStandardCosts(
  costs: TransactionCosts | undefined | null,
): ReadonlyArray<{
  field: keyof TransactionCosts;
  expected: number;
  actual: number;
}> {
  if (!costs) return [];
  const baseline = STANDARD_MARKETPLACE_COSTS;
  const EPS = 1e-9;
  const fields: ReadonlyArray<keyof TransactionCosts> = [
    "commission",
    "stampDuty",
    "transferFee",
    "slippage",
    "minCommission",
  ];
  const mismatches: Array<{
    field: keyof TransactionCosts;
    expected: number;
    actual: number;
  }> = [];
  for (const field of fields) {
    const actual = costs[field];
    const expected = baseline[field];
    if (typeof actual !== "number" || Math.abs(actual - expected) > EPS) {
      mismatches.push({
        field,
        expected,
        actual: typeof actual === "number" ? actual : NaN,
      });
    }
  }
  return mismatches;
}

/**
 * Conservative cost configuration (higher estimates)
 * 保守成本配置(较高估计)
 */
export const CONSERVATIVE_COSTS: TransactionCosts = {
  commission: 0.0005, // 0.05%
  stampDuty: 0.0005, // 0.05%
  transferFee: 0.00001, // 0.001%
  slippage: 0.002, // 0.2%
  minCommission: 5, // 5 CNY
};

// =============================================================================
// CALCULATION FUNCTIONS / 计算函数
// =============================================================================

/**
 * Calculate transaction costs for a single trade
 * 计算单次交易的交易成本
 *
 * @param tradeValue - Total trade value (price * shares) / 交易金额
 * @param tradeType - 'buy' or 'sell' / 交易类型
 * @param costs - Cost configuration / 成本配置
 * @returns Cost breakdown / 成本分解
 */
export function calculateTradeCost(
  tradeValue: number,
  tradeType: "buy" | "sell",
  costs: TransactionCosts = DEFAULT_COSTS,
): CostBreakdown {
  // Commission (both buy and sell)
  // 佣金(买卖都收)
  let commission = tradeValue * costs.commission;
  if (commission < costs.minCommission) {
    commission = costs.minCommission;
  }

  // Stamp duty (sell only)
  // 印花税(仅卖出收取)
  const stampDuty = tradeType === "sell" ? tradeValue * costs.stampDuty : 0;

  // Transfer fee (both buy and sell)
  // 过户费(买卖都收)
  const transferFee = tradeValue * costs.transferFee;

  // Slippage (estimated market impact)
  // 滑点(预估市场冲击)
  const slippage = tradeValue * costs.slippage;

  // Total cost
  const totalCost = commission + stampDuty + transferFee + slippage;

  // Cost rate
  const costRate = tradeValue > 0 ? totalCost / tradeValue : 0;

  return {
    commission,
    stampDuty,
    transferFee,
    slippage,
    totalCost,
    costRate,
  };
}

/**
 * Calculate round trip (buy + sell) transaction costs
 * 计算往返(买入+卖出)交易成本
 *
 * @param entryPrice - Entry price / 买入价格
 * @param exitPrice - Exit price / 卖出价格
 * @param shares - Number of shares / 股数
 * @param costs - Cost configuration / 成本配置
 * @returns Round trip cost breakdown / 往返成本分解
 */
export function calculateRoundTripCost(
  entryPrice: number,
  exitPrice: number,
  shares: number,
  costs: TransactionCosts = DEFAULT_COSTS,
): RoundTripCost {
  const buyValue = entryPrice * shares;
  const sellValue = exitPrice * shares;

  const buyCost = calculateTradeCost(buyValue, "buy", costs);
  const sellCost = calculateTradeCost(sellValue, "sell", costs);

  const totalCost = buyCost.totalCost + sellCost.totalCost;
  const grossReturn = sellValue - buyValue;
  const netReturn = grossReturn - totalCost;

  // Cost rate relative to initial investment
  const totalCostRate = buyValue > 0 ? totalCost / buyValue : 0;

  return {
    buyCost,
    sellCost,
    totalCost,
    totalCostRate,
    netReturn,
    grossReturn,
  };
}

/**
 * Calculate net return percentage after costs
 * 计算扣除成本后的净收益率
 *
 * @param entryPrice - Entry price / 买入价格
 * @param exitPrice - Exit price / 卖出价格
 * @param tradeType - Signal type ('buy' for long, 'sell' for short) / 信号类型
 * @param costs - Cost configuration / 成本配置
 * @returns Net return percentage / 净收益率百分比
 */
export function calculateNetReturn(
  entryPrice: number,
  exitPrice: number,
  tradeType: "buy" | "sell",
  costs: TransactionCosts = DEFAULT_COSTS,
): number {
  if (entryPrice <= 0) return 0;

  // Gross return (before costs)
  const grossReturnPct =
    tradeType === "buy"
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;

  // Estimate costs as percentage (simplified)
  // Buy cost: commission + transfer fee + slippage
  const buyCostRate =
    Math.max(costs.commission, costs.minCommission / (entryPrice * 100)) +
    costs.transferFee +
    costs.slippage;

  // Sell cost: commission + stamp duty + transfer fee + slippage
  const sellCostRate =
    Math.max(costs.commission, costs.minCommission / (exitPrice * 100)) +
    costs.stampDuty +
    costs.transferFee +
    costs.slippage;

  // Total cost rate
  const totalCostRate = (buyCostRate + sellCostRate) * 100;

  // Net return
  return grossReturnPct - totalCostRate;
}

/**
 * Estimate effective price after slippage
 * 估算滑点后的有效价格
 *
 * @param price - Original price / 原始价格
 * @param tradeType - Trade type / 交易类型
 * @param slippageRate - Slippage rate / 滑点率
 * @returns Effective price / 有效价格
 */
export function estimateEffectivePrice(
  price: number,
  tradeType: "buy" | "sell",
  slippageRate: number = DEFAULT_COSTS.slippage,
): number {
  // For buying, we pay more due to slippage
  // For selling, we receive less due to slippage
  if (tradeType === "buy") {
    return price * (1 + slippageRate);
  } else {
    return price * (1 - slippageRate);
  }
}

/**
 * Calculate break-even price for a trade
 * 计算交易的盈亏平衡价格
 *
 * @param entryPrice - Entry price / 买入价格
 * @param shares - Number of shares / 股数
 * @param tradeType - Signal type / 信号类型
 * @param costs - Cost configuration / 成本配置
 * @returns Break-even price / 盈亏平衡价格
 */
export function calculateBreakEvenPrice(
  entryPrice: number,
  shares: number,
  tradeType: "buy" | "sell",
  costs: TransactionCosts = DEFAULT_COSTS,
): number {
  const buyValue = entryPrice * shares;
  const buyCost = calculateTradeCost(buyValue, "buy", costs);

  if (tradeType === "buy") {
    // For long position, need to sell at higher price to cover costs
    // sellValue - sellCost = buyValue + buyCost
    // sellValue * (1 - costRate) = buyValue + buyCost
    const sellCostRate =
      costs.commission + costs.stampDuty + costs.transferFee + costs.slippage;
    const targetSellValue = (buyValue + buyCost.totalCost) / (1 - sellCostRate);
    return targetSellValue / shares;
  } else {
    // For short position, need to buy back at lower price
    const buyCostRate =
      costs.commission + costs.transferFee + costs.slippage;
    const targetBuyValue =
      (buyValue - buyCost.totalCost) / (1 + buyCostRate);
    return targetBuyValue / shares;
  }
}

/**
 * Format cost breakdown for display
 * 格式化成本分解用于显示
 *
 * @param cost - Cost breakdown / 成本分解
 * @returns Formatted string / 格式化字符串
 */
export function formatCostBreakdown(cost: CostBreakdown): string {
  return [
    `佣金: ¥${cost.commission.toFixed(2)}`,
    `印花税: ¥${cost.stampDuty.toFixed(2)}`,
    `过户费: ¥${cost.transferFee.toFixed(2)}`,
    `滑点: ¥${cost.slippage.toFixed(2)}`,
    `总成本: ¥${cost.totalCost.toFixed(2)} (${(cost.costRate * 100).toFixed(3)}%)`,
  ].join(" | ");
}

/**
 * Get cost configuration summary
 * 获取成本配置摘要
 *
 * @param costs - Cost configuration / 成本配置
 * @returns Summary string / 摘要字符串
 */
export function getCostSummary(costs: TransactionCosts): string {
  const parts = [];

  if (costs.commission > 0) {
    parts.push(`佣金${(costs.commission * 100).toFixed(2)}%`);
  }
  if (costs.stampDuty > 0) {
    parts.push(`印花税${(costs.stampDuty * 100).toFixed(1)}%`);
  }
  if (costs.slippage > 0) {
    parts.push(`滑点${(costs.slippage * 100).toFixed(1)}%`);
  }

  if (parts.length === 0) {
    return "无交易成本";
  }

  // Estimate total round-trip cost
  const totalCostRate =
    (costs.commission + costs.transferFee + costs.slippage) * 2 +
    costs.stampDuty;

  return `${parts.join(" + ")} (往返约${(totalCostRate * 100).toFixed(2)}%)`;
}

/**
 * Create custom cost configuration
 * 创建自定义成本配置
 *
 * @param options - Partial cost options / 部分成本选项
 * @returns Complete cost configuration / 完整成本配置
 */
export function createCostConfig(
  options: Partial<TransactionCosts> = {},
): TransactionCosts {
  return {
    ...DEFAULT_COSTS,
    ...options,
  };
}

/**
 * Validate cost configuration
 * 验证成本配置
 *
 * @param costs - Cost configuration to validate / 待验证的成本配置
 * @returns Validation result / 验证结果
 */
export function validateCostConfig(costs: TransactionCosts): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (costs.commission < 0 || costs.commission > 0.01) {
    errors.push("佣金率应在0-1%之间");
  }

  if (costs.stampDuty < 0 || costs.stampDuty > 0.01) {
    errors.push("印花税率应在0-1%之间");
  }

  if (costs.transferFee < 0 || costs.transferFee > 0.001) {
    errors.push("过户费率应在0-0.1%之间");
  }

  if (costs.slippage < 0 || costs.slippage > 0.05) {
    errors.push("滑点率应在0-5%之间");
  }

  if (costs.minCommission < 0 || costs.minCommission > 100) {
    errors.push("最低佣金应在0-100元之间");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
