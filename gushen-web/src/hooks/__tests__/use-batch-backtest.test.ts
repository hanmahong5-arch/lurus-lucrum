/**
 * useBatchBacktest Hook Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBatchBacktest } from "../use-batch-backtest";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createMockSSEResponse(events: string[]): Response {
  const body = events.map((e) => "data: " + e + "\n\n").join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("useBatchBacktest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("should start in idle state", () => {
    const { result } = renderHook(() => useBatchBacktest());
    expect(result.current.status).toBe("idle");
    expect(result.current.completed).toBe(0);
    expect(result.current.result).toBeNull();
  });

  it("should handle complete SSE event", async () => {
    const completeEvent = JSON.stringify({
      type: "complete",
      result: {
        results: [], summary: { totalStocks: 5, succeededStocks: 5, failedStocks: 0, totalSignals: 10, positiveReturns: 6, negativeReturns: 4, avgReturn: 1.5, winRate: 0.6, maxReturn: 5, minReturn: -2, totalReturn: 7.5, totalTimeMs: 5000, avgTimePerStockMs: 1000 },
        failures: [], failureBreakdown: [], isAnomalyMode: false,
        meta: { concurrency: 8, dataSource: "database", timestamp: "2026-01-01T00:00:00Z" },
      },
    });
    mockFetch.mockResolvedValueOnce(createMockSSEResponse([completeEvent]));

    const { result } = renderHook(() => useBatchBacktest());
    await act(async () => {
      await result.current.startBatch({
        symbols: ["A", "B", "C", "D", "E"],
        strategy: "macd_golden_cross",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        holdingDays: 5,
      });
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.summary.totalStocks).toBe(5);
  });

  it("should handle error response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const { result } = renderHook(() => useBatchBacktest());
    await act(async () => {
      await result.current.startBatch({
        symbols: ["A"],
        strategy: "test",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        holdingDays: 5,
      });
    });

    expect(result.current.status).toBe("error");
  });

  it("should reset state", () => {
    const { result } = renderHook(() => useBatchBacktest());
    act(() => { result.current.reset(); });
    expect(result.current.status).toBe("idle");
  });
});
