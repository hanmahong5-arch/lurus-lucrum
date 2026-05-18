/**
 * Public surface of the backtest executor module. Consumers should import
 * from here, not the implementation files.
 *
 * Typical usage:
 *   import { getBacktestExecutor } from "@/lib/backtest/executor";
 *   const executor = getBacktestExecutor();
 *   const { result, meta } = await executor.run({
 *     strategyCode, klines, config, signal: req.signal,
 *   });
 *
 * @module lib/backtest/executor
 */

export type {
  IBacktestExecutor,
  BacktestRunInput,
  BacktestRunOutput,
  BacktestExecutionMeta,
} from "./types";
export {
  BacktestCancelledError,
  NotImplementedError,
} from "./types";
export { LocalBacktestExecutor } from "./local-executor";
export {
  RemoteBacktestExecutor,
  REMOTE_RUN_SUBJECT_PREFIX,
  REMOTE_RESULT_SUBJECT_PREFIX,
  REMOTE_STREAM_NAME,
} from "./remote-executor";
export { getBacktestExecutor, resetExecutorCache } from "./factory";
