import { pgTable, index, serial, varchar, timestamp, integer, text, boolean, real, foreignKey, uniqueIndex, uuid, jsonb, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const dataUpdateLog = pgTable("data_update_log", {
	id: serial().notNull(),
	updateDate: varchar("update_date", { length: 10 }).notNull(),
	updateType: varchar("update_type", { length: 20 }).notNull(),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }),
	status: varchar({ length: 20 }).notNull(),
	recordsUpdated: integer("records_updated").default(0).notNull(),
	recordsFailed: integer("records_failed").default(0).notNull(),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_log_date").using("btree", table.updateDate.asc().nullsLast().op("text_ops")),
	index("idx_log_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_log_type").using("btree", table.updateType.asc().nullsLast().op("text_ops")),
]);

export const stocks = pgTable("stocks", {
	id: serial().notNull(),
	symbol: varchar({ length: 10 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	listingDate: varchar("listing_date", { length: 10 }),
	isSt: boolean("is_st").default(false).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	marketCap: real("market_cap"),
	exchange: varchar({ length: 10 }),
	industry: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_stocks_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_stocks_st").using("btree", table.isSt.asc().nullsLast().op("bool_ops")),
	index("idx_stocks_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_stocks_symbol").using("btree", table.symbol.asc().nullsLast().op("text_ops")),
]);

export const tenantMembers = pgTable("tenant_members", {
	id: serial().notNull(),
	tenantId: integer("tenant_id").notNull(),
	userId: text("user_id").notNull(),
	role: varchar({ length: 20 }).default('member').notNull(),
	status: varchar({ length: 20 }).default('accepted').notNull(),
	invitedBy: text("invited_by"),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tenant_members_tenant").using("btree", table.tenantId.asc().nullsLast().op("int4_ops")),
	index("idx_tenant_members_unique").using("btree", table.tenantId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	index("idx_tenant_members_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_members_tenant_id_tenants_id_fk"
		}).onDelete("cascade"),
]);

export const strategyHistory = pgTable("strategy_history", {
	id: serial().notNull(),
	userId: text("user_id").notNull(),
	tenantId: integer("tenant_id"),
	strategyName: varchar("strategy_name", { length: 100 }).notNull(),
	description: text(),
	strategyCode: text("strategy_code").notNull(),
	parameters: text().notNull(),
	strategyType: varchar("strategy_type", { length: 20 }).default('ai_generated').notNull(),
	version: integer().default(1).notNull(),
	parentVersionId: integer("parent_version_id"),
	tags: text(),
	isActive: boolean("is_active").default(true).notNull(),
	isStarred: boolean("is_starred").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_strategy_history_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_strategy_history_name").using("btree", table.strategyName.asc().nullsLast().op("text_ops")),
	index("idx_strategy_history_tenant").using("btree", table.tenantId.asc().nullsLast().op("int4_ops")),
	index("idx_strategy_history_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "strategy_history_tenant_id_tenants_id_fk"
		}).onDelete("set null"),
]);

export const stockSectorMapping = pgTable("stock_sector_mapping", {
	id: serial().notNull(),
	stockId: integer("stock_id").notNull(),
	sectorId: integer("sector_id").notNull(),
	weight: real().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_mapping_sector").using("btree", table.sectorId.asc().nullsLast().op("int4_ops")),
	index("idx_mapping_stock").using("btree", table.stockId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("unique_stock_sector").using("btree", table.stockId.asc().nullsLast().op("int4_ops"), table.sectorId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stockId],
			foreignColumns: [stocks.id],
			name: "stock_sector_mapping_stock_id_stocks_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sectorId],
			foreignColumns: [sectors.id],
			name: "stock_sector_mapping_sector_id_sectors_id_fk"
		}).onDelete("cascade"),
]);

export const sectors = pgTable("sectors", {
	id: serial().notNull(),
	code: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	nameEn: varchar("name_en", { length: 100 }),
	level: integer().default(1).notNull(),
	parentId: integer("parent_id"),
	stockCount: integer("stock_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sectors_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_sectors_parent").using("btree", table.parentId.asc().nullsLast().op("int4_ops")),
]);

