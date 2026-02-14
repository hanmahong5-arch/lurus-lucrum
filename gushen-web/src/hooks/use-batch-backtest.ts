"use client";

/**
 * useBatchBacktest Hook
 * Manages SSE connection for parallel batch backtest, with progress tracking,
 * cancellation support, and tab visibility reconnection.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { BatchBacktestResult, BatchSSEEvent, BatchBacktestRequest } from "@/lib/backtest/parallel/batch-backtest-types";
import type { BatchStatus } from "@/components/strategy-validation/batch-progress-bar";

export interface BatchBacktestState {
  status: BatchStatus;
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
  currentItem: string;
  result: BatchBacktestResult | null;
  error: string | null;
}

const INITIAL_STATE: BatchBacktestState = {
  status: "idle",
  completed: 0,
  total: 0,
  failed: 0,
  elapsedMs: 0,
  currentItem: "",
  result: null,
  error: null,
};

export function useBatchBacktest() {
  const [state, setState] = useState<BatchBacktestState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      readerRef.current?.cancel();
    };
  }, []);

  const startBatch = useCallback(async (request: BatchBacktestRequest) => {
    // Cancel any existing run
    abortRef.current?.abort();
    readerRef.current?.cancel();

    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      ...INITIAL_STATE,
      status: "running",
      total: request.symbols.length,
    });

    try {
      const response = await fetch("/api/backtest/multi-stocks/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        let errMsg = "Request failed: " + response.status;
        try {
          const parsed = JSON.parse(text.replace(/^data: /, ""));
          if (parsed.message) errMsg = parsed.message;
        } catch { /* use default */ }
        setState((prev) => ({ ...prev, status: "error", error: errMsg }));
        return;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const event: BatchSSEEvent = JSON.parse(jsonStr);
            switch (event.type) {
              case "progress":
                setState((prev) => ({
                  ...prev,
                  completed: event.completed,
                  total: event.total,
                  failed: event.failed,
                  currentItem: event.currentItem,
                  elapsedMs: event.elapsedMs,
                }));
                break;
              case "complete":
                setState((prev) => ({
                  ...prev,
                  status: "complete",
                  completed: prev.total,
                  result: event.result,
                }));
                break;
              case "cancelled":
                setState((prev) => ({
                  ...prev,
                  status: "cancelled",
                  result: event.result,
                }));
                break;
              case "error":
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: event.message,
                }));
                break;
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const cancelBatch = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    readerRef.current?.cancel();
    setState(INITIAL_STATE);
  }, []);

  return { ...state, startBatch, cancelBatch, reset };
}
