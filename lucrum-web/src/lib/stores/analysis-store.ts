/**
 * Analysis Store
 *
 * Persists market analysis and scanner state across page navigation:
 * - Active analysis tab
 * - Scanner configuration
 * - Last scan results
 * - Selected sectors
 * - Diagnostic results
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:analysis`
 *
 * @module lib/stores/analysis-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Types
// =============================================================================

export type AnalysisTab = 'scanner' | 'diagnostics' | 'sectors' | 'overview';

export interface ScannerConfig {
  /** Minimum score threshold (0-100) */
  minScore: number;
  /** Selected strategy template ID */
  strategyTemplateId: string | null;
  /** Maximum number of results to return */
  maxResults: number;
  /** Time period for analysis (e.g., "1y", "6m", "3m") */
  period: string;
  /** Sort field */
  sortBy: 'score' | 'totalReturn' | 'sharpeRatio' | 'winRate';
  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

export interface ScanResultEntry {
  /** Stock symbol code */
  symbol: string;
  /** Stock display name */
  name: string;
  /** Sector / industry */
  sector: string;
  /** Composite score 0-100 */
  score: number;
  /** Grade S/A/B/C/D */
  grade: string;
  /** Total return as decimal */
  totalReturn: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Win rate as decimal */
  winRate: number;
  /** Max drawdown as decimal */
  maxDrawdown: number;
}

export interface DiagnosticResult {
  /** Diagnostic check name */
  name: string;
  /** Status of the check */
  status: 'pass' | 'warn' | 'fail';
  /** Human-readable description */
  message: string;
  /** Optional numeric value */
  value?: number;
}

export interface AnalysisState {
  /** Active tab in the analysis page */
  activeTab: AnalysisTab;
  /** Scanner configuration */
  scannerConfig: ScannerConfig;
  /** Last scan results */
  scanResults: ScanResultEntry[];
  /** Selected sector names */
  selectedSectors: string[];
  /** Last diagnostic results */
  diagnosticResults: DiagnosticResult[];
  /** Timestamp of last scan (ms) */
  lastScanAt: number | null;

  // Transient state (not persisted)
  /** Whether a scan is currently running */
  isScanning: boolean;
  /** Error message from last scan */
  error: string | null;
}

interface AnalysisActions {
  setActiveTab: (tab: AnalysisTab) => void;
  updateScannerConfig: (patch: Partial<ScannerConfig>) => void;
  resetScannerConfig: () => void;
  setScanResults: (results: ScanResultEntry[]) => void;
  clearScanResults: () => void;
  setSelectedSectors: (sectors: string[]) => void;
  toggleSector: (sector: string) => void;
  clearSectors: () => void;
  setDiagnosticResults: (results: DiagnosticResult[]) => void;
  clearDiagnosticResults: () => void;
  setScanning: (scanning: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type AnalysisStore = AnalysisState & AnalysisActions & HydrationState;

// =============================================================================
// Initial State
// =============================================================================

const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  minScore: 60,
  strategyTemplateId: null,
  maxResults: 50,
  period: '1y',
  sortBy: 'score',
  sortOrder: 'desc',
};

const INITIAL_STATE: AnalysisState = {
  activeTab: 'scanner',
  scannerConfig: { ...DEFAULT_SCANNER_CONFIG },
  scanResults: [],
  selectedSectors: [],
  diagnosticResults: [],
  lastScanAt: null,
  isScanning: false,
  error: null,
};

// =============================================================================
// Store
// =============================================================================

export const useAnalysisStore = createPersistedStore<AnalysisStore>(
  'analysis',
  (set) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    updateScannerConfig: (patch) =>
      set((state) => {
        Object.assign(state.scannerConfig, patch);
      }),

    resetScannerConfig: () =>
      set((state) => {
        state.scannerConfig = { ...DEFAULT_SCANNER_CONFIG };
      }),

    setScanResults: (results) =>
      set((state) => {
        state.scanResults = results;
        state.lastScanAt = Date.now();
      }),

    clearScanResults: () =>
      set((state) => {
        state.scanResults = [];
        state.lastScanAt = null;
      }),

    setSelectedSectors: (sectors) =>
      set((state) => {
        state.selectedSectors = sectors;
      }),

    toggleSector: (sector) =>
      set((state) => {
        const idx = state.selectedSectors.indexOf(sector);
        if (idx >= 0) {
          state.selectedSectors.splice(idx, 1);
        } else {
          state.selectedSectors.push(sector);
        }
      }),

    clearSectors: () =>
      set((state) => {
        state.selectedSectors = [];
      }),

    setDiagnosticResults: (results) =>
      set((state) => {
        state.diagnosticResults = results;
      }),

    clearDiagnosticResults: () =>
      set((state) => {
        state.diagnosticResults = [];
      }),

    setScanning: (scanning) =>
      set((state) => {
        state.isScanning = scanning;
        if (scanning) {
          state.error = null;
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isScanning = false;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
      }),
  }),
  {
    version: 1,
    partialize: (state) => ({
      activeTab: state.activeTab,
      scannerConfig: state.scannerConfig,
      scanResults: state.scanResults,
      selectedSectors: state.selectedSectors,
      diagnosticResults: state.diagnosticResults,
      lastScanAt: state.lastScanAt,
    }) as typeof state,
  }
);

// =============================================================================
// Selectors
// =============================================================================

export const selectAnalysisActiveTab = (state: AnalysisStore) => state.activeTab;
export const selectScannerConfig = (state: AnalysisStore) => state.scannerConfig;
export const selectScanResults = (state: AnalysisStore) => state.scanResults;
export const selectSelectedSectors = (state: AnalysisStore) => state.selectedSectors;
export const selectDiagnosticResults = (state: AnalysisStore) => state.diagnosticResults;
export const selectIsScanning = (state: AnalysisStore) => state.isScanning;
export const selectAnalysisError = (state: AnalysisStore) => state.error;
export const selectScanResultCount = (state: AnalysisStore) => state.scanResults.length;
