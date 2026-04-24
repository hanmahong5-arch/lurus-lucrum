-- Migration 0007: Pack Run Forward-Return Rollup (alpha-decay tracker)
-- Stores per-(run, horizon, topN) forward-return aggregates computed from
-- equal-weight baskets of the run's top candidates. Computed lazily on the
-- monitoring drill-down; upsert-safe via unique (run_id, horizon_days, top_n).
--
-- Returns are fractional (0.0325 = +3.25%). NULLs when evaluated_count=0.

CREATE TABLE IF NOT EXISTS "pack_run_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" varchar(100) NOT NULL,
	"horizon_days" integer NOT NULL,
	"top_n" integer NOT NULL,
	"requested_count" integer NOT NULL,
	"evaluated_count" integer NOT NULL,
	"missing_count" integer NOT NULL,
	"mean_return" real,
	"median_return" real,
	"hit_rate" real,
	"best_return" real,
	"worst_return" real,
	"computed_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pack_run_perf_run" ON "pack_run_performance" USING btree ("run_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_pack_run_perf_triple" ON "pack_run_performance" USING btree ("run_id","horizon_days","top_n");
