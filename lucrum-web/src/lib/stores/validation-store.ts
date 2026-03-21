/**
 * Validation Store
 *
 * Persists strategy validation state across page navigation:
 * - Selected mode (single / multi / sector)
 * - Selected stock targets
 * - Backtest configuration (capital, commission, date range)
 * - Last validation results
 * - Active tab within the validation page
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:validation`
 *
 * @module lib/stores/validation-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Types
// =============================================================================

export type ValidationMode = 'single' | 'multi' | 'sector';

// =============================================================================
// Portfolio Types
// =============================================================================

export type PositionSizingMethod = 'equal' | 'market_cap' | 'risk_parity' | 'custom';
export type RebalanceFrequency = 'none' | 'monthly' | 'quarterly';

export interface PortfolioStock {
  /** Stock symbol code (e.g., "600519") */
  symbol: string;
  /** Stock display name */
  name: string;
  /** Sector / industry classification */
  sector?: string;
  /** Custom weight (0-1), used when sizing method is "custom" */
  customWeight?: number;
}

export interface PortfolioBacktestResult {
  /** Overall portfolio metrics */
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  /** Effective stocks that generated trades vs total selected */
  effectiveStocks: number;
  totalStocks: number;
  /** Total number of trades across all stocks */
  totalTrades: number;
  /** Herfindahl-Hirschman Index for diversification (lower = better, <0.1 ideal) */
  hhi: number;
  /** Average pairwise correlation */
  avgCorrelation: number;
  /** Per-sector contribution breakdown */
  sectorContributions: SectorContribution[];
  /** Per-stock detail rows */
  stockDetails: PortfolioStockDetail[];
  /** Combined equity curve data points (timestamp, value) */
  equityCurve: Array<{ date: string; value: number; benchmark: number }>;
}

export interface SectorContribution {
  /** Sector name */
  sector: string;
  /** Return percentage for this sector slice */
  returnPct: number;
  /** Contribution to total portfolio return (0-1) */
  contributionPct: number;
  /** Number of stocks in this sector */
  stockCount: number;
}

export interface PortfolioStockDetail {
  /** Rank by contribution (1-based) */
  rank: number;
  symbol: string;
  name: string;
  sector: string;
  /** Capital allocated to this stock (CNY) */
  allocation: number;
  /** Return percentage for this stock */
  returnPct: number;
  /** Absolute P&L for this stock (CNY) */
  pnl: number;
  /** Status: traded / no_signal / insufficient_data */
  status: 'traded' | 'no_signal' | 'insufficient_data';
}

export interface ValidationTarget {
  /** Stock symbol code (e.g., "600519") */
  symbol: string;
  /** Stock display name */
  name: string;
}

export interface BacktestConfig {
  /** Initial capital in CNY */
  capital: number;
  /** Commission rate (e.g., 0.0003 for 0.03%) */
  commission: number;
  /** Start date ISO string (YYYY-MM-DD) */
  startDate: string;
  /** End date ISO string (YYYY-MM-DD) */
  endDate: string;
  /** Selected strategy ID */
  strategyId: string;
  /** Holding period in days */
  holdingDays: number;
  /** Exclude ST stocks */
  excludeST: boolean;
  /** Exclude newly listed stocks (< 1 year) */
  excludeNewStocks: boolean;
  /** Min market cap filter in hundred-millions CNY */
  minMarketCap: number;
  /** Max stocks to scan */
  maxStocks: number;
  /** Enable sensitivity analysis */
  sensitivityAnalysis: boolean;
  /** Enable benchmark comparison */
  benchmarkComparison: boolean;
}

export interface SectorSelection {
  /** Sector code (e.g., "BK0420") */
  code: string;
  /** Sector display name */
  name: string;
  /** Sector type */
  type: 'industry' | 'concept';
}

export interface ValidationResultEntry {
  /** Target symbol */
  symbol: string;
  /** Target display name */
  name: string;
  /** Total return as decimal (e.g., 0.235 = 23.5%) */
  totalReturn: number;
  /** Max drawdown as decimal */
  maxDrawdown: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Win rate as decimal */
  winRate: number;
  /** Total trades */
  tradeCount: number;
  /** Score 0-100 */
  score: number;
  /** Grade S/A/B/C/D */
  grade: string;
}

