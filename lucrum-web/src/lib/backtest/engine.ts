/**
 * Backtest Engine
 * 回测引擎
 *
 * A lightweight backtest engine that simulates trading strategies
 * based on generated strategy code and historical K-line data.
 *
 * Features:
 * - Lot size rules for A-shares (100股/手)
 * - Detailed trade records with execution info
 * - Daily logs for full transparency
 * - Commission and slippage simulation
 *
 * @module lib/backtest/engine
 */

import {
  roundToLot,
  calculateMaxAffordableLots,
  getLotSizeConfig,
  detectAssetType,
  formatQuantityWithUnit,
  type LotCalculation,
} from "./lot-size";

import { getSymbolName, getQuantityUnit, getMarketName } from "./symbol-info";

import type {
  BacktestKline,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  ParsedStrategy,
  EquityPoint,
  StrategySignal,
  DetailedTrade,
  BacktestDailyLog,
  EnhancedBacktestResult,
  BacktestSummary,
} from "./types";

// Re-export types for backward compatibility
export type {
  BacktestKline,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  ParsedStrategy,
  EquityPoint,
  StrategySignal,
  DetailedTrade,
  BacktestDailyLog,
  EnhancedBacktestResult,
};

// =============================================================================
// INDICATOR CALCULATIONS / 指标计算
// =============================================================================

/**
 * Calculate Simple Moving Average (SMA)
 */
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
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
 * Calculate MACD (Moving Average Convergence Divergence)
 */
function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): { dif: number[]; dea: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const dif = fastEMA.map((fast, i) => fast - (slowEMA[i] ?? 0));
  const dea = calculateEMA(dif, signalPeriod);
  const histogram = dif.map((d, i) => (d - (dea[i] ?? 0)) * 2);

  return { dif, dea, histogram };
}

/**
 * Calculate Bollinger Bands
 */
function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i] ?? 0;
      const variance =
        slice.reduce((sum, val) => sum + Math.pow((val ?? 0) - mean, 2), 0) /
        period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

// =============================================================================
// STRATEGY PARSER / 策略解析器
// =============================================================================

/**
 * Parse strategy code to extract parameters and conditions
 * 解析策略代码提取参数和条件
 */
export function parseStrategyCode(code: string): ParsedStrategy {
  const strategy: ParsedStrategy = {
    name: "Custom Strategy",
    params: {},
    indicators: [],
    entryCondition: "",
    exitCondition: "",
  };

  // Extract strategy name
  const nameMatch = code.match(/class\s+(\w+)/);
  if (nameMatch) {
    strategy.name = nameMatch[1] ?? "Custom Strategy";
  }

  // Extract parameters (e.g., fast_window = 5)
  const paramRegex = /(\w+_?\w*)\s*=\s*(\d+(?:\.\d+)?)/g;
  let paramMatch;
  while ((paramMatch = paramRegex.exec(code)) !== null) {
    const key = paramMatch[1];
    const value = paramMatch[2];
    if (key && value && !key.startsWith("self") && !key.includes("__")) {
      strategy.params[key] = parseFloat(value);
    }
  }

  // Detect indicators used
  if (code.includes("sma") || code.includes("均线") || code.includes("ma")) {
    strategy.indicators.push("SMA");
  }
  if (code.includes("ema")) {
    strategy.indicators.push("EMA");
  }
  if (code.includes("rsi") || code.includes("RSI")) {
    strategy.indicators.push("RSI");
  }
  if (code.includes("macd") || code.includes("MACD")) {
    strategy.indicators.push("MACD");
  }
  if (code.includes("boll") || code.includes("布林")) {
    strategy.indicators.push("BOLL");
  }

  // Extract entry condition (simplified)
  // Use case-insensitive flag only (compatible with ES5+)
  const lowerCode = code.toLowerCase();
  const buyMatch = lowerCode.match(
    /if[^;]*(fast[^;]*>[^;]*slow|rsi[^;]*<|macd[^;]*>)[^;]*buy/i,
  );
  if (buyMatch) {
    strategy.entryCondition = buyMatch[1] ?? "MA crossover";
  } else {
    strategy.entryCondition =
      strategy.indicators.length > 0
        ? `${strategy.indicators.join(" + ")} signal`
        : "Default entry";
  }

  // Extract exit condition (simplified)
  const sellMatch = lowerCode.match(
    /if[^;]*(fast[^;]*<[^;]*slow|rsi[^;]*>|macd[^;]*<)[^;]*sell/i,
  );
  if (sellMatch) {
    strategy.exitCondition = sellMatch[1] ?? "MA crossover";
  } else {
    strategy.exitCondition =
      strategy.indicators.length > 0
        ? `${strategy.indicators.join(" + ")} signal`
        : "Default exit";
  }

  return strategy;
}

// =============================================================================
// SIGNAL GENERATOR / 信号生成器
// =============================================================================

/**
 * Generate trading signal based on strategy and market data
 * 根据策略和市场数据生成交易信号
 */
