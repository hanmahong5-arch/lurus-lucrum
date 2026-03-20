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

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
      }),
  }),
  {
    version: 1,
    partialize: (state) => ({
      mode: state.mode,
      targets: state.targets,
      sector: state.sector,
      config: state.config,
      results: state.results,
      activeTab: state.activeTab,
      lastRunAt: state.lastRunAt,
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
