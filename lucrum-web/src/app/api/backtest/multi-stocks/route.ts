/**
 * Multi-Stocks Backtest API (JSON mode, backwards compatible)
 * POST /api/backtest/multi-stocks
 * Uses chunked parallel execution internally.
 * For SSE streaming, use /api/backtest/multi-stocks/stream instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKLineDataBatch } from "@/lib/db/queries";
import { executeBatchBacktest, type StockBatchItem } from "@/lib/backtest/parallel/batch-backtest-service";
import type { StockSignalResult } from "@/lib/backtest/signal-scanner";
import type { BatchBacktestRequest } from "@/lib/backtest/parallel/batch-backtest-types";
import { DEFAULT_BATCH_CONCURRENCY } from "@/lib/backtest/parallel/batch-backtest-types";
import { createHash } from "crypto";
import { cacheGet, cacheSet } from "@/lib/redis";

const CACHE_TTL = 86400;

function generateCacheKey(config: BatchBacktestRequest): string {
  const normalized = {
    symbols: [...config.symbols].sort(),
    strategy: config.strategy,
    startDate: config.startDate,
    endDate: config.endDate,
    holdingDays: config.holdingDays,
  };
  return "backtest:multi:" + createHash("md5").update(JSON.stringify(normalized)).digest("hex");
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const config: BatchBacktestRequest = await request.json();

    // Validate request
    if (!config.symbols || !Array.isArray(config.symbols) || config.symbols.length === 0) {
      return NextResponse.json({ success: false, error: "Symbols array is required and must not be empty" }, { status: 400 });
    }
    if (config.symbols.length > 100) {
      return NextResponse.json({ success: false, error: "Maximum 100 stocks allowed" }, { status: 400 });
    }
    if (!config.strategy) {
      return NextResponse.json({ success: false, error: "Strategy is required" }, { status: 400 });
    }
    if (!config.startDate || !config.endDate) {
      return NextResponse.json({ success: false, error: "Start date and end date are required" }, { status: 400 });
    }

    // Check cache
    const cacheKey = generateCacheKey(config);
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      console.log("[MultiStocks] Cache hit:", cacheKey);
      return NextResponse.json({ ...(cached as object), cacheHit: true, executionTime: Date.now() - startTime, timestamp: new Date().toISOString() });
    }

    // Fetch K-line data
    console.log("[MultiStocks] Fetching K-line data for " + config.symbols.length + " stocks...");
    const klineDataMap = await getKLineDataBatch(config.symbols, config.startDate, config.endDate);

    // Build stock items
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
      return NextResponse.json({ success: false, error: "No K-line data found for any requested stocks" }, { status: 404 });
    }

    // Execute batch backtest with chunked concurrency
    console.log("[MultiStocks] Starting parallel backtest for " + stocks.length + " stocks...");
    const result = await executeBatchBacktest(stocks, {
      strategy: config.strategy,
      holdingDays: config.holdingDays,
      includeTransactionCosts: config.includeTransactionCosts,
      deduplicateSignals: config.deduplicateSignals,
    }, {
      concurrency: config.concurrency || DEFAULT_BATCH_CONCURRENCY,
    });

    // Build response compatible with existing frontend
    const stockResults = result.results
          .filter((r): r is { success: true; data: StockSignalResult } => r.success)
          .map((r) => {
            const signals = r.data.signals || [];
            const totalReturn = signals.reduce((sum, s) => sum + (s.returnPct || 0), 0);
            return { ...r.data, totalReturn };
          })
          .sort((a, b) => (b.totalReturn || 0) - (a.totalReturn || 0));

    const response = {
      success: true,
      summary: result.summary,
      stockResults,
      failures: result.failures,
      isAnomalyMode: result.isAnomalyMode,
      dataSource: "database",
      cacheHit: false,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    // Cache result
    await cacheSet(cacheKey, response, CACHE_TTL);
    console.log("[MultiStocks] Completed in " + response.executionTime + "ms");

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MultiStocks] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Backtest execution failed",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
