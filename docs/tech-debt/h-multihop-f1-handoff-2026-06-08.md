# (H) multi-hop hop-route ledger extension + (F1) NAT-fairness IP-raise — CHUNK HANDOFF (2026-06-08)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a verification
> facilitator) → use `/effort max`. This chunk has **TWO workstreams** on **two different surfaces**:
> **(H)** touches the **money/settlement surface** (the unified ledger + the reconciler) → **funds-SEAL**;
> **(F1)** touches the **rate-limit security boundary** (`lib/rate-limit.ts` + a deliberate flood-posture
> loosening) → rate-limit-posture review. **TIER: HIGH-STAKES** (see §1). Full gate discipline applies:
> **scope-confirm trace → build plan → deep INDEPENDENT pre-build audit (PLAN_READY, 0 blocking, ALL
> fixes applied) BEFORE any code → single-writer build → executable gate → seal-gating review → SEAL +
> founder-gated commit.** NOTHING ships (push / prod-env / migration apply / publish) without the
> founder's explicit word.

---

## 0. Why now + scope confirmation (founder lifted the demand-gate 2026-06-08)

Both items were **demand-gated** at the close of (C) (the non-gated queue was empty). The founder has
now **explicitly selected "(H) multi-hop + F1 NAT-raise"** as the next chunk — lifting both gates. This
handoff is the scope-confirm artifact; the kicked-off session's FIRST step is a discovery **trace** that
re-derives every claim below against the live code (line numbers drift; trust nothing until re-derived).

**Source-of-truth used to derive scope (read these):**
- (H) canonical definition + the **verified reconciler-starvation trap**:
  `docs/tech-debt/next-chunk-handoff-2026-06-04-post-b4.md:118-130` (the most detailed) ·
  `next-chunk-handoff-2026-06-05-post-m.md:129-132` · `next-chunk-handoff-2026-06-05-post-h1.md:133`.
- The reconciler design + the bounded-batch + the starvation analysis:
  `docs/tech-debt/b1.4-settlement-reconciler-2026-05-31.md` (esp. §residual-starvation; per-run bound
  raised 8→25; `isNotNull(external_ref)` window).
- (F1) canonical definition + cost: `docs/tech-debt/n-authid-keying-resolution-2026-06-06.md:83-85` ·
  `n-authid-rate-limit-keying-build-plan-2026-06-05.md:281` ·
  `next-chunk-handoff-2026-06-06-post-f2.md:21`.
- The register: `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`.

### ⚠️ SCOPE DIVERGENCE the trace MUST resolve first (this is load-bearing decision #1 — see §2)
There are **two distinct settlement subsystems** in this repo, and the docs conflate them under "(H)":
- **Subsystem 1 — the UNIFIED LEDGER** (`lib/settlement/ledger.ts`: `postLedgerEntry` /
  `recordSettlementEntry` → `accounts.balanceCents`; reconciled by
  `reconcilePendingSettlements` in `lib/settlement/reconcile.ts`, run by the
  `settlement-reconcile` cron). `recordHop` **already** optionally writes here. **The
  reconciler-starvation trap lives HERE.**
- **Subsystem 2 — the SETTLEMENT BATCHES** (`workflowSessions` → `settlementBatches` →
  `developers.balanceCents` via `finalizeSession` / `processSettlementBatch`). This is the (C)
  deferred-take path; `processSettlementBatch` is **unwired** (no caller).

**Canonical (H) = Subsystem 1** (the hop-route → unified-ledger extension + the rail-enum guard;
post-B4 is unambiguous). The **post-(C) handoff** (`next-chunk-handoff-2026-06-07-post-c.md:43-48`)
loosely re-cast (H) as "wire `processSettlementBatch` / activate deferred settlement" — **Subsystem 2**.
**These are different builds.** The trace must pick ONE (recommendation: **Subsystem 1**, the canonical,
documented-trap scope; keep Subsystem 2 batch-wiring an explicit OUT / separate future item unless the
founder confirms they want the full multi-hop *balance* settlement activated too). Building the wrong
subsystem passes its own tests but is not (H).

---

## 1. TIER: **HIGH-STAKES** (record this in the plan; the later phases inherit it)

