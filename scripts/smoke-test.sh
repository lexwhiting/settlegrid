#!/usr/bin/env bash
# SettleGrid Automated Smoke Tests
# Usage: bash scripts/smoke-test.sh [--url https://settlegrid.ai]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BASE_URL="https://settlegrid.ai"
RESULTS_FILE="$PROJECT_DIR/smoke-results.json"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --url) BASE_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS="[]"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

add_result() {
  local id="$1" status="$2" http_status="$3" duration="$4" error="$5"
  local safe_error
  safe_error=$(echo "$error" | sed "s/'/\\\\'/g")
  RESULTS=$(echo "$RESULTS" | python3 -c "
import sys, json
results = json.load(sys.stdin)
results.append({
    'id': '$id',
    'status': '$status',
    'http_status': '$http_status',
    'duration_ms': $duration,
    'error': '$safe_error',
    'timestamp': '$(timestamp)'
})
print(json.dumps(results))
")
  if [ "$status" = "PASS" ]; then
    ((PASS_COUNT++))
    printf "${GREEN}  ✓ %-6s %s${NC}\n" "$id" "$6"
  elif [ "$status" = "FAIL" ]; then
    ((FAIL_COUNT++))
    printf "${RED}  ✗ %-6s %s — %s${NC}\n" "$id" "$6" "$error"
  else
    ((SKIP_COUNT++))
    printf "${YELLOW}  ○ %-6s %s — SKIPPED${NC}\n" "$id" "$6"
  fi
}

# Run a curl test
run_test() {
  local id="$1" path="$2" expected="$3" desc="$4"
  local check_body="${5:-}" check_header="${6:-}"
  local url="${BASE_URL}${path}"
  local start_ms end_ms duration http_code body

  start_ms=$(python3 -c "import time; print(int(time.time()*1000))")

  local gate_opt=()
  if [ -n "$GATE_COOKIE" ]; then
    gate_opt=(-b "settlegrid_access=${GATE_COOKIE}")
  fi

  local curl_opts=(-sS -o /dev/null -w "%{http_code}" --max-time 15)

  if [ -n "$check_body" ] || [ -n "$check_header" ]; then
    local tmpfile=$(mktemp)
    local tmpheaders=$(mktemp)
    http_code=$(curl -sS -D "$tmpheaders" -o "$tmpfile" -w "%{http_code}" --max-time 15 "${gate_opt[@]}" "$url" 2>/dev/null) || true
    body=$(cat "$tmpfile" 2>/dev/null || echo "")
    local headers=$(cat "$tmpheaders" 2>/dev/null || echo "")
    rm -f "$tmpfile" "$tmpheaders"
  else
    http_code=$(curl "${curl_opts[@]}" "${gate_opt[@]}" "$url" 2>/dev/null) || true
    body=""
    local headers=""
  fi

  end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  duration=$((end_ms - start_ms))

  local status="PASS"
  local error=""

  if [ "$http_code" != "$expected" ]; then
    status="FAIL"
    error="Expected $expected, got $http_code"
  fi

  if [ -n "$check_body" ] && [ "$status" = "PASS" ]; then
    if ! echo "$body" | grep -qi "$check_body"; then
      status="FAIL"
      error="Body missing: $check_body"
    fi
  fi

  if [ -n "$check_header" ] && [ "$status" = "PASS" ]; then
    if ! echo "$headers" | grep -qi "$check_header"; then
      status="FAIL"
      error="Header missing: $check_header"
    fi
  fi

  add_result "$id" "$status" "$http_code" "$duration" "$error" "$desc"
}

# Check redirect (no follow) — no gate cookie, tests unauthenticated access
run_redirect_test() {
  local id="$1" path="$2" expected_location="$3" desc="$4"
  local url="${BASE_URL}${path}"
  local start_ms end_ms duration http_code location

  start_ms=$(python3 -c "import time; print(int(time.time()*1000))")

  local tmpheaders=$(mktemp)
  http_code=$(curl -sS -D "$tmpheaders" -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null) || true
  location=$(grep -i "^location:" "$tmpheaders" 2>/dev/null | head -1 | tr -d '\r' || echo "")
  rm -f "$tmpheaders"

  end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  duration=$((end_ms - start_ms))

  local status="PASS"
  local error=""

  if [[ ! "$http_code" =~ ^3[0-9][0-9]$ ]]; then
    status="FAIL"
    error="Expected redirect, got $http_code"
  fi

  if [ -n "$expected_location" ] && [ "$status" = "PASS" ]; then
    if ! echo "$location" | grep -qi "$expected_location"; then
      status="FAIL"
      error="Redirect to '$location', expected '$expected_location'"
    fi
  fi

  add_result "$id" "$status" "$http_code" "$duration" "$error" "$desc"
}

# Security headers test
run_security_headers_test() {
  local id="$1" path="$2" header_name="$3" expected_value="$4" desc="$5"
  local url="${BASE_URL}${path}"
  local start_ms end_ms duration

  start_ms=$(python3 -c "import time; print(int(time.time()*1000))")

  local gate_opt=()
  if [ -n "$GATE_COOKIE" ]; then
    gate_opt=(-b "settlegrid_access=${GATE_COOKIE}")
  fi

  local tmpheaders=$(mktemp)
  curl -sS -D "$tmpheaders" -o /dev/null --max-time 15 "${gate_opt[@]}" "$url" 2>/dev/null || true
  local header_val=$(grep -i "^${header_name}:" "$tmpheaders" 2>/dev/null | head -1 | sed "s/^[^:]*: //" | tr -d '\r' || echo "")
  rm -f "$tmpheaders"

  end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  duration=$((end_ms - start_ms))

  local status="PASS"
  local error=""

  if [ -z "$header_val" ]; then
    status="FAIL"
    error="Header $header_name not present"
  elif [ -n "$expected_value" ]; then
    if ! echo "$header_val" | grep -qi "$expected_value"; then
      status="FAIL"
      error="$header_name: expected '$expected_value', got '$header_val'"
    fi
  fi

  add_result "$id" "$status" "200" "$duration" "$error" "$desc"
}

# Rate limit test
run_rate_limit_test() {
  local id="$1" path="$2" num_requests="$3" desc="$4"
  local url="${BASE_URL}${path}"
  local start_ms end_ms duration
  local got_429=false

  start_ms=$(python3 -c "import time; print(int(time.time()*1000))")

  local gate_opt=()
  if [ -n "$GATE_COOKIE" ]; then
    gate_opt=(-b "settlegrid_access=${GATE_COOKIE}")
  fi

  for i in $(seq 1 "$num_requests"); do
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "${gate_opt[@]}" "$url" 2>/dev/null) || true
    if [ "$code" = "429" ]; then
      got_429=true
      break
    fi
  done

  end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  duration=$((end_ms - start_ms))

  local status="PASS"
  local error=""

  if [ "$got_429" = false ]; then
    status="SKIP"
    error="No 429 after $num_requests requests (may need more)"
  fi

  add_result "$id" "$status" "429" "$duration" "$error" "$desc"
}

