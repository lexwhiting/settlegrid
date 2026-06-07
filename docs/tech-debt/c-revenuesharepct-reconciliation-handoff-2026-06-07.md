# (C) revenueSharePct take-model reconciliation — CHUNK HANDOFF (2026-06-07)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a
> verification facilitator) → use `/effort max`. **This chunk IS on the money spine** (it changes a
> live settlement take model and drops/realigns a money column) — so the post-build gate is a
> **funds-SEAL**, not just a correctness panel, and the full gate discipline is mandatory:
> **discovery trace FIRST → build plan → deep independent PRE-BUILD AUDIT (dynamic Workflow fan-out;
> PLAN_READY, 0 blocking, ALL fixes applied) BEFORE any implementation → single-writer build →
> post-build FUNDS-SEAL panel + certification (0 blocking) → founder-gated LOCAL commit.** NOTHING
> ships (push / prod-env / migration apply / publish) without the founder's explicit word.

---

## 0. Why this chunk + the REFRAMING (founder-decided 2026-06-07)

The post-(R) menu (`next-chunk-handoff-2026-06-07-post-r.md`) named **(C) `revenueSharePct` cleanup**
as the next lead and called it "legacy cleanup / hygiene, first POST-DEPLOY chunk." **A Step-0 study
this session proved that framing INCOMPLETE.** `revenueSharePct` is a half-removed legacy take model
with **one LIVE divergent consumer on the money spine**, so (C) is a **funds-correctness
reconciliation**, not hygiene. The founder's two scope calls for this chunk:

- **The sessions take-model divergence is the CENTERPIECE of (C)** (not an out-of-scope aside). The
  trace + plan must reconcile it; the column drop + dead-ref removal are the downstream cleanup that
  follows.
- **Deploy-ordering is decided at the PLAN GATE, not now.** The discovery trace is READ-ONLY (zero
  migration, zero deploy dependency) and starts immediately. Whether (C)'s migration ships with the
  current N/F2/F4/R bundle or after an intermediate deploy is a Phase-2/3 decision informed by the
  trace's confirmed migration shape. *Author's lean (non-binding): prod is dormant (migration
  low-risk) and (C) is now a funds-fix rather than hygiene, so there is no strong reason to keep
  gating it behind the intermediate deploy — but confirm at the gate.*

**The rest of the menu is unchanged and gated:** (K) HMAC-pepper DE-recommended; (A) ACP-dark
BD-gated; (H) hop extension + F1 NAT-raise demand-gated. (C) is the only viable engineering chunk.

## 1. CONFIRMED findings (verified 2026-06-07 at HEAD `ab243884`) — the TRACE must INDEPENDENTLY re-derive every one

> Line numbers DRIFT; the trace re-greps and re-reads. Do **not** trust these assertions — they are
> the study's conclusions, provided so you know where to look and what the hazard is. Source of truth
> for the legacy item: register `publisher-api-keys-audit-2026-05-28.md` (DEBT #3-adjacent; the
> `revenueSharePct` legacy is called out in `pricing.ts:4` and the schema comment).

**(C)-A — Schema-vs-DB default DRIFT (a real bug, not cosmetic).**
- CONFIRMED: `apps/web/src/lib/db/schema.ts:27`
  `revenueSharePct: integer('revenue_share_pct').notNull().default(100)` — comment says "Legacy".
  But the ONLY migration creating the column, `apps/web/drizzle/0000_polite_moonstone.sql:96`, is
  `"revenue_share_pct" integer DEFAULT 85 NOT NULL` — **never ALTERed** across all 15 migrations.
- CONFIRMED: **no production code writes the column** (grep: zero `update(developers).set({revenueSharePct})`
  / zero `.values({… revenueSharePct …})` in `src` runtime; only `scripts/seed-admin.ts:51` (=97) and
  `scripts/seed-dashboard-data.ts` (audit-log fixture) — seed-only, not prod runtime). Drizzle applies
  the **DB** default for omitted inserts, so **live developer rows carry 85**, not the schema's 100.
