/**
 * Database Schema Definitions
 * 数据库Schema定义
 *
 * PostgreSQL database schema for Lucrum trading platform
 * Lucrum交易平台的PostgreSQL数据库模式
 *
 * Tables:
 * - stocks: Stock basic information (股票基本信息)
 * - sectors: Industry sectors (行业板块)
 * - stock_sector_mapping: Stock-sector relationships (股票-板块映射)
 * - kline_daily: Daily K-line data (日K线数据) - Core table
 * - data_update_log: Data update history (数据更新日志)
 * - validation_cache: Validation result cache (验证结果缓存)
 * - validation_presets: User preset configurations (用户预设配置)
 */

import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
  uuid,
  decimal,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// User Authentication & Management Tables (用户认证与管理表)
// ============================================================================

/**
 * User identity is managed by Zitadel (SSO). User IDs are Zitadel `sub` claims
 * (numeric snowflake strings, e.g. "359955593424799557"), stored as text.
 * No local `users` table — Zitadel is the single source of truth.
 */

/**
 * User preferences table - User-specific settings and preferences
 * 用户偏好表 - 用户特定的设置和偏好
 */
export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: text('user_id').primaryKey(),
    theme: varchar('theme', { length: 20 }).default('dark'),
    defaultTimeframe: varchar('default_timeframe', { length: 10 }).default('1d'),
    defaultCapital: decimal('default_capital', { precision: 15, scale: 2 }).default('100000'),
    autoSaveEnabled: boolean('auto_save_enabled').default(true).notNull(),
    notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
    preferences: jsonb('preferences'), // Additional custom preferences as JSON
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

/**
 * User drafts table - Auto-saved drafts for recovery
 * 用户草稿表 - 自动保存的草稿用于恢复
 */
export const userDrafts = pgTable(
  'user_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    draftType: varchar('draft_type', { length: 50 }).notNull(), // 'strategy', 'backtest', 'advisor'
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_user_drafts_user_created').on(table.userId, table.createdAt),
    typeIdx: index('idx_user_drafts_type').on(table.draftType),
  })
);

// ============================================================================
// Table 1: Stocks (股票基本信息)
// ============================================================================

/**
 * Stocks table - Store basic information of all A-share stocks
 * 股票表 - 存储所有A股的基本信息
 *
 * Estimated rows: ~5,000 (total A-share listed companies)
 */
export const stocks = pgTable(
  'stocks',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 10 }).notNull().unique(),
    name: varchar('name', { length: 50 }).notNull(),
    listingDate: varchar('listing_date', { length: 10 }), // "2001-08-27"
    isST: boolean('is_st').default(false).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(), // active, suspended, delisted
    marketCap: real('market_cap'), // Market cap in 亿元
    exchange: varchar('exchange', { length: 10 }), // SH, SZ
    industry: varchar('industry', { length: 50 }), // Industry category
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    symbolIdx: index('idx_stocks_symbol').on(table.symbol),
    statusIdx: index('idx_stocks_status').on(table.status),
    isSTIdx: index('idx_stocks_st').on(table.isST),
    nameIdx: index('idx_stocks_name').on(table.name),
  })
);

// ============================================================================
// Table 2: Sectors (行业板块)
// ============================================================================

/**
 * Sectors table - Industry sector classifications
 * 板块表 - 行业板块分类
 *
 * Estimated rows: ~150 (all industry sectors)
 */
export const sectors = pgTable(
  'sectors',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull().unique(), // "BK0478"
    name: varchar('name', { length: 50 }).notNull(),
    nameEn: varchar('name_en', { length: 100 }),
    level: integer('level').default(1).notNull(), // 1=primary, 2=secondary
    parentId: integer('parent_id'), // Parent sector ID
    stockCount: integer('stock_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('idx_sectors_code').on(table.code),
    parentIdx: index('idx_sectors_parent').on(table.parentId),
  })
);

// ============================================================================
// Table 3: Stock-Sector Mapping (股票-板块映射)
// ============================================================================

/**
 * Stock-sector mapping table
 * 股票-板块映射表
 *
 * Estimated rows: ~10,000 (one stock can belong to multiple sectors)
 */
export const stockSectorMapping = pgTable(
  'stock_sector_mapping',
  {
    id: serial('id').primaryKey(),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    sectorId: integer('sector_id')
      .notNull()
      .references(() => sectors.id, { onDelete: 'cascade' }),
    weight: real('weight').default(1.0).notNull(), // Weight if sector is weighted
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    stockIdx: index('idx_mapping_stock').on(table.stockId),
    sectorIdx: index('idx_mapping_sector').on(table.sectorId),
    uniquePair: uniqueIndex('unique_stock_sector').on(table.stockId, table.sectorId),
  })
);

// ============================================================================
// Table 4: K-line Daily Data (日K线数据) ⭐ CORE TABLE
// ============================================================================

/**
 * K-line daily data table - Store historical daily K-line data
 * 日K线数据表 - 存储历史日K线数据
 *
 * Estimated rows: ~2,500,000 (5,000 stocks × 500 trading days)
 * Storage: ~300MB for 2 years, ~1.5GB for 5 years
 *
 * This is the CORE table for backtesting and validation
 */
export const klineDaily = pgTable(
  'kline_daily',
  {
    id: serial('id').primaryKey(),
    stockId: integer('stock_id')
      .notNull()
      .references(() => stocks.id, { onDelete: 'cascade' }),
    date: varchar('date', { length: 10 }).notNull(), // "2024-01-15"
    open: real('open').notNull(),
    high: real('high').notNull(),
    low: real('low').notNull(),
    close: real('close').notNull(),
    volume: real('volume').notNull(), // Volume in shares
    amount: real('amount'), // Amount in CNY
    adjFactor: real('adj_factor').default(1.0).notNull(), // Adjustment factor for splits/dividends
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    stockDateIdx: index('idx_kline_stock_date').on(table.stockId, table.date),
    dateIdx: index('idx_kline_date').on(table.date),
    stockIdIdx: index('idx_kline_stock_id').on(table.stockId),
    uniqueStockDate: uniqueIndex('unique_stock_date').on(table.stockId, table.date),
  })
);

// ============================================================================
// Table 5: Data Update Log (数据更新日志)
// ============================================================================

/**
 * Data update log table - Track daily data update tasks
 * 数据更新日志表 - 跟踪每日数据更新任务
 */
export const dataUpdateLog = pgTable(
  'data_update_log',
  {
    id: serial('id').primaryKey(),
    updateDate: varchar('update_date', { length: 10 }).notNull(), // "2024-01-15"
    updateType: varchar('update_type', { length: 20 }).notNull(), // daily, full, manual
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    status: varchar('status', { length: 20 }).notNull(), // running, success, failed
    recordsUpdated: integer('records_updated').default(0).notNull(),
    recordsFailed: integer('records_failed').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index('idx_log_date').on(table.updateDate),
    statusIdx: index('idx_log_status').on(table.status),
    typeIdx: index('idx_log_type').on(table.updateType),
  })
);

// ============================================================================
// Table 6: Validation Cache (验证结果缓存)
// ============================================================================

/**
 * Validation cache table - Cache validation results for performance
 * 验证结果缓存表 - 缓存验证结果以提升性能
 *
 * TTL: 24 hours
 * Cache hit rate target: 30-40%
 */
export const validationCache = pgTable(
  'validation_cache',
  {
    id: serial('id').primaryKey(),
    cacheKey: varchar('cache_key', { length: 64 }).notNull().unique(), // MD5 hash
    config: text('config').notNull(), // JSON serialized config
    result: text('result').notNull(), // JSON serialized result
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(), // Expire after 24h
    hitCount: integer('hit_count').default(0).notNull(),
  },
  (table) => ({
    keyIdx: index('idx_cache_key').on(table.cacheKey),
    expiresIdx: index('idx_cache_expires').on(table.expiresAt),
  })
);

