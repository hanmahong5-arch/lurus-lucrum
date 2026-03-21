/**
 * User Preferences Store
 *
 * Persists user-configurable preferences across sessions:
 * - Theme preference
 * - Default backtest capital and commission
 * - Preferred timeframe
 * - Notification preferences
 * - UI density (compact / comfortable)
 * - Active navigation tab
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:user-preferences`
 *
 * @module lib/stores/user-preferences-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Types
// =============================================================================

export type ThemePreference = 'dark' | 'light' | 'system';
export type UIDensity = 'compact' | 'comfortable';
export type Timeframe = '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | '5y';

export interface NotificationPreferences {
  /** Show desktop notifications for completed backtests */
  backtestComplete: boolean;
  /** Show notifications for price alerts */
  priceAlerts: boolean;
  /** Show notifications for scan results */
  scanComplete: boolean;
  /** Show notifications for advisor responses */
  advisorResponse: boolean;
}

export type NavTab =
  | 'strategy'
  | 'validation'
  | 'scanner'
  | 'advisor'
  | 'history'
  | 'trading'
  | 'insights'
  | 'diagnostics'
  | 'settings';

export interface UserPreferencesState {
  /** Theme preference */
  theme: ThemePreference;
  /** Default initial capital for backtests (CNY) */
  defaultCapital: number;
  /** Default commission rate */
  defaultCommission: number;
  /** Preferred timeframe for analysis */
  preferredTimeframe: Timeframe;
  /** Notification preferences */
  notifications: NotificationPreferences;
  /** UI density mode */
  density: UIDensity;
  /** Last active navigation tab */
  activeNavTab: NavTab;
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Preferred chart type */
  chartType: 'candlestick' | 'line' | 'area';
  /** Whether to show tutorial hints */
  showHints: boolean;
  /** Last selected template category in the strategy workbench */
  lastTemplateCategory: string;
  /** Default slippage rate */
  defaultSlippage: number;
  /** Preferred backtest timeframe (K-line period) */
  preferredBacktestTimeframe: '1d' | '1w' | '60m' | '30m' | '15m' | '5m' | '1m';
  /** Split panel ratio (left panel width percentage) */
  splitPanelRatio: number;
  /** Whether the user has completed the first-time onboarding flow */
  hasCompletedOnboarding: boolean;
}

interface UserPreferencesActions {
  setTheme: (theme: ThemePreference) => void;
  setDefaultCapital: (capital: number) => void;
  setDefaultCommission: (commission: number) => void;
  setPreferredTimeframe: (timeframe: Timeframe) => void;
  updateNotifications: (patch: Partial<NotificationPreferences>) => void;
  setDensity: (density: UIDensity) => void;
  setActiveNavTab: (tab: NavTab) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChartType: (type: 'candlestick' | 'line' | 'area') => void;
  setShowHints: (show: boolean) => void;
  setLastTemplateCategory: (category: string) => void;
  setDefaultSlippage: (slippage: number) => void;
  setPreferredBacktestTimeframe: (tf: '1d' | '1w' | '60m' | '30m' | '15m' | '5m' | '1m') => void;
  setSplitPanelRatio: (ratio: number) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  reset: () => void;
}

export type UserPreferencesStore = UserPreferencesState & UserPreferencesActions & HydrationState;

// =============================================================================
// Initial State
// =============================================================================

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  backtestComplete: true,
  priceAlerts: true,
  scanComplete: true,
  advisorResponse: false,
};

const INITIAL_STATE: UserPreferencesState = {
  theme: 'dark',
  defaultCapital: 100000,
  defaultCommission: 0.0003,
  preferredTimeframe: '1y',
  notifications: { ...DEFAULT_NOTIFICATIONS },
  density: 'comfortable',
  activeNavTab: 'strategy',
  sidebarCollapsed: false,
  chartType: 'candlestick',
  showHints: true,
  lastTemplateCategory: 'all',
  defaultSlippage: 0.001,
  preferredBacktestTimeframe: '1d',
  splitPanelRatio: 50,
  hasCompletedOnboarding: false,
};

// =============================================================================
// Store
// =============================================================================

