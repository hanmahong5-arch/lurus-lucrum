/**
 * User event service.
 *
 * Records timestamped actions to `user_events` for the event-timeline UI.
 * Writes are fire-and-forget — failures log a warning, never throw.
 *
 * The timeline is the user-facing replacement for the localStorage-only
 * draft history. It records edits, backtests, marketplace activity, and
 * template loads so the user can scroll their workspace history across
 * sessions and devices.
 *
 * @module lib/services/user-event-service
 */

import { db } from '@/lib/db';
import { userEvents, strategyVersions } from '@/lib/db/schema';
import type { UserEvent } from '@/lib/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { USER_EVENT_TYPES, type UserEventType } from './user-event-types';

export { USER_EVENT_TYPES, type UserEventType };

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

export interface RecordEventInput {
  userId: string;
  type: UserEventType;
  entityType?: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
  tokenCost?: number;
}

/**
 * Fire-and-forget event write. Never blocks, never throws.
 */
export function recordEvent(input: RecordEventInput): void {
  void db
    .insert(userEvents)
    .values({
      userId: input.userId,
      eventType: input.type,
      entityType: input.entityType ?? null,
      entityId:
        input.entityId == null
          ? null
          : typeof input.entityId === 'number'
            ? String(input.entityId)
            : input.entityId,
      metadata: input.metadata ?? null,
      tokenCost: input.tokenCost ?? 0,
    })
    .catch((err: unknown) => {
      console.warn('[user-event-service] recordEvent failed:', err);
    });
}

export interface RecordStrategyEditInput {
  userId: string;
  strategyHistoryId: number;
  oldCode?: string;
  newCode: string;
  oldParams?: Record<string, unknown>;
  newParams: Record<string, unknown>;
  description?: string;
}

/**
 * Record an edit on a strategy. Writes a `strategy_versions` snapshot AND
 * a `user_events` row so the timeline picks it up. Diffs are computed
 * inline; no event is recorded when nothing changed.
 *
 * Returns the new version row id (or undefined on no-op / error).
 */
export async function recordStrategyEdit(
  input: RecordStrategyEditInput,
): Promise<string | undefined> {
  const codeChanged = (input.oldCode ?? '') !== input.newCode;
  const paramsChanged =
    JSON.stringify(input.oldParams ?? {}) !== JSON.stringify(input.newParams);

  if (!codeChanged && !paramsChanged) return undefined;

  try {
    const version = await db
      .insert(strategyVersions)
      .values({
        userId: input.userId,
        strategyHistoryId: input.strategyHistoryId,
        code: input.newCode,
        params: input.newParams,
        description: input.description ?? (codeChanged ? '代码更新' : '参数更新'),
      })
      .returning();

    const versionId = version[0]?.id;

    recordEvent({
      userId: input.userId,
      type: codeChanged
        ? USER_EVENT_TYPES.strategyCodeChanged
        : USER_EVENT_TYPES.strategyParamChanged,
      entityType: 'strategy',
      entityId: input.strategyHistoryId,
      metadata: {
        versionId,
        codeChanged,
        paramsChanged,
      },
    });

    return versionId;
  } catch (err) {
    console.warn('[user-event-service] recordStrategyEdit failed:', err);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Read path — cursor pagination keyed on createdAt.
// ---------------------------------------------------------------------------

export interface TimelineQuery {
  userId: string;
  limit?: number;
  /** ISO timestamp; results are events older than this cursor. */
  cursor?: string;
  filterType?: UserEventType;
  entityId?: string;
}

export interface TimelinePage {
  events: UserEvent[];
  /** ISO timestamp to pass as cursor for the next page; undefined when exhausted. */
  nextCursor?: string;
}

export async function getUserTimeline(q: TimelineQuery): Promise<TimelinePage> {
  const limit = Math.min(q.limit ?? 50, 200);

  const conditions = [eq(userEvents.userId, q.userId)];
  if (q.cursor) conditions.push(lt(userEvents.createdAt, new Date(q.cursor)));
  if (q.filterType) conditions.push(eq(userEvents.eventType, q.filterType));
  if (q.entityId) conditions.push(eq(userEvents.entityId, q.entityId));

  try {
    const rows = await db
      .select()
      .from(userEvents)
      .where(and(...conditions))
      .orderBy(desc(userEvents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const last = slice[slice.length - 1];

    return {
      events: slice,
      nextCursor: hasMore && last ? last.createdAt.toISOString() : undefined,
    };
  } catch (err) {
    console.warn('[user-event-service] getUserTimeline failed:', err);
    return { events: [] };
  }
}

export async function getStrategyVersions(strategyHistoryId: number) {
  try {
    const rows = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.strategyHistoryId, strategyHistoryId))
      .orderBy(desc(strategyVersions.createdAt));
    return rows;
  } catch (err) {
    console.warn('[user-event-service] getStrategyVersions failed:', err);
    return [];
  }
}
