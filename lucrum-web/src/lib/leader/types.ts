/**
 * Leader detection — core types.
 *
 * A leader is a stock that drives its sector's move. We compute three
 * signals — contribution, first-limit-up timing, and money flow — and
 * blend them into a single `leaderScore` in [0, 1].
 *
 * @module lib/leader/types
 */

export interface LeaderSignals {
  /** Excess return vs sector median over the lookback window. */
  readonly contribution: number | null;
  /** Trading-day index of first limit-up within the window (0 = oldest). null = never. */
  readonly firstLimitUpIdx: number | null;
  /** Main-force net inflow rank in [0, 1]. null = data unavailable. */
  readonly moneyFlowRank: number | null;
}

export interface LeaderScore {
  readonly symbol: string;
  readonly score: number;
  readonly signals: LeaderSignals;
  readonly isLeader: boolean;
}

export interface LeaderDetectionResult {
  readonly scores: ReadonlyArray<LeaderScore>;
  readonly warnings: ReadonlyArray<string>;
  /** Whether the detector ran against a sector (true) or a flat universe. */
  readonly sectorAware: boolean;
}
