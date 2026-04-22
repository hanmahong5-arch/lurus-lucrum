/**
 * Pack runner — convert a StrategyPack into a funnel pipeline and execute.
 *
 * The pack knobs drive every configurable stage:
 *   - universe    → stage 00 spec
 *   - hardFilter  → stage 01 options
 *   - factorWeights, klineWindow → stage 04 options
 *   - leaderWeight → stage 05 options
 *   - portfolio   → stage 06 options
 *
 * Returns the FunnelResult plus a snapshot of the pack metadata so the
 * UI can show "by 价值蓝筹" next to results.
 *
 * @module lib/strategy-packs/pack-runner
 */

import {
  runPipeline,
  createFunnelContext,
  buildPipeline,
  type FunnelEventListener,
  type FunnelResult,
} from '@/lib/funnel';
import {
  makeUniverseStage,
  makeHardFilterStage,
  makeFundamentalHealthStage,
  makeSignalStage,
  makeFactorScoreStage,
  makeLeaderDetectionStage,
  makePortfolioConstructionStage,
  makeBacktestValidationStage,
} from '@/lib/funnel/stages';
import type { PackRunRequest, StrategyPack } from './types';
import { getPack } from './packs';

export interface PackRunOutput {
  readonly pack: StrategyPack;
  readonly result: FunnelResult;
}

export interface RunPackOptions {
  readonly request: PackRunRequest;
  readonly onEvent?: FunnelEventListener;
}

export async function runPack(options: RunPackOptions): Promise<PackRunOutput> {
  const { request } = options;
  const pack = getPack(request.packId);
  if (!pack) {
    throw new Error(`unknown pack: ${request.packId}`);
  }

  if (
    request.universe.kind === 'sector' &&
    !request.universe.sectorCode
  ) {
    throw new Error('universe.sectorCode required for kind=sector');
  }
  if (
    request.universe.kind === 'symbols' &&
    (!request.universe.symbols || request.universe.symbols.length === 0)
  ) {
    throw new Error('universe.symbols must be non-empty for kind=symbols');
  }

  const context = createFunnelContext({
    asOfDate: request.asOfDate,
    options: { ...request, packName: pack.name },
    userId: request.userId,
    runIdPrefix: `pack-${pack.id}`,
  });

  const portfolio = {
    ...pack.portfolio,
    topN: request.topN ?? pack.portfolio.topN ?? 10,
  };

  const stages = buildPipeline([
    makeUniverseStage({
      spec: {
        kind: request.universe.kind,
        sectorCode: request.universe.sectorCode,
        symbols: request.universe.symbols
          ? [...request.universe.symbols]
          : undefined,
      },
    }),
    makeHardFilterStage(pack.hardFilter),
    makeFundamentalHealthStage(),
    makeSignalStage(),
    makeFactorScoreStage({
      weights: pack.factorWeights,
      klineWindow: pack.klineWindow,
    }),
    makeLeaderDetectionStage({
      leaderWeight: pack.leaderWeight,
    }),
    makePortfolioConstructionStage(portfolio),
    makeBacktestValidationStage(),
  ]);

  const result = await runPipeline({
    stages,
    context,
    onEvent: options.onEvent,
  });

  return { pack, result };
}
