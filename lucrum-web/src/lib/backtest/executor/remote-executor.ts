/**
 * Remote backtest executor — STUB.
 *
 * Planned topology (Sprint 1+ rollout):
 *
 *   Next.js API route ──► RemoteBacktestExecutor.run()
 *                          │
 *                          │  NATS JetStream
 *                          │  subject: backtest.run.<runId>
 *                          ▼
 *                       k8s `lucrum-backtest-worker` pod (1+ replicas)
 *                          │
 *                          │  reply subject: backtest.result.<runId>
 *                          ▼
 *                       result returned to caller
 *
 * Why: the in-process LocalBacktestExecutor competes with the web tier
 * for CPU and memory. A single 5-year daily-bar run can spike RSS by
 * hundreds of MB; concurrent multi-stock validation OOMs the pod.
 *
 * Why this is a STUB today: the worker pod and JetStream subject layout
 * don't exist yet (R6 deployment work). Throwing NotImplementedError up
 * front keeps anyone from `LUCRUM_BACKTEST_EXECUTOR=remote` flipping a
 * production switch they don't have the infrastructure for.
 *
 * Sprint 1 follow-up tasks (tracked separately):
 *   1. Add `lucrum-backtest-worker` Helm chart + ArgoCD app
 *   2. Define `backtest.run.*` / `backtest.result.*` JetStream streams
 *      with bounded retention + dedup window
 *   3. Implement run/cancel/health here using `@nats-io/nats.js`
 *   4. Wire LLM router-style fallback in the factory: try remote, on
 *      timeout or error fall back to local
 *
 * @module lib/backtest/executor/remote-executor
 */

import {
  NotImplementedError,
  type BacktestRunInput,
  type BacktestRunOutput,
  type IBacktestExecutor,
} from "./types";

/** NATS subject template the eventual worker pool will subscribe to. */
export const REMOTE_RUN_SUBJECT_PREFIX = "backtest.run.";
/** NATS subject template the worker pool publishes results on. */
export const REMOTE_RESULT_SUBJECT_PREFIX = "backtest.result.";
/** JetStream stream name carrying both subjects. */
export const REMOTE_STREAM_NAME = "LUCRUM_BACKTEST";

export class RemoteBacktestExecutor implements IBacktestExecutor {
  readonly name = "remote-nats";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async run(_input: BacktestRunInput): Promise<BacktestRunOutput> {
    throw new NotImplementedError(
      "RemoteBacktestExecutor.run (NATS worker pool not deployed yet)",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cancel(_runId: string): Promise<void> {
    throw new NotImplementedError(
      "RemoteBacktestExecutor.cancel (NATS worker pool not deployed yet)",
    );
  }

  async isHealthy(): Promise<boolean> {
    // Always unhealthy until the stub is replaced — the factory uses this
    // to fall back to local even if the env var requests remote.
    return false;
  }
}