Triggering criteria met (any one suffices; multiple here):
- **Touches a money/correctness boundary** — (H) writes to the unified settlement ledger and interacts
  with the reconciler that confirms on-chain USDC settlements.
- **Adds/changes an invariant** — the **rail-enum guard** is a correctness invariant (hop ledger rows
  must never enter the reconciler's confirmable window) whose failure is a *silent* starvation at scale.
- **Edits a frozen/shared surface** — (F1) modifies `lib/rate-limit.ts` (shared by every route) and
  **deliberately loosens the flood/DoS posture** (a security-boundary change).
- **Affects the core moat + a gate** — multi-hop settlement is the documented "unique moat"; both
  workstreams move the executable suite (the funds gate + the ~84-file mock sweep).

→ **HIGH-STAKES.** The pre-build audit is the FULL lens set + adversarial verification per finding
(§5). When any sub-question is uncertain, treat it as high-stakes — under-auditing is the dangerous
error.

---

## 2. The 1–2 LOAD-BEARING design decisions most likely to be SILENTLY WRONG
> (Where the audit's judgment must concentrate — choices that pass every test yet are incorrect.)

**LB-1 — Which subsystem is (H), and does the rail-enum guard ACTUALLY keep hop rows out of the
reconciler?** Two failure modes, both green-on-tests:
  (a) *Subsystem confusion* (§0): building the batch-wiring (Subsystem 2) when canonical (H) is the
      ledger extension (Subsystem 1) — or vice-versa. Each builds tests for what it built; only a
      scope re-derivation catches it.
  (b) *Guard that compiles + tests green but doesn't change the reconciler's selection.* The trap
      (post-B4:120-125): a hop ledger row with `rail ∈ {x402, circle-nano}` + `externalRef` is
      re-SELECTed by `reconcilePendingSettlements` forever. The guard must **provably** ensure hop rows
      can never satisfy the reconciler's `WHERE` (the `isNotNull(external_ref)` oldest-first window in
      `reconcile.ts`). A guard placed at the wrong layer (e.g. validating the hop *input* enum but still
      letting a row land with an on-chain rail + externalRef), or one that omits a rail, leaves the
      starvation live — invisible until volume. The plan must show the reconciler's exact SELECT and
      prove the guarded rows are excluded by construction (ideally a test that inserts a guarded hop row
      and asserts the reconciler never selects it).
  (c) *Durability layer* (post-B4:126-128): lib-layer fire-and-forget (audit-only, no consumer —
      acceptable, but silently drops rows under load/restart) vs. route-layer durable write (mirrors
      ap2's `after()` — but **breaks recordHop's request-scope-free unit tests**, the "B2-moot
      finding"). Choosing route-layer durability without re-architecting the tests = red suite; choosing
      fire-and-forget without saying so = a silent durability claim that's false.

**LB-2 — (F1)'s threshold/keying change: does it achieve NAT-fairness WITHOUT a silent DoS regression
or an under-counted mock sweep?** `sdkLimiter = lazyLimiter(1000, '1 m')` (`lib/rate-limit.ts:100`) is
shared; session routes key `session-*:${ip}` on it. Raising the IP threshold (or adding a new
higher-limit `sessionLimiter` export) is a **deliberate flood-posture loosening** — the silently-wrong
risk is loosening *more than intended* (e.g. a per-IP raise that halves an attacker's cost on a route
that mutates session budget) so functional tests pass but the DoS/abuse boundary regresses. Second
silent failure: the plan assumes "new export → ~84-file mock sweep" but **87 test files mock
`@/lib/rate-limit`** — whether a new export actually breaks them depends on each file's mock style
(factory-enumerated exports break; `importActual`-spread do not). An under-counted sweep → red suite
mid-build; an over-broad sweep → churn. The plan must (i) enumerate the exact files that break and prove
it with a script, and (ii) state the new per-IP/NAT limit with an explicit abuse-cost analysis.

---

## 3. DECIDED-AT-TRACE scope (in / out) + SCOPE GUARD

**In scope (confirm exact shape in the trace + plan):**
1. **(H) hop-route → unified-ledger extension (Subsystem 1, recommended):** make multi-hop ledger
   attribution correct & safe — the **rail-enum guard** (exclude `{x402, circle-nano}` from hop ledger
   rows, by construction), the **durability decision** (lib fire-and-forget vs route durable — decide +
   justify), and the **missing hop API-layer test**. Funds-SEAL post-build.
2. **(F1) NAT-fairness IP-raise on the session routes:** raise the per-IP session limit (new
   `sessionLimiter` export or a re-key), with an explicit abuse-cost analysis for the flood-posture
   loosening, and the complete, script-proven test-mock sweep.
3. Docs-only: capstone, register UPDATE (close F1; record (H) disposition), next-chunk handoff, memory.

**OUT of scope (byte-stable unless the trace proves a PLANNED change requires it):** Subsystem 2 batch
settlement (`processSettlementBatch` wiring / `createSession` deferred mode / the `settlementBatches`
take math — (C) already made it take-correct; do NOT activate it here unless the founder folds it in);
the reconciler's confirm logic / on-chain settle engines / `interpretReceipt` / nonce handling;
`lib/pricing.ts` brackets/rates; `lib/payouts/**` take logic; the meter credit path;
`deductCreditsRedis` / balance authority / dedup / B4 `account_id` semantics; `lib/crypto.ts hashApiKey`
+ key formats; x402/ap2/circle-nano adapters; ALL of `packages/mcp`; ALL of `packages/sdk-python*`;
F2/F3/F4/N/M/H1/R/(C) settled designs. **Reject scope creep, gold-plating, and deferred-work pull-in —
expect none.** When in doubt, the smaller change wins; on the money surface, "provably
ledger-neutral except the one intended attribution path" is the bar.

⚠️ **The two judged calls are LB-1 and LB-2** (§2) — they are the chunk's reason to exist, judged
strictly in the plan. Everything else is behavior-neutral.

---

## 4. Ground state + pre-flight (verify before touching anything)

- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `839455fb` = `origin/main` = deployed prod**
  ((C) shipped: pushed + Vercel-deployed Ready; migration 0014 applied — `developers.revenue_share_pct`
  is **DROPPED** in prod). Confirm: `git -C /Users/lex/settlegrid status -sb && git log -3 --oneline`.
  Unlike (C), this chunk starts from a **clean, deployed `main`** — the new work is a fresh local commit
  atop it (founder-gated push/deploy at close).
- **Baselines (re-run to anchor BEFORE any edit; end-state must keep them green + only this chunk's own
  deltas):**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4283 pass / 182 files**) ·
    `npx next build` (**0**; not concurrent with tsc) · `npx eslint <changed files>` (0).
  - `cd packages/mcp`: `npx vitest run` (**1898 pass / 1 skip**) — expected byte-stable; re-run is the
    untouched-proof.
  - Python family (`packages/sdk-python*`): expected byte-stable — `git diff --numstat` is the proof.
- **DB note:** prod schema is post-0014 (no `revenue_share_pct`). The unified-ledger tables
  (`accounts`, `ledger_entries`) + `workflow_sessions` + `settlement_batches` are the (H) surface — DB
  access **read-only**; if (H) needs a schema change (e.g. a CHECK constraint enforcing the rail-enum
  guard), it is a **migration** → generated-not-applied, founder-gated, same discipline as (C)'s 0014.
- **Real-money guardrails:** do NOT push, set/change prod env, **apply** migrations, or publish (all
  founder-gated). Generating a migration FILE is fine; applying it is not.
- **Shell is zsh:** quote bracketed paths (`'apps/web/src/app/api/sessions/[id]/hop/route.ts'`).

---

## 5. THE ARC — phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code

### Phase 1 — scope-confirm DISCOVERY TRACE (no plan without it)
Write `docs/tech-debt/h-f1-trace-2026-06-08.md`. Re-derive every §0–§3 claim against the live code,
each grounded in a file:line read THIS session. Nail: **(a)** the (H) subsystem decision (LB-1a) — read
`recordHop` (`sessions.ts` ~:357-500, esp. the `recordSettlementEntryAsync` block ~:461-483),
`lib/settlement/ledger.ts`, and `reconcile.ts` end-to-end; quote the reconciler's exact SELECT/WHERE and
prove how a guarded hop row is excluded; **(b)** the rail-enum guard's correct layer + form (input
validation vs. a typed enum vs. a DB CHECK constraint) and whether a migration is needed; **(c)** the
durability decision (lib fire-and-forget vs route durable) + its test impact (the B2-moot finding);
**(d)** the exact session-route limiter wiring (`/api/sessions` + `[id]/{hop,complete,delegate,get,
finalize}`, all `sdkLimiter` `session-*:${ip}`) and the precise F1 threshold/keying change + abuse-cost;
**(e)** the EXACT test-mock-sweep set (script: which of the 87 `@/lib/rate-limit`-mocking files actually
break on the new export); **(f)** every forced test edit per touched file; **(g)** whether (H) and (F1)
ship as one chunk with two workstreams or split (recommend: one chunk, two clearly-separated
workstreams; (H) gets the funds-SEAL, F1 gets the rate-limit-posture review).

