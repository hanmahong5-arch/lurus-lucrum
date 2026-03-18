/**
 * Hybrid Cache Implementation
 * 混合缓存实现
 *
 * Combines in-memory cache with Redis for optimal performance:
 * - Memory cache: Fast access for hot data
 * - Redis: Persistence and cross-instance sharing
 *
 * Strategy: Write-Through + Read-Through
 * - Write: Memory → Redis (synchronous)
 * - Read: Memory → Redis → Source (with cache population)
 *
 * 结合内存缓存和Redis实现最佳性能：
 * - 内存缓存：热数据的快速访问
 * - Redis：持久化和跨实例共享
 *
 * 策略：Write-Through + Read-Through
 * - 写入：内存 → Redis（同步）
 * - 读取：内存 → Redis → 源（带缓存填充）
 */

import { cacheGet, cacheSet, cacheDel, getRedis } from '@/lib/redis';
import { DataCache } from '@/lib/data-service/cache';

// =============================================================================
// Types / 类型定义
// =============================================================================

export interface HybridCacheConfig {
  /** Name for logging / 日志名称 */
  name: string;
  /** Maximum items in memory cache / 内存缓存最大项数 */
  maxMemoryItems: number;
  /** Default TTL in seconds / 默认TTL（秒） */
  defaultTTL: number;
  /** Memory cleanup interval in ms / 内存清理间隔（毫秒） */
  cleanupInterval?: number;
  /** Whether to use Redis (default: true if available) / 是否使用Redis */
  useRedis?: boolean;
}

export interface CacheSetOptions {
  /** TTL in seconds / TTL（秒） */
  ttl?: number;
  /** Skip Redis write (memory only) / 跳过Redis写入 */
  memoryOnly?: boolean;
  /** Source identifier for debugging / 来源标识 */
  source?: string;
}

export interface CacheStats {
  name: string;
  memorySize: number;
  memoryHits: number;
  memoryMisses: number;
  memoryHitRate: number;
  redisAvailable: boolean;
  redisHits: number;
  redisMisses: number;
  totalHits: number;
  totalMisses: number;
  totalHitRate: number;
}

// =============================================================================
// HybridCache Class / 混合缓存类
// =============================================================================

/**
 * Hybrid cache combining in-memory and Redis caching
 * 结合内存和Redis的混合缓存
 */
export class HybridCache<T> {
  private memoryCache: DataCache<T>;
  private config: Required<HybridCacheConfig>;
  private redisHits = 0;
  private redisMisses = 0;

  constructor(config: HybridCacheConfig) {
    this.config = {
      name: config.name,
      maxMemoryItems: config.maxMemoryItems,
      defaultTTL: config.defaultTTL,
      cleanupInterval: config.cleanupInterval ?? 30000,
      useRedis: config.useRedis ?? true,
    };

    // Initialize memory cache
    // 初始化内存缓存
    this.memoryCache = new DataCache<T>({
      maxSize: this.config.maxMemoryItems,
      defaultTTL: this.config.defaultTTL * 1000, // Convert to ms
      cleanupInterval: this.config.cleanupInterval,
    });
  }

  /**
   * Check if Redis is available
   * 检查Redis是否可用
   */
  private isRedisAvailable(): boolean {
    if (!this.config.useRedis) return false;
    return getRedis() !== null;
  }

  /**
   * Get value from cache (Read-Through)
   * 从缓存获取值（Read-Through）
   *
   * Order: Memory → Redis → null
   */
  async get(key: string): Promise<T | null> {
    // 1. Try memory cache first
    // 1. 首先尝试内存缓存
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult !== null) {
      return memoryResult;
    }

    // 2. Try Redis if available
    // 2. 如果可用则尝试Redis
    if (this.isRedisAvailable()) {
      try {
        const redisResult = await cacheGet<T>(key);
        if (redisResult !== null) {
          this.redisHits++;
          // Populate memory cache from Redis
          // 从Redis填充内存缓存
          this.memoryCache.set(key, redisResult, {
            ttl: this.config.defaultTTL * 1000,
            source: 'redis',
          });
          return redisResult;
        }
        this.redisMisses++;
      } catch (error) {
        console.error(`[HybridCache:${this.config.name}] Redis get error:`, error);
      }
    }

