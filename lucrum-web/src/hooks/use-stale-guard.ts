'use client';

import { useRef, useCallback } from 'react';

// =============================================================================
// useStaleGuard
// =============================================================================

/**
 * Tracks request versions to ignore stale (out-of-order) responses.
 *
 * Problem this solves:
 *   User types "AAPL", then "GOOG". The "AAPL" response arrives AFTER
 *   the "GOOG" response. Without a stale guard, the UI shows "AAPL" data
 *   even though the user last requested "GOOG".
 *
 * Usage:
 *   const { createVersion, isStale } = useStaleGuard()
 *
 *   async function loadData(query: string) {
 *     const version = createVersion()
 *     const data = await fetchData(query)
 *     if (!isStale(version)) {
 *       setResults(data)  // Only apply if this is still the latest request
 *     }
 *   }
 */
export function useStaleGuard() {
  const versionRef = useRef(0);

  /**
   * Increment the version counter and return the new version number.
   * Call this BEFORE starting an async operation.
   */
  const createVersion = useCallback((): number => {
    versionRef.current += 1;
    return versionRef.current;
  }, []);

  /**
   * Check whether the given version is stale (i.e., a newer version
   * has been created since this one).
   * Call this AFTER the async operation resolves, before applying state.
   */
  const isStale = useCallback((version: number): boolean => {
    return version !== versionRef.current;
  }, []);

  return { createVersion, isStale };
}
