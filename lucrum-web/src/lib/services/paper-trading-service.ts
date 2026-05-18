/**
 * Paper Trading Service — Sprint 1 skeleton.
 *
 * Provides the create / read / list / close lifecycle for paper-trading
 * sessions. The real-time mark-to-market sweep and broker-style execution
 * loop are Sprint 2 work; this module deliberately stops at "persisted
 * intent + seeded initial position from the originating backtest" so the
 * LiveSignalCard CTA has somewhere to POST today.
 *
 * Forward-looking shape:
 *   - `tickPositions(runId, prices)` will be called by a scheduled job
 *     that pulls EOD prices via PIT and updates positions + equity curve.
 *   - `applyStrategySignal(runId, signal)` will be called when the
 *     strategy worker emits a buy/sell event for an active run.
 *   - Neither exists yet — the interface is named explicitly so call
 *     sites can fail loudly if they accidentally bind to a stub.
 *
 * @module lib/services/paper-trading-service
 */

import { db } from '@/lib/db';
import {
  paperRuns,
  paperPositions,
  paperTrades,
  paperEquityCurve,
  type PaperRun,
  type PaperTrade,
  type PaperPosition,
} from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Errors — small dedicated classes so call sites can branch on cause.
// ---------------------------------------------------------------------------

export class PaperRunNotFoundError extends Error {
  readonly code = 'PAPER_RUN_NOT_FOUND';
  constructor(runId: number) {
    super(`paper_run ${runId} not found`);
    this.name = 'PaperRunNotFoundError';
  }
}

export class PaperRunOwnershipError extends Error {
  readonly code = 'PAPER_RUN_NOT_OWNED';
  constructor(runId: number, userId: string) {
    super(`paper_run ${runId} not owned by user ${userId}`);
    this.name = 'PaperRunOwnershipError';
  }
}

export class PaperRunStateError extends Error {
  readonly code = 'PAPER_RUN_INVALID_STATE';
  constructor(message: string) {
    super(message);
    this.name = 'PaperRunStateError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreatePaperRunInput {
  userId: string;
  strategyHistoryId?: number | null;
  marketplaceStrategyId?: number | null;
  initialCapital?: number;
  strategyName?: string | null;
  symbol?: string | null;
  /**
   * Optional seed position carried over from the originating backtest's
   * end state. When provided, the run starts with this holding (avg cost
   * = current market reference) instead of all-cash.
   */
  seedPosition?: {
    symbol: string;
    qty: number;
    avgCost: number;
  } | null;
}

const DEFAULT_INITIAL_CAPITAL = 100_000;
const MIN_INITIAL_CAPITAL = 1_000;
const MAX_INITIAL_CAPITAL = 100_000_000;

function validateInitialCapital(value: number | undefined): number {
  if (value == null) return DEFAULT_INITIAL_CAPITAL;
  if (!Number.isFinite(value) || value < MIN_INITIAL_CAPITAL || value > MAX_INITIAL_CAPITAL) {
    throw new PaperRunStateError(
      `initialCapital must be between ${MIN_INITIAL_CAPITAL} and ${MAX_INITIAL_CAPITAL}`,
    );
  }
  return value;
}

/**
 * Create a new paper-trading run. Idempotent on (userId, strategyHistoryId)
 * is NOT required — a user can reasonably start the same strategy multiple
 * times with different capital and we want each run isolated.
 */
export async function createPaperRun(input: CreatePaperRunInput): Promise<PaperRun> {
  const initialCapital = validateInitialCapital(input.initialCapital);

  const [run] = await db
    .insert(paperRuns)
    .values({
      userId: input.userId,
      strategyHistoryId: input.strategyHistoryId ?? null,
      marketplaceStrategyId: input.marketplaceStrategyId ?? null,
      strategyName: input.strategyName ?? null,
      symbol: input.symbol ?? null,
      initialCapital,
      status: 'active',
    })
    .returning();

  if (!run) {
    throw new Error('paper_runs insert returned no row');
  }

  // Seed initial position if the originating backtest ended long. Cost is
  // taken at face value — Sprint 2's PIT-aware engine will reconcile this
  // against the actual EOD print on first MTM.
  if (input.seedPosition && input.seedPosition.qty > 0) {
    await db.insert(paperPositions).values({
      runId: run.id,
      symbol: input.seedPosition.symbol,
      qty: input.seedPosition.qty,
      avgCost: input.seedPosition.avgCost,
      lastPrice: input.seedPosition.avgCost,
    });
  }

  return run;
}

/**
 * Load a single run including positions + recent trades. Enforces
 * ownership; throws PaperRunOwnershipError if the user doesn't own it.
 */
export async function getPaperRun(
  userId: string,
  runId: number,
  options?: { tradesLimit?: number },
): Promise<{
  run: PaperRun;
  positions: PaperPosition[];
  recentTrades: PaperTrade[];
}> {
  const runRows = await db
    .select()
    .from(paperRuns)
    .where(eq(paperRuns.id, runId))
    .limit(1);

  const run = runRows[0];
  if (!run) {
    throw new PaperRunNotFoundError(runId);
  }
  if (run.userId !== userId) {
    throw new PaperRunOwnershipError(runId, userId);
  }

  const positions = await db
    .select()
    .from(paperPositions)
    .where(eq(paperPositions.runId, runId));

  const recentTrades = await db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.runId, runId))
    .orderBy(desc(paperTrades.ts))
    .limit(options?.tradesLimit ?? 20);

  return { run, positions, recentTrades };
}

