#!/usr/bin/env bash
# data-coverage-check.sh — Run scripts/data-coverage-check.ts inside the
# running lucrum-web pod. Read-only quality report — safe to run any time.
#
# Step 5 of the A-share ingest pipeline (final verification). Step 4 is the
# already-deployed daily incremental cron in lib/cron/daily-updater.ts —
# nothing to do for that other than confirm it's wired (cron at 18:00 CST
# is initialized on pod startup via /api/cron/init).
#
# Usage:
#   ./data-coverage-check.sh                # → R6
#   YEARS=3 ./data-coverage-check.sh        # → check 3y window instead of 5y
#   CLUSTER=r1 ./data-coverage-check.sh     # → R1 (legacy)
#
# Env knobs:
#   CLUSTER     r1|r6 (default r6)
#   YEARS       coverage window for the gap report (default 5)
#   NS          default 'lucrum'
#   DEPLOYMENT  default 'lucrum-web'

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
YEARS="${YEARS:-5}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_FILE="$SCRIPT_DIR/data-coverage-check.ts"
[ -r "$TS_FILE" ] || { echo "ERROR: $TS_FILE not found" >&2; exit 2; }

echo "==> Cluster:    $CLUSTER ($SSH_HOST)"
echo "==> Target:     $NS/deploy/$DEPLOYMENT"
echo "==> Window:     ${YEARS}y"
echo "==> Script:     $TS_FILE ($(wc -l < "$TS_FILE") lines)"

cat "$TS_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/data-coverage-check.ts && cd /app && HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 YEARS=$YEARS bun /tmp/data-coverage-check.ts'"

echo "==> Done."
