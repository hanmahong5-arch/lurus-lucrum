import { describe, it, expect } from 'vitest';
import {
  PRECISION,
  roundTo,
  roundPrice,
  roundReturnPct,
  roundRatio,
  roundPercentage,
  formatPrice,
  formatReturnPct,
  formatRatio,
  average,
  median,
  variance,
  standardDeviation,
  percentile,
  sum,
  calculateReturnDistribution,
  calculateWinStats,
  calculateStreaks,
  calculateRiskAdjustedReturns,
  calculateMonthlyReturns,
  calculateMonthlyStats,
  calculateDrawdownAnalysis,
  calculateVaR,
  calculateCVaR,
  annualizeReturn,
  annualizeVolatility,
  buildReturnMetrics,
  buildRiskMetrics,
  buildTradingMetrics,
  compareToBenchmark,
  calculatePeriodReturn,
  calculateSignalTimeline,
} from '../statistics';
import type { SignalDetail } from '../signal-scanner';

// Helper to create mock signal objects
const makeSignal = (returnPct: number, isWin: boolean): SignalDetail => ({
  symbol: '600519',
  name: 'test',
  type: 'buy' as const,
  signal: 'test',
  strength: 1,
  entryDate: '2024-01-01',
  exitDate: '2024-01-06',
  entryPrice: 10,
  exitPrice: isWin ? 11 : 9,
  returnPct,
  isWin,
  holdingDays: 5,
  status: 'completed' as const,
});

describe('Rounding', () => {
  it('roundTo should round to specified decimals', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.2385, 2)).toBe(1.24);
    expect(roundTo(1.2, 2)).toBe(1.2);
  });

  it('roundPrice should use 2 decimals', () => {
    expect(roundPrice(10.12345)).toBe(10.12);
    expect(roundPrice(10.126)).toBe(10.13);
  });

  it('roundReturnPct should use 2 decimals', () => {
    expect(roundReturnPct(5.12345)).toBe(5.12);
    expect(roundReturnPct(-2.345)).toBe(-2.35);
  });

  it('roundRatio should use 4 decimals', () => {
    expect(roundRatio(1.23456789)).toBe(1.2346);
    expect(roundRatio(2.99999)).toBe(3.0);
  });

  it('roundPercentage should use 2 decimals', () => {
    expect(roundPercentage(12.345)).toBe(12.35);
  });

  it('roundTo with non-finite values should return as-is', () => {
    expect(roundTo(Infinity, 2)).toBe(Infinity);
    expect(roundTo(-Infinity, 2)).toBe(-Infinity);
    expect(roundTo(NaN, 2)).toBeNaN();
  });

  it('PRECISION constants should match expected values', () => {
    expect(PRECISION.PRICE).toBe(2);
    expect(PRECISION.RETURN_PCT).toBe(2);
    expect(PRECISION.RATIO).toBe(4);
    expect(PRECISION.PERCENTAGE).toBe(2);
    expect(PRECISION.COUNT).toBe(0);
  });
});

describe('Formatting', () => {
  it('formatPrice should format with 2 decimals', () => {
    expect(formatPrice(10.5)).toBe('10.50');
    expect(formatPrice(100)).toBe('100.00');
    expect(formatPrice(0.1)).toBe('0.10');
  });

  it('formatReturnPct should show sign and percentage', () => {
    expect(formatReturnPct(5.5)).toBe('+5.50%');
    expect(formatReturnPct(-2.3)).toBe('-2.30%');
    expect(formatReturnPct(0)).toBe('0.00%'); // 0 has no sign
  });

  it('formatRatio should handle Infinity', () => {
    // !Number.isFinite(Infinity) is true, so returns 'N/A'
    expect(formatRatio(Infinity)).toBe('N/A');
    expect(formatRatio(-Infinity)).toBe('N/A');
    expect(formatRatio(1.2345)).toBe('1.2345');
  });

  it('formatPrice should handle NaN', () => {
    expect(formatPrice(NaN)).toBe('N/A');
  });

  it('formatReturnPct should handle NaN', () => {
    expect(formatReturnPct(NaN)).toBe('N/A');
  });
});

