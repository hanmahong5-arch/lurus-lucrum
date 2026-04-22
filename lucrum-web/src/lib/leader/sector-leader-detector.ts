/**
 * Sector-leader detector.
 *
 * For a given universe (ideally a sector's component list) compute each
 * symbol's excess return over the cross-sectional median, blend with the
 * first-limit-up timing, and emit a normalised leader score.
 *
 * Missing signals (e.g. money flow API not wired) are treated as neutral
 * rather than disqualifying — the detector degrades gracefully.
 *
 * @module lib/leader/sector-leader-detector
 */

import type { FactorKlineBar, KlineFetcher } from '@/lib/factors';
import { buildKlineFetcher } from '@/lib/factors';
import { findFirstLimitUp } from './first-limit-up-tracker';
import type {
  LeaderDetectionResult,
  LeaderScore,
  LeaderSignals,
} from './types';

export interface DetectLeadersArgs {
  readonly symbols: ReadonlyArray<string>;
  readonly asOfDate: string;
  /** Trading-day window for contribution and limit-up scan. */
  readonly window?: number;
  /** Fraction of ranked universe marked as leader (default 0.2 = top 20%). */
  readonly leaderQuantile?: number;
  /** Optional injected fetcher for tests. */
  readonly fetcher?: KlineFetcher;
  /** Optional money-flow provider. Returns rank in [0,1] per symbol. */
  readonly moneyFlowProvider?: (
    symbols: ReadonlyArray<string>,
    asOfDate: string
  ) => Promise<ReadonlyMap<string, number | null>>;
}

function adjClose(bar: FactorKlineBar): number {
  return bar.close * (bar.adjFactor || 1);
}

function windowReturn(bars: ReadonlyArray<FactorKlineBar>, window: number): number | null {
  if (bars.length < window + 1) return null;
  const slice = bars.slice(-(window + 1));
  const start = slice[0];
  const end = slice[slice.length - 1];
  if (!start || !end) return null;
  const sp = adjClose(start);
  const ep = adjClose(end);
  if (sp <= 0 || ep <= 0) return null;
  return ep / sp - 1;
}

function median(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export async function detectLeaders(
  args: DetectLeadersArgs
): Promise<LeaderDetectionResult> {
  const window = args.window ?? 20;
  const leaderQuantile = args.leaderQuantile ?? 0.2;
  const warnings: string[] = [];

  const fetcher =
    args.fetcher ??
    buildKlineFetcher({
      symbols: args.symbols,
      asOfDate: args.asOfDate,
      klineWindow: window + 10,
    });

  // Gather per-symbol return and first-limit-up.
  const signals = new Map<string, LeaderSignals>();
  const rets: number[] = [];
  for (const symbol of args.symbols) {
    const bars = await fetcher(symbol);
    const ret = windowReturn(bars, window);
    const firstLu = findFirstLimitUp({ symbol, bars, window });
    signals.set(symbol, {
      contribution: ret,
      firstLimitUpIdx: firstLu,
      moneyFlowRank: null,
    });
    if (ret !== null) rets.push(ret);
  }

  if (rets.length === 0) {
    warnings.push('no valid return series; leader detection skipped');
    return {
      scores: args.symbols.map((symbol) => ({
        symbol,
        score: 0,
        signals: signals.get(symbol) ?? {
          contribution: null,
          firstLimitUpIdx: null,
          moneyFlowRank: null,
        },
        isLeader: false,
      })),
      warnings,
      sectorAware: args.symbols.length > 1,
    };
  }

  const med = median(rets);

  // Optional money flow pass.
  let flowMap: ReadonlyMap<string, number | null> = new Map();
  if (args.moneyFlowProvider) {
    try {
      flowMap = await args.moneyFlowProvider(args.symbols, args.asOfDate);
    } catch (err) {
      warnings.push(
        `money flow provider threw: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Build raw scores then rank.
  const raw: Array<{ symbol: string; value: number; signals: LeaderSignals }> = [];
  for (const symbol of args.symbols) {
    const sig = signals.get(symbol);
    if (!sig) continue;
    const mf = flowMap.get(symbol) ?? null;
    const merged: LeaderSignals = { ...sig, moneyFlowRank: mf };

    // Contribution: max(0, ret - median). Missing → 0.
    const contribScore =
      merged.contribution !== null ? Math.max(0, merged.contribution - med) : 0;
    // First LU: earlier = higher. Normalise to [0, 1] over the window.
    const luScore =
      merged.firstLimitUpIdx !== null
        ? 1 - merged.firstLimitUpIdx / Math.max(1, window - 1)
        : 0;
    // Money flow rank is already in [0, 1]; neutral 0.5 when missing.
    const mfScore = merged.moneyFlowRank ?? 0.5;

    // Weighted blend — contribution dominates, LU adds breakout info,
    // money flow confirms smart-money participation.
    const weighted = 0.6 * contribScore + 0.25 * luScore + 0.15 * mfScore;
    raw.push({ symbol, value: weighted, signals: merged });
  }

  // Rank to [0, 1] CDF.
  const sorted = [...raw].sort((a, b) => a.value - b.value);
  const rankBySymbol = new Map<string, number>();
  sorted.forEach((r, i) => {
    rankBySymbol.set(r.symbol, (i + 1) / sorted.length);
  });

  const leaderThreshold = 1 - leaderQuantile;
  const scores: LeaderScore[] = raw.map((r) => {
    const score = rankBySymbol.get(r.symbol) ?? 0;
    return {
      symbol: r.symbol,
      score,
      signals: r.signals,
      isLeader: score >= leaderThreshold,
    };
  });

  return {
    scores,
    warnings,
    sectorAware: args.symbols.length > 1,
  };
}
