/**
 * Team Activity Service
 * 团队活动记录服务
 *
 * Records team actions and provides paginated activity feeds.
 * Triggers notifications for relevant team members.
 */

import { db } from '@/lib/db';
import {
  teamActivity,
  tenantMembers,
  type NewTeamActivity,
  type TeamActivity,
} from '@/lib/db/schema';
import { eq, desc, sql, and, ne } from 'drizzle-orm';
import { createNotification } from './notification-service';

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'strategy_created'
  | 'strategy_updated'
  | 'strategy_deleted'
  | 'backtest_run'
  | 'backtest_shared'
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'member_role_changed'
  | 'team_updated'
  | 'review_submitted'
  | 'review_approved'
  | 'review_rejected';

export type ResourceType = 'strategy' | 'backtest' | 'member' | 'team' | 'review';

export interface RecordActivityParams {
  tenantId: number;
  userId: string;
  actorName: string;
  actionType: ActionType;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  /** If true, skip notifying other team members */
  silent?: boolean;
}

export interface ActivityCursor {
  before?: number; // activity ID to fetch before (older)
  limit?: number;
}

export interface ActivityPage {
  items: TeamActivity[];
  nextCursor: number | null;
  hasMore: boolean;
}

// ============================================================================
// Activity action descriptions (for notification titles)
// ============================================================================

const ACTION_DESCRIPTIONS: Record<ActionType, { zh: string; en: string }> = {
  strategy_created: { zh: '创建了新策略', en: 'created a new strategy' },
  strategy_updated: { zh: '更新了策略', en: 'updated a strategy' },
  strategy_deleted: { zh: '删除了策略', en: 'deleted a strategy' },
  backtest_run: { zh: '运行了回测', en: 'ran a backtest' },
  backtest_shared: { zh: '分享了回测结果', en: 'shared backtest results' },
  member_invited: { zh: '邀请了新成员', en: 'invited a new member' },
  member_joined: { zh: '加入了团队', en: 'joined the team' },
  member_removed: { zh: '移除了成员', en: 'removed a member' },
  member_role_changed: { zh: '更改了成员角色', en: 'changed a member role' },
  team_updated: { zh: '更新了团队设置', en: 'updated team settings' },
  review_submitted: { zh: '提交了策略评审', en: 'submitted a strategy review' },
  review_approved: { zh: '通过了策略评审', en: 'approved a strategy review' },
  review_rejected: { zh: '拒绝了策略评审', en: 'rejected a strategy review' },
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Record a team activity and optionally notify other members
 */
export async function recordActivity(params: RecordActivityParams): Promise<TeamActivity | null> {
  const { tenantId, userId, actorName, actionType, resourceType, resourceId, metadata, silent } = params;

  try {
    const result = await db
      .insert(teamActivity)
      .values({
        tenantId,
        userId,
        actorName,
        actionType,
        resourceType,
        resourceId: resourceId ?? null,
        metadata: metadata ?? null,
      })
      .returning();

    const activity = result[0] ?? null;

    // Notify other team members (fire-and-forget)
    if (activity && !silent) {
      notifyTeamMembers(tenantId, userId, actorName, actionType, metadata).catch((err) => {
        console.error('[ActivityService] Failed to notify team members:', err);
      });
    }

    return activity;
  } catch (error) {
    console.error('[ActivityService] recordActivity error:', error);
    return null;
  }
}

/**
 * Get team activity feed with cursor-based pagination
 */
export async function getTeamActivity(
  tenantId: number,
  cursor: ActivityCursor = {}
): Promise<ActivityPage> {
  const { before, limit = 30 } = cursor;
  const fetchLimit = Math.min(limit, 100);

  try {
    const conditions = [eq(teamActivity.tenantId, tenantId)];
    if (before) {
      conditions.push(sql`${teamActivity.id} < ${before}`);
    }

    const items = await db
      .select()
      .from(teamActivity)
      .where(and(...conditions))
      .orderBy(desc(teamActivity.id))
      .limit(fetchLimit + 1);

    const hasMore = items.length > fetchLimit;
    if (hasMore) items.pop();

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return { items, nextCursor, hasMore };
  } catch (error) {
    console.error('[ActivityService] getTeamActivity error:', error);
    return { items: [], nextCursor: null, hasMore: false };
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Send notifications to all team members except the actor
 */
async function notifyTeamMembers(
  tenantId: number,
  actorUserId: string,
  actorName: string,
  actionType: ActionType,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Get all other members
  const members = await db
    .select({ userId: tenantMembers.userId })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), ne(tenantMembers.userId, actorUserId)));

  if (members.length === 0) return;

  const desc = ACTION_DESCRIPTIONS[actionType];
  const title = `${actorName} ${desc?.zh ?? actionType}`;

  await Promise.allSettled(
    members.map((m) =>
      createNotification({
        userId: m.userId,
        tenantId,
        type: 'activity',
        title,
        body: null,
        metadata: { actionType, ...(metadata ?? {}) },
      })
    )
  );
}
