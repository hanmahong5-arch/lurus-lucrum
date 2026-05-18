-- ===========================================================================
-- 0009_timeline_marketplace_extensions
--
-- Track B (event timeline) + Track D (marketplace fork/rating) schema deltas.
-- Apply this manually on R6 before deploying the matching code.
--
--   psql "$DATABASE_URL" -f drizzle/0009_timeline_marketplace_extensions.sql
-- ===========================================================================

-- ── Track B: user_events fields + indices ──────────────────────────────────
ALTER TABLE user_events
  ADD COLUMN IF NOT EXISTS entity_type varchar(40),
  ADD COLUMN IF NOT EXISTS entity_id   varchar(100);

CREATE INDEX IF NOT EXISTS idx_user_events_user_created
  ON user_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_user_events_entity
  ON user_events (entity_type, entity_id);

-- ── Track D: marketplace_strategies columns ────────────────────────────────
ALTER TABLE marketplace_strategies
  ADD COLUMN IF NOT EXISTS school        varchar(40),
  ADD COLUMN IF NOT EXISTS rating_avg    numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count  integer       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fork_count    integer       DEFAULT 0;

-- ── Track D: strategy_history fork lineage ─────────────────────────────────
ALTER TABLE strategy_history
  ADD COLUMN IF NOT EXISTS parent_marketplace_id integer;

CREATE INDEX IF NOT EXISTS idx_strategy_history_parent_marketplace
  ON strategy_history (parent_marketplace_id);

-- ── Track D: strategy_ratings (1–5 stars) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS strategy_ratings (
  id                       serial PRIMARY KEY,
  marketplace_strategy_id  integer NOT NULL
    REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
  user_id                  text    NOT NULL,
  stars                    integer NOT NULL,
  review                   text,
  created_at               timestamp NOT NULL DEFAULT now(),
  updated_at               timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_ratings_unique
  ON strategy_ratings (marketplace_strategy_id, user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_ratings_strategy
  ON strategy_ratings (marketplace_strategy_id);
