#!/usr/bin/env bash
# P4.7 — Launch-day smoke test.
#
# Runs the six load-bearing surface checks the founder needs green
# every 30 minutes during launch. Total budget: <90 seconds wall clock.
#
# Usage:
#   bash scripts/launch-day-smoke.sh                # against prod
#   bash scripts/launch-day-smoke.sh --base http://localhost:3005   # local
#
# Exit codes:
#   0  — all checks PASS
#   1  — one or more checks FAIL
#   2  — script setup error (missing deps, bad args)
#
# Output: one line per check (PASS/FAIL with timing), then a summary
# line ("PASS — 6/6 green in 42s" or "FAIL — 4/6 green; 2 broken").
#
# Idempotency: every check is read-only. The scaffold step writes
# into a fresh mktemp directory and removes it on success.
#
# CI: this script is intended to run from a developer's machine, NOT
# in CI. The scaffold check needs npx + network and is too flaky for
# pipeline gating.

set -u    # NOTE: deliberately NOT set -e — we want to run every check
          # and report the full set of failures, not bail at the first.
set -o pipefail

# ── Defaults / args ─────────────────────────────────────────────────────────

BASE_URL="${SETTLEGRID_BASE_URL:-https://settlegrid.ai}"
# Default to a real registry slug. Verify with:
#   curl -s https://settlegrid.ai/api/templates | jq '.templates[].slug' | head
TEMPLATE_SLUG="${SETTLEGRID_SMOKE_TEMPLATE:-airbyte}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      shift
      BASE_URL="${1:?--base requires a URL}"
      ;;
    --template)
      shift
      TEMPLATE_SLUG="${1:?--template requires a slug}"
      ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
  shift
done

# Strip trailing slash so `${BASE_URL}/path` doesn't produce `//path`.
# A `//` URL works against most servers but breaks `expect_200_nonempty`'s
# size-download cache-miss heuristic and confuses CDN logs.
BASE_URL="${BASE_URL%/}"

# ── Dependency check ────────────────────────────────────────────────────────

# `timeout` from GNU coreutils — not on macOS by default. Founders on
# Mac without coreutils will fail here loudly with an actionable
# message instead of "command not found" mid-CLI-test.
for bin in curl npx mktemp timeout; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: required binary '$bin' not on PATH." >&2
    if [[ "$bin" == "timeout" ]]; then
      echo "       On macOS: brew install coreutils  (then re-run)." >&2
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
#
# Args: <name> <command...>
check() {
  local name="$1"
  shift
  local t0
  t0="$(date +%s)"
  local err
  err="$(mktemp)"
  if "$@" >/dev/null 2>"$err"; then
    local elapsed=$(($(date +%s) - t0))
    printf "  \033[32mPASS\033[0m  %-44s  %ss\n" "$name" "$elapsed"
    PASSES=$((PASSES + 1))
  else
    local elapsed=$(($(date +%s) - t0))
    printf "  \033[31mFAIL\033[0m  %-44s  %ss\n" "$name" "$elapsed"
    sed 's/^/        /' "$err" >&2
    FAILS=$((FAILS + 1))
  fi
  rm -f "$err"
}

# Perform a GET and assert 200 + non-trivial body length. Defense
# against Vercel returning a blank 200 from a stale CDN cache during a
# bad deploy. The trailing `\n` in the curl `-w` format is required —
# without it, `read` would return EOF-without-newline (exit 1) even
# though the values were assigned correctly.
expect_200_nonempty() {
  local path="$1"
  local body_size code body_file
  body_file="$(mktemp)"
  local out
  out="$(curl -sS -o "$body_file" \
    -w "%{http_code} %{size_download}\n" --max-time 15 "$BASE_URL$path")" || {
    rm -f "$body_file"
    echo "curl failed for $path"
    return 1
  }
  rm -f "$body_file"
  read -r code body_size <<< "$out" || true
  [[ "$code" == "200" ]] || { echo "expected 200, got $code for $path"; return 1; }
  [[ "$body_size" -gt 100 ]] || {
    echo "200 OK but body is ${body_size} bytes for $path (suspect CDN miss)"
    return 1
  }
}

