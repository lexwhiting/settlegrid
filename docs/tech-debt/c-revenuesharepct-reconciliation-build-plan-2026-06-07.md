# (C) revenueSharePct take-model reconciliation — BUILD PLAN

**Status: PLAN_READY / APPROVED** (2026-06-07). Phase-3 pre-build audit: R1 PLAN_NEEDS_FIXES (3
blocking, all RED-gate, all fixed + re-verified) → **R2 PLAN_READY — 0 blocking — non-degraded (0 dead
/ 0 null; 13 agents)**, funds math independently re-derived and confirmed correct. R2's two optional
nits (0014 `IF EXISTS`; numstat/porcelain clarity) + the trace typos folded in. Verdicts:
`.audit/c-prebuild/round{1,2}-verdict.txt`. Grounded in
`c-revenuesharepct-reconciliation-trace-2026-06-07.md` (Phase 1) and HEAD `ab243884`. **Cleared to
build (Phase 4).**

---

## 0. Goal + honest framing

A **money-spine take-model reconciliation.** SettleGrid takes its platform fee exactly **once,
progressively, at payout** (`calculateTakeCents`, `lib/pricing.ts`) on the developer's whole pooled
`balanceCents`. The legacy flat `revenueSharePct` model was retired from the meter path but left
behind in `finalizeSession`'s deferred/atomic disbursement branch, where it applies a **flat 15%
session fee** (live DB default 85) — a structural **double-take** (flat at finalize, then
progressive at payout) that under-credits developers. The fix makes sessions credit the **full**
amount (meter-parity); the take happens once at payout.

- **The CENTERPIECE (the one intended behavior change):** remove the flat session fee in
  `finalizeSession` → full credit / zero fee.
- **Downstream cleanup (behavior-neutral):** delete every dead `revenueSharePct` ref, remove the
  `recordInvocationAsync` legacy param, drop the dead display refs, and **DROP** the
  `developers.revenue_share_pct` column via a hand-written, founder-gated, generated-not-applied
  migration that also eliminates the 85/100 drift.
- **Latency (no active money loss today, re-verified):** prod dormant + multi-hop demand-gated +
  no deferred/atomic session is ever created + `processSettlementBatch` is unwired. We fix the code
  so it is correct *before* it carries money.

---

## 1. Trace conclusions carried into this plan (one-liners; full proof in the trace)

1. Live DB default = **85** (introspected); rows 12×85 / 3×95 / **0×100**; schema says 100 → drift
   real, value meaningless on the live path.
2. The flat fee lives **only** in `finalizeSession`'s deferred/atomic branch (`sessions.ts:609-611`),
   staged into a `settlementBatches` row; `processSettlementBatch` credits the **post-fee** amount.
3. Triple-latency confirmed: immediate-only session creation, unwired batch processor, dormant prod.
4. Dead-ref map fully proven (meter overage block incl. self-contained `dev-ops:` counter;
   meter-with-metadata select; 3 proxy chains; auth/me; settings type; email option; metering param).
5. **`drizzle-kit generate` is UNUSABLE** (partial meta: only `0000_snapshot.json`, 3-entry journal,
   15 `.sql` files, two sharing the 0010 prefix, highest is 0013) → **hand-write**
   `0014_drop_revenue_share_pct.sql` + bootstrap hash row, mirroring
   the 0002-0013 convention. Generating is in scope; **applying is founder-gated.**
6. Intended single model: full credit everywhere, one progressive take at payout.

---

## 2. EXACT per-file recipes

> Conventions: line numbers are from HEAD `ab243884` and **will drift** as earlier edits land —
> each batch re-greps before editing. Shell is zsh → bracketed paths are single-quoted.

### Batch 1 — dead-ref removals (behavior-neutral)