function generateSignal(
  strategy: ParsedStrategy,
  klines: BacktestKline[],
  index: number,
  currentPosition: number,
  indicators: {
    sma5?: number[];
    sma10?: number[];
    sma20?: number[];
    sma60?: number[];
    rsi?: number[];
    macd?: { dif: number[]; dea: number[]; histogram: number[] };
    boll?: { upper: number[]; middle: number[]; lower: number[] };
  },
): StrategySignal {
  const prices = klines.map((k) => k.close);
  const currentPrice = prices[index] ?? 0;

  // Default signal
  let signal: StrategySignal = { action: "hold" };

  // MA Crossover Strategy
  if (
    strategy.indicators.includes("SMA") ||
    Object.keys(strategy.params).some(
      (k) => k.includes("ma") || k.includes("window"),
    )
  ) {
    const fastPeriod = strategy.params.fast_window ?? strategy.params.fast ?? 5;
    const slowPeriod =
      strategy.params.slow_window ?? strategy.params.slow ?? 20;

    const fastMA = indicators.sma5 ?? calculateSMA(prices, fastPeriod);
    const slowMA = indicators.sma20 ?? calculateSMA(prices, slowPeriod);

    const currFast = fastMA[index];
    const currSlow = slowMA[index];
    const prevFast = fastMA[index - 1];
    const prevSlow = slowMA[index - 1];

    if (
      currFast !== undefined &&
      currSlow !== undefined &&
      prevFast !== undefined &&
      prevSlow !== undefined &&
      !isNaN(currFast) &&
      !isNaN(currSlow) &&
      !isNaN(prevFast) &&
      !isNaN(prevSlow)
    ) {
      // Golden cross - buy signal
      if (
        prevFast <= prevSlow &&
        currFast > currSlow &&
        currentPosition === 0
      ) {
        signal = {
          action: "buy",
          reason: `MA金叉 (${fastPeriod}>${slowPeriod})`,
        };
      }
      // Death cross - sell signal
      else if (
        prevFast >= prevSlow &&
        currFast < currSlow &&
        currentPosition > 0
      ) {
        signal = {
          action: "sell",
          reason: `MA死叉 (${fastPeriod}<${slowPeriod})`,
        };
      }
    }
  }

  // RSI Strategy
  if (strategy.indicators.includes("RSI")) {
    const rsiPeriod =
      strategy.params.rsi_window ?? strategy.params.rsi_period ?? 14;
    const rsiBuy = strategy.params.rsi_buy ?? strategy.params.oversold ?? 30;
    const rsiSell =
      strategy.params.rsi_sell ?? strategy.params.overbought ?? 70;

    const rsi = indicators.rsi ?? calculateRSI(prices, rsiPeriod);
    const currRSI = rsi[index];
    const prevRSI = rsi[index - 1];

    if (
      currRSI !== undefined &&
      prevRSI !== undefined &&
      !isNaN(currRSI) &&
      !isNaN(prevRSI)
    ) {
      // Oversold bounce - buy signal
      if (prevRSI < rsiBuy && currRSI >= rsiBuy && currentPosition === 0) {
        signal = {
          action: "buy",
          reason: `RSI超卖反弹 (${currRSI.toFixed(1)})`,
        };
      }
      // Overbought - sell signal
      else if (currRSI > rsiSell && currentPosition > 0) {
        signal = { action: "sell", reason: `RSI超买 (${currRSI.toFixed(1)})` };
      }
    }
  }

  // MACD Strategy
  if (strategy.indicators.includes("MACD")) {
    const macd = indicators.macd ?? calculateMACD(prices);
    const currHist = macd.histogram[index];
    const prevHist = macd.histogram[index - 1];

    if (
      currHist !== undefined &&
      prevHist !== undefined &&
      !isNaN(currHist) &&
      !isNaN(prevHist)
    ) {
      // MACD histogram turns positive - buy signal
      if (prevHist <= 0 && currHist > 0 && currentPosition === 0) {
        signal = { action: "buy", reason: "MACD金叉" };
      }
      // MACD histogram turns negative - sell signal
      else if (prevHist >= 0 && currHist < 0 && currentPosition > 0) {
        signal = { action: "sell", reason: "MACD死叉" };
      }
    }
  }

  // Bollinger Bands Strategy
  if (strategy.indicators.includes("BOLL")) {
    const boll = indicators.boll ?? calculateBollingerBands(prices);
    const lower = boll.lower[index];
    const upper = boll.upper[index];

    if (
      lower !== undefined &&
      upper !== undefined &&
      !isNaN(lower) &&
      !isNaN(upper)
    ) {
      // Price touches lower band - buy signal
      if (currentPrice <= lower && currentPosition === 0) {
        signal = { action: "buy", reason: "触及布林下轨" };
      }
      // Price touches upper band - sell signal
      else if (currentPrice >= upper && currentPosition > 0) {
        signal = { action: "sell", reason: "触及布林上轨" };
      }
    }
  }

  return signal;
}

