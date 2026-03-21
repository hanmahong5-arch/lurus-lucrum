/**
 * Portfolio Backtest Engine
 *
 * Applies ONE strategy across 2-100 stocks with a SHARED capital pool.
 * Core difference from single-stock engine: buying stock A reduces capital
 * available for stock B. This is the foundation of practical position
 * allocation ("fen-cang", 分仓).
 *
 * Algorithm overview:
 *   1. Calculate target weights via position-sizing module.
 *   2. Fetch K-line data for ALL stocks.
 *   3. Align all stock timelines to a unified trading calendar.
 *   4. For each trading day (chronologically):
 *      a. Mark sell signals and execute sells first (frees cash).
 *      b. Collect buy signals from non-held stocks.
 *      c. Rank buy signals by signalStrength * targetWeight (descending).
 *      d. For each buy signal, compute position size, enforce lot/sector/cap limits.
 *      e. Record portfolio value = cash + sum(qty_i * close_i).
 *   5. Close remaining positions at last day's close.
 *   6. Calculate aggregate metrics from daily portfolio values.
 *
 * @module lib/backtest/portfolio/engine
 */

import Decimal from "decimal.js";
import { calculateMaxAffordableLots, getLotSizeConfig } from "../lot-size";
import { parseStrategyCode } from "../engine";
import type { BacktestKline, ParsedStrategy, StrategySignal } from "../types";
import { calculateTargetWeights, calculateVolatility } from "./position-sizing";
import type {
  PortfolioConfig,
  PortfolioBacktestResult,
  PortfolioStockResult,
  PortfolioTrade,
  PortfolioEquityPoint,
  PortfolioProgress,
  StockSimulationState,
  RankedBuySignal,
  SectorAllocationEntry,
} from "./types";

// =============================================================================
// CONSTANTS
// =============================================================================

/** China 1-year deposit benchmark rate as risk-free rate */
const CHINA_RISK_FREE_RATE = 0.02;

/** Daily risk-free rate */
const DAILY_RISK_FREE_RATE = CHINA_RISK_FREE_RATE / 252;

/** Default stamp duty rate (sell only, since 2023-08-28) */
const DEFAULT_STAMP_DUTY = 0.0005;

/** Default transfer fee rate (bilateral) */
const DEFAULT_TRANSFER_FEE = 0.00001;

/** Minimum commission per trade in CNY */
const MIN_COMMISSION_CNY = 5;

/** Minimum data points required per stock to attempt backtest */
const MIN_KLINE_BARS = 30;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Data provider function type: given a symbol and date range, returns K-lines.
 * The caller (API route) supplies the concrete implementation.
 */
export type KlineProvider = (
  symbol: string,
  startDate: string,
  endDate: string,
) => Promise<BacktestKline[]>;

/**
 * Run a portfolio-level backtest.
 *
 * @param config  Portfolio configuration from user input
 * @param klineProvider  Async function that fetches K-line data for a symbol
 * @param onProgress  Optional progress callback (for SSE streaming)
 * @returns Complete portfolio backtest result
 */