// ============================================================================
// Table 7: Validation Presets (用户预设配置)
// ============================================================================

/**
 * Validation presets table - User saved stock combinations
 * 验证预设表 - 用户保存的股票组合
 */
export const validationPresets = pgTable(
  'validation_presets',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    symbols: text('symbols').notNull(), // JSON array: ["600519", "000858"]
    config: text('config'), // JSON serialized config
    isFavorite: boolean('is_favorite').default(false).notNull(),
    lastUsedAt: timestamp('last_used_at'),
    useCount: integer('use_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('idx_presets_name').on(table.name),
    favoriteIdx: index('idx_presets_favorite').on(table.isFavorite),
  })
);

// ============================================================================
// Multi-Tenant History Tables (Phase B-2)
// 多租户历史记录表
// ============================================================================

/**
 * Tenants table - Organization/team information
 * 租户表 - 组织/团队信息
 */
export const tenants = pgTable(
  'tenants',
  {
    id: serial('id').primaryKey(),
    /** Tenant display name / 租户显示名称 */
    name: varchar('name', { length: 100 }).notNull(),
    /** URL-friendly slug / URL友好的标识符 */
    slug: varchar('slug', { length: 50 }).unique().notNull(),
    /** Owner user ID / 所有者用户ID */
    ownerId: text('owner_id').notNull(),
    /** Subscription plan / 订阅计划 */
    plan: varchar('plan', { length: 20 }).default('free').notNull(),
    /** Maximum members allowed / 最大成员数 */
    maxMembers: integer('max_members').default(5).notNull(),
    /** Tenant settings JSON / 租户设置JSON */
    settings: text('settings'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('idx_tenants_slug').on(table.slug),
    ownerIdx: index('idx_tenants_owner').on(table.ownerId),
  })
);

/**
 * Tenant members table - User-tenant relationships
 * 租户成员表 - 用户与租户的关系
 */
export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: serial('id').primaryKey(),
    /** Reference to tenant / 租户引用 */
    tenantId: integer('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    /** User ID / 用户ID */
    userId: text('user_id').notNull(),
    /** Member role: owner, admin, member, viewer / 成员角色 */
    role: varchar('role', { length: 20 }).default('member').notNull(),
    /** Invitation status: pending, accepted, rejected / 邀请状态 */
    status: varchar('status', { length: 20 }).default('accepted').notNull(),
    /** Invited by user ID / 邀请人用户ID */
    invitedBy: text('invited_by'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_tenant_members_tenant').on(table.tenantId),
    userIdx: index('idx_tenant_members_user').on(table.userId),
    uniqueMember: index('idx_tenant_members_unique').on(table.tenantId, table.userId),
  })
);

/**
 * Tenant invitations table - Pending team invitations
 * 租户邀请表 - 待处理的团队邀请
 */
export const tenantInvitations = pgTable(
  'tenant_invitations',
  {
    id: serial('id').primaryKey(),
    /** Tenant reference / 租户引用 */
    tenantId: integer('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    /** Invitee email / 被邀请人邮箱 */
    email: varchar('email', { length: 255 }).notNull(),
    /** Assigned role / 分配的角色 */
    role: varchar('role', { length: 20 }).default('member').notNull(),
    /** Unique invitation token / 唯一邀请令牌 */
    token: varchar('token', { length: 64 }).unique().notNull(),
    /** User who sent the invitation / 发送邀请的用户 */
    invitedBy: text('invited_by').notNull(),
    /** Invitation status: pending, accepted, expired, cancelled / 邀请状态 */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    /** When the invitation expires / 邀请过期时间 */
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_tenant_invitations_tenant').on(table.tenantId),
    emailIdx: index('idx_tenant_invitations_email').on(table.email),
    tokenIdx: index('idx_tenant_invitations_token').on(table.token),
    statusIdx: index('idx_tenant_invitations_status').on(table.status),
  })
);

/**
 * Team activity table - Audit log of team actions
 * 团队活动表 - 团队操作审计日志
 */
export const teamActivity = pgTable(
  'team_activity',
  {
    id: serial('id').primaryKey(),
    /** Tenant reference / 租户引用 */
    tenantId: integer('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    /** Acting user ID / 操作用户ID */
    userId: text('user_id').notNull(),
    /** Actor display name (snapshot) / 操作者显示名称（快照） */
    actorName: varchar('actor_name', { length: 100 }).notNull(),
    /** Action type: strategy_created, backtest_run, member_invited, etc. / 操作类型 */
    actionType: varchar('action_type', { length: 50 }).notNull(),
    /** Resource type: strategy, backtest, member, team / 资源类型 */
    resourceType: varchar('resource_type', { length: 30 }).notNull(),
    /** Resource identifier / 资源标识符 */
    resourceId: varchar('resource_id', { length: 100 }),
    /** Additional metadata / 额外元数据 */
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index('idx_team_activity_tenant_created').on(table.tenantId, table.createdAt),
    userIdx: index('idx_team_activity_user').on(table.userId),
  })
);

/**
 * Notifications table - User notifications
 * 通知表 - 用户通知
 */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    /** Target user / 目标用户 */
    userId: text('user_id').notNull(),
    /** Optional tenant context / 可选租户上下文 */
    tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    /** Notification type: invite, activity, system, review / 通知类型 */
    type: varchar('type', { length: 30 }).notNull(),
    /** Notification title / 通知标题 */
    title: varchar('title', { length: 200 }).notNull(),
    /** Notification body / 通知正文 */
    body: text('body'),
    /** Additional metadata (link, resourceId, etc.) / 额外元数据 */
    metadata: jsonb('metadata'),
    /** Whether the notification has been read / 是否已读 */
    isRead: boolean('is_read').default(false).notNull(),
    /** When the notification was read / 已读时间 */
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index('idx_notifications_user_read').on(table.userId, table.isRead, table.createdAt),
  })
);

/**
 * Strategy history table - Version-controlled strategy storage
 * 策略历史表 - 版本控制的策略存储
 */
export const strategyHistory = pgTable(
  'strategy_history',
  {
    id: serial('id').primaryKey(),
    /** User who created this version / 创建此版本的用户 */
    userId: text('user_id').notNull(),
    /** Optional tenant reference / 可选的租户引用 */
    tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    /** Strategy display name / 策略显示名称 */
    strategyName: varchar('strategy_name', { length: 100 }).notNull(),
    /** Strategy description / 策略描述 */
    description: text('description'),
    /** Strategy code (Python) / 策略代码 */
    strategyCode: text('strategy_code').notNull(),
    /** Parameters JSON / 参数JSON */
    parameters: text('parameters').notNull(),
    /** Strategy type: ai_generated, manual, imported / 策略类型 */
    strategyType: varchar('strategy_type', { length: 20 }).default('ai_generated').notNull(),
    /** Version number / 版本号 */
    version: integer('version').default(1).notNull(),
    /** Parent version ID for tracking history / 父版本ID用于追踪历史 */
    parentVersionId: integer('parent_version_id'),
    /** Tags for categorization / 分类标签 */
    tags: text('tags'),
    /** Is this the current active version / 是否为当前活动版本 */
    isActive: boolean('is_active').default(true).notNull(),
    /** Is starred/favorited / 是否收藏 */
    isStarred: boolean('is_starred').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_strategy_history_user').on(table.userId),
    tenantIdx: index('idx_strategy_history_tenant').on(table.tenantId),
    nameIdx: index('idx_strategy_history_name').on(table.strategyName),
    activeIdx: index('idx_strategy_history_active').on(table.isActive),
  })
);

/**
 * Strategy reviews table - PR-like strategy review workflow
 * 策略评审表 - 类 PR 的策略评审工作流
 */