// =============================================================================
// A-SHARE MARKET CONSTANTS / A股市场常量
// =============================================================================

/** China 1-year deposit benchmark rate as risk-free rate / 中国1年期存款基准利率作为无风险利率 */
const CHINA_RISK_FREE_RATE = 0.02;
/** Daily risk-free rate / 每日无风险利率 */
const DAILY_RISK_FREE_RATE = CHINA_RISK_FREE_RATE / 252;
/**
 * Get circuit breaker (price limit) thresholds based on stock symbol / board type
 * 根据股票代码/板块类型获取涨跌停阈值
 *
 * 主板: ±10%, 科创板(688xxx): ±20%, 创业板(300xxx/301xxx): ±20%,
 * 北交所(8xxxxx/4xxxxx/9xxxxx): ±30%, ST股票: ±5%
 */
function getCircuitBreakerLimits(symbol: string): { limitUp: number; limitDown: number } {
  const s = symbol.replace(/\D/g, ""); // Strip non-digits
  const name = symbol.toUpperCase();

  // ST stocks: ±5%
  if (name.includes("ST")) {
    return { limitUp: 1.05, limitDown: 0.95 };
  }
  // STAR Market (科创板): 688xxx → ±20%
  if (s.startsWith("688")) {
    return { limitUp: 1.20, limitDown: 0.80 };
  }
  // ChiNext (创业板): 300xxx / 301xxx → ±20%
  if (s.startsWith("300") || s.startsWith("301")) {
    return { limitUp: 1.20, limitDown: 0.80 };
  }
  // BSE (北交所): 8xxxxx / 4xxxxx / 9xxxxx → ±30%
  if (s.startsWith("8") || s.startsWith("4") || s.startsWith("9")) {
    return { limitUp: 1.30, limitDown: 0.70 };
  }
  // Main board default: ±10%
  return { limitUp: 1.10, limitDown: 0.90 };
}
/** Default stamp duty rate (sell only, reduced to 0.05% since 2023-08-28) / 默认印花税率（仅卖出，2023-08-28起降至0.05%） */
const DEFAULT_STAMP_DUTY = 0.0005;
/** Default transfer fee rate (bilateral, 0.001%) / 默认过户费率（双向收取，0.001%） */
const DEFAULT_TRANSFER_FEE = 0.00001;
/** Minimum commission per trade in CNY / 每笔交易最低佣金（元） */
const MIN_COMMISSION_CNY = 5;

// =============================================================================
// HELPER: RUN A SINGLE BACKTEST SEGMENT / 运行单段回测
// =============================================================================

interface SegmentResult {
  summary: BacktestSummary;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  detailedTrades: DetailedTrade[];
  dailyLogs: BacktestDailyLog[];
  finalCash: number;
  peakEquity: number;
}

