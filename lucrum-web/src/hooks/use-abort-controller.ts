'use client';

import { useEffect, useRef, useCallback } from 'react';

// =============================================================================
// useAbortController
// =============================================================================

/**
 * Returns a function that creates an AbortSignal.
 * The previous signal is automatically aborted when:
 * - The component unmounts
 * - createSignal() is called again (new request supersedes old)
 *
 * This prevents race conditions when user navigates away mid-request
 * or triggers a new request before the old one completes.
 *
 * Usage:
 *   const createSignal = useAbortController()
 *   const signal = createSignal()
 *   await fetch(url, { signal })
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  const createSignal = useCallback((): AbortSignal => {
    // Abort any previous in-flight request
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);

  // Cleanup on unmount — abort any pending request
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return createSignal;
}
