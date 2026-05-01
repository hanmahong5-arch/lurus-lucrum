#!/usr/bin/env bash
# ingest-curated.sh — Bootstrap the curated demo universe (~50 A-shares
# from curated-symbols.ts) into the prod DB so a new user landing on
# /dashboard has real stocks to backtest.
#
# Mirrors the ingest-csi300.sh pattern (in-pod stdin pipe), but ships two
# files (curated-symbols.ts + ingest-curated.ts) since the ingest script
# imports the symbol list as a sibling module. Both land in /tmp and bun
# resolves the relative import there.
#
# Why pipe-via-stdin instead of `kubectl cp`: the readOnlyRootFilesystem
# pod only has /tmp writable, and `kubectl cp` is brittle when the
# deployment is rolling. Two `kubectl exec -i` round-trips is the cheapest
# correct path. Total runtime ~3-8 minutes depending on EastMoney response
# times and network jitter.
#
# Usage:
#   ./ingest-curated.sh                          # → R6, 3 years, conc=3
#   YEARS=5 CONCURRENCY=2 ./ingest-curated.sh    # → R6, 5 years, slow
#   CLUSTER=r1 ./ingest-curated.sh               # → R1 (legacy)
#
# Env knobs:
#   CLUSTER       r1|r6        (default r6)
#   YEARS         1..25        (default 3)
#   CONCURRENCY   1..10        (default 3 — keep low to avoid EastMoney 429)
#   NS            namespace    (default 'lucrum')
#   DEPLOYMENT    deploy name  (default 'lucrum-web')

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
YEARS="${YEARS:-3}"
CONCURRENCY="${CONCURRENCY:-3}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYMBOLS_FILE="$SCRIPT_DIR/curated-symbols.ts"
INGEST_FILE="$SCRIPT_DIR/ingest-curated.ts"

[ -r "$SYMBOLS_FILE" ] || { echo "ERROR: $SYMBOLS_FILE not found" >&2; exit 2; }
[ -r "$INGEST_FILE" ]  || { echo "ERROR: $INGEST_FILE not found"  >&2; exit 2; }

echo "==> Cluster:      $CLUSTER ($SSH_HOST)"
echo "==> Target:       $NS/deploy/$DEPLOYMENT"
echo "==> Years:        $YEARS"
echo "==> Concurrency:  $CONCURRENCY"
echo "==> Files:"
echo "    - curated-symbols.ts ($(wc -l < "$SYMBOLS_FILE") lines)"
echo "    - ingest-curated.ts  ($(wc -l < "$INGEST_FILE") lines)"

# Pipe via base64. `cat | ssh | kubectl exec -i 'cat > /tmp/x'` truncated to
# 0 bytes intermittently (likely a stdin-flush race in kubectl exec). Base64
# round-trip is reliable across the same pipeline and survives the same
# buffering quirks. The cost is ~33% bandwidth — on a 10 KB script, 5 ms.

# Step 1: drop curated-symbols.ts into the pod's /tmp (sibling of the
# script for relative import resolution).
echo "==> [1/2] uploading curated-symbols.ts..."
base64 -w0 "$SYMBOLS_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/curated-symbols.b64 && base64 -d /tmp/curated-symbols.b64 > /tmp/curated-symbols.ts && rm /tmp/curated-symbols.b64'"

# Step 2: drop ingest-curated.ts and run it. cd /tmp so `./curated-symbols`
# resolves to /tmp/curated-symbols.ts. Bun cache env mirrors ingest-csi300.sh
# (writable cache dirs under runAsUser=65534 + readOnlyRootFilesystem).
echo "==> [2/2] uploading ingest-curated.ts and executing..."
base64 -w0 "$INGEST_FILE" | ssh "$SSH_HOST" \
  "kubectl -n $NS exec -i deploy/$DEPLOYMENT -- sh -c \
    'cat > /tmp/ingest-curated.b64 && base64 -d /tmp/ingest-curated.b64 > /tmp/ingest-curated.ts && rm /tmp/ingest-curated.b64 && \
     cd /tmp && \
     HOME=/tmp XDG_CACHE_HOME=/tmp BUN_INSTALL_CACHE_DIR=/tmp BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
     YEARS=$YEARS CONCURRENCY=$CONCURRENCY bun /tmp/ingest-curated.ts'"

echo "==> Done."
echo
echo "==> Verify the result:"
echo "      ssh $SSH_HOST 'kubectl -n $NS exec deploy/$DEPLOYMENT -- bun -e \"import { Pool } from pg; const p = new Pool({ connectionString: process.env.DATABASE_URL }); p.query(\\\"SELECT count(*) FROM stocks\\\").then(r => console.log(r.rows));\"'"
echo
echo "==> Smoke-test the magic-moment flow:"
echo "      Open https://lucrum.lurus.cn/dashboard, generate a strategy, run a backtest."