function runBacktestSegment(
  strategy: ReturnType<typeof parseStrategyCode>,
  klines: BacktestKline[],
  config: BacktestConfig,
  lotSizeConfigArg: ReturnType<typeof getLotSizeConfig>,
  assetType: string,
  indicators: {
    sma5: number[];
    sma10: number[];
    sma20: number[];
    sma60: number[];
    rsi: number[];
    macd: { dif: number[]; dea: number[]; histogram: number[] };
    boll: { upper: number[]; middle: number[]; lower: number[] };
  },
  startIndex: number,
  endIndex: number,
  executionStartTime: number,
): SegmentResult {
  const enableT1 = config.enableT1 !== false; // default true
  const enableCircuitBreaker = config.enableCircuitBreaker !== false; // default true
  const stampDuty = config.stampDuty ?? DEFAULT_STAMP_DUTY;
  const transferFee = config.transferFee ?? DEFAULT_TRANSFER_FEE;
  const { limitUp, limitDown } = getCircuitBreakerLimits(config.symbol);

  let cash = config.initialCapital;
  let position = 0;
  let positionPrice = 0;
  let entryTradeId: string | null = null;
  let entryTime = 0;
  let heldSinceDate = ""; // Date when current position was entered (for T+1)
  const trades: BacktestTrade[] = [];
  const detailedTrades: DetailedTrade[] = [];
  const dailyLogs: BacktestDailyLog[] = [];
  const equityCurve: EquityPoint[] = [];

  let peakEquity = config.initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownDuration = 0;
  let drawdownStartIndex: number | null = null;
  const dailyReturns: number[] = [];
  let prevEquity = config.initialCapital;
  let totalCommission = 0;
  let totalSlippage = 0;

  // Pending order: signal generated at bar[i-1], executed at bar[i].open
  // 挂单机制: 信号在 bar[i-1] 收盘时生成，在 bar[i] 开盘时执行
  let pendingSignal: ReturnType<typeof generateSignal> | null = null;

  for (let i = startIndex; i < endIndex; i++) {
    const bar = klines[i];
    if (!bar) continue;

    const prevBar = klines[i - 1];
    const date = new Date(bar.time * 1000).toISOString().split("T")[0] ?? "";

    // Execution price is today's OPEN (fix look-ahead bias)
    // 成交价为今日开盘价（修正前瞻偏差）
    const execPrice = bar.open;
    const prevClose = prevBar?.close ?? bar.open;

    const currentIndicators = {
      sma5: indicators.sma5[i],
      sma10: indicators.sma10[i],
      sma20: indicators.sma20[i],
      sma60: indicators.sma60[i],
      rsi: indicators.rsi[i],
      macdDif: indicators.macd.dif[i],
      macdDea: indicators.macd.dea[i],
      macdHist: indicators.macd.histogram[i],
      bollUpper: indicators.boll.upper[i],
      bollMiddle: indicators.boll.middle[i],
      bollLower: indicators.boll.lower[i],
    };

    let action = "持有";
    let actionDetail = "";

    // ---------- Execute pending order from yesterday's signal ----------
    if (pendingSignal && pendingSignal.action === "buy" && position === 0 && cash > 0) {
      // Circuit breaker: if limit-up, cannot buy
      // 涨停检查: 若股价涨停，买入失败
      const isLimitUp = enableCircuitBreaker && bar.high >= prevClose * limitUp;
      if (isLimitUp) {
        action = "涨停，买入失败";
        actionDetail = `开盘价${execPrice.toFixed(2)}, 昨收${prevClose.toFixed(2)}, 触及涨停`;
      } else {
        const slippageAmount = execPrice * config.slippage;
        const buyPrice = execPrice + slippageAmount;

        // Round-lot enforcement: quantity MUST be multiple of lotSize (100 for A-shares).
        // If capital is insufficient for even 1 lot, skip this signal entirely.
        const lotCalc = calculateMaxAffordableLots(
          cash,
          buyPrice,
          config.symbol,
          config.commission,
        );

        if (lotCalc.actualQuantity <= 0) {
          // Insufficient capital for minimum 1 lot — skip signal
          action = "资金不足，跳过信号";
          const lotConfig = getLotSizeConfig(config.symbol);
          const minCost = lotConfig.lotSize * buyPrice * (1 + config.commission);
          actionDetail = `需${minCost.toFixed(0)}元买入1手(${lotConfig.lotSize}股), 可用${cash.toFixed(0)}元`;
        } else if (lotCalc.actualQuantity > 0) {
          const buySize = lotCalc.actualQuantity;
          const cost = buySize * buyPrice;
          // Enforce minimum commission (5 yuan) + transfer fee (bilateral)
          const commission = Math.max(cost * config.commission, MIN_COMMISSION_CNY);
          const buyTransferFee = cost * transferFee;
          const totalCost = cost + commission + buyTransferFee;

          const cashBefore = cash;
          const positionBefore = position;
          const portfolioValueBefore = cash + position * execPrice;

          cash -= totalCost;
          position = buySize;
          positionPrice = buyPrice;
          entryTime = bar.time;
          heldSinceDate = date;
          entryTradeId = `T${trades.length + 1}`;

          totalCommission += commission;
          totalSlippage += slippageAmount * buySize;

          trades.push({
            id: entryTradeId,
            type: "buy",
            price: buyPrice,
            size: buySize,
            timestamp: bar.time,
            reason: pendingSignal.reason ?? "Buy signal",
          });

          const currentLotSizeConfig = getLotSizeConfig(config.symbol);
          detailedTrades.push({
            id: entryTradeId,
            timestamp: bar.time,
            date,
            type: "buy",
            symbol: config.symbol,
            symbolName: getSymbolName(config.symbol),
            market: getMarketName(config.symbol),
            signalPrice: prevBar?.close ?? execPrice,
            executePrice: buyPrice,
            slippage: slippageAmount * buySize,
            slippagePercent: config.slippage * 100,
            commission,
            commissionPercent: config.commission * 100,
            totalCost: commission + slippageAmount * buySize,
            lotCalculation: lotCalc,
            requestedQuantity: lotCalc.requestedQuantity,
            actualQuantity: buySize,
            lots: lotCalc.actualLots,
            lotSize: currentLotSizeConfig.lotSize,
            quantityUnit: getQuantityUnit(config.symbol),
            orderValue: buySize * buyPrice,
            cashBefore,
            cashAfter: cash,
            positionBefore,
            positionAfter: position,
            portfolioValueBefore,
            portfolioValueAfter: cash + position * execPrice,
            triggerReason: pendingSignal.reason ?? "Buy signal",
            indicatorValues: currentIndicators as Record<string, number>,
            strategyName: strategy.name,
          });

          action = `买入${formatQuantityWithUnit(buySize, config.symbol)}`;
          actionDetail = `开盘价${buyPrice.toFixed(2)}, 手续费${commission.toFixed(2)}, 滑点${(slippageAmount * buySize).toFixed(2)}`;
        }
      }
    } else if (pendingSignal && pendingSignal.action === "sell" && position > 0) {
      // Sell entire position — no fractional sells for A-shares.
      // T+1 check: cannot sell on the same day as purchase
      // T+1 检查: 不能在买入当天卖出; 卖出时全仓清仓，不拆分零股
      const t1Blocked = enableT1 && date <= heldSinceDate;
      // Circuit breaker: if limit-down, cannot sell
      // 跌停检查: 若股价跌停，卖出失败
      const isLimitDown = enableCircuitBreaker && bar.low <= prevClose * limitDown;

      if (t1Blocked) {
        action = "T+1限制，卖出失败";
        actionDetail = `买入日${heldSinceDate}, 今日${date}, 需次日方可卖出`;
      } else if (isLimitDown) {
        action = "跌停，卖出失败";
        actionDetail = `开盘价${execPrice.toFixed(2)}, 昨收${prevClose.toFixed(2)}, 触及跌停`;
      } else {
        const slippageAmount = execPrice * config.slippage;
        const sellPrice = execPrice - slippageAmount;
        const sellValue = position * sellPrice;
        // Apply stamp duty on sell side + transfer fee (bilateral) + min commission
        // 卖出时加收印花税 + 过户费（双向） + 最低佣金
        const sellStampDuty = sellValue * stampDuty;
        const sellTransferFee = sellValue * transferFee;
        const commission = Math.max(sellValue * config.commission, MIN_COMMISSION_CNY);
        const revenue = sellValue - sellStampDuty - sellTransferFee;

        const pnl = revenue - commission - position * positionPrice;
        const pnlPercent = (pnl / (position * positionPrice)) * 100;
        const holdingDays = (bar.time - entryTime) / 86400;

        const cashBefore = cash;
        const positionBefore = position;
        const portfolioValueBefore = cash + position * execPrice;

        cash += revenue - commission;

        totalCommission += commission;
        totalSlippage += slippageAmount * position;

        const sellTradeId = `T${trades.length + 1}`;

        trades.push({
          id: sellTradeId,
          type: "sell",
          price: sellPrice,
          size: position,
          timestamp: bar.time,
          reason: pendingSignal.reason ?? "Sell signal",
          pnl,
          pnlPercent,
        });

        const sellLotCalc = roundToLot(position, config.symbol, "sell");
        const sellLotSizeConfig = getLotSizeConfig(config.symbol);

        detailedTrades.push({
          id: sellTradeId,
          timestamp: bar.time,
          date,
          type: "sell",
          symbol: config.symbol,
          symbolName: getSymbolName(config.symbol),
          market: getMarketName(config.symbol),
          signalPrice: prevBar?.close ?? execPrice,
          executePrice: sellPrice,
          slippage: slippageAmount * position,
          slippagePercent: config.slippage * 100,
          commission,
          commissionPercent: config.commission * 100,
          totalCost: commission + slippageAmount * position,
          lotCalculation: sellLotCalc,
          requestedQuantity: position,
          actualQuantity: position,
          lots: sellLotCalc.actualLots,
          lotSize: sellLotSizeConfig.lotSize,
          quantityUnit: getQuantityUnit(config.symbol),
          orderValue: position * sellPrice,
          cashBefore,
          cashAfter: cash,
          positionBefore,
          positionAfter: 0,
          portfolioValueBefore,
          portfolioValueAfter: cash,
          pnl,
          pnlPercent,
          holdingDays,
          entryTradeId: entryTradeId ?? undefined,
          triggerReason: pendingSignal.reason ?? "Sell signal",
          indicatorValues: currentIndicators as Record<string, number>,
          strategyName: strategy.name,
        });

        action = `卖出${formatQuantityWithUnit(position, config.symbol)}`;
        actionDetail = `开盘价${sellPrice.toFixed(2)}, 盈亏${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%)`;

        position = 0;
        positionPrice = 0;
        entryTradeId = null;
        entryTime = 0;
        heldSinceDate = "";
      }
    }

    // Generate signal for TOMORROW's execution (using today's close data)
    // 用今日收盘数据生成信号，明日开盘执行
    pendingSignal = generateSignal(strategy, klines, i, position, indicators);

    // Calculate equity using today's CLOSE for end-of-day valuation
    const closingPrice = bar.close;
    const equity = cash + position * closingPrice;
    const positionValue = position * closingPrice;

    // Track drawdown and MDD duration
    if (equity > peakEquity) {
      // New high: update peak and close any drawdown period
      if (drawdownStartIndex !== null) {
        const duration = i - drawdownStartIndex;
        if (duration > maxDrawdownDuration) {
          maxDrawdownDuration = duration;
        }
        drawdownStartIndex = null;
      }
      peakEquity = equity;
    } else {
      // In drawdown: record start if not already tracking
      if (drawdownStartIndex === null && equity < peakEquity) {
        drawdownStartIndex = i;
      }
    }

    const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    const dailyReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0;
    dailyReturns.push(dailyReturn);

    dailyLogs.push({
      bar: i,
      date,
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      indicators: currentIndicators,
      signal: pendingSignal.action !== "hold" ? pendingSignal.action : null,
      signalReason: pendingSignal.action !== "hold" ? (pendingSignal.reason ?? null) : null,
      action,
      actionDetail,
      cash,
      position,
      positionValue,
      portfolioValue: equity,
      portfolioReturn: ((equity - config.initialCapital) / config.initialCapital) * 100,
      dailyReturn: dailyReturn * 100,
      drawdown: drawdown * 100,
      peakValue: peakEquity,
    });

    prevEquity = equity;

    equityCurve.push({
      date,
      equity,
      drawdown: drawdown * 100,
      position,
    });
  }

  // Close any remaining position at last bar's close
  if (position > 0) {
    const lastBar = klines[endIndex - 1];
    if (lastBar) {
      const finalPrice = lastBar.close;
      const closeValue = position * finalPrice;
      const stampDutyAmount = closeValue * stampDuty;
      const closeTransferFee = closeValue * transferFee;
      const revenue = closeValue - stampDutyAmount - closeTransferFee;
      const commission = Math.max(closeValue * config.commission, MIN_COMMISSION_CNY);
      const pnl = revenue - commission - position * positionPrice;
      const holdingDays = (lastBar.time - entryTime) / 86400;

      totalCommission += commission;
      cash += revenue - commission;

      const sellTradeId = `T${trades.length + 1}`;
      const date =
        new Date(lastBar.time * 1000).toISOString().split("T")[0] ?? "";

      trades.push({
        id: sellTradeId,
        type: "sell",
        price: finalPrice,
        size: position,
        timestamp: lastBar.time,
        reason: "回测结束平仓",
        pnl,
        pnlPercent: position * positionPrice > 0 ? (pnl / (position * positionPrice)) * 100 : 0,
      });

      const sellLotCalc = roundToLot(position, config.symbol, "sell");
      const finalLotSizeConfig = getLotSizeConfig(config.symbol);

      detailedTrades.push({
        id: sellTradeId,
        timestamp: lastBar.time,
        date,
        type: "sell",
        symbol: config.symbol,
        symbolName: getSymbolName(config.symbol),
        market: getMarketName(config.symbol),
        signalPrice: finalPrice,
        executePrice: finalPrice,
        slippage: 0,
        slippagePercent: 0,
        commission,
        commissionPercent: config.commission * 100,
        totalCost: commission,
        lotCalculation: sellLotCalc,
        requestedQuantity: position,
        actualQuantity: position,
        lots: sellLotCalc.actualLots,
        lotSize: finalLotSizeConfig.lotSize,
        quantityUnit: getQuantityUnit(config.symbol),
        orderValue: position * finalPrice,
        cashBefore: cash - revenue + commission,
        cashAfter: cash,
        positionBefore: position,
        positionAfter: 0,
        portfolioValueBefore: cash - revenue + commission + position * finalPrice,
        portfolioValueAfter: cash,
        pnl,
        pnlPercent: position * positionPrice > 0 ? (pnl / (position * positionPrice)) * 100 : 0,
        holdingDays,
        entryTradeId: entryTradeId ?? undefined,
        triggerReason: "回测结束平仓",
        indicatorValues: {},
        strategyName: strategy.name,
      });
    }
  }

  const finalEquity = cash;
  const totalReturn = ((finalEquity - config.initialCapital) / config.initialCapital) * 100;

  // Compound annualized return using calendar days (not trading days)
  // 使用日历天数复利年化（非交易日数）
  const firstBar = klines[startIndex];
  const lastBarForCalc = klines[endIndex - 1];
  const calendarDays = firstBar && lastBarForCalc
    ? (lastBarForCalc.time - firstBar.time) / 86400
    : 0;
  const annualizedReturn = calendarDays > 0
    ? (Math.pow(finalEquity / config.initialCapital, 365 / calendarDays) - 1) * 100
    : 0;

  const completedTrades = trades.filter((t) => t.type === "sell" && t.pnl !== undefined);
  const winningTrades = completedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losingTrades = completedTrades.filter((t) => (t.pnl ?? 0) <= 0);

  const winRate = completedTrades.length > 0
    ? (winningTrades.length / completedTrades.length) * 100
    : 0;

  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / losingTrades.length)
    : 0;

  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  const maxSingleWin = completedTrades.length > 0
    ? Math.max(...completedTrades.map((t) => t.pnlPercent ?? 0), 0)
    : 0;
  const maxSingleLoss = completedTrades.length > 0
    ? Math.min(...completedTrades.map((t) => t.pnlPercent ?? 0), 0)
    : 0;

  const maxWinTrade = completedTrades.find((t) => t.pnlPercent === maxSingleWin);
  const maxLossTrade = completedTrades.find((t) => t.pnlPercent === maxSingleLoss);
  const maxSingleWinDate = maxWinTrade
    ? (new Date(maxWinTrade.timestamp * 1000).toISOString().split("T")[0] ?? "")
    : "";
  const maxSingleLossDate = maxLossTrade
    ? (new Date(maxLossTrade.timestamp * 1000).toISOString().split("T")[0] ?? "")
    : "";

  // Correct Sharpe: (annualized excess return) / (annualized volatility)
  // 正确的夏普比率：（年化超额收益）/（年化波动率）
  const avgDailyReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(
        dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) /
          (dailyReturns.length - 1),
      )
    : 0;
  const annualizedVol = stdReturn * Math.sqrt(252) * 100;

  // Annualized excess return over risk-free rate
  const excessAnnualReturn = annualizedReturn - CHINA_RISK_FREE_RATE * 100;
  const sharpeRatio = annualizedVol > 0 ? excessAnnualReturn / annualizedVol : 0;

  // Correct Sortino: uses ALL returns with min(r, 0) for downside deviation
  // 正确的索提诺比率：用全序列的 min(r, 0) 计算下行偏差
  const downsideSquaredSum = dailyReturns.reduce(
    (sum, r) => sum + Math.pow(Math.min(r - DAILY_RISK_FREE_RATE, 0), 2),
    0,
  );
  const downsideDeviation = dailyReturns.length > 0
    ? Math.sqrt((downsideSquaredSum / dailyReturns.length) * 252) * 100
    : 0;
  const sortinoRatio = downsideDeviation > 0 ? excessAnnualReturn / downsideDeviation : 0;

  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / (maxDrawdown * 100) : 0;
  const volatility = annualizedVol;

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of completedTrades) {
    if ((trade.pnl ?? 0) > 0) {
      currentWins++;
      currentLosses = 0;
      if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
    } else {
      currentLosses++;
      currentWins = 0;
      if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
    }
  }

  const holdingPeriods: number[] = [];
  let lastBuyTime = 0;
  for (const trade of trades) {
    if (trade.type === "buy") {
      lastBuyTime = trade.timestamp;
    } else if (trade.type === "sell" && lastBuyTime > 0) {
      holdingPeriods.push((trade.timestamp - lastBuyTime) / 86400);
      lastBuyTime = 0;
    }
  }
  const avgHoldingPeriod = holdingPeriods.length > 0
    ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length
    : 0;

  const tradingDays = endIndex - startIndex;
  const executionTime = Date.now() - executionStartTime;

  const totalTradingCost = totalCommission + totalSlippage;
  const tradingCostPercent = (totalTradingCost / config.initialCapital) * 100;

  const summary: BacktestSummary = {
    startDate: config.startDate,
    endDate: config.endDate,
    tradingDays,
    executionTime,
    initialCapital: config.initialCapital,
    finalCapital: finalEquity,
    peakCapital: peakEquity,
    troughCapital: peakEquity * (1 - maxDrawdown),
    totalReturn,
    annualizedReturn,
    monthlyReturn: annualizedReturn / 12,
    dailyReturn: avgDailyReturn * 100,
    maxDrawdown: maxDrawdown * 100,
    maxDrawdownDuration,
    volatility,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    totalTrades: completedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    avgHoldingPeriod,
    maxSingleWin,
    maxSingleWinDate,
    maxSingleLoss,
    maxSingleLossDate,
    totalCommission,
    totalSlippage,
    totalTradingCost,
    tradingCostPercent,
  };

  return {
    summary,
    equityCurve,
    trades,
    detailedTrades,
    dailyLogs,
    finalCash: cash,
    peakEquity,
  };
}