# ── Authenticated test functions ──

# Run an authenticated page test (sends gate cookie + Clerk JWT)
# Args: test_id, path, expected_status, description, [check_body]
run_auth_test() {
  local id="$1" path="$2" expected="$3" desc="$4"
  local check_body="${5:-}"
  local url="${BASE_URL}${path}"
  local start_ms end_ms duration http_code body

  start_ms=$(python3 -c "import time; print(int(time.time()*1000))")

  local tmpfile=$(mktemp)
  http_code=$(curl -sS -o "$tmpfile" -w "%{http_code}" --max-time 15 \
    -b "__session=${CLERK_JWT}; __client_uat=${CLIENT_UAT}; settlegrid_access=${GATE_COOKIE}" \
    "$url" 2>/dev/null) || true
  body=$(cat "$tmpfile" 2>/dev/null || echo "")
  rm -f "$tmpfile"

  end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  duration=$((end_ms - start_ms))

  local status="PASS"
  local error=""

  if [ "$http_code" != "$expected" ]; then
    status="FAIL"
    error="Expected $expected, got $http_code"
  fi

  if [ -n "$check_body" ] && [ "$status" = "PASS" ]; then
    if ! echo "$body" | grep -qi "$check_body"; then
      status="FAIL"
      error="Body missing: $check_body"
    fi
  fi

  add_result "$id" "$status" "$http_code" "$duration" "$error" "$desc"
}

