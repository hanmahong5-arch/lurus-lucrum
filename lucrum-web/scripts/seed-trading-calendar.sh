#!/usr/bin/env bash
# seed-trading-calendar.sh — Run scripts/seed-trading-calendar.ts inside
# the running lucrum-web pod. Derives trading_calendar from CSI300 K-line
# dates (CSI300 has no halts so its dates ARE the trading calendar).
#
# Step 3 of the A-share ingest pipeline. Prereqs:
#   ./ingest-csi300.sh           (CSI300 K-lines exist)
#   ./bulk-backfill-klines.sh    (provides the years we care about)
#
# Usage:
#   ./seed-trading-calendar.sh                # → R6
#   CLUSTER=r1 ./seed-trading-calendar.sh     # → R1 (legacy)
#
# Env knobs:
#   CLUSTER     r1|r6 (default r6)
#   NS          default 'lucrum'
#   DEPLOYMENT  default 'lucrum-web'

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_FILE="$SCRIPT_DIR/seed-trading-calendar.ts"
[ -r "$TS_FILE" ] || { echo "ERROR: $TS_FILE not found" >&2; exit 2; }

echo "==> Cluster:    $CLUSTER ($SSH_HOST)"
echo "==> Target:     $NS/deploy/$DEPLOYMENT"
echo "==> Script:     $TS_FILE ($(wc -l < "$TS_FILE") lines)"

cat "$TS_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/seed-trading-calendar.ts && cd /app && HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 bun /tmp/seed-trading-calendar.ts'"

echo "==> Done."
echo "    Next: ./data-coverage-check.sh   (final quality report)"
