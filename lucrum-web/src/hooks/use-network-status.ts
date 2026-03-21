'use client';

/**
 * Monitors network connectivity via navigator.onLine events + periodic ping.
 *
 * Returns:
 * - isOnline: current connectivity state
 * - wasOffline: true if the session experienced an offline period (sticky)
 * - justReconnected: true for 3 seconds after coming back online
 *
 * The periodic ping (every 30s when online) catches edge cases where
 * the browser reports online but actual connectivity is lost.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Constants
// =============================================================================

/** Interval between connectivity pings (ms) */
const PING_INTERVAL_MS = 30_000;

/** Timeout for each ping request (ms) */
const PING_TIMEOUT_MS = 5_000;

/** Duration to show "just reconnected" banner (ms) */
const RECONNECT_DISPLAY_MS = 3_000;

// =============================================================================
// Types
// =============================================================================

export interface NetworkStatus {
  /** Current connectivity state */
  isOnline: boolean;
  /** True if the user was offline at any point during this session */
  wasOffline: boolean;
  /** True for a few seconds after reconnection */
  justReconnected: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const markOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
    wasOfflineRef.current = true;
  }, []);

  const markOnline = useCallback(() => {
    setIsOnline(true);
    if (wasOfflineRef.current) {
      setJustReconnected(true);
      wasOfflineRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        setJustReconnected(false);
      }, RECONNECT_DISPLAY_MS);
    }
  }, []);

  // Periodic ping to verify actual connectivity
  const performPing = useCallback(async () => {
    // Only ping when browser says we are online
    if (!navigator.onLine) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

      // HEAD request to own origin; lightweight and avoids CORS issues
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        markOnline();
      } else {
        markOffline();
      }
    } catch {
      // Network error or timeout => treat as offline
      markOffline();
    }
  }, [markOnline, markOffline]);

  useEffect(() => {
    // Set initial state from browser API
    if (!navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
      wasOfflineRef.current = true;
    }

    const handleOnline = () => markOnline();
    const handleOffline = () => markOffline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start periodic ping
    pingIntervalRef.current = setInterval(performPing, PING_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [markOnline, markOffline, performPing]);

  return { isOnline, wasOffline, justReconnected };
}