export const backtestHistory = pgTable("backtest_history", {
	id: serial().notNull(),
	userId: text("user_id").notNull(),
	tenantId: integer("tenant_id"),
	strategyHistoryId: integer("strategy_history_id"),
	symbol: varchar({ length: 20 }).notNull(),
	stockName: varchar("stock_name", { length: 50 }),
	startDate: varchar("start_date", { length: 10 }).notNull(),
	endDate: varchar("end_date", { length: 10 }).notNull(),
	timeframe: varchar({ length: 10 }).default('1d').notNull(),
	config: text().notNull(),
	result: text().notNull(),
	dataSource: varchar("data_source", { length: 30 }).notNull(),
	dataCoverage: real("data_coverage"),
	totalReturn: real("total_return"),
	sharpeRatio: real("sharpe_ratio"),
	maxDrawdown: real("max_drawdown"),
	winRate: real("win_rate"),
	executionTime: integer("execution_time"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_backtest_history_date").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_backtest_history_strategy").using("btree", table.strategyHistoryId.asc().nullsLast().op("int4_ops")),
	index("idx_backtest_history_symbol").using("btree", table.symbol.asc().nullsLast().op("text_ops")),
	index("idx_backtest_history_tenant").using("btree", table.tenantId.asc().nullsLast().op("int4_ops")),
	index("idx_backtest_history_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "backtest_history_tenant_id_tenants_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.strategyHistoryId],
			foreignColumns: [strategyHistory.id],
			name: "backtest_history_strategy_history_id_strategy_history_id_fk"
		}).onDelete("set null"),
]);

export const tenants = pgTable("tenants", {
	id: serial().notNull(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 50 }).notNull(),
	ownerId: text("owner_id").notNull(),
	plan: varchar({ length: 20 }).default('free').notNull(),
	maxMembers: integer("max_members").default(5).notNull(),
	settings: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tenants_owner").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
	index("idx_tenants_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const tradingHistory = pgTable("trading_history", {
	id: serial().notNull(),
	userId: text("user_id").notNull(),
	tenantId: integer("tenant_id"),
	strategyHistoryId: integer("strategy_history_id"),
	symbol: varchar({ length: 20 }).notNull(),
	stockName: varchar("stock_name", { length: 50 }),
	side: varchar({ length: 10 }).notNull(),
	orderType: varchar("order_type", { length: 20 }).default('market').notNull(),
	price: real().notNull(),
	size: integer().notNull(),
	amount: real().notNull(),
	commission: real(),
	status: varchar({ length: 20 }).default('filled').notNull(),
	realizedPnl: real("realized_pnl"),
	isPaperTrade: boolean("is_paper_trade").default(true).notNull(),
	broker: varchar({ length: 30 }).default('mock').notNull(),
	externalOrderId: varchar("external_order_id", { length: 100 }),
	notes: text(),
	executedAt: timestamp("executed_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_trading_history_date").using("btree", table.executedAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_trading_history_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_trading_history_symbol").using("btree", table.symbol.asc().nullsLast().op("text_ops")),
	index("idx_trading_history_tenant").using("btree", table.tenantId.asc().nullsLast().op("int4_ops")),
	index("idx_trading_history_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "trading_history_tenant_id_tenants_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.strategyHistoryId],
			foreignColumns: [strategyHistory.id],
			name: "trading_history_strategy_history_id_strategy_history_id_fk"
		}).onDelete("set null"),
]);

export const userDrafts = pgTable("user_drafts", {
	id: uuid().defaultRandom().notNull(),
	userId: text("user_id").notNull(),
	draftType: varchar("draft_type", { length: 50 }).notNull(),
	content: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_drafts_type").using("btree", table.draftType.asc().nullsLast().op("text_ops")),
	index("idx_user_drafts_user_created").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
]);