export const strategyReviews = pgTable(
  'strategy_reviews',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Strategy being reviewed / 被评审的策略 */
    strategyHistoryId: integer('strategy_history_id')
      .notNull()
      .references(() => strategyHistory.id, { onDelete: 'cascade' }),
    /** User who submitted the review request / 提交评审的用户 */
    authorId: text('author_id').notNull(),
    authorName: varchar('author_name', { length: 100 }).notNull(),
    /** Review title / 评审标题 */
    title: varchar('title', { length: 200 }).notNull(),
    /** Review description / 评审描述 */
    description: text('description'),
    /** Status: open, approved, rejected, withdrawn / 状态 */
    status: varchar('status', { length: 20 }).default('open').notNull(),
    /** Number of approvals needed / 需要的批准数 */
    requiredApprovals: integer('required_approvals').default(1).notNull(),
    /** Current approval count / 当前批准数 */
    approvalCount: integer('approval_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    tenantIdx: index('idx_strategy_reviews_tenant').on(table.tenantId),
    statusIdx: index('idx_strategy_reviews_status').on(table.tenantId, table.status),
    authorIdx: index('idx_strategy_reviews_author').on(table.authorId),
  })
);

/**
 * Review comments table - Comments on strategy reviews
 * 评审评论表 - 策略评审的评论
 */
export const reviewComments = pgTable(
  'review_comments',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => strategyReviews.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    userName: varchar('user_name', { length: 100 }).notNull(),
    /** Comment type: comment, approve, reject, request_changes / 评论类型 */
    type: varchar('type', { length: 20 }).default('comment').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    reviewIdx: index('idx_review_comments_review').on(table.reviewId),
    userIdx: index('idx_review_comments_user').on(table.userId),
  })
);

/**
 * Shared portfolios table - Team shared investment portfolios
 * 共享投资组合表 - 团队共享投资组合
 */
export const sharedPortfolios = pgTable(
  'shared_portfolios',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    /** Strategy IDs included / 包含的策略ID列表 */
    strategies: jsonb('strategies').$type<number[]>(),
    /** Stock symbols / 股票列表 */
    symbols: jsonb('symbols').$type<string[]>(),
    /** Portfolio configuration / 组合配置 */
    config: jsonb('config').$type<{
      initialCapital?: number;
      startDate?: string;
      endDate?: string;
      rebalancePeriod?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_shared_portfolios_tenant').on(table.tenantId),
    creatorIdx: index('idx_shared_portfolios_creator').on(table.createdBy),
  })
);

/**
 * Team leaderboard snapshots - Periodic ranking snapshots
 * 团队排行榜快照 - 定期排名快照
 */
export const teamLeaderboardSnapshots = pgTable(
  'team_leaderboard_snapshots',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    /** Period type: daily, weekly, monthly, all_time / 周期类型 */
    period: varchar('period', { length: 20 }).notNull(),
    /** Period key: "2026-04-11", "2026-W15", "2026-04" / 周期标识 */
    periodKey: varchar('period_key', { length: 20 }).notNull(),
    totalReturn: real('total_return').default(0).notNull(),
    sharpeRatio: real('sharpe_ratio').default(0).notNull(),
    /** Composite score / 综合评分 */
    score: real('score').default(0).notNull(),
    /** Rank within the period / 排名 */
    rank: integer('rank').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantPeriodIdx: index('idx_leaderboard_tenant_period').on(table.tenantId, table.period, table.periodKey),
    userIdx: index('idx_leaderboard_user').on(table.userId),
    rankIdx: index('idx_leaderboard_rank').on(table.tenantId, table.periodKey, table.rank),
  })
);

/**
 * Strategy annotations table - Line-level code review comments
 * 策略标注表 - 行级代码评审评论
 */
export const strategyAnnotations = pgTable(
  'strategy_annotations',
  {
    id: serial('id').primaryKey(),
    strategyHistoryId: integer('strategy_history_id')
      .notNull()
      .references(() => strategyHistory.id, { onDelete: 'cascade' }),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    userName: varchar('user_name', { length: 100 }).notNull(),
    lineNumber: integer('line_number'),
    content: text('content').notNull(),
    parentId: integer('parent_id'),
    resolved: boolean('resolved').default(false).notNull(),
    resolvedBy: text('resolved_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    strategyIdx: index('idx_strategy_annotations_strategy').on(table.strategyHistoryId),
    tenantIdx: index('idx_strategy_annotations_tenant').on(table.tenantId),
    lineIdx: index('idx_strategy_annotations_line').on(table.strategyHistoryId, table.lineNumber),
    parentIdx: index('idx_strategy_annotations_parent').on(table.parentId),
  })
);

/**
 * Backtest history table - Cached backtest results
 * 回测历史表 - 缓存的回测结果
 */
export const backtestHistory = pgTable(
  'backtest_history',
  {
    id: serial('id').primaryKey(),
    /** User who ran the backtest / 运行回测的用户 */
    userId: text('user_id').notNull(),
    /** Optional tenant reference / 可选的租户引用 */
    tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    /** Reference to strategy version / 策略版本引用 */
    strategyHistoryId: integer('strategy_history_id').references(() => strategyHistory.id, {
      onDelete: 'set null',
    }),
    /** Stock symbol / 股票代码 */
    symbol: varchar('symbol', { length: 20 }).notNull(),
    /** Stock name for display / 股票名称用于显示 */
    stockName: varchar('stock_name', { length: 50 }),
    /** Backtest start date / 回测开始日期 */
    startDate: varchar('start_date', { length: 10 }).notNull(),
    /** Backtest end date / 回测结束日期 */
    endDate: varchar('end_date', { length: 10 }).notNull(),
    /** Timeframe: 1d, 1w, etc. / 时间周期 */
    timeframe: varchar('timeframe', { length: 10 }).default('1d').notNull(),
    /** Full config JSON / 完整配置JSON */
    config: text('config').notNull(),
    /** Full result JSON / 完整结果JSON */
    result: text('result').notNull(),
    /** Data source: database, api, mock / 数据来源 */
    dataSource: varchar('data_source', { length: 30 }).notNull(),
    /** Data coverage rate / 数据覆盖率 */
    dataCoverage: real('data_coverage'),
    /** Key metrics for quick display / 关键指标用于快速显示 */
    totalReturn: real('total_return'),
    sharpeRatio: real('sharpe_ratio'),
    maxDrawdown: real('max_drawdown'),
    winRate: real('win_rate'),
    /** Execution time in ms / 执行时间（毫秒） */
    executionTime: integer('execution_time'),
    /** Notes/comments / 备注 */
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_backtest_history_user').on(table.userId),
    tenantIdx: index('idx_backtest_history_tenant').on(table.tenantId),
    strategyIdx: index('idx_backtest_history_strategy').on(table.strategyHistoryId),
    symbolIdx: index('idx_backtest_history_symbol').on(table.symbol),
    dateIdx: index('idx_backtest_history_date').on(table.createdAt),
  })
);

/**
 * Trading history table - Trade records (paper/live)
 * 交易历史表 - 交易记录（模拟/实盘）
 */
