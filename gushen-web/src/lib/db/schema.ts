/**
 * Database Schema Definitions
 * 数据库Schema定义
 *
 * PostgreSQL database schema for GuShen trading platform
 * GuShen交易平台的PostgreSQL数据库模式
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
 * Users table - Core user authentication and profile
 * 用户表 - 核心用户认证和档案
 *
 * This table stores user accounts for authentication and user data isolation
 * 此表存储用户账户，用于认证和用户数据隔离
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    name: varchar('name', { length: 100 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).default('free').notNull(), // free, standard, premium
    avatar: text('avatar'),
    emailVerified: boolean('email_verified').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    roleIdx: index('idx_users_role').on(table.role),
  })
);

/**
 * User preferences table - User-specific settings and preferences
 * 用户偏好表 - 用户特定的设置和偏好
 */
export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Member role: owner, admin, member, viewer / 成员角色 */
    role: varchar('role', { length: 20 }).default('member').notNull(),
    /** Invitation status: pending, accepted, rejected / 邀请状态 */
    status: varchar('status', { length: 20 }).default('accepted').notNull(),
    /** Invited by user ID / 邀请人用户ID */
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_tenant_members_tenant').on(table.tenantId),
    userIdx: index('idx_tenant_members_user').on(table.userId),
    uniqueMember: index('idx_tenant_members_unique').on(table.tenantId, table.userId),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
 * Backtest history table - Cached backtest results
 * 回测历史表 - 缓存的回测结果
 */
export const backtestHistory = pgTable(
  'backtest_history',
  {
    id: serial('id').primaryKey(),
    /** User who ran the backtest / 运行回测的用户 */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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

// User authentication types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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