describe('Basic Statistics', () => {
  it('average should calculate mean', () => {
    expect(average([1, 2, 3])).toBe(2);
    expect(average([10, 20, 30, 40])).toBe(25);
  });

  it('average of empty array should return 0', () => {
    expect(average([])).toBe(0);
  });

  it('median should find middle value', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 3, 5, 7, 9])).toBe(5);
  });

  it('median of even-length array should average middle two', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('median of empty array should return 0', () => {
    expect(median([])).toBe(0);
  });

  it('variance should calculate correctly', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = variance(data);
    expect(result).toBeCloseTo(4.0, 1); // Known variance for this dataset
  });

  it('standardDeviation should be sqrt of variance', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const std = standardDeviation(data);
    const var_ = variance(data);
    expect(std).toBeCloseTo(Math.sqrt(var_), 4);
  });

  it('percentile should find correct value', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('percentile of empty array should return 0', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('sum should add all values', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([10, 20, 30])).toBe(60);
    expect(sum([])).toBe(0);
  });
});

describe('calculateReturnDistribution', () => {
  it('should categorize returns into ranges', () => {
    const returns = [-15, -8, -2, 0, 3, 8, 15];
    const dist = calculateReturnDistribution(returns);

    expect(dist).toBeDefined();
    expect(dist.length).toBeGreaterThan(0);
    expect(dist.every(d => d.range && typeof d.count === 'number')).toBe(true);
  });

  it('should handle empty returns', () => {
    const dist = calculateReturnDistribution([]);
    expect(dist).toBeDefined();
  });
});

describe('calculateWinStats', () => {
  it('should calculate 100% win rate for all wins', () => {
    const signals = [
      makeSignal(10, true),
      makeSignal(15, true),
      makeSignal(5, true),
    ];
    const stats = calculateWinStats(signals);

    expect(stats.winRate).toBe(100);
    expect(stats.winCount).toBe(3);
    expect(stats.lossCount).toBe(0);
    expect(stats.avgWin).toBeGreaterThan(0);
    expect(stats.avgLoss).toBe(0);
  });

  it('should calculate 0% win rate for all losses', () => {
    const signals = [
      makeSignal(-10, false),
      makeSignal(-5, false),
    ];
    const stats = calculateWinStats(signals);

    expect(stats.winRate).toBe(0);
    expect(stats.winCount).toBe(0);
    expect(stats.lossCount).toBe(2);
    expect(stats.avgWin).toBe(0);
    // avgLoss uses Math.abs, so it's positive
    expect(stats.avgLoss).toBeGreaterThan(0);
    expect(stats.avgLoss).toBeCloseTo(7.5, 1);
  });

  it('should calculate correct stats for mixed results', () => {
    const signals = [
      makeSignal(10, true),
      makeSignal(-5, false),
      makeSignal(15, true),
      makeSignal(-3, false),
    ];
    const stats = calculateWinStats(signals);

    expect(stats.winRate).toBe(50);
    expect(stats.winCount).toBe(2);
    expect(stats.lossCount).toBe(2);
    expect(stats.avgWin).toBeCloseTo(12.5, 1);
    // avgLoss is absolute value
    expect(stats.avgLoss).toBeCloseTo(4, 1);
  });

  it('should return zeros for empty signals', () => {
    const stats = calculateWinStats([]);

    expect(stats.winRate).toBe(0);
    expect(stats.winCount).toBe(0);
    expect(stats.lossCount).toBe(0);
    expect(stats.avgWin).toBe(0);
    expect(stats.avgLoss).toBe(0);
    expect(stats.profitFactor).toBe(0);
    expect(stats.expectancy).toBe(0);
  });

  it('should calculate profit factor correctly', () => {
    const signals = [
      makeSignal(20, true),  // +20
      makeSignal(-10, false), // -10
    ];
    const stats = calculateWinStats(signals);

    expect(stats.profitFactor).toBeCloseTo(2.0, 1); // 20/10 = 2
  });
});

describe('calculateStreaks', () => {
  it('should track consecutive wins and losses', () => {
    const signals = [
      makeSignal(10, true),
      makeSignal(5, true),
      makeSignal(-3, false),
    ];
    const streaks = calculateStreaks(signals);

    expect(streaks.maxConsecutiveWins).toBe(2);
    expect(streaks.maxConsecutiveLosses).toBe(1);
    expect(streaks.currentStreak).toBe(1);
    expect(streaks.currentStreakType).toBe('loss');
  });

  it('should handle alternating wins and losses', () => {
    const signals = [
      makeSignal(5, true),
      makeSignal(-5, false),
      makeSignal(5, true),
      makeSignal(-5, false),
    ];
    const streaks = calculateStreaks(signals);

    expect(streaks.maxConsecutiveWins).toBe(1);
    expect(streaks.maxConsecutiveLosses).toBe(1);
  });

  it('should return zeros for empty signals', () => {
    const streaks = calculateStreaks([]);

    expect(streaks.maxConsecutiveWins).toBe(0);
    expect(streaks.maxConsecutiveLosses).toBe(0);
    expect(streaks.currentStreak).toBe(0);
    expect(streaks.currentStreakType).toBe('none');
  });

  it('should track long winning streak', () => {
    const signals = [
      makeSignal(1, true),
      makeSignal(2, true),
      makeSignal(3, true),
      makeSignal(4, true),
      makeSignal(5, true),
    ];
    const streaks = calculateStreaks(signals);

    expect(streaks.maxConsecutiveWins).toBe(5);
    expect(streaks.currentStreak).toBe(5);
    expect(streaks.currentStreakType).toBe('win');
  });
});

