'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface UseOperationGuardReturn {
  /** Whether an operation is currently running */
  isRunning: boolean;
  /** Start a guarded operation. Returns false if already running. */
  start: () => boolean;
  /** Mark the current operation as finished */
  finish: () => void;
  /** Show a confirmation dialog if operation is running. Returns true if safe to proceed. */
  confirmInterrupt: (message: string) => boolean;
}

// =============================================================================
// useOperationGuard
// =============================================================================

/**
 * Guards against concurrent operations and provides interruption confirmation.
 *
 * Use cases:
 * - Prevent starting a new backtest while one is running
 * - Confirm before switching modes during an active operation
 * - Block UI changes (e.g., disable selectors) while running
 *
 * Usage:
 *   const guard = useOperationGuard()
 *
 *   function handleStart() {
 *     if (!guard.start()) return  // Already running
 *     try { await doWork() } finally { guard.finish() }
 *   }
 *
 *   function handleModeSwitch() {
 *     if (!guard.confirmInterrupt('Switching mode will cancel the current operation. Continue?')) return
 *     guard.finish()
 *     switchMode()
 *   }
 */
export function useOperationGuard(): UseOperationGuardReturn {
  const [isRunning, setIsRunning] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const start = useCallback((): boolean => {
    if (runningRef.current) return false;
    runningRef.current = true;
    if (mountedRef.current) setIsRunning(true);
    return true;
  }, []);

  const finish = useCallback((): void => {
    runningRef.current = false;
    if (mountedRef.current) setIsRunning(false);
  }, []);

  const confirmInterrupt = useCallback(
    (message: string): boolean => {
      if (!runningRef.current) return true;
      return window.confirm(message);
    },
    [],
  );

  return { isRunning, start, finish, confirmInterrupt };
}