- TRACE MUST: confirm the DB default the live prod table actually has (read-only DB introspection if
  available, else treat the migration as authoritative = 85); confirm no later migration ALTERs it;
  decide the migration's correct end-state (drop the column entirely, vs realign default — see §2).

**(C)-B — The LIVE divergent consumer: `finalizeSession` (the centerpiece).**
- CONFIRMED: `apps/web/src/lib/settlement/sessions.ts` — `finalizeSession` (≈:508-655) builds a
  `devMap` of `developers.revenueSharePct` (:585-599) and at :609-611 computes
  `revSharePct = devMap.get(developerId) ?? 85; platformFeeCents = Math.ceil(entry.amountCents *
  ((100 - revSharePct) / 100)); developerAmountCents = entry.amountCents - platformFeeCents` — a
  **flat 15% session fee** (given the live 85), staged into a `settlementBatches` row (:628-636).
- CONFIRMED: `processSettlementBatch` (≈:663-715) credits `developers.balanceCents += d.amountCents`
  (the post-fee amount) in a txn.
- CONFIRMED: the authoritative take is **progressive at payout** — `lib/payouts/process.ts:259-260`
  `grossCents = developer.balanceCents; platformFeeCents = calculateTakeCents(grossCents)` (the
  marginal-bracket model in `lib/pricing.ts`, which `pricing.ts:4` says "Replaces the flat
  revenueSharePct model"). Payout takes on the **whole balance pool** regardless of how revenue
  entered it.
- THE HAZARD: session revenue is **taken twice** — 15% flat at finalize, then progressive at payout —
  while meter revenue is taken **once** (meter credits FULL `costCents`; take only at payout). The
  sessions path was never migrated off the flat model.
- TRACE MUST: read `finalizeSession` + `processSettlementBatch` + `payouts/process.ts` end-to-end;
  confirm the double-take precisely (does balanceCents pool both meter and session revenue? yes per
  the study — re-verify); determine the founder's intended SINGLE take model (almost certainly:
  sessions credit FULL amount, take only at payout — matching meter — i.e. **remove the flat session
  fee**); enumerate every behavior change to the live sessions path and its exact funds impact.

**(C)-C — `processSettlementBatch` may be UNWIRED (latency-lowering, scope-shaping).**
- CONFIRMED: `processSettlementBatch` has **no route or cron caller** — grep shows it only in the impl
  (`sessions.ts`) and the barrel re-export (`lib/settlement/index.ts:6`). `finalizeSession` stages a
  *pending* batch; nothing processes it → staged batches never credit balances today.
- TRACE MUST: confirm this (check `app/api/**`, `app/api/cron/**` incl. `settlement-reconcile`,
  Inngest/queue wiring, and any test-only callers); if truly unwired, the funds divergence is
  **triply latent** (dormant prod + demand-gated multi-hop + unprocessed batches) → informs the
  funds-SEAL framing (no active money loss) but does NOT make the code less wrong. If it IS wired
  somewhere the study missed, that RAISES urgency — flag immediately.

**(C)-D — The DEAD refs (cleanup tail, no behavior change).**
- CONFIRMED dead (selected/threaded, never used in money math):
  - `apps/web/src/app/api/sdk/meter/route.ts:105-126` — `effectiveRevenueSharePct` + the free-tier
    overage block (`OVERAGE_REVENUE_SHARE_PCT = 100` at :28 → the block is a 100→100 no-op) →
    passed to `recordInvocationAsync` at :313, which **ignores it** (`lib/metering.ts:298` param is
    documented "Legacy — ignored"; :303 destructure omits it; the `invocations` insert :360-378 does
    not write it). The `dev-ops:` monthly Redis counter (:113 read, :128-129 increment) is
    self-contained to this dead block.
  - `apps/web/src/app/api/sdk/meter-with-metadata/route.ts:140` — selected, never read (uses
    `developerShareCents = body.costCents`).
  - `apps/web/src/app/api/proxy/[slug]/route.ts` — `developerRevenueSharePct` (:117 type, :156
    select, :229 assign) + `revenueSharePct` threaded into `verifiedTool` (:1209/:1485/:1510/:1581) —
    never read by the caller in any money calc.
  - Display-only: `apps/web/src/app/api/auth/developer/me/route.ts:40`,
    `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx:35`, `apps/web/src/lib/email.ts:364`
    (an email template option param) — these SHOW a "revenue share %" that is meaningless under the
    progressive model.