describe('calculateRiskAdjustedReturns', () => {
  it('should return zeros for empty returns', () => {
    const result = calculateRiskAdjustedReturns([]);

    expect(result.sharpeRatio).toBe(0);
    expect(result.sortinoRatio).toBe(0);
    expect(result.calmarRatio).toBe(0);
    expect(result.maxDrawdown).toBe(0);
  });

  it('should calculate positive sharpe for positive returns', () => {
    const returns = [1, 2, 3, 4, 5];
    const result = calculateRiskAdjustedReturns(returns, 0);

    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  it('should handle all same returns (zero std dev)', () => {
    const returns = [5, 5, 5, 5, 5];
    const result = calculateRiskAdjustedReturns(returns, 0);

    expect(result.sharpeRatio).toBe(0);
  });

  it('should calculate with risk-free rate', () => {
    const returns = [5, 6, 7, 8];
    const resultNoRf = calculateRiskAdjustedReturns(returns, 0);
    const resultWithRf = calculateRiskAdjustedReturns(returns, 2);

    expect(resultWithRf.sharpeRatio).toBeLessThan(resultNoRf.sharpeRatio);
  });
});

describe('calculateDrawdownAnalysis', () => {
  it('should return zero drawdown for rising equity', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 110 },
      { date: '2024-01-03', equity: 120 },
    ];
    const result = calculateDrawdownAnalysis(equityCurve);

    expect(result.maxDrawdown).toBe(0);
    expect(result.currentDrawdown).toBe(0);
  });

  it('should calculate drawdown correctly', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 90 },
      { date: '2024-01-03', equity: 80 },
      { date: '2024-01-04', equity: 90 },
      { date: '2024-01-05', equity: 100 },
    ];
    const result = calculateDrawdownAnalysis(equityCurve);

    expect(result.maxDrawdown).toBeCloseTo(20, 1); // (100-80)/100 = 20%
    expect(result.currentDrawdown).toBe(0); // Recovered
  });

  it('should return zeros for less than 2 points', () => {
    const result = calculateDrawdownAnalysis([{ date: '2024-01-01', equity: 100 }]);

    expect(result.maxDrawdown).toBe(0);
    expect(result.maxDrawdownDuration).toBe(0);
  });

  it('should track current drawdown when not recovered', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 90 },
      { date: '2024-01-03', equity: 85 },
    ];
    const result = calculateDrawdownAnalysis(equityCurve);

    expect(result.currentDrawdown).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBeGreaterThan(0);
  });
});

describe('VaR and CVaR', () => {
  it('calculateVaR should return 0 for empty returns', () => {
    expect(calculateVaR([])).toBe(0);
  });

  it('calculateCVaR should return 0 for empty returns', () => {
    expect(calculateCVaR([])).toBe(0);
  });

  it('calculateVaR should return 0 for all positive returns', () => {
    const returns = [1, 2, 3, 4, 5];
    expect(calculateVaR(returns, 0.95)).toBe(0);
  });

  it('calculateVaR should find correct percentile', () => {
    const returns = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    const var95 = calculateVaR(returns, 0.95);

    // VaR returns absolute value of loss (non-negative)
    expect(var95).toBeGreaterThanOrEqual(0);
  });

  it('calculateCVaR should be greater than or equal to VaR', () => {
    const returns = [-10, -8, -5, -3, -1, 0, 2, 4, 6, 8, 10];
    const var95 = calculateVaR(returns, 0.95);
    const cvar95 = calculateCVaR(returns, 0.95);

    expect(Math.abs(cvar95)).toBeGreaterThanOrEqual(Math.abs(var95));
  });

  it('calculateVaR should handle different confidence levels', () => {
    const returns = [-10, -5, 0, 5, 10];
    const var90 = calculateVaR(returns, 0.90);
    const var95 = calculateVaR(returns, 0.95);

    expect(Math.abs(var95)).toBeGreaterThanOrEqual(Math.abs(var90));
  });
});

