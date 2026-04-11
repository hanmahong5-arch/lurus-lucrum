/**
 * Presence Service
 * 在线感知服务
 *
 * Redis-backed presence tracking with HSET + TTL.
 * Each resource (strategy, backtest) has a hash of online users.
 *
 * Key pattern: gw:presence:{tenantId}:{resourceType}:{resourceId}
 * Hash field:  {userId} → JSON { name, avatar, lastSeen }
 * TTL:         60s (refreshed on every heartbeat)
 */

import { getRedis } from '@/lib/redis/client';

// ============================================================================
// Types
// ============================================================================

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  lastSeen: number; // epoch ms
}

export interface PresenceInfo {
  users: PresenceUser[];
  total: number;
}

export interface HeartbeatParams {
  tenantId: number;
  resourceType: string; // 'strategy' | 'backtest' | 'team'
  resourceId: string;
  userId: string;
  name: string;
  avatar: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const PRESENCE_TTL = parseInt(process.env.PRESENCE_STALE_S || '60', 10);
const STALE_THRESHOLD_MS = PRESENCE_TTL * 1000;

// ============================================================================
// Core Functions
// ============================================================================

function presenceKey(tenantId: number, resourceType: string, resourceId: string): string {
  return `presence:${tenantId}:${resourceType}:${resourceId}`;
}

function teamOnlineKey(tenantId: number): string {
  return `presence:${tenantId}:online`;
}

/**
 * Record a heartbeat — marks user as present on a resource.
 * Called every 30s from client.
 */
export async function heartbeat(params: HeartbeatParams): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const { tenantId, resourceType, resourceId, userId, name, avatar } = params;
  const key = presenceKey(tenantId, resourceType, resourceId);
  const onlineKey = teamOnlineKey(tenantId);

  try {
    const now = Date.now();
    const value = JSON.stringify({ userId, name, avatar, lastSeen: now });

    // Pipeline: set user in resource hash + refresh TTL + mark user online in team
    const pipeline = redis.pipeline();
    pipeline.hset(key, userId, value);
    pipeline.expire(key, PRESENCE_TTL);
    pipeline.hset(onlineKey, userId, JSON.stringify({ name, avatar, lastSeen: now }));
    pipeline.expire(onlineKey, PRESENCE_TTL);
    await pipeline.exec();

    return true;
  } catch (error) {
    console.error('[PresenceService] heartbeat error:', error);
    return false;
  }
}

/**
 * Get all present users on a resource, filtering stale entries.
 */
export async function getPresence(
  tenantId: number,
  resourceType: string,
  resourceId: string
): Promise<PresenceInfo> {
  const redis = getRedis();
  if (!redis) return { users: [], total: 0 };

  try {
    const key = presenceKey(tenantId, resourceType, resourceId);
    const allEntries = await redis.hgetall(key);

    const now = Date.now();
    const users: PresenceUser[] = [];

    for (const [, value] of Object.entries(allEntries)) {
      try {
        const user = JSON.parse(value) as PresenceUser;
        // Filter out stale entries (older than TTL)
        if (now - user.lastSeen < STALE_THRESHOLD_MS) {
          users.push(user);
        }
      } catch {
        // Skip malformed entries
      }
    }

    return { users, total: users.length };
  } catch (error) {
    console.error('[PresenceService] getPresence error:', error);
    return { users: [], total: 0 };
  }
}

/**
 * Remove a user from a resource's presence.
 * Called on page navigation away or explicit leave.
 */
export async function removePresence(
  tenantId: number,
  resourceType: string,
  resourceId: string,
  userId: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = presenceKey(tenantId, resourceType, resourceId);
    await redis.hdel(key, userId);
  } catch (error) {
    console.error('[PresenceService] removePresence error:', error);
  }
}

/**
 * Get all online users in a team (across all resources).
 */
export async function getTeamOnline(tenantId: number): Promise<PresenceUser[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const key = teamOnlineKey(tenantId);
    const allEntries = await redis.hgetall(key);

    const now = Date.now();
    const users: PresenceUser[] = [];

    for (const [, value] of Object.entries(allEntries)) {
      try {
        const user = JSON.parse(value) as PresenceUser;
        if (now - user.lastSeen < STALE_THRESHOLD_MS) {
          users.push(user);
        }
      } catch {
        // Skip malformed entries
      }
    }

    return users;
  } catch (error) {
    console.error('[PresenceService] getTeamOnline error:', error);
    return [];
  }
}
