/**
 * Backtest Statistics Utilities
 * 回测统计计算工具
 *
 * Provides statistical calculation functions for strategy validation.
 * 为策略验证提供统计计算函数
 */

import type { SignalDetail } from "./signal-scanner";
import type { KLineData } from "../data-service/types";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

/**
 * Return distribution bucket
 * 收益分布桶
 */
export interface ReturnDistributionBucket {
  range: string; // Label like "-5~-3%"
  rangeStart: number; // Start of range
  rangeEnd: number; // End of range
  count: number; // Number of signals in this range
  percentage: number; // Percentage of total
}

/**
 * Signal timeline entry
 * 信号时间线条目
 */
export interface SignalTimelineEntry {
  date: string; // Date (YYYY-MM-DD)
  signalCount: number; // Number of signals on this date
  avgReturn: number; // Average return for signals on this date
  buyCount: number; // Number of buy signals
  sellCount: number; // Number of sell signals
}

/**
 * Period return calculation result
 * 区间收益率计算结果
 */
export interface PeriodReturn {
  startPrice: number;
  endPrice: number;
  returnPct: number;
  startDate: string;
  endDate: string;
}

// =============================================================================
// PRECISION UTILITIES / 精度处理工具
// =============================================================================

/**
 * Default decimal places for different value types
 * 不同值类型的默认小数位数
 */
export const PRECISION = {
  PRICE: 2, // Price precision (2 decimal places) / 价格精度
  RETURN_PCT: 2, // Return percentage (2 decimal places) / 收益率百分比
  RATIO: 4, // Ratios like Sharpe (4 decimal places) / 比率（如夏普比率）
  PERCENTAGE: 2, // Percentages (2 decimal places) / 百分比
  COUNT: 0, // Counts (integer) / 计数
} as const;

/**
 * Round a number to specified decimal places
 * 将数字四舍五入到指定小数位
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Round price to standard precision
 * 将价格四舍五入到标准精度
 */
export function roundPrice(value: number): number {
  return roundTo(value, PRECISION.PRICE);
}

/**
 * Round return percentage to standard precision
 * 将收益率百分比四舍五入到标准精度
 */
export function roundReturnPct(value: number): number {
  return roundTo(value, PRECISION.RETURN_PCT);
}

/**
 * Round ratio to standard precision
 * 将比率四舍五入到标准精度
 */
export function roundRatio(value: number): number {
  return roundTo(value, PRECISION.RATIO);
}

/**
 * Round percentage to standard precision
 * 将百分比四舍五入到标准精度
 */
export function roundPercentage(value: number): number {
  return roundTo(value, PRECISION.PERCENTAGE);
}

/**
 * Format price for display
 * 格式化价格用于显示
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return roundPrice(value).toFixed(PRECISION.PRICE);
}

/**
 * Format return percentage for display
 * 格式化收益率百分比用于显示
 */