export const userPreferences = pgTable("user_preferences", {
	userId: text("user_id").notNull(),
	theme: varchar({ length: 20 }).default('dark'),
	defaultTimeframe: varchar("default_timeframe", { length: 10 }).default('1d'),
	defaultCapital: numeric("default_capital", { precision: 15, scale:  2 }).default('100000'),
	autoSaveEnabled: boolean("auto_save_enabled").default(true).notNull(),
	notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
	preferences: jsonb(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const validationCache = pgTable("validation_cache", {
	id: serial().notNull(),
	cacheKey: varchar("cache_key", { length: 64 }).notNull(),
	config: text().notNull(),
	result: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	hitCount: integer("hit_count").default(0).notNull(),
}, (table) => [
	index("idx_cache_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_cache_key").using("btree", table.cacheKey.asc().nullsLast().op("text_ops")),
]);

export const strategyComments = pgTable("strategy_comments", {
	id: serial().notNull(),
	marketplaceStrategyId: integer("marketplace_strategy_id").notNull(),
	userId: text("user_id").notNull(),
	userName: varchar("user_name", { length: 100 }),
	content: text().notNull(),
	parentId: integer("parent_id"),
	deleted: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_strategy_comments_parent").using("btree", table.parentId.asc().nullsLast().op("int4_ops")),
	index("idx_strategy_comments_strategy").using("btree", table.marketplaceStrategyId.asc().nullsLast().op("int4_ops")),
	index("idx_strategy_comments_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.marketplaceStrategyId],
			foreignColumns: [marketplaceStrategies.id],
			name: "strategy_comments_marketplace_strategy_id_marketplace_strategie"
		}).onDelete("cascade"),
]);

export const strategyVersions = pgTable("strategy_versions", {
	id: uuid().defaultRandom().notNull(),
	userId: text("user_id").notNull(),
	strategyHistoryId: integer("strategy_history_id"),
	code: text().notNull(),
	params: jsonb().notNull(),
	description: varchar({ length: 500 }),
	score: jsonb(),
	versionNumber: integer("version_number").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_strategy_versions_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_strategy_versions_strategy").using("btree", table.strategyHistoryId.asc().nullsLast().op("int4_ops")),
	index("idx_strategy_versions_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.strategyHistoryId],
			foreignColumns: [strategyHistory.id],
			name: "strategy_versions_strategy_history_id_strategy_history_id_fk"
		}).onDelete("cascade"),
]);

export const tradingCalendar = pgTable("trading_calendar", {
	date: varchar({ length: 10 }).notNull(),
	isTrading: boolean("is_trading").notNull(),
	sessionType: varchar("session_type", { length: 20 }).default('normal').notNull(),
	exchange: varchar({ length: 10 }).default('CN').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_trading_calendar_trading").using("btree", table.isTrading.asc().nullsLast().op("text_ops"), table.date.asc().nullsLast().op("text_ops")),
]);

export const marketplaceStrategies = pgTable("marketplace_strategies", {
	id: serial().notNull(),
	strategyHistoryId: integer("strategy_history_id").notNull(),
	authorUserId: text("author_user_id"),
	title: varchar({ length: 100 }).notNull(),
	description: text(),
	priceType: varchar("price_type", { length: 20 }).notNull(),
	pricePerRun: real("price_per_run").default(0),
	priceMonthly: real("price_monthly").default(0),
	authorIdentityAccountId: varchar("author_identity_account_id", { length: 32 }),
	gradeScore: varchar("grade_score", { length: 2 }),
	totalRuns: integer("total_runs").default(0),
	totalSubscribers: integer("total_subscribers").default(0),
	stakedLb: real("staked_lb").default(10),
	status: varchar({ length: 20 }).default('active'),
	publishedAt: timestamp("published_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_marketplace_author").using("btree", table.authorUserId.asc().nullsLast().op("text_ops")),
	index("idx_marketplace_price_type").using("btree", table.priceType.asc().nullsLast().op("text_ops")),
	index("idx_marketplace_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.strategyHistoryId],
			foreignColumns: [strategyHistory.id],
			name: "marketplace_strategies_strategy_history_id_strategy_history_id_"
		}),
]);

