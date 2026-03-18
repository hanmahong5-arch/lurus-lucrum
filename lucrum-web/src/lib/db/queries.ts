/**
 * Database Query Functions
 * 数据库查询函数
 *
 * Provides convenient, type-safe query functions for common operations
 * 为常用操作提供便捷、类型安全的查询函数
 */

import { eq, and, inArray, like, or, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { db } from './index';
import {
  stocks,
  sectors,
  stockSectorMapping,
  klineDaily,
  validationCache,
  validationPresets,
  popularStrategies,
  userEvents,
  type Stock,
  type Sector,
  type KLineDaily,
} from './schema';

// ============================================================================
// Stock Queries
// ============================================================================

/**
 * Get stock by symbol
 * 根据股票代码获取股票信息
 */
export async function getStockBySymbol(symbol: string): Promise<Stock | undefined> {
  const result = await db.select().from(stocks).where(eq(stocks.symbol, symbol)).limit(1);
  return result[0];
}

/**
 * Get stocks by multiple symbols
 * 根据多个股票代码获取股票信息
 */
export async function getStocksBySymbols(symbols: string[]): Promise<Stock[]> {
  if (symbols.length === 0) return [];
  return await db.select().from(stocks).where(inArray(stocks.symbol, symbols));
}

/**
 * Search stocks by keyword (symbol or name)
 * 根据关键词搜索股票（代码或名称）
 */
export async function searchStocks(
  keyword: string,
  options?: {
    excludeST?: boolean;
    status?: string;
    limit?: number;
  }
): Promise<Stock[]> {
  const { excludeST = false, status = 'active', limit = 50 } = options || {};

  let query = db
    .select()
    .from(stocks)
    .where(
      and(
        or(like(stocks.symbol, `%${keyword}%`), like(stocks.name, `%${keyword}%`)),
        eq(stocks.status, status),
        excludeST ? eq(stocks.isST, false) : undefined
      )
    )
    .limit(limit);

  return await query;
}

/**
 * Get all stocks with filters
 * 获取所有股票（带过滤条件）
 */
export async function getAllStocks(options?: {
  excludeST?: boolean;
  status?: string;
  minMarketCap?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'symbol' | 'name' | 'marketCap';
  orderDirection?: 'asc' | 'desc';
}): Promise<Stock[]> {
  const {
    excludeST = false,
    status = 'active',
    minMarketCap,
    limit = 100,
    offset = 0,
    orderBy = 'symbol',
    orderDirection = 'asc',
  } = options || {};

  // Build conditions
  const conditions = [];
  if (status) conditions.push(eq(stocks.status, status));
  if (excludeST) conditions.push(eq(stocks.isST, false));
  if (minMarketCap !== undefined) conditions.push(gte(stocks.marketCap, minMarketCap));

  // Build order column
  const orderColumn =
    orderBy === 'name' ? stocks.name : orderBy === 'marketCap' ? stocks.marketCap : stocks.symbol;

  // Build complete query without intermediate reassignment
  const baseQuery = db.select().from(stocks);
  const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  const orderedQuery = orderDirection === 'desc'
    ? filteredQuery.orderBy(desc(orderColumn))
    : filteredQuery.orderBy(asc(orderColumn));
  const paginatedQuery = orderedQuery.limit(limit).offset(offset);

  return await paginatedQuery;
}

/**
 * Count total stocks
 * 统计股票总数
 */
export async function countStocks(options?: {
  excludeST?: boolean;
  status?: string;
}): Promise<number> {
  const { excludeST = false, status = 'active' } = options || {};

  const conditions = [];
  if (status) conditions.push(eq(stocks.status, status));
  if (excludeST) conditions.push(eq(stocks.isST, false));

  const result = await db
    .select({ count: stocks.id })
    .from(stocks)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result.length;
}

// ============================================================================
// Sector Queries
// ============================================================================

/**
 * Get sector by code
 * 根据板块代码获取板块信息
 */
export async function getSectorByCode(code: string): Promise<Sector | undefined> {
  const result = await db.select().from(sectors).where(eq(sectors.code, code)).limit(1);
  return result[0];
}

/**
 * Get all sectors
 * 获取所有板块
 */
export async function getAllSectors(options?: {
  level?: number;
  parentId?: number;
}): Promise<Sector[]> {
  const { level, parentId } = options || {};

  // Build conditions
  const conditions = [];
  if (level !== undefined) conditions.push(eq(sectors.level, level));
  if (parentId !== undefined) conditions.push(eq(sectors.parentId, parentId));

  // Build complete query without intermediate reassignment
  const baseQuery = db.select().from(sectors);
  const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  const orderedQuery = filteredQuery.orderBy(asc(sectors.code));

  return await orderedQuery;
}

/**
 * Get stocks in a sector
 * 获取板块内的所有股票
 */
export async function getStocksInSector(
  sectorCode: string,
  options?: {
    excludeST?: boolean;
    limit?: number;
  }
): Promise<Stock[]> {
  const { excludeST = false, limit = 100 } = options || {};

  const sector = await getSectorByCode(sectorCode);
  if (!sector) return [];

  let query = db
    .select({ stock: stocks })
    .from(stocks)
    .innerJoin(stockSectorMapping, eq(stocks.id, stockSectorMapping.stockId))
    .where(
      and(
        eq(stockSectorMapping.sectorId, sector.id),
        eq(stocks.status, 'active'),
        excludeST ? eq(stocks.isST, false) : undefined
      )
    )
    .limit(limit);

  const result = await query;
  return result.map((r) => r.stock);
}

// ============================================================================
// K-line Data Queries
// ============================================================================

/**
 * Get K-line date range for a stock (earliest and latest available dates)
 * 获取股票可用K线数据的时间范围
 */
export async function getKLineDateRange(
  symbol: string
): Promise<{ minDate: string; maxDate: string; count: number } | null> {
  const stock = await getStockBySymbol(symbol);
  if (!stock) return null;

  const result = await db
    .select({
      minDate: sql<string>`MIN(${klineDaily.date})`,
      maxDate: sql<string>`MAX(${klineDaily.date})`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(klineDaily)
    .where(eq(klineDaily.stockId, stock.id));

  const row = result[0];
  if (!row || !row.minDate || !row.maxDate || row.count === 0) return null;

  return { minDate: row.minDate, maxDate: row.maxDate, count: row.count };
}

/**
 * Get K-line data for a stock within date range
 * 获取股票在指定日期范围内的K线数据
 */
export async function getKLineData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<KLineDaily[]> {
  const stock = await getStockBySymbol(symbol);
  if (!stock) return [];

  return await db
    .select()
    .from(klineDaily)
    .where(
      and(eq(klineDaily.stockId, stock.id), gte(klineDaily.date, startDate), lte(klineDaily.date, endDate))
    )
    .orderBy(asc(klineDaily.date));
}

/**
 * Get K-line data for multiple stocks (batch query)
 * 批量获取多只股票的K线数据
 */
export async function getKLineDataBatch(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, KLineDaily[]>> {
  if (symbols.length === 0) return new Map();

  // Get stock IDs for symbols
  const stocksList = await getStocksBySymbols(symbols);
  const stockMap = new Map(stocksList.map((s) => [s.id, s.symbol]));
  const stockIds = stocksList.map((s) => s.id);

  if (stockIds.length === 0) return new Map();

  // Batch query K-line data
  const klineData = await db
    .select()
    .from(klineDaily)
    .where(
      and(inArray(klineDaily.stockId, stockIds), gte(klineDaily.date, startDate), lte(klineDaily.date, endDate))
    )
    .orderBy(asc(klineDaily.stockId), asc(klineDaily.date));

  // Group by symbol
  const result = new Map<string, KLineDaily[]>();
  for (const kline of klineData) {
    const symbol = stockMap.get(kline.stockId);
    if (!symbol) continue;

    if (!result.has(symbol)) {
      result.set(symbol, []);
    }
    result.get(symbol)!.push(kline);
  }

  return result;
}

/**
 * Get latest K-line data for a stock
 * 获取股票的最新K线数据
 */
export async function getLatestKLine(symbol: string): Promise<KLineDaily | undefined> {
  const stock = await getStockBySymbol(symbol);
  if (!stock) return undefined;

  const result = await db
    .select()
    .from(klineDaily)
    .where(eq(klineDaily.stockId, stock.id))
    .orderBy(desc(klineDaily.date))
    .limit(1);

  return result[0];
}

// ============================================================================
// Validation Cache Queries
// ============================================================================

/**
 * Get validation cache by key
 * 根据缓存key获取验证结果
 */
export async function getValidationCache(cacheKey: string): Promise<string | null> {
  const result = await db
    .select()
    .from(validationCache)
    .where(and(eq(validationCache.cacheKey, cacheKey), gte(validationCache.expiresAt, new Date())))
    .limit(1);

  if (result.length === 0) return null;

  // Increment hit count
  await db
    .update(validationCache)
    .set({ hitCount: result[0]!.hitCount + 1 })
    .where(eq(validationCache.id, result[0]!.id));

  return result[0]!.result;
}

/**
 * Set validation cache
 * 设置验证结果缓存
 */
export async function setValidationCache(
  cacheKey: string,
  config: string,
  result: string,
  ttlHours: number = 24
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  await db
    .insert(validationCache)
    .values({
      cacheKey,
      config,
      result,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: validationCache.cacheKey,
      set: {
        config,
        result,
        expiresAt,
        createdAt: new Date(),
      },
    });
}

/**
 * Clean expired validation cache
 * 清理过期的验证缓存
 */
export async function cleanExpiredCache(): Promise<number> {
  const result = await db.delete(validationCache).where(lte(validationCache.expiresAt, new Date()));
  return result.rowCount || 0;
}

// ============================================================================
// Validation Presets Queries
// ============================================================================

/**
 * Get all validation presets
 * 获取所有验证预设
 */
export async function getAllPresets(options?: {
  favoritesOnly?: boolean;
  limit?: number;
}): Promise<typeof validationPresets.$inferSelect[]> {
  const { favoritesOnly = false, limit = 50 } = options || {};

  // Build complete query without intermediate reassignment
  const baseQuery = db.select().from(validationPresets);
  const filteredQuery = favoritesOnly
    ? baseQuery.where(eq(validationPresets.isFavorite, true))
    : baseQuery;
  const finalQuery = filteredQuery.orderBy(desc(validationPresets.lastUsedAt)).limit(limit);

  return await finalQuery;
}

/**
 * Create validation preset
 * 创建验证预设
 */
export async function createPreset(preset: {
  name: string;
  description?: string;
  symbols: string[];
  config?: Record<string, unknown>;
  isFavorite?: boolean;
}): Promise<number> {
  const result = await db
    .insert(validationPresets)
    .values({
      name: preset.name,
      description: preset.description,
      symbols: JSON.stringify(preset.symbols),
      config: preset.config ? JSON.stringify(preset.config) : null,
      isFavorite: preset.isFavorite || false,
      useCount: 0,
    })
    .returning({ id: validationPresets.id });

  return result[0]!.id;
}

/**
 * Update preset usage
 * 更新预设使用记录
 */
export async function updatePresetUsage(presetId: number): Promise<void> {
  await db
    .update(validationPresets)
    .set({
      lastUsedAt: new Date(),
      useCount: sql`${validationPresets.useCount} + 1`,
    })
    .where(eq(validationPresets.id, presetId));
}

// ============================================================================
// Popular Strategy Pool Queries (策略公共缓存池查询)
// ============================================================================

/**
 * Find a cached popular strategy by its MD5 cache key
 * 通过MD5缓存键查找缓存策略
 */
export async function findPopularStrategyByKey(cacheKey: string): Promise<{
  id: number;
  veighnaCode: string | null;
  originalCode: string | null;
  usageCount: number;
  avgReturn: string | null;
  sharpeRatio: string | null;
} | null> {
  const result = await db
    .select({
      id: popularStrategies.id,
      veighnaCode: popularStrategies.veighnaCode,
      originalCode: popularStrategies.originalCode,
      usageCount: popularStrategies.usageCount,
      avgReturn: popularStrategies.avgReturn,
      sharpeRatio: popularStrategies.sharpeRatio,
    })
    .from(popularStrategies)
    .where(eq(popularStrategies.cacheKey, cacheKey))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Upsert a strategy into the popular strategies pool
 * UPSERT 策略到公共缓存池
 */
export async function upsertPopularStrategy(params: {
  cacheKey: string;
  code: string;
  strategyType: string;
  authorId?: string;
  totalReturn?: number;
  sharpeRatio?: number;
}): Promise<void> {
  const existing = await findPopularStrategyByKey(params.cacheKey);

  if (existing) {
    // Update existing: increment usage, recalculate avgReturn
    const newUsageCount = existing.usageCount + 1;
    const prevAvg = parseFloat(existing.avgReturn ?? '0');
    const newAvg =
      params.totalReturn !== undefined
        ? (prevAvg * existing.usageCount + params.totalReturn) / newUsageCount
        : prevAvg;

    await db
      .update(popularStrategies)
      .set({
        usageCount: newUsageCount,
        avgReturn: newAvg.toString(),
        updatedAt: new Date(),
      })
      .where(eq(popularStrategies.cacheKey, params.cacheKey));
  } else {
    // Insert new entry into pool
    await db.insert(popularStrategies).values({
      cacheKey: params.cacheKey,
      source: 'user_generated',
      sourceId: params.cacheKey,
      name: `AI Generated ${params.strategyType} Strategy`,
      strategyType: params.strategyType,
      veighnaCode: params.code,
      conversionStatus: 'success',
      authorId: params.authorId,
      avgReturn: params.totalReturn?.toString(),
      sharpeRatio: params.sharpeRatio?.toString(),
      usageCount: 1,
      crawledAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// ============================================================================
// User Event Tracking Queries (用户行为事件追踪查询)
// ============================================================================

/**
 * Record a user behavior event asynchronously (fire-and-forget)
 * 异步记录用户行为事件（不阻塞响应链路）
 */
export function recordUserEvent(event: {
  userId?: string | null;
  sessionId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  tokenCost?: number;
}): void {
  // Fire-and-forget: do not await, never block the response
  void db
    .insert(userEvents)
    .values({
      userId: event.userId ?? null,
      sessionId: event.sessionId ?? null,
      eventType: event.eventType,
      metadata: event.metadata ?? null,
      tokenCost: event.tokenCost ?? 0,
    })
    .catch((err: unknown) => {
      console.error('[recordUserEvent] Failed to record event:', err);
    });
}