export function formatReturnPct(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  const rounded = roundReturnPct(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(PRECISION.RETURN_PCT)}%`;
}

/**
 * Format ratio for display
 * 格式化比率用于显示
 */
export function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  if (value === Infinity) return "∞";
  if (value === -Infinity) return "-∞";
  return roundRatio(value).toFixed(PRECISION.RATIO);
}

// =============================================================================
// BASIC STATISTICS / 基础统计函数
// =============================================================================

/**
 * Calculate arithmetic mean
 * 计算算术平均值
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Calculate median
 * 计算中位数
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1];
    const right = sorted[mid];
    if (left === undefined || right === undefined) return 0;
    return (left + right) / 2;
  }

  return sorted[mid] ?? 0;
}

/**
 * Calculate variance
 * 计算方差
 */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return average(squaredDiffs);
}

/**
 * Calculate standard deviation
 * 计算标准差
 */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Calculate percentile
 * 计算百分位数
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return values[0] ?? 0;
  if (p >= 100) return values[values.length - 1] ?? 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower] ?? 0;
  }

  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? 0;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

/**
 * Calculate sum
 * 计算总和
 */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// =============================================================================
// RETURN DISTRIBUTION / 收益分布
// =============================================================================

/**
 * Default distribution ranges (percentage)
 * 默认分布范围 (百分比)
 */
const DEFAULT_RETURN_RANGES = [
  { start: -Infinity, end: -10, label: "<-10%" },
  { start: -10, end: -7, label: "-10~-7%" },
  { start: -7, end: -5, label: "-7~-5%" },
  { start: -5, end: -3, label: "-5~-3%" },
  { start: -3, end: -1, label: "-3~-1%" },
  { start: -1, end: 0, label: "-1~0%" },
  { start: 0, end: 1, label: "0~1%" },
  { start: 1, end: 3, label: "1~3%" },
  { start: 3, end: 5, label: "3~5%" },
  { start: 5, end: 7, label: "5~7%" },
  { start: 7, end: 10, label: "7~10%" },
  { start: 10, end: Infinity, label: ">10%" },
];

/**
 * Calculate return distribution
 * 计算收益分布
 *
 * @param returns - Array of return percentages
 * @param customRanges - Optional custom ranges
 * @returns Array of distribution buckets
 */
export function calculateReturnDistribution(
  returns: number[],
  customRanges?: Array<{ start: number; end: number; label: string }>,
): ReturnDistributionBucket[] {
  const ranges = customRanges ?? DEFAULT_RETURN_RANGES;
  const total = returns.length;

  if (total === 0) {
    return ranges.map((r) => ({
      range: r.label,
      rangeStart: r.start,
      rangeEnd: r.end,
      count: 0,
      percentage: 0,
    }));
  }

  return ranges.map((r) => {
    const count = returns.filter((ret) => ret >= r.start && ret < r.end).length;
    return {
      range: r.label,
      rangeStart: r.start,
      rangeEnd: r.end,
      count,
      percentage: (count / total) * 100,
    };
  });
}

// =============================================================================
// SIGNAL TIMELINE / 信号时间线
// =============================================================================

/**
 * Calculate signal timeline
 * 计算信号时间线
 *
 * Groups signals by date and calculates daily statistics.
 *
 * @param signals - Array of signal details
 * @returns Array of timeline entries sorted by date
 */
export function calculateSignalTimeline(
  signals: SignalDetail[],
): SignalTimelineEntry[] {
  if (signals.length === 0) return [];

  // Group signals by entry date
  const dateMap = new Map<
    string,
    {
      returns: number[];
      buyCount: number;
      sellCount: number;
    }
  >();

  for (const signal of signals) {
    const date = signal.entryDate;
    const existing = dateMap.get(date);

    if (existing) {
      existing.returns.push(signal.returnPct);
      if (signal.type === "buy") {
        existing.buyCount++;
      } else {
        existing.sellCount++;
      }
    } else {
      dateMap.set(date, {
        returns: [signal.returnPct],
        buyCount: signal.type === "buy" ? 1 : 0,
        sellCount: signal.type === "sell" ? 1 : 0,
      });
    }
  }

  // Convert to array and sort by date
  const timeline: SignalTimelineEntry[] = [];
  dateMap.forEach((data, date) => {
    timeline.push({
      date,
      signalCount: data.returns.length,
      avgReturn: average(data.returns),
      buyCount: data.buyCount,
      sellCount: data.sellCount,
    });
  });

  return timeline.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// =============================================================================
// PERIOD RETURN / 区间收益率
// =============================================================================

/**
 * Calculate period return from K-line data
 * 从K线数据计算区间收益率
 *
 * @param klines - K-line data array
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Period return result or null if data insufficient
 */
export function calculatePeriodReturn(
  klines: KLineData[],
  startDate: string,
  endDate: string,
): PeriodReturn | null {
  if (klines.length === 0) return null;

  const startTimestamp = new Date(startDate).getTime() / 1000;
  const endTimestamp = new Date(endDate).getTime() / 1000;

  // Find closest K-lines to start and end dates
  let startKline: KLineData | null = null;
  let endKline: KLineData | null = null;

  for (const kline of klines) {
    if (kline.time >= startTimestamp && !startKline) {
      startKline = kline;
    }
    if (kline.time <= endTimestamp) {
      endKline = kline;
    }
  }

  if (!startKline || !endKline) {
    return null;
  }

  const returnPct =
    ((endKline.close - startKline.close) / startKline.close) * 100;

  return {
    startPrice: startKline.close,
    endPrice: endKline.close,
    returnPct,
    startDate:
      new Date(startKline.time * 1000).toISOString().split("T")[0] ?? startDate,
    endDate:
      new Date(endKline.time * 1000).toISOString().split("T")[0] ?? endDate,
  };
}

// =============================================================================
// ADVANCED STATISTICS / 高级统计
// =============================================================================

/**
 * Calculate win statistics
 * 计算胜率统计
 */
export function calculateWinStats(signals: SignalDetail[]): {
  winRate: number;
  winCount: number;
  lossCount: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
} {
  const wins = signals.filter((s) => s.returnPct > 0);
  const losses = signals.filter((s) => s.returnPct <= 0);

  const winReturns = wins.map((s) => s.returnPct);
  const lossReturns = losses.map((s) => Math.abs(s.returnPct));

  const totalWin = sum(winReturns);
  const totalLoss = sum(lossReturns);
  const avgWin = average(winReturns);
  const avgLoss = average(lossReturns);

  // Apply precision to all calculated values
  return {
    winRate: roundPercentage(
      signals.length > 0 ? (wins.length / signals.length) * 100 : 0,
    ),
    winCount: wins.length,
    lossCount: losses.length,
    avgWin: roundReturnPct(avgWin),
    avgLoss: roundReturnPct(avgLoss),
    profitFactor: roundRatio(
      totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    ),
    expectancy: roundReturnPct(
      signals.length > 0
        ? (wins.length / signals.length) * avgWin -
            (losses.length / signals.length) * avgLoss
        : 0,
    ),
  };
}

/**
 * Calculate maximum consecutive wins/losses
 * 计算最大连续盈亏次数
 */
export function calculateStreaks(signals: SignalDetail[]): {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentStreak: number;
  currentStreakType: "win" | "loss" | "none";
} {
  if (signals.length === 0) {
    return {
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      currentStreak: 0,
      currentStreakType: "none",
    };
  }

  let maxWins = 0;
  let maxLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const signal of signals) {
    if (signal.isWin) {
      currentWins++;
      currentLosses = 0;
      maxWins = Math.max(maxWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxLosses = Math.max(maxLosses, currentLosses);
    }
  }

  const lastSignal = signals[signals.length - 1];
  return {
    maxConsecutiveWins: maxWins,
    maxConsecutiveLosses: maxLosses,
    currentStreak: lastSignal?.isWin ? currentWins : currentLosses,
    currentStreakType: lastSignal?.isWin ? "win" : "loss",
  };
}

/**
 * Calculate risk-adjusted returns
 * 计算风险调整后收益
 *
 * Max drawdown uses O(n) single-pass peak tracking (no nested loops).
 * Sortino downside deviation accumulates in the same pass as avgReturn.
 */
export function calculateRiskAdjustedReturns(
  returns: number[],
  riskFreeRate: number = 0,
): {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
} {
  if (returns.length === 0) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
    };
  }

  // Single pass: compute sum, sum-of-squares, downside squares, cumulative max drawdown
  let totalReturn = 0;
  let sumSquaredDiff = 0;
  let downsideSquaredSum = 0;
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  // First pass for mean
  for (const r of returns) {
    totalReturn += r;
  }
  const avgReturn = totalReturn / returns.length;

  // Second pass for variance, downside, and drawdown
  for (const r of returns) {
    const diff = r - avgReturn;
    sumSquaredDiff += diff * diff;

    const downsideDiff = Math.min(r - riskFreeRate, 0);
    downsideSquaredSum += downsideDiff * downsideDiff;

    cumulative += r;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Sharpe Ratio
  const variance = sumSquaredDiff / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;

  // Sortino Ratio
  const downsideDeviation = Math.sqrt(downsideSquaredSum / returns.length);
  const sortinoRatio =
    downsideDeviation > 0
      ? (avgReturn - riskFreeRate) / downsideDeviation
      : avgReturn > riskFreeRate
        ? Infinity
        : 0;

  // Calmar Ratio
  const calmarRatio =
    maxDrawdown > 0 ? avgReturn / maxDrawdown : avgReturn > 0 ? Infinity : 0;

  // Apply precision to all calculated values
  return {
    sharpeRatio: roundRatio(sharpeRatio),
    sortinoRatio: roundRatio(sortinoRatio),
    calmarRatio: roundRatio(calmarRatio),
    maxDrawdown: roundReturnPct(maxDrawdown),
  };
}

// =============================================================================
// MONTHLY RETURNS / 月度收益
// =============================================================================

/**
 * Monthly return entry
 * 月度收益条目
 */
export interface MonthlyReturnEntry {
  year: number;
  month: number;
  label: string; // e.g., "2024-01"
  returnPct: number;
  isPositive: boolean;
}

/**
 * Calculate monthly returns from daily equity curve
 * 从每日净值曲线计算月度收益
 *
 * @param equityCurve - Array of {date, equity} objects
 * @returns Array of monthly return entries
 */
export function calculateMonthlyReturns(
  equityCurve: Array<{ date: string; equity: number }>,
): MonthlyReturnEntry[] {
  if (equityCurve.length < 2) return [];

  const monthlyData = new Map<
    string,
    { firstEquity: number; lastEquity: number; year: number; month: number }
  >();

  for (const point of equityCurve) {
    const date = new Date(point.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month.toString().padStart(2, "0")}`;

    const existing = monthlyData.get(key);
    if (!existing) {
      monthlyData.set(key, {
        firstEquity: point.equity,
        lastEquity: point.equity,
        year,
        month,
      });
    } else {
      existing.lastEquity = point.equity;
    }
  }

  const result: MonthlyReturnEntry[] = [];
  monthlyData.forEach((data, label) => {
    const returnPct =
      ((data.lastEquity - data.firstEquity) / data.firstEquity) * 100;
    result.push({
      year: data.year,
      month: data.month,
      label,
      returnPct: roundReturnPct(returnPct),
      isPositive: returnPct > 0,
    });
  });

  return result.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Calculate monthly return statistics
 * 计算月度收益统计
 */