- TRACE MUST: re-confirm each is truly dead (grep the consumer of each threaded value); decide per
  display ref whether to remove it or replace with progressive-model language (founder-taste; the
  settings/email surfaces may want `getProgressiveTakeLabel()` from `pricing.ts:92`); enumerate EVERY
  forced test edit per file (the F2/R lesson — a missed pinned test is a classic R1 blocker). The
  settlement-moat test (`src/lib/__tests__/settlement-moat.test.ts:63`) already mocks the column —
  read it.

**(C)-E — The migration (the schema-dirtying part).**
- The end-state almost certainly DROPS `developers.revenue_share_pct` once no code reads it (or, if
  the founder wants to keep a column for future per-developer overrides, REALIGNS the default and
  fixes the 85/100 drift — decide in the plan). Either way this is a **migration** → real-money
  guardrails apply (do NOT apply it; founder-gated).
- TRACE MUST: locate the migration toolchain (`apps/web/drizzle/`, `drizzle.config.*`, the
  `_journal.json` + the bootstrap script `apps/web/scripts/bootstrap__drizzle_migrations.sql`);
  determine whether a column DROP needs an **expand/contract** two-phase (deploy code that stops
  reading the column → then drop) or can be one-phase given dormancy; confirm the migration-apply
  path and that generating a migration file does NOT auto-apply.

## 2. DECIDED scope (Step-0, founder 2026-06-07) + SCOPE GUARD

**In scope (reconcile the take model + remove the legacy column):**
1. **Reconcile the sessions take model** (`finalizeSession`) to the authoritative single model
   (progressive-at-payout) — the funds-correctness centerpiece. Exact shape pinned by the trace +
   plan; the likely shape is "sessions credit FULL amount; take only at payout" (remove the flat
   session fee), but the founder's intended model is confirmed in the plan, NOT assumed.
2. **Remove the dead `revenueSharePct` code paths** (meter `effectiveRevenueSharePct` + overage block
   + the `dev-ops` counter if it has no other consumer; meter-with-metadata select; proxy threading;
   the `recordInvocationAsync` legacy param) — behavior-neutral.
3. **Resolve the display refs** (auth/me, settings, email) — remove or switch to progressive language.
4. **The migration**: drop (or realign) `developers.revenue_share_pct`, fixing the 85/100 drift.
5. Docs-only: capstone, register UPDATE, next-chunk handoff, memory.