### Phase 2 — BUILD PLAN (status DRAFT until the audit passes)
Write `docs/tech-debt/h-f1-build-plan-2026-06-08.md`: goal + honest framing + the TIER (HIGH-STAKES,
§1); the trace's conclusions; the resolved LB-1/LB-2 decisions with their proofs; EXACT per-file
recipes; for (H) the **before/after ledger-flow** (worked: a hop with each rail → does/doesn't enter the
reconciler) + the guard-by-construction proof + the durability choice; for (F1) the new limit value +
the abuse-cost analysis + the script-proven mock-sweep list; any migration (generated NOT applied); the
behavior-change tests that **FAIL pre-fix** (esp. the reconciler-exclusion test + the F1 threshold test)
and the regression-guarded behavior-neutral changes; the byte-stable spine list (§3 verbatim) + embedded
SCOPE GUARD; the machine gates (apps/web tsc 0 / vitest 4283 + exact N_new / build 0 / eslint 0;
packages/mcp 1898/1; `git diff --numstat` + `git status --porcelain` confined to the in-scope files + any
ONE migration + docs); the deploy/rollout note.

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the hard gate; sized to HIGH-STAKES)
**No implementation code until the plan is audited PLAN_READY (0 blocking) with ALL fixes applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt
  `.audit/c-prebuild/prebuild-audit.mjs` → `.audit/h-prebuild/prebuild-audit.mjs` — **keep its hardened
  tail VERBATIM** (null-guard + inline degraded fallback so a dead synthesizer can never crash the run
  or fake a pass). Shape: N fresh-context lenses re-derive the plan's claims against the actual code →
  **adversarial verify** of every finding (default-refuted) → guarded synthesis at PLAN_READY / 0
  blocking.