export async function runPortfolioBacktest(
  config: PortfolioConfig,
  klineProvider: KlineProvider,
  onProgress?: (progress: PortfolioProgress) => void,
): Promise<PortfolioBacktestResult> {
  const startTime = performance.now();

  // Validate config
  validateConfig(config);

  // -- Phase 1: Load data --
  onProgress?.({
    phase: "loading-data",
    progress: 5,
    message: `Loading K-line data for ${config.stocks.length} stocks...`,
  });

  const stockKlines = new Map<string, BacktestKline[]>();
  const failedSymbols = new Set<string>();

  // Fetch data for all stocks concurrently (batched to avoid overload)
  const BATCH_SIZE = 10;
  for (let i = 0; i < config.stocks.length; i += BATCH_SIZE) {
    const batch = config.stocks.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (stock) => {
        const klines = await klineProvider(
          stock.symbol,
          config.startDate,
          config.endDate,
        );
        return { symbol: stock.symbol, klines };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { symbol, klines } = result.value;
        if (klines.length >= MIN_KLINE_BARS) {
          stockKlines.set(symbol, klines);
        } else {
          failedSymbols.add(symbol);
        }
      } else {
        // Promise rejected — extract the symbol from batch
        // Mark it as failed
        failedSymbols.add("unknown");
      }
    }

    onProgress?.({
      phase: "loading-data",
      progress: 5 + Math.round(((i + batch.length) / config.stocks.length) * 15),
      message: `Loaded ${Math.min(i + batch.length, config.stocks.length)}/${config.stocks.length} stocks`,
    });
  }

  // Filter stocks to only those with data
  const validStocks = config.stocks.filter(
    (s) => stockKlines.has(s.symbol) && !failedSymbols.has(s.symbol),
  );

  if (validStocks.length === 0) {
    throw new Error(
      "No valid K-line data available for any stock in the portfolio. " +
        "Check date range and stock symbols.",
    );
  }

  // -- Phase 2: Initialize --
  onProgress?.({
    phase: "init",
    progress: 20,
    message: "Calculating target weights and aligning timelines...",
  });

  const strategy = parseStrategyCode(config.strategy);

  // Pre-compute volatilities for risk-parity sizing
  let volatilities: Record<string, number> | undefined;
  if (config.positionSizing === "risk-parity") {
    volatilities = {};
    for (const stock of validStocks) {
      const klines = stockKlines.get(stock.symbol);
      if (klines && klines.length > 1) {
        volatilities[stock.symbol] = calculateVolatility(
          klines.map((k) => k.close),
        );
      }
    }
  }

  // Calculate target weights
  const targetWeights = calculateTargetWeights(
    validStocks,
    config.positionSizing,
    {
      maxPositionPct: config.maxPositionPct,
      maxSectorPct: config.maxSectorPct,
      customWeights: config.customWeights,
      volatilities,
    },
  );

  // Build unified trading calendar (union of all dates)
  const tradingCalendar = buildTradingCalendar(stockKlines);

  if (tradingCalendar.length < 2) {
    throw new Error(
      "Insufficient overlapping trading days across stocks. " +
        "Need at least 2 common trading days.",
    );
  }

  // Pre-compute indicators for each stock
  const stockIndicators = new Map<string, StockIndicatorCache>();
  for (const stock of validStocks) {
    const klines = stockKlines.get(stock.symbol)!;
    stockIndicators.set(stock.symbol, computeIndicators(klines));
  }

  // Initialize per-stock simulation state
  const states = new Map<string, StockSimulationState>();
  for (const stock of validStocks) {
    states.set(stock.symbol, {
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector ?? "unknown",
      targetWeight: (targetWeights.get(stock.symbol) ?? new Decimal(0)).toNumber(),
      quantity: 0,
      entryPrice: 0,
      entryDate: "",
      totalInvested: 0,
      totalReturned: 0,
      completedTrades: 0,
      dataError: false,
    });
  }

  // Mark stocks that failed data loading
  for (const stock of config.stocks) {
    if (failedSymbols.has(stock.symbol) && !states.has(stock.symbol)) {
      states.set(stock.symbol, {
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector ?? "unknown",
        targetWeight: 0,
        quantity: 0,
        entryPrice: 0,
        entryDate: "",
        totalInvested: 0,
        totalReturned: 0,
        completedTrades: 0,
        dataError: true,
      });
    }
  }

  // -- Phase 3: Day-by-day simulation --
  onProgress?.({
    phase: "computing",
    progress: 25,
    message: "Running simulation...",
    totalDays: tradingCalendar.length,
    processedDays: 0,
  });

  let cash = new Decimal(config.totalCapital);
  const allTrades: PortfolioTrade[] = [];
  const equityCurve: PortfolioEquityPoint[] = [];
  const dailyReturns: number[] = [];
  let peakValue = new Decimal(config.totalCapital);
  let maxDrawdown = new Decimal(0);
  let prevPortfolioValue = new Decimal(config.totalCapital);

  // Pending signals: generated at day[i] close, executed at day[i+1] open
  const pendingSignals = new Map<string, StrategySignal>();

  // Build date-to-index maps for each stock
  const stockDateIndex = new Map<string, Map<string, number>>();
  for (const stock of validStocks) {
    const klines = stockKlines.get(stock.symbol)!;
    const dateMap = new Map<string, number>();
    for (let i = 0; i < klines.length; i++) {
      const bar = klines[i]!;
      const date = toDateString(bar.time);
      dateMap.set(date, i);
    }
    stockDateIndex.set(stock.symbol, dateMap);
  }

  for (let dayIdx = 0; dayIdx < tradingCalendar.length; dayIdx++) {
    const date = tradingCalendar[dayIdx]!;

    // Progress reporting every 50 days
    if (dayIdx % 50 === 0) {
      onProgress?.({
        phase: "computing",
        progress: 25 + Math.round((dayIdx / tradingCalendar.length) * 60),
        message: `Day ${dayIdx + 1}/${tradingCalendar.length}`,
        currentDay: date,
        totalDays: tradingCalendar.length,
        processedDays: dayIdx + 1,
      });
    }

    // ---- Step A: Execute pending sell signals (frees cash) ----
    for (const stock of validStocks) {
      const state = states.get(stock.symbol)!;
      const pending = pendingSignals.get(stock.symbol);

      if (!pending || pending.action !== "sell" || state.quantity <= 0) continue;

      const klines = stockKlines.get(stock.symbol)!;
      const dateIdx = stockDateIndex.get(stock.symbol)!.get(date);
      if (dateIdx === undefined) continue; // Stock not trading on this day

      const bar = klines[dateIdx]!;
      const prevBarIdx = dateIdx > 0 ? dateIdx - 1 : 0;
      const prevBar = klines[prevBarIdx]!;

      // T+1 check: cannot sell on the same day as purchase
      if (state.entryDate >= date) continue;

      // Circuit breaker check (limit down)
      const limitDown = getLimitDown(stock.symbol, prevBar.close);
      if (bar.low <= limitDown) continue; // Limit-down, cannot sell

      // Execute sell at today's open
      const execPrice = bar.open;
      const slippageAmt = new Decimal(execPrice).mul(config.slippage);
      const sellPrice = new Decimal(execPrice).minus(slippageAmt);
      const sellValue = sellPrice.mul(state.quantity);

      // Costs: stamp duty + transfer fee + commission
      const stampDuty = sellValue.mul(DEFAULT_STAMP_DUTY);
      const transferFee = sellValue.mul(DEFAULT_TRANSFER_FEE);
      const commission = Decimal.max(
        sellValue.mul(config.commission),
        MIN_COMMISSION_CNY,
      );
      const netProceeds = sellValue.minus(stampDuty).minus(transferFee).minus(commission);

      const cashBefore = cash.toNumber();
      cash = cash.plus(netProceeds);

      allTrades.push({
        date,
        symbol: stock.symbol,
        symbolName: stock.name,
        type: "sell",
        quantity: state.quantity,
        price: sellPrice.toFixed(2) as unknown as number,
        lots: Math.floor(state.quantity / getLotSizeConfig(stock.symbol).lotSize),
        cost: netProceeds.toNumber(),
        cashBefore,
        cashAfter: cash.toNumber(),
        reason: pending.reason ?? "Sell signal",
      });

      state.totalReturned = new Decimal(state.totalReturned).plus(netProceeds).toNumber();
      state.completedTrades++;
      state.quantity = 0;
      state.entryPrice = 0;
      state.entryDate = "";
    }

    // ---- Step B: Collect pending buy signals ----
    const buySignals: RankedBuySignal[] = [];

    for (const stock of validStocks) {
      const state = states.get(stock.symbol)!;
      const pending = pendingSignals.get(stock.symbol);

      if (!pending || pending.action !== "buy" || state.quantity > 0) continue;

      const klines = stockKlines.get(stock.symbol)!;
      const dateIdx = stockDateIndex.get(stock.symbol)!.get(date);
      if (dateIdx === undefined) continue;

      const bar = klines[dateIdx]!;
      const prevBarIdx = dateIdx > 0 ? dateIdx - 1 : 0;
      const prevBar = klines[prevBarIdx]!;

      // Circuit breaker check (limit up)
      const limitUp = getLimitUp(stock.symbol, prevBar.close);
      if (bar.high >= limitUp) continue; // Limit-up, cannot buy

      buySignals.push({
        symbol: stock.symbol,
        signalStrength: pending.strength ?? 50,
        targetWeight: state.targetWeight,
        price: bar.open,
        reason: pending.reason ?? "Buy signal",
      });
    }

    // ---- Step C: Sort buy signals by priority ----
    buySignals.sort((a, b) => {
      // Priority = signalStrength * targetWeight (higher = better)
      const priorityA = a.signalStrength * a.targetWeight;
      const priorityB = b.signalStrength * b.targetWeight;
      return priorityB - priorityA;
    });

    // ---- Step D: Execute buys in priority order ----
    for (const signal of buySignals) {
      const state = states.get(signal.symbol)!;

      // Calculate position size
      const totalCapDec = new Decimal(config.totalCapital);
      const maxByWeight = totalCapDec.mul(state.targetWeight);
      const maxByPositionLimit = totalCapDec.mul(config.maxPositionPct);
      const maxBySectorLimit = computeSectorBudget(
        state.sector,
        states,
        config.maxSectorPct,
        config.totalCapital,
        stockKlines,
        date,
        stockDateIndex,
      );

      // Take the minimum of all constraints and available cash
      const positionBudget = Decimal.min(
        maxByWeight,
        maxByPositionLimit,
        maxBySectorLimit,
        cash,
      );

      if (positionBudget.lte(0)) continue;

      // Calculate actual execution price with slippage
      const slippageAmt = new Decimal(signal.price).mul(config.slippage);
      const buyPrice = new Decimal(signal.price).plus(slippageAmt);

      // Round to lots using the existing lot-size module
      const lotCalc = calculateMaxAffordableLots(
        positionBudget.toNumber(),
        buyPrice.toNumber(),
        signal.symbol,
        config.commission,
      );

      if (lotCalc.actualQuantity <= 0) continue;

      // Final cost with fees
      const orderValue = new Decimal(lotCalc.actualQuantity).mul(buyPrice);
      const commission = Decimal.max(
        orderValue.mul(config.commission),
        MIN_COMMISSION_CNY,
      );
      const transferFee = orderValue.mul(DEFAULT_TRANSFER_FEE);
      const totalCost = orderValue.plus(commission).plus(transferFee);

      // Double-check we can afford it
      if (totalCost.gt(cash)) continue;

      const cashBefore = cash.toNumber();
      cash = cash.minus(totalCost);

      allTrades.push({
        date,
        symbol: signal.symbol,
        symbolName: state.name,
        type: "buy",
        quantity: lotCalc.actualQuantity,
        price: buyPrice.toFixed(2) as unknown as number,
        lots: lotCalc.actualLots,
        cost: totalCost.toNumber(),
        cashBefore,
        cashAfter: cash.toNumber(),
        reason: signal.reason,
      });

      state.quantity = lotCalc.actualQuantity;
      state.entryPrice = buyPrice.toNumber();
      state.entryDate = date;
      state.totalInvested = new Decimal(state.totalInvested).plus(totalCost).toNumber();
    }

    // ---- Step E: Generate signals for NEXT day using today's close data ----
    pendingSignals.clear();
    for (const stock of validStocks) {
      const state = states.get(stock.symbol)!;
      const klines = stockKlines.get(stock.symbol)!;
      const indicators = stockIndicators.get(stock.symbol)!;
      const dateIdx = stockDateIndex.get(stock.symbol)!.get(date);

      if (dateIdx === undefined) continue;

      const signal = generateSignal(
        strategy,
        klines,
        dateIdx,
        state.quantity,
        indicators,
      );

      if (signal.action !== "hold") {
        pendingSignals.set(stock.symbol, signal);
      }
    }

    // ---- Step F: Record portfolio value (end-of-day valuation) ----
    let positionsValue = new Decimal(0);
    let positionsHeld = 0;

    for (const stock of validStocks) {
      const state = states.get(stock.symbol)!;
      if (state.quantity <= 0) continue;

      const klines = stockKlines.get(stock.symbol)!;
      const dateIdx = stockDateIndex.get(stock.symbol)!.get(date);
      if (dateIdx === undefined) continue;

      const closePrice = klines[dateIdx]!.close;
      positionsValue = positionsValue.plus(
        new Decimal(state.quantity).mul(closePrice),
      );
      positionsHeld++;
    }

    const portfolioValue = cash.plus(positionsValue);

    // Drawdown tracking
    if (portfolioValue.gt(peakValue)) {
      peakValue = portfolioValue;
    }
    const currentDrawdown = peakValue.gt(0)
      ? peakValue.minus(portfolioValue).div(peakValue)
      : new Decimal(0);
    if (currentDrawdown.gt(maxDrawdown)) {
      maxDrawdown = currentDrawdown;
    }

    // Daily return
    const dailyReturn = prevPortfolioValue.gt(0)
      ? portfolioValue.minus(prevPortfolioValue).div(prevPortfolioValue).toNumber()
      : 0;
    dailyReturns.push(dailyReturn);

    equityCurve.push({
      date,
      value: portfolioValue.toFixed(2) as unknown as number,
      drawdown: currentDrawdown.mul(100).toFixed(2) as unknown as number,
      cash: cash.toFixed(2) as unknown as number,
      positionsHeld,
    });

    prevPortfolioValue = portfolioValue;
  }

  // -- Phase 4: Close remaining positions at last day's close --
  onProgress?.({
    phase: "finalizing",
    progress: 90,
    message: "Closing remaining positions and calculating metrics...",
  });

  const lastDate = tradingCalendar[tradingCalendar.length - 1]!;
  for (const stock of validStocks) {
    const state = states.get(stock.symbol)!;
    if (state.quantity <= 0) continue;

    const klines = stockKlines.get(stock.symbol)!;
    const dateIdx = stockDateIndex.get(stock.symbol)!.get(lastDate);
    if (dateIdx === undefined) continue;

    const closePrice = klines[dateIdx]!.close;
    const sellValue = new Decimal(state.quantity).mul(closePrice);
    const stampDuty = sellValue.mul(DEFAULT_STAMP_DUTY);
    const transferFee = sellValue.mul(DEFAULT_TRANSFER_FEE);
    const commission = Decimal.max(
      sellValue.mul(config.commission),
      MIN_COMMISSION_CNY,
    );
    const netProceeds = sellValue.minus(stampDuty).minus(transferFee).minus(commission);

    const cashBefore = cash.toNumber();
    cash = cash.plus(netProceeds);

    allTrades.push({
      date: lastDate,
      symbol: stock.symbol,
      symbolName: stock.name,
      type: "sell",
      quantity: state.quantity,
      price: closePrice,
      lots: Math.floor(state.quantity / getLotSizeConfig(stock.symbol).lotSize),
      cost: netProceeds.toNumber(),
      cashBefore,
      cashAfter: cash.toNumber(),
      reason: "Portfolio backtest end — close all positions",
    });

    state.totalReturned = new Decimal(state.totalReturned).plus(netProceeds).toNumber();
    state.completedTrades++;
    state.quantity = 0;
  }

  // -- Phase 5: Compute aggregate metrics --
  const finalValue = cash;
  const totalReturn = finalValue.minus(config.totalCapital)
    .div(config.totalCapital)
    .mul(100)
    .toNumber();

  // Annualized return (compound, based on calendar days)
  const firstDate = tradingCalendar[0]!;
  const calendarDays = daysBetween(firstDate, lastDate);
  const annualizedReturn = calendarDays > 0
    ? (Math.pow(finalValue.div(config.totalCapital).toNumber(), 365 / calendarDays) - 1) * 100
    : 0;

  // Sharpe ratio
  const avgDailyReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;
  const stdReturn = computeStdDev(dailyReturns, avgDailyReturn);
  const annualizedVol = stdReturn * Math.sqrt(252);
  const excessAnnualReturn = (annualizedReturn / 100) - CHINA_RISK_FREE_RATE;
  const portfolioSharpe = annualizedVol > 0
    ? excessAnnualReturn / annualizedVol
    : 0;

  // Sortino ratio
  const downsideSquaredSum = dailyReturns.reduce(
    (sum, r) => sum + Math.pow(Math.min(r - DAILY_RISK_FREE_RATE, 0), 2),
    0,
  );
  const downsideDeviation = dailyReturns.length > 0
    ? Math.sqrt((downsideSquaredSum / dailyReturns.length) * 252)
    : 0;
  const portfolioSortino = downsideDeviation > 0
    ? excessAnnualReturn / downsideDeviation
    : 0;

  // -- Per-stock results --
  const stockResults: PortfolioStockResult[] = [];
  for (const stock of config.stocks) {
    const state = states.get(stock.symbol);
    if (!state) {
      stockResults.push({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        allocatedCapital: 0,
        actualWeight: 0,
        trades: 0,
        returnPct: 0,
        contribution: 0,
        status: "data-error",
      });
      continue;
    }

    const allocated = new Decimal(state.targetWeight).mul(config.totalCapital);
    const netPnl = state.totalReturned - state.totalInvested;

    let status: PortfolioStockResult["status"];
    if (state.dataError) {
      status = "data-error";
    } else if (state.completedTrades === 0 && state.totalInvested === 0) {
      status = state.targetWeight > 0 ? "no-signal" : "insufficient-capital";
    } else {
      status = "traded";
    }

    const returnPct = state.totalInvested > 0
      ? (netPnl / state.totalInvested) * 100
      : 0;

    // Contribution = netPnl / totalCapital * 100
    const contribution = (netPnl / config.totalCapital) * 100;

    stockResults.push({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      allocatedCapital: allocated.toNumber(),
      actualWeight: state.targetWeight,
      trades: state.completedTrades,
      returnPct,
      contribution,
      status,
    });
  }

  // -- Diversification metrics --
  const sectorAllocation = computeSectorAllocation(stockResults);
  const effectiveStocks = stockResults.filter((s) => s.status === "traded").length;
  const concentrationIndex = computeHHI(stockResults);

  const executionTimeMs = performance.now() - startTime;

  onProgress?.({
    phase: "finalizing",
    progress: 100,
    message: "Portfolio backtest complete",
  });

  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown: maxDrawdown.mul(100).toNumber(),
    portfolioSharpe,
    portfolioSortino,
    equityCurve,
    stockResults,
    diversification: {
      sectorAllocation,
      correlationScore: computeCorrelationScore(stockResults),
      effectiveStocks,
      concentrationIndex,
    },
    allTrades,
    config,
    executionTimeMs,
  };
}