export const tradingHistory = pgTable(
  'trading_history',
  {
    id: serial('id').primaryKey(),
    /** User who made the trade / 交易用户 */
    userId: text('user_id').notNull(),
    /** Optional tenant reference / 可选的租户引用 */
    tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    /** Optional strategy reference / 可选的策略引用 */
    strategyHistoryId: integer('strategy_history_id').references(() => strategyHistory.id, {
      onDelete: 'set null',
    }),
    /** Stock symbol / 股票代码 */
    symbol: varchar('symbol', { length: 20 }).notNull(),
    /** Stock name / 股票名称 */
    stockName: varchar('stock_name', { length: 50 }),
    /** Trade side: buy, sell / 交易方向 */
    side: varchar('side', { length: 10 }).notNull(),
    /** Order type: market, limit / 订单类型 */
    orderType: varchar('order_type', { length: 20 }).default('market').notNull(),
    /** Execution price / 成交价格 */
    price: real('price').notNull(),
    /** Trade size (shares) / 交易数量（股） */
    size: integer('size').notNull(),
    /** Total amount / 交易金额 */
    amount: real('amount').notNull(),
    /** Commission paid / 手续费 */
    commission: real('commission'),
    /** Order status: pending, filled, cancelled, rejected / 订单状态 */
    status: varchar('status', { length: 20 }).default('filled').notNull(),
    /** Realized P&L for this trade / 此交易实现的盈亏 */
    realizedPnl: real('realized_pnl'),
    /** Is paper trade or live trade / 是否为模拟交易 */
    isPaperTrade: boolean('is_paper_trade').default(true).notNull(),
    /** Broker used / 券商 */
    broker: varchar('broker', { length: 30 }).default('mock').notNull(),
    /** External order ID / 外部订单ID */
    externalOrderId: varchar('external_order_id', { length: 100 }),
    /** Trade notes / 交易备注 */
    notes: text('notes'),
    /** Trade execution time / 交易执行时间 */
    executedAt: timestamp('executed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_trading_history_user').on(table.userId),
    tenantIdx: index('idx_trading_history_tenant').on(table.tenantId),
    symbolIdx: index('idx_trading_history_symbol').on(table.symbol),
    dateIdx: index('idx_trading_history_date').on(table.executedAt),
    statusIdx: index('idx_trading_history_status').on(table.status),
  })
);

// ============================================================================
// Popular Strategy System Tables (流行策略系统)
// ============================================================================

/**
 * Popular strategies table - Store crawled popular strategies from various sources
 * 流行策略表 - 存储从各平台爬取的流行策略
 *
 * Sources: GitHub Awesome-Quant, JoinQuant, UQer, XueQiu
 */
export const popularStrategies = pgTable(
  'popular_strategies',
  {
    id: serial('id').primaryKey(),
    /** Source platform / 来源平台 */
    source: varchar('source', { length: 50 }).notNull(), // github, joinquant, uqer, xueqiu
    /** Source platform strategy ID / 源平台策略ID */
    sourceId: varchar('source_id', { length: 100 }).notNull(),
    /** Strategy name / 策略名称 */
    name: varchar('name', { length: 200 }).notNull(),
    /** Strategy description / 策略描述 */
    description: text('description'),
    /** Author name / 作者 */
    author: varchar('author', { length: 100 }),

    // Strategy classification / 策略分类
    /** Strategy type: trend, mean-revert, momentum, factor, etc. / 策略类型 */
    strategyType: varchar('strategy_type', { length: 50 }),
    /** Target markets: stock, futures, crypto / 适用市场 */
    markets: jsonb('markets').$type<string[]>(),
    /** Technical indicators used / 使用的技术指标 */
    indicators: jsonb('indicators').$type<string[]>(),

    // Performance metrics / 性能指标
    /** Annual return rate / 年化收益率 */
    annualReturn: decimal('annual_return', { precision: 10, scale: 4 }),
    /** Maximum drawdown / 最大回撤 */
    maxDrawdown: decimal('max_drawdown', { precision: 10, scale: 4 }),
    /** Sharpe ratio / 夏普比率 */
    sharpeRatio: decimal('sharpe_ratio', { precision: 10, scale: 4 }),

    // Popularity metrics / 流行度指标
    /** View count / 浏览量 */
    views: integer('views').default(0).notNull(),
    /** Like count / 点赞数 */
    likes: integer('likes').default(0).notNull(),
    /** Calculated popularity score / 计算的流行度分数 */
    popularityScore: decimal('popularity_score', { precision: 10, scale: 2 }),

    // Code content / 代码内容
    /** Original source code / 原始代码 */
    originalCode: text('original_code'),
    /** Converted VeighNa code / 转换后的VeighNa代码 */
    veighnaCode: text('veighna_code'),
    /** Conversion status: pending, success, failed / 转换状态 */
    conversionStatus: varchar('conversion_status', { length: 20 }).default('pending'),
    /** Conversion error message / 转换错误信息 */
    conversionError: text('conversion_error'),

    // Metadata / 元数据
    /** Original URL on source platform / 源平台原始链接 */
    originalUrl: text('original_url'),
    /** Tags for categorization / 分类标签 */
    tags: jsonb('tags').$type<string[]>(),
    // Public pool cache fields (公共缓存池字段)
    /** MD5 cache key for deduplication / MD5缓存键用于去重 */
    cacheKey: varchar('cache_key', { length: 64 }).unique(),
    /** User who contributed this strategy to the pool / 贡献此策略的用户 */
    authorId: text('author_id'),
    /** Average return across all usages / 所有使用次数的平均收益率 */
    avgReturn: decimal('avg_return', { precision: 10, scale: 4 }),
    /** How many times this cached strategy was used / 缓存策略被使用的次数 */
    usageCount: integer('usage_count').default(1).notNull(),

    /** Is featured/recommended / 是否推荐 */
    isFeatured: boolean('is_featured').default(false),
    /** When the strategy was last crawled / 最后爬取时间 */
    crawledAt: timestamp('crawled_at').defaultNow().notNull(),
    /** Last update time / 最后更新时间 */
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('idx_popular_strategies_source').on(table.source),
    sourceIdIdx: uniqueIndex('idx_popular_strategies_source_id').on(table.source, table.sourceId),
    typeIdx: index('idx_popular_strategies_type').on(table.strategyType),
    popularityIdx: index('idx_popular_strategies_popularity').on(table.popularityScore),
    featuredIdx: index('idx_popular_strategies_featured').on(table.isFeatured),
    cacheKeyIdx: index('idx_popular_strategies_cache_key').on(table.cacheKey),
  })
);

// ============================================================================
// User Behavior Event Tracking Table (用户行为事件追踪表)
// ============================================================================

/**
 * User events table - Tracks all user actions for analytics and billing
 * 用户事件表 - 追踪所有用户操作，用于分析和计费
 *
 * eventType values:
 *   strategy_generate | strategy_cache_hit
 *   backtest_run | backtest_sector | backtest_multi
 *   advisor_chat | agent_backtest | agent_scan
 *   page_view | login | logout
 */
export const userEvents = pgTable(
  'user_events',
  {
    id: serial('id').primaryKey(),
    /** User ID (nullable for anonymous) / 用户ID（匿名时为空） */
    userId: text('user_id'),
    /** Anonymous session identifier / 匿名会话标识 */
    sessionId: text('session_id'),
    /** Event type / 事件类型 */
    eventType: varchar('event_type', { length: 50 }).notNull(),
    /** Flexible metadata JSON / 灵活的元数据JSON */
    metadata: jsonb('metadata'),
    /** Token cost for AI operations / AI操作消耗的Token数 */
    tokenCost: integer('token_cost').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_user_events_user').on(table.userId),
    typeIdx: index('idx_user_events_type').on(table.eventType),
    createdIdx: index('idx_user_events_created').on(table.createdAt),
  })
);

/**
 * Strategy crawl log table - Track crawling jobs and their results
 * 策略爬取日志表 - 记录爬取任务及结果
 */
export const strategyCrawlLog = pgTable(
  'strategy_crawl_log',
  {
    id: serial('id').primaryKey(),
    /** Source platform / 来源平台 */
    source: varchar('source', { length: 50 }).notNull(),
    /** Crawl type: daily, full, manual / 爬取类型 */
    crawlType: varchar('crawl_type', { length: 20 }).notNull(),
    /** Start time / 开始时间 */
    startTime: timestamp('start_time').notNull(),
    /** End time / 结束时间 */
    endTime: timestamp('end_time'),
    /** Status: running, success, failed, partial / 状态 */
    status: varchar('status', { length: 20 }).notNull(),
    /** Number of strategies found / 发现的策略数 */
    strategiesFound: integer('strategies_found').default(0).notNull(),
    /** Number of new strategies added / 新增的策略数 */
    strategiesNew: integer('strategies_new').default(0).notNull(),
    /** Number of strategies updated / 更新的策略数 */
    strategiesUpdated: integer('strategies_updated').default(0).notNull(),
    /** Error message if failed / 错误信息 */
    errorMessage: text('error_message'),
    /** Additional details / 其他详情 */
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('idx_strategy_crawl_log_source').on(table.source),
    statusIdx: index('idx_strategy_crawl_log_status').on(table.status),
    startTimeIdx: index('idx_strategy_crawl_log_start_time').on(table.startTime),
  })
);