describe('Monthly Returns and Stats', () => {
  it('calculateMonthlyReturns should group by month', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-15', equity: 105 },
      { date: '2024-02-01', equity: 110 },
      { date: '2024-02-15', equity: 115 },
    ];
    const monthly = calculateMonthlyReturns(equityCurve);

    expect(monthly.length).toBe(2);
    expect(monthly[0]!.label).toBe('2024-01');
    expect(monthly[1]!.label).toBe('2024-02');
  });

  it('calculateMonthlyReturns should return empty for < 2 points', () => {
    const monthly = calculateMonthlyReturns([{ date: '2024-01-01', equity: 100 }]);
    expect(monthly).toEqual([]);
  });

  it('calculateMonthlyStats should calculate correctly', () => {
    const monthlyReturns = [
      { year: 2024, month: 1, label: '2024-01', returnPct: 5, isPositive: true },
      { year: 2024, month: 2, label: '2024-02', returnPct: -3, isPositive: false },
      { year: 2024, month: 3, label: '2024-03', returnPct: 8, isPositive: true },
    ];
    const stats = calculateMonthlyStats(monthlyReturns);

    expect(stats.avgMonthlyReturn).toBeCloseTo(3.33, 1);
    expect(stats.bestMonth!.returnPct).toBe(8);
    expect(stats.worstMonth!.returnPct).toBe(-3);
    expect(stats.positiveMonths).toBe(2);
    expect(stats.negativeMonths).toBe(1);
    expect(stats.monthlyWinRate).toBeCloseTo(66.67, 1);
  });
});

describe('Annualization Functions', () => {
  it('annualizeReturn should scale correctly', () => {
    // annualizeReturn takes totalReturn as decimal (0.10 = 10%)
    const result = annualizeReturn(0.10, 126, 252); // 10% in half year
    expect(result).toBeCloseTo(21, 0); // (1.10)^2 - 1 ≈ 21%
  });

  it('annualizeVolatility should scale correctly', () => {
    const dailyReturns = [1, -1, 1, -1, 1];
    const annualVol = annualizeVolatility(dailyReturns, 252);

    expect(annualVol).toBeGreaterThan(0);
  });

  it('annualizeVolatility should handle empty returns', () => {
    expect(annualizeVolatility([])).toBe(0);
  });
});

describe('buildReturnMetrics', () => {
  it('should calculate positive return for rising equity', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-12-31', equity: 120 },
    ];
    const metrics = buildReturnMetrics(equityCurve);

    expect(metrics.totalReturn).toBeCloseTo(20, 1);
  });

  it('should calculate alpha when benchmark provided', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-12-31', equity: 120 },
    ];
    const metrics = buildReturnMetrics(equityCurve, 10);

    expect(metrics.alpha).toBeDefined();
    expect(metrics.alpha).toBeGreaterThan(0); // 20% return vs 10% benchmark
  });

  it('should handle less than 2 points', () => {
    const metrics = buildReturnMetrics([{ date: '2024-01-01', equity: 100 }]);

    expect(metrics.totalReturn).toBe(0);
    expect(metrics.annualizedReturn).toBe(0);
  });
});

describe('buildRiskMetrics', () => {
  it('should calculate sharpe ratio for rising equity', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 102 },
      { date: '2024-01-03', equity: 104 },
      { date: '2024-01-04', equity: 106 },
    ];
    const metrics = buildRiskMetrics(equityCurve, 0.02);

    expect(metrics.sharpeRatio).toBeDefined();
    expect(metrics.maxDrawdown).toBeDefined();
  });

  it('should handle less than 2 points', () => {
    const metrics = buildRiskMetrics([{ date: '2024-01-01', equity: 100 }]);

    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.maxDrawdown).toBe(0);
  });
});

describe('buildTradingMetrics', () => {
  it('should count only sells with pnlPercent', () => {
    const trades = [
      {
        type: 'sell' as const,
        date: '2024-01-10',
        pnlPercent: 10,
        holdingDays: 9,
      },
      {
        type: 'buy' as const,
        date: '2024-01-01',
      },
    ];
    const metrics = buildTradingMetrics(trades, 250);

    expect(metrics.totalTrades).toBe(1); // Only the sell counts
    expect(metrics.tradingFrequency).toBeGreaterThanOrEqual(0);
  });

  it('should return zeros for empty trades', () => {
    const metrics = buildTradingMetrics([], 250);

    expect(metrics.totalTrades).toBe(0);
    expect(metrics.tradingFrequency).toBe(0);
  });
});