export interface ValidationState {
  /** Current validation mode */
  mode: ValidationMode;
  /** Selected targets for multi-stock validation */
  targets: ValidationTarget[];
  /** Selected sector for sector mode */
  sector: SectorSelection | null;
  /** Backtest configuration */
  config: BacktestConfig;
  /** Last validation results */
  results: ValidationResultEntry[];
  /** Active tab key within the validation page */
  activeTab: string;
  /** Timestamp of last validation run (ms) */
  lastRunAt: number | null;

  // Portfolio mode state
  /** Stocks selected for portfolio backtest */
  portfolioStocks: PortfolioStock[];
  /** Position sizing method */
  positionSizing: PositionSizingMethod;
  /** Max weight per single stock (0-1, default 0.1 = 10%) */
  maxPositionPct: number;
  /** Max weight per single sector (0-1, default 0.3 = 30%) */
  maxSectorPct: number;
  /** Rebalance frequency */
  rebalanceFrequency: RebalanceFrequency;
  /** Portfolio backtest result */
  portfolioResult: PortfolioBacktestResult | null;

  // Transient state (not persisted)
  /** Whether a validation is currently running */
  isRunning: boolean;
  /** Error message if last run failed */
  error: string | null;
}

interface ValidationActions {
  setMode: (mode: ValidationMode) => void;
  addTarget: (target: ValidationTarget) => void;
  removeTarget: (symbol: string) => void;
  setTargets: (targets: ValidationTarget[]) => void;
  clearTargets: () => void;
  setSector: (sector: SectorSelection | null) => void;
  updateConfig: (patch: Partial<BacktestConfig>) => void;
  setResults: (results: ValidationResultEntry[]) => void;
  clearResults: () => void;
  setActiveTab: (tab: string) => void;
  setRunning: (running: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Portfolio actions
  addPortfolioStock: (stock: PortfolioStock) => void;
  removePortfolioStock: (symbol: string) => void;
  setPortfolioStocks: (stocks: PortfolioStock[]) => void;
  clearPortfolioStocks: () => void;
  setPositionSizing: (method: PositionSizingMethod) => void;
  setMaxPositionPct: (pct: number) => void;
  setMaxSectorPct: (pct: number) => void;
  setRebalanceFrequency: (freq: RebalanceFrequency) => void;
  setPortfolioResult: (result: PortfolioBacktestResult | null) => void;
}

export type ValidationStore = ValidationState & ValidationActions & HydrationState;

// =============================================================================
// Initial State
// =============================================================================

const DEFAULT_CONFIG: BacktestConfig = {
  capital: 1000000,
  commission: 0.0003,
  startDate: '',
  endDate: '',
  strategyId: 'macd_golden_cross',
  holdingDays: 5,
  excludeST: true,
  excludeNewStocks: false,
  minMarketCap: 0,
  maxStocks: 50,
  sensitivityAnalysis: false,
  benchmarkComparison: false,
};

const INITIAL_STATE: ValidationState = {
  mode: 'single',
  targets: [],
  sector: null,
  config: { ...DEFAULT_CONFIG },
  results: [],
  activeTab: 'config',
  lastRunAt: null,
  portfolioStocks: [],
  positionSizing: 'equal',
  maxPositionPct: 0.1,
  maxSectorPct: 0.3,
  rebalanceFrequency: 'none',
  portfolioResult: null,
  isRunning: false,
  error: null,
};

// =============================================================================
// Store
// =============================================================================

export const useValidationStore = createPersistedStore<ValidationStore>(
  'validation',
  (set) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),

    addTarget: (target) =>
      set((state) => {
        // Prevent duplicates
        if (!state.targets.some((t) => t.symbol === target.symbol)) {
          state.targets.push(target);
        }
      }),

    removeTarget: (symbol) =>
      set((state) => {
        state.targets = state.targets.filter((t) => t.symbol !== symbol);
      }),

    setTargets: (targets) =>
      set((state) => {
        state.targets = targets;
      }),

    clearTargets: () =>
      set((state) => {
        state.targets = [];
      }),