export const validationPresets = pgTable("validation_presets", {
	id: serial().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	symbols: text().notNull(),
	config: text(),
	isFavorite: boolean("is_favorite").default(false).notNull(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	useCount: integer("use_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_presets_favorite").using("btree", table.isFavorite.asc().nullsLast().op("bool_ops")),
	index("idx_presets_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const klineDaily = pgTable("kline_daily", {
	id: serial().notNull(),
	stockId: integer("stock_id").notNull(),
	date: varchar({ length: 10 }).notNull(),
	open: real().notNull(),
	high: real().notNull(),
	low: real().notNull(),
	close: real().notNull(),
	volume: real().notNull(),
	amount: real(),
	adjFactor: real("adj_factor").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_kline_date").using("btree", table.date.asc().nullsLast().op("text_ops")),
	index("idx_kline_stock_date").using("btree", table.stockId.asc().nullsLast().op("int4_ops"), table.date.asc().nullsLast().op("int4_ops")),
	index("idx_kline_stock_id").using("btree", table.stockId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("unique_stock_date").using("btree", table.stockId.asc().nullsLast().op("int4_ops"), table.date.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.stockId],
			foreignColumns: [stocks.id],
			name: "kline_daily_stock_id_stocks_id_fk"
		}).onDelete("cascade"),
]);

export const stockHaltCalendar = pgTable("stock_halt_calendar", {
	id: serial().notNull(),
	symbol: varchar({ length: 10 }).notNull(),
	haltDate: varchar("halt_date", { length: 10 }).notNull(),
	resumeDate: varchar("resume_date", { length: 10 }),
	reason: varchar({ length: 100 }),
	announceDate: varchar("announce_date", { length: 10 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_halt_date_range").using("btree", table.haltDate.asc().nullsLast().op("text_ops"), table.resumeDate.asc().nullsLast().op("text_ops")),
	index("idx_halt_symbol_date").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.haltDate.asc().nullsLast().op("text_ops")),
]);

export const stockStatusHistory = pgTable("stock_status_history", {
	id: serial().notNull(),
	symbol: varchar({ length: 10 }).notNull(),
	fromDate: varchar("from_date", { length: 10 }).notNull(),
	toDate: varchar("to_date", { length: 10 }),
	status: varchar({ length: 20 }).notNull(),
	reason: varchar({ length: 200 }),
	announceDate: varchar("announce_date", { length: 10 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_status_status_from").using("btree", table.status.asc().nullsLast().op("text_ops"), table.fromDate.asc().nullsLast().op("text_ops")),
	index("idx_status_symbol_from").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.fromDate.asc().nullsLast().op("text_ops")),
]);

export const sectorComponentSnapshots = pgTable("sector_component_snapshots", {
	id: serial().notNull(),
	asOfDate: varchar("as_of_date", { length: 10 }).notNull(),
	sectorCode: varchar("sector_code", { length: 20 }).notNull(),
	symbol: varchar({ length: 10 }).notNull(),
	weight: real().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sector_snap_date_sector").using("btree", table.asOfDate.asc().nullsLast().op("text_ops"), table.sectorCode.asc().nullsLast().op("text_ops")),
	index("idx_sector_snap_symbol_date").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.asOfDate.asc().nullsLast().op("text_ops")),
	uniqueIndex("unique_sector_snap").using("btree", table.asOfDate.asc().nullsLast().op("text_ops"), table.sectorCode.asc().nullsLast().op("text_ops"), table.symbol.asc().nullsLast().op("text_ops")),
]);

export const financialDisclosures = pgTable("financial_disclosures", {
	id: serial().notNull(),
	symbol: varchar({ length: 10 }).notNull(),
	reportPeriod: varchar("report_period", { length: 10 }).notNull(),
	reportType: varchar("report_type", { length: 20 }).notNull(),
	announceDate: varchar("announce_date", { length: 10 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_disclosure_announce").using("btree", table.announceDate.asc().nullsLast().op("text_ops")),
	index("idx_disclosure_symbol_announce").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.announceDate.asc().nullsLast().op("text_ops")),
	uniqueIndex("unique_disclosure").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.reportPeriod.asc().nullsLast().op("text_ops"), table.reportType.asc().nullsLast().op("text_ops")),
]);

export const financialFactsPit = pgTable("financial_facts_pit", {
	id: serial().notNull(),
	symbol: varchar({ length: 10 }).notNull(),
	field: varchar({ length: 50 }).notNull(),
	value: numeric({ precision: 20, scale:  6 }),
	reportPeriod: varchar("report_period", { length: 10 }).notNull(),
	asOfDate: varchar("as_of_date", { length: 10 }).notNull(),
	source: varchar({ length: 30 }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pit_facts_lookup").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.field.asc().nullsLast().op("text_ops"), table.asOfDate.asc().nullsLast().op("text_ops")),
	index("idx_pit_facts_period").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.field.asc().nullsLast().op("text_ops"), table.reportPeriod.asc().nullsLast().op("text_ops")),
	uniqueIndex("unique_pit_facts_version").using("btree", table.symbol.asc().nullsLast().op("text_ops"), table.field.asc().nullsLast().op("text_ops"), table.reportPeriod.asc().nullsLast().op("text_ops"), table.asOfDate.asc().nullsLast().op("text_ops")),
]);

export const strategyCrawlLog = pgTable("strategy_crawl_log", {
	id: serial().notNull(),
	source: varchar({ length: 50 }).notNull(),
	crawlType: varchar("crawl_type", { length: 20 }).notNull(),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }),
	status: varchar({ length: 20 }).notNull(),
	strategiesFound: integer("strategies_found").default(0).notNull(),
	strategiesNew: integer("strategies_new").default(0).notNull(),
	strategiesUpdated: integer("strategies_updated").default(0).notNull(),
	errorMessage: text("error_message"),
	details: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_strategy_crawl_log_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("idx_strategy_crawl_log_start_time").using("btree", table.startTime.asc().nullsLast().op("timestamp_ops")),
	index("idx_strategy_crawl_log_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const workflowStepCache = pgTable("workflow_step_cache", {
	id: serial().notNull(),
	sessionId: uuid("session_id").notNull(),
	stepNumber: integer("step_number").notNull(),
	stepType: varchar("step_type", { length: 50 }).notNull(),
	inputData: jsonb("input_data"),
	outputData: jsonb("output_data"),
	cachedResult: jsonb("cached_result"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	errorMessage: text("error_message"),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_workflow_step_cache_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_workflow_step_cache_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_workflow_step_cache_step").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops"), table.stepNumber.asc().nullsLast().op("int4_ops")),
	uniqueIndex("unique_workflow_session_step").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops"), table.stepNumber.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [userWorkflowSessions.id],
			name: "workflow_step_cache_session_id_user_workflow_sessions_id_fk"
		}).onDelete("cascade"),
]);

