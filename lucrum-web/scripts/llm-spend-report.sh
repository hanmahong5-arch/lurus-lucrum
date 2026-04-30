#!/usr/bin/env bash
# llm-spend-report.sh — pull `kind:"llm.call"` telemetry from a live
# lucrum-web deployment, pipe through scripts/llm-spend-report.ts, and
# print a spend / health table grouped by caller (default).
#
# Usage:
#   ./llm-spend-report.sh                    # R6, last 1h, group=caller
#   SINCE=24h ./llm-spend-report.sh          # last 24h
#   GROUP=taskClass ./llm-spend-report.sh    # group by task class
#   FILTER=advisor ./llm-spend-report.sh     # caller-substring filter
#   FORMAT=json ./llm-spend-report.sh        # raw JSON output
#   CLUSTER=r1 ./llm-spend-report.sh         # query R1 (legacy prod)
#
# Notes:
# - Pulls *current pod* logs only (kubectl logs is per-pod). For multi-pod
#   deployments you'd want loki-style aggregation; for now lucrum-web runs
#   single-pod so this is fine.
# - SINCE feeds `kubectl logs --since=...`. Use Go-duration syntax
#   (e.g. 30m / 1h / 24h / 168h). Default: 1h.
# - LIMIT is forwarded to the TS script (default 20 rows in table mode).

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
SINCE="${SINCE:-1h}"
GROUP="${GROUP:-caller}"
FORMAT="${FORMAT:-table}"
LIMIT="${LIMIT:-20}"
FILTER="${FILTER:-}"
CLASS_FILTER="${CLASS_FILTER:-}"

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_SCRIPT="$SCRIPT_DIR/llm-spend-report.ts"
[ -r "$TS_SCRIPT" ] || { echo "ERROR: $TS_SCRIPT not found" >&2; exit 2; }

# Build the TS-side argv from env knobs.
ARGS=(--group "$GROUP" --limit "$LIMIT")
[ "$FORMAT" = "json" ] && ARGS+=(--json)
[ -n "$FILTER" ] && ARGS+=(--filter "$FILTER")
[ -n "$CLASS_FILTER" ] && ARGS+=(--class "$CLASS_FILTER")

echo "==> Cluster:    $CLUSTER ($SSH_HOST)" >&2
echo "==> Target:     $NS/deploy/$DEPLOYMENT (since=$SINCE)" >&2
echo "==> Group:      $GROUP" >&2
[ -n "$FILTER" ] && echo "==> Filter:     $FILTER" >&2

# Pull logs over ssh (server-side filtering with grep keeps the wire payload
# small — typical lucrum-web stdout is mostly Next.js noise, not telemetry).
ssh "$SSH_HOST" \
  "kubectl -n $NS logs deploy/$DEPLOYMENT --since=$SINCE 2>/dev/null | grep '\"kind\":\"llm.call\"'" \
  | bun run "$TS_SCRIPT" "${ARGS[@]}"