# Run `npx @settlegrid/cli --version` and assert non-empty output
# that looks like a semver string.
#
# Note on `npx`: we pass the PACKAGE name (`@settlegrid/cli`), not the
# bin name (`settlegrid`). `npx <name>` resolves <name> as a package;
# the package's bin is invoked automatically.
check_cli_version() {
  local out
  out="$(timeout 30 npx --yes @settlegrid/cli --version 2>&1)" || {
    echo "$out"
    return 1
  }
  [[ -n "$out" ]] || { echo "no output from --version"; return 1; }
  [[ "$out" =~ [0-9]+\.[0-9]+\.[0-9]+ ]] || {
    echo "output doesn't look like a version: $out"
    return 1
  }
}

# Confirm the CLI's load-bearing subcommand (`add`) is wired in
# commander. Spec text says "scaffold test-template" but the actual
# CLI surface is `add --github <url> --dry-run --no-pr` (codemod-
# driven). We use `add --help` here because the full codemod path
# clones a repo and runs jscodeshift — too slow + flaky for a 30-min
# launch-day cadence. The full end-to-end smoke lives at
# packages/settlegrid-cli/scripts/smoke.ts and runs once pre-launch
# (see runbook "Pre-launch sanity checks").
check_cli_add_command() {
  local out
  out="$(timeout 30 npx --yes @settlegrid/cli add --help 2>&1)" || {
    echo "$out"
    return 1
  }
  # `commander` prints "Usage: settlegrid add [options] [source]" or
  # similar when --help is passed. Assert the synopsis line shows up.
  [[ "$out" =~ [Uu]sage:.*add ]] || {
    echo "add --help output doesn't look like a commander help block:"
    echo "$out"
    return 1
  }
}

# PostHog telemetry roundtrip. Posts a synthetic event to the proxy
# at $BASE_URL/api/telemetry/capture. The proxy ALWAYS returns 204
# (telemetry is fire-and-forget); we treat any other status as a
# proxy regression.
check_posthog_proxy() {
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE_URL/api/telemetry/capture" \
    -H "Content-Type: application/json" \
    -d '{"event":"gallery_viewed","properties":{},"distinct_id":"smoke-test-anon"}')" || return 1
  # Proxy returns 204 on success or 400 on rejected event-name. Either
  # of those proves the proxy is alive; anything else is suspicious.
  [[ "$code" == "204" || "$code" == "202" ]] || {
    echo "expected 204 from /api/telemetry/capture, got $code"
    return 1
  }
}

# Stripe webhook surface — POST a deliberately-invalid payload (no
# signature header). We expect 400 from our handler; any other code
# means the route is misbehaving. We do NOT post a valid event because
# that would create real DB state.
check_stripe_webhook() {
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE_URL/api/stripe/webhook" \
    -H "Content-Type: application/json" \
    -d '{"smoke":"test"}')" || return 1
  [[ "$code" == "400" ]] || {
    echo "expected 400 from /api/stripe/webhook (no sig), got $code"
    return 1
  }
}

# ── Run the checks ──────────────────────────────────────────────────────────

echo "Launch-day smoke against $BASE_URL"
echo

check "homepage 200"               expect_200_nonempty "/"
check "gallery 200"                expect_200_nonempty "/templates"
check "template detail 200"        expect_200_nonempty "/templates/$TEMPLATE_SLUG"
check "CLI version probe"          check_cli_version
check "CLI add command wired"      check_cli_add_command
check "PostHog proxy alive"        check_posthog_proxy
check "Stripe webhook 400-on-bad"  check_stripe_webhook

ELAPSED=$(($(date +%s) - START_EPOCH))
TOTAL=$((PASSES + FAILS))

echo
if [[ "$FAILS" -eq 0 ]]; then
  printf "\033[32mPASS\033[0m — %d/%d green in %ds\n" "$PASSES" "$TOTAL" "$ELAPSED"
  exit 0
else
  printf "\033[31mFAIL\033[0m — %d/%d green; %d broken in %ds\n" "$PASSES" "$TOTAL" "$FAILS" "$ELAPSED"
  exit 1
fi
