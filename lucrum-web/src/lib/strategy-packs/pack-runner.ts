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
import { persistPackRun } from './pack-run-repository';

export interface PackRunOutput {
  readonly pack: StrategyPack;
  readonly result: FunnelResult;
}

export interface RunPackOptions {
  readonly request: PackRunRequest;
  readonly onEvent?: FunnelEventListener;
}

export interface RunPackDirectOptions {
  readonly pack: StrategyPack;
  readonly universe: PackRunRequest['universe'];
  readonly asOfDate?: string;
  readonly topN?: number;
  readonly userId?: string;
  readonly onEvent?: FunnelEventListener;
  readonly runIdPrefix?: string;
}

export async function runPack(options: RunPackOptions): Promise<PackRunOutput> {
  const { request } = options;
  const pack = getPack(request.packId);
  if (!pack) {
    throw new Error(`unknown pack: ${request.packId}`);
  }
  return runPackDirect({
    pack,
    universe: request.universe,
    asOfDate: request.asOfDate,
    topN: request.topN,
    userId: request.userId,
    onEvent: options.onEvent,
    runIdPrefix: `pack-${pack.id}`,
  });
}

export async function runPackDirect(
  options: RunPackDirectOptions
): Promise<PackRunOutput> {
  const { pack } = options;
  const universe = options.universe;

  if (universe.kind === 'sector' && !universe.sectorCode) {
    throw new Error('universe.sectorCode required for kind=sector');
  }
  if (
    universe.kind === 'symbols' &&
    (!universe.symbols || universe.symbols.length === 0)
  ) {
    throw new Error('universe.symbols must be non-empty for kind=symbols');
  }

  const context = createFunnelContext({
    asOfDate: options.asOfDate,
    options: {
      packId: pack.id,
      packName: pack.name,
      universe,
      asOfDate: options.asOfDate,
      topN: options.topN,
    },
    userId: options.userId,
    runIdPrefix: options.runIdPrefix ?? `pack-${pack.id}`,
  });

  const portfolio = {
    ...pack.portfolio,
    topN: options.topN ?? pack.portfolio.topN ?? 10,
  };

  const stages = buildPipeline([
    makeUniverseStage({
      spec: {
        kind: universe.kind,
        sectorCode: universe.sectorCode,
        symbols: universe.symbols ? [...universe.symbols] : undefined,
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

  await persistPackRun({
    context,
    result,
    universe: {
      kind: universe.kind,
      sectorCode: universe.sectorCode,
      symbols: universe.symbols,
    },
    pack: { id: pack.id, name: pack.name },
    topN: options.topN ?? pack.portfolio.topN,
  });

  return { pack, result };
}