export function calculateMonthlyStats(monthlyReturns: MonthlyReturnEntry[]): {
  avgMonthlyReturn: number;
  bestMonth: MonthlyReturnEntry | null;
  worstMonth: MonthlyReturnEntry | null;
  positiveMonths: number;
  negativeMonths: number;
  monthlyWinRate: number;
} {
  if (monthlyReturns.length === 0) {
    return {
      avgMonthlyReturn: 0,
      bestMonth: null,
      worstMonth: null,
      positiveMonths: 0,
      negativeMonths: 0,
      monthlyWinRate: 0,
    };
  }

  const returns = monthlyReturns.map((m) => m.returnPct);
  const positiveMonths = monthlyReturns.filter((m) => m.isPositive).length;
  const negativeMonths = monthlyReturns.filter((m) => !m.isPositive).length;

  const sortedByReturn = [...monthlyReturns].sort(
    (a, b) => b.returnPct - a.returnPct,
  );

  return {
    avgMonthlyReturn: roundReturnPct(average(returns)),
    bestMonth: sortedByReturn[0] || null,
    worstMonth: sortedByReturn[sortedByReturn.length - 1] || null,
    positiveMonths,
    negativeMonths,
    monthlyWinRate: roundPercentage(
      (positiveMonths / monthlyReturns.length) * 100,
    ),
  };
}

