CREATE TABLE "backtest_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" integer,
	"strategy_history_id" integer,
	"symbol" varchar(20) NOT NULL,
	"stock_name" varchar(50),
	"start_date" varchar(10) NOT NULL,
	"end_date" varchar(10) NOT NULL,
	"timeframe" varchar(10) DEFAULT '1d' NOT NULL,
	"config" text NOT NULL,
	"result" text NOT NULL,
	"data_source" varchar(30) NOT NULL,
	"data_coverage" real,
	"total_return" real,
	"sharpe_ratio" real,
	"max_drawdown" real,
	"win_rate" real,
	"execution_time" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_update_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"update_date" varchar(10) NOT NULL,
	"update_type" varchar(20) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" varchar(20) NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kline_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_id" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"open" real NOT NULL,
	"high" real NOT NULL,
	"low" real NOT NULL,
	"close" real NOT NULL,
	"volume" real NOT NULL,
	"amount" real,
	"adj_factor" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(50) NOT NULL,
	"name_en" varchar(100),
	"level" integer DEFAULT 1 NOT NULL,
	"parent_id" integer,
	"stock_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_sector_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_id" integer NOT NULL,
	"sector_id" integer NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"name" varchar(50) NOT NULL,
	"listing_date" varchar(10),
	"is_st" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"market_cap" real,
	"exchange" varchar(10),
	"industry" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "strategy_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" integer,
	"strategy_name" varchar(100) NOT NULL,
	"description" text,
	"strategy_code" text NOT NULL,
	"parameters" text NOT NULL,
	"strategy_type" varchar(20) DEFAULT 'ai_generated' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_version_id" integer,
	"tags" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"status" varchar(20) DEFAULT 'accepted' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"owner_id" uuid NOT NULL,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"max_members" integer DEFAULT 5 NOT NULL,
	"settings" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "trading_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" integer,
	"strategy_history_id" integer,
	"symbol" varchar(20) NOT NULL,
	"stock_name" varchar(50),
	"side" varchar(10) NOT NULL,
	"order_type" varchar(20) DEFAULT 'market' NOT NULL,
	"price" real NOT NULL,
	"size" integer NOT NULL,
	"amount" real NOT NULL,
	"commission" real,
	"status" varchar(20) DEFAULT 'filled' NOT NULL,
	"realized_pnl" real,
	"is_paper_trade" boolean DEFAULT true NOT NULL,
	"broker" varchar(30) DEFAULT 'mock' NOT NULL,
	"external_order_id" varchar(100),
	"notes" text,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"draft_type" varchar(50) NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" varchar(20) DEFAULT 'dark',
	"default_timeframe" varchar(10) DEFAULT '1d',
	"default_capital" numeric(15, 2) DEFAULT '100000',
	"auto_save_enabled" boolean DEFAULT true NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"preferences" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100),
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'free' NOT NULL,
	"avatar" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validation_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" varchar(64) NOT NULL,
	"config" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "validation_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "validation_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"symbols" text NOT NULL,
	"config" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backtest_history" ADD CONSTRAINT "backtest_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_history" ADD CONSTRAINT "backtest_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_history" ADD CONSTRAINT "backtest_history_strategy_history_id_strategy_history_id_fk" FOREIGN KEY ("strategy_history_id") REFERENCES "public"."strategy_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kline_daily" ADD CONSTRAINT "kline_daily_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_sector_mapping" ADD CONSTRAINT "stock_sector_mapping_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_sector_mapping" ADD CONSTRAINT "stock_sector_mapping_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_history" ADD CONSTRAINT "strategy_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_history" ADD CONSTRAINT "strategy_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_history" ADD CONSTRAINT "trading_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_history" ADD CONSTRAINT "trading_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_history" ADD CONSTRAINT "trading_history_strategy_history_id_strategy_history_id_fk" FOREIGN KEY ("strategy_history_id") REFERENCES "public"."strategy_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drafts" ADD CONSTRAINT "user_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backtest_history_user" ON "backtest_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_backtest_history_tenant" ON "backtest_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_backtest_history_strategy" ON "backtest_history" USING btree ("strategy_history_id");--> statement-breakpoint
CREATE INDEX "idx_backtest_history_symbol" ON "backtest_history" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_backtest_history_date" ON "backtest_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_log_date" ON "data_update_log" USING btree ("update_date");--> statement-breakpoint
CREATE INDEX "idx_log_status" ON "data_update_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_log_type" ON "data_update_log" USING btree ("update_type");--> statement-breakpoint
CREATE INDEX "idx_kline_stock_date" ON "kline_daily" USING btree ("stock_id","date");--> statement-breakpoint
CREATE INDEX "idx_kline_date" ON "kline_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_kline_stock_id" ON "kline_daily" USING btree ("stock_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_stock_date" ON "kline_daily" USING btree ("stock_id","date");--> statement-breakpoint
CREATE INDEX "idx_sectors_code" ON "sectors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_sectors_parent" ON "sectors" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_mapping_stock" ON "stock_sector_mapping" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_mapping_sector" ON "stock_sector_mapping" USING btree ("sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_stock_sector" ON "stock_sector_mapping" USING btree ("stock_id","sector_id");--> statement-breakpoint
CREATE INDEX "idx_stocks_symbol" ON "stocks" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_stocks_status" ON "stocks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_stocks_st" ON "stocks" USING btree ("is_st");--> statement-breakpoint
CREATE INDEX "idx_stocks_name" ON "stocks" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_strategy_history_user" ON "strategy_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_history_tenant" ON "strategy_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_history_name" ON "strategy_history" USING btree ("strategy_name");--> statement-breakpoint
CREATE INDEX "idx_strategy_history_active" ON "strategy_history" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_tenant_members_tenant" ON "tenant_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_members_user" ON "tenant_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_members_unique" ON "tenant_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_slug" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_tenants_owner" ON "tenants" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_trading_history_user" ON "trading_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trading_history_tenant" ON "trading_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_trading_history_symbol" ON "trading_history" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_trading_history_date" ON "trading_history" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "idx_trading_history_status" ON "trading_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_drafts_user_created" ON "user_drafts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_drafts_type" ON "user_drafts" USING btree ("draft_type");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_cache_key" ON "validation_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "idx_cache_expires" ON "validation_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_presets_name" ON "validation_presets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_presets_favorite" ON "validation_presets" USING btree ("is_favorite");