**1a. `apps/web/src/app/api/sdk/meter/route.ts`** — remove the free-tier overage block + refs.
- Delete the const `OVERAGE_REVENUE_SHARE_PCT = 100` (`:28`) and its doc comment (`:27`).
- Delete the `const TIER_OPS_LIMITS = {…}` block (`:18-25`) **and its doc comment (`:17`)** — its
  **only** reader is `tierLimit` (`:107`), which is deleted below. (Audit R1 blocker: leaving it
  orphaned → `@typescript-eslint/no-unused-vars` ERROR → eslint gate RED. eslint.config.mjs:15
  `no-unused-vars:['error',{argsIgnorePattern:'^_'}]` does not cover module-level consts;
  `noUnusedLocals` is unset so tsc passes but eslint fails.)
- In the `toolDev` select (`:89-98`): delete the `revenueSharePct: developers.revenueSharePct` field
  (`:92`). **Keep** `developerId`, the `developerTier: developers.tier` field (`:93`), and the
  `innerJoin(developers)` — `developerTier` is live (it feeds `toolDev.developerTier` at the
  `checkTieredRateLimit` call `:140`).
- Delete `let effectiveRevenueSharePct = toolDev.revenueSharePct` (`:105`), `const tier` (`:106`),
  `const tierLimit` (`:107`), and the **entire** `if (effectiveRevenueSharePct === 100 && tier ===
  'standard') { … }` block (`:109-135`, incl. the `dev-ops:` monthKey/read/increment — proven
  sole-consumer, behavior-neutral). **`const tier` is also deleted** (Audit R1 blocker — corrected
  justification: `tier` is NOT read by `checkTieredRateLimit`; `:140` reads `toolDev.developerTier ??
  'free'` **directly**, not the `tier` const; the only refs to `tier` are `:107`/`:109`/`:121`, all
  inside the deleted lines → leaving `const tier` → unused-local eslint ERROR).
- In the `recordInvocationAsync({...})` call (`:305-316`): delete the
  `revenueSharePct: effectiveRevenueSharePct` arg (`:313`). (Coupled with the metering.ts param
  removal in 1e + the test arg in 1f — same batch so no intermediate tsc red.)
- Net behavior: identical (the block never executed in prod — gate `=== 100` is false for all live
  rows; the value was ignored downstream). billing-credits GROSS count for this file stays **1**.

**1b. `apps/web/src/app/api/sdk/meter-with-metadata/route.ts`** — remove dead select field.
- In the `toolDev` select (`:137-145`): delete `revenueSharePct: developers.revenueSharePct` (`:140`).
- **Join decision (resolved):** **drop the now-orphaned `innerJoin(developers)` (`:143`)** and select
  `{ developerId: tools.developerId }` from `tools` alone. Provably neutral: `tools.developerId` is
  `notNull().references(developers.id)` (schema), so the inner join never filtered. Update the stale
  comment (`:136` "Get tool + developer to find revenue share percentage" → "Get tool's developerId").
  *Audit fallback:* if any source/SQL-shape test asserts the join, **keep the join** and only drop
  the field (still neutral). The credit UPDATE at `:191` (`developers.balanceCents + developerShareCents`)
  is untouched → GROSS count stays **1**.

**1c. `apps/web/src/app/api/proxy/[slug]/route.ts`** — three dead chains.
- API-key path: delete return-type field `developerRevenueSharePct: number` (`:117`), the select field
  `revenueSharePct: developers.revenueSharePct` (`:156`), and the assignment
  `developerRevenueSharePct: row.revenueSharePct` (`:229`). Drop the orphaned `innerJoin(developers)`
  (`:160`) **iff** no other field in that select comes from `developers` (re-grep: only `:156` did →
  drop the join) — *audit fallback:* keep join if a test asserts it.
- MPP path: delete select field `revenueSharePct: developers.revenueSharePct` (`:1209`); drop the
  orphaned `innerJoin(developers)` (`:1212`) under the same FK proof / fallback.
- `lookupToolBySlug` → `forwardAndBill`: delete select field (`:1485`), the `verifiedTool` field
  `revenueSharePct: toolRow.revenueSharePct` (`:1510`), the `forwardAndBill` param-type field
  `revenueSharePct: number` (`:1581`), and drop the orphaned join (`:1488`) / fallback. All **9**
  `forwardAndBill` call sites (+1 definition) pass `lookup.toolRow` → removing field + param-type in
  lockstep keeps tsc green.
