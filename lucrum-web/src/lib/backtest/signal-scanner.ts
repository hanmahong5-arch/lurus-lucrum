/**
 * Strategy Signal Scanner
 * 策略信号扫描器
 *
 * Scans K-line data for predefined strategy signals.
 * Used for sector-wide strategy validation/backtesting.
 * Enhanced with edge case handling, signal deduplication, and cost calculation.
 *
 * 扫描K线数据中的预定义策略信号
 * 用于行业级策略验证/回测
 * 增强版：包含边缘情况处理、信号去重和成本计算
 */

import type { BacktestKline } from "./engine";
import {
  detectMarketStatusBatch,
  determineSignalStatus,
  isSTStock as checkIsSTStock,
  type MarketStatus,
  type SignalStatus,
} from "./market-status";
import {
  calculateNetReturn as calcNetReturn,
  type TransactionCosts,
  DEFAULT_COSTS,
} from "./transaction-costs";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Calculated indicators for a K-line series
 * K线序列的计算指标
 */
export interface Indicators {
  sma5: number[];
  sma10: number[];
  sma20: number[];
  sma60: number[];
  ema12: number[];
  ema26: number[];
  rsi: number[];
  macd: Array<{ dif: number; dea: number; histogram: number }>;
  boll: Array<{ upper: number; middle: number; lower: number }>;
}

/**
 * Signal detection result
 * 信号检测结果
 */
export interface SignalDetectionResult {
  type: "buy" | "sell";
  signal: string;
  strength: number;
  price: number;
  timestamp: number;
}

/**
 * Signal detail with entry/exit info
 * 包含入场/出场信息的信号详情
 */
export interface SignalDetail {
  symbol: string;
  name: string;
  type: "buy" | "sell";
  signal: string;
  strength: number;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  netReturnPct?: number; // Return after costs / 扣除成本后收益率
  isWin: boolean;
  holdingDays: number;
  // Enhanced status fields / 增强状态字段
  status: SignalStatus;
  statusReason?: string;
  isLimitUp?: boolean; // Entry day was limit up / 入场日涨停
  isLimitDown?: boolean; // Exit day was limit down / 出场日跌停
  isSuspended?: boolean; // Suspension during holding / 持有期间停牌
  actualHoldingDays?: number; // Actual holding days (may differ) / 实际持有天数
}

/**
 * Signal deduplication options
 * 信号去重选项
 */
export interface SignalDeduplicationOptions {
  minGapDays: number; // Minimum gap between signals (default 3) / 最小信号间隔
  mergeConsecutive: boolean; // Merge consecutive signals / 合并连续信号
  keepStrongest: boolean; // Keep strongest signal in group / 保留最强信号
}

/**
 * Signal strength threshold configuration
 * 信号强度阈值配置
 */
export interface SignalStrengthThreshold {
  minStrength?: number; // Minimum strength to include signal / 最低强度
  maxStrength?: number; // Maximum strength (for filtering outliers) / 最高强度
}

/**
 * Scan options for enhanced scanning
 * 增强扫描选项
 */
export interface ScanOptions {
  holdingDays: number; // Holding period / 持有天数
  deduplication?: SignalDeduplicationOptions; // Deduplication options / 去重选项
  transactionCosts?: TransactionCosts; // Transaction costs / 交易成本
  excludeSTStocks?: boolean; // Exclude ST stocks / 排除ST股票
  excludeNewStocks?: boolean; // Exclude new stocks / 排除新股
  minListingDays?: number; // Min days since IPO / 最小上市天数
  detectMarketStatus?: boolean; // Detect limit up/down / 检测涨跌停
  strengthThreshold?: SignalStrengthThreshold; // Signal strength filter / 信号强度过滤
}

/**
 * Stock signal scan result
 * 单只股票的信号扫描结果
 */
export interface StockSignalResult {
  symbol: string;
  name: string;
  signals: SignalDetail[];
  totalSignals: number;
  winSignals: number;
  winRate: number;
  avgReturn: number;
  maxReturn: number;
  minReturn: number;
}

