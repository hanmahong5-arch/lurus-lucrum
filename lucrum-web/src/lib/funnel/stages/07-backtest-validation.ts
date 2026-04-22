/**
 * Stage 07 — Backtest Validation (placeholder).
 *
 * Will run the final portfolio through the existing backtest engine to
 * confirm historical performance before surfacing to the user. For now,
 * passthrough.
 *
 * TODO(phase-5): delegate to `@/lib/backtest/engine` via portfolio mode.
 *
 * @module lib/funnel/stages/07-backtest-validation
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';

export function makeBacktestValidationStage(): Stage {
  return {
    name: 'backtest-validation',
    index: 7,
    async run(
      incoming: ReadonlyArray<Candidate>,
      _context: FunnelContext
    ): Promise<StageRunOutput> {
      return {
        candidates: incoming,
        warnings: ['backtest-validation not yet implemented; passthrough'],
      };
    },
  };
}
