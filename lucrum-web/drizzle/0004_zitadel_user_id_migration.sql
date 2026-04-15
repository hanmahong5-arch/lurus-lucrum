-- Migration: Convert all user_id columns from UUID to TEXT
-- Reason: Zitadel uses numeric snowflake IDs (e.g. "359955593424799557"),
-- not UUIDs. The `users` table (empty, legacy credential-auth) is no longer
-- the source of truth — Zitadel `sub` is. Drop FKs to users.id and widen
-- user-identifier columns to text.

-- Step 1: Drop all FKs to users.id
ALTER TABLE backtest_history DROP CONSTRAINT IF EXISTS backtest_history_user_id_users_id_fk;
ALTER TABLE strategy_history DROP CONSTRAINT IF EXISTS strategy_history_user_id_users_id_fk;
ALTER TABLE tenant_members DROP CONSTRAINT IF EXISTS tenant_members_user_id_users_id_fk;
ALTER TABLE tenant_members DROP CONSTRAINT IF EXISTS tenant_members_invited_by_users_id_fk;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_owner_id_users_id_fk;
ALTER TABLE trading_history DROP CONSTRAINT IF EXISTS trading_history_user_id_users_id_fk;
ALTER TABLE user_drafts DROP CONSTRAINT IF EXISTS user_drafts_user_id_users_id_fk;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_users_id_fk;
ALTER TABLE user_workflow_sessions DROP CONSTRAINT IF EXISTS user_workflow_sessions_user_id_users_id_fk;
ALTER TABLE strategy_versions DROP CONSTRAINT IF EXISTS strategy_versions_user_id_users_id_fk;
ALTER TABLE tenant_invitations DROP CONSTRAINT IF EXISTS tenant_invitations_invited_by_fkey;
ALTER TABLE team_activity DROP CONSTRAINT IF EXISTS team_activity_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE strategy_annotations DROP CONSTRAINT IF EXISTS strategy_annotations_user_id_fkey;
ALTER TABLE strategy_reviews DROP CONSTRAINT IF EXISTS strategy_reviews_author_id_fkey;
ALTER TABLE review_comments DROP CONSTRAINT IF EXISTS review_comments_user_id_fkey;
ALTER TABLE shared_portfolios DROP CONSTRAINT IF EXISTS shared_portfolios_created_by_fkey;
ALTER TABLE team_leaderboard_snapshots DROP CONSTRAINT IF EXISTS team_leaderboard_snapshots_user_id_fkey;

-- Also drop popular_strategies FK if present (author_id may reference users)
ALTER TABLE popular_strategies DROP CONSTRAINT IF EXISTS popular_strategies_author_id_users_id_fk;
ALTER TABLE popular_strategies DROP CONSTRAINT IF EXISTS popular_strategies_author_user_id_fkey;
ALTER TABLE popular_strategies DROP CONSTRAINT IF EXISTS popular_strategies_author_id_fkey;

-- Step 2: Alter user-identifier columns to text
ALTER TABLE backtest_history ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE strategy_history ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE tenant_members ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE tenant_members ALTER COLUMN invited_by TYPE text USING invited_by::text;
ALTER TABLE tenants ALTER COLUMN owner_id TYPE text USING owner_id::text;
ALTER TABLE trading_history ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE user_drafts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE user_preferences ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE user_workflow_sessions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE strategy_versions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE tenant_invitations ALTER COLUMN invited_by TYPE text USING invited_by::text;
ALTER TABLE team_activity ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE notifications ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE strategy_annotations ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE strategy_annotations ALTER COLUMN resolved_by TYPE text USING resolved_by::text;
ALTER TABLE strategy_reviews ALTER COLUMN author_id TYPE text USING author_id::text;
ALTER TABLE review_comments ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE shared_portfolios ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE team_leaderboard_snapshots ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE popular_strategies ALTER COLUMN author_id TYPE text USING author_id::text;

-- Step 3: Drop legacy users table (empty, Zitadel is SSOT)
DROP TABLE IF EXISTS users CASCADE;