- proxy GROSS balance-writer count stays **5** (none touched).

**1d. Display refs.**
- `apps/web/src/app/api/auth/developer/me/route.ts`: delete `revenueSharePct: developers.revenueSharePct`
  from the select (`:40`).
- `'apps/web/src/app/(dashboard)/dashboard/settings/page.tsx'`: delete `revenueSharePct: number` from
  the developer type (`:35`). The two "Revenue Share" UI sites are static strings — untouched.
- `apps/web/src/lib/email.ts`: delete `revenueSharePct?: number` from the `stripeConnectCompleteEmail`
  options type (`:364`) → `options?: { preheader?: string }`. Body already uses progressive copy.

**1e. `apps/web/src/lib/metering.ts`** — remove the `recordInvocationAsync` legacy param (folded into
Batch 1 per Audit R1; was a separate Batch 3). Delete the `revenueSharePct: number` param field (`:298`)
from the `recordInvocationAsync` params type. The destructure (`:303`) already omits it; body unchanged.
billing-credits GROSS count for metering stays **1** (the `developerShareCents` writer is untouched).
**Coupling:** the `revenueSharePct` param is REQUIRED; the only call-site arg is removed in 1a (`:313`)
and the only test arg in 1f — all in this same batch, so there is no intermediate tsc red (the removal
order is internally consistent: param + arg + test-arg land together).

**1f. `apps/web/src/lib/__tests__/metering.test.ts`** — delete the `revenueSharePct: 95` argument to
`recordInvocationAsync` (`:184`). After 1e removes the param, this would be a tsc excess-property error;
removed in the same batch. Count-neutral (same surviving `it`).

**Batch-1 gate (must be fully GREEN — all of Batch 1 is behavior-neutral):** `npx tsc --noEmit` 0;
`npx vitest run` = **4282** (no test added/removed yet; metering arg edit is count-neutral);
`npx eslint <changed>` 0 (the meter.ts unused-const/local removals are what KEEP this green — Audit R1).

### Batch 2 — the sessions take-model reconciliation (THE funds change) + its test

**2a. `apps/web/src/lib/settlement/sessions.ts`** — `finalizeSession` deferred/atomic branch.
- Replace the disbursement loop body (`:605-623`) so it credits the **full** amount with **zero**
  fee, and zero the batch fee total. Concretely:
  - Delete the `developerRows`/`devMap` developer-fee lookup (`:585-599`) — it existed **only** to
    source `revenueSharePct` for the fee. `toolDevMap` (`:600`) and `toolRows` (`:574-583`) STAY
    (needed to map tool→developer). Re-grep to confirm `developerRows`/`devMap` have no other use.
  - In the loop (`:605-623`):
    ```ts
    for (const [, entry] of disbursementMap) {
      const developerId = toolDevMap.get(entry.toolId)
      if (!developerId) continue
      // Single take model: sessions credit the FULL amount; the progressive
      // platform take is applied once at payout (calculateTakeCents, lib/pricing.ts),
      // exactly as the meter path does. No flat fee at settlement time.
      disbursements.push({
        developerId,
        toolId: entry.toolId,
        amountCents: entry.amountCents,   // full
        platformFeeCents: 0,              // take deferred to payout
        stripeTransferId: null,
        status: 'pending',
      })
    }
    ```
  - `totalPlatformFee` stays `0` (remove the `+=` and the `let` can become `const totalPlatformFee = 0`,
    or drop the variable and inline `platformFeeCents: 0` at the batch insert `:633`). The batch insert
    (`:628-636`) then writes `platformFeeCents: 0`.
  - Remove the now-unused `developers` import usage **only if** `developers` is otherwise unused in the
    file (re-grep — `developers` table is still used by `processSettlementBatch`'s credit `:690`, so
    **keep the import**).
- **No change** to the immediate branch, `processSettlementBatch`, `rollbackSettlementBatch`, payout,
  meter, or pricing. The take is now applied exactly once (at payout) for session revenue, matching
  meter revenue.

