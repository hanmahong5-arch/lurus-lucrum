#!/usr/bin/env bash
# ingest-csi300.sh — Run scripts/ingest-csi300.ts inside a running lucrum-web
# pod. Pipes the script over stdin into /tmp (writable tmpfs volume), then
# executes it with bun, reusing the pod's DATABASE_URL secret.
#
# Why pipe via stdin: the pod has readOnlyRootFilesystem, so we can only
# write under /tmp. We avoid `kubectl cp` (needs an exact pod name and is
# brittle when the deployment is rolling). The pod already has `bun` and
# `pg`, so no extra deps to install.
#
# Companion to scripts/ingest-csi300.ts. See lucrum-monitoring skill §5.
#
# Usage:
#   ./ingest-csi300.sh                # → R6, 3 years
#   YEARS=5 ./ingest-csi300.sh        # → R6, 5 years
#   CLUSTER=r1 ./ingest-csi300.sh     # → R1 (legacy)
#
# Env knobs:
#   CLUSTER     r1|r6 (default r6)
#   YEARS       1..25 (default 3)
#   NS          default 'lucrum'
#   DEPLOYMENT  default 'lucrum-web'

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
YEARS="${YEARS:-3}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_FILE="$SCRIPT_DIR/ingest-csi300.ts"
[ -r "$TS_FILE" ] || { echo "ERROR: $TS_FILE not found" >&2; exit 2; }

echo "==> Cluster:    $CLUSTER ($SSH_HOST)"
echo "==> Target:     $NS/deploy/$DEPLOYMENT"
echo "==> Years:      $YEARS"
echo "==> Script:     $TS_FILE ($(wc -l < "$TS_FILE") lines)"

# Stream script into pod /tmp, then run with bun. YEARS env propagated
# through the inner sh -c.
cat "$TS_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/ingest-csi300.ts && cd /app && HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 YEARS=$YEARS bun /tmp/ingest-csi300.ts'"

echo "==> Done."
echo "    Next: trigger scheduler refresh so alpha gets recomputed:"
echo "      ssh $SSH_HOST 'kubectl -n $NS exec deploy/$DEPLOYMENT -- wget -q -O- --timeout=120 http://127.0.0.1:3000/api/cron/init'"
echo "    Note: must be 127.0.0.1, NOT localhost — busybox wget resolves"
echo "    localhost to ::1 but the Next.js server only binds 0.0.0.0/IPv4."