export const useUserPreferencesStore = createPersistedStore<UserPreferencesStore>(
  'user-preferences',
  (set) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme;
      }),

    setDefaultCapital: (capital) =>
      set((state) => {
        state.defaultCapital = Math.max(0, capital);
      }),

    setDefaultCommission: (commission) =>
      set((state) => {
        state.defaultCommission = Math.max(0, Math.min(0.01, commission));
      }),

    setPreferredTimeframe: (timeframe) =>
      set((state) => {
        state.preferredTimeframe = timeframe;
      }),

    updateNotifications: (patch) =>
      set((state) => {
        Object.assign(state.notifications, patch);
      }),

    setDensity: (density) =>
      set((state) => {
        state.density = density;
      }),

    setActiveNavTab: (tab) =>
      set((state) => {
        state.activeNavTab = tab;
      }),

    setSidebarCollapsed: (collapsed) =>
      set((state) => {
        state.sidebarCollapsed = collapsed;
      }),

    setChartType: (type) =>
      set((state) => {
        state.chartType = type;
      }),

    setShowHints: (show) =>
      set((state) => {
        state.showHints = show;
      }),

    setLastTemplateCategory: (category) =>
      set((state) => {
        state.lastTemplateCategory = category;
      }),

    setDefaultSlippage: (slippage) =>
      set((state) => {
        state.defaultSlippage = Math.max(0, Math.min(0.01, slippage));
      }),

    setPreferredBacktestTimeframe: (tf) =>
      set((state) => {
        state.preferredBacktestTimeframe = tf;
      }),

    setSplitPanelRatio: (ratio) =>
      set((state) => {
        state.splitPanelRatio = Math.max(25, Math.min(75, ratio));
      }),

    setHasCompletedOnboarding: (value) =>
      set((state) => {
        state.hasCompletedOnboarding = value;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
      }),
  }),
  {
    version: 2,
    // Persist everything (all state is user preference, no transient fields)
    partialize: (state) => ({
      theme: state.theme,
      defaultCapital: state.defaultCapital,
      defaultCommission: state.defaultCommission,
      preferredTimeframe: state.preferredTimeframe,
      notifications: state.notifications,
      density: state.density,
      activeNavTab: state.activeNavTab,
      sidebarCollapsed: state.sidebarCollapsed,
      chartType: state.chartType,
      showHints: state.showHints,
      lastTemplateCategory: state.lastTemplateCategory,
      defaultSlippage: state.defaultSlippage,
      preferredBacktestTimeframe: state.preferredBacktestTimeframe,
      splitPanelRatio: state.splitPanelRatio,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
    }) as typeof state,
    migrate: (persisted: unknown, version: number) => {
      const old = persisted as Partial<UserPreferencesStore>;
      // Version 0 (pre-versioning) -> Version 1: add new fields with defaults
      if (version === 0 || version === 1) {
        return {
          ...INITIAL_STATE,
          ...old,
          // V2: ensure hasCompletedOnboarding exists
          hasCompletedOnboarding: old.hasCompletedOnboarding ?? false,
          _hasHydrated: false,
          _setHasHydrated: () => {},
        } as unknown as UserPreferencesStore & HydrationState;
      }
      return persisted as UserPreferencesStore & HydrationState;
    },
  }
);

// =============================================================================
// Selectors
// =============================================================================

export const selectTheme = (state: UserPreferencesStore) => state.theme;
export const selectDefaultCapital = (state: UserPreferencesStore) => state.defaultCapital;
export const selectDefaultCommission = (state: UserPreferencesStore) => state.defaultCommission;
export const selectPreferredTimeframe = (state: UserPreferencesStore) => state.preferredTimeframe;
export const selectNotificationPrefs = (state: UserPreferencesStore) => state.notifications;
export const selectDensity = (state: UserPreferencesStore) => state.density;
export const selectActiveNavTab = (state: UserPreferencesStore) => state.activeNavTab;
export const selectSidebarCollapsed = (state: UserPreferencesStore) => state.sidebarCollapsed;
export const selectChartType = (state: UserPreferencesStore) => state.chartType;
export const selectShowHints = (state: UserPreferencesStore) => state.showHints;
export const selectLastTemplateCategory = (state: UserPreferencesStore) => state.lastTemplateCategory;
export const selectDefaultSlippage = (state: UserPreferencesStore) => state.defaultSlippage;
export const selectPreferredBacktestTimeframe = (state: UserPreferencesStore) => state.preferredBacktestTimeframe;
export const selectSplitPanelRatio = (state: UserPreferencesStore) => state.splitPanelRatio;
export const selectHasCompletedOnboarding = (state: UserPreferencesStore) => state.hasCompletedOnboarding;
