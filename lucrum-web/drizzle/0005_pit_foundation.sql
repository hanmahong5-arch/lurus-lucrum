-- Migration 0005: Point-in-Time Data Foundation
-- Adds six tables that enable time-consistent historical queries and
-- unbiased backtesting/factor research.
--
-- Tables:
--   trading_calendar            — Which days are trading days
--   stock_halt_calendar         — Historical halt/suspension windows
--   stock_status_history        — ST/suspended/delisted transitions
--   sector_component_snapshots  — Daily sector membership (avoid lookahead)
--   financial_disclosures       — Report period → announcement date mapping
--   financial_facts_pit         — Versioned fundamental facts (by as_of_date)

-- ---------------------------------------------------------------------------
-- 1. trading_calendar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "trading_calendar" (
	"date" varchar(10) PRIMARY KEY NOT NULL,
	"is_trading" boolean NOT NULL,
	"session_type" varchar(20) DEFAULT 'normal' NOT NULL,
	"exchange" varchar(10) DEFAULT 'CN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_trading_calendar_trading" ON "trading_calendar" USING btree ("is_trading","date");

-- ---------------------------------------------------------------------------
-- 2. stock_halt_calendar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "stock_halt_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"halt_date" varchar(10) NOT NULL,
	"resume_date" varchar(10),
	"reason" varchar(100),
	"announce_date" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_halt_symbol_date" ON "stock_halt_calendar" USING btree ("symbol","halt_date");
CREATE INDEX IF NOT EXISTS "idx_halt_date_range" ON "stock_halt_calendar" USING btree ("halt_date","resume_date");

-- ---------------------------------------------------------------------------
-- 3. stock_status_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "stock_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"from_date" varchar(10) NOT NULL,
	"to_date" varchar(10),
	"status" varchar(20) NOT NULL,
	"reason" varchar(200),
	"announce_date" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_status_symbol_from" ON "stock_status_history" USING btree ("symbol","from_date");
CREATE INDEX IF NOT EXISTS "idx_status_status_from" ON "stock_status_history" USING btree ("status","from_date");

-- ---------------------------------------------------------------------------
-- 4. sector_component_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sector_component_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"as_of_date" varchar(10) NOT NULL,
	"sector_code" varchar(20) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sector_snap_date_sector" ON "sector_component_snapshots" USING btree ("as_of_date","sector_code");
CREATE INDEX IF NOT EXISTS "idx_sector_snap_symbol_date" ON "sector_component_snapshots" USING btree ("symbol","as_of_date");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_sector_snap" ON "sector_component_snapshots" USING btree ("as_of_date","sector_code","symbol");

-- ---------------------------------------------------------------------------
-- 5. financial_disclosures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "financial_disclosures" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"report_period" varchar(10) NOT NULL,
	"report_type" varchar(20) NOT NULL,
	"announce_date" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_disclosure_symbol_announce" ON "financial_disclosures" USING btree ("symbol","announce_date");
CREATE INDEX IF NOT EXISTS "idx_disclosure_announce" ON "financial_disclosures" USING btree ("announce_date");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_disclosure" ON "financial_disclosures" USING btree ("symbol","report_period","report_type");

-- ---------------------------------------------------------------------------
-- 6. financial_facts_pit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "financial_facts_pit" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"field" varchar(50) NOT NULL,
	"value" numeric(20, 6),
	"report_period" varchar(10) NOT NULL,
	"as_of_date" varchar(10) NOT NULL,
	"source" varchar(30),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pit_facts_lookup" ON "financial_facts_pit" USING btree ("symbol","field","as_of_date");
CREATE INDEX IF NOT EXISTS "idx_pit_facts_period" ON "financial_facts_pit" USING btree ("symbol","field","report_period");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_pit_facts_version" ON "financial_facts_pit" USING btree ("symbol","field","report_period","as_of_date");