// =============================================================================
// TRADING CALENDAR
// =============================================================================

/**
 * Build a sorted array of unique trading dates across all stocks.
 * Uses the UNION of all dates so no trading day is skipped.
 */
function buildTradingCalendar(
  stockKlines: Map<string, BacktestKline[]>,
): string[] {
  const dateSet = new Set<string>();
  stockKlines.forEach((klines) => {
    for (const bar of klines) {
      dateSet.add(toDateString(bar.time));
    }
  });

  const sorted = Array.from(dateSet).sort();
  return sorted;
}

// =============================================================================
// SIGNAL GENERATION (reused from single-stock engine patterns)
// =============================================================================

interface StockIndicatorCache {
  closes: number[];
  sma5: number[];
  sma10: number[];
  sma20: number[];
  rsi: number[];
  macdHist: number[];
  bollUpper: number[];
  bollLower: number[];
}

function computeIndicators(klines: BacktestKline[]): StockIndicatorCache {
  const closes = klines.map((k) => k.close);
  return {
    closes,
    sma5: computeSMA(closes, 5),
    sma10: computeSMA(closes, 10),
    sma20: computeSMA(closes, 20),
    rsi: computeRSI(closes, 14),
    macdHist: computeMACDHistogram(closes),
    bollUpper: computeBollinger(closes, 20, 2).upper,
    bollLower: computeBollinger(closes, 20, 2).lower,
  };
}

