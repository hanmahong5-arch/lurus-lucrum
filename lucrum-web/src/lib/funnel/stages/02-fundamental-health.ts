/**
 * Stage 02 — Fundamental Health (placeholder).
 *
 * Will evaluate Piotroski F-score, Altman Z-score, revenue/receivable
 * trends etc. using `@/lib/pit/facts-repository`. For now this is a
 * passthrough that warns when the PIT facts store is empty so callers
 * aren't silently misled.
 *
 * TODO(phase-2): compute F-score using ROA, CFO/TA, leverage, current ratio,
 * share count trend, gross margin, asset turnover, net income > 0.
 *
 * @module lib/funnel/stages/02-fundamental-health
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';

export interface FundamentalHealthOptions {
  readonly minFScore?: number;
}

export function makeFundamentalHealthStage(
  _options: FundamentalHealthOptions = {}
): Stage {
  return {
    name: 'fundamental-health',
    index: 2,
    async run(
      incoming: ReadonlyArray<Candidate>,
      _context: FunnelContext
    ): Promise<StageRunOutput> {
      return {
        candidates: incoming,
        warnings: ['fundamental-health not yet implemented; passthrough'],
      };
    },
  };
}
