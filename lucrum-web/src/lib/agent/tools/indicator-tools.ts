/**
 * Technical Indicator Tools for LangChain
 * LangChain 技术指标工具
 *
 * Provides tools for calculating technical indicators from K-line data.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { KLineData, CalculatedIndicators } from "../graphs/types";

// ============================================================================
// Moving Average Calculations
// ============================================================================

/**
 * Calculate Simple Moving Average (SMA)
 * 计算简单移动平均线
 */
function calculateSMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
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
function calculateEMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(closes[0] ?? 0);
    } else {
      const prevEMA = result[i - 1] ?? 0;
      const currentClose = closes[i] ?? 0;
      result.push((currentClose - prevEMA) * multiplier + prevEMA);
    }
  }
  return result;
}

// ============================================================================
// MACD Calculation
// ============================================================================

/**
 * Calculate MACD (12, 26, 9)
 * 计算MACD指标
 */
function calculateMACD(closes: number[]): {
  macd: number[];
  signal: number[];
  histogram: number[];
} {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  // MACD line = EMA12 - EMA26
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const e12 = ema12[i] ?? 0;
    const e26 = ema26[i] ?? 0;
    macdLine.push(e12 - e26);
  }

  // Signal line = 9-period EMA of MACD line
  const signalLine = calculateEMA(macdLine, 9);

  // Histogram = MACD - Signal
  const histogram: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const m = macdLine[i] ?? 0;
    const s = signalLine[i] ?? 0;
    histogram.push(m - s);
  }

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
  };
}

// ============================================================================
// RSI Calculation
// ============================================================================

/**
 * Calculate RSI (Relative Strength Index)
 * 计算RSI相对强弱指标
 */
function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    const change = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First RSI value
  result.push(NaN);
  for (let i = 0; i < period - 1; i++) {
    result.push(NaN);
  }

  // Calculate initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i] ?? 0;
    avgLoss += losses[i] ?? 0;
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + firstRS));

  // Subsequent RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + (gains[i] ?? 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (losses[i] ?? 0)) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

// ============================================================================
// Bollinger Bands Calculation
// ============================================================================

/**
 * Calculate Bollinger Bands
 * 计算布林带
 */
