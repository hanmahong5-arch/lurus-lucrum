/**
 * Stage 04 — Factor Score.
 *
 * Computes cross-sectional factor z-scores over the current candidate set
 * and writes a composite score into `candidate.score`. Downstream stages
 * (leader detection, portfolio construction) see the updated score.
 *
 * Default factor basket is K-line-only (momentum + volatility + liquidity)
 * so it works out-of-the-box before the PIT fundamental ETL lands. Value
 * and quality factors are included once pit-facts has data — they'll
 * simply be skipped (with a warning) when coverage is below the threshold.
 *
 * @module lib/funnel/stages/04-factor-score
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';
import {
  buildKlineFetcher,
  computeFactorMatrix,
  getFactor,
  scoreCrossSection,
  type FactorDefinition,
  type FactorWeight,
} from '@/lib/factors';

export interface FactorScoreOptions {
  /** Factor id → weight. Defaults to a balanced K-line basket. */
  readonly weights?: ReadonlyArray<FactorWeight>;
  /** Kline lookback in trading days (default 260 ≈ 1 year). */
  readonly klineWindow?: number;
  /** Minimum coverage before a factor is counted (default 3). */
  readonly minCoverage?: number;
}

const DEFAULT_WEIGHTS: ReadonlyArray<FactorWeight> = [
  { factorId: 'momentum_3m', weight: 1.0 },
  { factorId: 'momentum_6m', weight: 1.0 },
  { factorId: 'momentum_12m_1m', weight: 0.5 },
  { factorId: 'volatility_realized_20d', weight: 0.8 },
  { factorId: 'amihud_illiq_20d', weight: 0.5 },
  { factorId: 'adv_20d', weight: 0.3 },
  { factorId: 'quality_roe', weight: 0.8 },
  { factorId: 'value_pe_ttm', weight: 0.6 },
];

export function makeFactorScoreStage(
  options: FactorScoreOptions = {}
): Stage {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const klineWindow = options.klineWindow ?? 260;
  const minCoverage = options.minCoverage ?? 3;

  return {
    name: 'factor-score',
    index: 4,
    async run(
      incoming: ReadonlyArray<Candidate>,
      context: FunnelContext
    ): Promise<StageRunOutput> {
      if (incoming.length === 0) {
        return { candidates: [], metrics: { factors_used: 0 } };
      }

      const symbols = incoming.map((c) => c.symbol);
      const defs: FactorDefinition[] = [];
      const missingFactors: string[] = [];
      for (const w of weights) {
        const def = getFactor(w.factorId);
        if (!def) {
          missingFactors.push(w.factorId);
          continue;
        }
        defs.push(def);
      }

      const fetcher = buildKlineFetcher({
        symbols,
        asOfDate: context.asOfDate,
        klineWindow,
      });

      const matrix = await computeFactorMatrix({
        symbols,
        factors: defs,
        compute: (def) =>
          def.compute({
            symbols,
            asOfDate: context.asOfDate,
            klineWindow,
            getKlines: fetcher,
          }),
      });

      const result = scoreCrossSection(matrix, defs, weights, {
        minCoverage,
      });

      const scoreBySymbol = new Map(
        result.scores.map((s) => [s.symbol, s])
      );

      const scored = incoming.map<Candidate>((c) => {
        const s = scoreBySymbol.get(c.symbol);
        if (!s) return c;
        const cleaned: Record<string, number> = {};
        for (const [fid, v] of Object.entries(s.breakdown)) {
          if (v !== null && Number.isFinite(v)) cleaned[fid] = v;
        }
        return {
          ...c,
          score: s.score,
          scoreBreakdown: {
            ...(c.scoreBreakdown ?? {}),
            ...cleaned,
            factor_composite: s.raw,
          },
        };
      });

      const warnings: string[] = [...result.warnings];
      if (missingFactors.length > 0) {
        warnings.push(
          `factors not registered: ${missingFactors.join(', ')}`
        );
      }

      return {
        candidates: scored,
        metrics: {
          factors_used: result.factorsUsed.length,
          factors_skipped: result.factorsSkipped.length,
          kline_window: klineWindow,
        },
        warnings,
      };
    },
  };
}