// =============================================================================
// DRAWDOWN ANALYSIS / 回撤分析
// =============================================================================

/**
 * Drawdown period info
 * 回撤区间信息
 */
export interface DrawdownPeriod {
  startDate: string;
  endDate: string;
  troughDate: string;
  recoveryDate: string | null;
  maxDrawdown: number;
  durationDays: number;
  recoveryDays: number | null;
  isRecovered: boolean;
}

/**
 * Calculate detailed drawdown analysis
 * 计算详细的回撤分析
 *
 * @param equityCurve - Array of {date, equity} objects
 * @returns Drawdown analysis results
 */
export function calculateDrawdownAnalysis(
  equityCurve: Array<{ date: string; equity: number }>,
): {
  maxDrawdown: number;
  maxDrawdownDuration: number;
  avgDrawdown: number;
  drawdownPeriods: DrawdownPeriod[];
  currentDrawdown: number;
  recoveryFactor: number;
} {
  if (equityCurve.length < 2) {
    return {
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      avgDrawdown: 0,
      drawdownPeriods: [],
      currentDrawdown: 0,
      recoveryFactor: 0,
    };
  }

  let peak = equityCurve[0]!.equity;
  let peakDate = equityCurve[0]!.date;
  let maxDrawdown = 0;
  let maxDrawdownDuration = 0;

  // Accumulate drawdown sum inline for O(1) avg (no intermediate array allocation)
  let drawdownSum = 0;
  const periods: DrawdownPeriod[] = [];
  let currentPeriod: Partial<DrawdownPeriod> | null = null;

  // Pre-parse start date once to avoid repeated new Date() in the hot path
  let currentPeriodStartMs = 0;
  let currentPeriodTroughMs = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    const point = equityCurve[i]!;
    const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;

    drawdownSum += drawdown;

    if (point.equity > peak) {
      // New peak reached, close any open drawdown period
      if (currentPeriod && currentPeriod.startDate) {
        const pointMs = new Date(point.date).getTime();
        currentPeriod.recoveryDate = point.date;
        currentPeriod.isRecovered = true;
        currentPeriod.recoveryDays = Math.round(
          (pointMs - currentPeriodTroughMs) / (1000 * 60 * 60 * 24),
        );
        periods.push(currentPeriod as DrawdownPeriod);
        currentPeriod = null;
      }
      peak = point.equity;
      peakDate = point.date;
    } else if (drawdown > 0) {
      // In drawdown
      if (!currentPeriod) {
        currentPeriodStartMs = new Date(peakDate).getTime();
        currentPeriodTroughMs = new Date(point.date).getTime();
        currentPeriod = {
          startDate: peakDate,
          troughDate: point.date,
          maxDrawdown: drawdown,
          durationDays: 0,
          isRecovered: false,
        };
      }

      if (drawdown > currentPeriod.maxDrawdown!) {
        currentPeriod.maxDrawdown = drawdown;
        currentPeriod.troughDate = point.date;
        currentPeriodTroughMs = new Date(point.date).getTime();
      }

      currentPeriod.endDate = point.date;
      const pointMs = new Date(point.date).getTime();
      currentPeriod.durationDays = Math.round(
        (pointMs - currentPeriodStartMs) / (1000 * 60 * 60 * 24),
      );

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDuration = currentPeriod.durationDays;
      }
    }
  }

  // Handle unclosed period
  if (currentPeriod && currentPeriod.startDate) {
    currentPeriod.recoveryDate = null;
    currentPeriod.recoveryDays = null;
    periods.push(currentPeriod as DrawdownPeriod);
  }

  const lastPoint = equityCurve[equityCurve.length - 1]!;
  const currentDrawdown = peak > 0 ? ((peak - lastPoint.equity) / peak) * 100 : 0;

  // Recovery factor = total return / max drawdown
  const totalReturn =
    ((lastPoint.equity - equityCurve[0]!.equity) / equityCurve[0]!.equity) *
    100;
  const recoveryFactor =
    maxDrawdown > 0
      ? totalReturn / maxDrawdown
      : totalReturn > 0
        ? Infinity
        : 0;

  return {
    maxDrawdown: roundReturnPct(maxDrawdown),
    maxDrawdownDuration,
    avgDrawdown: roundReturnPct(equityCurve.length > 0 ? drawdownSum / equityCurve.length : 0),
    drawdownPeriods: periods.map((p) => ({
      ...p,
      maxDrawdown: roundReturnPct(p.maxDrawdown),
    })),
    currentDrawdown: roundReturnPct(currentDrawdown),
    recoveryFactor: roundRatio(recoveryFactor),
  };
}