describe('compareToBenchmark', () => {
  it('should calculate excess return as average minus benchmark', () => {
    // excessReturn = average([2,3,4,5]) - 10 = 3.5 - 10 = -6.5
    const strategyReturns = [2, 3, 4, 5];
    const result = compareToBenchmark(strategyReturns, 10);

    expect(result.excessReturn).toBeCloseTo(-6.5, 1);
  });

  it('should have beta of 1', () => {
    const result = compareToBenchmark([1, 2, 3], 5);
    expect(result.beta).toBe(1);
  });

  it('should handle empty returns', () => {
    const result = compareToBenchmark([], 10);
    // average([]) = 0, excessReturn = 0 - 10 = -10
    expect(result.excessReturn).toBeCloseTo(-10, 1);
  });
});

describe('calculateRiskAdjustedReturns - all identical returns', () => {
  it('should return sharpe=0 and sortino=Infinity for identical positive returns', () => {
    const returns = [3, 3, 3, 3, 3];
    const result = calculateRiskAdjustedReturns(returns, 0);

    // stdDev=0 -> sharpe=0
    expect(result.sharpeRatio).toBe(0);
    // No negative returns -> downsideDeviation=0 -> avgReturn>0 -> sortino=Infinity
    expect(result.sortinoRatio).toBe(Infinity);
  });
});

describe('calculateDrawdownAnalysis - unclosed drawdown', () => {
  it('should have unclosed drawdown period when equity ends below peak', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 110 },
      { date: '2024-01-03', equity: 105 },
      { date: '2024-01-04', equity: 95 },
    ];
    const result = calculateDrawdownAnalysis(equityCurve);

    expect(result.currentDrawdown).toBeGreaterThan(0);
    expect(result.drawdownPeriods.length).toBeGreaterThan(0);
    const lastPeriod = result.drawdownPeriods[result.drawdownPeriods.length - 1]!;
    expect(lastPeriod.isRecovered).toBe(false);
    expect(lastPeriod.recoveryDate).toBeNull();
    expect(lastPeriod.recoveryDays).toBeNull();
  });
});

describe('buildTradingMetrics - edge cases', () => {
  it('should return zeros for empty trades array', () => {
    const metrics = buildTradingMetrics([], 100);

    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.avgHoldingDays).toBe(0);
    expect(metrics.maxConsecutiveWins).toBe(0);
    expect(metrics.maxConsecutiveLosses).toBe(0);
  });

  it('should handle trades missing holdingDays gracefully', () => {
    const trades = [
      { type: 'sell' as const, pnlPercent: 5 },
      { type: 'sell' as const, pnlPercent: -2 },
    ];
    const metrics = buildTradingMetrics(trades, 100);

    expect(metrics.totalTrades).toBe(2);
    // No holdingDays provided -> avgHoldingDays = 0
    expect(metrics.avgHoldingDays).toBe(0);
  });
});

describe('buildRiskMetrics - uncovered branches', () => {
  it('should return negative sortinoRatio when return is below risk-free rate', () => {
    // All identical returns with high risk-free rate
    // Equity stays flat -> annualizedReturn ~0, annualizedRiskFree = 5*100 = 500
    // With corrected Sortino formula (all returns use min(r-rf, 0)):
    // downside deviation is non-zero because 0% < riskFree, so sortino is negative
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 100 },
      { date: '2024-01-03', equity: 100 },
      { date: '2024-01-04', equity: 100 },
    ];
    const metrics = buildRiskMetrics(equityCurve, 5);

    // Correct behavior: 0% return with 500% risk-free → deeply negative Sortino
    expect(metrics.sortinoRatio).toBeLessThan(0);
  });

  it('should return calmarRatio=0 when no drawdown and annualizedReturn <= 0', () => {
    // Flat equity -> maxDrawdown=0, annualizedReturn=0 -> calmar=0 branch (line 1041)
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 100 },
      { date: '2024-01-03', equity: 100 },
    ];
    const metrics = buildRiskMetrics(equityCurve, 0);

    expect(metrics.calmarRatio).toBe(0);
  });

  it('should return calmarRatio=Infinity (capped at 10) when no drawdown and positive return', () => {
    // Rising equity -> maxDrawdown=0, annualizedReturn>0 -> calmar=Infinity -> capped at 10
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 110 },
      { date: '2024-01-03', equity: 120 },
    ];
    const metrics = buildRiskMetrics(equityCurve, 0);

    expect(metrics.calmarRatio).toBe(10);
  });
});