/**
 * Generate a trading signal for a stock at a given bar index.
 * Strategy logic matches the single-stock engine for consistency.
 */
function generateSignal(
  strategy: ParsedStrategy,
  klines: BacktestKline[],
  index: number,
  currentPosition: number,
  indicators: StockIndicatorCache,
): StrategySignal {
  const currentPrice = klines[index]?.close ?? 0;
  let signal: StrategySignal = { action: "hold" };

  // MA Crossover Strategy
  if (
    strategy.indicators.includes("SMA") ||
    Object.keys(strategy.params).some(
      (k) => k.includes("ma") || k.includes("window"),
    )
  ) {
    const currFast = indicators.sma5[index];
    const currSlow = indicators.sma20[index];
    const prevFast = indicators.sma5[index - 1];
    const prevSlow = indicators.sma20[index - 1];

    if (
      currFast !== undefined && currSlow !== undefined &&
      prevFast !== undefined && prevSlow !== undefined &&
      !isNaN(currFast) && !isNaN(currSlow) &&
      !isNaN(prevFast) && !isNaN(prevSlow)
    ) {
      if (prevFast <= prevSlow && currFast > currSlow && currentPosition === 0) {
        signal = { action: "buy", reason: "MA golden cross", strength: 60 };
      } else if (prevFast >= prevSlow && currFast < currSlow && currentPosition > 0) {
        signal = { action: "sell", reason: "MA death cross", strength: 60 };
      }
    }
  }

  // RSI Strategy
  if (strategy.indicators.includes("RSI")) {
    const rsiBuy = strategy.params.rsi_buy ?? strategy.params.oversold ?? 30;
    const rsiSell = strategy.params.rsi_sell ?? strategy.params.overbought ?? 70;

    const currRSI = indicators.rsi[index];
    const prevRSI = indicators.rsi[index - 1];

    if (
      currRSI !== undefined && prevRSI !== undefined &&
      !isNaN(currRSI) && !isNaN(prevRSI)
    ) {
      if (prevRSI < rsiBuy && currRSI >= rsiBuy && currentPosition === 0) {
        signal = { action: "buy", reason: `RSI oversold bounce (${currRSI.toFixed(1)})`, strength: 55 };
      } else if (currRSI > rsiSell && currentPosition > 0) {
        signal = { action: "sell", reason: `RSI overbought (${currRSI.toFixed(1)})`, strength: 55 };
      }
    }
  }

  // MACD Strategy
  if (strategy.indicators.includes("MACD")) {
    const currHist = indicators.macdHist[index];
    const prevHist = indicators.macdHist[index - 1];

    if (
      currHist !== undefined && prevHist !== undefined &&
      !isNaN(currHist) && !isNaN(prevHist)
    ) {
      if (prevHist <= 0 && currHist > 0 && currentPosition === 0) {
        signal = { action: "buy", reason: "MACD golden cross", strength: 65 };
      } else if (prevHist >= 0 && currHist < 0 && currentPosition > 0) {
        signal = { action: "sell", reason: "MACD death cross", strength: 65 };
      }
    }
  }

  // Bollinger Bands Strategy
  if (strategy.indicators.includes("BOLL")) {
    const lower = indicators.bollLower[index];
    const upper = indicators.bollUpper[index];

    if (
      lower !== undefined && upper !== undefined &&
      !isNaN(lower) && !isNaN(upper)
    ) {
      if (currentPrice <= lower && currentPosition === 0) {
        signal = { action: "buy", reason: "Touch lower Bollinger Band", strength: 50 };
      } else if (currentPrice >= upper && currentPosition > 0) {
        signal = { action: "sell", reason: "Touch upper Bollinger Band", strength: 50 };
      }
    }
  }

  return signal;
}