**2b. NEW test (fail-pre-fix) — bespoke mock, new file (does NOT touch the shared harness).**
- File: `apps/web/src/lib/settlement/__tests__/finalize-take-model.test.ts`.
- Why a new file: the shared `multi-hop.test.ts` DB mock hardcodes `from()` to the `'sessions'`
  branch (`multi-hop.test.ts:147`) and returns `.where()` shapes without a `.limit()` thenable, so it
  **cannot** drive the deferred-branch `tools`/`developers` `IN(...)` selects — which is precisely why
  that path is untested. Extending the shared mock risks the 40+ tests relying on its current shape.
  A self-contained, faithful mock in a new file is the no-weakened-mock choice.
- The bespoke `vi.mock('@/lib/db', …)` returns a `db` whose:
  - `select().from(workflowSessions).where().limit(1)` → `[deferredSession]` (status `active`,
    `settlementMode: 'deferred'`, `hops` = two successful hops for one tool totalling a known amount).
  - `update(workflowSessions).set().where().returning(...)` → `[{ id }]` (active→finalizing CAS passes),
    then the post-insert `update(...).set({atomicSettlementId}).where()` → resolves.
  - `select().from(tools).where(IN)` → `[{ toolId, developerId }]`.
  - `select().from(developers).where(IN)` → `[{ developerId, revenueSharePct: 85 }]` (the worst-case
    flat-15% input — proves the fee is *ignored* post-fix).
  - `insert(settlementBatches).values(v).returning(...)` → **captures `v`** into a module-scoped
    variable and returns `[{ id: 'batch-1' }]`.
  - Mock `@/lib/redis` (`getRedis`/`tryRedis`) and `@/lib/logger` like `multi-hop.test.ts`.
  - Route `from(tableRef)` by identity against the mocked schema objects (compare to the same objects
    the test's `vi.mock('@/lib/db/schema')` exports) so each select hits the right table.
- Assertions (post-fix expectations):
  - captured batch `platformFeeCents === 0`;
  - every captured disbursement `platformFeeCents === 0` and `amountCents === <full hop total for its
    tool>` (e.g. hops 7000 + 3000 → 10000 full, **not** 8500);
  - `totalAmountCents === sum(hops)`.
- **Fail-pre-fix proof:** on pre-fix code the batch carries `platformFeeCents = ceil(10000×0.15) =
  1500` and disbursement `amountCents = 8500` → assertions FAIL. Recorded empirically to
  `.audit/c-build/fail-pre-fix.txt` (run the test on a stashed-pre-fix `sessions.ts`, capture the red).

**2c. Forced test edits in this batch:** none. (`metering.test.ts:184` moved to Batch 1f, coupled with
its param removal. `settings.test.ts` is **NOT** edited — see the reclassification note below.)

> **`settings.test.ts` reclassified to UNTOUCHED (Audit R1).** The me-route mock `select` is
> `mockReturnThis()` (ignores the projection) and returns a fixed developer object that *includes*
> `revenueSharePct: 95`; the route returns it verbatim via `successResponse` (no projection). So
> removing the me-route `:40` select field leaves `data.developer.revenueSharePct === 95` (`:138`)
> **green** — it is **not** a behavior-change/fail-pre-fix test and not a forced edit. We leave
> `settings.test.ts` untouched (smaller change; minimal churn). The mildly-stale title (`:116`) and
> assertion are acceptable — they exercise the mock, not the dropped column.

### Batch 3 — FOLDED into Batch 1 (Audit R1)

The `recordInvocationAsync` legacy-param removal (`metering.ts:298`) is now **Batch 1e**, co-located
with the call-site arg (`meter/route.ts:313`, Batch 1a) and the test arg (`metering.test.ts:184`, Batch
1f) so no intermediate tsc red occurs (the param is required → arg + param + test-arg must move
together). There is no separate Batch 3.

### Batch 4 — schema edit + the migration (generated, NOT applied) + the schema-tied forced edits

> All references to the schema column are gone by the start of this batch (the 7
> `developers.revenueSharePct` accessors land in Batches 1-2; the typed seed insert + the real-schema
> test accessor are dropped IN this batch), so tsc never sees a dangling `developers.revenueSharePct`.

**4a. `apps/web/src/lib/db/schema.ts:27`** — delete the `revenueSharePct` column line from the
`developers` table.

**4a-bis. `apps/web/scripts/seed-admin.ts:51` (Audit R1 — missed forced edit).** Delete the
`revenueSharePct: 97,` line from the typed `db.insert(developers).values({…})` (`:45-54`). `scripts/`
is in the tsc program (`tsconfig.json` include `'**/*.ts'`; exclude only `node_modules`; `strict:true`),
so after 4a drops the column this typed insert throws **TS2769** → `tsc --noEmit` RED. Removed in the
**same batch** as 4a. Behavior-neutral (the seeded value feeds no money math; the column no longer
exists). (`seed-dashboard-data.ts:241` is a plain JSON string literal `{ field: 'revenueSharePct',
value: 95 }` in an audit-log fixture — NOT a typed column ref — so it is **not** edited.)

**4b. NEW migration `apps/web/drizzle/0014_drop_revenue_share_pct.sql`** (hand-written; **NOT** via
`drizzle-kit generate` — see trace §5.1):
```sql
ALTER TABLE "developers" DROP COLUMN IF EXISTS "revenue_share_pct";
```
(`IF EXISTS` per Audit R2 optional-hardening: the migration is applied by a manual one-shot paste in
the Supabase SQL Editor, so making a re-paste a no-op is the defensive choice on a real-money DB —
matching the bootstrap script's idempotent `WHERE NOT EXISTS` spirit. Bare `DROP COLUMN` is also
repo-valid; either is correct.)

**4c. `apps/web/scripts/bootstrap__drizzle_migrations.sql`** — append one hash row mirroring the 0013
entry, with the sha256 of `0014_drop_revenue_share_pct.sql` (compute via
`shasum -a 256 apps/web/drizzle/0014_drop_revenue_share_pct.sql`), a `created_at` epoch-ms constant,
and a comment: *"0014_drop_revenue_share_pct (ships with (C); apply the .sql via SQL Editor
post-deploy alongside seeding this row)."* Do **NOT** edit `_journal.json` or add a snapshot
(consistent with 0002-0013). Also update the file's **POST-RUN VERIFICATION footer** (`:118`, Audit R1
nit) from "Expected: 14 rows. MAX(created_at) = 1779993698000 (0013…)" to **15 rows / the new MAX /
`0014_drop_revenue_share_pct`** so the manually-run check stays accurate. (Footer is a comment only;
the migrator reads only the 3 journaled tags — no functional/gate impact.)

