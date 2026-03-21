'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAbortController } from './use-abort-controller';

// =============================================================================
// Types
// =============================================================================

export interface UseSseStreamOptions {
  /** Called for each parsed SSE event */
  onEvent?: (event: unknown) => void;
  /** Called when the stream ends normally */
  onComplete?: () => void;
  /** Called on error (ignores AbortError) */
  onError?: (error: Error) => void;
}

export interface UseSseStreamReturn {
  /** Start a new SSE stream. Aborts any previous stream. */
  startStream: (url: string, body: unknown) => Promise<void>;
  /** Abort the current stream */
  stopStream: () => void;
  /** Whether a stream is currently active */
  isStreaming: boolean;
  /** Last error */
  error: string | null;
}

// =============================================================================
// useSseStream
// =============================================================================

/**
 * Manages SSE (Server-Sent Events) streams with proper lifecycle:
 * - Aborts on unmount
 * - Aborts previous stream when a new one starts
 * - Ignores events after abort
 *
 * Usage:
 *   const { startStream, stopStream, isStreaming } = useSseStream({
 *     onEvent: (ev) => handleEvent(ev),
 *     onComplete: () => setDone(true),
 *   })
 */
export function useSseStream(options: UseSseStreamOptions = {}): UseSseStreamReturn {
  const createSignal = useAbortController();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Keep latest callbacks in refs to avoid stale closures
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopStream = useCallback(() => {
    // createSignal() implicitly aborts any previous controller
    // but we just want to abort without creating a new one.
    // Use createSignal to get a new one then immediately abort it.
    // Actually, easier: just start a signal and let GC handle it.
    // The useAbortController already cleans up on unmount.
    createSignal(); // This aborts the previous signal
    if (mountedRef.current) {
      setIsStreaming(false);
    }
  }, [createSignal]);

  const startStream = useCallback(
    async (url: string, body: unknown): Promise<void> => {
      const signal = createSignal();

      if (mountedRef.current) {
        setIsStreaming(true);
        setError(null);
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });

        if (!response.ok) {
          throw new Error(`SSE request failed: HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body for SSE stream');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (signal.aborted) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (signal.aborted) break;
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  onEventRef.current?.(parsed);
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (mountedRef.current && !signal.aborted) {
          onCompleteRef.current?.();
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!mountedRef.current) return;

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onErrorRef.current?.(err instanceof Error ? err : new Error(message));
      } finally {
        if (mountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
    [createSignal],
  );

  return { startStream, stopStream, isStreaming, error };
}
