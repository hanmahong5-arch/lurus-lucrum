/**
 * Backtest Web Worker Script
 *
 * Runs backtest computation in a dedicated thread.
 * Receives K-line data + strategy config, returns signal scan results.
 *
 * This file is designed to be loaded as a Web Worker via:
 *   new Worker(new URL('./backtest-worker.ts', import.meta.url))
 *
 * Note: This is a PoC for Story 4-1. In production (Story 4-2),
 * the worker would import the actual signal scanner. For the PoC,
 * we use a simplified computation to prove the parallelism concept.
 *
 * @module lib/backtest/workers/backtest-worker
 */

import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  SerializableKline,
} from "./types";

// Minimal interface for Web Worker global scope (avoids adding webworker lib to tsconfig)
interface WorkerGlobalScope {
  close(): void;
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
}
const ctx = self as unknown as WorkerGlobalScope;

/**
 * Simplified backtest computation for PoC.
 * Computes basic moving average crossover signals.
 * In production, this would import and call scanStockSignalsEnhanced.
 */
function computeBacktest(
  symbol: string,
  name: string,
  klines: SerializableKline[],
  _strategyId: string,
  holdingDays: number,
): unknown {
  if (klines.length < 30) {
    return {
      symbol,
      name,
      signals: [],
      totalSignals: 0,
      winSignals: 0,
      winRate: 0,
      avgReturn: 0,
      maxReturn: 0,
      minReturn: 0,
    };
  }

  // Compute SMA5 and SMA20 for golden cross detection
  const closes = klines.map((k) => k.close);
  const signals: Array<{
    type: string;
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    returnPct: number;
    isWin: boolean;
    holdingDays: number;
  }> = [];

  for (let i = 20; i < closes.length - holdingDays; i++) {
    // SMA5
    let sma5 = 0;
    for (let j = i - 4; j <= i; j++) sma5 += closes[j]!;
    sma5 /= 5;

    let sma5Prev = 0;
    for (let j = i - 5; j <= i - 1; j++) sma5Prev += closes[j]!;
    sma5Prev /= 5;

    // SMA20
    let sma20 = 0;
    for (let j = i - 19; j <= i; j++) sma20 += closes[j]!;
    sma20 /= 20;

    let sma20Prev = 0;
    for (let j = i - 20; j <= i - 1; j++) sma20Prev += closes[j]!;
    sma20Prev /= 20;

    // Golden cross: SMA5 crosses above SMA20
    if (sma5Prev <= sma20Prev && sma5 > sma20) {
      const entryPrice = closes[i]!;
      const exitIdx = Math.min(i + holdingDays, closes.length - 1);
      const exitPrice = closes[exitIdx]!;
      const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

      const entryTime = klines[i]!.time;
      const exitTime = klines[exitIdx]!.time;

      signals.push({
        type: "buy",
        entryDate: new Date(entryTime * 1000).toISOString().slice(0, 10),
        exitDate: new Date(exitTime * 1000).toISOString().slice(0, 10),
        entryPrice,
        exitPrice,
        returnPct: Math.round(returnPct * 100) / 100,
        isWin: returnPct > 0,
        holdingDays,
      });
    }
  }

  const wins = signals.filter((s) => s.isWin).length;
  const returns = signals.map((s) => s.returnPct);

  return {
    symbol,
    name,
    signals,
    totalSignals: signals.length,
    winSignals: wins,
    winRate: signals.length > 0 ? wins / signals.length : 0,
    avgReturn:
      returns.length > 0
        ? returns.reduce((a, b) => a + b, 0) / returns.length
        : 0,
    maxReturn: returns.length > 0 ? Math.max(...returns) : 0,
    minReturn: returns.length > 0 ? Math.min(...returns) : 0,
  };
}

// Message handler
ctx.addEventListener("message", (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;

  if (msg.type === "terminate") {
    ctx.close();
    return;
  }

  if (msg.type === "job") {
    try {
      const result = computeBacktest(
        msg.symbol,
        msg.name,
        msg.klines,
        msg.strategyId,
        msg.options.holdingDays,
      );

      const response: WorkerOutboundMessage = {
        type: "result",
        jobId: msg.jobId,
        symbol: msg.symbol,
        data: result,
      };
      ctx.postMessage(response);
    } catch (err) {
      const response: WorkerOutboundMessage = {
        type: "error",
        jobId: msg.jobId,
        symbol: msg.symbol,
        error: err instanceof Error ? err.message : String(err),
      };
      ctx.postMessage(response);
    }
  }
});

// Signal ready
const readyMsg: WorkerOutboundMessage = { type: "ready" };
ctx.postMessage(readyMsg);