// =============================================================================
// BACKTEST ENGINE / 回测引擎
// =============================================================================

/**
 * Run backtest with given strategy and data
 * 使用给定策略和数据运行回测
 *
 * Enhanced version with:
 * - Lot size rules (一手规则)
 * - Detailed trade records (详细交易记录)
 * - Daily logs (每日日志)
 * - Fix: No look-ahead bias (signal at bar[i-1] close, execute at bar[i] open)
 * - Fix: T+1 A-share rule
 * - Fix: Correct Sharpe/Sortino with China risk-free rate
 * - Fix: Circuit breaker (limit up/down) constraint
 * - Fix: Stamp duty on sell side
 * - Fix: Max drawdown duration
 * - Support: Walk-forward in/out-of-sample split
 * - Support: Benchmark comparison
 */
export async function runBacktest(
  strategyCode: string,
  klines: BacktestKline[],
  config: BacktestConfig,
): Promise<BacktestResult> {
  const startTime = Date.now();

  if (klines.length < 2) {
    throw new Error("Insufficient K-line data for backtesting (need at least 2 bars)");
  }

  const strategy = parseStrategyCode(strategyCode);
  const lotSizeConfig = getLotSizeConfig(config.symbol);
  const assetType = detectAssetType(config.symbol);

  // Pre-calculate indicators once for full dataset
  const prices = klines.map((k) => k.close);
  const indicators = {
    sma5: calculateSMA(prices, 5),
    sma10: calculateSMA(prices, 10),
    sma20: calculateSMA(prices, 20),
    sma60: calculateSMA(prices, 60),
    rsi: calculateRSI(prices, 14),
    macd: calculateMACD(prices),
    boll: calculateBollingerBands(prices),
  };

  // Determine walk-forward split
  const wfSplitRatio = config.wfSplitRatio ?? 0;
  const splitIndex = wfSplitRatio > 0
    ? Math.floor(klines.length * wfSplitRatio)
    : klines.length;

  // Run full sample (always)
  const fullResult = runBacktestSegment(
    strategy, klines, config, lotSizeConfig, assetType,
    indicators, 1, klines.length, startTime,
  );

  // Walk-forward: run in-sample and out-of-sample separately
  let inSampleMetrics: BacktestSummary | undefined;
  let outOfSampleMetrics: BacktestSummary | undefined;
  let splitDate: string | undefined;

  if (wfSplitRatio > 0 && splitIndex > 1 && splitIndex < klines.length - 1) {
    const splitBar = klines[splitIndex];
    splitDate = splitBar ? (new Date(splitBar.time * 1000).toISOString().split("T")[0] ?? undefined) : undefined;

    const inSampleResult = runBacktestSegment(
      strategy, klines, config, lotSizeConfig, assetType,
      indicators, 1, splitIndex, startTime,
    );
    inSampleMetrics = inSampleResult.summary;

    const outOfSampleResult = runBacktestSegment(
      strategy, klines, config, lotSizeConfig, assetType,
      indicators, splitIndex, klines.length, startTime,
    );
    outOfSampleMetrics = outOfSampleResult.summary;
  }

  // Benchmark comparison: buy-and-hold
  let benchmarkReturn: number | undefined;
  let alpha: number | undefined;
  let beta: number | undefined;
  let informationRatio: number | undefined;

  if (config.benchmarkKlines && config.benchmarkKlines.length >= 2) {
    const bklines = config.benchmarkKlines;
    const bFirst = bklines[0]!;
    const bLast = bklines[bklines.length - 1]!;
    benchmarkReturn = ((bLast.close - bFirst.close) / bFirst.close) * 100;
    alpha = fullResult.summary.totalReturn - benchmarkReturn;
    beta = 1; // Simplified; full beta requires correlation calculation
    informationRatio = fullResult.summary.volatility > 0
      ? alpha / fullResult.summary.volatility
      : 0;
  }

  const summary: BacktestSummary = {
    ...fullResult.summary,
    benchmarkReturn,
    alpha,
    beta,
    informationRatio,
    inSampleMetrics,
    outOfSampleMetrics,
    splitDate,
  };

  const enhancedResult: EnhancedBacktestResult = {
    summary,
    equityCurve: fullResult.equityCurve.map((e) => ({
      ...e,
      cash: e.equity - (e.position > 0
        ? e.position * (klines[klines.length - 1]?.close ?? 0)
        : 0),
    })),
    trades: fullResult.detailedTrades,
    dailyLogs: fullResult.dailyLogs,
    config,
    strategy,
    lotSizeInfo: {
      assetType,
      lotSize: lotSizeConfig.lotSize,
      description: lotSizeConfig.description,
    },
  };

  return {
    totalReturn: summary.totalReturn,
    annualizedReturn: summary.annualizedReturn,
    maxDrawdown: summary.maxDrawdown,
    sharpeRatio: summary.sharpeRatio,
    sortinoRatio: summary.sortinoRatio,
    winRate: summary.winRate,
    totalTrades: summary.totalTrades,
    profitFactor: summary.profitFactor,
    avgWin: summary.avgWin,
    avgLoss: summary.avgLoss,
    maxConsecutiveWins: summary.maxConsecutiveWins,
    maxConsecutiveLosses: summary.maxConsecutiveLosses,
    avgHoldingPeriod: summary.avgHoldingPeriod,
    maxSingleWin: summary.maxSingleWin,
    maxSingleLoss: summary.maxSingleLoss,
    equityCurve: fullResult.equityCurve,
    trades: fullResult.trades,
    config,
    strategy,
    executionTime: summary.executionTime,
    enhanced: enhancedResult,
  };
}

/**
 * Generate mock K-line data for backtesting
 * 生成用于回测的模拟K线数据
 */
export function generateBacktestData(
  days: number = 365,
  startPrice: number = 100,
  volatility: number = 0.02,
): BacktestKline[] {
  const klines: BacktestKline[] = [];
  let price = startPrice;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = days; i >= 0; i--) {
    const timestamp = Math.floor((now - i * dayMs) / 1000);

    // Random walk with drift
    const drift = 0.0003; // Small positive drift
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const change = drift + randomChange;

    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    klines.push({
      time: timestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return klines;
}
