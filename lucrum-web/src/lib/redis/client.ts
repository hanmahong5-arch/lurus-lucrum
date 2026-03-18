/**
 * Simplified Redis Client
 * Singleton Redis client with automatic graceful degradation
 *
 * 极简 Redis 客户端
 * 单例模式，自动优雅降级
 *
 * Design Principles:
 * - KISS: ~100 lines of code (vs previous 775 lines)
 * - Graceful degradation: Returns null when Redis unavailable
 * - Key prefix isolation: All keys prefixed with 'gw:' (Lucrum Web)
 * - DB 0 for frontend, DB 1 reserved for backend
 */

import Redis from "ioredis";

// =============================================================================
// Singleton Instance
// =============================================================================

let redis: Redis | null = null;

/**
 * Get Redis client instance (singleton)
 * Returns null if Redis is disabled or unavailable
 *
 * 获取 Redis 客户端实例（单例）
 * 如果 Redis 被禁用或不可用则返回 null
 */
export function getRedis(): Redis | null {
  // Check if Redis is enabled
  if (process.env.REDIS_ENABLED !== "true") {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || "redis-service",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0, // DB 0: Frontend cache; DB 1: Backend services
      keyPrefix: "gw:", // Lucrum Web prefix
      retryStrategy: (times) => {
        if (times > 5) {
          console.warn("[Redis] Max reconnection attempts reached, resetting singleton");
          // Reset so next getRedis() call creates a fresh connection
          redis = null;
          return null;
        }
        return Math.min(times * 200, 3000); // Exponential backoff, max 3s
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
      // If the connection is permanently closed, reset so next call reconnects
      if (err.message?.includes("Connection is closed") || err.message?.includes("ECONNREFUSED")) {
        if (redis?.status === "end") {
          redis = null;
        }
      }
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }

  return redis;
}

// =============================================================================
// Simple Cache Operations
// =============================================================================

/**
 * Get cached value by key
 * Returns null if key doesn't exist or Redis unavailable
 *
 * 通过键获取缓存值
 * 如果键不存在或 Redis 不可用则返回 null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (err) {
    console.error("[Redis] cacheGet error:", err);
    return null; // Graceful degradation
  }
}

/**
 * Set cached value with TTL
 * Silently fails if Redis unavailable
 *
 * 设置缓存值（带 TTL）
 * 如果 Redis 不可用则静默失败
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error("[Redis] cacheSet error:", err);
    // Silently fail - graceful degradation
  }
}

/**
 * Delete cached value
 * Silently fails if Redis unavailable
 *
 * 删除缓存值
 * 如果 Redis 不可用则静默失败
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch (err) {
    console.error("[Redis] cacheDel error:", err);
  }
}

/**
 * Close Redis connection gracefully
 *
 * 优雅关闭 Redis 连接
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      console.log("[Redis] Connection closed");
    } catch (err) {
      console.error("[Redis] Error closing connection:", err);
    } finally {
      redis = null;
    }
  }
}

// =============================================================================
// Process Shutdown Handlers
// =============================================================================

if (typeof process !== "undefined") {
  const shutdown = async () => {
    await closeRedis();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
