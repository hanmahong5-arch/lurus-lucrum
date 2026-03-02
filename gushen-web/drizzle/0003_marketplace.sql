-- Migration 0003: Strategy Marketplace tables
-- Adds marketplace_strategies and strategy_subscriptions tables.

CREATE TABLE IF NOT EXISTS "marketplace_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_history_id" integer NOT NULL,
	"author_user_id" uuid,
	"title" varchar(100) NOT NULL,
	"description" text,
	"price_type" varchar(20) NOT NULL,
	"price_per_run" real DEFAULT 0,
	"price_monthly" real DEFAULT 0,
	"author_identity_account_id" varchar(32),
	"grade_score" varchar(2),
	"total_runs" integer DEFAULT 0,
	"total_subscribers" integer DEFAULT 0,
	"staked_lb" real DEFAULT 10,
	"status" varchar(20) DEFAULT 'active',
	"published_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "strategy_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_identity_account_id" varchar(32),
	"marketplace_strategy_id" integer,
	"type" varchar(20) NOT NULL,
	"lb_paid" real NOT NULL,
	"platform_fee_rate" real DEFAULT 0.3,
	"author_revenue_lb" real NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);

DO $$ BEGIN
 ALTER TABLE "marketplace_strategies" ADD CONSTRAINT "marketplace_strategies_strategy_history_id_strategy_history_id_fk" FOREIGN KEY ("strategy_history_id") REFERENCES "public"."strategy_history"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "marketplace_strategies" ADD CONSTRAINT "marketplace_strategies_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "strategy_subscriptions" ADD CONSTRAINT "strategy_subscriptions_marketplace_strategy_id_marketplace_strategies_id_fk" FOREIGN KEY ("marketplace_strategy_id") REFERENCES "public"."marketplace_strategies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_marketplace_author" ON "marketplace_strategies" USING btree ("author_user_id");
CREATE INDEX IF NOT EXISTS "idx_marketplace_status" ON "marketplace_strategies" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_marketplace_price_type" ON "marketplace_strategies" USING btree ("price_type");
CREATE INDEX IF NOT EXISTS "idx_strategy_subs_subscriber" ON "strategy_subscriptions" USING btree ("subscriber_identity_account_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_subs_strategy" ON "strategy_subscriptions" USING btree ("marketplace_strategy_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_subs_created" ON "strategy_subscriptions" USING btree ("created_at");
