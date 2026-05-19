#!/usr/bin/env bash
# Apply Sprint 0/1 pending migrations to R6 PostgreSQL.
#
# Both 0009 and 0010 are idempotent:
#   - 0009 uses IF NOT EXISTS for columns + indices.
#   - 0010 uses CREATE TABLE IF NOT EXISTS + DO $$ EXCEPTION blocks for FKs.
#
# Run from anywhere with Tailscale access to R6 master (100.122.83.20).
# The script copies SQL into the running PG pod and runs psql there, so it
# does not need a local psql client.
#
# Usage:
#   ./scripts/apply-r6-migrations.sh
#   ./scripts/apply-r6-migrations.sh --dry-run    # only show what would happen
#
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

R6_HOST="${R6_HOST:-root@100.122.83.20}"
PG_NS="${PG_NS:-database}"
PG_POD_LABEL="${PG_POD_LABEL:-lurus-pg-1}"
PG_DB="${PG_DB:-lucrum}"
PG_USER="${PG_USER:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

MIGRATIONS=(
  "$REPO_DIR/drizzle/0009_timeline_marketplace_extensions.sql"
  "$REPO_DIR/drizzle/0010_paper_trading.sql"
)

for f in "${MIGRATIONS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "[ERROR] Migration file not found: $f" >&2
    exit 1
  fi
done

run_remote() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] ssh $R6_HOST $*"
  else
    ssh -o ConnectTimeout=10 "$R6_HOST" "$@"
  fi
}

echo "── Step 1: locate PG pod ─────────────────────────────────────────────"
POD=$(run_remote "kubectl -n $PG_NS get pods -l cnpg.io/cluster=$PG_POD_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || kubectl -n $PG_NS get pods | grep -E '^lurus-pg-1-1' | awk '{print \$1}' | head -1")
if [[ -z "$POD" ]] && [[ "$DRY_RUN" -eq 0 ]]; then
  echo "[ERROR] No PG pod found in ns=$PG_NS matching '$PG_POD_LABEL'" >&2
  exit 2
fi
echo "  PG pod: ${POD:-<dry-run>}"

echo "── Step 2: check current schema state ────────────────────────────────"
EXISTING_TABLES=$(run_remote "kubectl -n $PG_NS exec '$POD' -- psql -U $PG_USER -d $PG_DB -tA -c \"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('paper_runs','paper_positions','paper_trades','paper_equity_curve');\" 2>/dev/null || echo ''")
echo "  paper_* tables already present: ${EXISTING_TABLES:-<none>}"

USER_EVENTS_COLS=$(run_remote "kubectl -n $PG_NS exec '$POD' -- psql -U $PG_USER -d $PG_DB -tA -c \"SELECT column_name FROM information_schema.columns WHERE table_name='user_events' AND column_name IN ('entity_type','entity_id');\" 2>/dev/null || echo ''")
echo "  user_events new cols already present: ${USER_EVENTS_COLS:-<none>}"

echo "── Step 3: apply migrations (both idempotent) ────────────────────────"
for f in "${MIGRATIONS[@]}"; do
  base=$(basename "$f")
  echo "  applying $base ..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] cat $f | ssh $R6_HOST kubectl -n $PG_NS exec -i $POD -- psql -U $PG_USER -d $PG_DB"
  else
    cat "$f" | ssh -o ConnectTimeout=30 "$R6_HOST" "kubectl -n $PG_NS exec -i '$POD' -- psql -U $PG_USER -d $PG_DB" \
      || { echo "[ERROR] Migration $base FAILED" >&2; exit 3; }
  fi
done

echo "── Step 4: verify tables exist post-apply ────────────────────────────"
if [[ "$DRY_RUN" -eq 0 ]]; then
  run_remote "kubectl -n $PG_NS exec '$POD' -- psql -U $PG_USER -d $PG_DB -c \"\\dt paper_*\""
  echo
  run_remote "kubectl -n $PG_NS exec '$POD' -- psql -U $PG_USER -d $PG_DB -c \"\\d user_events\" | grep -E 'entity_type|entity_id|idx_user_events'"
fi

echo
echo "✓ Done. Update doc/coord/migration-ledger.md:"
echo "    0009 PENDING-R6 → APPLIED-R6 ($(date -u +%Y-%m-%d))"
echo "    0010 PENDING-R6 → APPLIED-R6 ($(date -u +%Y-%m-%d))"