// ============================================================================
// Workflow System Tables (工作流系统)
// ============================================================================

/**
 * User workflow sessions table - Track multi-step operation sessions
 * 用户工作流会话表 - 跟踪多步骤操作会话
 *
 * Each session represents a complete workflow (e.g., strategy development)
 */
export const userWorkflowSessions = pgTable(
  'user_workflow_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** User ID / 用户ID */
    userId: text('user_id').notNull(),
    /** Workflow type: strategy_dev, backtest_analysis, advisor_chat / 工作流类型 */
    workflowType: varchar('workflow_type', { length: 50 }).notNull(),
    /** Session status: active, completed, expired, cancelled / 会话状态 */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    /** Current step number (0-indexed) / 当前步骤号 */
    currentStep: integer('current_step').default(0).notNull(),
    /** Total steps in workflow / 工作流总步骤数 */
    totalSteps: integer('total_steps').notNull(),
    /** Step data snapshots / 每步的数据快照 */
    stepData: jsonb('step_data'),
    /** Workflow context/metadata / 工作流上下文 */
    context: jsonb('context'),
    /** Session title/label / 会话标题 */
    title: varchar('title', { length: 200 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    /** Expiration time (default 24h) / 过期时间 */
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    userIdx: index('idx_workflow_sessions_user').on(table.userId),
    typeIdx: index('idx_workflow_sessions_type').on(table.workflowType),
    statusIdx: index('idx_workflow_sessions_status').on(table.status),
    expiresIdx: index('idx_workflow_sessions_expires').on(table.expiresAt),
  })
);

/**
 * Workflow step cache table - Cache results for each workflow step
 * 工作流步骤缓存表 - 缓存每个工作流步骤的结果
 *
 * Enables resuming from any step and avoids re-computation
 */
export const workflowStepCache = pgTable(
  'workflow_step_cache',
  {
    id: serial('id').primaryKey(),
    /** Reference to workflow session / 工作流会话引用 */
    sessionId: uuid('session_id')
      .notNull()
      .references(() => userWorkflowSessions.id, { onDelete: 'cascade' }),
    /** Step number in the workflow / 工作流中的步骤号 */
    stepNumber: integer('step_number').notNull(),
    /** Step type: stock_select, strategy_generate, backtest_run, etc. / 步骤类型 */
    stepType: varchar('step_type', { length: 50 }).notNull(),
    /** Input data for this step / 此步骤的输入数据 */
    inputData: jsonb('input_data'),
    /** Output data from this step / 此步骤的输出数据 */
    outputData: jsonb('output_data'),
    /** Cached result (may include computed values) / 缓存的结果 */
    cachedResult: jsonb('cached_result'),
    /** Step status: pending, processing, completed, failed, skipped / 步骤状态 */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    /** Error message if failed / 错误信息 */
    errorMessage: text('error_message'),
    /** When step started processing / 开始处理时间 */
    startedAt: timestamp('started_at'),
    /** When step completed / 完成时间 */
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('idx_workflow_step_cache_session').on(table.sessionId),
    stepIdx: index('idx_workflow_step_cache_step').on(table.sessionId, table.stepNumber),
    statusIdx: index('idx_workflow_step_cache_status').on(table.status),
    uniqueSessionStep: uniqueIndex('unique_workflow_session_step').on(
      table.sessionId,
      table.stepNumber
    ),
  })
);

// ============================================================================
// Strategy Version Management Tables (策略版本管理)
// ============================================================================

/**
 * Strategy versions table - Tracks every code/parameter change
 * 策略版本表 - 跟踪每次代码/参数变更
 *
 * Each save creates a new version record. Provides full audit trail
 * for parameter tuning and code iteration history.
 */
export const strategyVersions = pgTable(
  'strategy_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** User who created this version / 创建此版本的用户 */
    userId: text('user_id').notNull(),
    /** Reference to parent strategy / 父策略引用 */
    strategyHistoryId: integer('strategy_history_id')
      .references(() => strategyHistory.id, { onDelete: 'cascade' }),
    /** Strategy code snapshot / 策略代码快照 */
    code: text('code').notNull(),
    /** Parameters as JSON / 参数JSON */
    params: jsonb('params').notNull(),
    /** Auto-generated or manual description / 变更描述 */
    description: varchar('description', { length: 500 }),
    /** Score snapshot if available / 评分快照 */
    score: jsonb('score'),
    /** Version sequence number / 版本序号 */
    versionNumber: integer('version_number').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_strategy_versions_user').on(table.userId),
    strategyIdx: index('idx_strategy_versions_strategy').on(table.strategyHistoryId),
    createdIdx: index('idx_strategy_versions_created').on(table.createdAt),
  })
);

// ============================================================================
// Custom Agent System Tables (自定义 Agent 系统)
// ============================================================================

/**
 * Custom agents table - User-created agents for batch analysis
 * 自定义 Agent 表 - 用户创建的批量分析 Agent
 */
export const customAgents = pgTable(
  'custom_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owner user ID / 所有者用户ID */
    userId: text('user_id').notNull(),
    /** Agent display name (max 50 chars) / Agent 显示名称 */
    name: text('name').notNull(),
    /** Short description (max 200 chars) / 简短描述 */
    description: text('description'),
    /** Target configuration / 标的配置 */
    targets: jsonb('targets').notNull().$type<{
      mode: 'sector' | 'custom' | 'all';
      sectors?: string[];
      symbols?: string[];
    }>(),
    /** Bound strategies / 绑定策略 */
    strategies: jsonb('strategies').notNull().$type<
      Array<{ templateId: string; params?: Record<string, unknown> }>
    >(),
    /** Analysis depth: light skips AI, standard ~1.5K tokens, deep ~5K tokens */
    analysisDepth: text('analysis_depth').notNull().default('standard'),
    /** Optional backtest configuration override / 回测配置覆盖 */
    backtestConfig: jsonb('backtest_config').$type<{
      initialCapital?: number;
      dateRange?: { start: string; end: string };
      commission?: number;
      slippage?: number;
    }>(),
    /** Display icon name / 显示图标 */
    icon: text('icon').default('bot'),
    /** Display color hex / 显示颜色 */
    color: text('color').default('#6366f1'),
    /** Whether pinned to top / 是否置顶 */
    isPinned: boolean('is_pinned').default(false),
    /** Total run count / 总运行次数 */
    runCount: integer('run_count').default(0),
    /** Last run timestamp / 上次运行时间 */
    lastRunAt: timestamp('last_run_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_custom_agents_user').on(table.userId),
    userPinnedIdx: index('idx_custom_agents_user_pinned').on(table.userId, table.isPinned),
  })
);

/**
 * Custom agent runs table - Execution history for custom agents
 * 自定义 Agent 运行记录表 - 运行历史
 */
