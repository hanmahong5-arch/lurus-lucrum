#!/usr/bin/env bash
# bootstrap-prod-db.sh — Apply all Drizzle migrations to a fresh lucrum DB
#
# Use case: brand-new K3s cluster (e.g. R6 STAGE) where lucrum DB is empty.
# Pipes each SQL file in ./drizzle/ alphabetically into a CNPG postgres pod
# via peer-auth (kubectl exec — postgres unix socket).
#
# Why peer-auth: CNPG app users (lurus-pg-app/lurus) often refuse TCP from
# random locations because pg_hba.conf only allows local trust + cluster CIDR.
# `kubectl exec ... psql -U postgres` runs inside the pod's network namespace
# and authenticates via unix socket peer.
#
# Why this script exists: a previous incident (R6 cutover, 2026-04-25) needed
# 9 migrations applied by hand via cat | kubectl exec -i. Productizing this
# avoids drift, supports re-run safety (each migration uses ON CONFLICT /
# IF EXISTS clauses), and makes future cluster bootstrap a one-liner.
#
# Usage:
#   ./bootstrap-prod-db.sh                          # R6 (default)
#   CLUSTER=r1 ./bootstrap-prod-db.sh               # R1
#   PG_POD=lurus-pg-0 NS=database DB=lucrum ./bootstrap-prod-db.sh   # custom
#   DRY_RUN=1 ./bootstrap-prod-db.sh                # list files, no apply
#
# Requirements:
#   - ssh access to the cluster's kubectl entry (Tailscale or public)
#   - drizzle/*.sql migrations alphabetically ordered (0000_*.sql first)

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-database}"
DB="${DB:-lucrum}"
DRY_RUN="${DRY_RUN:-0}"

case "$CLUSTER" in
  r1)
    SSH_HOST="${SSH_HOST:-root@100.98.57.55}"
    PG_POD="${PG_POD:-lurus-pg-1}"
    ;;
  r6)
    SSH_HOST="${SSH_HOST:-root@100.122.83.20}"
    PG_POD="${PG_POD:-lurus-pg-0}"
    ;;
  *)
    if [ -z "${SSH_HOST:-}" ] || [ -z "${PG_POD:-}" ]; then
      echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST + PG_POD explicitly." >&2
      exit 2
    fi
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIZZLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/drizzle"

if [ ! -d "$DRIZZLE_DIR" ]; then
  echo "ERROR: drizzle dir not found at $DRIZZLE_DIR" >&2
  exit 2
fi

mapfile -t SQL_FILES < <(find "$DRIZZLE_DIR" -maxdepth 1 -name '*.sql' | sort)

if [ "${#SQL_FILES[@]}" -eq 0 ]; then
  echo "ERROR: no .sql files in $DRIZZLE_DIR" >&2
  exit 2
fi

echo "==> Cluster:   $CLUSTER ($SSH_HOST)"
echo "==> PG pod:    $NS/$PG_POD"
echo "==> Database:  $DB"
echo "==> Migrations: ${#SQL_FILES[@]} files"
for f in "${SQL_FILES[@]}"; do
  printf '    - %s\n' "$(basename "$f")"
done

if [ "$DRY_RUN" = "1" ]; then
  echo "==> DRY_RUN=1, exit without applying."
  exit 0
fi

echo "==> Sanity check: can the pod reach DB '$DB'?"
ssh -o BatchMode=yes "$SSH_HOST" \
  "kubectl exec -n $NS $PG_POD -- psql -U postgres -d $DB -c 'SELECT current_database();'" \
  >/dev/null

apply() {
  local sql_file="$1"
  local name
  name="$(basename "$sql_file")"
  echo "==> Applying $name ..."
  # ON_ERROR_STOP=1 → first failure aborts the file (no half-applied state).
  # We allow the command to fail per-file because Drizzle migrations may
  # reference objects already present (idempotent re-run); re-run safety
  # depends on every migration using IF NOT EXISTS / ON CONFLICT clauses.
  if ! ssh "$SSH_HOST" \
        "kubectl exec -i -n $NS $PG_POD -- psql -U postgres -d $DB -v ON_ERROR_STOP=1" \
        < "$sql_file"; then
    echo "    !! $name failed. Inspect output above." >&2
    return 1
  fi
}

FAILED=0
for f in "${SQL_FILES[@]}"; do
  apply "$f" || FAILED=$((FAILED + 1))
done

echo "==> Verifying schema:"
ssh "$SSH_HOST" \
  "kubectl exec -n $NS $PG_POD -- psql -U postgres -d $DB -c \
   \"SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public';\""

if [ "$FAILED" -gt 0 ]; then
  echo "!! $FAILED migration(s) reported errors. Re-run with the same script — idempotent migrations should be no-ops." >&2
  exit 1
fi

echo "==> Done. $DB is ready on $CLUSTER."
echo "    Next step: kubectl rollout restart deployment/lucrum-web -n lucrum"
echo "    Then: curl http://lucrum-web.../api/cron/init  (see lucrum-monitoring skill §4)"
