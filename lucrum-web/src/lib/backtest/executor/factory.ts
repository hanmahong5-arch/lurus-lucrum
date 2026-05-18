/**
 * Backtest executor factory — picks an implementation based on env.
 *
 * Selection logic (deterministic, no clever fallback):
 *   - `LUCRUM_BACKTEST_EXECUTOR=remote` → `RemoteBacktestExecutor` (today
 *     this throws on every call — see remote-executor.ts. Set this only
 *     once the worker pod is actually deployed.)
 *   - anything else (default)            → `LocalBacktestExecutor`
 *
 * The single-instance cache keeps each executor stateless across calls
 * without forcing every consumer to re-construct.
 *
 * @module lib/backtest/executor/factory
 */

import { LocalBacktestExecutor } from "./local-executor";
import { RemoteBacktestExecutor } from "./remote-executor";
import type { IBacktestExecutor } from "./types";

let cached: IBacktestExecutor | null = null;

/**
 * Reset the cached executor — exposed for tests; production code should
 * not call this. Idempotent.
 */
export function resetExecutorCache(): void {
  cached = null;
}

export function getBacktestExecutor(): IBacktestExecutor {
  if (cached) return cached;

  const requested = (process.env.LUCRUM_BACKTEST_EXECUTOR ?? "local").toLowerCase();
  cached = requested === "remote"
    ? new RemoteBacktestExecutor()
    : new LocalBacktestExecutor();
  return cached;
}