**OUT of scope (byte-stable unless the trace proves a PLANNED change requires it):** the progressive
take model itself (`lib/pricing.ts` brackets/rates — do NOT change the rates; this chunk makes
sessions USE the model, it does not re-tune it); `lib/payouts/**` take logic (it is already the
authoritative model — only touch if the reconciliation provably requires it, and then it is
funds-SEAL-critical); the meter **credit** path (full-costCents-to-balance is correct and stays);
`deductCreditsRedis` / balance authority / dedup / B4 account_id semantics; `lib/rate-limit.ts` +
keying (DEBT #1 CLOSED); `lib/crypto.ts hashApiKey` + key formats; x402/ap2/circle-nano/outcomes
adapters; ALL of `packages/mcp`; ALL of `packages/sdk-python*`; F2/F4/N/M/H1/R settled designs.
**When in doubt, the smaller change wins — and on the money spine, "smaller" + "provably
take-neutral except the one intended reconciliation" is the bar.**

⚠️ **The one judged call is the sessions reconciliation** — it is the intended behavior change. Judge
it strictly in the plan (exact before/after funds math, every session-revenue path), but it is NOT
scope-growth: it is the chunk's reason to exist. Everything else must be behavior-neutral.

## 3. Ground state + pre-flight (verify before touching anything)

- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `ab243884`** ("(R) register close-out…",
  LOCAL, NOT pushed). Tree clean (`.audit/` gitignored). Confirm: `git -C /Users/lex/settlegrid
  status -sb && git log -3 --oneline`. The unpushed local stack is `…→aa580355 (N)→2b479a3e (F2)→
  fa7b7dbb (F4)→fe8dbdd5→ab243884 (R)`; `origin/main` had advanced to `9d22fd2e` this session (B4
  `be43b501` + getClientIp pushed) — **prod runs `origin/main`; the local stack is NOT deployed.**
- **Baselines (re-run to anchor BEFORE any edit; end-state must keep them green + only this chunk's
  own deltas):**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4282 pass / 181 files**) ·
    `npx next build` (**0**; not concurrent with tsc) · `npx eslint <changed files>` (0).
  - `cd packages/mcp`: `npx vitest run` (**1898 pass / 1 skip**) — expected byte-stable this chunk;
    re-run is the untouched-proof.
  - Python family (`packages/sdk-python*`): expected byte-stable — `git diff --numstat` is the proof.
- **Real-money guardrails:** do NOT push, set/change prod env, **apply** migrations, or publish (all
  founder-gated). Generating a migration FILE is fine; applying it is not. Any DB access **read-only**.
- **Shell is zsh:** quote bracketed paths (`'apps/web/src/app/(dashboard)/dashboard/settings/page.tsx'`,
  `'apps/web/src/app/api/proxy/[slug]/route.ts'`).

## 4. THE ARC — six phases. Phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code.

### Phase 1 — MANDATORY DISCOVERY TRACE (no plan without it)
Produce `docs/tech-debt/c-revenuesharepct-reconciliation-trace-2026-06-07.md` answering every
TRACE-MUST in §1, each grounded in a file:line read THIS session. Re-derive every number here (lines
drift). Specifically nail: (a) the live DB default + the 85/100 drift; (b) `finalizeSession`'s exact
funds math + the double-take vs payout, end-to-end; (c) whether `processSettlementBatch` is wired
anywhere (routes/cron/Inngest/tests); (d) the complete dead-ref map with each value's consumer
proven; (e) the migration toolchain + whether a DROP needs expand/contract; (f) EVERY forced test
edit per touched file; (g) the founder's intended single take model (state it explicitly as the
design premise the plan will implement).

### Phase 2 — BUILD PLAN
Write `docs/tech-debt/c-revenuesharepct-reconciliation-build-plan-2026-06-07.md` (status DRAFT until
the audit passes): goal + honest framing (a money-spine take-model reconciliation; the sessions fix is
the centerpiece, the rest is cleanup); the trace's conclusions; EXACT per-file recipes; the
**before/after funds math** for the sessions reconciliation (every session-revenue path, with worked
examples); the migration plan (drop vs realign; one-phase vs expand/contract; the exact generated
file; **NOT applied**); the **deploy-ordering decision** (now informed by the trace — ship with the
current bundle, or after an intermediate deploy); the byte-stable spine list (§2 verbatim); the test
plan — **each behavior-changing test must FAIL on pre-fix code** (esp. the sessions take-math change);
dead-ref removals classified as behavior-neutral (regression-guarded); the machine gates (apps/web tsc
0 / vitest 4282 + exact N_new / build 0 / eslint 0; packages/mcp 1898/1 unchanged; `git diff --numstat`
+ `git status --porcelain` confined to the in-scope files + the ONE migration file + docs); the
rollout note; an embedded **SCOPE GUARD** (§2 verbatim).

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the founder's hard gate)
**No implementation code until the build plan is audited PLAN_READY (0 blocking) with ALL fixes
applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt
  `.audit/r-prebuild/prebuild-audit.mjs` → `.audit/c-prebuild/prebuild-audit.mjs`. That script carries
  the **hardened tail** (null-guard + inline degraded fallback so a dead synthesizer can never crash
  the run or fake a pass) — **KEEP IT VERBATIM.** Shape: N fresh-context lenses that **re-derive the
  plan's claims against the actual code** → **adversarial verify** of every finding (default-refuted)
  → guarded synthesis at **PLAN_READY / 0 blocking**.