// =============================================================================
// INDICATOR CALCULATIONS (lightweight duplicates for self-contained module)
// =============================================================================

function computeSMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i]!;
    if (i >= period) {
      sum -= data[i - period]!;
    }
    result[i] = i < period - 1 ? NaN : sum / period;
  }
  return result;
}

function computeRSI(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  const gains: number[] = new Array(data.length);
  const losses: number[] = new Array(data.length);
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result[i] = 50;
      gains[i] = 0;
      losses[i] = 0;
      continue;
    }
    const change = (data[i] ?? 0) - (data[i - 1] ?? 0);
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    gains[i] = gain;
    losses[i] = loss;
    gainSum += gain;
    lossSum += loss;
    if (i > period) {
      gainSum -= gains[i - period]!;
      lossSum -= losses[i - period]!;
    }
    if (i < period) {
      result[i] = 50;
      continue;
    }
    const avgGain = gainSum / period;
    const avgLoss = lossSum / period;
    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      result[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return result;
}

function computeEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i] ?? 0);
    } else {
      const prev = result[i - 1] ?? 0;
      result.push(((data[i] ?? 0) - prev) * multiplier + prev);
    }
  }
  return result;
}

function computeMACDHistogram(data: number[]): number[] {
  const fast = computeEMA(data, 12);
  const slow = computeEMA(data, 26);
  const dif = fast.map((f, i) => f - (slow[i] ?? 0));
  const signal = computeEMA(dif, 9);
  return dif.map((d, i) => (d - (signal[i] ?? 0)) * 2);
}

