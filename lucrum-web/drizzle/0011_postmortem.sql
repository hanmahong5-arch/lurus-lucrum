-- Migration 0011: AI postmortem (Wave 5)
--
-- Two tables backing the 4-persona retrospective dispatcher.
--
-- - postmortem_runs           : one row per user-initiated dispatch
-- - postmortem_persona_results: one row per (run, persona); cache key is
--                               (backtest_id, persona_id) so re-running a
--                               postmortem on an unchanged backtest is free.
--
-- Apply on R6:
--   kubectl -n database exec -it lurus-pg-0 -- \
--     psql -U postgres -d lucrum < drizzle/0011_postmortem.sql
-- Record in doc/coord/migration-ledger.md.

CREATE TABLE IF NOT EXISTS "postmortem_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "backtest_id" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "total_cost_lb" numeric(10, 4) DEFAULT '0' NOT NULL,
  "divergence_summary" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "postmortem_runs_user_idx"
  ON "postmortem_runs" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "postmortem_runs_backtest_idx"
  ON "postmortem_runs" ("backtest_id");

CREATE TABLE IF NOT EXISTS "postmortem_persona_results" (
  "id" serial PRIMARY KEY NOT NULL,
  "run_id" integer NOT NULL
    REFERENCES "postmortem_runs"("id") ON DELETE CASCADE,
  "backtest_id" integer NOT NULL,
  "persona_id" varchar(30) NOT NULL,
  "verdict" varchar(20) NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb NOT NULL,
  "improvements" jsonb NOT NULL,
  "confidence" numeric(3, 2) NOT NULL,
  "cost_lb" numeric(10, 4) NOT NULL,
  "model_used" varchar(60),
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "postmortem_results_run_idx"
  ON "postmortem_persona_results" ("run_id");

CREATE UNIQUE INDEX IF NOT EXISTS "postmortem_results_cache_idx"
  ON "postmortem_persona_results" ("backtest_id", "persona_id");
