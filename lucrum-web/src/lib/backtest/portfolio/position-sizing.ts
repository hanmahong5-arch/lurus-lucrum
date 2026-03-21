/**
 * Position Sizing Calculator
 *
 * Calculates target weights for each stock based on the chosen method,
 * then clamps by per-stock and per-sector limits. All weights sum to <= 1.0.
 *
 * @module lib/backtest/portfolio/position-sizing
 */

import Decimal from "decimal.js";
import type {
  PortfolioStock,
  PositionSizingMethod,
} from "./types";

// =============================================================================
// PUBLIC API
// =============================================================================

export interface SizingOptions {
  /** Maximum weight for any single stock (e.g., 0.10 = 10%) */
  maxPositionPct: number;

  /** Maximum aggregate weight for any single sector (e.g., 0.30 = 30%) */
  maxSectorPct: number;

  /** Symbol-to-weight map for 'custom' method. Values in [0,1]. */
  customWeights?: Record<string, number>;

  /**
   * Symbol-to-volatility map for 'risk-parity' method.
   * Volatility = annualized standard deviation of daily returns.
   */
  volatilities?: Record<string, number>;
}

/**
 * Calculate target weights for each stock based on the sizing method.
 *
 * Guarantees:
 * - Every weight is in [0, maxPositionPct].
 * - Per-sector sum does not exceed maxSectorPct.
 * - Total sum is <= 1.0 (excess is left as cash reserve).
 *
 * @returns Map of symbol to target weight (0-1).
 */
export function calculateTargetWeights(
  stocks: PortfolioStock[],
  method: PositionSizingMethod,
  options: SizingOptions,
): Map<string, Decimal> {
  if (stocks.length === 0) {
    return new Map();
  }

  // Step 1: compute raw unconstrained weights
  let rawWeights: Map<string, Decimal>;

  switch (method) {
    case "equal":
      rawWeights = computeEqualWeights(stocks);
      break;
    case "market-cap":
      rawWeights = computeMarketCapWeights(stocks);
      break;
    case "risk-parity":
      rawWeights = computeRiskParityWeights(stocks, options.volatilities);
      break;
    case "custom":
      rawWeights = computeCustomWeights(stocks, options.customWeights);
      break;
    default: {
      // Exhaustiveness check
      const _never: never = method;
      throw new Error(`Unknown position sizing method: ${_never}`);
    }
  }

  // Step 2: clamp by per-stock limit
  const maxPos = new Decimal(options.maxPositionPct);
  rawWeights.forEach((weight, symbol) => {
    if (weight.gt(maxPos)) {
      rawWeights.set(symbol, maxPos);
    }
  });

  // Step 3: clamp by per-sector limit
  applySectorCap(stocks, rawWeights, new Decimal(options.maxSectorPct));

  // Step 4: normalize if total exceeds 1.0
  const total = sumWeights(rawWeights);
  if (total.gt(1)) {
    rawWeights.forEach((weight, symbol) => {
      rawWeights.set(symbol, weight.div(total));
    });
  }

  return rawWeights;
}

// =============================================================================
// INTERNAL: SIZING METHODS
// =============================================================================

function computeEqualWeights(stocks: PortfolioStock[]): Map<string, Decimal> {
  const weight = new Decimal(1).div(stocks.length);
  const result = new Map<string, Decimal>();
  for (const stock of stocks) {
    result.set(stock.symbol, weight);
  }
  return result;
}

function computeMarketCapWeights(
  stocks: PortfolioStock[],
): Map<string, Decimal> {
  const result = new Map<string, Decimal>();

  // Sum of all market caps (only those with valid marketCap)
  let totalCap = new Decimal(0);
  const caps = new Map<string, Decimal>();

  for (const stock of stocks) {
    const cap = stock.marketCap && stock.marketCap > 0
      ? new Decimal(stock.marketCap)
      : new Decimal(0);
    caps.set(stock.symbol, cap);
    totalCap = totalCap.plus(cap);
  }

  // If no market-cap data at all, fall back to equal weights
  if (totalCap.isZero()) {
    return computeEqualWeights(stocks);
  }

  for (const stock of stocks) {
    const cap = caps.get(stock.symbol) ?? new Decimal(0);
    result.set(stock.symbol, cap.div(totalCap));
  }

  return result;
}