**4d. `db-schema.test.ts:57-59`** — delete the `it('has revenueSharePct column', …)` block (the column
is intentionally gone; `schema.developers.revenueSharePct` would be `undefined`). It is the **only**
real-schema accessor of the column in tests (the other test refs are untyped `vi.mock` string-maps).
Removed in this batch (the **−1** in the suite arithmetic).

**Batch-4 gate:** `npx tsc --noEmit` 0 (schema-tied edits 4a/4a-bis/4d landed together); `npx next
build` 0 (schema compiles without the column); `npx eslint <changed>` 0.

### Batch 5 — full sweep (proof)

`apps/web`: `npx tsc --noEmit` (0) · `npx vitest run` (expected **4282 − 1 + N_new = 4283** at N_new=2;
see §5 — only `db-schema.test.ts` removes a test; metering arg edit is count-neutral) ·
`npx next build` (0) · `npx eslint <changed files>` (0). `packages/mcp`: `npx vitest run`
(**1898/1**, unchanged-proof). `git diff --numstat` + `git status --porcelain` confined to the
in-scope files + the one migration + docs (§7). Python family: `git diff --numstat` empty.

---

## 3. BEFORE/AFTER funds math (worked; full table in trace §2.3)

- **$10,000 session, dev @ 85, pool also has $60k meter revenue:** BEFORE → dev 6,639,500 / platform
  360,500 (flat 150,000 + progressive 210,500). AFTER → dev 6,782,000 / platform 218,000 (0 + single
  progressive 218,000). The flat fee over-took **~$1,425**; AFTER is the single intended take.
