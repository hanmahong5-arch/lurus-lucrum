/**
 * Pack run repository — best-effort persistence of funnel pipeline results.
 *
 * Writes a single header row into `pack_runs` plus one row per stage into
 * `pack_run_stages`. Downstream jobs (alpha-decay tracker, drift monitor,
 * slippage attribution) read from these tables.
 *
 * Design:
 *   - Best-effort: persistence failure MUST NOT break the user's pipeline run.
 *     All errors are caught and logged, nothing is thrown back to the caller.
 *   - Conflict-safe: `run_id` has a unique index, so re-persisting the same
 *     run is a no-op (ON CONFLICT DO NOTHING on both tables).
 *   - Bounded payloads: `top_candidates` is capped at
 *     MAX_TOP_CANDIDATES to keep row size reasonable.
 *
 * @module lib/strategy-packs/pack-run-repository
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  packRuns,
  packRunStages,
  type NewPackRun,
  type NewPackRunStage,
} from '@/lib/db/schema';
import type {
  Candidate,
  FunnelContext,
  FunnelResult,
  StageEval,
} from '@/lib/funnel';
import type { StrategyPack } from './types';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const MAX_TOP_CANDIDATES = 50;
const MAX_ERROR_MESSAGE_LENGTH = 2000;

export interface UniverseSpec {
  readonly kind: 'sector' | 'symbols' | 'all';
  readonly sectorCode?: string;
  readonly symbols?: ReadonlyArray<string>;
}

export interface PersistPackRunInput {
  readonly context: FunnelContext;
  readonly result: FunnelResult;
  readonly universe: UniverseSpec;
  readonly pack?: Pick<StrategyPack, 'id' | 'name'>;
  readonly topN?: number;
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}

function trimCandidates(candidates: ReadonlyArray<Candidate>): Array<Candidate> {
  if (candidates.length <= MAX_TOP_CANDIDATES) return [...candidates];
  return candidates.slice(0, MAX_TOP_CANDIDATES);
}

function buildHeaderRow(input: PersistPackRunInput): NewPackRun {
  const { context, result, universe, pack, topN } = input;

  return {
    runId: context.runId,
    userId: context.userId ?? null,
    packId: pack?.id ?? null,
    packName: pack?.name ?? null,
    asOfDate: context.asOfDate,
    universeKind: universe.kind,
    universeSectorCode: universe.sectorCode ?? null,
    universeSymbols: universe.symbols ? [...universe.symbols] : null,
    topN: topN ?? null,
    durationMs: result.durationMs,
    status: result.error ? 'error' : 'success',
    errorStage: result.error?.stageName ?? null,
    errorCode: result.error?.code ?? null,
    errorMessage: result.error
      ? truncate(result.error.message, MAX_ERROR_MESSAGE_LENGTH)
      : null,
    candidateCount: result.candidates.length,
    topCandidates: trimCandidates(result.candidates),
    flags: context.flags,
    options: context.options,
  };
}

function buildStageRows(
  runId: string,
  evals: ReadonlyArray<StageEval>,
): Array<NewPackRunStage> {
  return evals.map((ev) => ({
    runId,
    stageIndex: ev.stageIndex,
    stageName: ev.stageName,
    inputSize: ev.inputSize,
    outputSize: ev.outputSize,
    keepRatio: ev.keepRatio,
    durationMs: ev.durationMs,
    metrics: ev.metrics,
    warnings: [...ev.warnings],
  }));
}

/**
 * Persist a completed pipeline run. Safe to await or fire-and-forget —
 * never throws back to the caller.
 */