function computeBollinger(
  data: number[],
  period: number,
  stdDevMult: number,
): { upper: number[]; lower: number[] } {
  const middle = computeSMA(data, period);
  const upper: number[] = new Array(data.length);
  const lower: number[] = new Array(data.length);
  let windowSum = 0;
  let windowSumSq = 0;

  for (let i = 0; i < data.length; i++) {
    const val = data[i]!;
    windowSum += val;
    windowSumSq += val * val;
    if (i >= period) {
      const old = data[i - period]!;
      windowSum -= old;
      windowSumSq -= old * old;
    }
    if (i < period - 1) {
      upper[i] = NaN;
      lower[i] = NaN;
    } else {
      const mean = middle[i]!;
      const variance = windowSumSq / period - (windowSum / period) ** 2;
      const std = Math.sqrt(Math.max(0, variance));
      upper[i] = mean + stdDevMult * std;
      lower[i] = mean - stdDevMult * std;
    }
  }
  return { upper, lower };
}

// =============================================================================
// MARKET RULES
// =============================================================================

function getCircuitBreakerLimits(symbol: string): { limitUp: number; limitDown: number } {
  const s = symbol.replace(/\D/g, "");
  if (s.startsWith("688")) return { limitUp: 1.20, limitDown: 0.80 };
  if (s.startsWith("300") || s.startsWith("301")) return { limitUp: 1.20, limitDown: 0.80 };
  if (s.startsWith("8") || s.startsWith("4") || s.startsWith("9")) return { limitUp: 1.30, limitDown: 0.70 };
  return { limitUp: 1.10, limitDown: 0.90 };
}