function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i] ?? 0;

      // Calculate standard deviation
      const squaredDiffs = slice.map((x) => Math.pow((x ?? 0) - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const stdDev = Math.sqrt(variance);

      upper.push(mean + multiplier * stdDev);
      lower.push(mean - multiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

// ============================================================================
// LangChain Tools
// ============================================================================

/**
 * Calculate all technical indicators for K-line data
 * 计算所有技术指标
 */
export const calculateIndicatorsTool = tool(
  async ({ klines }) => {
    if (!klines || klines.length === 0) {
      return {
        success: false,
        error: "No K-line data provided",
      };
    }

    const closes = klines.map((k: KLineData) => k.close);

    // Calculate all indicators
    const ma5 = calculateSMA(closes, 5);
    const ma10 = calculateSMA(closes, 10);
    const ma20 = calculateSMA(closes, 20);
    const ma60 = calculateSMA(closes, 60);

    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);

    const { macd, signal, histogram } = calculateMACD(closes);
    const rsi14 = calculateRSI(closes, 14);

    const bollinger = calculateBollingerBands(closes, 20, 2);

    const indicators: CalculatedIndicators = {
      ma5,
      ma10,
      ma20,
      ma60,
      ema12,
      ema26,
      macd,
      signal,
      histogram,
      rsi14,
      upperBoll: bollinger.upper,
      middleBoll: bollinger.middle,
      lowerBoll: bollinger.lower,
    };

    return {
      success: true,
      indicators,
      summary: {
        lastClose: closes[closes.length - 1],
        lastMA5: ma5[ma5.length - 1],
        lastMA20: ma20[ma20.length - 1],
        lastRSI: rsi14[rsi14.length - 1],
        lastMACD: macd[macd.length - 1],
        trend: determineTrend(closes, ma5, ma20),
      },
    };
  },
  {
    name: "calculate_indicators",
    description: "Calculate technical indicators (MA, EMA, MACD, RSI, Bollinger Bands) from K-line data.",
    schema: z.object({
      klines: z.array(
        z.object({
          time: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          volume: z.number(),
        })
      ).describe("K-line data array"),
    }),
  }
);

/**
 * Analyze trend based on moving averages
 * 基于均线分析趋势
 */
export const analyzeTrendTool = tool(
  async ({ klines, shortPeriod, longPeriod }) => {
    if (!klines || klines.length < longPeriod) {
      return {
        success: false,
        error: `Insufficient data. Need at least ${longPeriod} bars.`,
      };
    }

    const closes = klines.map((k: KLineData) => k.close);
    const shortMA = calculateSMA(closes, shortPeriod);
    const longMA = calculateSMA(closes, longPeriod);

    const lastShortMA = shortMA[shortMA.length - 1] ?? 0;
    const lastLongMA = longMA[longMA.length - 1] ?? 0;
    const lastClose = closes[closes.length - 1] ?? 0;

    // Trend analysis
    const trend = determineTrend(closes, shortMA, longMA);

    // Golden cross / Death cross detection
    const prevShortMA = shortMA[shortMA.length - 2] ?? 0;
    const prevLongMA = longMA[longMA.length - 2] ?? 0;

    let crossSignal = "none";
    if (prevShortMA <= prevLongMA && lastShortMA > lastLongMA) {
      crossSignal = "golden_cross"; // 金叉
    } else if (prevShortMA >= prevLongMA && lastShortMA < lastLongMA) {
      crossSignal = "death_cross"; // 死叉
    }

    // Price position relative to MAs
    const aboveShortMA = lastClose > lastShortMA;
    const aboveLongMA = lastClose > lastLongMA;

    return {
      success: true,
      analysis: {
        trend,
        crossSignal,
        pricePosition: {
          aboveShortMA,
          aboveLongMA,
        },
        values: {
          lastClose,
          shortMA: lastShortMA,
          longMA: lastLongMA,
        },
        strength: calculateTrendStrength(lastClose, lastShortMA, lastLongMA),
      },
    };
  },
  {
    name: "analyze_trend",
    description: "Analyze price trend using moving average crossovers and price position.",
    schema: z.object({
      klines: z.array(
        z.object({
          time: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          volume: z.number(),
        })
      ).describe("K-line data array"),
      shortPeriod: z.number().min(1).max(50).default(5).describe("Short MA period"),
      longPeriod: z.number().min(10).max(200).default(20).describe("Long MA period"),
    }),
  }
);

/**
 * Generate trading signal based on multiple indicators
 * 基于多个指标生成交易信号
 */
export const generateSignalTool = tool(
  async ({ klines }) => {
    if (!klines || klines.length < 30) {
      return {
        success: false,
        error: "Insufficient data. Need at least 30 bars.",
      };
    }

    const closes = klines.map((k: KLineData) => k.close);

    // Calculate indicators
    const ma5 = calculateSMA(closes, 5);
    const ma20 = calculateSMA(closes, 20);
    const { macd, signal: signalLine } = calculateMACD(closes);
    const rsi14 = calculateRSI(closes, 14);

    const lastClose = closes[closes.length - 1] ?? 0;
    const lastMA5 = ma5[ma5.length - 1] ?? 0;
    const lastMA20 = ma20[ma20.length - 1] ?? 0;
    const lastMACD = macd[macd.length - 1] ?? 0;
    const lastSignal = signalLine[signalLine.length - 1] ?? 0;
    const lastRSI = rsi14[rsi14.length - 1] ?? 50;

    // Signal scoring
    let bullishScore = 0;
    let bearishScore = 0;

    // MA signals
    if (lastClose > lastMA5) bullishScore += 1;
    else bearishScore += 1;

    if (lastClose > lastMA20) bullishScore += 1;
    else bearishScore += 1;

    if (lastMA5 > lastMA20) bullishScore += 1;
    else bearishScore += 1;

    // MACD signal
    if (lastMACD > lastSignal) bullishScore += 2;
    else bearishScore += 2;

    // RSI signal
    if (lastRSI < 30) bullishScore += 2; // Oversold
    else if (lastRSI > 70) bearishScore += 2; // Overbought
    else if (lastRSI < 50) bearishScore += 1;
    else bullishScore += 1;

    // Determine overall signal
    const totalScore = bullishScore - bearishScore;
    let signalType: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
    let confidence: number;

    if (totalScore >= 4) {
      signalType = "strong_buy";
      confidence = 0.8 + (totalScore - 4) * 0.05;
    } else if (totalScore >= 2) {
      signalType = "buy";
      confidence = 0.6 + (totalScore - 2) * 0.1;
    } else if (totalScore <= -4) {
      signalType = "strong_sell";
      confidence = 0.8 + (-totalScore - 4) * 0.05;
    } else if (totalScore <= -2) {
      signalType = "sell";
      confidence = 0.6 + (-totalScore - 2) * 0.1;
    } else {
      signalType = "neutral";
      confidence = 0.5;
    }

    return {
      success: true,
      signal: {
        type: signalType,
        confidence: Math.min(confidence, 0.95),
        scores: {
          bullish: bullishScore,
          bearish: bearishScore,
          net: totalScore,
        },
        indicators: {
          price: lastClose,
          ma5: lastMA5,
          ma20: lastMA20,
          macd: lastMACD,
          signal: lastSignal,
          rsi: lastRSI,
        },
        reasons: generateReasons(lastClose, lastMA5, lastMA20, lastMACD, lastSignal, lastRSI),
      },
    };
  },
  {
    name: "generate_signal",
    description: "Generate a trading signal (buy/sell/neutral) based on multiple technical indicators.",
    schema: z.object({
      klines: z.array(
        z.object({
          time: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          volume: z.number(),
        })
      ).describe("K-line data array"),
    }),
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

function determineTrend(
  closes: number[],
  shortMA: number[],
  longMA: number[]
): "uptrend" | "downtrend" | "sideways" {
  const lastClose = closes[closes.length - 1] ?? 0;
  const lastShortMA = shortMA[shortMA.length - 1] ?? 0;
  const lastLongMA = longMA[longMA.length - 1] ?? 0;

  if (lastClose > lastShortMA && lastShortMA > lastLongMA) {
    return "uptrend";
  } else if (lastClose < lastShortMA && lastShortMA < lastLongMA) {
    return "downtrend";
  }
  return "sideways";
}

function calculateTrendStrength(
  price: number,
  shortMA: number,
  longMA: number
): number {
  const deviation = Math.abs(price - longMA) / longMA;
  return Math.min(deviation * 10, 1); // Normalize to 0-1
}

function generateReasons(
  price: number,
  ma5: number,
  ma20: number,
  macd: number,
  signal: number,
  rsi: number
): string[] {
  const reasons: string[] = [];

  if (price > ma5 && price > ma20) {
    reasons.push("价格站上短期和中期均线");
  } else if (price < ma5 && price < ma20) {
    reasons.push("价格跌破短期和中期均线");
  }

  if (ma5 > ma20) {
    reasons.push("短期均线在长期均线上方，趋势向上");
  } else {
    reasons.push("短期均线在长期均线下方，趋势向下");
  }

  if (macd > signal) {
    reasons.push("MACD在信号线上方，动能看多");
  } else {
    reasons.push("MACD在信号线下方，动能看空");
  }

  if (rsi < 30) {
    reasons.push("RSI进入超卖区域，可能反弹");
  } else if (rsi > 70) {
    reasons.push("RSI进入超买区域，注意回调风险");
  }

  return reasons;
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All indicator tools
 * 所有指标工具
 */
export const indicatorTools = [
  calculateIndicatorsTool,
  analyzeTrendTool,
  generateSignalTool,
];

export default indicatorTools;