    return null;
  }

  /**
   * Set value in cache (Write-Through)
   * 设置缓存值（Write-Through）
   *
   * Writes to both Memory and Redis simultaneously
   */
  async set(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const ttl = options.ttl ?? this.config.defaultTTL;

    // 1. Write to memory cache
    // 1. 写入内存缓存
    this.memoryCache.set(key, value, {
      ttl: ttl * 1000, // Convert to ms
      source: options.source ?? 'direct',
    });

    // 2. Write to Redis if enabled
    // 2. 如果启用则写入Redis
    if (!options.memoryOnly && this.isRedisAvailable()) {
      try {
        await cacheSet(key, value, ttl);
      } catch (error) {
        console.error(`[HybridCache:${this.config.name}] Redis set error:`, error);
        // Memory write succeeded, continue even if Redis fails
        // 内存写入成功，即使Redis失败也继续
      }
    }
  }

  /**
   * Delete value from both caches
   * 从两个缓存删除值
   */
  async delete(key: string): Promise<void> {
    // Delete from memory
    // 从内存删除
    this.memoryCache.delete(key);

    // Delete from Redis
    // 从Redis删除
    if (this.isRedisAvailable()) {
      try {
        await cacheDel(key);
      } catch (error) {
        console.error(`[HybridCache:${this.config.name}] Redis delete error:`, error);
      }
    }
  }

  /**
   * Check if key exists in either cache
   * 检查键是否存在于任一缓存
   */
  async has(key: string): Promise<boolean> {
    // Check memory first
    // 首先检查内存
    if (this.memoryCache.has(key)) {
      return true;
    }

    // Check Redis
    // 检查Redis
    if (this.isRedisAvailable()) {
      try {
        const result = await cacheGet<T>(key);
        return result !== null;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Get or set value with factory function
   * 使用工厂函数获取或设置值
   *
   * If value doesn't exist, calls factory and caches result
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    options: CacheSetOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    // 首先尝试从缓存获取
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Call factory to get value
    // 调用工厂获取值
    const value = await factory();

    // Cache the value
    // 缓存值
    await this.set(key, value, options);

    return value;
  }

  /**
   * Clear all entries from both caches
   * 清空两个缓存的所有条目
   */
  async clear(): Promise<void> {
    // Clear memory
    // 清空内存
    this.memoryCache.clear();

    // For Redis, we can't clear just our keys without pattern support
    // Redis清空需要模式匹配支持，这里只清空内存
    // Redis clearing would require scanning keys which is expensive
    console.warn(
      `[HybridCache:${this.config.name}] clear() only clears memory cache. ` +
        'Redis entries will expire naturally.'
    );
  }

  /**
   * Get cache statistics
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const totalHits = memoryStats.hits + this.redisHits;
    const totalMisses = memoryStats.misses + this.redisMisses;
    const totalRequests = totalHits + totalMisses;

    return {
      name: this.config.name,
      memorySize: memoryStats.size,
      memoryHits: memoryStats.hits,
      memoryMisses: memoryStats.misses,
      memoryHitRate: memoryStats.hitRate,
      redisAvailable: this.isRedisAvailable(),
      redisHits: this.redisHits,
      redisMisses: this.redisMisses,
      totalHits,
      totalMisses,
      totalHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }

  /**
   * Destroy cache and cleanup resources
   * 销毁缓存并清理资源
   */
  destroy(): void {
    this.memoryCache.destroy();
  }
}

// =============================================================================
// Pre-configured Cache Instances / 预配置的缓存实例
// =============================================================================

import { CACHE_TTL } from './cache-keys';

/**
 * Popular strategy cache
 * 流行策略缓存
 */
export const popularStrategyCache = new HybridCache<unknown>({
  name: 'popular-strategy',
  maxMemoryItems: 500,
  defaultTTL: CACHE_TTL.POPULAR_STRATEGY_LIST,
});

/**
 * Workflow session cache
 * 工作流会话缓存
 */
export const workflowCache = new HybridCache<unknown>({
  name: 'workflow',
  maxMemoryItems: 100,
  defaultTTL: CACHE_TTL.WORKFLOW_SESSION,
});

/**
 * Backtest result cache
 * 回测结果缓存
 */
export const backtestCache = new HybridCache<unknown>({
  name: 'backtest',
  maxMemoryItems: 200,
  defaultTTL: CACHE_TTL.BACKTEST_RESULT,
});

/**
 * Stock search result cache
 * 股票搜索结果缓存
 */
export const stockSearchCache = new HybridCache<unknown>({
  name: 'stock-search',
  maxMemoryItems: 1000,
  defaultTTL: CACHE_TTL.STOCK_SEARCH,
});

// =============================================================================
// Helper Functions / 辅助函数
// =============================================================================

/**
 * Get all cache statistics
 * 获取所有缓存统计
 */
export function getAllCacheStats(): CacheStats[] {
  return [
    popularStrategyCache.getStats(),
    workflowCache.getStats(),
    backtestCache.getStats(),
    stockSearchCache.getStats(),
  ];
}

/**
 * Log cache statistics for debugging
 * 记录缓存统计用于调试
 */
export function logCacheStats(): void {
  const stats = getAllCacheStats();
  console.log('[HybridCache] Statistics:');
  for (const s of stats) {
    console.log(
      `  ${s.name}: memory=${s.memorySize}, hitRate=${(s.totalHitRate * 100).toFixed(1)}%, ` +
        `redis=${s.redisAvailable ? 'yes' : 'no'}`
    );
  }
}