function getLimitUp(symbol: string, prevClose: number): number {
  return prevClose * getCircuitBreakerLimits(symbol).limitUp;
}

function getLimitDown(symbol: string, prevClose: number): number {
  return prevClose * getCircuitBreakerLimits(symbol).limitDown;
}

// =============================================================================
// SECTOR BUDGET
// =============================================================================

/**
 * Compute how much additional capital can be allocated to a given sector,
 * respecting the maxSectorPct limit.
 */
function computeSectorBudget(
  sector: string,
  states: Map<string, StockSimulationState>,
  maxSectorPct: number,
  totalCapital: number,
  stockKlines: Map<string, BacktestKline[]>,
  date: string,
  stockDateIndex: Map<string, Map<string, number>>,
): Decimal {
  const maxSectorValue = new Decimal(totalCapital).mul(maxSectorPct);
  let currentSectorValue = new Decimal(0);

  states.forEach((state) => {
    if (state.sector !== sector || state.quantity <= 0) return;

    // Value this position at today's close
    const klines = stockKlines.get(state.symbol);
    const dateIdx = stockDateIndex.get(state.symbol)?.get(date);
    if (klines && dateIdx !== undefined) {
      const closePrice = klines[dateIdx]!.close;
      currentSectorValue = currentSectorValue.plus(
        new Decimal(state.quantity).mul(closePrice),
      );
    }
  });

  const remaining = maxSectorValue.minus(currentSectorValue);
  return Decimal.max(remaining, 0);
}

