-- Sprint 1: Paper Trading skeleton
-- Adds 4 tables backing the "纸上跑一遍" CTA on LiveSignalCard.
-- Real-time mark-to-market sweep arrives in Sprint 2 — these tables are
-- writable from the publish API today but no background worker fills them.

CREATE TABLE IF NOT EXISTS "paper_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "strategy_history_id" integer,
  "marketplace_strategy_id" integer,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "initial_capital" real DEFAULT 100000 NOT NULL,
  "strategy_name" varchar(120),
  "symbol" varchar(20),
  "start_at" timestamp DEFAULT now() NOT NULL,
  "closed_at" timestamp,
  "last_mtm_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "paper_runs"
    ADD CONSTRAINT "paper_runs_strategy_history_id_strategy_history_id_fk"
    FOREIGN KEY ("strategy_history_id") REFERENCES "strategy_history"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "paper_runs"
    ADD CONSTRAINT "paper_runs_marketplace_strategy_id_marketplace_strategies_id_fk"
    FOREIGN KEY ("marketplace_strategy_id") REFERENCES "marketplace_strategies"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_paper_runs_user" ON "paper_runs" ("user_id","start_at");
CREATE INDEX IF NOT EXISTS "idx_paper_runs_status" ON "paper_runs" ("status");
CREATE INDEX IF NOT EXISTS "idx_paper_runs_marketplace" ON "paper_runs" ("marketplace_strategy_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "paper_positions" (
  "run_id" integer NOT NULL,
  "symbol" varchar(20) NOT NULL,
  "qty" integer NOT NULL,
  "avg_cost" real NOT NULL,
  "last_price" real,
  "last_price_at" timestamp,
  "unrealized_pnl" real,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "paper_positions"
    ADD CONSTRAINT "paper_positions_run_id_paper_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "paper_runs"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_paper_positions_run_symbol"
  ON "paper_positions" ("run_id","symbol");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "paper_trades" (
  "id" serial PRIMARY KEY NOT NULL,
  "run_id" integer NOT NULL,
  "ts" timestamp NOT NULL,
  "symbol" varchar(20) NOT NULL,
  "side" varchar(4) NOT NULL,
  "qty" integer NOT NULL,
  "price" real NOT NULL,
  "commission" real DEFAULT 0,
  "slippage_bps" real DEFAULT 0,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "paper_trades"
    ADD CONSTRAINT "paper_trades_run_id_paper_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "paper_runs"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_paper_trades_run_ts" ON "paper_trades" ("run_id","ts");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "paper_equity_curve" (
  "run_id" integer NOT NULL,
  "date" date NOT NULL,
  "equity" real NOT NULL,
  "drawdown" real,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "paper_equity_curve"
    ADD CONSTRAINT "paper_equity_curve_run_id_paper_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "paper_runs"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_paper_equity_run_date"
  ON "paper_equity_curve" ("run_id","date");

CREATE INDEX IF NOT EXISTS "idx_paper_equity_run_date_desc"
  ON "paper_equity_curve" ("run_id","date");