export const userEvents = pgTable("user_events", {
	id: serial().notNull(),
	userId: text("user_id"),
	sessionId: text("session_id"),
	eventType: varchar("event_type", { length: 50 }).notNull(),
	metadata: jsonb(),
	tokenCost: integer("token_cost").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_events_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_user_events_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_user_events_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const customAgents = pgTable("custom_agents", {
	id: uuid().defaultRandom().notNull(),
	userId: text("user_id").notNull(),
	name: text().notNull(),
	description: text(),
	targets: jsonb().notNull(),
	strategies: jsonb().notNull(),
	analysisDepth: text("analysis_depth").default('standard').notNull(),
	backtestConfig: jsonb("backtest_config"),
	icon: text().default('bot'),
	color: text().default('#6366f1'),
	isPinned: boolean("is_pinned").default(false),
	runCount: integer("run_count").default(0),
	lastRunAt: timestamp("last_run_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_custom_agents_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_custom_agents_user_pinned").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.isPinned.asc().nullsLast().op("text_ops")),
]);

export const customAgentRuns = pgTable("custom_agent_runs", {
	id: uuid().defaultRandom().notNull(),
	agentId: uuid("agent_id").notNull(),
	userId: text("user_id").notNull(),
	status: text().notNull(),
	configSnapshot: jsonb("config_snapshot"),
	resultSummary: jsonb("result_summary"),
	stockResults: jsonb("stock_results"),
	insights: text(),
	totalTokenCost: integer("total_token_cost").default(0),
	tokenBreakdown: jsonb("token_breakdown"),
	durationMs: integer("duration_ms"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_custom_agent_runs_agent_created").using("btree", table.agentId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("idx_custom_agent_runs_user_created").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [customAgents.id],
			name: "custom_agent_runs_agent_id_custom_agents_id_fk"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: serial().notNull(),
	userId: text("user_id").notNull(),
	tenantId: integer("tenant_id"),
	type: varchar({ length: 30 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	body: text(),
	metadata: jsonb(),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notifications_user_read").using("btree", table.userId.asc().nullsLast().op("bool_ops"), table.isRead.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "notifications_tenant_id_tenants_id_fk"
		}).onDelete("set null"),
]);

export const popularStrategies = pgTable("popular_strategies", {
	id: serial().notNull(),
	source: varchar({ length: 50 }).notNull(),
	sourceId: varchar("source_id", { length: 100 }).notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	author: varchar({ length: 100 }),
	strategyType: varchar("strategy_type", { length: 50 }),
	markets: jsonb(),
	indicators: jsonb(),
	annualReturn: numeric("annual_return", { precision: 10, scale:  4 }),
	maxDrawdown: numeric("max_drawdown", { precision: 10, scale:  4 }),
	sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale:  4 }),
	views: integer().default(0).notNull(),
	likes: integer().default(0).notNull(),
	popularityScore: numeric("popularity_score", { precision: 10, scale:  2 }),
	originalCode: text("original_code"),
	veighnaCode: text("veighna_code"),
	conversionStatus: varchar("conversion_status", { length: 20 }).default('pending'),
	conversionError: text("conversion_error"),
	originalUrl: text("original_url"),
	tags: jsonb(),
	isFeatured: boolean("is_featured").default(false),
	crawledAt: timestamp("crawled_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	cacheKey: varchar("cache_key", { length: 64 }),
	authorId: text("author_id"),
	avgReturn: numeric("avg_return", { precision: 10, scale:  4 }),
	usageCount: integer("usage_count").default(1).notNull(),
}, (table) => [
	index("idx_popular_strategies_cache_key").using("btree", table.cacheKey.asc().nullsLast().op("text_ops")),
	index("idx_popular_strategies_featured").using("btree", table.isFeatured.asc().nullsLast().op("bool_ops")),
	index("idx_popular_strategies_popularity").using("btree", table.popularityScore.asc().nullsLast().op("numeric_ops")),
	index("idx_popular_strategies_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_popular_strategies_source_id").using("btree", table.source.asc().nullsLast().op("text_ops"), table.sourceId.asc().nullsLast().op("text_ops")),
	index("idx_popular_strategies_type").using("btree", table.strategyType.asc().nullsLast().op("text_ops")),
]);

export const strategyLikes = pgTable("strategy_likes", {
	id: serial().notNull(),
	marketplaceStrategyId: integer("marketplace_strategy_id").notNull(),
	userId: text("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_strategy_likes_strategy").using("btree", table.marketplaceStrategyId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("idx_strategy_likes_unique").using("btree", table.marketplaceStrategyId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.marketplaceStrategyId],
			foreignColumns: [marketplaceStrategies.id],
			name: "strategy_likes_marketplace_strategy_id_marketplace_strategies_i"
		}).onDelete("cascade"),
]);

