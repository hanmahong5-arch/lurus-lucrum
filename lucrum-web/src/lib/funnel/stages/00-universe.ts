/**
 * Stage 00 — Resolve Universe
 *
 * Given a universe spec (sector code, custom symbol list, or watchlist id),
 * produce the initial list of Candidate entries. Uses PIT sector snapshots
 * when a sector is specified so history is unbiased.
 *
 * @module lib/funnel/stages/00-universe
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';
import { getPitSectorSnapshotRepository } from '@/lib/pit';

export interface UniverseSpec {
  readonly kind: 'sector' | 'symbols' | 'all';
  /** Required when kind === 'sector'. */
  readonly sectorCode?: string;
  /** Required when kind === 'symbols'. */
  readonly symbols?: ReadonlyArray<string>;
}

export interface UniverseStageOptions {
  readonly spec: UniverseSpec;
  /** Hard cap on the number of candidates to emit (for cost control). */
  readonly maxSize?: number;
}

export function makeUniverseStage(options: UniverseStageOptions): Stage {
  return {
    name: 'universe',
    index: 0,
    async run(
      _incoming: ReadonlyArray<Candidate>,
      context: FunnelContext
    ): Promise<StageRunOutput> {
      const warnings: string[] = [];
      let symbols: ReadonlyArray<string> = [];

      if (options.spec.kind === 'sector') {
        const code = options.spec.sectorCode;
        if (!code) {
          throw new Error('universe stage: sectorCode required when kind=sector');
        }
        const snap = getPitSectorSnapshotRepository();
        symbols = await snap.getComponents(code, context.asOfDate);
        if (symbols.length === 0) {
          warnings.push(
            `no sector snapshot for ${code} at ${context.asOfDate}; universe empty`
          );
        }
      } else if (options.spec.kind === 'symbols') {
        symbols = options.spec.symbols ?? [];
      } else {
        // 'all' is a placeholder — pulling the full A-share universe is expensive
        // and will be wired in Phase 2 once we cap by liquidity.
        warnings.push('universe kind=all not yet implemented; returning empty');
      }

      const cap = options.maxSize ?? Number.POSITIVE_INFINITY;
      const sliced = symbols.slice(0, Math.max(0, cap));
      const candidates: Candidate[] = sliced.map((symbol) => ({ symbol }));

      return {
        candidates,
        metrics: {
          spec_kind: options.spec.kind,
          requested_size: symbols.length,
          emitted_size: candidates.length,
        },
        warnings,
      };
    },
  };
}