export async function persistPackRun(input: PersistPackRunInput): Promise<void> {
  try {
    const header = buildHeaderRow(input);
    await db.insert(packRuns).values(header).onConflictDoNothing({
      target: packRuns.runId,
    });

    const stageRows = buildStageRows(input.context.runId, input.result.evals);
    if (stageRows.length > 0) {
      await db.insert(packRunStages).values(stageRows).onConflictDoNothing();
    }
  } catch (err) {
    // Best-effort: never let persistence failures break user flows.
    // eslint-disable-next-line no-console
    console.error('[pack-run-repository] persist failed', {
      runId: input.context.runId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Read-side queries for the monitoring dashboard.
// ---------------------------------------------------------------------------

export interface PackRunListItem {
  readonly runId: string;
  readonly packId: string | null;
  readonly packName: string | null;
  readonly asOfDate: string;
  readonly universeKind: string;
  readonly universeSectorCode: string | null;
  readonly status: 'success' | 'error';
  readonly errorStage: string | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly candidateCount: number;
  readonly createdAt: string;
}

function clampLimit(requested: number | undefined): number {
  if (!Number.isFinite(requested)) return DEFAULT_LIST_LIMIT;
  const n = Math.round(requested as number);
  if (n < 1) return 1;
  if (n > MAX_LIST_LIMIT) return MAX_LIST_LIMIT;
  return n;
}

/**
 * List recent pack runs for a user, newest first. Returns a trimmed row
 * suitable for list rendering; detail payloads (top_candidates, stage
 * metrics) are fetched separately.
 */
export async function getRecentPackRuns(
  userId: string,
  limitRaw?: number,
): Promise<ReadonlyArray<PackRunListItem>> {
  const limit = clampLimit(limitRaw);
  const rows = await db
    .select({
      runId: packRuns.runId,
      packId: packRuns.packId,
      packName: packRuns.packName,
      asOfDate: packRuns.asOfDate,
      universeKind: packRuns.universeKind,
      universeSectorCode: packRuns.universeSectorCode,
      status: packRuns.status,
      errorStage: packRuns.errorStage,
      errorMessage: packRuns.errorMessage,
      durationMs: packRuns.durationMs,
      candidateCount: packRuns.candidateCount,
      createdAt: packRuns.createdAt,
    })
    .from(packRuns)
    .where(eq(packRuns.userId, userId))
    .orderBy(desc(packRuns.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    runId: r.runId,
    packId: r.packId,
    packName: r.packName,
    asOfDate: r.asOfDate,
    universeKind: r.universeKind,
    universeSectorCode: r.universeSectorCode,
    status: r.status === 'error' ? 'error' : 'success',
    errorStage: r.errorStage,
    errorMessage: r.errorMessage,
    durationMs: r.durationMs,
    candidateCount: r.candidateCount,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface PackRunStageRow {
  readonly stageIndex: number;
  readonly stageName: string;
  readonly inputSize: number;
  readonly outputSize: number;
  readonly keepRatio: number;
  readonly durationMs: number;
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Fetch per-stage evaluations for a given run (owner-scoped via userId).
 * Returns an empty array if the run isn't found or isn't owned by userId.
 */
export async function getPackRunStages(
  userId: string,
  runId: string,
): Promise<ReadonlyArray<PackRunStageRow>> {
  const ownerRow = await db
    .select({ runId: packRuns.runId })
    .from(packRuns)
    .where(and(eq(packRuns.runId, runId), eq(packRuns.userId, userId)))
    .limit(1);
  if (ownerRow.length === 0) return [];

  const rows = await db
    .select({
      stageIndex: packRunStages.stageIndex,
      stageName: packRunStages.stageName,
      inputSize: packRunStages.inputSize,
      outputSize: packRunStages.outputSize,
      keepRatio: packRunStages.keepRatio,
      durationMs: packRunStages.durationMs,
      warnings: packRunStages.warnings,
    })
    .from(packRunStages)
    .where(eq(packRunStages.runId, runId))
    .orderBy(packRunStages.stageIndex);

  return rows.map((r) => ({
    stageIndex: r.stageIndex,
    stageName: r.stageName,
    inputSize: r.inputSize,
    outputSize: r.outputSize,
    keepRatio: r.keepRatio,
    durationMs: r.durationMs,
    warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
  }));
}

// ---------------------------------------------------------------------------
// Pack-level aggregation for the monitoring dashboard.
// ---------------------------------------------------------------------------

export interface PackRunAggregate {
  readonly packId: string | null;
  readonly packName: string | null;
  readonly totalRuns: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly successRate: number | null;
  readonly avgDurationMs: number | null;
  readonly avgCandidateCount: number | null;
  readonly lastRunAt: string;
}

type AggRow = {
  pack_id: string | null;
  pack_name: string | null;
  total_runs: string | number;
  success_count: string | number;
  error_count: string | number;
  avg_duration_ms: string | number | null;
  avg_candidate_count: string | number | null;
  last_run_at: Date | string;
};

function unwrapRows<T>(raw: unknown): T[] {
  const maybeRowsWrapper = raw as { rows?: T[] } | T[];
  if (Array.isArray(maybeRowsWrapper)) return maybeRowsWrapper;
  return maybeRowsWrapper.rows ?? [];
}

function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Aggregate recent pack runs for a user, grouped by (pack_id, pack_name).
 * Null pack_id groups together as "freeform funnel runs" (no preset pack).
 * Rows ordered by most-recent run DESC so active packs surface first.
 */
export async function getPackRunAggregates(
  userId: string,
): Promise<ReadonlyArray<PackRunAggregate>> {
  const raw = await db.execute<AggRow>(sql`
    SELECT
      pack_id,
      pack_name,
      COUNT(*)::bigint                                      AS total_runs,
      COUNT(*) FILTER (WHERE status = 'success')::bigint    AS success_count,
      COUNT(*) FILTER (WHERE status = 'error')::bigint      AS error_count,
      AVG(duration_ms)                                      AS avg_duration_ms,
      AVG(candidate_count)                                  AS avg_candidate_count,
      MAX(created_at)                                       AS last_run_at
    FROM pack_runs
    WHERE user_id = ${userId}
    GROUP BY pack_id, pack_name
    ORDER BY last_run_at DESC
  `);

  return unwrapRows<AggRow>(raw).map((r) => {
    const total = Number(r.total_runs ?? 0);
    const success = Number(r.success_count ?? 0);
    return {
      packId: r.pack_id,
      packName: r.pack_name,
      totalRuns: total,
      successCount: success,
      errorCount: Number(r.error_count ?? 0),
      successRate: total > 0 ? success / total : null,
      avgDurationMs: toNumberOrNull(r.avg_duration_ms),
      avgCandidateCount: toNumberOrNull(r.avg_candidate_count),
      lastRunAt:
        r.last_run_at instanceof Date
          ? r.last_run_at.toISOString()
          : String(r.last_run_at),
    };
  });
}

// ---------------------------------------------------------------------------
// Stage-level aggregation — surfaces funnel bottlenecks across all runs.
// ---------------------------------------------------------------------------

export interface StageAggregate {
  readonly stageName: string;
  readonly totalEvals: number;
  readonly avgInputSize: number | null;
  readonly avgOutputSize: number | null;
  readonly avgKeepRatio: number | null;
  readonly avgDurationMs: number | null;
  readonly warnCount: number;
  readonly warnRate: number | null;
}

type StageAggRow = {
  stage_name: string;
  total_evals: string | number;
  avg_input_size: string | number | null;
  avg_output_size: string | number | null;
  avg_keep_ratio: string | number | null;
  avg_duration_ms: string | number | null;
  warn_count: string | number;
};

/**
 * Aggregate stage evaluations across all of the caller's pack runs, grouped by
 * stage_name. Joins pack_run_stages → pack_runs for owner scoping (stages
 * table has no user_id column of its own). Ordered by total_evals DESC so the
 * most-exercised stages surface first.
 */
export async function getStageAggregates(
  userId: string,
): Promise<ReadonlyArray<StageAggregate>> {
  const raw = await db.execute<StageAggRow>(sql`
    SELECT
      s.stage_name,
      COUNT(*)::bigint                                                            AS total_evals,
      AVG(s.input_size)                                                           AS avg_input_size,
      AVG(s.output_size)                                                          AS avg_output_size,
      AVG(s.keep_ratio)                                                           AS avg_keep_ratio,
      AVG(s.duration_ms)                                                          AS avg_duration_ms,
      COUNT(*) FILTER (WHERE jsonb_array_length(s.warnings) > 0)::bigint          AS warn_count
    FROM pack_run_stages s
    INNER JOIN pack_runs r ON r.run_id = s.run_id
    WHERE r.user_id = ${userId}
    GROUP BY s.stage_name
    ORDER BY total_evals DESC
  `);

  return unwrapRows<StageAggRow>(raw).map((r) => {
    const total = Number(r.total_evals ?? 0);
    const warn = Number(r.warn_count ?? 0);
    return {
      stageName: r.stage_name,
      totalEvals: total,
      avgInputSize: toNumberOrNull(r.avg_input_size),
      avgOutputSize: toNumberOrNull(r.avg_output_size),
      avgKeepRatio: toNumberOrNull(r.avg_keep_ratio),
      avgDurationMs: toNumberOrNull(r.avg_duration_ms),
      warnCount: warn,
      warnRate: total > 0 ? warn / total : null,
    };
  });
}
