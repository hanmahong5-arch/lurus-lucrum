/**
 * Stage 01 — Hard Filter
 *
 * Removes structurally un-tradable candidates: ST, delisted, halted on
 * `asOfDate`, recently listed, below a liquidity floor. Uses PIT repos so
 * status is judged as-of the run date, not today.
 *
 * @module lib/funnel/stages/01-hard-filter
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';
import { getPitCalendarRepository } from '@/lib/pit';
import { getStockRepository } from '@/lib/repositories';

export interface HardFilterOptions {
  readonly excludeST?: boolean;
  readonly excludeDelisted?: boolean;
  readonly excludeHalted?: boolean;
  readonly minListingDays?: number;
  readonly minMarketCap?: number;
}

export function makeHardFilterStage(
  options: HardFilterOptions = {}
): Stage {
  const excludeST = options.excludeST ?? true;
  const excludeDelisted = options.excludeDelisted ?? true;
  const excludeHalted = options.excludeHalted ?? true;
  const minListingDays = options.minListingDays ?? 60;
  const minMarketCap = options.minMarketCap;

  return {
    name: 'hard-filter',
    index: 1,
    async run(
      incoming: ReadonlyArray<Candidate>,
      context: FunnelContext
    ): Promise<StageRunOutput> {
      if (incoming.length === 0) {
        return { candidates: [], metrics: { dropped: 0 } };
      }

      const stockRepo = getStockRepository();
      const calendar = getPitCalendarRepository();

      const symbols = incoming.map((c) => c.symbol);
      const exclude: Array<'ST' | 'suspended' | 'delisted'> = [];
      if (excludeDelisted) exclude.push('delisted');
      if (excludeST) exclude.push('ST');
      const stockRows = await stockRepo.filterActiveAsOf(
        symbols,
        context.asOfDate,
        exclude
      );
      const byStatus = new Set(stockRows.map((s) => s.symbol));

      const kept: Candidate[] = [];
      const drops = { status: 0, listing: 0, halt: 0, cap: 0 };
      const stockBySymbol = new Map(stockRows.map((s) => [s.symbol, s]));

      for (const cand of incoming) {
        if (!byStatus.has(cand.symbol)) {
          drops.status += 1;
          continue;
        }
        const s = stockBySymbol.get(cand.symbol);
        if (!s) {
          drops.status += 1;
          continue;
        }
        if (minListingDays && s.listingDate) {
          const cutoff = new Date(context.asOfDate);
          cutoff.setDate(cutoff.getDate() - minListingDays);
          const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
          if (s.listingDate > cutoffStr) {
            drops.listing += 1;
            continue;
          }
        }
        if (
          minMarketCap !== undefined &&
          (s.marketCap === null || s.marketCap < minMarketCap)
        ) {
          drops.cap += 1;
          continue;
        }
        if (excludeHalted) {
          const halted = await calendar.isHalted(cand.symbol, context.asOfDate);
          if (halted) {
            drops.halt += 1;
            continue;
          }
        }
        kept.push({ ...cand, name: s.name });
      }

      return {
        candidates: kept,
        metrics: {
          dropped_status: drops.status,
          dropped_listing: drops.listing,
          dropped_halt: drops.halt,
          dropped_cap: drops.cap,
          dropped_total:
            drops.status + drops.listing + drops.halt + drops.cap,
        },
      };
    },
  };
}