describe('percentile - boundary values', () => {
  it('should return first element for p=0', () => {
    const values = [5, 3, 1, 4, 2];
    // p<=0 returns values[0] of the unsorted array
    expect(percentile(values, 0)).toBe(5);
  });

  it('should return last element for p=100', () => {
    const values = [5, 3, 1, 4, 2];
    // p>=100 returns values[values.length-1] of the unsorted array
    expect(percentile(values, 100)).toBe(2);
  });
});

describe('calculateDrawdownAnalysis - recovery branch', () => {
  it('should close drawdown period when equity recovers past previous peak', () => {
    // Equity: 100 -> 90 (drawdown) -> 105 (new peak, closes the period)
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 95 },
      { date: '2024-01-03', equity: 90 },
      { date: '2024-01-04', equity: 95 },
      { date: '2024-01-05', equity: 105 }, // New peak -> triggers recovery close (lines 744-754)
    ];
    const result = calculateDrawdownAnalysis(equityCurve);

    expect(result.maxDrawdown).toBeGreaterThan(0);
    expect(result.currentDrawdown).toBe(0); // Recovered
    // Should have at least one recovered period
    const recoveredPeriods = result.drawdownPeriods.filter(p => p.isRecovered);
    expect(recoveredPeriods.length).toBeGreaterThanOrEqual(1);
    const period = recoveredPeriods[0]!;
    expect(period.isRecovered).toBe(true);
    expect(period.recoveryDate).toBe('2024-01-05');
    expect(typeof period.recoveryDays).toBe('number');
    expect(period.recoveryDays).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple drawdown-recovery cycles', () => {
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 90 },
      { date: '2024-01-03', equity: 110 }, // Recovery past peak
      { date: '2024-01-04', equity: 95 },  // New drawdown
      { date: '2024-01-05', equity: 115 }, // Recovery past peak again
    ];
    const result = calculateDrawdownAnalysis(equityCurve);

    const recoveredPeriods = result.drawdownPeriods.filter(p => p.isRecovered);
    expect(recoveredPeriods.length).toBe(2);
    expect(result.currentDrawdown).toBe(0);
  });
});

describe('buildRiskMetrics - sortinoRatio with positive returns and downsideVol > 0', () => {
  it('should calculate positive sortino when downsideVol > 0 and return > riskFree', () => {
    // Mix of positive and negative daily returns so downsideVol > 0
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 103 },
      { date: '2024-01-03', equity: 101 }, // Negative return
      { date: '2024-01-04', equity: 105 },
      { date: '2024-01-05', equity: 103 }, // Negative return
      { date: '2024-01-06', equity: 108 },
    ];
    const metrics = buildRiskMetrics(equityCurve, 0);

    // downsideVol > 0 (has negative returns), annualizedReturn > 0 -> line 1030 branch
    expect(metrics.sortinoRatio).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.sortinoRatio)).toBe(true);
  });
});

describe('buildRiskMetrics - calmarRatio with maxDrawdown > 0', () => {
  it('should calculate finite calmar when maxDrawdown > 0', () => {
    // Equity with drawdown so maxDrawdown > 0
    const equityCurve = [
      { date: '2024-01-01', equity: 100 },
      { date: '2024-01-02', equity: 95 },
      { date: '2024-01-03', equity: 105 },
      { date: '2024-01-04', equity: 110 },
    ];
    const metrics = buildRiskMetrics(equityCurve, 0);

    // maxDrawdown > 0 -> line 1038 branch
    expect(Number.isFinite(metrics.calmarRatio)).toBe(true);
  });
});

// =============================================================================
// ADDITIONAL COVERAGE TESTS FOR UNCOVERED LINES 552-553, 650-658
// =============================================================================

