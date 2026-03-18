/**
 * History Service - Multi-tenant History Record Management
 * 历史记录服务 - 多租户历史记录管理
 *
 * Provides CRUD operations for:
 * - Strategy history (version-controlled)
 * - Backtest history
 * - Trading history
 * - Tenant management
 *
 * Features:
 * - Tenant-level data isolation
 * - Permission checking
 * - Pagination support
 *
 * @module lib/services/history-service
 */

import { db } from '@/lib/db';
import {
  tenants,
  tenantMembers,
  strategyHistory,
  backtestHistory,
  tradingHistory,
  type Tenant,
  type NewTenant,
  type TenantMember,
  type NewTenantMember,
  type StrategyHistory,
  type NewStrategyHistory,
  type BacktestHistory,
  type NewBacktestHistory,
  type TradingHistory,
  type NewTradingHistory,
} from '@/lib/db/schema';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';

// =============================================================================
// Types
// =============================================================================

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HistoryFilter {
  userId?: string;
  tenantId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  symbol?: string;
  isActive?: boolean;
  isStarred?: boolean;
}

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if user has access to a tenant
 * 检查用户是否有租户访问权限
 */
export async function checkTenantAccess(
  userId: string,
  tenantId: number,
  requiredRole?: TenantRole[]
): Promise<{ hasAccess: boolean; role: TenantRole | null }> {
  try {
    const member = await db
      .select({
        role: tenantMembers.role,
      })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
      .limit(1);

    if (member.length === 0) {
      return { hasAccess: false, role: null };
    }

    const role = member[0]!.role as TenantRole;

    if (requiredRole && !requiredRole.includes(role)) {
      return { hasAccess: false, role };
    }

    return { hasAccess: true, role };
  } catch (error) {
    console.error('[HistoryService] checkTenantAccess error:', error);
    return { hasAccess: false, role: null };
  }
}

/**
 * Get user's default tenant or personal scope
 * 获取用户的默认租户或个人范围
 */
export async function getUserTenants(userId: string): Promise<Tenant[]> {
  try {
    const memberships = await db
      .select({
        tenant: tenants,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
      .where(eq(tenantMembers.userId, userId));

    return memberships.map((m) => m.tenant);
  } catch (error) {
    console.error('[HistoryService] getUserTenants error:', error);
    return [];
  }
}

// =============================================================================
// Tenant CRUD
// =============================================================================

/**
 * Create a new tenant
 * 创建新租户
 */
export async function createTenant(
  data: Omit<NewTenant, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Tenant | null> {
  try {
    const result = await db.insert(tenants).values(data).returning();

    if (result[0]) {
      // Automatically add owner as member
      await db.insert(tenantMembers).values({
        tenantId: result[0].id,
        userId: data.ownerId,
        role: 'owner',
        status: 'accepted',
      });
    }

    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] createTenant error:', error);
    return null;
  }
}

/**
 * Get tenant by ID
 * 通过ID获取租户
 */
export async function getTenant(id: number): Promise<Tenant | null> {
  try {
    const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] getTenant error:', error);
    return null;
  }
}

/**
 * Get tenant by slug
 * 通过slug获取租户
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] getTenantBySlug error:', error);
    return null;
  }
}

/**
 * Add member to tenant
 * 添加租户成员
 */
export async function addTenantMember(
  data: Omit<NewTenantMember, 'id' | 'joinedAt'>
): Promise<TenantMember | null> {
  try {
    const result = await db.insert(tenantMembers).values(data).returning();
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] addTenantMember error:', error);
    return null;
  }
}

/**
 * Remove member from tenant
 * 移除租户成员
 */
export async function removeTenantMember(tenantId: number, userId: string): Promise<boolean> {
  try {
    await db
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)));
    return true;
  } catch (error) {
    console.error('[HistoryService] removeTenantMember error:', error);
    return false;
  }
}

// =============================================================================
// Strategy History CRUD
// =============================================================================

/**
 * Save strategy to history
 * 保存策略到历史记录
 */
export async function saveStrategyHistory(
  data: Omit<NewStrategyHistory, 'id' | 'createdAt'>
): Promise<StrategyHistory | null> {
  try {
    const result = await db.insert(strategyHistory).values(data).returning();
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] saveStrategyHistory error:', error);
    return null;
  }
}

/**
 * Get strategy history with pagination
 * 获取策略历史（分页）
 */
