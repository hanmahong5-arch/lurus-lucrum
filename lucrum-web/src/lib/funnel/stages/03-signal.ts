/**
 * Stage 03 — Signal (placeholder).
 *
 * Will delegate to `@/lib/backtest/signal-scanner` to score each candidate
 * by strategy-specific buy-signal strength over the lookback window.
 *
 * Current behavior: passthrough with a neutral 0.5 score so downstream
 * stages have a score field to work with.
 *
 * TODO(phase-3): invoke signal-scanner per strategy pack and aggregate.
 *
 * @module lib/funnel/stages/03-signal
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';

export interface SignalStageOptions {
  /** Strategy identifier (e.g. "dual-ma", "rsi"). Reserved for Phase 3. */
  readonly strategyId?: string;
  /** Lookback window in trading days. Reserved. */
  readonly lookbackDays?: number;
}

export function makeSignalStage(_options: SignalStageOptions = {}): Stage {
  return {
    name: 'signal',
    index: 3,
    async run(
      incoming: ReadonlyArray<Candidate>,
      _context: FunnelContext
    ): Promise<StageRunOutput> {
      const scored = incoming.map((c) => ({
        ...c,
        score: c.score ?? 0.5,
        scoreBreakdown: { ...(c.scoreBreakdown ?? {}), signal: 0.5 },
      }));
      return {
        candidates: scored,
        warnings: ['signal stage placeholder; neutral score 0.5 applied'],
      };
    },
  };
}
