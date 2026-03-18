/**
 * Market Status Detection Module
 * 市场状态检测模块
 *
 * Detects stock suspension, limit up/down, and other market conditions.
 * Used for edge case handling in backtest calculations.
 *
 * 检测股票停牌、涨跌停等市场状态
 * 用于回测计算中的边缘情况处理
 */

import type { BacktestKline } from "./engine";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Market status for a single K-line
 * 单根K线的市场状态
 */
export interface MarketStatus {
  isSuspended: boolean; // Whether the stock is suspended / 是否停牌
  isLimitUp: boolean; // Whether hit the upper limit / 是否涨停
  isLimitDown: boolean; // Whether hit the lower limit / 是否跌停
  suspensionDays: number; // Consecutive suspension days / 连续停牌天数
  isAbnormal: boolean; // Whether data is abnormal / 数据是否异常
  abnormalReason?: string; // Reason for abnormality / 异常原因
}

/**
 * Signal execution status
 * 信号执行状态
 */
export type SignalStatus =
  | "completed" // Trade completed normally / 正常完成
  | "holding" // Still holding (not enough data) / 仍在持有
  | "suspended" // Exit delayed due to suspension / 因停牌延迟出场
  | "cannot_buy" // Cannot buy (limit up at entry) / 无法买入(入场涨停)
  | "cannot_sell" // Cannot sell (limit down at exit) / 无法卖出(出场跌停)
  | "partial"; // Partially executed / 部分执行

/**
 * Extended signal detail with status
 * 带状态的扩展信号详情
 */
export interface SignalStatusInfo {
  status: SignalStatus;
  statusReason?: string;
  actualEntryDate?: string; // Actual entry date (may differ if limit up) / 实际入场日期
  actualExitDate?: string; // Actual exit date (may differ if suspended) / 实际出场日期
  actualHoldingDays?: number; // Actual holding days / 实际持有天数
  suspendedDays?: number; // Days suspended during holding / 持有期间停牌天数
}

// =============================================================================
// CONSTANTS / 常量定义
// =============================================================================

/**
 * A-share price limit ratios
 * A股涨跌停比例
 */
const LIMIT_RATIOS = {
  normal: 0.1, // 普通股票 10%
  st: 0.05, // ST股票 5%
  kcb: 0.2, // 科创板 20%
  cyb: 0.2, // 创业板 20% (after 2020-08-24)
  bj: 0.3, // 北交所 30%
};

/**
 * Tolerance for price comparison (floating point)
 * 价格比较的容差(浮点数精度)
 */
const PRICE_TOLERANCE = 0.005; // 0.5%

/**
 * Minimum volume threshold for suspension detection
 * 停牌检测的最小成交量阈值
 */
const MIN_VOLUME_THRESHOLD = 100; // 100手 = 10000股

// =============================================================================
// DETECTION FUNCTIONS / 检测函数
// =============================================================================

/**
 * Get the limit ratio for a stock based on its symbol
 * 根据股票代码获取涨跌停比例
 */
function getLimitRatio(symbol: string): number {
  // Science and Technology Innovation Board (科创板): 688xxx
  if (symbol.startsWith("688")) {
    return LIMIT_RATIOS.kcb;
  }

  // ChiNext (创业板): 30xxxx
  if (symbol.startsWith("30")) {
    return LIMIT_RATIOS.cyb;
  }

  // Beijing Stock Exchange (北交所): 8xxxxx, 4xxxxx
  if (symbol.startsWith("8") || symbol.startsWith("4")) {
    return LIMIT_RATIOS.bj;
  }

  // ST stocks detection (simplified - actual detection requires name)
  // ST股检测(简化版 - 实际需要根据名称判断)
  // This will be enhanced when stock name is available

  return LIMIT_RATIOS.normal;
}

/**
 * Calculate the theoretical limit up price
 * 计算理论涨停价
 */
function calcLimitUpPrice(prevClose: number, limitRatio: number): number {
  // Round to 2 decimal places (A-share price rule)
  return Math.round(prevClose * (1 + limitRatio) * 100) / 100;
}

/**
 * Calculate the theoretical limit down price
 * 计算理论跌停价
 */
function calcLimitDownPrice(prevClose: number, limitRatio: number): number {
  // Round to 2 decimal places (A-share price rule)
  return Math.round(prevClose * (1 - limitRatio) * 100) / 100;
}

/**
 * Check if a price is approximately equal to target (within tolerance)
 * 检查价格是否约等于目标价(在容差范围内)
 */
function priceApproxEqual(
  price: number,
  target: number,
  tolerance: number = PRICE_TOLERANCE,
): boolean {
  if (target === 0) return false;
  return Math.abs(price - target) / target <= tolerance;
}