    setSector: (sector) =>
      set((state) => {
        state.sector = sector;
      }),

    updateConfig: (patch) =>
      set((state) => {
        Object.assign(state.config, patch);
      }),

    setResults: (results) =>
      set((state) => {
        state.results = results;
        state.lastRunAt = Date.now();
      }),

    clearResults: () =>
      set((state) => {
        state.results = [];
        state.lastRunAt = null;
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    setRunning: (running) =>
      set((state) => {
        state.isRunning = running;
        if (running) {
          state.error = null;
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isRunning = false;
      }),

    // Portfolio actions
    addPortfolioStock: (stock) =>
      set((state) => {
        if (!state.portfolioStocks.some((s) => s.symbol === stock.symbol)) {
          state.portfolioStocks.push(stock);
        }
      }),

    removePortfolioStock: (symbol) =>
      set((state) => {
        state.portfolioStocks = state.portfolioStocks.filter((s) => s.symbol !== symbol);
      }),

    setPortfolioStocks: (stocks) =>
      set((state) => {
        state.portfolioStocks = stocks;
      }),

    clearPortfolioStocks: () =>
      set((state) => {
        state.portfolioStocks = [];
        state.portfolioResult = null;
      }),

    setPositionSizing: (method) =>
      set((state) => {
        state.positionSizing = method;
      }),

    setMaxPositionPct: (pct) =>
      set((state) => {
        state.maxPositionPct = Math.max(0.01, Math.min(1, pct));
      }),

    setMaxSectorPct: (pct) =>
      set((state) => {
        state.maxSectorPct = Math.max(0.05, Math.min(1, pct));
      }),

    setRebalanceFrequency: (freq) =>
      set((state) => {
        state.rebalanceFrequency = freq;
      }),

    setPortfolioResult: (result) =>
      set((state) => {
        state.portfolioResult = result;
        if (result) {
          state.lastRunAt = Date.now();
        }
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
      }),
  }),
  {
    version: 2,
    migrate: (persisted: unknown, version: number) => {
      const old = persisted as Record<string, unknown>;
      if (version < 2) {
        // v1->v2: Add portfolio fields with defaults
        return {
          ...old,
          portfolioStocks: old.portfolioStocks ?? [],
          positionSizing: old.positionSizing ?? 'equal',
          maxPositionPct: old.maxPositionPct ?? 0.1,
          maxSectorPct: old.maxSectorPct ?? 0.3,
          rebalanceFrequency: old.rebalanceFrequency ?? 'never',
          portfolioResult: old.portfolioResult ?? null,
        } as ValidationStore;
      }
      return persisted as ValidationStore;
    },
    partialize: (state) => ({
      mode: state.mode,
      targets: state.targets,
      sector: state.sector,
      config: state.config,
      results: state.results,
      activeTab: state.activeTab,
      lastRunAt: state.lastRunAt,
      portfolioStocks: state.portfolioStocks,
      positionSizing: state.positionSizing,
      maxPositionPct: state.maxPositionPct,
      maxSectorPct: state.maxSectorPct,
      rebalanceFrequency: state.rebalanceFrequency,
    }) as typeof state,
  }
);

// =============================================================================
// Selectors
// =============================================================================

export const selectValidationMode = (state: ValidationStore) => state.mode;
export const selectValidationTargets = (state: ValidationStore) => state.targets;
export const selectValidationSector = (state: ValidationStore) => state.sector;
export const selectValidationConfig = (state: ValidationStore) => state.config;
export const selectValidationResults = (state: ValidationStore) => state.results;
export const selectValidationActiveTab = (state: ValidationStore) => state.activeTab;
export const selectValidationIsRunning = (state: ValidationStore) => state.isRunning;
export const selectValidationError = (state: ValidationStore) => state.error;
export const selectTargetCount = (state: ValidationStore) => state.targets.length;

// Portfolio selectors
export const selectPortfolioStocks = (state: ValidationStore) => state.portfolioStocks;
export const selectPortfolioStockCount = (state: ValidationStore) => state.portfolioStocks.length;
export const selectPositionSizing = (state: ValidationStore) => state.positionSizing;
export const selectPortfolioResult = (state: ValidationStore) => state.portfolioResult;
