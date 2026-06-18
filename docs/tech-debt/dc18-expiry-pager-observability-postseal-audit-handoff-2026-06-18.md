# DC-18 expiry-pager observability — ③ POST-SEAL DEEP AUDIT HANDOFF (2026-06-18)

> Standalone handoff for the FRESH ③ audit. READ THIS FIRST. The chunk is BUILT, the executable
> gate is GREEN, and ② SEAL-GATING REVIEW SEALED it (operator /seal-go, 2026-06-18). ③ is the
> post-seal **integrated-whole** deep audit for this high-stakes chunk: re-audit the sealed change
> in the context of the whole system, assuming a defect survived ②. The seal STANDS unless ③
> exhibits a sustained high/med defect that ② missed — then route to the recovery loop.
> Repo: `/Users/lex/settlegrid` (npm monorepo; gate from `apps/web`).

## 0. The sealed subject (do NOT re-derive — verify against source)
- **File:** `apps/web/src/lib/settlement/reconcile.ts` — `runExpiryPass` (`:558-801`). Sealed shasum
  **`9f10ae820f9c462a8823e3b6b4166f60a00e794bf702ca3c13b9203ecaf7ba34`** (assert it is unchanged before
  auditing; a different shasum ⇒ the tree drifted post-seal — stop and report).
- **What it does:** replaces the pass-GLOBAL `reconcile.expiry_anchor_degraded` pager predicate
  (`terminalized===0 && quarantined===0 && unknown>0`, payload `{...stats}`, no network field) with a
  PER-NETWORK one. `ExpiryPassStats.unknown` is split into `unknownAnchor` (step-3.5 safe-head read
  null, `:661-665`) + `unknownNonce` (step-4 block-pinned nonce read 'unknown', `:684-688`). A lazy
  `byNetwork: Map<string, NetworkExpiryBucket>` is bucketed at the SIX canonical outcome sites
  (`:638,647,664,687,703,723`) and the emit loop (`:773-784`) pages network N iff
  `b.terminalized===0 && b.quarantined===0 && (b.unknownAnchor + b.unknownNonce) > 0`, one line per
  degraded network with `{network, terminalized, quarantined, unknownAnchor, unknownNonce, unknown}`.
  The `reconcile.expiry_pass` INFO feed (`:790-798`) retains flat `unknown` and ADDS the split +
  `byNetwork`.
