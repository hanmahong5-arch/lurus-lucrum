/**
 * Notification Service
 * 通知服务
 *
 * Manages user notifications with DB persistence and optional Redis pub/sub
 * for real-time SSE delivery.
 */

import { db } from '@/lib/db';
import {
  notifications,
  type Notification,
  type NewNotification,
} from '@/lib/db/schema';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { getRedis, cacheGet, cacheSet, cacheDel } from '@/lib/redis/client';

// ============================================================================
// Types
// ============================================================================

export interface CreateNotificationParams {
  userId: string;
  tenantId?: number | null;
  type: 'invite' | 'activity' | 'system' | 'review';
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationCursor {
  before?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: number | null;
  hasMore: boolean;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create a notification and publish to Redis for real-time delivery
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<Notification | null> {
  try {
    const result = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        tenantId: params.tenantId ?? null,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        metadata: params.metadata ?? null,
        isRead: false,
        readAt: null,
      })
      .returning();

    const notification = result[0] ?? null;

    // Publish to Redis channel for SSE delivery (fire-and-forget)
    if (notification) {
      publishNotification(params.userId, notification).catch(() => {
        // Redis unavailable — SSE will fall back to polling
      });
      // Invalidate unread count cache
      await cacheDel(`notify:unread:${params.userId}`);
    }

    return notification;
  } catch (error) {
    console.error('[NotificationService] createNotification error:', error);
    return null;
  }
}

/**
 * Get user notifications with cursor-based pagination
 */
export async function getUserNotifications(
  userId: string,
  cursor: NotificationCursor = {}
): Promise<NotificationPage> {
  const { before, limit = 20, unreadOnly = false } = cursor;
  const fetchLimit = Math.min(limit, 100);

  try {
    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    if (before) {
      conditions.push(sql`${notifications.id} < ${before}`);
    }

    const items = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.id))
      .limit(fetchLimit + 1);

    const hasMore = items.length > fetchLimit;
    if (hasMore) items.pop();

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return { items, nextCursor, hasMore };
  } catch (error) {
    console.error('[NotificationService] getUserNotifications error:', error);
    return { items: [], nextCursor: null, hasMore: false };
  }
}

/**
 * Mark notifications as read
 */
export async function markAsRead(
  userId: string,
  notificationIds: number[]
): Promise<boolean> {
  if (notificationIds.length === 0) return true;

  try {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${notifications.id} = ANY(${notificationIds})`
        )
      );

    // Invalidate unread count cache
    await cacheDel(`notify:unread:${userId}`);
    return true;
  } catch (error) {
    console.error('[NotificationService] markAsRead error:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  try {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    await cacheDel(`notify:unread:${userId}`);
    return true;
  } catch (error) {
    console.error('[NotificationService] markAllAsRead error:', error);
    return false;
  }
}

/**
 * Get unread notification count with Redis cache (30s TTL)
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const cacheKey = `notify:unread:${userId}`;

  // Try cache first
  const cached = await cacheGet<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    const count = result[0]?.count ?? 0;
    await cacheSet(cacheKey, count, 30); // Cache for 30 seconds
    return count;
  } catch (error) {
    console.error('[NotificationService] getUnreadCount error:', error);
    return 0;
  }
}

// ============================================================================
// Redis Pub/Sub for Real-Time Delivery
// ============================================================================

/**
 * Publish notification event to Redis channel
 */
async function publishNotification(
  userId: string,
  notification: Notification
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const channel = `gw:notify:${userId}`;
  await redis.publish(
    channel,
    JSON.stringify({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    })
  );
}

/**
 * Subscribe to notification channel for SSE streaming.
 * Returns an unsubscribe function.
 */
export async function subscribeNotifications(
  userId: string,
  onMessage: (data: string) => void
): Promise<(() => void) | null> {
  const redis = getRedis();
  if (!redis) return null;

  // Create a separate subscriber connection (ioredis requires this)
  const Redis = (await import('ioredis')).default;
  const subscriber = new Redis({
    host: process.env.REDIS_HOST || 'redis-service',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '1', 10),
    keyPrefix: '', // No prefix for pub/sub channels
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 3000,
  });

  const channel = `gw:notify:${userId}`;

  try {
    await subscriber.connect();
    await subscriber.subscribe(channel);

    subscriber.on('message', (_ch: string, message: string) => {
      onMessage(message);
    });

    return () => {
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.disconnect();
    };
  } catch {
    subscriber.disconnect();
    return null;
  }
}