- **MECHANICAL-FIRST (required):** BEFORE the fan-out, settle every mechanically-checkable claim with a
  **deterministic script or live probe** and feed the results in, so the agents spend only on judgment a
  script cannot make. Concretely: run the project gates (tsc/vitest/build/eslint; mcp), and write probes
  for — the exact reconciler SELECT excludes a guarded hop row (insert-and-assert); the rail-enum guard
  rejects `{x402, circle-nano}`; the F1 mock-sweep file set (`grep -l` the breaking mock style); the
  suite arithmetic. **Keep mechanical checks as scripts, not model calls.**
- **HIGH-STAKES lens set (full) — suggested ~7:** (a) **factual accuracy** (every file:line + the
  subsystem map); (b) **funds/ledger correctness** — the rail-enum guard provably excludes hop rows from
  the reconciler; no mis-credit; durability choice sound; the unified-ledger + reconciler confirm logic
  byte-stable; (c) **reconciler-starvation specifically** — adversarially construct a hop row that still
  reaches the reconciler's window; (d) **F1 security posture** — the flood-posture loosening abuse-cost
  is bounded + intended; no other limiter/route weakened; (e) **test sufficiency** — behavior-change
  tests fail pre-fix; the mock-sweep is exact; no weakened mock; arithmetic exact; (f) **scope boundary
  / zero-out-of-spine** — Subsystem 2 + pricing/payouts/meter-credit/crypto/mcp/sdk-python untouched;
  the ONLY behavior changes are the two intended ones; (g) **baseline integrity + migration safety** (if
  a migration is generated). **Run every reasoning role on the most capable model.**
- **Run twice if it finds blockers:** R1 → apply ALL fixes to the plan → R2 must be PLAN_READY
  0-blocking. **The implementer re-confirms every sustained finding LIVE before folding it; all fixes
  land before any build code.**
