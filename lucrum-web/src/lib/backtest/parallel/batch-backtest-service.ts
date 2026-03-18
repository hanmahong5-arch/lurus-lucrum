/**
 * Batch Backtest Service
 * @module lib/backtest/parallel/batch-backtest-service
 */

import { executeInChunks } from "./chunked-executor";
import type { BatchProgress } from "./types";
import { scanStockSignalsEnhanced, type StockSignalResult } from "../signal-scanner";
import type { BacktestKline } from "../engine";
import type { BatchBacktestOptions, BatchBacktestResult, BatchBacktestSummary, FailureBreakdown, FailureReason, FailureRecord } from "./batch-backtest-types";
import { ANOMALY_THRESHOLD, DEFAULT_BATCH_CONCURRENCY } from "./batch-backtest-types";

const FAILURE_LABELS: Record<FailureReason, { label: string; labelEn: string }> = {
  data_insufficient: { label: "数据不足", labelEn: "Insufficient Data" },
  suspended: { label: "停牌", labelEn: "Suspended" },
  format_error: { label: "格式异常", labelEn: "Format Error" },
  timeout: { label: "超时", labelEn: "Timeout" },
  unknown: { label: "未知错误", labelEn: "Unknown Error" },
};

export function classifyFailure(errorMessage: string): FailureReason {
  const lower = errorMessage.toLowerCase();
  if (lower.includes("no data") || lower.includes("missing") || lower.includes("insufficient") || lower.includes("empty")) return "data_insufficient";
  if (lower.includes("halt") || lower.includes("suspend") || lower.includes("delist")) return "suspended";
  if (lower.includes("invalid") || lower.includes("parse") || lower.includes("format") || lower.includes("malform")) return "format_error";
  if (lower.includes("timeout") || lower.includes("abort") || lower.includes("cancel")) return "timeout";
  return "unknown";
}

export function buildFailureBreakdown(failures: FailureRecord[]): FailureBreakdown[] {
  const map = new Map<FailureReason, FailureBreakdown>();
  for (const f of failures) {
    const existing = map.get(f.reason);
    if (existing) { existing.count++; existing.symbols.push(f.symbol); }
    else {
      const labels = FAILURE_LABELS[f.reason];
      map.set(f.reason, { reason: f.reason, count: 1, symbols: [f.symbol], label: labels.label, labelEn: labels.labelEn });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function calculateBatchSummary(successfulResults: StockSignalResult[], totalStocks: number, failedStocks: number, totalTimeMs: number): BatchBacktestSummary {
  let totalSignals = 0, positiveReturns = 0, negativeReturns = 0;
  let maxReturn = -Infinity, minReturn = Infinity;
  const allReturns: number[] = [];
  for (const result of successfulResults) {
    totalSignals += result.totalSignals;
    for (const signal of result.signals) {
      if (signal.returnPct !== undefined) {
        allReturns.push(signal.returnPct);
        if (signal.returnPct > 0) positiveReturns++;
        if (signal.returnPct < 0) negativeReturns++;
        if (signal.returnPct > maxReturn) maxReturn = signal.returnPct;
        if (signal.returnPct < minReturn) minReturn = signal.returnPct;
      }
    }
  }
  const totalReturn = allReturns.reduce((sum, r) => sum + r, 0);
  const avgReturn = allReturns.length > 0 ? totalReturn / allReturns.length : 0;
  const winRate = allReturns.length > 0 ? positiveReturns / allReturns.length : 0;
  if (allReturns.length === 0) { maxReturn = 0; minReturn = 0; }
  return { totalStocks, succeededStocks: successfulResults.length, failedStocks, totalSignals, positiveReturns, negativeReturns, avgReturn, winRate, maxReturn, minReturn, totalReturn, totalTimeMs, avgTimePerStockMs: totalStocks > 0 ? totalTimeMs / totalStocks : 0 };
}

export interface StockBatchItem { symbol: string; name: string; klines: BacktestKline[]; }
export interface BatchProcessorConfig { strategy: string; holdingDays: number; includeTransactionCosts?: boolean; deduplicateSignals?: boolean; }

export async function executeBatchBacktest(stocks: StockBatchItem[], config: BatchProcessorConfig, options: BatchBacktestOptions = {}): Promise<BatchBacktestResult> {
  const { concurrency = DEFAULT_BATCH_CONCURRENCY, onProgress, signal } = options;
  const startTime = performance.now();
  const batchResult = await executeInChunks<StockBatchItem, StockSignalResult>(stocks, async (stock) => {
    if (stock.klines.length === 0) throw new Error("No data available for " + stock.symbol + ": empty kline array");
    return scanStockSignalsEnhanced(stock.symbol, stock.name, stock.klines, config.strategy, {
      holdingDays: config.holdingDays,
      transactionCosts: config.includeTransactionCosts ? undefined : { commission: 0, stampDuty: 0, transferFee: 0, slippage: 0, minCommission: 0 },
      deduplication: config.deduplicateSignals ? undefined : { minGapDays: 0, mergeConsecutive: false, keepStrongest: false },
    });
  }, { concurrency, signal, onProgress, getItemId: (item) => (item as StockBatchItem).symbol });

  const totalTimeMs = performance.now() - startTime;
  const successfulResults: StockSignalResult[] = [];
  const failures: FailureRecord[] = [];
  for (let i = 0; i < batchResult.results.length; i++) {
    const item = batchResult.results[i]!;
    const stock = stocks[i]!;
    if (item.success) successfulResults.push(item.data);
    else failures.push({ symbol: stock.symbol, reason: classifyFailure(item.error), message: item.error });
  }
  const summary = calculateBatchSummary(successfulResults, stocks.length, failures.length, totalTimeMs);
  const failureBreakdown = buildFailureBreakdown(failures);
  const failureRatio = stocks.length > 0 ? failures.length / stocks.length : 0;
  return {
    results: batchResult.results, summary, failures, failureBreakdown,
    isAnomalyMode: failureRatio > ANOMALY_THRESHOLD,
    meta: { concurrency, dataSource: "database", timestamp: new Date().toISOString() },
  };
}