/**
 * Detect market status for a single K-line
 * 检测单根K线的市场状态
 *
 * @param kline - Current K-line data
 * @param prevKline - Previous K-line data (optional)
 * @param symbol - Stock symbol
 * @param isSTStock - Whether the stock is ST (optional)
 * @returns Market status object
 */
export function detectMarketStatus(
  kline: BacktestKline,
  prevKline?: BacktestKline,
  symbol: string = "",
  isSTStock: boolean = false,
): MarketStatus {
  const result: MarketStatus = {
    isSuspended: false,
    isLimitUp: false,
    isLimitDown: false,
    suspensionDays: 0,
    isAbnormal: false,
  };

  // Suspension detection: volume = 0 or very low
  // 停牌检测: 成交量为0或非常低
  if (kline.volume < MIN_VOLUME_THRESHOLD) {
    result.isSuspended = true;
    // Suspension days will be calculated in batch processing
  }

  // Need previous K-line for limit detection
  // 需要前一根K线来检测涨跌停
  if (!prevKline) {
    return result;
  }

  // Get limit ratio based on stock type
  // 根据股票类型获取涨跌停比例
  const limitRatio = isSTStock ? LIMIT_RATIOS.st : getLimitRatio(symbol);

  // Calculate theoretical limit prices
  // 计算理论涨跌停价
  const limitUpPrice = calcLimitUpPrice(prevKline.close, limitRatio);
  const limitDownPrice = calcLimitDownPrice(prevKline.close, limitRatio);

  // Limit up detection: close price equals limit up price
  // 涨停检测: 收盘价等于涨停价
  if (priceApproxEqual(kline.close, limitUpPrice)) {
    result.isLimitUp = true;
  }

  // Limit down detection: close price equals limit down price
  // 跌停检测: 收盘价等于跌停价
  if (priceApproxEqual(kline.close, limitDownPrice)) {
    result.isLimitDown = true;
  }

  // Abnormal data detection
  // 异常数据检测
  const priceChange = prevKline.close > 0
    ? Math.abs(kline.close - prevKline.close) / prevKline.close
    : 0;

  // Price change > 50% is likely data error (unless special case)
  if (priceChange > 0.5) {
    result.isAbnormal = true;
    result.abnormalReason = `价格变化异常: ${(priceChange * 100).toFixed(1)}%`;
  }

  // OHLC consistency check
  // OHLC一致性检查
  if (kline.high < kline.low) {
    result.isAbnormal = true;
    result.abnormalReason = "最高价低于最低价";
  }

  if (kline.close < kline.low || kline.close > kline.high) {
    result.isAbnormal = true;
    result.abnormalReason = "收盘价超出高低价范围";
  }

  if (kline.open < kline.low || kline.open > kline.high) {
    result.isAbnormal = true;
    result.abnormalReason = "开盘价超出高低价范围";
  }

  return result;
}

/**
 * Detect market status for a K-line series and calculate suspension days
 * 检测K线序列的市场状态并计算停牌天数
 *
 * @param klines - K-line data array
 * @param symbol - Stock symbol
 * @returns Array of market status for each K-line
 */
export function detectMarketStatusBatch(
  klines: BacktestKline[],
  symbol: string = "",
): MarketStatus[] {
  const results: MarketStatus[] = [];
  let consecutiveSuspensionDays = 0;

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    const prevKline = i > 0 ? klines[i - 1] : undefined;

    if (!kline) {
      results.push({
        isSuspended: true,
        isLimitUp: false,
        isLimitDown: false,
        suspensionDays: 0,
        isAbnormal: true,
        abnormalReason: "K线数据缺失",
      });
      continue;
    }

    const status = detectMarketStatus(kline, prevKline, symbol);

    // Calculate consecutive suspension days
    // 计算连续停牌天数
    if (status.isSuspended) {
      consecutiveSuspensionDays++;
      status.suspensionDays = consecutiveSuspensionDays;
    } else {
      consecutiveSuspensionDays = 0;
    }

    results.push(status);
  }

  return results;
}

/**
 * Determine signal execution status based on market conditions
 * 根据市场状况确定信号执行状态
 *
 * @param entryStatus - Market status at entry
 * @param exitStatus - Market status at exit
 * @param signalType - Signal type ('buy' or 'sell')
 * @param hasEnoughData - Whether there's enough data for the holding period
 * @returns Signal status information
 */
