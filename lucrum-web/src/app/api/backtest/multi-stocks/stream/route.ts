/**
 * Multi-Stocks Batch Backtest SSE Streaming API
 * POST /api/backtest/multi-stocks/stream
 * Streams progress via SSE, returns complete results at end.
 * @module app/api/backtest/multi-stocks/stream/route
 */

import { NextRequest } from "next/server";
import { getKLineDataBatch } from "@/lib/db/queries";
import { executeBatchBacktest, type StockBatchItem } from "@/lib/backtest/parallel/batch-backtest-service";
import type { BatchBacktestRequest, BatchBacktestResult, BatchSSEEvent } from "@/lib/backtest/parallel/batch-backtest-types";
import { DEFAULT_BATCH_CONCURRENCY } from "@/lib/backtest/parallel/batch-backtest-types";
import { cacheGet, cacheSet } from "@/lib/redis";
import { createHash } from "crypto";

const CACHE_TTL = 86400;

function generateCacheKey(config: BatchBacktestRequest): string {
  const normalized = { symbols: [...config.symbols].sort(), strategy: config.strategy, startDate: config.startDate, endDate: config.endDate, holdingDays: config.holdingDays };
  return "backtest:batch:" + createHash("md5").update(JSON.stringify(normalized)).digest("hex");
}

function sseEvent(data: BatchSSEEvent): string {
  return "data: " + JSON.stringify(data) + "\n\n";
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  let abortController: AbortController | null = null;

  try {
    const config: BatchBacktestRequest = await request.json();

    // Validate
    if (!config.symbols?.length) {
      return new Response(sseEvent({ type: "error", message: "symbols array required", code: "INVALID_INPUT" }), {
        status: 400, headers: { "Content-Type": "text/event-stream" },
      });
    }
    if (config.symbols.length > 100) {
      return new Response(sseEvent({ type: "error", message: "Maximum 100 stocks allowed", code: "TOO_MANY_STOCKS" }), {
        status: 400, headers: { "Content-Type": "text/event-stream" },
      });
    }

    // Check cache
    const cacheKey = generateCacheKey(config);
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      return new Response(sseEvent({ type: "complete", result: cached as BatchBacktestResult }), {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    // Fetch K-line data
    const klineDataMap = await getKLineDataBatch(config.symbols, config.startDate, config.endDate);

    // Build stock items with K-line data
    const stocks: StockBatchItem[] = config.symbols
      .filter((symbol) => klineDataMap.has(symbol) && (klineDataMap.get(symbol) as unknown[]).length > 0)
      .map((symbol) => {
        const klines = klineDataMap.get(symbol) as { date: string; open: number; high: number; low: number; close: number; volume: number }[];
        return {
          symbol,
          name: "",
          klines: klines.map((k) => ({ time: new Date(k.date).getTime() / 1000, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume })),
        };
      });

    if (stocks.length === 0) {
      return new Response(sseEvent({ type: "error", message: "No K-line data found for any requested stocks", code: "NO_DATA" }), {
        status: 404, headers: { "Content-Type": "text/event-stream" },
      });
    }

    abortController = new AbortController();

    // Handle client disconnect
    request.signal.addEventListener("abort", () => {
      abortController?.abort();
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await executeBatchBacktest(stocks, {
            strategy: config.strategy,
            holdingDays: config.holdingDays,
            includeTransactionCosts: config.includeTransactionCosts,
            deduplicateSignals: config.deduplicateSignals,
          }, {
            concurrency: config.concurrency || DEFAULT_BATCH_CONCURRENCY,
            signal: abortController!.signal,
            onProgress: (progress) => {
              try {
                const evt: BatchSSEEvent = {
                  type: "progress",
                  completed: progress.completed,
                  total: progress.total,
                  failed: progress.failed,
                  currentItem: progress.currentItem || "",
                  elapsedMs: progress.elapsedMs,
                };
                controller.enqueue(encoder.encode(sseEvent(evt)));
              } catch { /* client disconnected */ }
            },
          });

          // Send final result
          if (abortController!.signal.aborted) {
            controller.enqueue(encoder.encode(sseEvent({ type: "cancelled", result })));
          } else {
            controller.enqueue(encoder.encode(sseEvent({ type: "complete", result })));
            await cacheSet(cacheKey, result, CACHE_TTL);
          }
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          try {
            controller.enqueue(encoder.encode(sseEvent({ type: "error", message: msg })));
          } catch { /* ignore */ }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(sseEvent({ type: "error", message: msg }), {
      status: 500, headers: { "Content-Type": "text/event-stream" },
    });
  }
}
