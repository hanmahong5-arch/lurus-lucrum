#!/usr/bin/env bash
# rollout-llm-secret.sh — Inject LLM_API_KEY into the cluster's lucrum-secrets
# and roll the lucrum-web deployment.
#
# Companion to scripts/smoke-llm-router.ts. Run after Tailscale SSH is
# authenticated and the new image (with the LLM router) is in GHCR.
#
# Usage:
#   LLM_API_KEY=<lucrum-router-token> ./rollout-llm-secret.sh        # → R6
#   CLUSTER=r1 LLM_API_KEY=...        ./rollout-llm-secret.sh        # → R1
#
# Why this exists: kubectl-patching a Secret by hand involves base64 + JSON
# escaping that is easy to bungle. Productizing the recipe means the next
# token rotation (or a fresh cluster bootstrap) is one command, not a paste.

set -euo pipefail

CLUSTER="${CLUSTER:-r6}"
NS="${NS:-lucrum}"
DEPLOYMENT="${DEPLOYMENT:-lucrum-web}"
SECRET="${SECRET:-lucrum-secrets}"
KEY_FIELD="${KEY_FIELD:-LLM_API_KEY}"

if [ -z "${LLM_API_KEY:-}" ]; then
  echo "ERROR: LLM_API_KEY env var is required (the lucrum-router token)." >&2
  exit 2
fi

case "$CLUSTER" in
  r1) SSH_HOST="${SSH_HOST:-root@100.98.57.55}" ;;
  r6) SSH_HOST="${SSH_HOST:-root@100.122.83.20}" ;;
  *)
    [ -n "${SSH_HOST:-}" ] || { echo "ERROR: unknown CLUSTER='$CLUSTER'. Set SSH_HOST." >&2; exit 2; }
    ;;
esac

# Base64 the token *without* the trailing newline that bash adds.
TOKEN_B64=$(printf '%s' "$LLM_API_KEY" | base64 -w0)

echo "==> Cluster:    $CLUSTER ($SSH_HOST)"
echo "==> Secret:     $NS/$SECRET (field: $KEY_FIELD)"
echo "==> Deployment: $NS/$DEPLOYMENT"
echo "==> Token:      ${LLM_API_KEY:0:6}… ($((${#LLM_API_KEY})) chars)"

# Patch the secret. add+replace are equivalent in JSON-Patch when the path
# already exists; using `add` with the same path is idempotent here.
ssh "$SSH_HOST" \
  "kubectl -n $NS patch secret $SECRET --type=json \
    -p='[{\"op\":\"add\",\"path\":\"/data/$KEY_FIELD\",\"value\":\"$TOKEN_B64\"}]'"

# Verify
echo "==> Verifying secret round-trip…"
PREVIEW=$(ssh "$SSH_HOST" \
  "kubectl -n $NS get secret $SECRET -o jsonpath='{.data.$KEY_FIELD}'" | base64 -d | head -c 6)
if [ "$PREVIEW" != "${LLM_API_KEY:0:6}" ]; then
  echo "!! Secret round-trip mismatch (got '$PREVIEW…', expected '${LLM_API_KEY:0:6}…')." >&2
  exit 1
fi
echo "    ✓ secret matches."

echo "==> Rolling deployment…"
ssh "$SSH_HOST" "kubectl -n $NS rollout restart deploy/$DEPLOYMENT"
ssh "$SSH_HOST" "kubectl -n $NS rollout status  deploy/$DEPLOYMENT --timeout=180s"

echo "==> Done. Next step: smoke check"
echo "    LLM_API_KEY='$LLM_API_KEY' bun run scripts/smoke-llm-router.ts"