export function determineSignalStatus(
  entryStatus: MarketStatus,
  exitStatus: MarketStatus | null,
  signalType: "buy" | "sell",
  hasEnoughData: boolean,
): SignalStatusInfo {
  const result: SignalStatusInfo = {
    status: "completed",
  };

  // Check if entry is possible
  // 检查是否可以入场
  if (signalType === "buy" && entryStatus.isLimitUp) {
    result.status = "cannot_buy";
    result.statusReason = "入场时涨停，无法买入";
    return result;
  }

  if (signalType === "sell" && entryStatus.isLimitDown) {
    result.status = "cannot_sell";
    result.statusReason = "入场时跌停，无法卖出";
    return result;
  }

  // Check if entry day is suspended
  // 检查入场日是否停牌
  if (entryStatus.isSuspended) {
    result.status = "cannot_buy";
    result.statusReason = "入场时停牌，无法交易";
    return result;
  }

  // Check if we have enough data for exit
  // 检查是否有足够数据用于出场
  if (!hasEnoughData || !exitStatus) {
    result.status = "holding";
    result.statusReason = "持有期超出数据范围，仍在持有";
    return result;
  }

  // Check if exit is possible
  // 检查是否可以出场
  if (exitStatus.isSuspended) {
    result.status = "suspended";
    result.statusReason = "出场时停牌，延迟出场";
    result.suspendedDays = exitStatus.suspensionDays;
    return result;
  }

  // Check for limit conditions at exit
  // 检查出场时的涨跌停情况
  if (signalType === "buy" && exitStatus.isLimitDown) {
    // For buy signal, limit down at exit means potential loss
    result.status = "completed";
    result.statusReason = "出场时跌停，按跌停价卖出";
    return result;
  }

  if (signalType === "sell" && exitStatus.isLimitUp) {
    // For sell signal, limit up at exit means potential loss for short
    result.status = "completed";
    result.statusReason = "出场时涨停，按涨停价回补";
    return result;
  }

  return result;
}

/**
 * Find the next tradable day after suspension
 * 找到停牌后的下一个可交易日
 *
 * @param klines - K-line data array
 * @param marketStatuses - Market status array
 * @param startIndex - Starting index to search from
 * @param maxLookAhead - Maximum days to look ahead
 * @returns Index of next tradable day, or -1 if not found
 */
export function findNextTradableDay(
  klines: BacktestKline[],
  marketStatuses: MarketStatus[],
  startIndex: number,
  maxLookAhead: number = 30,
): number {
  for (let i = startIndex; i < Math.min(startIndex + maxLookAhead, klines.length); i++) {
    const status = marketStatuses[i];
    if (status && !status.isSuspended && !status.isAbnormal) {
      return i;
    }
  }
  return -1;
}

/**
 * Validate K-line data integrity
 * 验证K线数据完整性
 *
 * @param klines - K-line data array
 * @returns Validation result with issues found
 */
export function validateKlineData(
  klines: BacktestKline[],
): {
  isValid: boolean;
  issues: string[];
  validCount: number;
  suspendedCount: number;
  abnormalCount: number;
} {
  const issues: string[] = [];
  let validCount = 0;
  let suspendedCount = 0;
  let abnormalCount = 0;

  const statuses = detectMarketStatusBatch(klines);

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    if (!status) continue;

    if (status.isAbnormal) {
      abnormalCount++;
      if (status.abnormalReason) {
        issues.push(`第${i + 1}根K线: ${status.abnormalReason}`);
      }
    } else if (status.isSuspended) {
      suspendedCount++;
    } else {
      validCount++;
    }
  }

  // Check for excessive suspension
  const suspensionRatio = klines.length > 0 ? suspendedCount / klines.length : 0;
  if (suspensionRatio > 0.3) {
    issues.push(`停牌比例过高: ${(suspensionRatio * 100).toFixed(1)}%`);
  }

  // Check for data gaps (large time jumps)
  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1];
    const curr = klines[i];
    if (!prev || !curr) continue;

    const daysDiff = (curr.time - prev.time) / (24 * 60 * 60);
    // More than 10 calendar days gap is suspicious (considering weekends/holidays)
    if (daysDiff > 10) {
      issues.push(`数据缺口: 第${i}根与第${i + 1}根K线间隔${daysDiff.toFixed(0)}天`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    validCount,
    suspendedCount,
    abnormalCount,
  };
}

/**
 * Check if a stock is an ST stock based on its name
 * 根据股票名称检查是否为ST股票
 *
 * @param name - Stock name
 * @returns Whether the stock is ST
 */
export function isSTStock(name: string): boolean {
  const upperName = name.toUpperCase();
  return (
    upperName.includes("ST") ||
    upperName.includes("*ST") ||
    upperName.includes("S*ST")
  );
}

/**
 * Check if a stock is new (IPO within specified days)
 * 检查股票是否为新股(指定天数内上市)
 *
 * @param klines - K-line data array
 * @param minDays - Minimum days since IPO (default 60)
 * @returns Whether the stock is new
 */
export function isNewStock(
  klines: BacktestKline[],
  minDays: number = 60,
): boolean {
  return klines.length < minDays;
}
