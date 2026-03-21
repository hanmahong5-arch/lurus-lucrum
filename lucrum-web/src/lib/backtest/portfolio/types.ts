/**
 * Portfolio Backtest Types
 *
 * Type definitions for the portfolio-level backtest engine that applies
 * ONE strategy across multiple stocks with a shared capital pool.
 *
 * @module lib/backtest/portfolio/types
 */

// =============================================================================
// POSITION SIZING / 仓位分配
// =============================================================================

/**
 * Position sizing method — how to allocate capital across stocks.
 *
 * - equal:       Each stock gets totalCapital / N
 * - market-cap:  Weighted proportionally by market capitalization
 * - risk-parity: Weighted inversely by volatility (less volatile = larger allocation)
 * - custom:      User supplies explicit weights per symbol
 */
export type PositionSizingMethod =
  | "equal"
  | "market-cap"
  | "risk-parity"
  | "custom";

// =============================================================================
// CONFIGURATION / 配置
// =============================================================================

/**
 * Portfolio backtest configuration — the input users provide.
 */
export interface PortfolioConfig {
  /** Total capital pool in CNY (e.g., 1_000_000) */
  totalCapital: number;

  /** Stocks to include (2-100) */
  stocks: PortfolioStock[];

  /** Strategy code (applied to ALL stocks) */
  strategy: string;

  /** Strategy parameters (merged into strategy context) */
  strategyParams: Record<string, unknown>;

  /** How to distribute capital across stocks */
  positionSizing: PositionSizingMethod;

  /** Symbol-to-weight map for 'custom' sizing (values 0-1, sum <= 1) */
  customWeights?: Record<string, number>;

  /** Maximum allocation per individual stock (e.g., 0.10 = 10%) */
  maxPositionPct: number;

  /** Maximum allocation per sector (e.g., 0.30 = 30%) */
  maxSectorPct: number;

  /** How often to re-calculate target weights */
  rebalanceFrequency: "never" | "monthly" | "quarterly";

  /** ISO date string for backtest start */
  startDate: string;

  /** ISO date string for backtest end */
  endDate: string;

  /** Commission rate (e.g., 0.0003 = 0.03%) */
  commission: number;

  /** Slippage rate (e.g., 0.001 = 0.1%) */
  slippage: number;
}

/**
 * A single stock in the portfolio input.
 */
export interface PortfolioStock {
  /** Stock code (e.g., "600519") */
  symbol: string;

  /** Display name (e.g., "Kweichow Moutai") */
  name: string;

  /** Sector classification for sector-cap enforcement */
  sector?: string;

  /** Market capitalization in CNY — used by 'market-cap' sizing */
  marketCap?: number;

  /** Explicit weight (0-1) — used by 'custom' sizing */
  customWeight?: number;
}

// =============================================================================
// RESULTS / 结果
// =============================================================================

/**
 * Portfolio-level backtest result — the main output users see.
 */
export interface PortfolioBacktestResult {
  // -- Aggregate metrics --

  /** Overall portfolio return as percentage */
  totalReturn: number;

  /** Compound annualized return as percentage */
  annualizedReturn: number;

  /** Maximum peak-to-trough drawdown as percentage (positive number) */
  maxDrawdown: number;

  /** Annualized Sharpe ratio */
  portfolioSharpe: number;

  /** Annualized Sortino ratio */
  portfolioSortino: number;

  // -- Equity curve (combined) --

  /** Daily portfolio value snapshots */
  equityCurve: PortfolioEquityPoint[];

  // -- Per-stock breakdown --

  /** Individual stock outcomes */
  stockResults: PortfolioStockResult[];

  // -- Diversification metrics --

  diversification: {
    /** Weight and return per sector */
    sectorAllocation: SectorAllocationEntry[];

    /** Effective diversification score 0-1 (lower = more diversified) */
    correlationScore: number;

    /** Number of stocks that actually traded (had at least one buy) */
    effectiveStocks: number;

    /** Herfindahl-Hirschman index of allocated weights (lower = more diversified) */
    concentrationIndex: number;
  };

  // -- Position history --

  /** All trades across all stocks, chronologically ordered */
  allTrades: PortfolioTrade[];

  // -- Configuration snapshot --

  /** The config that produced this result */
  config: PortfolioConfig;

  // -- Execution metadata --

  /** Wall-clock execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * A single point on the combined portfolio equity curve.
 */
export interface PortfolioEquityPoint {
  /** ISO date string */
  date: string;

  /** Total portfolio value (cash + all position values) */
  value: number;

  /** Current drawdown as percentage (positive number) */
  drawdown: number;

  /** Cash balance at end of day */
  cash: number;

  /** Number of stocks held at end of day */
  positionsHeld: number;
}

/**
 * Sector allocation entry for diversification display.
 */
export interface SectorAllocationEntry {
  sector: string;
  weight: number;
  returnPct: number;
}

/**
 * Per-stock result in the portfolio backtest.
 */
export interface PortfolioStockResult {
  symbol: string;
  name: string;
  sector?: string;

  /** Capital allocated to this stock by the sizing algorithm */
  allocatedCapital: number;

  /** Actual weight in portfolio based on allocation */
  actualWeight: number;

  /** Number of completed round-trip trades */
  trades: number;

  /** Return percentage for this stock's sub-portfolio */
  returnPct: number;

  /** Absolute contribution to total portfolio return */
  contribution: number;

  /** Outcome status */
  status: "traded" | "no-signal" | "insufficient-capital" | "data-error";
}

/**
 * A single trade in the portfolio-level trade log.
 */
export interface PortfolioTrade {
  /** ISO date string */
  date: string;

  /** Stock code */
  symbol: string;

  /** Stock display name */
  symbolName: string;

  /** Buy or sell */
  type: "buy" | "sell";

  /** Number of shares traded */
  quantity: number;

  /** Execution price (after slippage) */
  price: number;

  /** Number of round lots */
  lots: number;

  /** Total cost of this trade (quantity * price + fees) for buy, or proceeds for sell */
  cost: number;

  /** Portfolio cash balance before this trade */
  cashBefore: number;

  /** Portfolio cash balance after this trade */
  cashAfter: number;

  /** Human-readable trigger reason */
  reason: string;
}

// =============================================================================
// ENGINE INTERNALS / 引擎内部类型
// =============================================================================

/**
 * Internal: per-stock state tracked during simulation.
 */
export interface StockSimulationState {
  symbol: string;
  name: string;
  sector: string;

  /** Target weight from position sizing */
  targetWeight: number;

  /** Current held quantity (0 = no position) */
  quantity: number;

  /** Average entry price (for PnL calculation) */
  entryPrice: number;

  /** ISO date of entry (for T+1 enforcement) */
  entryDate: string;

  /** Total capital allocated to this stock through trades */
  totalInvested: number;

  /** Total capital returned from this stock through sells */
  totalReturned: number;

  /** Number of completed sell trades */
  completedTrades: number;

  /** Whether we attempted but failed to get data */
  dataError: boolean;
}

/**
 * Internal: a buy signal with priority for cross-stock ranking.
 */
export interface RankedBuySignal {
  symbol: string;
  signalStrength: number;
  targetWeight: number;
  price: number;
  reason: string;
}

/**
 * Progress callback payload for SSE streaming.
 */
export interface PortfolioProgress {
  phase: "init" | "loading-data" | "computing" | "finalizing";
  progress: number;
  message: string;
  currentDay?: string;
  totalDays?: number;
  processedDays?: number;
}