// =============================================================================
// AGGREGATE METRICS HELPERS
// =============================================================================

function computeStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  let sumSq = 0;
  for (const v of values) {
    sumSq += (v - mean) ** 2;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

function computeSectorAllocation(
  stockResults: PortfolioStockResult[],
): SectorAllocationEntry[] {
  const sectorMap = new Map<string, { totalWeight: number; totalReturn: number }>();

  for (const result of stockResults) {
    const sector = result.sector ?? "unknown";
    const existing = sectorMap.get(sector);
    if (existing) {
      existing.totalWeight += result.actualWeight;
      existing.totalReturn += result.contribution;
    } else {
      sectorMap.set(sector, {
        totalWeight: result.actualWeight,
        totalReturn: result.contribution,
      });
    }
  }

  return Array.from(sectorMap.entries()).map(([sector, data]) => ({
    sector,
    weight: data.totalWeight,
    returnPct: data.totalReturn,
  }));
}

/**
 * Herfindahl-Hirschman Index: sum of squared weights.
 * Range: 1/N (perfectly diversified) to 1 (concentrated in one stock).
 */
function computeHHI(stockResults: PortfolioStockResult[]): number {
  const tradedResults = stockResults.filter((s) => s.status === "traded");
  if (tradedResults.length === 0) return 0;

  let hhi = 0;
  for (const result of tradedResults) {
    hhi += result.actualWeight ** 2;
  }
  return hhi;
}

/**
 * Simplified correlation/diversification score.
 * Lower score means more diversified (more unique sectors, lower concentration).
 */
function computeCorrelationScore(stockResults: PortfolioStockResult[]): number {
  const tradedResults = stockResults.filter((s) => s.status === "traded");
  if (tradedResults.length <= 1) return 1;

  // Use sector diversity as a proxy for correlation
  const sectors = new Set(tradedResults.map((s) => s.sector ?? "unknown"));
  const sectorDiversity = sectors.size / tradedResults.length;

  // Combine with HHI (normalized)
  const hhi = computeHHI(stockResults);
  const minHHI = 1 / tradedResults.length;
  const normalizedHHI = tradedResults.length > 1
    ? (hhi - minHHI) / (1 - minHHI)
    : 1;

  // Score: weighted average of concentration and sector overlap
  return Math.max(0, Math.min(1, normalizedHHI * 0.5 + (1 - sectorDiversity) * 0.5));
}

// =============================================================================
// UTILITY
// =============================================================================

function toDateString(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toISOString().split("T")[0] ?? "";
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(b - a) / 86400000;
}

function validateConfig(config: PortfolioConfig): void {
  if (config.totalCapital <= 0) {
    throw new Error("Total capital must be positive");
  }
  if (config.stocks.length < 2) {
    throw new Error("Portfolio must contain at least 2 stocks");
  }
  if (config.stocks.length > 100) {
    throw new Error("Portfolio cannot exceed 100 stocks");
  }
  if (!config.strategy || config.strategy.trim().length === 0) {
    throw new Error("Strategy code is required");
  }
  if (config.maxPositionPct <= 0 || config.maxPositionPct > 1) {
    throw new Error("maxPositionPct must be between 0 and 1 (exclusive of 0)");
  }
  if (config.maxSectorPct <= 0 || config.maxSectorPct > 1) {
    throw new Error("maxSectorPct must be between 0 and 1 (exclusive of 0)");
  }
  if (config.commission < 0) {
    throw new Error("Commission rate cannot be negative");
  }
  if (config.slippage < 0) {
    throw new Error("Slippage rate cannot be negative");
  }

  const start = new Date(config.startDate);
  const end = new Date(config.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date format. Use ISO date strings (YYYY-MM-DD).");
  }
  if (start >= end) {
    throw new Error("startDate must be before endDate");
  }
}