export const teamActivity = pgTable("team_activity", {
	id: serial().notNull(),
	tenantId: integer("tenant_id").notNull(),
	userId: text("user_id").notNull(),
	actorName: varchar("actor_name", { length: 100 }).notNull(),
	actionType: varchar("action_type", { length: 50 }).notNull(),
	resourceType: varchar("resource_type", { length: 30 }).notNull(),
	resourceId: varchar("resource_id", { length: 100 }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_team_activity_tenant_created").using("btree", table.tenantId.asc().nullsLast().op("int4_ops"), table.createdAt.asc().nullsLast().op("int4_ops")),
	index("idx_team_activity_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "team_activity_tenant_id_tenants_id_fk"
		}).onDelete("cascade"),
]);

export const strategySubscriptions = pgTable("strategy_subscriptions", {
	id: serial().notNull(),
	subscriberIdentityAccountId: varchar("subscriber_identity_account_id", { length: 32 }),
	marketplaceStrategyId: integer("marketplace_strategy_id"),
	type: varchar({ length: 20 }).notNull(),
	lbPaid: real("lb_paid").notNull(),
	platformFeeRate: real("platform_fee_rate").default(0.3),
	authorRevenueLb: real("author_revenue_lb").notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }),
	periodEnd: timestamp("period_end", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_strategy_subs_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_strategy_subs_strategy").using("btree", table.marketplaceStrategyId.asc().nullsLast().op("int4_ops")),
	index("idx_strategy_subs_subscriber").using("btree", table.subscriberIdentityAccountId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.marketplaceStrategyId],
			foreignColumns: [marketplaceStrategies.id],
			name: "strategy_subscriptions_marketplace_strategy_id_marketplace_stra"
		}),
]);

export const tenantInvitations = pgTable("tenant_invitations", {
	id: serial().notNull(),
	tenantId: integer("tenant_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 20 }).default('member').notNull(),
	token: varchar({ length: 64 }).notNull(),
	invitedBy: uuid("invited_by").notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tenant_invitations_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_tenant_invitations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_tenant_invitations_tenant").using("btree", table.tenantId.asc().nullsLast().op("int4_ops")),
	index("idx_tenant_invitations_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_invitations_tenant_id_tenants_id_fk"
		}).onDelete("cascade"),
]);