// =============================================================================
// VALUE AT RISK (VaR) / 风险价值
// =============================================================================

/**
 * Calculate Value at Risk (VaR)
 * 计算风险价值
 *
 * @param returns - Array of returns (percentages)
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns VaR value (positive number representing potential loss)
 */
export function calculateVaR(
  returns: number[],
  confidenceLevel: number = 0.95,
): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  const varValue = sorted[index] ?? sorted[0] ?? 0;

  return roundReturnPct(Math.abs(Math.min(0, varValue)));
}

/**
 * Calculate Conditional VaR (CVaR / Expected Shortfall)
 * 计算条件风险价值
 *
 * @param returns - Array of returns (percentages)
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns CVaR value
 */
export function calculateCVaR(
  returns: number[],
  confidenceLevel: number = 0.95,
): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.floor((1 - confidenceLevel) * sorted.length);
  const tailReturns = sorted.slice(0, cutoffIndex + 1);

  if (tailReturns.length === 0) return 0;

  const avgTailLoss = average(tailReturns);
  return roundReturnPct(Math.abs(Math.min(0, avgTailLoss)));
}

// =============================================================================
// ANNUALIZED CALCULATIONS / 年化计算
// =============================================================================

/**
 * Annualize return based on trading days
 * 根据交易天数年化收益
 *
 * @param totalReturn - Total return (as decimal, e.g., 0.15 for 15%)
 * @param tradingDays - Number of trading days
 * @param annualTradingDays - Trading days per year (default: 252)
 * @returns Annualized return
 */