function computeRiskParityWeights(
  stocks: PortfolioStock[],
  volatilities?: Record<string, number>,
): Map<string, Decimal> {
  const result = new Map<string, Decimal>();

  // Inverse volatility: weight_i = (1/vol_i) / sum(1/vol_j)
  let totalInvVol = new Decimal(0);
  const invVols = new Map<string, Decimal>();

  for (const stock of stocks) {
    const vol = volatilities?.[stock.symbol];
    // If no volatility data, assume moderate volatility of 30%
    const safeVol = vol && vol > 0 ? vol : 0.30;
    const invVol = new Decimal(1).div(safeVol);
    invVols.set(stock.symbol, invVol);
    totalInvVol = totalInvVol.plus(invVol);
  }

  if (totalInvVol.isZero()) {
    return computeEqualWeights(stocks);
  }

  for (const stock of stocks) {
    const invVol = invVols.get(stock.symbol) ?? new Decimal(0);
    result.set(stock.symbol, invVol.div(totalInvVol));
  }

  return result;
}

function computeCustomWeights(
  stocks: PortfolioStock[],
  customWeights?: Record<string, number>,
): Map<string, Decimal> {
  const result = new Map<string, Decimal>();

  if (!customWeights || Object.keys(customWeights).length === 0) {
    // No custom weights provided — fall back to equal
    return computeEqualWeights(stocks);
  }

  // Use customWeight from PortfolioStock or from the weights map.
  // Validation only: clamp individual values to [0, 1].
  // Do NOT normalize here — calculateTargetWeights handles normalization
  // after all constraints (per-stock cap, sector cap) are applied.
  for (const stock of stocks) {
    const w = customWeights[stock.symbol]
      ?? stock.customWeight
      ?? 0;
    const weight = new Decimal(Math.max(0, Math.min(1, w)));
    result.set(stock.symbol, weight);
  }

  return result;
}

// =============================================================================
// INTERNAL: CONSTRAINT ENFORCEMENT
// =============================================================================

/**
 * Enforce per-sector maximum weight.
 * If a sector exceeds the cap, proportionally reduce all stocks in that sector.
 */
function applySectorCap(
  stocks: PortfolioStock[],
  weights: Map<string, Decimal>,
  maxSectorWeight: Decimal,
): void {
  // Group stocks by sector
  const sectorSymbols = new Map<string, string[]>();
  for (const stock of stocks) {
    const sector = stock.sector ?? "unknown";
    const existing = sectorSymbols.get(sector);
    if (existing) {
      existing.push(stock.symbol);
    } else {
      sectorSymbols.set(sector, [stock.symbol]);
    }
  }

  // For each sector, check aggregate and clamp
  sectorSymbols.forEach((symbols) => {
    let sectorTotal = new Decimal(0);
    for (const sym of symbols) {
      sectorTotal = sectorTotal.plus(weights.get(sym) ?? new Decimal(0));
    }

    if (sectorTotal.gt(maxSectorWeight) && sectorTotal.gt(0)) {
      // Scale down proportionally
      const scaleFactor = maxSectorWeight.div(sectorTotal);
      for (const sym of symbols) {
        const current = weights.get(sym) ?? new Decimal(0);
        weights.set(sym, current.mul(scaleFactor));
      }
    }
  });
}

// =============================================================================
// UTILITY
// =============================================================================

function sumWeights(weights: Map<string, Decimal>): Decimal {
  let total = new Decimal(0);
  weights.forEach((w) => {
    total = total.plus(w);
  });
  return total;
}

/**
 * Calculate annualized volatility from daily close prices.
 * Used to pre-compute volatilities for risk-parity sizing.
 *
 * @param closes Array of daily closing prices (at least 2 required)
 * @param tradingDaysPerYear Number of trading days per year (default 250)
 * @returns Annualized volatility as a decimal (e.g., 0.25 = 25%)
 */
export function calculateVolatility(
  closes: number[],
  tradingDaysPerYear: number = 250,
): number {
  if (closes.length < 2) return 0;

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const curr = closes[i]!;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length === 0) return 0;

  // Mean return
  let sum = 0;
  for (const r of returns) {
    sum += r;
  }
  const mean = sum / returns.length;

  // Variance (sample variance with n-1)
  let varianceSum = 0;
  for (const r of returns) {
    varianceSum += (r - mean) ** 2;
  }
  const variance = returns.length > 1
    ? varianceSum / (returns.length - 1)
    : 0;

  // Annualize
  return Math.sqrt(variance * tradingDaysPerYear);
}