- **Suggested 6 lenses:** (a) **factual accuracy** — every file:line + the §1 confirmations (esp. the
  85/100 drift, the sessions math, the unwired batch processor, the dead-ref map); (b) **funds
  correctness** — the sessions reconciliation produces the intended SINGLE take model with NO new
  double-take / under-credit / over-credit; the worked funds math is right; payout still authoritative;
  meter credit path untouched; (c) **migration safety** — drop/realign is correct, the 85/100 drift is
  resolved, expand/contract reasoning sound, the file is generated-not-applied, no data loss on a
  populated table; (d) **test sufficiency** — every forced edit enumerated; behavior-change tests fail
  pre-fix; dead-ref removals genuinely behavior-neutral; no weakened mock; suite arithmetic exact;
  (e) **scope boundary** — zero out-of-scope spine hunks (pricing rates, payout logic, meter credit,
  rate-limit, crypto, mcp, sdk-python untouched); the ONLY behavior change is the intended sessions
  reconciliation; (f) **baseline integrity** — recorded baselines real; end-state gates evaluable.
- **Run the audit twice if it finds blockers:** R1 → apply ALL fixes to the plan → R2 must be
  PLAN_READY 0-blocking. (Precedents: (N)/(F2)/(R) went R1 NEEDS_FIXES → R2 READY; (B4)/(F4) passed
  R1 clean — both normal.)
- **DEGRADED-RUN GUARD:** before trusting any verdict, confirm ALL lenses produced output and no
  verify-verdict is null (a dead lens silently yields zero findings → fake PASS). The hardened tail
  surfaces `deadLenses`/`nullVerdicts`/`degraded` — **a degraded result is NOT a pass.**