export function annualizeReturn(
  totalReturn: number,
  tradingDays: number,
  annualTradingDays: number = 252,
): number {
  if (tradingDays <= 0) return 0;

  const years = tradingDays / annualTradingDays;
  if (years <= 0) return 0;

  // Handle negative returns
  if (totalReturn <= -1) return -1; // Cap at -100%

  // Annualized return formula: (1 + total_return)^(1/years) - 1
  const annualized = Math.pow(1 + totalReturn, 1 / years) - 1;
  return roundReturnPct(annualized * 100);
}

/**
 * Annualize volatility
 * 年化波动率
 *
 * @param dailyReturns - Array of daily returns (percentages)
 * @param annualTradingDays - Trading days per year (default: 252)
 * @returns Annualized volatility
 */
export function annualizeVolatility(
  dailyReturns: number[],
  annualTradingDays: number = 252,
): number {
  if (dailyReturns.length === 0) return 0;

  const dailyStdDev = standardDeviation(dailyReturns);
  return roundReturnPct(dailyStdDev * Math.sqrt(annualTradingDays));
}

// =============================================================================
// ENHANCED METRICS BUILDER / 增强指标构建器
// =============================================================================

import type { ReturnMetrics, RiskMetrics, TradingMetrics } from "./types";

/**
 * Build enhanced return metrics from equity curve and trades
 * 从净值曲线和交易记录构建增强的收益指标
 */
export function buildReturnMetrics(
  equityCurve: Array<{ date: string; equity: number }>,
  benchmarkReturn?: number,
): ReturnMetrics {
  if (equityCurve.length < 2) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      monthlyReturns: [],
      alpha: undefined,
      returnVolatility: 0,
      bestMonth: undefined,
      worstMonth: undefined,
    };
  }

  const initialEquity = equityCurve[0]!.equity;
  const finalEquity = equityCurve[equityCurve.length - 1]!.equity;
  const totalReturn = (finalEquity - initialEquity) / initialEquity;

  // Calculate trading days
  const startDate = new Date(equityCurve[0]!.date);
  const endDate = new Date(equityCurve[equityCurve.length - 1]!.date);
  const calendarDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const tradingDays = Math.round(calendarDays * (252 / 365));

  // Monthly returns
  const monthlyReturns = calculateMonthlyReturns(equityCurve);
  const monthlyStats = calculateMonthlyStats(monthlyReturns);

  // Daily returns for volatility
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1]!.equity;
    const currEquity = equityCurve[i]!.equity;
    dailyReturns.push(((currEquity - prevEquity) / prevEquity) * 100);
  }

  return {
    totalReturn: roundReturnPct(totalReturn * 100),
    annualizedReturn: annualizeReturn(totalReturn, tradingDays),
    monthlyReturns: monthlyReturns.map((m) => m.returnPct),
    alpha:
      benchmarkReturn !== undefined
        ? roundReturnPct(totalReturn * 100 - benchmarkReturn)
        : undefined,
    returnVolatility: annualizeVolatility(dailyReturns) / 100,
    bestMonth: monthlyStats.bestMonth?.returnPct,
    worstMonth: monthlyStats.worstMonth?.returnPct,
  };
}