export const customAgentRuns = pgTable(
  'custom_agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Reference to custom agent / Agent 引用 */
    agentId: uuid('agent_id')
      .notNull()
      .references(() => customAgents.id, { onDelete: 'cascade' }),
    /** User who triggered the run / 触发运行的用户 */
    userId: text('user_id').notNull(),
    /** Run status / 运行状态 */
    status: text('status').notNull(), // running | completed | failed | cancelled
    /** Frozen config at time of run / 运行时配置快照 */
    configSnapshot: jsonb('config_snapshot'),
    /** Aggregated result summary / 聚合结果摘要 */
    resultSummary: jsonb('result_summary').$type<{
      totalStocks: number;
      analyzed: number;
      topN: number;
      avgReturn: number;
      bestSymbol: string;
    }>(),
    /** Per-stock results / 每只股票的结果 */
    stockResults: jsonb('stock_results').$type<
      Array<{
        symbol: string;
        name: string;
        totalReturn: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        score: number;
      }>
    >(),
    /** AI-generated insights text / AI 生成的综合分析 */
    insights: text('insights'),
    /** Total token cost for this run / 本次运行的总 token 消耗 */
    totalTokenCost: integer('total_token_cost').default(0),
    /** Token cost breakdown by node / 各节点 token 消耗明细 */
    tokenBreakdown: jsonb('token_breakdown').$type<{
      resolveTargets?: number;
      insights?: number;
    }>(),
    /** Execution duration in milliseconds / 执行耗时 */
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_custom_agent_runs_user_created').on(
      table.userId,
      table.createdAt
    ),
    agentCreatedIdx: index('idx_custom_agent_runs_agent_created').on(
      table.agentId,
      table.createdAt
    ),
  })
);

// ============================================================================
// Strategy Marketplace Tables (策略市场)
// ============================================================================

/**
 * Marketplace strategies table - Published strategies available for purchase/subscription
 * 策略市场表 - 用户发布的可购买/订阅策略
 */
export const marketplaceStrategies = pgTable(
  'marketplace_strategies',
  {
    id: serial('id').primaryKey(),
    /** Reference to the strategy version being published */
    strategyHistoryId: integer('strategy_history_id')
      .notNull()
      .references(() => strategyHistory.id),
    /** Publishing author */
    authorUserId: text('author_user_id'),
    /** Display title for the marketplace listing */
    title: varchar('title', { length: 100 }).notNull(),
    /** Detailed description shown on listing page */
    description: text('description'),
    /** Pricing model: free / per_run / subscription */
    priceType: varchar('price_type', { length: 20 }).notNull(),
    /** LB per single run (0 for free/subscription) */
    pricePerRun: real('price_per_run').default(0),
    /** LB per month for subscription pricing */
    priceMonthly: real('price_monthly').default(0),
    /** lurus-identity account ID of the author (captured at publish time for wallet transfers) */
    authorIdentityAccountId: varchar('author_identity_account_id', { length: 32 }),
    /** AI-generated grade score (A/B/C/D from existing scorer) */
    gradeScore: varchar('grade_score', { length: 2 }),
    /** Total times this strategy has been run by other users */
    totalRuns: integer('total_runs').default(0),
    /** Total active subscribers */
    totalSubscribers: integer('total_subscribers').default(0),
    /** LB staked by author to prevent spam listings */
    stakedLb: real('staked_lb').default(10),
    /** Listing status: active / suspended / pending */
    status: varchar('status', { length: 20 }).default('active'),
    publishedAt: timestamp('published_at').defaultNow(),
  },
  (table) => ({
    authorIdx: index('idx_marketplace_author').on(table.authorUserId),
    statusIdx: index('idx_marketplace_status').on(table.status),
    priceTypeIdx: index('idx_marketplace_price_type').on(table.priceType),
  })
);

/**
 * Strategy subscriptions table - Records of marketplace purchases and subscriptions
 * 策略订阅记录表 - 市场购买/订阅记录
 */
export const strategySubscriptions = pgTable(
  'strategy_subscriptions',
  {
    id: serial('id').primaryKey(),
    /**
     * Buyer's lurus-identity account ID (numeric string, e.g. "42").
     * We store the identity account ID rather than the local users.id UUID
     * because Zitadel-authenticated users have no row in the local users table.
     */
    subscriberIdentityAccountId: varchar('subscriber_identity_account_id', { length: 32 }),
    /** The marketplace listing */
    marketplaceStrategyId: integer('marketplace_strategy_id').references(
      () => marketplaceStrategies.id
    ),
    /** Transaction type: per_run / subscription */
    type: varchar('type', { length: 20 }).notNull(),
    /** Total LB paid by subscriber */
    lbPaid: real('lb_paid').notNull(),
    /** Platform fee rate (30%) */
    platformFeeRate: real('platform_fee_rate').default(0.30),
    /** LB transferred to strategy author (70%) */
    authorRevenueLb: real('author_revenue_lb').notNull(),
    /** Subscription period start (null for per_run) */
    periodStart: timestamp('period_start'),
    /** Subscription period end (null for per_run) */
    periodEnd: timestamp('period_end'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    subscriberIdx: index('idx_strategy_subs_subscriber').on(table.subscriberIdentityAccountId),
    strategyIdx: index('idx_strategy_subs_strategy').on(table.marketplaceStrategyId),
    createdIdx: index('idx_strategy_subs_created').on(table.createdAt),
  })
);

// ============================================================================
// Strategy Community Tables (Phase 4 — Social Features)
// ============================================================================

/**
 * Strategy comments table - User comments on marketplace strategies
 * 策略评论表 - 用户对市场策略的评论
 */
export const strategyComments = pgTable(
  'strategy_comments',
  {
    id: serial('id').primaryKey(),
    /** Marketplace strategy being commented on */
    marketplaceStrategyId: integer('marketplace_strategy_id')
      .notNull()
      .references(() => marketplaceStrategies.id, { onDelete: 'cascade' }),
    /** Commenter's user ID (Zitadel sub) */
    userId: text('user_id').notNull(),
    /** Display name at time of comment */
    userName: varchar('user_name', { length: 100 }),
    /** Comment content */
    content: text('content').notNull(),
    /** Parent comment ID for replies (null = top-level) */
    parentId: integer('parent_id'),
    /** Soft delete flag */
    deleted: boolean('deleted').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    strategyIdx: index('idx_strategy_comments_strategy').on(table.marketplaceStrategyId),
    userIdx: index('idx_strategy_comments_user').on(table.userId),
    parentIdx: index('idx_strategy_comments_parent').on(table.parentId),
  })
);

/**
 * Strategy likes table - User likes on marketplace strategies
 * 策略点赞表 - 用户对市场策略的点赞
 */
export const strategyLikes = pgTable(
  'strategy_likes',
  {
    id: serial('id').primaryKey(),
    /** Marketplace strategy being liked */
    marketplaceStrategyId: integer('marketplace_strategy_id')
      .notNull()
      .references(() => marketplaceStrategies.id, { onDelete: 'cascade' }),
    /** User who liked (Zitadel sub) */
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueLike: uniqueIndex('idx_strategy_likes_unique').on(
      table.marketplaceStrategyId,
      table.userId
    ),
    strategyIdx: index('idx_strategy_likes_strategy').on(table.marketplaceStrategyId),
  })
);

// ============================================================================
// Point-in-Time Data Foundation (时间一致性数据底座)
// ============================================================================
// Purpose: enable queries like "what did the world look like on 2023-06-01?"
// without leaking data that was announced later. Required for unbiased
// backtests and survivor-bias-free factor research.

/**
 * Trading calendar - Which days are trading days and their session type
 * 交易日历 - 哪些日子是交易日及交易时段类型
 *
 * Estimated rows: ~250/year. Covers A-share SH+SZ markets.
 * session_type: normal | half_day | closed
 */
export const tradingCalendar = pgTable(
  'trading_calendar',
  {
    date: varchar('date', { length: 10 }).primaryKey(), // "2024-01-15"
    isTrading: boolean('is_trading').notNull(),
    sessionType: varchar('session_type', { length: 20 }).default('normal').notNull(),
    exchange: varchar('exchange', { length: 10 }).default('CN').notNull(), // CN covers SH+SZ together
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tradingIdx: index('idx_trading_calendar_trading').on(table.isTrading, table.date),
  })
);

/**
 * Stock halt calendar - Historical halt/suspension windows per stock
 * 个股停复牌日历 - 每只股票的停牌/复牌历史窗口
 *
 * Estimated rows: ~10k (historical halts across all A-share stocks)
 * Used to mask halt periods in backtests (cannot transact on halted dates).
 */
