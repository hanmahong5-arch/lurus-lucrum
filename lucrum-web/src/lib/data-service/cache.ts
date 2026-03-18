/**
 * Data Cache Implementation
 * 数据缓存实现
 *
 * In-memory cache with TTL, LRU eviction, and statistics
 * 支持TTL、LRU淘汰和统计的内存缓存
 */

import type { CacheEntry, CacheConfig, CacheStats } from "./types";

// =============================================================================
// CACHE IMPLEMENTATION / 缓存实现
// =============================================================================

/**
 * Generic data cache with TTL and LRU eviction
 * 支持TTL和LRU淘汰的通用数据缓存
 */
export class DataCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      defaultTTL: config.defaultTTL ?? 60000, // 1 minute default
      cleanupInterval: config.cleanupInterval ?? 30000, // 30 seconds
    };

    // Start periodic cleanup
    // 启动定期清理
    this.startCleanup();
  }

  /**
   * Get value from cache
   * 从缓存获取值
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update hit count and move to end (LRU)
    // 更新命中次数并移到末尾（LRU）
    entry.hits++;
    this.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set value in cache with optional TTL
   * 设置缓存值，可选TTL
   */
  set(
    key: string,
    data: T,
    options: { ttl?: number; source?: string } = {},
  ): void {
    // Check size limit, evict if necessary
    // 检查大小限制，必要时淘汰
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl ?? this.config.defaultTTL,
      source: options.source ?? "unknown",
      hits: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   * 检查键是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete key from cache
   * 从缓存删除键
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   * 清空所有条目
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   * 获取缓存统计
   */
  getStats(): CacheStats {
    let oldestEntry = Infinity;
    let newestEntry = 0;

    this.cache.forEach((entry) => {
      if (entry.timestamp < oldestEntry) oldestEntry = entry.timestamp;
      if (entry.timestamp > newestEntry) newestEntry = entry.timestamp;
    });

    const totalRequests = this.hits + this.misses;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      oldestEntry: oldestEntry === Infinity ? 0 : oldestEntry,
      newestEntry,
    };
  }

  /**
   * Get all keys
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get entry metadata (for debugging)
   * 获取条目元数据（调试用）
   */
  getEntryMeta(key: string): Omit<CacheEntry<T>, "data"> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const { data: _, ...meta } = entry;
    return meta;
  }

  /**
   * Check if entry is expired
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  /**
   * Evict oldest entry (LRU)
   * 淘汰最旧条目（LRU）
   */
  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   * 启动定期清理过期条目
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up expired entries
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.timestamp + entry.ttl) {
        expiredKeys.push(key);
      }
    });

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Stop cleanup timer (for cleanup)
   * 停止清理定时器（用于清理）
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// =============================================================================
// SPECIALIZED CACHES / 专用缓存
// =============================================================================

import type {
  StockQuote,
  KLineData,
  IndexQuote,
  CapitalFlow,
  NorthBoundFlow,
} from "./types";

/**
 * Pre-configured cache instances for different data types
 * 预配置的不同数据类型缓存实例
 */

// Quote cache - short TTL for real-time data
// 行情缓存 - 短TTL用于实时数据
export const quoteCache = new DataCache<StockQuote>({
  maxSize: 5000,
  defaultTTL: 5000, // 5 seconds
  cleanupInterval: 10000,
});

// Index cache - short TTL
// 指数缓存 - 短TTL
export const indexCache = new DataCache<IndexQuote>({
  maxSize: 100,
  defaultTTL: 5000, // 5 seconds
  cleanupInterval: 10000,
});

// K-line cache - longer TTL based on timeframe
// K线缓存 - 根据周期设置较长TTL
export const klineCache = new DataCache<KLineData[]>({
  maxSize: 500,
  defaultTTL: 60000, // 1 minute default, override per timeframe
  cleanupInterval: 60000,
});

// Capital flow cache - medium TTL
// 资金流向缓存 - 中等TTL
export const capitalFlowCache = new DataCache<CapitalFlow>({
  maxSize: 1000,
  defaultTTL: 30000, // 30 seconds
  cleanupInterval: 30000,
});

// North-bound flow cache - longer TTL
// 北向资金缓存 - 较长TTL
export const northBoundCache = new DataCache<NorthBoundFlow>({
  maxSize: 100,
  defaultTTL: 60000, // 1 minute
  cleanupInterval: 60000,
});

// =============================================================================
// CACHE KEY UTILITIES / 缓存键工具
// =============================================================================

/**
 * Generate cache key for quote data
 * 生成行情数据缓存键
 */
export function getQuoteCacheKey(symbol: string): string {
  return `quote:${symbol}`;
}

/**
 * Generate cache key for K-line data
 * 生成K线数据缓存键
 */
export function getKLineCacheKey(symbol: string, timeframe: string): string {
  return `kline:${symbol}:${timeframe}`;
}

/**
 * Generate cache key for index data
 * 生成指数数据缓存键
 */
export function getIndexCacheKey(symbol: string): string {
  return `index:${symbol}`;
}

/**
 * Generate cache key for capital flow data
 * 生成资金流向数据缓存键
 */
export function getCapitalFlowCacheKey(symbol: string): string {
  return `flow:${symbol}`;
}

/**
 * Get TTL for K-line timeframe
 * 获取K线周期对应的TTL
 */
export function getKLineTTL(timeframe: string): number {
  const ttlMap: Record<string, number> = {
    "1m": 60000, // 1 minute
    "5m": 300000, // 5 minutes
    "15m": 900000, // 15 minutes
    "30m": 1800000, // 30 minutes
    "60m": 3600000, // 1 hour
    "1d": 86400000, // 1 day
    "1w": 604800000, // 1 week
    "1M": 2592000000, // 30 days
  };
  return ttlMap[timeframe] ?? 60000;
}