/**
 * Strategy detector definition
 * 策略检测器定义
 */
export interface StrategyDetector {
  name: string;
  nameEn: string;
  description: string;
  detect: (
    klines: BacktestKline[],
    index: number,
    indicators: Indicators,
  ) => SignalDetectionResult | null;
}

// =============================================================================
// INDICATOR CALCULATIONS / 指标计算
// =============================================================================

/**
 * Calculate Simple Moving Average (SMA)
 * 计算简单移动平均线
 */
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * 计算指数移动平均线
 */
function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i] ?? 0);
    } else {
      const prevEMA = result[i - 1] ?? 0;
      const currentValue = data[i] ?? 0;
      result.push((currentValue - prevEMA) * multiplier + prevEMA);
    }
  }
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 * 计算相对强弱指标
 */
function calculateRSI(data: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(50);
      gains.push(0);
      losses.push(0);
      continue;
    }

    const change = (data[i] ?? 0) - (data[i - 1] ?? 0);
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(50);
      continue;
    }

    const avgGain =
      gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    const avgLoss =
      losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

/**
 * Calculate MACD
 * 计算MACD指标
 */
function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): Array<{ dif: number; dea: number; histogram: number }> {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const dif = fastEMA.map((fast, i) => fast - (slowEMA[i] ?? 0));
  const dea = calculateEMA(dif, signalPeriod);

  return dif.map((d, i) => ({
    dif: d,
    dea: dea[i] ?? 0,
    histogram: (d - (dea[i] ?? 0)) * 2,
  }));
}

/**
 * Calculate Bollinger Bands
 * 计算布林带
 */
function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2,
): Array<{ upper: number; middle: number; lower: number }> {
  const middle = calculateSMA(data, period);
  const result: Array<{ upper: number; middle: number; lower: number }> = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || isNaN(middle[i] ?? 0)) {
      result.push({ upper: NaN, middle: NaN, lower: NaN });
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i] ?? 0;
      const variance =
        slice.reduce((sum, val) => sum + Math.pow((val ?? 0) - mean, 2), 0) /
        period;
      const std = Math.sqrt(variance);
      result.push({
        upper: mean + stdDevMultiplier * std,
        middle: mean,
        lower: mean - stdDevMultiplier * std,
      });
    }
  }

  return result;
}

/**
 * Calculate all indicators for a K-line series
 * 计算K线序列的所有指标
 */
export function calculateAllIndicators(klines: BacktestKline[]): Indicators {
  const closes = klines.map((k) => k.close);

  return {
    sma5: calculateSMA(closes, 5),
    sma10: calculateSMA(closes, 10),
    sma20: calculateSMA(closes, 20),
    sma60: calculateSMA(closes, 60),
    ema12: calculateEMA(closes, 12),
    ema26: calculateEMA(closes, 26),
    rsi: calculateRSI(closes, 14),
    macd: calculateMACD(closes, 12, 26, 9),
    boll: calculateBollingerBands(closes, 20, 2),
  };
}

// =============================================================================
// UTILITY FUNCTIONS / 工具函数
// =============================================================================

/**
 * Format timestamp to date string
 * 格式化时间戳为日期字符串
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split("T")[0] ?? "";
}

// =============================================================================
// STRATEGY DETECTORS / 策略检测器
// =============================================================================

/**
 * Predefined strategy signal detectors
 * 预定义的策略信号检测器
 */
