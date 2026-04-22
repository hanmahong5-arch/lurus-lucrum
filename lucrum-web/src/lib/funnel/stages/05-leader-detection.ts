/**
 * Stage 05 — Leader Detection.
 *
 * Runs sector-leader detection on the incoming candidate set. Leaders get
 * the "leader" tag; scores are blended with the pre-existing factor score
 * so downstream ordering lifts the leaders without overwriting factor
 * information.
 *
 * Blend: new_score = (1 - leaderWeight) * prior_score + leaderWeight * leader_score.
 *
 * @module lib/funnel/stages/05-leader-detection
 */

import type {
  Candidate,
  FunnelContext,
  Stage,
  StageRunOutput,
} from '../types';
import { detectLeaders } from '@/lib/leader';

export interface LeaderDetectionStageOptions {
  /** Trading-day window for contribution + first-LU scan. */
  readonly window?: number;
  /** Fraction of the set tagged as "leader" (default 20%). */
  readonly leaderQuantile?: number;
  /** Blend weight for the leader score (default 0.3). */
  readonly leaderWeight?: number;
  /** Skip the stage entirely if candidate count is below this. */
  readonly minCandidates?: number;
}

export function makeLeaderDetectionStage(
  options: LeaderDetectionStageOptions = {}
): Stage {
  const window = options.window ?? 20;
  const leaderQuantile = options.leaderQuantile ?? 0.2;
  const leaderWeight = options.leaderWeight ?? 0.3;
  const minCandidates = options.minCandidates ?? 3;

  return {
    name: 'leader-detection',
    index: 5,
    async run(
      incoming: ReadonlyArray<Candidate>,
      context: FunnelContext
    ): Promise<StageRunOutput> {
      if (incoming.length < minCandidates) {
        return {
          candidates: incoming,
          warnings: [
            `candidate count ${incoming.length} < min ${minCandidates}; leader detection skipped`,
          ],
        };
      }

      const symbols = incoming.map((c) => c.symbol);
      const detection = await detectLeaders({
        symbols,
        asOfDate: context.asOfDate,
        window,
        leaderQuantile,
      });

      const scoreBySymbol = new Map(
        detection.scores.map((s) => [s.symbol, s])
      );

      let leaderCount = 0;
      const updated = incoming.map<Candidate>((c) => {
        const det = scoreBySymbol.get(c.symbol);
        if (!det) return c;
        const prior = c.score ?? 0;
        const blended =
          (1 - leaderWeight) * prior + leaderWeight * det.score;

        const tags = c.tags ? [...c.tags] : [];
        if (det.isLeader && !tags.includes('leader')) {
          tags.push('leader');
          leaderCount += 1;
        }

        return {
          ...c,
          score: blended,
          scoreBreakdown: {
            ...(c.scoreBreakdown ?? {}),
            leader_score: det.score,
            leader_prior_score: prior,
          },
          tags,
        };
      });

      return {
        candidates: updated,
        metrics: {
          leaders_tagged: leaderCount,
          window,
          leader_weight: leaderWeight,
          sector_aware: detection.sectorAware ? 1 : 0,
        },
        warnings: detection.warnings,
      };
    },
  };
}