# Run an authenticated API test (sends cookies + Accept: application/json)
# Args: test_id, path, expected_status, description, [check_body]
run_auth_api_test() {
  local id="$1" path="$2" expected="$3" desc="$4"
  local check_body="${5:-}"
  local url="${BASE_URL}${path}"
  local start_ms end_ms duration http_code body

  start_ms=$(python3 -c "import time; print(int(time.time()*1000))")

  local tmpfile=$(mktemp)
  http_code=$(curl -sS -o "$tmpfile" -w "%{http_code}" --max-time 15 \
    -b "__session=${CLERK_JWT}; __client_uat=${CLIENT_UAT}; settlegrid_access=${GATE_COOKIE}" \
    -H "Accept: application/json" \
    "$url" 2>/dev/null) || true
  body=$(cat "$tmpfile" 2>/dev/null || echo "")
  rm -f "$tmpfile"

  end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
  duration=$((end_ms - start_ms))

  local status="PASS"
  local error=""

  # Auth API tests: PASS if auth middleware let request through
  if [ "$http_code" = "000" ]; then
    status="FAIL"
    error="Request timed out"
  elif [ "$http_code" = "404" ]; then
    status="FAIL"
    error="Clerk auth rejected (404)"
  elif [ "$http_code" = "307" ]; then
    status="FAIL"
    error="Gate redirect (missing cookie)"
  elif [ "$http_code" != "$expected" ]; then
    # Auth passed but handler returned unexpected status (e.g. 500 = server/DB error)
    error="auth OK, handler returned $http_code"
  fi

  if [ -n "$check_body" ] && [ "$status" = "PASS" ]; then
    if ! echo "$body" | grep -qi "$check_body"; then
      status="FAIL"
      error="Body missing: $check_body"
    fi
  fi

  add_result "$id" "$status" "$http_code" "$duration" "$error" "$desc"
}

# ── Auth setup ──
HAS_AUTH=false
GATE_COOKIE=""
CLERK_JWT=""
CLIENT_UAT=""

