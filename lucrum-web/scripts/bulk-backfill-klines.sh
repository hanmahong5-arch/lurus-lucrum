#!/usr/bin/env bash
# bulk-backfill-klines.sh — Run scripts/bulk-backfill-klines.ts inside the
# running lucrum-web pod. Pulls 5y of OHLCV for every active stock and
# upserts into kline_daily.
#
# Step 2 of the A-share ingest pipeline. Prereq: bootstrap-stock-list.sh.
#
# Long-running. ~5–8 min nominal, budget 30 min. Output is streamed line by
# line; safe to disconnect your terminal — kubectl exec stays attached to
# the pod's stdin/stdout, so an SSH disconnect kills it. For unattended
# runs prefer:
#   ssh -tt root@<r6> "kubectl -n lucrum exec -i deploy/lucrum-web -- ..."
# inside `nohup` / `screen`.
#
# Usage:
#   ./bulk-backfill-klines.sh                    # → R6, 5y, all stocks
#   YEARS=3 ./bulk-backfill-klines.sh            # → 3y window
#   LIMIT=10 ./bulk-backfill-klines.sh           # → smoke test
#   SYMBOLS=600519,000858 ./bulk-backfill-klines.sh
#   FORCE=1 ./bulk-backfill-klines.sh            # ignore resume threshold
#   CONCURRENCY=4 BATCH_DELAY_MS=1000 ./bulk-backfill-klines.sh   # gentler
#
# Env knobs:
#   CLUSTER         r1|r6 (default r6)
#   YEARS           1..25 (default 5)
#   CONCURRENCY     parallel stocks per wave (default 8)
#   BATCH_DELAY_MS  pause between waves (default 500)
#   MAX_RETRIES     per-stock retry cap (default 3)
#   LIMIT           cap target stocks (default 0 = no cap)
#   SYMBOLS         comma-separated whitelist
#   FORCE           1 = ignore resume / skip-if-fresh
#   NS              default 'lucrum'
#   DEPLOYMENT      default 'lucrum-web'

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
YEARS="${YEARS:-5}"
CONCURRENCY="${CONCURRENCY:-8}"
BATCH_DELAY_MS="${BATCH_DELAY_MS:-500}"
MAX_RETRIES="${MAX_RETRIES:-3}"
LIMIT="${LIMIT:-0}"
SYMBOLS="${SYMBOLS:-}"
FORCE="${FORCE:-0}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_FILE="$SCRIPT_DIR/bulk-backfill-klines.ts"
[ -r "$TS_FILE" ] || { echo "ERROR: $TS_FILE not found" >&2; exit 2; }

echo "==> Cluster:        $CLUSTER ($SSH_HOST)"
echo "==> Target:         $NS/deploy/$DEPLOYMENT"
echo "==> Years:          $YEARS"
echo "==> Concurrency:    $CONCURRENCY (delay=${BATCH_DELAY_MS}ms, retries=$MAX_RETRIES)"
echo "==> Limit:          ${LIMIT:-none}"
echo "==> Whitelist:      ${SYMBOLS:-(all active)}"
echo "==> Force:          $FORCE"
echo "==> Script:         $TS_FILE ($(wc -l < "$TS_FILE") lines)"

# YEARS / CONCURRENCY / etc. propagate via the inner sh -c env list.
cat "$TS_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/bulk-backfill-klines.ts && cd /app && \
     HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
     YEARS=$YEARS CONCURRENCY=$CONCURRENCY BATCH_DELAY_MS=$BATCH_DELAY_MS MAX_RETRIES=$MAX_RETRIES \
     LIMIT=$LIMIT SYMBOLS=\"$SYMBOLS\" FORCE=$FORCE \
     bun /tmp/bulk-backfill-klines.ts'"

echo "==> Done."
echo "    Next: ./seed-trading-calendar.sh   (derive calendar from CSI300 dates)"
echo "          ./data-coverage-check.sh     (quality report)"