- **$100 session, dev @ 85, no other revenue:** BEFORE keeps a 1,500-cent flat fee where progressive
  says 0% (<$1k/mo); AFTER credits full 10,000, payout takes 0 → dev keeps all, correct.
- **Take-neutrality statement:** for **meter** revenue, nothing changes (credit-full + progressive-at-
  payout is untouched). For **session** revenue, the ONLY change is removing the flat finalize fee so
  the single progressive payout take applies — eliminating the second take. Payout logic, pricing
  brackets, and the meter credit path are byte-identical.

---

## 4. Migration plan + deploy-ordering decision

- **Shape:** **DROP** `developers.revenue_share_pct` (eliminates the 85/100 drift by removal; the
  value is dead/meaningless on the live path). **Hand-written** `0014` (drizzle-kit generate unusable)
  + bootstrap hash row. **One statement, one logical phase** of DDL.
- **Expand/contract & ordering (PLAN-GATE DECISION):** **ship (C)'s code + schema edit + the generated
  `0014` file with the current N/F2/F4/R bundle; APPLY `0014` only AFTER that bundle deploys.** Once
  the deployed code no longer SELECTs `revenue_share_pct` (true after this chunk), the DROP is safe.
  Applying before deploy would break old instances mid-rollout. Prod is dormant so risk is minimal
  either way, but code-first/drop-after is the disciplined order. **Applying is founder-gated;** this
  chunk only generates the file + seeds the (not-yet-run) bootstrap row.
- **No data loss of meaning:** the 12×85 / 3×95 values feed no live money math; dropping is safe.
- **Reversibility:** re-adding the column is a trivial `ADD COLUMN … DEFAULT 100` if ever needed; no
  data migration required (nothing reads it).

---

## 5. Test plan + suite arithmetic

- **Behavior-change test (fails pre-fix):** new `finalize-take-model.test.ts` (Batch 2b) — empirically
  proven red on pre-fix `sessions.ts`, green post-fix; recorded to `.audit/c-build/`. Expect **+1 file
  / +1-3 tests** (one or more `it`s in the new file).
- **Dead-ref removals are behavior-neutral** and regression-guarded by the unchanged suites
  (billing-credits source-regex GROSS counts 5/1/1/1 preserved; NET-writer absence preserved).
- **Forced edits (only two):** `metering.test.ts:184` (−1 arg, count-neutral; Batch 1f),
  `db-schema.test.ts:57-59` (**−1 test**: the column-existence `it`; Batch 4d). `settings.test.ts` is
  **NOT** forced — the me-route mock returns the field regardless of the dropped select, so it stays
  green untouched (Audit R1; left untouched for minimal churn).
- **Suite arithmetic (pinned; verify in Batch 5):** baseline **4282**. Net = 4282 **−1** (db-schema
  column test removed) **+ N_new** (new finalize tests, N_new ≥ 1). With a single new `it`,
  end-state = **4282**; with the recommended 2 new `it`s (the @85 worst-case + a @95 case),
  end-state = **4283**. Plan target: **4282 − 1 + N_new**, N_new pinned at the value actually authored
  (default **2** → **4283**). `packages/mcp` **1898/1** unchanged.
- **No weakened mocks:** the new test adds a faithful bespoke mock; harmless schema-mock map entries
  elsewhere are left in place (minimal churn) unless a build run shows a break.

---

## 6. Byte-stable spine (SCOPE GUARD — §2 of the handoff, verbatim intent)