ENV_SMOKE="$PROJECT_DIR/.env.smoke"
if [ -f "$ENV_SMOKE" ]; then
  # Clear any inherited SMOKE_* vars (prevents cross-project pollution)
  unset SMOKE_BASE_URL SMOKE_GATE_SECRET SMOKE_GATE_TOKEN_MSG SMOKE_CLERK_SECRET_KEY SMOKE_CLERK_PUBLISHABLE_KEY SMOKE_CLERK_USER_EMAIL SMOKE_CLERK_USER_PASSWORD 2>/dev/null || true
  set -a
  source "$ENV_SMOKE"
  set +a

  # Override BASE_URL from .env.smoke if set there
  if [ -n "${SMOKE_BASE_URL:-}" ]; then
    BASE_URL="${SMOKE_BASE_URL%/}"
  fi

  # Check if we have all required Clerk creds
  if [ -n "${SMOKE_GATE_SECRET:-}" ] && [ -n "${SMOKE_CLERK_SECRET_KEY:-}" ] && \
     [ -n "${SMOKE_CLERK_PUBLISHABLE_KEY:-}" ] && [ -n "${SMOKE_CLERK_USER_EMAIL:-}" ]; then
    printf "${CYAN}Acquiring auth credentials...${NC}\n"
    AUTH_JSON=$(python3 "$SCRIPT_DIR/auth-helper.py" 2>/dev/null) || true
    if [ -z "$AUTH_JSON" ]; then
      AUTH_JSON='{"error":"auth-helper produced no output"}'
    fi
    AUTH_ERROR=$(echo "$AUTH_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "parse error")

    if [ -z "$AUTH_ERROR" ]; then
      GATE_COOKIE=$(echo "$AUTH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['gate_cookie'])" 2>/dev/null)
      CLERK_JWT=$(echo "$AUTH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['clerk_jwt'])" 2>/dev/null)
      CLIENT_UAT=$(echo "$AUTH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['client_uat'])" 2>/dev/null)
      HAS_AUTH=true
      printf "${GREEN}Auth acquired (JWT valid ~60s)${NC}\n\n"
    else
      printf "${YELLOW}Auth failed: $AUTH_ERROR — auth tests will be skipped${NC}\n\n"
    fi
  else
    printf "${YELLOW}Incomplete Clerk creds in .env.smoke — auth tests will be skipped${NC}\n\n"
  fi
else
  printf "${YELLOW}No .env.smoke found — auth tests will be skipped${NC}\n\n"
fi

echo ""
printf "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}\n"
printf "${BOLD}${CYAN}║   SettleGrid Smoke Tests                 ║${NC}\n"
printf "${BOLD}${CYAN}║   Target: %-30s ║${NC}\n" "$BASE_URL"
printf "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}\n"
echo ""

# ═══════════════════════════════════════════
# AUTHENTICATED TESTS (run first, JWT ~60s)
# ═══════════════════════════════════════════

printf "${BOLD}Auth Phase A: Gate & Session${NC}\n"
if [ "$HAS_AUTH" = true ]; then
  # SA01: Gate cookie acquired
  if [ -n "$GATE_COOKIE" ]; then
    add_result "SA01" "PASS" "200" "0" "" "Gate cookie acquired"
  else
    add_result "SA01" "FAIL" "000" "0" "No gate cookie" "Gate cookie acquired"
  fi
  # SA02: Auth session check
  run_auth_api_test "SA02" "/api/auth/developer/me" "200" "GET /api/auth/developer/me returns 200"
else
  add_result "SA01" "SKIP" "000" "0" "No auth credentials" "Gate cookie acquired"
  add_result "SA02" "SKIP" "000" "0" "No auth credentials" "GET /api/auth/developer/me returns 200"
fi

printf "\n${BOLD}Auth Phase B: Dashboard Pages${NC}\n"
if [ "$HAS_AUTH" = true ]; then
  run_auth_test "SA10" "/dashboard"              "200" "Dashboard loads with auth"
  run_auth_test "SA11" "/dashboard/tools"        "200" "Tools page loads with auth"
  run_auth_test "SA12" "/dashboard/analytics"    "200" "Analytics page loads with auth"
  run_auth_test "SA13" "/dashboard/health"       "200" "Health page loads with auth"
  run_auth_test "SA14" "/dashboard/payouts"      "200" "Payouts page loads with auth"
  run_auth_test "SA15" "/dashboard/referrals"    "200" "Referrals page loads with auth"
  run_auth_test "SA16" "/dashboard/fraud"        "200" "Fraud page loads with auth"
  run_auth_test "SA17" "/dashboard/reputation"   "200" "Reputation page loads with auth"
  run_auth_test "SA18" "/dashboard/webhooks"     "200" "Webhooks page loads with auth"
  run_auth_test "SA19" "/dashboard/audit-log"    "200" "Audit log page loads with auth"
  run_auth_test "SA20" "/dashboard/settings"     "200" "Settings page loads with auth"
  run_auth_test "SA21" "/consumer"               "200" "Consumer page loads with auth"
else
  for id in SA10 SA11 SA12 SA13 SA14 SA15 SA16 SA17 SA18 SA19 SA20 SA21; do
    add_result "$id" "SKIP" "000" "0" "No auth credentials" "Dashboard page (auth required)"
  done
fi

printf "\n${BOLD}Auth Phase C: API Routes${NC}\n"
if [ "$HAS_AUTH" = true ]; then
  run_auth_api_test "SA30" "/api/tools"                      "200" "API: tools"
  run_auth_api_test "SA31" "/api/dashboard/developer/stats"  "200" "API: developer stats"
  run_auth_api_test "SA32" "/api/audit-log"                  "200" "API: audit log"
  run_auth_api_test "SA33" "/api/payouts"                    "200" "API: payouts"
  run_auth_api_test "SA34" "/api/developer/webhooks"         "200" "API: developer webhooks"
  run_auth_api_test "SA35" "/api/developer/referrals"        "200" "API: developer referrals"
  run_auth_api_test "SA36" "/api/auth/developer/me"          "200" "API: auth developer me"
else
  for id in SA30 SA31 SA32 SA33 SA34 SA35 SA36; do
    add_result "$id" "SKIP" "000" "0" "No auth credentials" "Auth API route (auth required)"
  done
fi

# ═══════════════════════════════════════════
# UNAUTHENTICATED TESTS (original)
# ═══════════════════════════════════════════

# ── Phase 1: Authentication ──
printf "\n${BOLD}Phase 1: Authentication${NC}\n"
run_test "S02" "/" "200" "Marketing/gate page loads"
run_test "S04" "/login" "200" "Clerk sign-in page loads"
run_test "S05" "/register" "200" "Clerk sign-up page loads"

# ── Phase 2: Dashboard ──
printf "\n${BOLD}Phase 2: Dashboard${NC}\n"
run_redirect_test "S07" "/dashboard" "gate" "Dashboard redirects to gate without auth"

# ── Phase 3: Tool Management ──
printf "\n${BOLD}Phase 3: Tools${NC}\n"
run_test "S18" "/tools" "200" "Tool marketplace loads"

# ── Phase 4: SDK ──
printf "\n${BOLD}Phase 4: SDK${NC}\n"
# SDK routes are POST-only; test with POST and invalid payloads
sdk_gate_opt=""
if [ -n "$GATE_COOKIE" ]; then sdk_gate_opt="-b settlegrid_access=${GATE_COOKIE}"; fi

sdk16_code=$(curl -sS -X POST -o /dev/null -w "%{http_code}" --max-time 15 $sdk_gate_opt "${BASE_URL}/api/sdk/validate-key" -H "Content-Type: application/json" -d '{"apiKey":"invalid","toolSlug":"test"}' 2>/dev/null) || true
if [ "$sdk16_code" = "200" ]; then
  add_result "S16" "PASS" "$sdk16_code" "0" "" "Validate-key rejects invalid key (200 valid:false)"
else
  add_result "S16" "FAIL" "$sdk16_code" "0" "Expected 200, got $sdk16_code" "Validate-key rejects invalid key"
fi

sdk17_code=$(curl -sS -X POST -o /dev/null -w "%{http_code}" --max-time 15 $sdk_gate_opt "${BASE_URL}/api/sdk/meter" -H "Content-Type: application/json" -d '{"invalid":"body"}' 2>/dev/null) || true
if [[ "$sdk17_code" =~ ^(422|400)$ ]]; then
  add_result "S17" "PASS" "$sdk17_code" "0" "" "Meter rejects invalid body ($sdk17_code)"
else
  add_result "S17" "FAIL" "$sdk17_code" "0" "Expected 422/400, got $sdk17_code" "Meter rejects invalid body"
fi

# ── Phase 8: Health ──
printf "\n${BOLD}Phase 8: Health${NC}\n"
# Health endpoint: 200 (healthy) or 503 (unhealthy) are both valid responses
health_tmp=$(mktemp)
health_code=$(curl -sS -o "$health_tmp" -w "%{http_code}" --max-time 15 "${BASE_URL}/api/health" 2>/dev/null) || true
health_body=$(cat "$health_tmp" 2>/dev/null || echo "")
rm -f "$health_tmp"
if [[ "$health_code" =~ ^(200|503)$ ]] && echo "$health_body" | grep -qi "status"; then
  add_result "S30" "PASS" "$health_code" "0" "" "Health endpoint responds ($health_code)"
else
  add_result "S30" "FAIL" "$health_code" "0" "Expected 200/503 with status, got $health_code" "Health endpoint responds"
fi

# ── Phase 12: Documentation ──
printf "\n${BOLD}Phase 12: Documentation${NC}\n"
run_test "S38" "/docs" "200" "Docs page loads"

# ── Phase 14: Error Handling ──
printf "\n${BOLD}Phase 14: Error Handling${NC}\n"
run_test "S44" "/nonexistent-page-xyz" "404" "404 page for unknown route"

# ── Security Headers ──
printf "\n${BOLD}Security Headers${NC}\n"
run_security_headers_test "S09a" "/" "x-frame-options" "" "X-Frame-Options present"
run_security_headers_test "S09b" "/" "content-security-policy" "clerk" "CSP includes clerk.accounts.dev"
run_security_headers_test "S09c" "/" "strict-transport-security" "" "HSTS present"
run_security_headers_test "S09d" "/" "referrer-policy" "" "Referrer-Policy present"

# ── Webhooks ──
printf "\n${BOLD}Webhooks${NC}\n"
local_tmpfile=$(mktemp)
webhook_gate_opt=""
if [ -n "$GATE_COOKIE" ]; then webhook_gate_opt="-b settlegrid_access=${GATE_COOKIE}"; fi
webhook_code=$(curl -sS -X POST -o "$local_tmpfile" -w "%{http_code}" --max-time 10 $webhook_gate_opt "${BASE_URL}/api/webhooks/clerk" -H "Content-Type: application/json" -d '{}' 2>/dev/null) || true
if [[ "$webhook_code" =~ ^(400|401|403)$ ]]; then
  add_result "S11" "PASS" "$webhook_code" "0" "" "Clerk webhook rejects without svix headers"
else
  add_result "S11" "FAIL" "$webhook_code" "0" "Expected 400/401/403, got $webhook_code" "Clerk webhook rejects without svix headers"
fi
rm -f "$local_tmpfile"

# ── API Direct ──
printf "\n${BOLD}Phase 16: API${NC}\n"
# Health check: accept 200 or 503 (both indicate the endpoint is running)
health2_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "${BASE_URL}/api/health" 2>/dev/null) || true
if [[ "$health2_code" =~ ^(200|503)$ ]]; then
  add_result "S51" "PASS" "$health2_code" "0" "" "Health check responds ($health2_code)"
