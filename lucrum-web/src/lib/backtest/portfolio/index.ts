/**
 * Portfolio Backtest Module
 *
 * Exports the portfolio-level backtest engine, types, and position sizing.
 *
 * @module lib/backtest/portfolio
 */

export { runPortfolioBacktest } from "./engine";
export type { KlineProvider } from "./engine";

export {
  calculateTargetWeights,
  calculateVolatility,
} from "./position-sizing";

export type {
  PortfolioConfig,
  PortfolioStock,
  PortfolioBacktestResult,
  PortfolioStockResult,
  PortfolioTrade,
  PortfolioEquityPoint,
  PortfolioProgress,
  PositionSizingMethod,
  SectorAllocationEntry,
  StockSimulationState,
  RankedBuySignal,
} from "./types";
