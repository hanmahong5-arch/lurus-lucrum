#!/usr/bin/env bash
# bootstrap-stock-list.sh — Run scripts/bootstrap-stock-list.ts inside a
# running lucrum-web pod. Pipes script over stdin into /tmp (the only
# writable path under readOnlyRootFilesystem) and executes with bun, reusing
# the pod's DATABASE_URL secret.
#
# Step 1 of the A-share data ingest pipeline. After this completes, run:
#   ./bulk-backfill-klines.sh    # 5y of OHLCV per stock
#   ./seed-trading-calendar.sh   # derive calendar from CSI300 dates
#   ./data-coverage-check.sh     # quality report
#
# Usage:
#   ./bootstrap-stock-list.sh                # → R6
#   DRY_RUN=1 ./bootstrap-stock-list.sh      # → parse only, no write
#   CLUSTER=r1 ./bootstrap-stock-list.sh     # → R1 (legacy)
#
# Env knobs:
#   CLUSTER     r1|r6 (default r6)
#   DRY_RUN     0|1 (default 0)
#   NS          default 'lucrum'
#   DEPLOYMENT  default 'lucrum-web'

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
DRY_RUN="${DRY_RUN:-0}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_FILE="$SCRIPT_DIR/bootstrap-stock-list.ts"
[ -r "$TS_FILE" ] || { echo "ERROR: $TS_FILE not found" >&2; exit 2; }

echo "==> Cluster:    $CLUSTER ($SSH_HOST)"
echo "==> Target:     $NS/deploy/$DEPLOYMENT"
echo "==> Dry run:    $DRY_RUN"
echo "==> Script:     $TS_FILE ($(wc -l < "$TS_FILE") lines)"

cat "$TS_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/bootstrap-stock-list.ts && cd /app && HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DRY_RUN=$DRY_RUN bun /tmp/bootstrap-stock-list.ts'"

echo "==> Done."
echo "    Next: ./bulk-backfill-klines.sh   (~30 min runtime, 5y × ~5000 stocks)"
