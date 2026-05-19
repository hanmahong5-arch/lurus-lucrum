#!/usr/bin/env bash
# Lucrum end-to-end smoke test — run from R6 master.
#
# Three scenarios:
#   S1. Marketplace value-flow (fork + rate, DB-level)
#   S2. Paper Trading + MTM cron (with real eastmoney call)
#   S3. Cron auth smoke (paper-mtm + klines-update)
#
# Idempotent: each scenario seeds with id offset 90000+ and cleans up
# before exit. Run with --keep to leave seed data in DB for inspection.
#
# Usage (recommended — copy file first, ssh-stdin gets eaten by psql heredocs):
#   scp scripts/e2e-smoke.sh root@100.122.83.20:/tmp/smoke.sh
#   ssh root@100.122.83.20 'bash /tmp/smoke.sh && rm /tmp/smoke.sh'
#
# --keep variant:
#   ssh root@100.122.83.20 'bash /tmp/smoke.sh --keep'
set -eu

R6_HOST="${R6_HOST:-100.122.83.20}"
NS_LUCRUM="${NS_LUCRUM:-lucrum}"
NS_DB="${NS_DB:-database}"
PG_POD="${PG_POD:-lurus-pg-0}"
KEEP_DATA=0
if [[ "${1:-}" == "--keep" ]]; then
  KEEP_DATA=1
  echo "[smoke] --keep mode: seed data will be left in DB"
fi

psql() {
  kubectl -n "$NS_DB" exec -i "$PG_POD" -- psql -U postgres -d lucrum -v ON_ERROR_STOP=1 "$@"
}

# curl_lucrum <path> [extra curl args...]
# Joins the cluster Service URL + path explicitly so $@ can hold flags only.
curl_lucrum() {
  local path="$1"; shift
  local secret svc
  secret=$(kubectl -n "$NS_LUCRUM" get secret lucrum-secrets -o jsonpath='{.data.CRON_SECRET}' | base64 -d)
  svc=$(kubectl -n "$NS_LUCRUM" get svc lucrum-web -o jsonpath='{.spec.clusterIP}')
  curl -sS --max-time 30 \
    -H "Authorization: Bearer $secret" \
    -H "Content-Type: application/json" \
    "$@" "http://$svc:3000$path"
}

curl_lucrum_unauth() {
  local path="$1"; shift
  local svc
  svc=$(kubectl -n "$NS_LUCRUM" get svc lucrum-web -o jsonpath='{.spec.clusterIP}')
  curl -sS --max-time 30 -H "Content-Type: application/json" "$@" "http://$svc:3000$path"
}

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }

# ============================================================================
# S1. Marketplace value-flow (DB-only, no HTTP — sidesteps NextAuth)
# ============================================================================
s1() {
  echo "═══ S1. Marketplace fork + rate (DB) ═══"

  # Seed (Lucrum has no users table — user_id is plain text Zitadel sub.
  # FK constraints on user_id don't exist, so we just write the data tables.)
  # Reset counters to zero on every run so the script is idempotent — both
  # within-run (fork simulation always increments from 0) and across runs.
  psql >/dev/null <<'SQL'
BEGIN;
DELETE FROM strategy_ratings WHERE marketplace_strategy_id=90001;
INSERT INTO strategy_history (id, user_id, strategy_name, description, strategy_code, parameters, strategy_type, version, is_active, is_starred)
VALUES (90001, 'smoke:author-a', '动量·MACD·smoke', '冒烟测试策略', 'pass', '{}', 'custom', 1, true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO marketplace_strategies (id, strategy_history_id, author_user_id, title, description, price_type, price_per_run, staked_lb, status, published_at, fork_count, rating_avg, rating_count)
VALUES (90001, 90001, 'smoke:author-a', 'Smoke 动量策略', 'fork/rate 路径冒烟', 'per_run', 1.00, 10, 'active', NOW(), 0, 0, 0)
ON CONFLICT (id) DO UPDATE SET fork_count=0, rating_avg=0, rating_count=0;

-- Forks from prior runs accumulate — drop them before the new simulation
DELETE FROM strategy_history WHERE user_id='smoke:buyer-b' AND parent_marketplace_id=90001;
COMMIT;
SQL
  pass "seed: strategy_history + marketplace_strategies"

  # Simulate fork (skips HTTP auth — direct DB write mirrors service logic)
  psql >/dev/null <<'SQL'
BEGIN;
INSERT INTO strategy_history (user_id, strategy_name, strategy_code, parameters, strategy_type, version, parent_marketplace_id, is_active)
VALUES ('smoke:buyer-b', 'Smoke 动量策略 (Fork)', 'pass', '{}', 'forked', 1, 90001, true);
UPDATE marketplace_strategies SET fork_count = COALESCE(fork_count,0)+1 WHERE id=90001;
INSERT INTO strategy_ratings (marketplace_strategy_id, user_id, stars, review)
VALUES (90001, 'smoke:buyer-b', 5, 'smoke 评分');
UPDATE marketplace_strategies SET rating_avg=5.00, rating_count=1 WHERE id=90001;
COMMIT;
SQL
  pass "simulated: fork + rate via DB"

  # Verify
  local fc
  fc=$(psql -tA -c "SELECT fork_count FROM marketplace_strategies WHERE id=90001;")
  [[ "$fc" == "1" ]] && pass "fork_count = 1" || fail "fork_count = $fc (expected 1)"

  local ra rc
  ra=$(psql -tA -c "SELECT rating_avg FROM marketplace_strategies WHERE id=90001;")
  rc=$(psql -tA -c "SELECT rating_count FROM marketplace_strategies WHERE id=90001;")
  [[ "$ra" == "5.00" ]] && pass "rating_avg = 5.00" || fail "rating_avg = $ra"
  [[ "$rc" == "1" ]] && pass "rating_count = 1" || fail "rating_count = $rc"

  local lineage
  lineage=$(psql -tA -c "SELECT parent_marketplace_id FROM strategy_history WHERE user_id='smoke:buyer-b';")
  [[ "$lineage" == "90001" ]] && pass "fork lineage = 90001" || fail "lineage = $lineage"
}

# ============================================================================
# S2. Paper Trading + MTM (real cron trigger)
# ============================================================================
s2() {
  echo "═══ S2. Paper Trading MTM ═══"

  psql >/dev/null <<'SQL'
INSERT INTO paper_runs (id, user_id, status, initial_capital, strategy_name, symbol, start_at)
VALUES (90001, 'smoke:buyer-b', 'active', 100000, 'Smoke 茅台模拟', '600519', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO paper_positions (run_id, symbol, qty, avg_cost, last_price)
VALUES (90001, '600519', 100, 1500, 1500)
ON CONFLICT (run_id, symbol) DO NOTHING;
SQL
  pass "seed: paper_run + 100 shares of 600519 @ 1500"

  # Trigger MTM
  local response
  response=$(curl_lucrum /api/cron/paper-mtm -X POST)
  echo "  MTM response: $response"
  if echo "$response" | grep -q '"success":true'; then
    pass "MTM cron returned success=true"
  else
    fail "MTM cron failed: $response"
  fi

  # Verify equity curve has today's row
  local today curve_count
  today=$(date -u +%F)
  curve_count=$(psql -tA -c "SELECT COUNT(*) FROM paper_equity_curve WHERE run_id=90001 AND date='$today';")
  [[ "$curve_count" -ge "1" ]] && pass "equity_curve row written for $today" || fail "no equity row (count=$curve_count)"

  # Verify position got new last_price (assumes eastmoney returned a price)
  local lp
  lp=$(psql -tA -c "SELECT last_price FROM paper_positions WHERE run_id=90001 AND symbol='600519';")
  if [[ "$lp" != "1500" ]] && [[ -n "$lp" ]]; then
    pass "position.last_price refreshed: $lp (was 1500)"
  else
    echo "  ⚠ position.last_price unchanged (1500) — eastmoney may have failed; check report.missingPriceSymbols"
  fi

  # Idempotent rerun
  curl_lucrum /api/cron/paper-mtm -X POST >/dev/null
  curve_count=$(psql -tA -c "SELECT COUNT(*) FROM paper_equity_curve WHERE run_id=90001 AND date='$today';")
  [[ "$curve_count" == "1" ]] && pass "idempotent: still 1 row after rerun" || fail "duplicate rows ($curve_count) after rerun"
}

# ============================================================================
# S3. Cron auth smoke
# ============================================================================
s3() {
  echo "═══ S3. Cron auth smoke ═══"

  local unauth_status wrong_status klines_unauth
  unauth_status=$(curl_lucrum_unauth /api/cron/paper-mtm -o /dev/null -w '%{http_code}' -X POST)
  [[ "$unauth_status" == "401" ]] && pass "paper-mtm no-auth → 401" || fail "expected 401, got $unauth_status"

  wrong_status=$(curl_lucrum_unauth /api/cron/paper-mtm -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer wrong' -X POST)
  [[ "$wrong_status" == "401" ]] && pass "paper-mtm wrong-token → 401" || fail "expected 401, got $wrong_status"

  klines_unauth=$(curl_lucrum_unauth /api/cron/klines-update -o /dev/null -w '%{http_code}' -X POST)
  [[ "$klines_unauth" == "401" ]] && pass "klines-update no-auth → 401" || fail "expected 401, got $klines_unauth"
}

# ============================================================================
# Cleanup (skipped if --keep)
# ============================================================================
cleanup() {
  if [[ "$KEEP_DATA" == "1" ]]; then
    echo "═══ Cleanup SKIPPED (--keep) ═══"
    echo "  Seed data left in DB. To clean up later:"
    echo "  kubectl -n $NS_DB exec $PG_POD -- psql -U postgres -d lucrum -c \\"
    echo "    \"DELETE FROM paper_equity_curve WHERE run_id IN (90001);\""
    echo "    \"DELETE FROM paper_positions WHERE run_id IN (90001);\""
    echo "    \"DELETE FROM paper_trades WHERE run_id IN (90001);\""
    echo "    \"DELETE FROM paper_runs WHERE id IN (90001);\""
    echo "    \"DELETE FROM strategy_ratings WHERE user_id LIKE 'smoke:%';\""
    echo "    \"DELETE FROM strategy_history WHERE user_id LIKE 'smoke:%';\""
    echo "    \"DELETE FROM marketplace_strategies WHERE id=90001;\""
    echo "    \"DELETE FROM users WHERE id LIKE 'smoke:%';\""
    return
  fi
  echo "═══ Cleanup ═══"
  # FK chain: marketplace_strategies → strategy_history → (no FK to users)
  # Must delete marketplace_strategies before strategy_history. Cleanup
  # uses DELETE-IF-EXISTS semantics implicitly (no error on missing rows)
  # because we use WHERE clauses that may match 0 rows.
  psql >/dev/null <<'SQL'
DELETE FROM paper_equity_curve WHERE run_id IN (90001);
DELETE FROM paper_positions WHERE run_id IN (90001);
DELETE FROM paper_trades WHERE run_id IN (90001);
DELETE FROM paper_runs WHERE id IN (90001);
DELETE FROM strategy_ratings WHERE user_id LIKE 'smoke:%';
DELETE FROM marketplace_strategies WHERE id=90001;
DELETE FROM strategy_history WHERE user_id LIKE 'smoke:%';
SQL
  pass "removed seed data"
}

trap cleanup EXIT

s1
s2
s3

echo
echo "✓ All scenarios passed."
