-- Migration 0006: Pack / Funnel Run Persistence
-- Adds two tables that capture every funnel pipeline execution so downstream
-- jobs can compute alpha-decay, drift, slippage and per-pack health metrics.
--
-- Tables:
--   pack_runs        — one row per pipeline execution (header + summary)
--   pack_run_stages  — one row per stage evaluation (fan-out from FunnelResult.evals)

-- ---------------------------------------------------------------------------
-- 1. pack_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pack_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar(100) NOT NULL,
	"user_id" text,
	"pack_id" varchar(50),
	"pack_name" varchar(100),
	"as_of_date" varchar(10) NOT NULL,
	"universe_kind" varchar(10) NOT NULL,
	"universe_sector_code" varchar(20),
	"universe_symbols" jsonb,
	"top_n" integer,
	"duration_ms" integer NOT NULL,
	"status" varchar(10) NOT NULL,
	"error_stage" varchar(100),
	"error_code" varchar(50),
	"error_message" text,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"top_candidates" jsonb,
	"flags" jsonb,
	"options" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_pack_runs_run_id" ON "pack_runs" USING btree ("run_id");
CREATE INDEX IF NOT EXISTS "idx_pack_runs_user_created" ON "pack_runs" USING btree ("user_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_pack_runs_pack_asof" ON "pack_runs" USING btree ("pack_id","as_of_date");
CREATE INDEX IF NOT EXISTS "idx_pack_runs_asof" ON "pack_runs" USING btree ("as_of_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_pack_runs_status" ON "pack_runs" USING btree ("status","created_at" DESC);

-- ---------------------------------------------------------------------------
-- 2. pack_run_stages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pack_run_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" varchar(100) NOT NULL,
	"stage_index" integer NOT NULL,
	"stage_name" varchar(100) NOT NULL,
	"input_size" integer NOT NULL,
	"output_size" integer NOT NULL,
	"keep_ratio" real NOT NULL,
	"duration_ms" integer NOT NULL,
	"metrics" jsonb,
	"warnings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pack_run_stages_run" ON "pack_run_stages" USING btree ("run_id","stage_index");
CREATE INDEX IF NOT EXISTS "idx_pack_run_stages_name" ON "pack_run_stages" USING btree ("stage_name","created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "unique_pack_run_stage" ON "pack_run_stages" USING btree ("run_id","stage_index");