export const stockHaltCalendar = pgTable(
  'stock_halt_calendar',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 10 }).notNull(),
    haltDate: varchar('halt_date', { length: 10 }).notNull(),
    resumeDate: varchar('resume_date', { length: 10 }), // null if still halted
    reason: varchar('reason', { length: 100 }),
    announceDate: varchar('announce_date', { length: 10 }), // when the halt was publicly announced
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    symbolDateIdx: index('idx_halt_symbol_date').on(table.symbol, table.haltDate),
    dateRangeIdx: index('idx_halt_date_range').on(table.haltDate, table.resumeDate),
  })
);

/**
 * Stock status history - Transition log for ST / suspended / delisted status
 * 股票状态历史 - ST/停牌/退市状态变更记录
 *
 * Enables "was 600xxx ST as of 2022-06-15?" queries for hard-filter stage.
 * Estimated rows: ~30k across all A-share history.
 */
export const stockStatusHistory = pgTable(
  'stock_status_history',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 10 }).notNull(),
    fromDate: varchar('from_date', { length: 10 }).notNull(), // inclusive
    toDate: varchar('to_date', { length: 10 }), // null = still current
    status: varchar('status', { length: 20 }).notNull(), // active | ST | suspended | delisted
    reason: varchar('reason', { length: 200 }),
    announceDate: varchar('announce_date', { length: 10 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    symbolFromIdx: index('idx_status_symbol_from').on(table.symbol, table.fromDate),
    statusIdx: index('idx_status_status_from').on(table.status, table.fromDate),
  })
);

/**
 * Sector component snapshots - Daily snapshot of which stocks belong to which sector
 * 板块成分日快照 - 每日哪些股票属于哪个板块/概念
 *
 * CRITICAL for avoiding lookahead bias: the "新能源" concept in 2020 contained
 * very different stocks than today. Must query by date to reconstruct the
 * historical universe.
 *
 * Estimated rows: ~300k/year (~200 sectors × ~40 stocks avg × 40 snapshot days)
 * Snapshot frequency: weekly (Friday close) to balance storage vs fidelity.
 */
export const sectorComponentSnapshots = pgTable(
  'sector_component_snapshots',
  {
    id: serial('id').primaryKey(),
    asOfDate: varchar('as_of_date', { length: 10 }).notNull(), // snapshot date
    sectorCode: varchar('sector_code', { length: 20 }).notNull(), // e.g. "BK0478"
    symbol: varchar('symbol', { length: 10 }).notNull(),
    weight: real('weight').default(1.0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dateSectorIdx: index('idx_sector_snap_date_sector').on(table.asOfDate, table.sectorCode),
    symbolDateIdx: index('idx_sector_snap_symbol_date').on(table.symbol, table.asOfDate),
    uniqueTriple: uniqueIndex('unique_sector_snap').on(
      table.asOfDate,
      table.sectorCode,
      table.symbol
    ),
  })
);

/**
 * Financial disclosures calendar - Maps report period to actual announcement date
 * 财务披露日历 - 将报告期映射到实际公告日
 *
 * PIT queries MUST filter by announceDate (not reportPeriod) to avoid
 * look-ahead bias. Q1 report for 2024-03-31 is usually announced around 2024-04-28.
 *
 * Estimated rows: ~80k/year (5000 stocks × 4 quarters × ~4 report types).
 * report_type: annual | interim | q1 | q3 | forecast | express
 */
export const financialDisclosures = pgTable(
  'financial_disclosures',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 10 }).notNull(),
    reportPeriod: varchar('report_period', { length: 10 }).notNull(), // e.g. "2024-03-31"
    reportType: varchar('report_type', { length: 20 }).notNull(),
    announceDate: varchar('announce_date', { length: 10 }).notNull(), // public availability date
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    symbolAnnounceIdx: index('idx_disclosure_symbol_announce').on(
      table.symbol,
      table.announceDate
    ),
    announceIdx: index('idx_disclosure_announce').on(table.announceDate),
    uniqueDisclosure: uniqueIndex('unique_disclosure').on(
      table.symbol,
      table.reportPeriod,
      table.reportType
    ),
  })
);

/**
 * Financial facts PIT - Point-in-time fundamental data store
 * 基本面 PIT 事实表 - 时点一致的基本面数据存储
 *
 * Stores (symbol, field, value) with both reportPeriod (economic meaning)
 * and asOfDate (public availability). Query pattern:
 *
 *   SELECT value FROM financial_facts_pit
 *   WHERE symbol = '600519' AND field = 'roe'
 *     AND as_of_date <= '2023-06-01'
 *   ORDER BY as_of_date DESC LIMIT 1;
 *
 * Handles restatements: same (symbol, field, reportPeriod) may have multiple
 * asOfDate entries when data is revised.
 *
 * Estimated rows: ~500k/year (5000 × ~25 fields × 4 periods).
 */
export const financialFactsPit = pgTable(
  'financial_facts_pit',
  {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 10 }).notNull(),
    field: varchar('field', { length: 50 }).notNull(), // e.g. "roe", "pe_ttm", "revenue"
    value: decimal('value', { precision: 20, scale: 6 }),
    reportPeriod: varchar('report_period', { length: 10 }).notNull(),
    asOfDate: varchar('as_of_date', { length: 10 }).notNull(), // when this value became knowable
    source: varchar('source', { length: 30 }), // e.g. "eastmoney", "tushare"
    metadata: jsonb('metadata'), // unit, currency, footnotes
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    lookupIdx: index('idx_pit_facts_lookup').on(table.symbol, table.field, table.asOfDate),
    periodIdx: index('idx_pit_facts_period').on(table.symbol, table.field, table.reportPeriod),
    uniqueVersion: uniqueIndex('unique_pit_facts_version').on(
      table.symbol,
      table.field,
      table.reportPeriod,
      table.asOfDate
    ),
  })
);

// ============================================================================
// Pack / Funnel Run Persistence (Phase 7.1)
// Captures every funnel pipeline execution for alpha-decay / drift / slippage.
// ============================================================================

export const packRuns = pgTable(
  'pack_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: varchar('run_id', { length: 100 }).notNull(),
    userId: text('user_id'),
    packId: varchar('pack_id', { length: 50 }),
    packName: varchar('pack_name', { length: 100 }),
    asOfDate: varchar('as_of_date', { length: 10 }).notNull(),
    universeKind: varchar('universe_kind', { length: 10 }).notNull(), // 'sector' | 'symbols' | 'all'
    universeSectorCode: varchar('universe_sector_code', { length: 20 }),
    universeSymbols: jsonb('universe_symbols'), // string[] when kind='symbols'
    topN: integer('top_n'),
    durationMs: integer('duration_ms').notNull(),
    status: varchar('status', { length: 10 }).notNull(), // 'success' | 'error'
    errorStage: varchar('error_stage', { length: 100 }),
    errorCode: varchar('error_code', { length: 50 }),
    errorMessage: text('error_message'),
    candidateCount: integer('candidate_count').default(0).notNull(),
    topCandidates: jsonb('top_candidates'), // capped list of final picks
    flags: jsonb('flags'),
    options: jsonb('options'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueRunId: uniqueIndex('unique_pack_runs_run_id').on(table.runId),
    userCreatedIdx: index('idx_pack_runs_user_created').on(table.userId, table.createdAt),
    packAsOfIdx: index('idx_pack_runs_pack_asof').on(table.packId, table.asOfDate),
    asOfIdx: index('idx_pack_runs_asof').on(table.asOfDate),
    statusIdx: index('idx_pack_runs_status').on(table.status, table.createdAt),
  })
);