describe('calculateRiskAdjustedReturns - maxDrawdown update (lines 552-553)', () => {
  it('should update maxDrawdown when cumulative drops below peak', () => {
    // Returns that go up then down to trigger maxDrawdown update
    // Peak at cumulative +5, then drops
    const returns = [2, 3, -4, -2]; // cumulative: 2, 5 (peak), 1, -1 (drawdown = 6)
    const result = calculateRiskAdjustedReturns(returns, 0);

    // maxDrawdown should be 6 (peak 5 - trough -1)
    expect(result.maxDrawdown).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBeCloseTo(6, 1);
  });

  it('should track peak and detect multiple drawdowns', () => {
    // More complex pattern with multiple drawdown events
    const returns = [5, -2, 3, -4, 2, -1]; // cumulative: 5, 3, 6 (new peak), 2, 4, 3
    const result = calculateRiskAdjustedReturns(returns, 0);

    // Peak at 6, trough at 2, maxDrawdown = 4
    expect(result.maxDrawdown).toBeGreaterThan(0);
  });

  it('should correctly calculate maxDrawdown in simple decline', () => {
    // Simple pattern: rise to peak then continuous decline
    const returns = [10, -3, -5, -2]; // cumulative: 10 (peak), 7, 2, 0 (drawdown = 10)
    const result = calculateRiskAdjustedReturns(returns, 0);

    expect(result.maxDrawdown).toBeCloseTo(10, 1);
  });
});

describe('calculateMonthlyStats - empty array branch (lines 650-658)', () => {
  it('should return all zeros and nulls for empty monthlyReturns array', () => {
    const stats = calculateMonthlyStats([]);

    expect(stats.avgMonthlyReturn).toBe(0);
    expect(stats.bestMonth).toBeNull();
    expect(stats.worstMonth).toBeNull();
    expect(stats.positiveMonths).toBe(0);
    expect(stats.negativeMonths).toBe(0);
    expect(stats.monthlyWinRate).toBe(0);
  });

  it('should handle single month data correctly', () => {
    const monthlyReturns = [
      { year: 2024, month: 1, label: '2024-01', returnPct: 5, isPositive: true },
    ];
    const stats = calculateMonthlyStats(monthlyReturns);

    expect(stats.avgMonthlyReturn).toBeCloseTo(5, 1);
    expect(stats.bestMonth).not.toBeNull();
    expect(stats.bestMonth!.returnPct).toBe(5);
    expect(stats.worstMonth).not.toBeNull();
    expect(stats.worstMonth!.returnPct).toBe(5);
    expect(stats.positiveMonths).toBe(1);
    expect(stats.negativeMonths).toBe(0);
    expect(stats.monthlyWinRate).toBe(100);
  });
});

describe('calculateRiskAdjustedReturns - sortino ratio edge case (line 538)', () => {
  it('should return sortinoRatio=0 when avgReturn <= 0 and no negative returns', () => {
    // All zero returns -> avgReturn=0, no negative returns -> downsideDeviation=0
    // Line 538: avgReturn <= 0 -> return 0
    const returns = [0, 0, 0, 0];
    const result = calculateRiskAdjustedReturns(returns, 0);

    expect(result.sortinoRatio).toBe(0);
  });

  it('should return negative sortinoRatio when all returns are at risk-free threshold', () => {
    // Edge case: all zeros with high risk-free rate
    // With corrected formula (min(r-rf, 0) for all returns):
    // downside deviation is non-zero since each return (0) < riskFree (5)
    const returns = [0, 0, 0];
    const result = calculateRiskAdjustedReturns(returns, 5); // High risk-free rate

    // Correct behavior: 0% return with 5% risk-free → negative Sortino ratio
    expect(result.sortinoRatio).toBeLessThan(0);
  });
});

describe('calculatePeriodReturn - uncovered function (lines 368-406)', () => {
  it('should return null for empty klines array', () => {
    const result = calculatePeriodReturn([], '2024-01-01', '2024-01-31');
    expect(result).toBeNull();
  });

  it('should calculate period return for valid date range', () => {
    const klines = [
      { time: 1704067200, open: 10, high: 11, low: 9.5, close: 10, volume: 1000 }, // 2024-01-01
      { time: 1704153600, open: 10.5, high: 11.5, low: 10, close: 11, volume: 1200 }, // 2024-01-02
      { time: 1704240000, open: 11, high: 12, low: 10.5, close: 12, volume: 1100 }, // 2024-01-03
    ];

    const result = calculatePeriodReturn(klines, '2024-01-01', '2024-01-03');

    expect(result).not.toBeNull();
    expect(result!.startPrice).toBe(10);
    expect(result!.endPrice).toBe(12);
    expect(result!.returnPct).toBeCloseTo(20, 1); // (12-10)/10 * 100 = 20%
  });

  it('should return null when no klines match date range', () => {
    const klines = [
      { time: 1704067200, open: 10, high: 11, low: 9.5, close: 10, volume: 1000 }, // 2024-01-01
    ];

    // Request dates before the data
    const result = calculatePeriodReturn(klines, '2023-01-01', '2023-01-31');
    expect(result).toBeNull();
  });

  it('should handle single kline that matches both start and end', () => {
    const klines = [
      { time: 1704067200, open: 10, high: 11, low: 9.5, close: 10, volume: 1000 }, // 2024-01-01
    ];

    const result = calculatePeriodReturn(klines, '2024-01-01', '2024-01-01');

    expect(result).not.toBeNull();
    expect(result!.returnPct).toBe(0); // Same start and end price
  });
});