- **Transient-death / session-limit recovery:** `Workflow({scriptPath, resumeFromRunId})` replays
  cached agents. SESSION-LIMIT/transient throttle ("Server is temporarily limiting requests" or
  "You've hit your session limit · resets 6pm America/New_York"): if ALL agents die there is no usable
  cache — **back off (≈4 min for transient throttle) and re-run**; the (R) R2 needed 3 attempts. If
  ONLY the synthesizer dies, the hardened tail emits a deterministic degraded fallback inline (re-run
  for certification).
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the funds-SEAL gate):**
  Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows
  scope is `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong.
  Hold the line against: re-tuning the progressive rate brackets (`lib/pricing.ts`); changing the
  payout take logic beyond what the reconciliation provably requires; touching the meter **credit**
  path, `deductCreditsRedis`, balance authority, dedup, B4 account_id semantics, `lib/rate-limit.ts`
  or any limiter keying, `hashApiKey`/key formats, x402/ap2/circle-nano adapters, `packages/mcp`,
  `packages/sdk-python*`; re-litigating settled designs (F2/F4 wire contract, N auth.id keying, M
  getClientIp, H1 fail-open, R) without a NEW trace; PyPI/npm publishing. Re-opening a settled
  decision requires a concrete new trace.
- Record `.audit/c-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md` (recovery procedures,
  mirroring `.audit/r-prebuild/CHECKPOINT.md`).

### Phase 4 — BUILD (single-writer)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audit gates
only). Line-surgical; touch only the planned sites. Suggested batch order (keep each batch green):
(1) dead-ref removals (meter/meter-with-metadata/proxy/display) → tsc/vitest; (2) the sessions
take-model reconciliation + its tests (the funds change) → suite; (3) the `recordInvocationAsync`
legacy-param removal → suite; (4) the migration file (generated, NOT applied) + schema edit →
tsc/build; (5) full sweep: apps/web tsc/vitest/build/eslint + packages/mcp vitest (unchanged-proof) +
`git diff --numstat` + `git status --porcelain` scope proof. Prove the fail-pre-fix property
empirically for the behavior-change tests (record to `.audit/c-build/`).

### Phase 5 — MANDATORY POST-BUILD FUNDS-SEAL + CERTIFICATION (0 blocking BEFORE any commit)
On-spine chunk → a **funds-SEAL** (not just a correctness panel). Adapt
`.audit/f2-postbuild/funds-seal.mjs` (money-SEAL shape) → `.audit/c-postbuild/funds-seal.mjs` (keep
the hardened tail), and fold in a **MIGRATION-SAFETY lens** + the **scope/zero-out-of-spine-diff
lens**. Lenses: (a) **funds correctness of the SHIPPED code** — the sessions reconciliation gives the
single intended take model; no double-take/under-credit; worked examples re-verified against the
shipped diff; meter credit + payout authority intact; (b) **migration safety** — the generated file
is correct, drift resolved, not applied, reversible/expand-contract sound; (c) **scope / spine
integrity** — `git diff` touches ONLY the planned files + the one migration + docs; zero
pricing-rate / payout-logic / meter-credit / rate-limit / crypto / mcp / sdk-python hunks; (d) **test
integrity** — behavior-change tests fail pre-fix (verify the recorded proof), dead-ref removals
behavior-neutral, no weakened mock, suite arithmetic exact; (e) **register/docs accuracy** + (f)
**residual honesty** (the triple-latency, the deploy-ordering decision, anything found-not-fixed).
Embed the §Phase-3 SPINE-SAFEGUARD clause VERBATIM. Degraded-run guard + resume recovery. Record to
`.audit/c-postbuild/` + `.audit/c-certify/`. **0 blocking before ANY commit.**

### Phase 6 — FOUNDER-GATED CLOSE-OUT (nothing ships without the founder's word)
1. **LOCAL commit, path-scoped, atomic** (shared-worktree hazard — never `git add -A`; quote
   bracketed paths): `git add <paths> && git -c user.name="Luther Whiting-Collins"
   -c user.email="lexwhiting@gmail.com" commit -m "<msg>" -- <paths>`, trailer
   `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`. **NO push. NO publish. NO
   migration apply.**
2. **Capstone:** `docs/tech-debt/c-revenuesharepct-reconciliation-resolution-2026-06-07.md` (what
   shipped, the funds math, the audit-chain verdicts, the deploy-ordering decision, residuals).
3. **Register** (`publisher-api-keys-audit-2026-05-28.md`): UPDATE section — the legacy
   `revenueSharePct` take-model reconciliation closed; note the migration is generated-not-applied
   (founder-gated).
4. **Next-chunk handoff:** after (C), the engineering queue is empty of non-gated items — the menu is
   purely gated ((K)/(A)/(H)/F1). Note the founder's deploy/publish bundle (now incl. (C)'s migration,
   per the deploy-ordering decision) and what remains to ship.
5. **Memory:** update `settlegrid-debt-chunks.md` (account memory) + the MEMORY.md one-liner, pointing
   at the capstone with the commit hash.

## 5. Guardrails (non-negotiable)
- **Single-writer core**; fan-out only for the two audit gates.
- **Ground every conclusion in ACTUAL tool output** (suites run, greps shown, funds math worked — no
  vibes). On the money spine, "I think it's take-neutral" is not acceptable — show the math.
- **Line-surgical**; §2 byte-stable spine; smaller change wins; the ONLY behavior change is the
  intended sessions reconciliation.
- Do NOT push, change prod env, **apply** migrations, or publish. DB read-only.
- **Flag context degradation the moment it risks quality** (founder standing order). If work outgrows
  context, stop at a phase/batch boundary, write/update `.audit/c-prebuild/CHECKPOINT.md`, and
  recommend a continuation session.

## 6. File-path index (absolute)
- **This handoff:** `/Users/lex/settlegrid/docs/tech-debt/c-revenuesharepct-reconciliation-handoff-2026-06-07.md`
- **Register (legacy source + close-out target):** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`
- **(C)-A drift:** `apps/web/src/lib/db/schema.ts:27` · `apps/web/drizzle/0000_polite_moonstone.sql:96`
- **(C)-B sessions (centerpiece):** `apps/web/src/lib/settlement/sessions.ts` (finalizeSession ≈:508,
  fee math :609-611; processSettlementBatch ≈:663) · authoritative model `apps/web/src/lib/pricing.ts`
  + `apps/web/src/lib/payouts/process.ts:259-260` · live route
  `apps/web/src/app/api/sessions/[id]/finalize/route.ts`
