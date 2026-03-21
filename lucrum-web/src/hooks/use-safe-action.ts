'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface UseSafeActionOptions<TResult> {
  /** Minimum interval between executions (default: 300ms) */
  debounceMs?: number;
  /** Called on successful completion (only if component is still mounted) */
  onSuccess?: (result: TResult) => void;
  /** Called on error (only if component is still mounted, ignores AbortError) */
  onError?: (error: Error) => void;
  /** When re-triggered while running: abort previous call (default: true) */
  abortPrevious?: boolean;
}

export interface UseSafeActionReturn<TArgs extends unknown[], TResult> {
  /** Wrapped action — safe to call from onClick / onSubmit */
  execute: (...args: TArgs) => void;
  /** Whether the action is currently in flight */
  isRunning: boolean;
  /** Last error (auto-clears on next successful run) */
  error: Error | null;
  /** Manually clear the error state */
  reset: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DEBOUNCE_MS = 300;

// =============================================================================
// useSafeAction
// =============================================================================

/**
 * Wraps an async action to prevent:
 * 1. Double-click / rapid re-invocation (leading-edge debounce)
 * 2. Re-entrance while already running (mutex lock)
 * 3. State updates after unmount (mounted flag)
 * 4. Stale closures (always uses latest callback ref)
 *
 * Usage:
 *   const { execute, isRunning, error, reset } = useSafeAction(
 *     async (id: string) => {
 *       const signal = createSignal()   // from useAbortController
 *       return fetch(`/api/${id}`, { signal })
 *     },
 *     { onSuccess: (data) => toast.success('Done') }
 *   )
 *
 *   <button onClick={() => execute(id)} disabled={isRunning}>
 *     {isRunning ? 'Loading...' : 'Submit'}
 *   </button>
 */
export function useSafeAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseSafeActionOptions<TResult> = {},
): UseSafeActionReturn<TArgs, TResult> {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onSuccess,
    onError,
    abortPrevious = true,
  } = options;

  // ---------------------------------------------------------------------------
  // Refs — stable across renders, no stale closures
  // ---------------------------------------------------------------------------

  /** Always holds the latest action callback */
  const actionRef = useRef(action);
  actionRef.current = action;

  /** Always holds the latest callbacks */
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  /** Track mount status to avoid setState after unmount */
  const mountedRef = useRef(true);

  /** Mutex: true while an execution is in flight */
  const runningRef = useRef(false);

  /** AbortController for the current execution */
  const controllerRef = useRef<AbortController | null>(null);

  /** Debounce cooldown timer */
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Whether we are in cooldown (leading-edge: fire immediately, block for debounceMs) */
  const inCooldownRef = useRef(false);

  // ---------------------------------------------------------------------------
  // State — only these cause re-renders
  // ---------------------------------------------------------------------------

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      if (cooldownRef.current !== null) {
        clearTimeout(cooldownRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // execute
  // ---------------------------------------------------------------------------

  const execute = useCallback(
    (...args: TArgs): void => {
      // Leading-edge debounce: if we already fired recently, skip
      if (inCooldownRef.current) {
        return;
      }

      // Mutex check
      if (runningRef.current) {
        if (abortPrevious) {
          // Abort the previous in-flight request
          controllerRef.current?.abort();
        } else {
          // Skip — previous call still running
          return;
        }
      }

      // Start cooldown (leading edge: fire now, block for debounceMs)
      inCooldownRef.current = true;
      cooldownRef.current = setTimeout(() => {
        inCooldownRef.current = false;
        cooldownRef.current = null;
      }, debounceMs);

      // Set running state
      runningRef.current = true;
      if (mountedRef.current) {
        setIsRunning(true);
        setError(null);
      }

      // Create a fresh AbortController for this execution
      const controller = new AbortController();
      controllerRef.current = controller;

      actionRef
        .current(...args)
        .then((result) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          onSuccessRef.current?.(result);
        })
        .catch((err: unknown) => {
          if (!mountedRef.current || controller.signal.aborted) return;

          // Ignore abort errors — they are expected when we cancel
          if (err instanceof Error && err.name === 'AbortError') return;

          const wrapped =
            err instanceof Error ? err : new Error(String(err));
          if (mountedRef.current) {
            setError(wrapped);
          }
          onErrorRef.current?.(wrapped);
        })
        .finally(() => {
          // Only update state if this is still the active execution
          if (controller === controllerRef.current) {
            runningRef.current = false;
            if (mountedRef.current) {
              setIsRunning(false);
            }
          }
        });
    },
    [abortPrevious, debounceMs],
  );

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { execute, isRunning, error, reset };
}