/**
 * Build enhanced risk metrics from equity curve
 * 从净值曲线构建增强的风险指标
 */
export function buildRiskMetrics(
  equityCurve: Array<{ date: string; equity: number }>,
  riskFreeRate: number = 0.02,
): RiskMetrics {
  if (equityCurve.length < 2) {
    return {
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
    };
  }

  // Drawdown analysis
  const drawdownAnalysis = calculateDrawdownAnalysis(equityCurve);

  // Daily returns for Sharpe/Sortino
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1]!.equity;
    const currEquity = equityCurve[i]!.equity;
    dailyReturns.push(((currEquity - prevEquity) / prevEquity) * 100);
  }

  // Annualized metrics — use compound annualization from equity endpoints
  // 复利年化：从净值端点计算
  const firstPoint = equityCurve[0]!;
  const lastPoint = equityCurve[equityCurve.length - 1]!;
  const calendarDays =
    (new Date(lastPoint.date).getTime() - new Date(firstPoint.date).getTime()) /
    86400000;
  const compoundAnnualizedReturn =
    calendarDays > 0
      ? (Math.pow(lastPoint.equity / firstPoint.equity, 365 / calendarDays) - 1) * 100
      : 0;
  const annualizedVol = annualizeVolatility(dailyReturns);
  const annualizedRiskFree = riskFreeRate * 100;

  // Sharpe Ratio: (compound annualized return - risk-free) / annualized vol
  // 夏普比率：（复利年化收益 - 无风险利率）/ 年化波动率
  const sharpeRatio =
    annualizedVol > 0
      ? (compoundAnnualizedReturn - annualizedRiskFree) / annualizedVol
      : 0;

  // Sortino Ratio: uses ALL returns with min(r, 0) for downside deviation
  // 索提诺比率：用全序列 min(r, 0) 计算下行标准差
  const dailyRiskFree = riskFreeRate / 252 * 100;
  const downsideSquaredSum = dailyReturns.reduce(
    (s, r) => s + Math.pow(Math.min(r - dailyRiskFree, 0), 2),
    0,
  );
  const downsideVol =
    dailyReturns.length > 0
      ? Math.sqrt((downsideSquaredSum / dailyReturns.length) * 252)
      : 0;
  const sortinoRatio =
    downsideVol > 0
      ? (compoundAnnualizedReturn - annualizedRiskFree) / downsideVol
      : compoundAnnualizedReturn > annualizedRiskFree
        ? Infinity
        : 0;

  // Calmar Ratio
  const calmarRatio =
    drawdownAnalysis.maxDrawdown > 0
      ? compoundAnnualizedReturn / drawdownAnalysis.maxDrawdown
      : compoundAnnualizedReturn > 0
        ? Infinity
        : 0;

  // VaR and CVaR
  const var95 = calculateVaR(dailyReturns, 0.95);
  const var99 = calculateVaR(dailyReturns, 0.99);
  const cvar = calculateCVaR(dailyReturns, 0.95);

  return {
    maxDrawdown: drawdownAnalysis.maxDrawdown,
    maxDrawdownDuration: drawdownAnalysis.maxDrawdownDuration,
    drawdownRecoveryDays:
      drawdownAnalysis.drawdownPeriods.find(
        (p) => p.maxDrawdown === drawdownAnalysis.maxDrawdown,
      )?.recoveryDays ?? undefined,
    sharpeRatio: roundRatio(sharpeRatio),
    sortinoRatio: roundRatio(Math.min(sortinoRatio, 10)), // Cap at 10
    calmarRatio: roundRatio(Math.min(calmarRatio, 10)), // Cap at 10
    var95,
    var99,
    cvar,
  };
}