- **(C)-C wiring:** barrel `apps/web/src/lib/settlement/index.ts:6` · cron dir
  `apps/web/src/app/api/cron/` (incl. `settlement-reconcile`)
- **(C)-D dead refs:** `apps/web/src/app/api/sdk/meter/route.ts:28/:105-126/:313` ·
  `apps/web/src/lib/metering.ts:298/:303/:360-378` ·
  `apps/web/src/app/api/sdk/meter-with-metadata/route.ts:140` ·
  `'apps/web/src/app/api/proxy/[slug]/route.ts'` (:117/:156/:229/:1209/:1485/:1510/:1581) ·
  `apps/web/src/app/api/auth/developer/me/route.ts:40` ·
  `'apps/web/src/app/(dashboard)/dashboard/settings/page.tsx:35'` · `apps/web/src/lib/email.ts:364`
- **(C)-E migration toolchain:** `apps/web/drizzle/` + `apps/web/drizzle/meta/_journal.json` ·
  `apps/web/drizzle.config.*` · bootstrap `apps/web/scripts/bootstrap__drizzle_migrations.sql`
- **Existing test touching the column:** `apps/web/src/lib/__tests__/settlement-moat.test.ts:63`
- **Audit templates to adapt (gitignored, on disk):** `.audit/r-prebuild/prebuild-audit.mjs`
  (hardened tail — keep verbatim) · `.audit/f2-postbuild/funds-seal.mjs` (money-SEAL shape) ·
  `.audit/r-postbuild/panel.mjs` (off-spine panel shape, for the scope/test lenses) ·
  `.audit/r-prebuild/CHECKPOINT.md` (recovery patterns)
- **Prior-chunk records (context, do not edit):** (R) capstone
  `r-register-closeout-resolution-2026-06-07.md` · post-(R) menu
  `next-chunk-handoff-2026-06-07-post-r.md` · F4 capstone
  `f4-python-sdk-meter-auth-resolution-2026-06-06.md` · B4 capstone
  `b4-account-attribution-resolution-2026-06-04.md`
- **Baselines at HEAD `ab243884`:** apps/web tsc 0 / vitest 4282 / build 0; packages/mcp 1898/1;
  Python family byte-stable (numstat is the proof).

## 7. One-paragraph orientation (read this last, then start Phase 1)
`revenueSharePct` is the **flat take model that the progressive `calculateTakeCents` was supposed to
replace** — but the replacement was incomplete. Today the column is dead everywhere on the **meter**
path (credit-full-then-progressive-at-payout is correct and untouched) EXCEPT the **sessions**
settlement path (`finalizeSession`), which still computes a flat 15% session fee (from a DB default of
85 that disagrees with the schema's 100 and that nobody chose), creating a structural double-take vs
the payout model. The divergence is latent today (dormant prod + demand-gated multi-hop + an unwired
batch processor), but it is a real funds bug that must be reconciled before sessions carry real money.
(C) reconciles the sessions path to the single authoritative model, removes the dead column refs, and
drops/realigns the column via a (founder-gated, generated-not-applied) migration — behind the full
gate discipline with a **funds-SEAL**. Start with the trace; trust nothing in §1 until you've
re-derived it.
