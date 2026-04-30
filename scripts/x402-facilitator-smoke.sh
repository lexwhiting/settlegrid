#!/usr/bin/env bash
# P4.MKT2 — Public x402 facilitator smoke test.
#
# Founder runs this from a non-dev machine after DNS for
# facilitator.settlegrid.ai has been provisioned (see
# docs/launch/x402-facilitator-dns-runbook.md). All three
# endpoints are exercised; the verify + settle calls use
# deliberately MALFORMED payloads so they return error envelopes
# without touching the gas wallet — running this script does not
# spend money.
#
# Usage:
#   bash scripts/x402-facilitator-smoke.sh                              # against prod
#   bash scripts/x402-facilitator-smoke.sh --base http://localhost:3005 # against local dev
#   bash scripts/x402-facilitator-smoke.sh --base https://<preview>     # against Vercel preview
#
# Exit codes:
#   0 — all 3 checks PASS
#   1 — one or more checks FAIL
#   2 — script setup error (missing deps, bad args)
#
# Wall-clock budget: <30 seconds. No retries; the founder re-runs
# manually if a transient blip is suspected.
#
# Idempotency: every check is read-only or uses an invalid payload.
# Running the script does not create any DB rows, on-chain txs, or
# Stripe activity.

set -u
set -o pipefail
# NOTE: deliberately NOT set -e — we want every check to run and
# report independently, not bail at the first failure.

# ── Defaults / args ─────────────────────────────────────────────────────────

BASE_URL="${SETTLEGRID_FACILITATOR_BASE:-https://facilitator.settlegrid.ai}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      shift
      BASE_URL="${1:?--base requires a URL}"
      ;;
    -h|--help)
      sed -n '2,28p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
  shift
done

# Strip trailing slash so paths like /v1/verify don't double-slash.
BASE_URL="${BASE_URL%/}"

# ── Dependency check ────────────────────────────────────────────────────────

# `jq` is needed to parse the /v1/supported JSON response. `curl` is the
# transport. `timeout` is from GNU coreutils (macOS users without
# Homebrew coreutils get a clear hint here, not a cryptic mid-script
# failure).
for bin in curl jq mktemp timeout; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: required binary '$bin' not on PATH." >&2
    if [[ "$bin" == "timeout" ]]; then
      echo "       On macOS: brew install coreutils  (then re-run)." >&2
    fi
    if [[ "$bin" == "jq" ]]; then
      echo "       On macOS: brew install jq  (then re-run)." >&2
    fi
    exit 2
  fi
done

# ── Helpers ─────────────────────────────────────────────────────────────────

PASSES=0
FAILS=0
START_EPOCH="$(date +%s)"

# Each `check` invocation runs a sub-script and prints PASS or FAIL with
# wall-clock timing. Stdout from the check is discarded; stderr is
# captured and shown on FAIL only.
check() {
  local name="$1"
  shift
  local t0
  t0="$(date +%s)"
  local err
  err="$(mktemp)"
  if "$@" >/dev/null 2>"$err"; then
    local elapsed=$(($(date +%s) - t0))
    printf "  \033[32mPASS\033[0m  %-52s  %ss\n" "$name" "$elapsed"
    PASSES=$((PASSES + 1))
  else
    local elapsed=$(($(date +%s) - t0))
    printf "  \033[31mFAIL\033[0m  %-52s  %ss\n" "$name" "$elapsed"
    sed 's/^/        /' "$err" >&2
    FAILS=$((FAILS + 1))
  fi
  rm -f "$err"
}