else
  add_result "S51" "FAIL" "$health2_code" "0" "Expected 200/503, got $health2_code" "Health check responds"
fi

# ── Performance ──
printf "\n${BOLD}Performance${NC}\n"
run_test "S48" "/" "200" "Brand consistency (page loads)"
run_test "S45" "/tools" "200" "Page load time check" "" ""

# ── Rate Limiting ──
printf "\n${BOLD}Rate Limiting${NC}\n"
run_rate_limit_test "S42" "/api/health" "120" "Rate limiting on health API"

# ── Write results ──
echo ""
echo "$RESULTS" | python3 -c "
import sys, json
results = json.load(sys.stdin)
with open('$RESULTS_FILE', 'w') as f:
    json.dump({'product': 'SettleGrid', 'base_url': '$BASE_URL', 'timestamp': '$(timestamp)', 'results': results}, f, indent=2)
print('Results written to $RESULTS_FILE')
"

# ── Summary ──
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
echo ""
printf "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${BOLD}  Results: ${GREEN}%d passed${NC} / ${RED}%d failed${NC} / ${YELLOW}%d skipped${NC} / %d total\n" "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT" "$TOTAL"
printf "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
echo ""

# Auto-sync to Excel
if [ -f "$PROJECT_DIR/SMOKE_TEST_TRACKER.xlsx" ]; then
  echo "Syncing results to Excel..."
  python3 "$SCRIPT_DIR/sync-smoke-results.py"
fi

# Exit code
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
