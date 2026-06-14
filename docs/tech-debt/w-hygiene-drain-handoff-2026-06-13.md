# (W) — ops/hygiene DRAIN — ① HANDOFF (scope-confirmed + pre-build audit CLOSED 0-blocking, 2026-06-13)

> **① of the ARC.** Scope-confirm + the INCREMENTAL pre-build audit/triage (`wf_f3eec9b1-1c2`, 4 opus
> agents, single-pass) are DONE and CLOSED in this session — the locked scope below IS the plan; no build
> code exists yet. **TIER = INCREMENTAL** (criteria below). Lifecycle: scope-confirm ✓ → plan ✓ → pre-build
> audit ✓ → **BUILD (next session)** → executable gate → ② seal-gating review → seal + bookkeeping.

## Intent — why this chunk exists, who consumes it, what it enables
The deep-audit P-register (`s-deep-audit-register-2026-06-10.md`) has been drained chunk-by-chunk (P1–P3 by
(T), P4 by (U), P5 + P8(a,c,e,f,g) by (V), B1.1 banner #1 just sealed+pushed `origin/main`@`b3b1e175`). What
remains is a tail of **non-gated ops/hygiene items** mixed with **fold-on-open frozen riders**, **founder-ops**,
and the **founder-gated P9**. This chunk is the **(R)-style drain of the genuinely-buildable, non-gated subset**
— operationalizing the prior B1.1 chunk's stated "P6 ops → P7 → (G) tidies" the disciplined way. **Consumer:**
the codebase's operational health + the register itself. **What it enables:** after this drain the register
holds ONLY founder-gated items + fold-on-open riders (each waiting for its frozen surface to open), so the
next *money* chunk (B4 settlement-row attribution / B1.4-item-2 starvation) starts from a tidy base, and a real
logging bug affecting 34 call-sites stops silently corrupting structured-log keys.

## TIER = INCREMENTAL — classification + triggering criteria (record; ② may escalate)
INCREMENTAL because the locked scope touches **no** HIGH-STAKES trigger: no contract/schema/invariant change;
no security/correctness/money/PII/moat boundary; no determinism/reproducibility guarantee; **no frozen-surface
edit** (settlement/\*, the engine, ledger.ts, packages/mcp, kernel, the 402 emission, reconcile.ts — all
untouched); no new untrusted-input boundary; **no published-claim touch** (the openapi item that WOULD touch a
published claim, S-D18, is deliberately HELD — see below). The single production-code edit (`logger.ts`) is
observability infrastructure, **verified money-path-independent** (settlement logs pass zero `msg:` meta keys;
the Sentry mirror keys grouping off the positional `msg`, unchanged). Everything else is test/comment-only.

## LOCKED SCOPE — 7 IN items (the plan)
All file:line + fixes were settled against the LIVE tree by the pre-build triage (confidence noted).

1. **S-D14 — logger `emit()` lets a `{msg:…}` meta key clobber the structured key.** `apps/web/src/lib/logger.ts:30-36`.
   34 live callers pass a `msg:` meta (e.g. `cron/settlement-reconcile/route.ts:28`, `crawl-registry/route.ts:221/:250`,
   `aggregate-usage/route.ts:39`, `anomaly-detection/route.ts:51`, `weekly-report/route.ts:501`) whose human
   string overwrites the intended structured event key in the stdout JSON `msg` field.
   **Fix:** build the entry so reserved keys win — `const entry: LogEntry = { ...meta, level, msg, ts }` (spread
   `meta` FIRST, reserved keys last); keep the `err`-derived `entry.error/entry.stack` assignment AFTER the
   literal (preserves err-wins-over-meta-error). HIGH confidence; the ONLY production-code touch. **(Load-bearing — see below.)**

2. **S-D-flakes: `gas-wallet-monitor.test.ts`** (`apps/web/src/lib/settlement/__tests__/gas-wallet-monitor.test.ts`).
   The file does NOT `vi.mock('@/lib/env')` while 28 siblings do, and has no `afterEach`, so it inherits ambient/
   cached env under specific small-group pool orderings (the register's named "`@/lib/env` load" hook). **Fix:**
   `vi.mock('@/lib/env', () => ({ getBaseRpcUrl: () => undefined }))` + locally mock the `./circle-nano/settle-engine`
   `getGasWalletAddress` seam + add `afterEach`. TEST-ONLY; `classifyGasBalance` assertions unchanged. MED conf.

3. **S-D-flakes: `hop-rail-guard.test.ts`** (`apps/web/src/lib/settlement/__tests__/hop-rail-guard.test.ts`).
   Order/pool-dependent via the `:95-101` "stripe-connect" control + stripe-connect-mocking siblings. **Fix:** add
   `afterEach` (`vi.restoreAllMocks`/`vi.unstubAllEnvs`) + pin the full SUT graph (it already mocks the core six)
   so it's order-independent. TEST-ONLY; `recordHop`/`sessions.ts` NOT edited; the 5 assertions unchanged. MED conf.

4. **starvation-suite-residuals** (`apps/web/src/lib/settlement/__tests__/reconcile-starvation.test.ts`). Two
   harness-fidelity residuals: (a) soften the over-claiming header comment (`:20-23`) to state it throws only on
   an UNRECOGNIZED sql string, not a semantically-wrong-but-recognized `asc` node; (b) add a one-line residuals
   note that a non-numeric `count(*)` makes `summary.overdue` NaN→JSON-null (masquerades as "check failed").
   Both TEST-COMMENT/DOC-only, zero behavior change; `reconcile.ts` NOT touched. HIGH conf.

5. **B1.1-hygiene-a — remove the inert `cnanoApiKeySet` toggle + mock key.**
   `apps/web/src/app/api/proxy/[slug]/__tests__/circle-nano-proxy-settlement.test.ts`: delete the
   `isCircleNanoEnabled: () => H.cnanoApiKeySet` mock-factory key (`:91`), the `cnanoApiKeySet` hoisted prop
   (`:78`), its reset (`:192`), and the two `H.cnanoApiKeySet=false` lines (`:341,:378`). The `:340`/`:376`
   tests already serve via the REAL recipient gate (`SETTLEGRID_USDC_RECIPIENT` stub) — they pass identically.
   TEST-ONLY; prod no longer exports/imports `isCircleNanoEnabled` (B1.1 deleted it; 0 prod readers). HIGH conf.
   **Builder caveat:** keep the recipient-stub that drives the "API-key-unset-but-recipient-set → still serves" intent.

6. **B1.1-hygiene-b — remove the vestigial `CIRCLE_NANO_API_KEY` stub.**
   `apps/web/src/lib/__tests__/proxy-equivalence.test.ts:274` `vi.stubEnv('CIRCLE_NANO_API_KEY','cnano-test')`
   (+ trim the now-moot "vestigial…left set" clause in the `:270-273` comment). The circle-nano equivalence
   cases gate on `SETTLEGRID_USDC_RECIPIENT` (`:275`); the API-key stub is unread by prod + both test paths. HIGH conf.

7. **B1.1-hygiene-c — make the 7 stale TEST comments line-number-AGNOSTIC.** Comments citing `route.ts:472/:332`
   (live targets are `:336` unified enabledMap + `:479` legacy dispatch) at `circle-nano-proxy-settlement.test.ts:75,
   :314,:359,:361,:362,:368` and `proxy-equivalence.test.ts:170`. **Fix:** replace the brittle line numbers with
   symbolic refs ("the unified enabledMap circle-nano binding" / "the legacy dispatch gate"). TEST-comment-only.
   **⚠ EXPLICITLY EXCLUDED:** the SAME stale cites inside `route.ts:335` and `:478` — `route.ts` is the live proxy
   money-dispatch file → those 2 comments are a **fold-on-open rider** (do NOT touch route.ts in this chunk). MED-HIGH conf.

## The 1–2 LOAD-BEARING decisions (where audit judgment concentrates — "passes every test yet wrong")
1. **S-D14 — the `msg`-field semantics change across 34 sites.** The fix flips which value lands in the stdout
   JSON `msg` field (structured positional `msg` now wins over the clobbering meta). This passes the suite (tests
   don't assert the clobbered field) yet is **silently wrong if** any downstream log consumer keys off the
   *current* clobbered value, or if the spread-first form perturbs `err.error/err.stack` precedence, or if a caller
   actually relied on the meta `msg` override. The builder MUST: confirm the 34 sites' intended structured keys now
   render; confirm the `err` branch still wins; confirm Sentry grouping is unchanged (`logger.ts:65,69-72` keys off
   the positional arg). ② charges **DC-18** (observability truthfulness) + **DC-05** (if any test mocks the logger).
2. **B1.1-hygiene-c — the test-vs-route.ts boundary.** The chunk fixes the 7 TEST comments but MUST NOT touch
   `route.ts:335/:478` (the same stale cites inside the live money-route). The silent-wrong risk is **scope creep**:
   a builder "helpfully" fixing the route.ts comments edits a money-spine file and breaks the INCREMENTAL tier.
   Hard-pin: `route.ts` is byte-untouched by (W). ② charges **DC-15** (drift) + scope-discipline.

## Frozen / existing surfaces to BUILD ON (do not edit)
`apps/web/src/lib/settlement/*` (engine, `reconcile.ts`, `ledger.ts`, the two settle orchestrators
`circle-nano/settle.ts` + `x402/orchestrate.ts`); the 402 all-or-nothing emission; `packages/mcp`; kernel
circle-nano/{settle,verify}; the credit writers; pricing/payouts; **`apps/web/src/app/api/proxy/[slug]/route.ts`**
(money-dispatch — untouched by this chunk); migrations (NONE). The fixes live only in `lib/logger.ts` (prod) +
the 5 test files + 1 starvation residuals doc-note.

## EXPLICITLY HELD (do NOT pull into this chunk — reject as scope-creep)
- **S-D18** (openapi `/api/x402/verify` spec mismatch) — touches a **published API contract** (HIGH-STAKES
  trigger). Held as its own **DC-16-charged micro-fix** (the register files it under "(G) residual tidies"). The
  real fix: correct the static spec to match `x402/verify/route.ts:18-24` (paymentPayload OBJECT w/ nested
  scheme/network/payload; CAIP-2 net IDs `eip155:8453`/`84532`; add 400/429).
- **S-D16** (stale `eip155:1` advertising strings) — OUT-FROZEN; the only stale strings live in the frozen
  engine (`settlement/x402/verify.ts:262,:387`). Route/edge already corrected post-(G). Fold-on-open (2-string edit).
- **DC-07-ttl** (`SETTLE_LOCK_TTL` two literals) — OUT-FROZEN; value 100 is correct + consolidation is
  value-preserving, but the literals sit in the two FROZEN settle orchestrators (`circle-nano/settle.ts:52`,
  `x402/orchestrate.ts:51`). Fold-on-open: collapse to one shared constant when a settle orchestrator next opens;
  preflight probe I9 (`.audit/t-deep/preflight.mjs`) gates the TTL>maxDuration invariant.
- **S-D13** (`tools.totalInvocations` undercount) — OUT-MONEY (escalates): the fix writes a row in the credit
  transaction (`reconcile.ts` creditSettlement). Money chunk.
- **S-D12** (GDPR `stripeConnectStatus` + retained pending rows) — OUT-MONEY (escalates): setting the status
  changes payout-cron row selection. Money/compliance chunk.
- **S-D4/D11** (`verifyLedgerIntegrity` settlement-row offset) — OUT-FROZEN; one-line `isNull(settlementStatus)`
  fix but inside the frozen `ledger.ts:277-307`. Fold-on-open (re-check `settlement-moat.test.ts` expectations then).
- **S-D7** (reconcile-cron dead-man switch) — OUT-FOUNDER: the in-band 401 trail is done; the out-of-band liveness
  is cleanest as an external/Sentry cron monitor (code paths all hit frozen route / migration).
- **cron-modulo-dispatch-nit** (`registry-crawlers.ts:630`) — OUT-INVESTIGATE: behavior fix changes dispatch on
  inactive code; defer until S-D10 (unscheduled cron dirs) intent is resolved.
- **B1.1-hygiene-c route.ts portion** (`route.ts:335/:478` comments) — fold-on-open (money-spine file).

## Register-maintenance note (not build work)
**C4** ("`creditSettlement` tools-UPDATE no zero-row check; fold into P1") is **already CLOSED by (V)** —
`reconcile.ts:353` has the `toolRows.length===0 → toolStatUnmatched` guard (in-code "(V) C4 rider"), alert AFTER
commit (`:385`), not thrown. Mark C4 closed-by-(V) in the register at bookkeeping.

## Build baseline + gate
Build from `origin/main`@`b3b1e175` (clean tree, post-B1.1). Gate baseline: `tsc 0 · vitest 4432/191/0/0 ·
build 0 · lint 0`. This chunk should NOT change the test count materially (it removes inert test plumbing +
adds `afterEach` hooks + comment edits); the builder MAY add a small logger test pinning S-D14 (≈+1). Gate must
return green with `git diff` confined to `lib/logger.ts` + the 5 test files + the starvation residuals note.

## ② will charge: DC-18 (logger observability), DC-05 (test-double fidelity), DC-15 (comment drift) + scope-discipline (no frozen/money/published-surface touch). Ledger exists (`.audit/defect-ledger/INDEX.md`).