export const STRATEGY_DETECTORS: Record<string, StrategyDetector> = {
  // MACD Golden Cross / MACD金叉
  macd_golden_cross: {
    name: "MACD金叉",
    nameEn: "MACD Golden Cross",
    description: "DIF从下方穿越DEA (DIF crosses above DEA)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      if (index < 1) return null;
      const prev = indicators.macd[index - 1];
      const curr = indicators.macd[index];
      if (!prev || !curr) return null;

      // DIF crosses DEA from below
      if (prev.dif <= prev.dea && curr.dif > curr.dea) {
        const kline = klines[index];
        if (!kline) return null;
        return {
          type: "buy",
          signal: "MACD金叉",
          strength: Math.abs(curr.dif - curr.dea),
          price: kline.close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // MACD Death Cross / MACD死叉
  macd_death_cross: {
    name: "MACD死叉",
    nameEn: "MACD Death Cross",
    description: "DIF从上方穿越DEA (DIF crosses below DEA)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      if (index < 1) return null;
      const prev = indicators.macd[index - 1];
      const curr = indicators.macd[index];
      if (!prev || !curr) return null;

      // DIF crosses DEA from above
      if (prev.dif >= prev.dea && curr.dif < curr.dea) {
        const kline = klines[index];
        if (!kline) return null;
        return {
          type: "sell",
          signal: "MACD死叉",
          strength: Math.abs(curr.dea - curr.dif),
          price: kline.close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // RSI Oversold / RSI超卖
  rsi_oversold: {
    name: "RSI超卖",
    nameEn: "RSI Oversold",
    description: "RSI低于30 (RSI below 30)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      const rsi = indicators.rsi[index];
      const prevRsi = indicators.rsi[index - 1];
      if (rsi === undefined || prevRsi === undefined) return null;

      // RSI drops below 30 (entry into oversold)
      if (prevRsi >= 30 && rsi < 30) {
        const kline = klines[index];
        if (!kline) return null;
        return {
          type: "buy",
          signal: "RSI超卖",
          strength: 30 - rsi,
          price: kline.close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // RSI Overbought / RSI超买
  rsi_overbought: {
    name: "RSI超买",
    nameEn: "RSI Overbought",
    description: "RSI高于70 (RSI above 70)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      const rsi = indicators.rsi[index];
      const prevRsi = indicators.rsi[index - 1];
      if (rsi === undefined || prevRsi === undefined) return null;

      // RSI rises above 70 (entry into overbought)
      if (prevRsi <= 70 && rsi > 70) {
        const kline = klines[index];
        if (!kline) return null;
        return {
          type: "sell",
          signal: "RSI超买",
          strength: rsi - 70,
          price: kline.close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // MA Golden Cross / 均线金叉
  ma_golden_cross: {
    name: "均线金叉",
    nameEn: "MA Golden Cross",
    description: "MA5上穿MA20 (MA5 crosses above MA20)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      if (index < 1) return null;
      const prevMa5 = indicators.sma5[index - 1];
      const prevMa20 = indicators.sma20[index - 1];
      const currMa5 = indicators.sma5[index];
      const currMa20 = indicators.sma20[index];

      if (
        prevMa5 === undefined ||
        prevMa20 === undefined ||
        currMa5 === undefined ||
        currMa20 === undefined ||
        isNaN(prevMa5) ||
        isNaN(prevMa20) ||
        isNaN(currMa5) ||
        isNaN(currMa20)
      ) {
        return null;
      }

      // MA5 crosses MA20 from below
      if (prevMa5 <= prevMa20 && currMa5 > currMa20) {
        const kline = klines[index];
        if (!kline) return null;
        return {
          type: "buy",
          signal: "均线金叉",
          strength: ((currMa5 - currMa20) / currMa20) * 100,
          price: kline.close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // MA Death Cross / 均线死叉
  ma_death_cross: {
    name: "均线死叉",
    nameEn: "MA Death Cross",
    description: "MA5下穿MA20 (MA5 crosses below MA20)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      if (index < 1) return null;
      const prevMa5 = indicators.sma5[index - 1];
      const prevMa20 = indicators.sma20[index - 1];
      const currMa5 = indicators.sma5[index];
      const currMa20 = indicators.sma20[index];

      if (
        prevMa5 === undefined ||
        prevMa20 === undefined ||
        currMa5 === undefined ||
        currMa20 === undefined ||
        isNaN(prevMa5) ||
        isNaN(prevMa20) ||
        isNaN(currMa5) ||
        isNaN(currMa20)
      ) {
        return null;
      }

      // MA5 crosses MA20 from above
      if (prevMa5 >= prevMa20 && currMa5 < currMa20) {
        const kline = klines[index];
        if (!kline) return null;
        return {
          type: "sell",
          signal: "均线死叉",
          strength: ((currMa20 - currMa5) / currMa20) * 100,
          price: kline.close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // Bollinger Band Lower Break / 布林带下轨突破
  boll_lower_break: {
    name: "布林带下轨",
    nameEn: "BOLL Lower Break",
    description: "价格触及布林带下轨 (Price touches lower Bollinger Band)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      const boll = indicators.boll[index];
      const kline = klines[index];
      if (!boll || !kline || isNaN(boll.lower)) return null;

      const close = kline.close;
      // Price touches or breaks below lower band
      if (close <= boll.lower) {
        return {
          type: "buy",
          signal: "布林带下轨",
          strength: ((boll.lower - close) / close) * 100,
          price: close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // Bollinger Band Upper Break / 布林带上轨突破
  boll_upper_break: {
    name: "布林带上轨",
    nameEn: "BOLL Upper Break",
    description: "价格触及布林带上轨 (Price touches upper Bollinger Band)",
    detect: (
      klines: BacktestKline[],
      index: number,
      indicators: Indicators,
    ): SignalDetectionResult | null => {
      const boll = indicators.boll[index];
      const kline = klines[index];
      if (!boll || !kline || isNaN(boll.upper)) return null;

      const close = kline.close;
      // Price touches or breaks above upper band
      if (close >= boll.upper) {
        return {
          type: "sell",
          signal: "布林带上轨",
          strength: ((close - boll.upper) / close) * 100,
          price: close,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },

  // Volume Breakout / 放量突破
  volume_breakout: {
    name: "放量突破",
    nameEn: "Volume Breakout",
    description:
      "成交量>5日均量2倍且价格创20日新高 (Volume > 2x avg and price at 20-day high)",
    detect: (
      klines: BacktestKline[],
      index: number,
      _indicators: Indicators,
    ): SignalDetectionResult | null => {
      if (index < 20) return null;

      const kline = klines[index];
      if (!kline) return null;

      // Calculate 5-day average volume
      let sumVolume = 0;
      for (let i = index - 5; i < index; i++) {
        const k = klines[i];
        if (k) sumVolume += k.volume;
      }
      const avgVolume = sumVolume / 5;

      // Find 20-day high
      let maxHigh = 0;
      for (let i = index - 20; i < index; i++) {
        const k = klines[i];
        if (k && k.high > maxHigh) maxHigh = k.high;
      }

      const currVolume = kline.volume;
      const currClose = kline.close;

      // Volume > 2x average AND price breaks 20-day high
      if (currVolume > avgVolume * 2 && currClose > maxHigh) {
        return {
          type: "buy",
          signal: "放量突破",
          strength: currVolume / avgVolume,
          price: currClose,
          timestamp: kline.time,
        };
      }
      return null;
    },
  },
};

// =============================================================================
// MAIN SCANNER FUNCTIONS / 主要扫描函数
// =============================================================================

/**
 * Get list of available strategies
 * 获取可用策略列表
 */
export function getAvailableStrategies(): Array<{
  id: string;
  name: string;
  nameEn: string;
  description: string;
  type: "buy" | "sell" | "both";
}> {
  const buyStrategies = [
    "macd_golden_cross",
    "rsi_oversold",
    "ma_golden_cross",
    "boll_lower_break",
    "volume_breakout",
  ];
  const sellStrategies = [
    "macd_death_cross",
    "rsi_overbought",
    "ma_death_cross",
    "boll_upper_break",
  ];

  return Object.entries(STRATEGY_DETECTORS).map(([id, detector]) => ({
    id,
    name: detector.name,
    nameEn: detector.nameEn,
    description: detector.description,
    type: buyStrategies.includes(id)
      ? "buy"
      : sellStrategies.includes(id)
        ? "sell"
        : "both",
  }));
}

/**
 * Scan a single stock for strategy signals
 * 扫描单只股票的策略信号
 *
 * @param symbol - Stock symbol
 * @param name - Stock name
 * @param klines - K-line data
 * @param strategyId - Strategy ID to detect
 * @param holdingDays - Number of days to hold after signal (default 5)
 * @returns Stock signal scan result
 */
export function scanStockSignals(
  symbol: string,
  name: string,
  klines: BacktestKline[],
  strategyId: string,
  holdingDays: number = 5,
): StockSignalResult {
  const detector = STRATEGY_DETECTORS[strategyId];
  if (!detector) {
    throw new Error(`Unknown strategy: ${strategyId}`);
  }

  // Need at least 60 bars for indicator warmup + holding period
  if (klines.length < 60 + holdingDays) {
    return {
      symbol,
      name,
      signals: [],
      totalSignals: 0,
      winSignals: 0,
      winRate: 0,
      avgReturn: 0,
      maxReturn: 0,
      minReturn: 0,
    };
  }

  // Pre-calculate all indicators
  const indicators = calculateAllIndicators(klines);

  // Scan for signals
  const signals: SignalDetail[] = [];

  // Start from index 30 (indicator warmup) and leave room for holding period
  for (let i = 30; i < klines.length - holdingDays; i++) {
    const detection = detector.detect(klines, i, indicators);
    if (detection) {
      // Calculate return after holding N days
      const entryKline = klines[i];
      const exitKline = klines[i + holdingDays];

      if (!entryKline || !exitKline) continue;

      const entryPrice = detection.price;
      const exitPrice = exitKline.close;

      // For buy signals, profit = (exit - entry) / entry
      // For sell signals, profit = (entry - exit) / entry
      const returnPct =
        detection.type === "buy"
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;

      signals.push({
        symbol,
        name,
        type: detection.type,
        signal: detection.signal,
        strength: detection.strength,
        entryDate: formatDate(detection.timestamp),
        exitDate: formatDate(exitKline.time),
        entryPrice,
        exitPrice,
        returnPct,
        isWin: returnPct > 0,
        holdingDays,
        status: "completed" as const, // Basic scanner assumes all trades are completed
      });
    }
  }

  // Calculate statistics
  const totalSignals = signals.length;
  const winSignals = signals.filter((s) => s.isWin).length;
  const returns = signals.map((s) => s.returnPct);

  return {
    symbol,
    name,
    signals,
    totalSignals,
    winSignals,
    winRate: totalSignals > 0 ? (winSignals / totalSignals) * 100 : 0,
    avgReturn:
      returns.length > 0
        ? returns.reduce((a, b) => a + b, 0) / returns.length
        : 0,
    maxReturn: returns.length > 0 ? Math.max(...returns) : 0,
    minReturn: returns.length > 0 ? Math.min(...returns) : 0,
  };
}

/**
 * Scan multiple stocks for strategy signals
 * 批量扫描多只股票的策略信号
 *
 * @param stocks - Array of {symbol, name, klines}
 * @param strategyId - Strategy ID to detect
 * @param holdingDays - Holding period in days
 * @param onProgress - Progress callback
 * @returns Array of stock signal results
 */
export function scanMultipleStocks(
  stocks: Array<{
    symbol: string;
    name: string;
    klines: BacktestKline[];
  }>,
  strategyId: string,
  holdingDays: number = 5,
  onProgress?: (completed: number, total: number) => void,
): StockSignalResult[] {
  const results: StockSignalResult[] = [];
  const total = stocks.length;

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    if (!stock) continue;

    const result = scanStockSignals(
      stock.symbol,
      stock.name,
      stock.klines,
      strategyId,
      holdingDays,
    );
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return results;
}

// =============================================================================
// ENHANCED SCANNER FUNCTIONS / 增强扫描函数
// =============================================================================

/**
 * Default deduplication options
 * 默认去重选项
 */
const DEFAULT_DEDUP_OPTIONS: SignalDeduplicationOptions = {
  minGapDays: 3,
  mergeConsecutive: true,
  keepStrongest: true,
};

/**
 * Default scan options
 * 默认扫描选项
 */
const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  holdingDays: 5,
  deduplication: DEFAULT_DEDUP_OPTIONS,
  transactionCosts: DEFAULT_COSTS,
  excludeSTStocks: false,
  excludeNewStocks: false,
  minListingDays: 60,
  detectMarketStatus: true,
};

/**
 * Deduplicate consecutive signals
 * 对连续信号进行去重
 *
 * @param signals - Array of signal details
 * @param options - Deduplication options
 * @returns Deduplicated signals
 */
export function deduplicateSignals(
  signals: SignalDetail[],
  options: SignalDeduplicationOptions = DEFAULT_DEDUP_OPTIONS,
): SignalDetail[] {
  if (signals.length === 0) return [];

  // Sort by entry date
  const sorted = [...signals].sort(
    (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
  );

  const result: SignalDetail[] = [];
  let currentGroup: SignalDetail[] = [];

  for (const signal of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(signal);
      continue;
    }

    // Check if this signal should be grouped with previous
    const lastSignal = currentGroup[currentGroup.length - 1];
    if (!lastSignal) {
      currentGroup.push(signal);
      continue;
    }

    const daysDiff = Math.floor(
      (new Date(signal.entryDate).getTime() -
        new Date(lastSignal.entryDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysDiff < options.minGapDays) {
      // Within gap, add to current group
      currentGroup.push(signal);
    } else {
      // New group, process current group first
      const selected = selectSignalFromGroup(currentGroup, options);
      if (selected) result.push(selected);
      currentGroup = [signal];
    }
  }

  // Process last group
  if (currentGroup.length > 0) {
    const selected = selectSignalFromGroup(currentGroup, options);
    if (selected) result.push(selected);
  }

  return result;
}

/**
 * Select one signal from a group based on options
 * 根据选项从一组信号中选择一个
 */
function selectSignalFromGroup(
  group: SignalDetail[],
  options: SignalDeduplicationOptions,
): SignalDetail | null {
  if (group.length === 0) return null;
  if (group.length === 1) return group[0] ?? null;

  if (options.keepStrongest) {
    // Select the one with highest strength
    let strongest = group[0];
    for (const signal of group) {
      if (strongest && signal.strength > strongest.strength) {
        strongest = signal;
      }
    }
    return strongest ?? null;
  } else {
    // Keep first signal in group
    return group[0] ?? null;
  }
}

/**
 * Enhanced stock signal scanning with edge case handling
 * 增强版股票信号扫描，包含边缘情况处理
 *
 * @param symbol - Stock symbol
 * @param name - Stock name
 * @param klines - K-line data
 * @param strategyId - Strategy ID to detect
 * @param options - Scan options
 * @returns Stock signal scan result
 */
export function scanStockSignalsEnhanced(
  symbol: string,
  name: string,
  klines: BacktestKline[],
  strategyId: string,
  options: Partial<ScanOptions> = {},
): StockSignalResult {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const detector = STRATEGY_DETECTORS[strategyId];

  if (!detector) {
    throw new Error(`Unknown strategy: ${strategyId}`);
  }

  // Check if ST stock
  if (opts.excludeSTStocks && checkIsSTStock(name)) {
    return createEmptyResult(symbol, name, "ST股票已排除");
  }

  // Check if new stock
  const minDays = opts.minListingDays ?? 60;
  if (opts.excludeNewStocks && klines.length < minDays) {
    return createEmptyResult(symbol, name, `上市不足${minDays}天`);
  }

  // Need enough data for indicator warmup + holding period
  if (klines.length < 60 + opts.holdingDays) {
    return createEmptyResult(symbol, name, "数据不足");
  }

  // Pre-calculate all indicators
  const indicators = calculateAllIndicators(klines);

  // Detect market status if enabled
  let marketStatuses: MarketStatus[] | null = null;
  if (opts.detectMarketStatus) {
    marketStatuses = detectMarketStatusBatch(klines, symbol);
  }

  // Scan for signals
  const rawSignals: SignalDetail[] = [];

  // Start from index 30 (indicator warmup) and leave room for holding period
  for (let i = 30; i < klines.length - opts.holdingDays; i++) {
    const detection = detector.detect(klines, i, indicators);
    if (!detection) continue;

    // Apply signal strength threshold filter
    if (opts.strengthThreshold) {
      const { minStrength, maxStrength } = opts.strengthThreshold;
      if (minStrength !== undefined && detection.strength < minStrength) {
        continue; // Skip weak signals
      }
      if (maxStrength !== undefined && detection.strength > maxStrength) {
        continue; // Skip outlier signals
      }
    }

    const entryKline = klines[i];
    const exitIndex = i + opts.holdingDays;
    const exitKline = klines[exitIndex];

    if (!entryKline || !exitKline) continue;

    // Get market status if available
    const entryStatus = marketStatuses?.[i];
    const exitStatus = marketStatuses?.[exitIndex];

    // Determine signal execution status
    let status: SignalStatus = "completed";
    let statusReason: string | undefined;
    let isLimitUp = false;
    let isLimitDown = false;
    let isSuspended = false;

    if (entryStatus && exitStatus) {
      const statusInfo = determineSignalStatus(
        entryStatus,
        exitStatus,
        detection.type,
        exitIndex < klines.length,
      );
      status = statusInfo.status;
      statusReason = statusInfo.statusReason;
      isLimitUp = entryStatus.isLimitUp;
      isLimitDown = exitStatus.isLimitDown;
      isSuspended = entryStatus.isSuspended || exitStatus.isSuspended;
    }

    // Skip signals that cannot be executed
    if (status === "cannot_buy" || status === "cannot_sell") {
      continue;
    }

    const entryPrice = detection.price;
    const exitPrice = exitKline.close;

    // Calculate gross return
    const returnPct =
      detection.type === "buy"
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100;

    // Calculate net return with transaction costs
    let netReturnPct = returnPct;
    if (opts.transactionCosts) {
      netReturnPct = calcNetReturn(
        entryPrice,
        exitPrice,
        detection.type,
        opts.transactionCosts,
      );
    }

    rawSignals.push({
      symbol,
      name,
      type: detection.type,
      signal: detection.signal,
      strength: detection.strength,
      entryDate: formatDate(detection.timestamp),
      exitDate: formatDate(exitKline.time),
      entryPrice,
      exitPrice,
      returnPct,
      netReturnPct,
      isWin: netReturnPct > 0,
      holdingDays: opts.holdingDays,
      status,
      statusReason,
      isLimitUp,
      isLimitDown,
      isSuspended,
      actualHoldingDays: opts.holdingDays,
    });
  }

  // Apply deduplication if configured
  const signals = opts.deduplication
    ? deduplicateSignals(rawSignals, opts.deduplication)
    : rawSignals;

  // Calculate statistics
  const completedSignals = signals.filter((s) => s.status === "completed");
  const totalSignals = signals.length;
  const winSignals = completedSignals.filter((s) => s.isWin).length;
  const returns = completedSignals.map((s) => s.netReturnPct ?? s.returnPct);

  return {
    symbol,
    name,
    signals,
    totalSignals,
    winSignals,
    winRate:
      completedSignals.length > 0
        ? (winSignals / completedSignals.length) * 100
        : 0,
    avgReturn:
      returns.length > 0
        ? returns.reduce((a, b) => a + b, 0) / returns.length
        : 0,
    maxReturn: returns.length > 0 ? Math.max(...returns) : 0,
    minReturn: returns.length > 0 ? Math.min(...returns) : 0,
  };
}

/**
 * Create empty result with reason
 * 创建空结果并附带原因
 */
function createEmptyResult(
  symbol: string,
  name: string,
  _reason: string,
): StockSignalResult {
  return {
    symbol,
    name,
    signals: [],
    totalSignals: 0,
    winSignals: 0,
    winRate: 0,
    avgReturn: 0,
    maxReturn: 0,
    minReturn: 0,
  };
}

/**
 * Enhanced batch scanning with options
 * 带选项的增强批量扫描
 *
 * @param stocks - Array of {symbol, name, klines}
 * @param strategyId - Strategy ID to detect
 * @param options - Scan options
 * @param onProgress - Progress callback
 * @returns Array of stock signal results
 */
export function scanMultipleStocksEnhanced(
  stocks: Array<{
    symbol: string;
    name: string;
    klines: BacktestKline[];
  }>,
  strategyId: string,
  options: Partial<ScanOptions> = {},
  onProgress?: (completed: number, total: number) => void,
): StockSignalResult[] {
  const results: StockSignalResult[] = [];
  const total = stocks.length;

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    if (!stock) continue;

    const result = scanStockSignalsEnhanced(
      stock.symbol,
      stock.name,
      stock.klines,
      strategyId,
      options,
    );
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return results;
}

/**
 * Detect extreme return values that may indicate data errors
 * 检测可能表示数据错误的极端收益值
 *
 * @param signals - Signal details to check
 * @param threshold - Threshold for extreme values (default 50%)
 * @returns Signals marked as potentially anomalous
 */
export function detectExtremeReturns(
  signals: SignalDetail[],
  threshold: number = 50,
): Array<SignalDetail & { isExtreme: boolean; extremeReason?: string }> {
  return signals.map((signal) => {
    const returnVal = Math.abs(signal.returnPct);
    const isExtreme = returnVal > threshold;
    return {
      ...signal,
      isExtreme,
      extremeReason: isExtreme
        ? `收益率超过${threshold}%阈值: ${signal.returnPct.toFixed(2)}%`
        : undefined,
    };
  });
}

/**
 * Filter signals by status
 * 按状态过滤信号
 */
export function filterSignalsByStatus(
  signals: SignalDetail[],
  statuses: SignalStatus[],
): SignalDetail[] {
  return signals.filter((s) => statuses.includes(s.status));
}

/**
 * Get scan statistics summary
 * 获取扫描统计摘要
 */
export function getScanStatistics(results: StockSignalResult[]): {
  totalStocks: number;
  stocksWithSignals: number;
  totalSignals: number;
  completedSignals: number;
  holdingSignals: number;
  suspendedSignals: number;
  avgWinRate: number;
  avgReturn: number;
  bestStock: string | null;
  worstStock: string | null;
} {
  const stocksWithSignals = results.filter((r) => r.totalSignals > 0);

  let totalSignals = 0;
  let completedSignals = 0;
  let holdingSignals = 0;
  let suspendedSignals = 0;

  for (const result of results) {
    totalSignals += result.totalSignals;
    for (const signal of result.signals) {
      if (signal.status === "completed") completedSignals++;
      if (signal.status === "holding") holdingSignals++;
      if (signal.status === "suspended") suspendedSignals++;
    }
  }

  const winRates = stocksWithSignals.map((r) => r.winRate);
  const avgWinRate =
    winRates.length > 0
      ? winRates.reduce((a, b) => a + b, 0) / winRates.length
      : 0;

  const returns = stocksWithSignals.map((r) => r.avgReturn);
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;

  let bestStock: string | null = null;
  let worstStock: string | null = null;
  let maxReturn = -Infinity;
  let minReturn = Infinity;

  for (const result of stocksWithSignals) {
    if (result.avgReturn > maxReturn) {
      maxReturn = result.avgReturn;
      bestStock = result.name;
    }
    if (result.avgReturn < minReturn) {
      minReturn = result.avgReturn;
      worstStock = result.name;
    }
  }

  return {
    totalStocks: results.length,
    stocksWithSignals: stocksWithSignals.length,
    totalSignals,
    completedSignals,
    holdingSignals,
    suspendedSignals,
    avgWinRate,
    avgReturn,
    bestStock,
    worstStock,
  };
}