**OUT of scope / must stay byte-stable unless the trace proves a PLANNED change requires it:** the
progressive take model itself (`lib/pricing.ts` brackets/rates — do NOT change the rates; this chunk
makes sessions USE the model, it does not re-tune it); `lib/payouts/**` take logic (already
authoritative — only touch if the reconciliation provably requires it; it does **not**); the meter
**credit** path (full-costCents-to-balance is correct and stays); `deductCreditsRedis` / balance
authority / dedup / B4 account_id semantics; `lib/rate-limit.ts` + keying (DEBT #1 CLOSED);
`lib/crypto.ts hashApiKey` + key formats; x402/ap2/circle-nano/outcomes adapters; ALL of
`packages/mcp`; ALL of `packages/sdk-python*`; F2/F4/N/M/H1/R settled designs. **When in doubt, the
smaller change wins — and on the money spine, "smaller" + "provably take-neutral except the one
intended reconciliation" is the bar.** The one judged call is the sessions reconciliation (the
chunk's reason to exist); everything else is behavior-neutral.

---

## 7. Machine gates (end-state must satisfy ALL)

- `apps/web`: `npx tsc --noEmit` → **0**; `npx vitest run` → **4282 − 1 + N_new** (pin N_new in build);
  `npx next build` → **0**; `npx eslint <changed>` → **0**.
- `packages/mcp`: `npx vitest run` → **1898 pass / 1 skip** (unchanged-proof).
- `packages/sdk-python*`: `git diff --numstat` → **empty**.
- `git status --porcelain` + `git diff --numstat` touch **only** (the two are PAIRED on purpose —
  `--porcelain` surfaces the NEW untracked files as `??` (the `0014_*.sql` + the finalize test, which
  `--numstat` cannot see until `git add`); `--numstat` proves byte-stability of TRACKED files; `.audit/`
  is gitignored so it never pollutes either):
  - `apps/web/src/app/api/sdk/meter/route.ts`
  - `apps/web/src/app/api/sdk/meter-with-metadata/route.ts`
  - `apps/web/src/app/api/proxy/[slug]/route.ts`
  - `apps/web/src/app/api/auth/developer/me/route.ts`
  - `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`
  - `apps/web/src/lib/email.ts`
  - `apps/web/src/lib/metering.ts`
  - `apps/web/src/lib/settlement/sessions.ts`
  - `apps/web/src/lib/db/schema.ts`
  - `apps/web/scripts/seed-admin.ts` (Audit R1 — typed insert; drop `revenueSharePct: 97`)
  - `apps/web/drizzle/0014_drop_revenue_share_pct.sql` (**new**)
  - `apps/web/scripts/bootstrap__drizzle_migrations.sql`
  - `apps/web/src/lib/settlement/__tests__/finalize-take-model.test.ts` (**new**)
  - `apps/web/src/lib/__tests__/metering.test.ts`
  - `apps/web/src/lib/__tests__/db-schema.test.ts`
  - `docs/tech-debt/c-*` (trace, plan, capstone) + register + memory
  - (`settings.test.ts` is **NOT** in this list — reclassified UNTOUCHED, Audit R1; see Batch 2c)
- **Zero** out-of-spine hunks: no pricing-rate, payout-logic, meter-credit, rate-limit, crypto, mcp,
  sdk-python changes.

---

## 8. Rollout note

LOCAL commit only (founder-gated). The migration file is **generated, not applied**. Deploy order:
ship (C)'s code with the current unpushed N/F2/F4/R bundle; founder applies `0014` via the Supabase
SQL Editor **after** the bundle is live (+ seeds the bootstrap hash row). Nothing pushes/publishes
without the founder's word.

---

## 9. EMBEDDED SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (verbatim — applies to Phase 3 AND Phase 5)

Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows
scope is `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong.
Hold the line against: re-tuning the progressive rate brackets (`lib/pricing.ts`); changing the
payout take logic beyond what the reconciliation provably requires; touching the meter **credit**
path, `deductCreditsRedis`, balance authority, dedup, B4 account_id semantics, `lib/rate-limit.ts`
or any limiter keying, `hashApiKey`/key formats, x402/ap2/circle-nano adapters, `packages/mcp`,
`packages/sdk-python*`; re-litigating settled designs (F2/F4 wire contract, N auth.id keying, M
getClientIp, H1 fail-open, R) without a NEW trace; PyPI/npm publishing. Re-opening a settled decision
requires a concrete new trace.