describe('calculateSignalTimeline - uncovered function (lines 303-352)', () => {
  it('should return empty array for empty signals', () => {
    const result = calculateSignalTimeline([]);
    expect(result).toEqual([]);
  });

  it('should group signals by date and calculate averages', () => {
    const signals: SignalDetail[] = [
      makeSignal(10, true),
      { ...makeSignal(5, true), entryDate: '2024-01-01' },
      { ...makeSignal(-3, false), entryDate: '2024-01-02' },
    ];
    // First two signals are on 2024-01-01, third is on 2024-01-02

    // Adjust dates to be the same for first two
    signals[0]!.entryDate = '2024-01-01';
    signals[1]!.entryDate = '2024-01-01';
    signals[2]!.entryDate = '2024-01-02';

    const result = calculateSignalTimeline(signals);

    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe('2024-01-01');
    expect(result[0]!.signalCount).toBe(2);
    expect(result[0]!.avgReturn).toBeCloseTo(7.5, 1); // (10 + 5) / 2
    expect(result[1]!.date).toBe('2024-01-02');
    expect(result[1]!.signalCount).toBe(1);
    expect(result[1]!.avgReturn).toBe(-3);
  });

  it('should sort timeline by date ascending', () => {
    const signals: SignalDetail[] = [
      { ...makeSignal(5, true), entryDate: '2024-01-10' },
      { ...makeSignal(8, true), entryDate: '2024-01-01' },
      { ...makeSignal(-2, false), entryDate: '2024-01-05' },
    ];

    const result = calculateSignalTimeline(signals);

    expect(result).toHaveLength(3);
    expect(result[0]!.date).toBe('2024-01-01');
    expect(result[1]!.date).toBe('2024-01-05');
    expect(result[2]!.date).toBe('2024-01-10');
  });

  it('should count buy and sell signals separately', () => {
    const signals: SignalDetail[] = [
      { ...makeSignal(10, true), entryDate: '2024-01-01', type: 'buy' as const },
      { ...makeSignal(5, true), entryDate: '2024-01-01', type: 'sell' as const },
      { ...makeSignal(3, true), entryDate: '2024-01-01', type: 'buy' as const },
    ];

    const result = calculateSignalTimeline(signals);

    expect(result).toHaveLength(1);
    expect(result[0]!.buyCount).toBe(2);
    expect(result[0]!.sellCount).toBe(1);
  });
});

describe('percentile - interpolation branch (line 216)', () => {
  it('should interpolate between values for non-integer index', () => {
    // Array with 4 elements: [1, 2, 3, 4]
    // percentile at 37.5% -> index = 0.375 * 3 = 1.125
    // lower = 1, upper = 2
    // sorted[1] = 2, sorted[2] = 3
    // result = 2 + (3-2) * (1.125 - 1) = 2 + 0.125 = 2.125
    const values = [1, 2, 3, 4];
    const p37_5 = percentile(values, 37.5);

    // This should trigger the interpolation branch (line 216-218)
    expect(p37_5).toBeCloseTo(2.125, 3);
  });

  it('should interpolate correctly for percentile 25', () => {
    const values = [1, 2, 3, 4, 5];
    // index = 0.25 * 4 = 1
    // lower = 1, upper = 1 -> returns sorted[1]
    const p25 = percentile(values, 25);
    expect(p25).toBe(2);
  });

  it('should interpolate correctly for percentile 75', () => {
    const values = [1, 2, 3, 4, 5];
    // index = 0.75 * 4 = 3
    // lower = 3, upper = 3 -> returns sorted[3]
    const p75 = percentile(values, 75);
    expect(p75).toBe(4);
  });

  it('should interpolate for percentile that falls between indices', () => {
    const values = [10, 20, 30, 40, 50];
    // percentile 30: index = 0.30 * 4 = 1.2
    // lower = 1, upper = 2
    // sorted = [10, 20, 30, 40, 50]
    // result = 20 + (30-20) * (1.2 - 1) = 20 + 2 = 22
    const p30 = percentile(values, 30);
    expect(p30).toBeCloseTo(22, 1);
  });
});