# ── Check 1: GET /v1/supported ──────────────────────────────────────────────
#
# Asserts:
#   - HTTP 200
#   - Response is JSON with a `networks` array
#   - The networks array contains EXACTLY the two day-one allowlist
#     entries (eip155:8453 + eip155:84532) — no Ethereum mainnet leak
#   - Extensions list does NOT contain `payment-identifier` (HC1)
check_supported() {
  local body code
  body="$(timeout 15 curl -sS -w "\n%{http_code}" "$BASE_URL/v1/supported")" || {
    echo "curl failed against $BASE_URL/v1/supported"
    return 1
  }
  code="$(echo "$body" | tail -n 1)"
  body="$(echo "$body" | sed '$d')"

  [[ "$code" == "200" ]] || {
    echo "expected 200 from /v1/supported, got $code"
    echo "body: $body"
    return 1
  }

  # Networks: exactly the two day-one allowlist entries, in any order.
  local got_networks
  got_networks="$(echo "$body" | jq -r '.networks | map(.network) | sort | join(",")')" || {
    echo "could not parse .networks from /v1/supported response"
    return 1
  }
  # Lexicographic sort: `eip155:8453` < `eip155:84532` (shorter
  # string is a prefix of the longer one and sorts first).
  if [[ "$got_networks" != "eip155:8453,eip155:84532" ]]; then
    echo "expected networks=[eip155:8453,eip155:84532], got: $got_networks"
    return 1
  fi

  # Extensions: must NOT contain payment-identifier (HC1 regression).
  if echo "$body" | jq -e '.extensions | index("payment-identifier")' >/dev/null 2>&1; then
    echo "/v1/supported overclaims 'payment-identifier' extension; should have been dropped per HC1"
    return 1
  fi
}

# ── Check 2: POST /v1/verify with deliberately-invalid body ────────────────
#
# We send a MISSING paymentPayload so Zod rejects with 422. This proves
# the route is alive without exercising the on-chain verify path.
# A 200 here would mean the schema isn't enforced — alarm bell.
check_verify_malformed() {
  local code
  code="$(timeout 15 curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/v1/verify" \
    -H "Content-Type: application/json" \
    -d '{"smoke":"test"}')" || {
    echo "curl failed against $BASE_URL/v1/verify"
    return 1
  }
  if [[ "$code" != "422" && "$code" != "400" ]]; then
    echo "expected 422 (Zod validation) or 400 from malformed /v1/verify, got $code"
    return 1
  fi
}

# ── Check 3: POST /v1/settle with unsupported network ──────────────────────
#
# We send a structurally-valid body with network=eip155:1 (ETH mainnet,
# NOT in the day-one allowlist). The route must reject at the boundary
# with 400 UNSUPPORTED_NETWORK before any verify or on-chain work happens.
# This is the load-bearing day-one-allowlist test.
check_settle_unsupported_network() {
  local body code
  body="$(timeout 15 curl -sS -w "\n%{http_code}" \
    -X POST "$BASE_URL/v1/settle" \
    -H "Content-Type: application/json" \
    -d '{"paymentPayload":{"scheme":"exact","network":"eip155:1","payload":{}}}')" || {
    echo "curl failed against $BASE_URL/v1/settle"
    return 1
  }
  code="$(echo "$body" | tail -n 1)"
  body="$(echo "$body" | sed '$d')"

  [[ "$code" == "400" ]] || {
    echo "expected 400 from /v1/settle for unsupported network, got $code"
    echo "body: $body"
    return 1
  }

  # The error code in the body must be UNSUPPORTED_NETWORK so we know
  # the route's allowlist fired (not, e.g., a generic Zod rejection).
  if ! echo "$body" | jq -e '.code == "UNSUPPORTED_NETWORK"' >/dev/null 2>&1; then
    echo "expected error code UNSUPPORTED_NETWORK in /v1/settle response; got body: $body"
    return 1
  fi
}

# ── Run the checks ──────────────────────────────────────────────────────────

echo "x402 facilitator smoke against $BASE_URL"
echo

check "GET /v1/supported (200 + day-one allowlist)"        check_supported
check "POST /v1/verify  (rejects malformed body)"          check_verify_malformed
check "POST /v1/settle  (rejects unsupported network)"     check_settle_unsupported_network

ELAPSED=$(($(date +%s) - START_EPOCH))
TOTAL=$((PASSES + FAILS))

echo
if [[ "$FAILS" -eq 0 ]]; then
  printf "\033[32mPASS\033[0m — %d/%d green in %ds. Cleared to flip the announcement post to published:true.\n" "$PASSES" "$TOTAL" "$ELAPSED"
  exit 0
else
  printf "\033[31mFAIL\033[0m — %d/%d green; %d broken in %ds. Do NOT flip published yet.\n" "$PASSES" "$TOTAL" "$FAILS" "$ELAPSED"
  exit 1
fi