- **In-scope diff:** `reconcile.ts` + `reconcile.test.ts` (re-keyed R-V31/R-V24; new R-V32/33/34/35) +
  `docs/tech-debt/v-pending-lifecycle-runbook-2026-06-12.md` (DC-15 sync). **EXCLUDED:**
  `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (uncommitted out-of-scope slugify
  carry-forward — leave untouched, EXCLUDE at founder-close).

## 1. ② evidence to build on (read, don't repeat)
`docs/tech-debt/dc18-expiry-pager-observability-seal-review-2026-06-18.md` — the ② outcome. ZERO
high/med; 5 lens-distinct fresh-context reviewers (correctness/core-invariant · alert-fatigue +
money-safety · SEAM · literal-execution · §6-conformance + test-fidelity) all `claude-opus-4-8[1m]`,
converged; integrator live revert→RED non-vacuity proven (revert reconcile.ts→HEAD reddens EXACTLY
the 6 DC-18 pins, restore → 70/70 GREEN). Gate: tsc 0 · lint 0err/8warn · vitest 197f/4576t/0fail.

## 2. ③ scope — the INTEGRATED whole (where ② could not look)
② audited the BUILT diff in isolation. ③ audits the change embedded in the running system:
- **Pager → cron → alerting surface end-to-end:** `runExpiryPass` ⊂ `reconcilePendingSettlements`
  (return discarded at `:1031`) ⊂ the cron `api/cron/settlement-reconcile/route.ts` (stateless,
  `maxDuration=60`, every 15 min) → `logger.error` → Sentry. Does the per-network page reach an
  operator at a level/shape distinguishable from routine, across the WHOLE path (logger reserved-key
  handling, Sentry `extra`, any downstream alert rule keyed on the OLD `{...stats}` shape — esp. the
  dropped flat `examined` on the page payload)? Cross-reference the (W)-② and (U)-② DC-18 ledger
  folds (logger spread-fix; the WARN-carrier-not-mirrored-to-Sentry class).
- **Multi-network reality:** the de-mask's whole point is mainnet+testnet in one pass. Audit the two
  canonical networks (`eip155:8453`, `eip155:84532`) against the real RPC plumbing
  (`readSafeBlockTimestampBounded`/`readAuthorizationStateBounded`, the per-network `chainTsByNetwork`
  cache) — can a real degradation pattern produce a page shape the runbook's triage doesn't cover?
- **The accepted residual, integrated:** intra-network quarantine co-occurrence suppresses that
  network's page for ≤1-2 passes (drains via `expiryClass` exiting the SELECT `:595`; `pending_overdue`
  ≤6h backstop). Re-confirm the drain + backstop hold in the integrated candidate-selection + overdue
  paths; confirm it is genuinely bounded, not a sustained blind spot.
- **DC-05 multi-network rig fidelity, integrated:** the de-masking pin depends on the mock rig
  diverging per network (`mockChainTs`/`mockNonceState` → `mockImplementation((network)=>…)`). Re-audit
  that the rig faithfully models the real two-network behavior and the pins aren't passing on a rig
  artifact that the real code wouldn't reproduce.
- **Collective-miss critic:** what did all 5 ② lenses + the integrator NOT look at? (a modality not
  run, a claim unverified, an adjacent surface — the cron summary `(S)` invariant, the
  `pending_overdue` detector, `markSettlementExpiredNoBroadcast`.)

## 3. Frozen / unchanged (do NOT perturb — assert, don't edit)
Everything in `reconcile.ts` except the `ExpiryPassStats`/`NetworkExpiryBucket` shapes + the
`runExpiryPass` pager/telemetry block (`:740-799`) + the per-network bucketing at the existing
`stats.*++` sites: the candidate SELECT + ordering, the decidability gates, `quarantineClassify` + its
truth-CAS, the terminalize/`markSettlementExpiredNoBroadcast` evidence-CAS, the
`reconcile.expired_nonce_consumed_quarantined` detection win, the LB-2 incomplete-evidence-stays-pending
rule (`:665`/`:688` continues), the V-N4 block-pin (`:683` nonce read pinned to `chainTs.blockNumber`),
the `ReconcileSummary` `(S)` invariant, the cron `done` summary, the `pending_overdue` overdue alert.
**Money-safety is an INVARIANT to assert, not to change:** no flip/credit/terminalize/quarantine
DECISION is edited. **Do NOT** fold in the other DC-18 ledger items (dashboard rounding, OFAC log-level,
telemetry SQL casts, CSP, CLI-in-CI), touch `packages/mcp`, add a migration/DB/KV, or de-mask the
accepted intra-network-quarantine residual. `tools/page.tsx` stays untouched + excluded.

## 4. Gate (re-run clean+isolated; vitest from apps/web — NOT repo root)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (8 pre-existing
warns) · vitest **197 / 4576 / 0**. ${PIPESTATUS} is empty under zsh — read the summary lines.
**Gotcha (cost me a false RED in ②):** running vitest from the repo root fails collection with
`Failed to load url @/lib/env` (path-alias unresolved) — that is a harness error, NOT a real failure.
Always run from `apps/web`.

## 5. Policy (Canonical block applies)
Env was clean at ② (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL all UNSET) — re-assert at ③ phase-start.
Path-1 mixed-effort needs a pre-existing effort-bearing subagent pool (absent at ②). ③ is a LARGE
integrated-whole fan-out — the proactive-opt-in workflow carve-out materially applies (off-context
findings keep the integrator context clean for the census + schema-validated retry); recommend the
WORKFLOW path for ③ IF the operator opts in, with the optional `max` collective-miss critic split out
as a Path-2 operator `/effort max` pass AFTER the xhigh workflow (workflow runs one session effort).
Allowlist: the integrator's gate/repro Bash (git/tsc/vitest/lint) is in caps; a `cd`-prefixed gate
auto-denies in background spawns — keep gate/repro integrator-side. The seal/verdict stays in the main
session.

## 6. Next after ③
- ③ SEAL STANDS → founder-close: path-scoped LOCAL commit of the 3 in-scope files (`reconcile.ts`,
  `reconcile.test.ts`, `v-pending-lifecycle-runbook-2026-06-12.md`) — **EXCLUDE `tools/page.tsx`** — then
  `/push-go` (separate explicit gate; push is NOT done before then).
- ③ exhibits a sustained high/med ② missed → recovery loop → back to build.