- **DEGRADED-RUN GUARD:** a result with `deadLenses>0` / `nullVerdicts>0` / `degraded=true` is **NOT a
  pass**. **Transient-death / session-limit recovery:** if ALL agents die there is no usable cache —
  back off (~4 min for a transient throttle) and re-run; `Workflow({scriptPath, resumeFromRunId})`
  replays cached agents after a partial death.
- **Charge each reviewer in ISOLATION** — give each lens ONLY its lens, never the cadence, the seal, or
  the existence of other phases. **Guard the spine** (reject scope creep / gold-plating / deferred-work
  pull-in). **Defer NO finding to a later phase — this phase is the last line of defense.**
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the seal):** Objective
  confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows scope is
  `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong. Hold the
  line against: activating Subsystem 2 (batch settlement / `processSettlementBatch` / deferred
  `createSession`); changing the reconciler confirm logic / on-chain settle engines / nonce handling;
  re-tuning `lib/pricing.ts` rates or `lib/payouts/**`; touching the meter credit path,
  `deductCreditsRedis`, balance authority, dedup, B4 `account_id`, `hashApiKey`/key formats,
  x402/ap2/circle-nano adapters, `packages/mcp`, `packages/sdk-python*`; re-litigating settled designs
  (F2/F4 wire, N auth.id keying, M getClientIp, H1 fail-open, R, (C) take model) without a NEW trace;
  PyPI/npm publishing. Re-opening a settled decision requires a concrete new trace.
- Record `.audit/h-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md` (mirror `.audit/c-prebuild/`).

### Phase 4 — BUILD (single-writer)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audit gates only).
Line-surgical; touch only the planned sites. Keep each batch green (per-batch tsc/vitest). Prove the
fail-pre-fix property empirically for the behavior-change tests (record to `.audit/h-build/`).

### Phase 5 — SEAL-GATING REVIEW + SEAL (0 blocking BEFORE any commit)
(H) is on the money surface → a **funds-SEAL**; (F1) → a rate-limit-posture seal. Adapt
`.audit/c-postbuild/funds-seal.mjs` → `.audit/h-postbuild/seal.mjs` (keep the hardened tail), with
lenses for: (a) ledger/funds correctness of the SHIPPED code (the reconciler provably never selects a
guarded hop row — re-run the probe against the shipped diff); (b) F1 posture (the shipped limit + the
abuse-cost); (c) **scope / zero-out-of-spine-diff** (Subsystem 2 + the spine untouched); (d) test
integrity (fail-pre-fix verified, no weakened mock, arithmetic exact, the mock-sweep complete); (e)
migration safety (if any); (f) register/docs accuracy + residual honesty. Embed the §Phase-3
SPINE-SAFEGUARD clause VERBATIM. Degraded-run guard + resume recovery. Record `.audit/h-postbuild/` +
`.audit/h-certify/`. **0 blocking before ANY commit.**

### Phase 6 — FOUNDER-GATED CLOSE-OUT (nothing ships without the founder's word)
LOCAL commit, path-scoped, atomic (never `git add -A`; quote bracketed paths; founder identity
`Luther Whiting-Collins <lexwhiting@gmail.com>`, trailer `Co-Authored-By: Claude <exact model>
<noreply@anthropic.com>`). **NO push. NO publish. NO migration apply.** Then: capstone
(`h-f1-resolution-2026-06-08.md`); register UPDATE (close **F1**; record the (H) disposition + any
generated-not-applied migration); next-chunk handoff; memory (`settlegrid-debt-chunks.md` +
`MEMORY.md`). **End the build session with a CADENCE-STATUS report when the executable gate is green**,
flagging readiness for the seal-gating review.

---

## 6. Frozen / existing surfaces to build ON (do not modify; read for shape)
- **(H) surface:** `apps/web/src/lib/settlement/sessions.ts` (`recordHop` ~:357-500 incl. the
  `recordSettlementEntryAsync` block; `finalizeSession`; `processSettlementBatch` — Subsystem-2, OUT) ·
  `apps/web/src/lib/settlement/ledger.ts` (`postLedgerEntry`/`recordSettlementEntry`/the
  `parseSettlementOperationId` → `skipped-unparseable` mis-credit guard) ·
  `apps/web/src/lib/settlement/reconcile.ts` (`reconcilePendingSettlements` — the bounded oldest-first
  `isNotNull(external_ref)` window; per-run bound 25) · the cron
  `apps/web/src/app/api/cron/settlement-reconcile/route.ts` · the hop route
  `'apps/web/src/app/api/sessions/[id]/hop/route.ts'` (no API-layer test today) · schema
  `apps/web/src/lib/db/schema.ts` (`workflowSessions`, `settlementBatches`, `accounts`, `ledgerEntries`,
  the rail/protocol enums) · the multi-hop tests `apps/web/src/lib/__tests__/multi-hop.test.ts` +
  `settlement-moat.test.ts`.
- **(F1) surface:** `apps/web/src/lib/rate-limit.ts` (`sdkLimiter = lazyLimiter(1000,'1 m')` :100;
  `apiLimiter` :97; `lazyLimiter` :83; the tiered cache :137) · the session routes `'apps/web/src/app/
  api/sessions/route.ts'` + `'apps/web/src/app/api/sessions/[id]/{hop,complete,delegate,finalize}/route.ts'`
  + `'apps/web/src/app/api/sessions/[id]/route.ts'` (all key `session-*:${ip}` on `sdkLimiter`) · the
  **87** test files mocking `@/lib/rate-limit` (the sweep surface).
- **Audit templates (gitignored, on disk):** `.audit/c-prebuild/prebuild-audit.mjs` (hardened tail —
  keep verbatim) · `.audit/c-postbuild/funds-seal.mjs` (money-SEAL shape) · `.audit/c-prebuild/CHECKPOINT.md`
  (recovery patterns).
- **Prior records (context; do not edit):** (C) capstone
  `c-revenuesharepct-reconciliation-resolution-2026-06-07.md` · post-(C) handoff
  `next-chunk-handoff-2026-06-07-post-c.md` · the B1.4 reconciler doc
  `b1.4-settlement-reconciler-2026-05-31.md` · the (N) F1 record `n-authid-keying-resolution-2026-06-06.md`.

## 7. Guardrails (non-negotiable)
- **Single-writer core**; fan-out only for the two audit gates.
- **Ground every conclusion in ACTUAL tool output** (suites run, greps shown, the reconciler SELECT
  quoted, the ledger flow worked — no vibes). On the money surface, "I think the guard works" is not
  acceptable — show the reconciler can't select the row.
- **Line-surgical**; §3 byte-stable spine; smaller change wins; the ONLY behavior changes are the (H)
  ledger-attribution guard/durability and the (F1) threshold raise.
- Do NOT push, change prod env, **apply** migrations, or publish. DB read-only.
- **Flag context degradation the moment it risks quality** (founder standing order). If work outgrows
  context, stop at a phase/batch boundary, write/update `.audit/h-prebuild/CHECKPOINT.md`, and recommend
  a continuation session. Consider a fresh session per phase (plan → build → seal).

## 8. One-paragraph orientation (read last, then start Phase 1)
The multi-hop hop feature records each service call to `workflowSessions.hops` (authoritative) and
**already** optionally writes a unified-ledger settlement row — but it has no SDK surface, no prod
caller, and a **verified trap**: a hop ledger row carrying an on-chain rail (`x402`/`circle-nano`) +
an `externalRef` is re-SELECTed by the settlement reconciler **every run forever**, eventually starving
its bounded 25-row batch. **(H)** makes that hop→ledger attribution safe — primarily the **rail-enum
guard** (exclude the two on-chain rails, by construction) + a **durability decision** + the missing hop
API test — on the money surface, so it earns a funds-SEAL. **(F1)** raises the per-IP rate limit on the
session routes so a single NAT egress's many legitimate users aren't collectively throttled — a
deliberate, bounded flood-posture loosening that ripples a new limiter export through ~84 mocking test
files. The two load-bearing, silently-wrong-prone calls are (LB-1) *which subsystem (H) is + whether the
guard truly keeps hop rows out of the reconciler*, and (LB-2) *whether F1's loosening is bounded and its
mock-sweep exact*. Start with the trace; trust nothing until you've re-derived it.
