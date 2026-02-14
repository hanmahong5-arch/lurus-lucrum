/**
 * Backtest Workers Module
 *
 * Web Worker-based parallel backtest execution.
 * PoC for Story 4-1 parallel backtest spike.
 *
 * @module lib/backtest/workers
 */

export { BacktestWorkerPool } from "./worker-pool";
export type { BacktestJob, JobResult } from "./worker-pool";
export type {
  WorkerPoolConfig,
  WorkerPoolProgress,
  WorkerJobMessage,
  WorkerOutboundMessage,
  SerializableKline,
} from "./types";