export const userWorkflowSessions = pgTable("user_workflow_sessions", {
	id: uuid().defaultRandom().notNull(),
	userId: text("user_id").notNull(),
	workflowType: varchar("workflow_type", { length: 50 }).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	currentStep: integer("current_step").default(0).notNull(),
	totalSteps: integer("total_steps").notNull(),
	stepData: jsonb("step_data"),
	context: jsonb(),
	title: varchar({ length: 200 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("idx_workflow_sessions_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_workflow_sessions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_workflow_sessions_type").using("btree", table.workflowType.asc().nullsLast().op("text_ops")),
	index("idx_workflow_sessions_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const packRuns = pgTable("pack_runs", {
	id: uuid().defaultRandom().notNull(),
	runId: varchar("run_id", { length: 100 }).notNull(),
	userId: text("user_id"),
	packId: varchar("pack_id", { length: 50 }),
	packName: varchar("pack_name", { length: 100 }),
	asOfDate: varchar("as_of_date", { length: 10 }).notNull(),
	universeKind: varchar("universe_kind", { length: 10 }).notNull(),
	universeSectorCode: varchar("universe_sector_code", { length: 20 }),
	universeSymbols: jsonb("universe_symbols"),
	topN: integer("top_n"),
	durationMs: integer("duration_ms").notNull(),
	status: varchar({ length: 10 }).notNull(),
	errorStage: varchar("error_stage", { length: 100 }),
	errorCode: varchar("error_code", { length: 50 }),
	errorMessage: text("error_message"),
	candidateCount: integer("candidate_count").default(0).notNull(),
	topCandidates: jsonb("top_candidates"),
	flags: jsonb(),
	options: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pack_runs_asof").using("btree", table.asOfDate.desc().nullsFirst().op("text_ops")),
	index("idx_pack_runs_pack_asof").using("btree", table.packId.asc().nullsLast().op("text_ops"), table.asOfDate.asc().nullsLast().op("text_ops")),
	index("idx_pack_runs_status").using("btree", table.status.asc().nullsLast().op("timestamp_ops"), table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_pack_runs_user_created").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
]);

export const packRunPerformance = pgTable("pack_run_performance", {
	id: serial().notNull(),
	runId: varchar("run_id", { length: 100 }).notNull(),
	horizonDays: integer("horizon_days").notNull(),
	topN: integer("top_n").notNull(),
	requestedCount: integer("requested_count").notNull(),
	evaluatedCount: integer("evaluated_count").notNull(),
	missingCount: integer("missing_count").notNull(),
	meanReturn: real("mean_return"),
	medianReturn: real("median_return"),
	hitRate: real("hit_rate"),
	bestReturn: real("best_return"),
	worstReturn: real("worst_return"),
	computedAt: timestamp("computed_at", { mode: 'string' }).defaultNow().notNull(),
	benchmarkSymbol: varchar("benchmark_symbol", { length: 20 }),
	benchmarkReturn: real("benchmark_return"),
	excessMeanReturn: real("excess_mean_return"),
}, (table) => [
	index("idx_pack_run_perf_run").using("btree", table.runId.asc().nullsLast().op("text_ops")),
	uniqueIndex("unique_pack_run_perf_triple").using("btree", table.runId.asc().nullsLast().op("int4_ops"), table.horizonDays.asc().nullsLast().op("text_ops"), table.topN.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [packRuns.runId],
			name: "fk_pack_run_perf_run_id"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const packRunStages = pgTable("pack_run_stages", {
	id: serial().notNull(),
	runId: varchar("run_id", { length: 100 }).notNull(),
	stageIndex: integer("stage_index").notNull(),
	stageName: varchar("stage_name", { length: 100 }).notNull(),
	inputSize: integer("input_size").notNull(),
	outputSize: integer("output_size").notNull(),
	keepRatio: real("keep_ratio").notNull(),
	durationMs: integer("duration_ms").notNull(),
	metrics: jsonb(),
	warnings: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pack_run_stages_name").using("btree", table.stageName.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_pack_run_stages_run").using("btree", table.runId.asc().nullsLast().op("int4_ops"), table.stageIndex.asc().nullsLast().op("text_ops")),
	uniqueIndex("unique_pack_run_stage").using("btree", table.runId.asc().nullsLast().op("int4_ops"), table.stageIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [packRuns.runId],
			name: "fk_pack_run_stages_run_id"
		}).onUpdate("cascade").onDelete("cascade"),
]);
