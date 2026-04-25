-- Migration 0008: Pack Run Alpha-Decay — benchmark-relative + integrity hardening
--
-- Adds CSI300 (or any future benchmark) baseline + excess return columns to
-- pack_run_performance, and enforces referential integrity so deleting a
-- pack_run cascades to its derived stage and performance rollups.
--
-- Excess return is the metric clients actually care about: a +5% absolute
-- mean during a +8% benchmark rally is -3% alpha, not +5%. Until rows are
-- recomputed, the new columns remain NULL and the UI degrades gracefully.

ALTER TABLE "pack_run_performance"
  ADD COLUMN IF NOT EXISTS "benchmark_symbol" varchar(20),
  ADD COLUMN IF NOT EXISTS "benchmark_return" real,
  ADD COLUMN IF NOT EXISTS "excess_mean_return" real;

-- Cascade delete from pack_runs → derived rollups.
-- Existing data already self-consistent (1 prod run + 8 stages + 3 perf rows);
-- the constraint is safe to add without backfill.
ALTER TABLE "pack_run_performance"
  DROP CONSTRAINT IF EXISTS "fk_pack_run_perf_run_id";
ALTER TABLE "pack_run_performance"
  ADD CONSTRAINT "fk_pack_run_perf_run_id"
  FOREIGN KEY ("run_id")
  REFERENCES "pack_runs"("run_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "pack_run_stages"
  DROP CONSTRAINT IF EXISTS "fk_pack_run_stages_run_id";
ALTER TABLE "pack_run_stages"
  ADD CONSTRAINT "fk_pack_run_stages_run_id"
  FOREIGN KEY ("run_id")
  REFERENCES "pack_runs"("run_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