export const packRunStages = pgTable(
  'pack_run_stages',
  {
    id: serial('id').primaryKey(),
    runId: varchar('run_id', { length: 100 }).notNull(),
    stageIndex: integer('stage_index').notNull(),
    stageName: varchar('stage_name', { length: 100 }).notNull(),
    inputSize: integer('input_size').notNull(),
    outputSize: integer('output_size').notNull(),
    keepRatio: real('keep_ratio').notNull(),
    durationMs: integer('duration_ms').notNull(),
    metrics: jsonb('metrics'),
    warnings: jsonb('warnings'), // string[]
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index('idx_pack_run_stages_run').on(table.runId, table.stageIndex),
    nameIdx: index('idx_pack_run_stages_name').on(table.stageName, table.createdAt),
    uniqueStage: uniqueIndex('unique_pack_run_stage').on(table.runId, table.stageIndex),
  })
);

// Alpha-decay tracker — forward-return rollup per (run, horizon, topN).
// Computed on-demand from klineDaily using equal-weight returns.
// FK on run_id → pack_runs(run_id) ON DELETE CASCADE is added in migration
// 0008 (drizzle-kit can't express FK to non-PK unique columns cleanly).
export const packRunPerformance = pgTable(
  'pack_run_performance',
  {
    id: serial('id').primaryKey(),
    runId: varchar('run_id', { length: 100 }).notNull(),
    horizonDays: integer('horizon_days').notNull(),
    topN: integer('top_n').notNull(),
    requestedCount: integer('requested_count').notNull(),
    evaluatedCount: integer('evaluated_count').notNull(),
    missingCount: integer('missing_count').notNull(),
    meanReturn: real('mean_return'),
    medianReturn: real('median_return'),
    hitRate: real('hit_rate'),
    bestReturn: real('best_return'),
    worstReturn: real('worst_return'),
    benchmarkSymbol: varchar('benchmark_symbol', { length: 20 }),
    benchmarkReturn: real('benchmark_return'),
    excessMeanReturn: real('excess_mean_return'),
    computedAt: timestamp('computed_at').defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index('idx_pack_run_perf_run').on(table.runId),
    uniqueTriple: uniqueIndex('unique_pack_run_perf_triple').on(
      table.runId,
      table.horizonDays,
      table.topN,
    ),
  }),
);

// ============================================================================
// Type Exports
// ============================================================================

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;

export type Sector = typeof sectors.$inferSelect;
export type NewSector = typeof sectors.$inferInsert;

export type StockSectorMapping = typeof stockSectorMapping.$inferSelect;
export type NewStockSectorMapping = typeof stockSectorMapping.$inferInsert;

export type KLineDaily = typeof klineDaily.$inferSelect;
export type NewKLineDaily = typeof klineDaily.$inferInsert;

export type DataUpdateLog = typeof dataUpdateLog.$inferSelect;
export type NewDataUpdateLog = typeof dataUpdateLog.$inferInsert;

export type ValidationCache = typeof validationCache.$inferSelect;
export type NewValidationCache = typeof validationCache.$inferInsert;

export type ValidationPreset = typeof validationPresets.$inferSelect;
export type NewValidationPreset = typeof validationPresets.$inferInsert;

// User authentication types (Zitadel is SSOT — no local users table)
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;

export type UserDraft = typeof userDrafts.$inferSelect;
export type NewUserDraft = typeof userDrafts.$inferInsert;

// Multi-tenant history types
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;

export type StrategyHistory = typeof strategyHistory.$inferSelect;
export type NewStrategyHistory = typeof strategyHistory.$inferInsert;

export type BacktestHistory = typeof backtestHistory.$inferSelect;
export type NewBacktestHistory = typeof backtestHistory.$inferInsert;

export type TradingHistory = typeof tradingHistory.$inferSelect;
export type NewTradingHistory = typeof tradingHistory.$inferInsert;

// Popular strategy system types
export type PopularStrategy = typeof popularStrategies.$inferSelect;
export type NewPopularStrategy = typeof popularStrategies.$inferInsert;

export type StrategyCrawlLog = typeof strategyCrawlLog.$inferSelect;
export type NewStrategyCrawlLog = typeof strategyCrawlLog.$inferInsert;

// Workflow system types
export type UserWorkflowSession = typeof userWorkflowSessions.$inferSelect;
export type NewUserWorkflowSession = typeof userWorkflowSessions.$inferInsert;

export type WorkflowStepCache = typeof workflowStepCache.$inferSelect;
export type NewWorkflowStepCache = typeof workflowStepCache.$inferInsert;

// Strategy version types
export type StrategyVersion = typeof strategyVersions.$inferSelect;
export type NewStrategyVersion = typeof strategyVersions.$inferInsert;

// User event types
export type UserEvent = typeof userEvents.$inferSelect;
export type NewUserEvent = typeof userEvents.$inferInsert;

// Custom agent types
export type CustomAgent = typeof customAgents.$inferSelect;
export type NewCustomAgent = typeof customAgents.$inferInsert;

export type CustomAgentRun = typeof customAgentRuns.$inferSelect;
export type NewCustomAgentRun = typeof customAgentRuns.$inferInsert;

// Marketplace types
export type MarketplaceStrategy = typeof marketplaceStrategies.$inferSelect;
export type NewMarketplaceStrategy = typeof marketplaceStrategies.$inferInsert;

export type StrategySubscription = typeof strategySubscriptions.$inferSelect;
export type NewStrategySubscription = typeof strategySubscriptions.$inferInsert;

// Community types
export type StrategyComment = typeof strategyComments.$inferSelect;
export type NewStrategyComment = typeof strategyComments.$inferInsert;

export type StrategyLike = typeof strategyLikes.$inferSelect;
export type NewStrategyLike = typeof strategyLikes.$inferInsert;

// Collaboration types
export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type NewTenantInvitation = typeof tenantInvitations.$inferInsert;

export type TeamActivity = typeof teamActivity.$inferSelect;
export type NewTeamActivity = typeof teamActivity.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type StrategyAnnotation = typeof strategyAnnotations.$inferSelect;
export type NewStrategyAnnotation = typeof strategyAnnotations.$inferInsert;

export type StrategyReview = typeof strategyReviews.$inferSelect;
export type NewStrategyReview = typeof strategyReviews.$inferInsert;

export type ReviewComment = typeof reviewComments.$inferSelect;
export type NewReviewComment = typeof reviewComments.$inferInsert;

export type SharedPortfolio = typeof sharedPortfolios.$inferSelect;
export type NewSharedPortfolio = typeof sharedPortfolios.$inferInsert;

export type TeamLeaderboardSnapshot = typeof teamLeaderboardSnapshots.$inferSelect;
export type NewTeamLeaderboardSnapshot = typeof teamLeaderboardSnapshots.$inferInsert;

// Point-in-Time data foundation types
export type TradingCalendar = typeof tradingCalendar.$inferSelect;
export type NewTradingCalendar = typeof tradingCalendar.$inferInsert;

export type StockHaltCalendar = typeof stockHaltCalendar.$inferSelect;
export type NewStockHaltCalendar = typeof stockHaltCalendar.$inferInsert;

export type StockStatusHistory = typeof stockStatusHistory.$inferSelect;
export type NewStockStatusHistory = typeof stockStatusHistory.$inferInsert;

export type SectorComponentSnapshot = typeof sectorComponentSnapshots.$inferSelect;
export type NewSectorComponentSnapshot = typeof sectorComponentSnapshots.$inferInsert;

export type FinancialDisclosure = typeof financialDisclosures.$inferSelect;
export type NewFinancialDisclosure = typeof financialDisclosures.$inferInsert;

export type FinancialFactPit = typeof financialFactsPit.$inferSelect;
export type NewFinancialFactPit = typeof financialFactsPit.$inferInsert;

// Pack / Funnel run persistence types
export type PackRun = typeof packRuns.$inferSelect;
export type NewPackRun = typeof packRuns.$inferInsert;

export type PackRunStage = typeof packRunStages.$inferSelect;
export type NewPackRunStage = typeof packRunStages.$inferInsert;

export type PackRunPerformance = typeof packRunPerformance.$inferSelect;
export type NewPackRunPerformance = typeof packRunPerformance.$inferInsert;