export async function getStrategyHistory(
  filter: HistoryFilter,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<StrategyHistory>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  try {
    // Build where conditions
    const conditions = [];
    if (filter.userId) conditions.push(eq(strategyHistory.userId, filter.userId));
    if (filter.tenantId) conditions.push(eq(strategyHistory.tenantId, filter.tenantId));
    if (filter.isActive !== undefined) conditions.push(eq(strategyHistory.isActive, filter.isActive));
    if (filter.isStarred !== undefined) conditions.push(eq(strategyHistory.isStarred, filter.isStarred));
    if (filter.search) {
      conditions.push(
        or(
          ilike(strategyHistory.strategyName, `%${filter.search}%`),
          ilike(strategyHistory.description || '', `%${filter.search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(strategyHistory)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get data
    const data = await db
      .select()
      .from(strategyHistory)
      .where(whereClause)
      .orderBy(desc(strategyHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('[HistoryService] getStrategyHistory error:', error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }
}

/**
 * Get single strategy by ID
 * 通过ID获取单个策略
 */
export async function getStrategyById(id: number): Promise<StrategyHistory | null> {
  try {
    const result = await db.select().from(strategyHistory).where(eq(strategyHistory.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] getStrategyById error:', error);
    return null;
  }
}

/**
 * Update strategy (star, active status, etc.)
 * 更新策略（收藏、活动状态等）
 */
export async function updateStrategy(
  id: number,
  updates: Partial<Pick<StrategyHistory, 'isActive' | 'isStarred' | 'description' | 'tags'>>
): Promise<boolean> {
  try {
    await db.update(strategyHistory).set(updates).where(eq(strategyHistory.id, id));
    return true;
  } catch (error) {
    console.error('[HistoryService] updateStrategy error:', error);
    return false;
  }
}

/**
 * Delete strategy by ID
 * 删除策略
 */
export async function deleteStrategy(id: number): Promise<boolean> {
  try {
    await db.delete(strategyHistory).where(eq(strategyHistory.id, id));
    return true;
  } catch (error) {
    console.error('[HistoryService] deleteStrategy error:', error);
    return false;
  }
}

// =============================================================================
// Backtest History CRUD
// =============================================================================

/**
 * Save backtest result to history
 * 保存回测结果到历史记录
 */
export async function saveBacktestHistory(
  data: Omit<NewBacktestHistory, 'id' | 'createdAt'>
): Promise<BacktestHistory | null> {
  try {
    const result = await db.insert(backtestHistory).values(data).returning();
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] saveBacktestHistory error:', error);
    return null;
  }
}

/**
 * Get backtest history with pagination
 * 获取回测历史（分页）
 */
export async function getBacktestHistory(
  filter: HistoryFilter,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<BacktestHistory>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  try {
    // Build where conditions
    const conditions = [];
    if (filter.userId) conditions.push(eq(backtestHistory.userId, filter.userId));
    if (filter.tenantId) conditions.push(eq(backtestHistory.tenantId, filter.tenantId));
    if (filter.symbol) conditions.push(eq(backtestHistory.symbol, filter.symbol));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(backtestHistory)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get data
    const data = await db
      .select()
      .from(backtestHistory)
      .where(whereClause)
      .orderBy(desc(backtestHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('[HistoryService] getBacktestHistory error:', error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }
}

/**
 * Get single backtest by ID
 * 通过ID获取单个回测
 */
export async function getBacktestById(id: number): Promise<BacktestHistory | null> {
  try {
    const result = await db.select().from(backtestHistory).where(eq(backtestHistory.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] getBacktestById error:', error);
    return null;
  }
}

/**
 * Delete backtest by ID
 * 删除回测
 */
export async function deleteBacktest(id: number): Promise<boolean> {
  try {
    await db.delete(backtestHistory).where(eq(backtestHistory.id, id));
    return true;
  } catch (error) {
    console.error('[HistoryService] deleteBacktest error:', error);
    return false;
  }
}

// =============================================================================
// Trading History CRUD
// =============================================================================

/**
 * Save trade to history
 * 保存交易到历史记录
 */
export async function saveTradingHistory(
  data: Omit<NewTradingHistory, 'id' | 'createdAt'>
): Promise<TradingHistory | null> {
  try {
    const result = await db.insert(tradingHistory).values(data).returning();
    return result[0] || null;
  } catch (error) {
    console.error('[HistoryService] saveTradingHistory error:', error);
    return null;
  }
}

/**
 * Get trading history with pagination
 * 获取交易历史（分页）
 */
export async function getTradingHistory(
  filter: HistoryFilter,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<TradingHistory>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  try {
    // Build where conditions
    const conditions = [];
    if (filter.userId) conditions.push(eq(tradingHistory.userId, filter.userId));
    if (filter.tenantId) conditions.push(eq(tradingHistory.tenantId, filter.tenantId));
    if (filter.symbol) conditions.push(eq(tradingHistory.symbol, filter.symbol));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tradingHistory)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get data
    const data = await db
      .select()
      .from(tradingHistory)
      .where(whereClause)
      .orderBy(desc(tradingHistory.executedAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('[HistoryService] getTradingHistory error:', error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }
}

/**
 * Get trading statistics for a user/tenant
 * 获取交易统计
 */
export async function getTradingStats(
  userId: string,
  tenantId?: number
): Promise<{
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
} | null> {
  try {
    const conditions = [eq(tradingHistory.userId, userId)];
    if (tenantId) conditions.push(eq(tradingHistory.tenantId, tenantId));

    const result = await db
      .select({
        totalTrades: sql<number>`count(*)::int`,
        totalPnl: sql<number>`coalesce(sum(realized_pnl), 0)::real`,
        winCount: sql<number>`count(*) filter (where realized_pnl > 0)::int`,
        lossCount: sql<number>`count(*) filter (where realized_pnl < 0)::int`,
        avgProfit: sql<number>`coalesce(avg(realized_pnl) filter (where realized_pnl > 0), 0)::real`,
        avgLoss: sql<number>`coalesce(avg(realized_pnl) filter (where realized_pnl < 0), 0)::real`,
      })
      .from(tradingHistory)
      .where(and(...conditions));

    if (!result[0]) return null;

    const stats = result[0];
    const winRate = stats.totalTrades > 0 ? stats.winCount / stats.totalTrades : 0;

    return {
      totalTrades: stats.totalTrades,
      totalPnl: stats.totalPnl,
      winRate,
      avgProfit: stats.avgProfit,
      avgLoss: stats.avgLoss,
    };
  } catch (error) {
    console.error('[HistoryService] getTradingStats error:', error);
    return null;
  }
}

/**
 * Delete trade by ID
 * 删除交易记录
 */
export async function deleteTrade(id: number): Promise<boolean> {
  try {
    await db.delete(tradingHistory).where(eq(tradingHistory.id, id));
    return true;
  } catch (error) {
    console.error('[HistoryService] deleteTrade error:', error);
    return false;
  }
}
