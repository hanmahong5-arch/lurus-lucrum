"use client";

/**
 * useAdvisorPreferences Hook
 *
 * Manages user preferences for the investment advisor system
 * Persists to localStorage with automatic sync
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  AdvisorContext,
  ChatMode,
  SavedAdvisorPreferences,
  ProactiveAlert,
} from '@/lib/advisor/agent/types';
import { getDefaultAdvisorContext, normalizeContext } from '@/lib/advisor/context-builder';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'lucrum_advisor_preferences';
const ALERTS_STORAGE_KEY = 'lucrum_advisor_alerts';

// ============================================================================
// Types
// ============================================================================

interface UseAdvisorPreferencesReturn {
  // Context
  context: AdvisorContext;
  setContext: (context: AdvisorContext) => void;
  updateContext: (partial: Partial<AdvisorContext>) => void;
  resetContext: () => void;

  // Chat Mode
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;

  // Watchlist
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;

  // Alerts
  alerts: ProactiveAlert[];
  addAlert: (alert: ProactiveAlert) => void;
  markAlertRead: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  unreadCount: number;

  // Persistence
  isLoaded: boolean;
  savePreferences: () => void;
}

// ============================================================================
// Default Preferences
// ============================================================================

function getDefaultPreferences(): SavedAdvisorPreferences {
  return {
    defaultContext: getDefaultAdvisorContext(),
    notificationPrefs: {
      channels: ['in_app'],
      frequency: 'realtime',
      alertTypes: [
        'price_breakout',
        'volume_surge',
        'technical_signal',
        'risk_warning',
        'opportunity',
      ],
    },
    watchlist: [],
    feedbackHistory: [],
    lastUpdated: new Date(),
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAdvisorPreferences(): UseAdvisorPreferencesReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [preferences, setPreferences] = useState<SavedAdvisorPreferences>(getDefaultPreferences);
  const [context, setContextState] = useState<AdvisorContext>(getDefaultAdvisorContext);
  const [chatMode, setChatModeState] = useState<ChatMode>('deep');
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);

  // -------------------------------------------------------------------------
  // Load from localStorage
  // -------------------------------------------------------------------------

  useEffect(() => {
    try {
      // Load preferences
      const savedPrefs = localStorage.getItem(STORAGE_KEY);
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs) as SavedAdvisorPreferences;
        setPreferences(parsed);
        setContextState(normalizeContext(parsed.defaultContext));
      }

      // Load alerts
      const savedAlerts = localStorage.getItem(ALERTS_STORAGE_KEY);
      if (savedAlerts) {
        const parsedAlerts = JSON.parse(savedAlerts) as ProactiveAlert[];
        // Convert date strings back to Date objects
        const hydratedAlerts = parsedAlerts.map(a => ({
          ...a,
          timestamp: new Date(a.timestamp),
          expiresAt: a.expiresAt ? new Date(a.expiresAt) : undefined,
        }));
        // Filter expired alerts
        const now = new Date();
        const validAlerts = hydratedAlerts.filter(
          a => !a.expiresAt || a.expiresAt > now
        );
        setAlerts(validAlerts);
      }
    } catch (error) {
      console.error('Failed to load advisor preferences:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Save to localStorage
  // -------------------------------------------------------------------------

  const savePreferences = useCallback(() => {
    try {
      const toSave: SavedAdvisorPreferences = {
        ...preferences,
        defaultContext: context,
        lastUpdated: new Date(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save advisor preferences:', error);
    }
  }, [preferences, context]);

  const saveAlerts = useCallback(() => {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }, [alerts]);

  // Auto-save on changes
  useEffect(() => {
    if (isLoaded) {
      savePreferences();
    }
  }, [context, preferences.watchlist, isLoaded, savePreferences]);

  useEffect(() => {
    if (isLoaded) {
      saveAlerts();
    }
  }, [alerts, isLoaded, saveAlerts]);

  // -------------------------------------------------------------------------
  // Context Management
  // -------------------------------------------------------------------------

  const setContext = useCallback((newContext: AdvisorContext) => {
    setContextState(normalizeContext(newContext));
  }, []);

  const updateContext = useCallback((partial: Partial<AdvisorContext>) => {
    setContextState(prev => normalizeContext({ ...prev, ...partial }));
  }, []);

  const resetContext = useCallback(() => {
    setContextState(getDefaultAdvisorContext());
  }, []);

  // -------------------------------------------------------------------------
  // Chat Mode
  // -------------------------------------------------------------------------

  const setChatMode = useCallback((mode: ChatMode) => {
    setChatModeState(mode);
  }, []);

  // -------------------------------------------------------------------------
  // Watchlist Management
  // -------------------------------------------------------------------------

  const addToWatchlist = useCallback((symbol: string) => {
    setPreferences(prev => ({
      ...prev,
      watchlist: prev.watchlist.includes(symbol)
        ? prev.watchlist
        : [...prev.watchlist, symbol],
    }));
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setPreferences(prev => ({
      ...prev,
      watchlist: prev.watchlist.filter(s => s !== symbol),
    }));
  }, []);

  const isInWatchlist = useCallback(
    (symbol: string) => preferences.watchlist.includes(symbol),
    [preferences.watchlist]
  );

  // -------------------------------------------------------------------------
  // Alert Management
  // -------------------------------------------------------------------------

  const addAlert = useCallback((alert: ProactiveAlert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 50)); // Keep max 50 alerts
  }, []);

  const markAlertRead = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(a => (a.id === alertId ? { ...a, read: true } : a))
    );
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // Context
    context,
    setContext,
    updateContext,
    resetContext,

    // Chat Mode
    chatMode,
    setChatMode,

    // Watchlist
    watchlist: preferences.watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,

    // Alerts
    alerts,
    addAlert,
    markAlertRead,
    dismissAlert,
    clearAllAlerts,
    unreadCount,

    // Persistence
    isLoaded,
    savePreferences,
  };
}

export default useAdvisorPreferences;
