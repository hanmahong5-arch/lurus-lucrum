/**
 * Stage 06 — Portfolio Construction
 *
 * Minimal viable implementation: sort by composite score (descending) and
 * take the top N. Phase 4 will add HHI/industry/correlation constraints
 * and position-sizing (vol-target, equal-risk, Kelly, etc.).
 *
 * @module lib/funnel/stages/06-portfolio-construction
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';

export interface PortfolioConstructionOptions {
  readonly topN?: number;
  /** If true, drop candidates with no score. Default: false (treat as 0). */
  readonly requireScore?: boolean;
}

export function makePortfolioConstructionStage(
  options: PortfolioConstructionOptions = {}
): Stage {
  const topN = options.topN ?? 10;
  const requireScore = options.requireScore ?? false;

  return {
    name: 'portfolio-construction',
    index: 6,
    async run(
      incoming: ReadonlyArray<Candidate>,
      _context: FunnelContext
    ): Promise<StageRunOutput> {
      const pool = requireScore
        ? incoming.filter((c) => typeof c.score === 'number')
        : incoming;

      const sorted = [...pool].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0)
      );
      const picks = sorted.slice(0, topN);

      // Stage 7+ will turn scores into position weights; for now we
      // annotate equal weight just so the portfolio is actionable.
      const equalWeight = picks.length > 0 ? 1 / picks.length : 0;
      const weighted = picks.map((c) => ({
        ...c,
        notes: {
          ...(c.notes ?? {}),
          weight: equalWeight.toFixed(4),
        },
      }));

      return {
        candidates: weighted,
        metrics: {
          input_size: incoming.length,
          selected: picks.length,
          top_score: picks[0]?.score ?? 0,
          bottom_score: picks[picks.length - 1]?.score ?? 0,
        },
      };
    },
  };
}