/**
 * Build enhanced trading metrics from trades
 * 从交易记录构建增强的交易指标
 */
export function buildTradingMetrics(
  trades: Array<{
    type: "buy" | "sell";
    pnl?: number;
    pnlPercent?: number;
    holdingDays?: number;
    timestamp?: number;
    date?: string;
  }>,
  tradingDays: number,
): TradingMetrics {
  // Filter to sell trades (completed round-trips)
  const completedTrades = trades.filter(
    (t) => t.type === "sell" && t.pnlPercent !== undefined,
  );

  if (completedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgHoldingDays: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      maxSingleWin: 0,
      maxSingleLoss: 0,
      tradingFrequency: 0,
    };
  }

  const wins = completedTrades.filter((t) => (t.pnlPercent ?? 0) > 0);
  const losses = completedTrades.filter((t) => (t.pnlPercent ?? 0) <= 0);

  const winReturns = wins.map((t) => t.pnlPercent ?? 0);
  const lossReturns = losses.map((t) => Math.abs(t.pnlPercent ?? 0));

  const totalWin = sum(winReturns);
  const totalLoss = sum(lossReturns);

  // Consecutive wins/losses
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of completedTrades) {
    if ((trade.pnlPercent ?? 0) > 0) {
      currentWins++;
      currentLosses = 0;
      maxConsecWins = Math.max(maxConsecWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxConsecLosses = Math.max(maxConsecLosses, currentLosses);
    }
  }

  // Holding days
  const holdingDays = completedTrades
    .filter((t) => t.holdingDays !== undefined)
    .map((t) => t.holdingDays!);

  // Trading frequency (trades per month)
  const months = tradingDays / 21; // ~21 trading days per month
  const tradingFrequency =
    months > 0 ? completedTrades.length / months : completedTrades.length;

  return {
    totalTrades: completedTrades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: roundPercentage((wins.length / completedTrades.length) * 100),
    profitFactor: roundRatio(
      totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    ),
    avgWin: roundReturnPct(winReturns.length > 0 ? average(winReturns) : 0),
    avgLoss: roundReturnPct(lossReturns.length > 0 ? -average(lossReturns) : 0),
    avgHoldingDays: roundTo(
      holdingDays.length > 0 ? average(holdingDays) : 0,
      1,
    ),
    maxConsecutiveWins: maxConsecWins,
    maxConsecutiveLosses: maxConsecLosses,
    maxSingleWin: roundReturnPct(
      winReturns.length > 0 ? Math.max(...winReturns) : 0,
    ),
    maxSingleLoss: roundReturnPct(
      lossReturns.length > 0 ? -Math.max(...lossReturns) : 0,
    ),
    tradingFrequency: roundTo(tradingFrequency, 1),
  };
}

// =============================================================================
// BENCHMARK COMPARISON / 基准对比
// =============================================================================

/**
 * Compare strategy returns with benchmark
 * 策略收益与基准对比
 */
export function compareToBenchmark(
  strategyReturns: number[],
  benchmarkReturn: number,
): {
  excessReturn: number;
  informationRatio: number;
  trackingError: number;
  beta: number;
  alpha: number;
} {
  const avgStrategyReturn = average(strategyReturns);
  const excessReturn = avgStrategyReturn - benchmarkReturn;

  // For simplified calculation, assume daily returns
  const trackingError = standardDeviation(strategyReturns);

  // Information Ratio
  const informationRatio = trackingError > 0 ? excessReturn / trackingError : 0;

  // Simplified beta and alpha (without correlation data)
  // In practice, these would require more data
  const beta = 1; // Assume market beta of 1
  const alpha = avgStrategyReturn - beta * benchmarkReturn;

  // Apply precision to all calculated values
  return {
    excessReturn: roundReturnPct(excessReturn),
    informationRatio: roundRatio(informationRatio),
    trackingError: roundReturnPct(trackingError),
    beta: roundRatio(beta),
    alpha: roundReturnPct(alpha),
  };
}