/**
 * List a user's runs, newest first. Supports filtering by status (commonly
 * "active") and a small page size for the workbench sidebar.
 */
export async function listPaperRunsForUser(
  userId: string,
  options?: { status?: 'active' | 'paused' | 'closed'; limit?: number },
): Promise<PaperRun[]> {
  const conditions = [eq(paperRuns.userId, userId)];
  if (options?.status) {
    conditions.push(eq(paperRuns.status, options.status));
  }
  return db
    .select()
    .from(paperRuns)
    .where(and(...conditions))
    .orderBy(desc(paperRuns.startAt))
    .limit(options?.limit ?? 20);
}

/**
 * Close a run. Sets status='closed' + closedAt=now. Idempotent — closing
 * an already-closed run is a no-op (no error). Re-opening is not
 * supported; create a new run instead.
 */
export async function closePaperRun(userId: string, runId: number): Promise<PaperRun> {
  const runRows = await db
    .select()
    .from(paperRuns)
    .where(eq(paperRuns.id, runId))
    .limit(1);

  const existing = runRows[0];
  if (!existing) throw new PaperRunNotFoundError(runId);
  if (existing.userId !== userId) throw new PaperRunOwnershipError(runId, userId);
  if (existing.status === 'closed') return existing;

  const [updated] = await db
    .update(paperRuns)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(paperRuns.id, runId))
    .returning();

  return updated ?? existing;
}

/**
 * Stats for the workbench sidebar count badge — cheap aggregation.
 */
export async function countActivePaperRuns(userId: string): Promise<number> {
  const rows = await db
    .select({ id: paperRuns.id })
    .from(paperRuns)
    .where(and(eq(paperRuns.userId, userId), eq(paperRuns.status, 'active')));
  return rows.length;
}

// ---------------------------------------------------------------------------
// Forward-looking interfaces — declared but NOT implemented in Sprint 1.
// They live here so the eventual Sprint 2 worker has a clear contract to
// fill rather than the call sites accidentally importing stubs.
// ---------------------------------------------------------------------------

export interface PriceSnapshot {
  readonly symbol: string;
  readonly price: number;
  readonly asOf: Date;
}

export interface StrategySignal {
  readonly runId: number;
  readonly symbol: string;
  readonly side: 'buy' | 'sell';
  readonly qty: number;
  readonly suggestedPrice: number;
  readonly reason: string;
  readonly ts: Date;
}

/**
 * STUB. Implemented in Sprint 2 by the paper-engine worker:
 *   for each (runId, snapshot) update positions.last_price + recompute
 *   unrealized_pnl; write today's equity to paper_equity_curve.
 */
export async function tickPositions(
  _runIds: readonly number[],
  _snapshots: ReadonlyMap<string, PriceSnapshot>,
): Promise<void> {
  throw new Error(
    'tickPositions: not implemented in Sprint 1 — Paper Trading mark-to-market is a Sprint 2 deliverable',
  );
}

/**
 * STUB. Implemented in Sprint 2 by the strategy signal subscriber: when
 * the running strategy emits a buy/sell, apply it to the paper portfolio
 * + log a paper_trade.
 */
export async function applyStrategySignal(_signal: StrategySignal): Promise<PaperTrade> {
  throw new Error(
    'applyStrategySignal: not implemented in Sprint 1 — strategy execution wiring is a Sprint 2 deliverable',
  );
}

/**
 * Reference: when Sprint 2 wires up the engine, batch-load all active runs
 * grouped by strategy so the signal computation runs once per strategy and
 * the result fans out to N runs of that strategy — avoids the
 * runs × symbols quadratic flagged by Architect.
 */
export async function loadActiveRunsByStrategy(): Promise<
  ReadonlyMap<number, readonly PaperRun[]>
> {
  const rows = await db
    .select()
    .from(paperRuns)
    .where(eq(paperRuns.status, 'active'));

  const grouped = new Map<number, PaperRun[]>();
  for (const r of rows) {
    if (r.strategyHistoryId == null) continue;
    const list = grouped.get(r.strategyHistoryId) ?? [];
    list.push(r);
    grouped.set(r.strategyHistoryId, list);
  }
  return grouped;
}

// Convenience re-export so the API route can avoid duplicate imports.
export { inArray };
