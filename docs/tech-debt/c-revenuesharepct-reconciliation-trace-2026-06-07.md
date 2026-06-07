# (C) revenueSharePct take-model reconciliation — DISCOVERY TRACE (2026-06-07)

> Phase-1 deliverable. Every claim below was **independently re-derived this session** against
> HEAD `ab243884` (tree clean). The handoff §1 assertions were treated as hazard-pointers, NOT
> trusted; line numbers here are the ACTUAL current lines. Where I confirm the handoff, I say so;
> where I found MORE than the handoff (the migration-toolchain hazard, the immediate-mode reality,
> the exact dead-block deadness), I flag it. This is read-only: zero edits, zero migration, zero DB
> writes (the one DB touch was a read-only `information_schema`/`SELECT count` introspection).

## 0. Pre-flight (re-anchored this session)

- `git rev-parse HEAD` = `ab2438844601567e4ddcbe786473c4e9e8fde369` ✓ (matches handoff)
- `git status --porcelain` = only `?? docs/tech-debt/c-revenuesharepct-reconciliation-handoff-2026-06-07.md` (untracked handoff). Tree otherwise clean ✓. `git diff --numstat` empty ✓.
- Baselines re-run GREEN at HEAD:
  - `apps/web` `npx tsc --noEmit` → **0 errors** ✓
  - `apps/web` `npx vitest run` → **4282 passed / 181 files** ✓
  - `apps/web` `npx next build` → **exit 0** ✓
  - `packages/mcp` `npx vitest run` → **1898 passed / 1 skipped (52 files)** ✓
  - Python family (`packages/sdk-python*`): untouched; `git diff --numstat` is the proof (empty).

---

## 1. TRACE-MUST (a) — the live DB default + the 85/100 drift

**CONFIRMED — the drift is real, and worse than "schema says 100":**

- **Schema (Drizzle):** `apps/web/src/lib/db/schema.ts:27`
  `revenueSharePct: integer('revenue_share_pct').notNull().default(100), // Legacy — progressive take rates now calculated dynamically. See lib/pricing.ts`
- **The ONLY DDL creating the column:** `apps/web/drizzle/0000_polite_moonstone.sql:96`
  `"revenue_share_pct" integer DEFAULT 85 NOT NULL` — and **no later migration ALTERs it**
  (grep across all 15 `.sql` files: `revenue_share_pct` appears only in `0000_*.sql:96` and
  `drizzle/meta/0000_snapshot.json`; zero `ALTER ... revenue_share_pct`).
- **LIVE DB introspection (read-only, this session):**
  - `information_schema.columns` → `column_default = 85` for `developers.revenue_share_pct`.
  - Row distribution: **12 rows at 85**, **3 rows at 95**, **0 rows at 100**, 0 at 97.
- **Interpretation:** The schema's `.default(100)` has **never reached a single live row** — every
  developer carries the DB-level default 85 (or a manually-set 95). Drizzle's `.default(100)` only
  takes effect for inserts that go through Drizzle's *application-side* default, but the DB column's
  own `DEFAULT 85` wins for any INSERT that omits the column (which is all of them — see §4). So the
  "85 vs 100" disagreement is not cosmetic: **prod behaves as 85**, the ORM *says* 100, and **nobody
  chose either** (85 is a long-stale `0000` artifact).
- **The 3 rows at 95:** there is **no runtime writer** for this column (§4), so the 95s were set
  out-of-band (manual SQL editor, or a since-removed path). Under the progressive model the value is
  **semantically meaningless** — it feeds no money math on the live (meter) path. Dropping the column
  loses no functional data.

**Drift end-state decision (feeds the plan):** because the column is dead on the live path and the
value is meaningless, the correct resolution is to **DROP** the column (eliminating the drift), not
to realign the default. (Realign = keep a dead column + pick a meaningless number; DROP = remove the
ambiguity entirely. Founder lean in handoff §1-E also points to DROP.) Confirmed at the plan gate.

---

## 2. TRACE-MUST (b) — finalizeSession's exact funds math + the double-take (THE CENTERPIECE)

### 2.1 The code (re-read end-to-end, `apps/web/src/lib/settlement/sessions.ts`)

`finalizeSession(sessionId)` (`:508-655`) has **two branches** keyed on `settlementMode`:

- **Immediate branch (`:542-558`):** marks the session `settled`, cleans Redis, returns
  `{ batchId: null, totalSettledCents: session.spentCents }`. **It computes NO fee and creates NO
  disbursement and credits NO `developers.balanceCents`.** This is the branch that actually runs in
  prod (see §2.3).
- **Deferred/atomic branch (`:560-654`):** the flat-fee math lives **only here**:
  - `:585-599` builds `devMap = Map<developerId, revenueSharePct>` by selecting
    `developers.revenueSharePct` (`:590`).
  - `:609-611` (the hazard, verbatim):
    ```ts
    const revSharePct = devMap.get(developerId) ?? 85
    const platformFeeCents = Math.ceil(entry.amountCents * ((100 - revSharePct) / 100))
    const developerAmountCents = entry.amountCents - platformFeeCents
    ```
    With the live default 85 → `platformFeeCents = ceil(amount * 0.15)` = a **flat 15% session
    fee**. (For the 3 rows at 95 → flat 5%.)
  - `:615-623` stages `disbursements[]` with `amountCents: developerAmountCents` (**post-fee**) and
    `platformFeeCents`.
  - `:628-636` inserts a `settlementBatches` row with `platformFeeCents: totalPlatformFee` and the
    post-fee disbursements. Status defaults to `'pending'` (schema `:1019`).
- `processSettlementBatch(batchId)` (`:663-767`) later, in a txn, credits
  `developers.balanceCents += d.amountCents` (`:690`) — i.e. the **post-fee** amount — and marks the
  batch+session completed/settled.

### 2.2 The authoritative model is progressive-at-payout

- `apps/web/src/lib/payouts/process.ts:259-261`:
  ```ts
  const grossCents = developer.balanceCents
  const platformFeeCents = calculateTakeCents(grossCents)   // lib/pricing.ts, marginal brackets
  const payoutAmountCents = grossCents - platformFeeCents
  ```
  Payout takes progressively on the **entire pooled `balanceCents`**, regardless of how revenue
  entered the pool. `lib/pricing.ts:4` comment: *"Replaces the flat revenueSharePct model."*
- The **meter** path is the reference single-take implementation: `lib/metering.ts:304-306`
  `developerShareCents = costCents` (FULL), credited at `:350` `balanceCents += developerShareCents`.
  Take happens **once**, later, at payout. Meter never applies a fee at credit time.

### 2.3 The double-take — precise, with worked funds math

The structural defect: in the deferred/atomic branch, session revenue is reduced by a **flat 15%**
at finalize, the reduced amount is pooled into `developers.balanceCents`, and then payout takes
**progressively on top**. Meter revenue is pooled **full** and taken progressively **once**. Two
different take models feed one pool → session revenue is taxed twice.

**Worked example — a $10,000 session for a dev who also has $60,000/mo meter revenue (dev @ 85):**

| | BEFORE (flat 15% at finalize, then progressive at payout) | AFTER (full credit, progressive once) |
|---|---|---|
| Session flat fee at finalize | `ceil(1,000,000 × 0.15)` = **150,000** | **0** |
| Session credit to `balanceCents` | 1,000,000 − 150,000 = **850,000** | **1,000,000** |
| Pool at payout (meter 6,000,000 + session) | **6,850,000** | **7,000,000** |
| Progressive take `calculateTakeCents(pool)` | 0 + 18,000 + 100,000 + 92,500 = **210,500** | 0 + 18,000 + 100,000 + 100,000 = **218,000** |
| Developer receives | 6,850,000 − 210,500 = **6,639,500** | 7,000,000 − 218,000 = **6,782,000** |
| Platform keeps | 150,000 + 210,500 = **360,500** | 0 + 218,000 = **218,000** |

The BEFORE state over-takes **142,500 cents (~$1,425)** on this one session vs the intended single
model — the flat 15% ($1,500) minus the small marginal-bracket difference. The developer is
**under-credited**; the platform **double-dips**.

**Smaller earner ($100 session, dev @ 85, no other revenue):** BEFORE keeps a 1,500-cent flat fee
even though the progressive model says **0%** under $1,000/mo → developer over-charged 1,500 cents,
i.e. the fee is wrong even where there's no *second* take. So the bug is "flat fee that shouldn't
exist," which manifests as a double-take whenever the pool also crosses progressive brackets.

### 2.4 The founder's intended SINGLE take model (the design premise the plan implements)

**Sessions must credit the FULL amount; the platform take happens once, at payout, via
`calculateTakeCents` — identical to the meter path.** Concretely, in the deferred/atomic
disbursement loop:
- `developerAmountCents = entry.amountCents` (full)
- `platformFeeCents = 0`
- `totalPlatformFee = 0`

This makes `processSettlementBatch` credit the full amount into `balanceCents`, where payout applies
the one progressive take. No flat fee, no double-take, meter-parity.

---

## 3. TRACE-MUST (c) — is processSettlementBatch wired? + the immediate-mode reality (latency)

**CONFIRMED triply-latent — and the latency is deeper than the handoff stated.**

1. **`processSettlementBatch` has NO production caller.** grep across `src` (excluding tests):
   it appears only in its impl (`sessions.ts:663`), the barrel re-export
   (`lib/settlement/index.ts:6`), and `app/compare/nevermined/data.ts` (a marketing *string*
   listing the function name). **No route, no cron, no Inngest.** Checked:
   - `app/api/cron/` (28 crons listed): the only settlement cron is `settlement-reconcile`, which
     calls `reconcilePendingSettlements()` from `lib/settlement/reconcile.ts` (ledger row recovery),
     **not** `processSettlementBatch` (grep `reconcile.ts` → no `processSettlementBatch`).
   - No `inngest`/`queue`/`worker` directory exists in `src` (find → none; grep `inngest` → none).
   - `vercel.json` crons: no entry routes to a batch processor.
   → Staged `pending` batches are **never processed** today. The post-fee credit never lands.

2. **No production code ever creates a deferred/atomic session.** `createSession` (`sessions.ts:45`)
   hardcodes `settlementMode: 'immediate'` (`:135`); the schema default is also `'immediate'`
   (`:982`). grep `settlementMode` → set to a non-immediate value **only in
   `multi-hop.test.ts:711` (`'deferred'`)**. So the entire deferred/atomic branch of
   `finalizeSession` (`:560-654`) — the branch carrying the flat-fee math — is **unreachable in
   prod**; the live finalize route only ever hits the immediate branch (`:542-558`), which applies
   **no fee at all**.

3. **Immediate-mode revenue does not reach `developers.balanceCents` via this code.** `recordHop`
   (`:357`) writes the unified **ledger** (`recordSettlementEntryAsync` → `accounts.balanceCents`,
   `lib/settlement/ledger.ts:172/186`) only when `rail`+`protocol`+`accountId` are all supplied; it
   does **not** touch `developers.balanceCents`. So in immediate mode, sessions never credit the
   payout pool through `finalizeSession`/`processSettlementBatch` at all.

**Net:** the double-take is **latent on three independent counts** — (a) prod is dormant /
multi-hop is demand-gated, (b) no deferred/atomic sessions are ever created, (c) the batch processor
is unwired. There is **no active money loss today.** But the deferred/atomic disbursement code is
genuinely **wrong**, and would activate the instant someone (i) creates deferred-mode sessions and
(ii) wires `processSettlementBatch`. Fixing it now makes the code correct *before* it carries money.
**If any of these three latency assumptions were false, urgency would jump — re-verified all three
this session; all hold.**

---

## 4. TRACE-MUST (d) — the complete DEAD-REF map (each consumer proven)

**No runtime writer exists for the column** (grep `revenueSharePct` with `.set(|.values(|update(|insert(`,
excluding tests → **zero hits**). Writers are seed-only: `scripts/seed-admin.ts:51` (=97),
`scripts/seed-dashboard-data.ts:241` (audit-log *fixture*, not a column write). Confirms §1.

Every live SELECT/thread of the column and its proven consumer:

### 4.1 `apps/web/src/app/api/sdk/meter/route.ts` — the free-tier overage block (dead)
- `:92` selects `revenueSharePct` (alongside `developerTier` — **tier IS live**, used for rate
  limiting `:106-107/:138-142`, so the `innerJoin(developers)` and the select STAY).
- `:105` `let effectiveRevenueSharePct = toolDev.revenueSharePct`
- `:109` `if (effectiveRevenueSharePct === 100 && tier === 'standard')` — gates the free-tier ops block.
- `:118` `effectiveRevenueSharePct = OVERAGE_REVENUE_SHARE_PCT` where `OVERAGE_REVENUE_SHARE_PCT = 100`
  (`:28`) → a **100→100 no-op**.
- `:124` logs it; `:313` passes `revenueSharePct: effectiveRevenueSharePct` to `recordInvocationAsync`,
  which **ignores it** (see §4.5).
- **Deadness proof:** (i) the value only ever flows to a function that ignores it; (ii) with the
  live default 85, the gate `=== 100` is **false for every developer**, so the block **never executes
  in prod today** regardless. The `dev-ops:` monthly Redis counter inside the block (`:113` key,
  `:114` read, `:128-134` increment) has **exactly one reference in the entire codebase — this block**
  (grep `dev-ops:` → only `meter/route.ts:113`; zero in any test, dashboard, or quota check). So the
  counter is self-contained; removing the block removes a write nobody reads → **behavior-neutral.**
- **Removal:** delete `:105` `effectiveRevenueSharePct`, the `OVERAGE_REVENUE_SHARE_PCT` const (`:28`),
  the entire `if` block (`:109-135` incl. the `dev-ops:` counter), and the `revenueSharePct` field at
  the `:92` select + the `:313` arg. Keep the `:89-98` select's `developerId`+`developerTier`+join
  (`developerTier` is live — it feeds `toolDev.developerTier` at the `checkTieredRateLimit` call `:140`).
- **Also dead-by-cascade (Audit R1 — these would be unused after the above → eslint `no-unused-vars`
  ERROR, so they MUST be deleted in the same edit):** `const tier` (`:106`) — its only readers are
  `:107`/`:109`/`:121`, all deleted; **`:140` reads `toolDev.developerTier` DIRECTLY, not `tier`**, so
  `tier` is NOT otherwise live. `const tierLimit` (`:107`) — read only inside the deleted block. The
  `TIER_OPS_LIMITS` const + its doc comment (`:17-25`) — its only reader is `tierLimit` (`:107`).
  (`eslint.config.mjs` flags unused module-level consts AND locals; `noUnusedLocals` is unset so tsc
  alone would NOT catch these — eslint does.)

> ⚠️ **Latent-resurrection note:** if the migration *realigned* the default to 100 instead of
> dropping, **new rows would get 100**, the `=== 100` gate would become **true**, and this dead block
> would **spring to life** (resurrecting the `dev-ops` counter + the no-op fee). Because we **remove
> the block** in this chunk, that risk is neutralized regardless of migration shape — but it is a
> second independent argument for **DROP over realign**.

### 4.2 `apps/web/src/app/api/sdk/meter-with-metadata/route.ts` — dead select (`:140`)
- `:137-145` selects `{ developerId: tools.developerId, revenueSharePct: developers.revenueSharePct }`
  via `innerJoin(developers)`. The result `toolDev` is used for `if (!toolDev)` (`:147`) and
  `toolDev.developerId` (later, the credit update); **`revenueSharePct` is never read** (grep in file:
  only `:140`). Credit uses `developerShareCents = body.costCents` (`:153`, full).
- **Removal:** delete the `:140` field. The `innerJoin(developers)` then sources **nothing** from
  `developers` → the join becomes orphaned. **Decision deferred to plan** (see §8): keep the join
  (smallest, provably-neutral, leaves a redundant join) vs drop it (honest cleanup; provably neutral
  because `tools.developerId` is `notNull().references(developers.id)` — schema `tools:5-7` — so the
  inner join never filters). The GROSS writer at `:191` (`developers.balanceCents + developerShareCents`)
  is a separate UPDATE — untouched either way (billing-credits count stays 1; §6).

### 4.3 `apps/web/src/app/api/proxy/[slug]/route.ts` — three dead chains (`:117/156/229`, `:1209`, `:1485/1510/1581`)
- **API-key path** (`authenticateProxyRequest`): `:156` selects `revenueSharePct`; `:229` assigns it
  to the returned `developerRevenueSharePct`; `:117` is its return-type field. grep proves **no caller
  reads `.developerRevenueSharePct`** (only occurrences in the whole file are `:117` decl + `:229`
  assign). Dead chain → remove `:117`, `:156`, `:229`.
- **MPP path** (`handleMpp…`, ~`:1199`): `:1209` selects `revenueSharePct`; never read in the function
  body (grep `revenueSharePct` 1240-1480 → none). Dead → remove `:1209`.
- **`lookupToolBySlug` → `forwardAndBill`**: `:1485` selects `revenueSharePct`; `:1510` puts it on
  `verifiedTool`; `:1581` is the `forwardAndBill` param-type field. grep proves **no `revenueSharePct`
  reference exists after `:1581`** → `forwardAndBill`'s body never reads it. All 9 `forwardAndBill`
  call sites pass `lookup.toolRow` (= `verifiedTool`). Dead chain → remove `:1485`, `:1510`, `:1581`
  together (tsc stays consistent: field + param-type removed in lockstep).
- For `:156`, `:1209`, `:1485` the `innerJoin(developers)` sourced **only** `revenueSharePct` → same
  orphaned-join decision as §4.2 (deferred to plan; FK-non-filtering proof holds). Proxy has **5 GROSS
  balance writers** asserted by billing-credits (§6) — none of them is a dead ref; all untouched.

### 4.4 Display refs (auth/me, settings, email) — all already progressive; values never rendered
- **`apps/web/src/app/api/auth/developer/me/route.ts:40`** selects `revenueSharePct` into the returned
  `developer`. Consumer: the settings page type (`:35`). **Never rendered** (see next). Remove `:40`.
- **`apps/web/src/app/(dashboard)/dashboard/settings/page.tsx:35`** declares `revenueSharePct: number`
  on the developer type. The two "Revenue Share" UI sites render **static** strings, not the field:
  `:1260-1266` literal "Progressive (0% on first $1K/mo…)"; `:1788` renders `{revenueShare}` where
  `revenueShare = 'Up to 100%'` is a **local string constant** (`:1779`), unrelated to
  `developer.revenueSharePct`. So `:35` is a dead type field → remove it.
- **`apps/web/src/lib/email.ts:364`** — `stripeConnectCompleteEmail(name, options?: { preheader?,
  revenueSharePct? })`. The body (`:371`) already uses progressive language ("Revenue split:
  Progressive take rate — 0% on your first $1K/mo"); `revenueSharePct` is **never read** in the
  function (grep `revenueSharePct` in email.ts → only `:364`) and **no caller passes it**. Dead
  optional param → remove `revenueSharePct?` from the options type.
- **Verdict:** all three display surfaces are already on progressive language; the refs are pure dead
  weight. **No `getProgressiveTakeLabel()` swap is needed** — the UI/email copy is already correct.

### 4.5 `apps/web/src/lib/metering.ts:298` — the legacy ignored param
- `recordInvocationAsync(params)` declares `revenueSharePct: number // Legacy — ignored…` (`:298`).
  The destructure at `:303` **omits** `revenueSharePct`; the developer credit (`:346-358`) uses
  `developerShareCents = costCents` (`:306`, full). The param is genuinely unused.
- **Removal:** delete the `:298` param field. The **only caller passing it** is
  `meter/route.ts:313` (removed in §4.1) — and **test** `metering.test.ts:184` passes
  `revenueSharePct: 95` → that becomes a tsc excess-property error → **forced test edit** (§5).

---

## 5. TRACE-MUST (e/f) — the migration toolchain + EVERY forced test edit

### 5.1 ⚠️ MAJOR FINDING: `drizzle-kit generate` is UNUSABLE here — hand-write the migration

The migration meta is **deliberately partial** and inconsistent with the live DB:
- `drizzle/meta/` contains **only** `_journal.json` + `0000_snapshot.json` — **no snapshots for
  0001-0013.**
- The journal has **3 entries** (0000, 0001, 0008) but there are **15 `.sql` files** (0000-0013, two
  sharing the 0010 prefix).
- `0000_snapshot.json`'s `developers` table reflects the **original** schema (it still has
  `api_key_hash`, `clerk_user_id`; it is **missing** `slug`, `supabase_user_id`, `stripe_customer_id`,
  `notification_preferences`, `log_retention_days`, `invite_code`, `bonus_ops_balance`,
  `is_founding_member`, `onboarding_paused*`, `payout_schedule_weekday/month_day`, … — all added by
  hand-written migrations 0002-0013).
- The established convention (documented in `apps/web/scripts/bootstrap__drizzle_migrations.sql`):
  migrations 0002-0007 and 0009-0013 were **hand-written** and applied via the Supabase SQL Editor,
  then **registered by seeding a sha256 hash row** into `drizzle.__drizzle_migrations` (so
  `drizzle-kit migrate`'s `MAX(created_at)` skip-logic won't re-apply them). They were **not** added
  to the journal and got **no snapshot**.

**Consequence:** running `npx drizzle-kit generate` would diff the **current** `schema.ts` (~35 dev
columns + many other tables) against `0000_snapshot.json` (the original 19-column shape) and emit a
**massive, wrong** migration (ADD ~15 columns that already exist in prod, DROP `api_key_hash` /
`clerk_user_id`, etc.). **It must NOT be run.** The correct, convention-matching move is to
**hand-author** the next migration:

- File: `apps/web/drizzle/0014_drop_revenue_share_pct.sql`
  ```sql
  ALTER TABLE "developers" DROP COLUMN IF EXISTS "revenue_share_pct";
  ```
  (`IF EXISTS` for idempotent one-shot paste safety — Audit R2 optional-hardening; bare `DROP COLUMN`
  is also repo-valid.)
- Register it by appending one `INSERT … WHERE NOT EXISTS` hash row to
  `bootstrap__drizzle_migrations.sql` (sha256 of the new `.sql`, mirroring the 0013 entry), with a
  comment noting it ships with (C) and is applied via SQL Editor post-deploy.
- **Do NOT** touch `_journal.json` or create a snapshot (consistent with 0002-0013).
- **Generating the file is in scope; APPLYING it is founder-gated** (real-money guardrail).

### 5.2 Expand/contract & deploy-ordering (the trace's input to the plan-gate decision)

A column **DROP** on a populated table is safe **iff no live code reads the column when the DROP
runs.** After this chunk removes every `revenueSharePct` ref from `src` + `schema.ts`, the
**deployed code no longer SELECTs `revenue_share_pct`** — so the DROP is safe **once that code is
live.** The natural **expand/contract** ordering:

1. **Deploy** the code bundle (current N/F2/F4/R stack + this (C) code+schema edit). Now no instance
   reads the column.
2. **Apply** `0014_drop_revenue_share_pct.sql` via SQL Editor (founder-gated) + seed the bootstrap
   hash row.

Applying the DROP **before** the code is live would break the *old* instances mid-rollout (they'd
`SELECT revenue_share_pct` against a dropped column). Applying it **after** is safe. Because prod is
dormant and the column is already dead on the live path, the risk is minimal either way, but the
**code-first, drop-after** order is the disciplined choice. **Plan-gate recommendation: ship (C)'s
code + the generated 0014 file with the current bundle; apply 0014 only after the bundle deploys.**
(This aligns with the founder's non-binding lean in handoff §0.)

### 5.3 Forced test edits (would FAIL or fail-tsc if not edited)

**Definitely forced:**
1. **`src/lib/__tests__/metering.test.ts:184`** — passes `revenueSharePct: 95` to
   `recordInvocationAsync`. Removing the param (§4.5) makes this a **tsc excess-property error** →
   delete that argument line. (Plan: Batch 1f, co-located with the param removal.)
2. **`apps/web/scripts/seed-admin.ts:51` (Audit R1 — the missed one).** A **typed** Drizzle insert
   `db.insert(developers).values({ … revenueSharePct: 97, … })` (`:45-54`). `scripts/` is in the tsc
   program (`tsconfig.json` include `'**/*.ts'`; exclude only `node_modules`; `strict:true`), so once
   `schema.ts:27` drops the column this insert throws **TS2769** → `tsc --noEmit` RED. → delete the
   `revenueSharePct: 97,` line **in the same batch as the schema drop** (plan Batch 4a-bis).
   Behavior-neutral (seeded value feeds no money math). (`seed-dashboard-data.ts:241` is a JSON string
   literal in an audit-log fixture, **not** a typed column ref → not forced.)
3. **`src/lib/__tests__/db-schema.test.ts:57-59`** — `it('has revenueSharePct column', () => expect(
   schema.developers.revenueSharePct).toBeDefined())`. After we remove the column from `schema.ts`,
   `schema.developers.revenueSharePct` is `undefined` → FAILS → **delete this `it` block** (the
   column is intentionally gone). It is the **only** real-schema accessor of the column in tests.
4. **NEW behavior-change test (must be AUTHORED) — proves the flat-fee removal, fails pre-fix.**
   The existing `finalizeSession` describe (`multi-hop.test.ts:691-728`) covers **only** error paths
   (not-found, already-finalized); `processSettlementBatch` describe (`:733-739`) covers only
   batch-not-found. **The disbursement math is entirely untested today** → *no existing test breaks
   on the fix*, and a new test is required by the gate. **Authored as a NEW bespoke-mock file**
   `apps/web/src/lib/settlement/__tests__/finalize-take-model.test.ts` — NOT in the shared
   `multi-hop.test.ts` harness, whose DB mock hardcodes `from()→selectFromFn('sessions')`
   (`multi-hop.test.ts:147`) and returns `.where()` shapes without a thenable `.limit`, so it
   **cannot** drive the deferred branch's `tools`/`developers` `IN(...)` selects (this is exactly why
   that path is untested). The bespoke mock drives the full deferred path (session select →
   active→finalizing `update().returning` → tools `IN` → developers `IN` with `revenueSharePct: 85` →
   `insert(settlementBatches).returning` capturing the values) and asserts the batch
   `platformFeeCents === 0` and each disbursement `amountCents === <full hop total>` /
   `platformFeeCents === 0`. On **pre-fix** code: `ceil(amount×0.15)` fee / post-fee credit → **FAILS**;
   **post-fix** → PASSES. No existing mock weakened (new file only).

**Reclassified NOT forced (Audit R1 — leave UNTOUCHED, minimal churn):**
- **`src/app/api/__tests__/settings.test.ts:116/122/138`** — the me-route test's mock `select` is
  `mockReturnThis()` (ignores the projection) and returns a fixed developer object *including*
  `revenueSharePct: 95`; the route returns it verbatim (`successResponse`, no projection). So removing
  the me-route `:40` select field leaves `data.developer.revenueSharePct === 95` (`:138`) **green** —
  NOT a fail-pre-fix test, NOT forced. Left untouched (the mildly-stale title/assertion exercise the
  mock, not the dropped column). *(My initial DRAFT mis-listed this as forced; corrected.)*

**Likely NOT forced (verify empirically in Phase 4; expected harmless):**
- Schema-mock column maps that merely *list* `revenueSharePct: 'revenue_share_pct'` inside a
  `vi.mock('@/lib/db/schema', …)` factory — untyped object literals, so a dropped real column does
  **not** break them at compile or run time:
  `billing.test.ts:59`, `payout-safety.test.ts:66`, `payouts.test.ts:59`,
  `payouts/__tests__/process.test.ts:64`, `sdk.test.ts:82`, `test-mode.test.ts:80`,
  `settlement-moat.test.ts:63`, `multi-hop.test.ts:260`. (May be trimmed for tidiness during build,
  but not required.)
- `mockResolvedValueOnce` results that *over-provide* `revenueSharePct` to the meter route's
  `toolDev` select (`test-mode.test.ts:250/281`, `sdk.test.ts:347/377/400/421`,
  `metering.test.ts:184`-region mocks): after the route stops selecting the field, the extra mock
  property is simply ignored → harmless. (`metering.test.ts:184` itself IS forced — that's the
  *argument*, not a select mock.)
- Proxy settlement tests mocking `revenueSharePct: 100`
  (`x402-proxy-settlement.test.ts:97`, `circle-nano-proxy-settlement.test.ts:93`): over-provided
  fields on lookup mocks → harmless once the route stops selecting/typing the field. Verify in build.
- `multi-hop.test.ts:41` (the `MockDeveloper.revenueSharePct` interface field) and `:711`
  (`settlementMode: 'deferred'`): **keep** — the new behavior-change test *needs* `mockDevelopers` to
  carry a `revenueSharePct` so it can prove the fee is ignored. (The mock field models the DB column
  that still exists until 0014 is applied; harmless and useful.)

**Source-regex guard — `billing-credits.test.ts` (stays GREEN, no edit):** it scans
`proxy/route.ts`, `meter/route.ts`, `meter-with-metadata/route.ts`, `metering.ts` for (a) **absence**
of NET writers `balanceCents += X * revenueSharePct/100` — removing refs keeps absence true; and (b)
**exact counts** of GROSS writers: proxy **5**, meter **1**, metering **1**, meter-with-metadata
**1** (`:84-120`). My cleanup touches only dead SELECT/type/passthrough refs, **never** a
`developers.balanceCents + {costCents|developerShareCents|…}` writer → all counts preserved → green.

---

## 6. Byte-stable spine (must NOT change) — re-confirmed boundaries

`lib/pricing.ts` brackets/rates (this chunk makes sessions USE the model, never re-tunes it);
`lib/payouts/**` take logic (already authoritative — untouched; the fix needs **zero** payout
change); the meter **credit** path (`metering.ts` `developerShareCents = costCents` and its
`balanceCents` writer; meter-with-metadata's credit writer); `deductCreditsRedis` / balance authority
/ dedup / B4 `account_id`; `lib/rate-limit.ts` + keying; `lib/crypto.ts hashApiKey` + key formats;
x402/ap2/circle-nano/outcomes adapters; ALL of `packages/mcp`; ALL of `packages/sdk-python*`;
F2/F4/N/M/H1/R settled designs. The **one** intended behavior change is the sessions flat-fee
removal (§2.4). Everything else is behavior-neutral dead-ref deletion + the (founder-gated) DROP.

---

## 7. The intended SINGLE take model (design premise for the plan) — stated explicitly

> **SettleGrid takes its platform fee exactly once, progressively, at payout time, on the developer's
> entire pooled `balanceCents` (`calculateTakeCents`, `lib/pricing.ts`). Every revenue path — meter
> and sessions alike — credits the developer the FULL amount at settlement time and applies NO fee at
> credit time. `revenueSharePct` (the flat take model) is fully retired: dead in code, dropped from
> the schema.**

The plan implements this by setting the deferred/atomic disbursement to full-credit / zero-fee
(§2.4), deleting all dead refs (§4), removing the `recordInvocationAsync` legacy param (§4.5), and
DROPping the column via the hand-written 0014 migration (§5.1), generated-not-applied.

---

## 8. Open decisions explicitly handed to the PLAN gate

1. **Orphaned `innerJoin(developers)` in `meter-with-metadata` (~:143), proxy auth (~:160), proxy MPP
   (~:1212), proxy lookupToolBySlug (~:1488):** after removing the dead `revenueSharePct` field, these
   joins source nothing from `developers`. **Keep** (smallest change; one redundant join each;
   unambiguously neutral) **or drop** (honest cleanup; provably neutral via the `tools.developerId
   NOT NULL` FK → join non-filtering). *Lean:* **drop the now-orphaned joins** for honest dead-path
   removal, **but** verify no source-regex/SQL-shape test asserts on the join — if any does, keep the
   join. (meter/route's join STAYS regardless — it still sources `developerTier`.)
2. **Migration shape:** DROP (recommended, §1/§5) vs realign default. *Lean:* **DROP** via hand-written
   `0014_drop_revenue_share_pct.sql` + bootstrap hash row; generated-not-applied.
3. **Deploy-ordering:** ship (C) code + 0014 file with the current N/F2/F4/R bundle; apply 0014
   post-deploy (expand/contract, §5.2). *Lean:* **ship with the bundle, apply after.**
4. **Test-mock tidy-trim scope:** edit only the **forced** tests (§5.3 items 1-4); leave harmless
   schema-mock maps in place to minimize churn (confirm during the per-batch suite runs).

---

## 9. Evidence index (every file:line was opened or grepped THIS session)

- Drift: `schema.ts:27`, `0000_polite_moonstone.sql:96`, live `information_schema` (default 85; 12×85/3×95/0×100), `drizzle/meta/0000_snapshot.json` (only snapshot; original dev columns).
- Centerpiece: `sessions.ts:508-558` (immediate), `:560-654` (deferred/atomic), `:585-611` (fee math), `:628-636` (batch insert), `:663-767` (processSettlementBatch credit `:690`); `payouts/process.ts:259-261`; `pricing.ts:4/21-55`; `metering.ts:304-306/346-358`.
- Latency: cron list (`vercel.json` crons), `settlement-reconcile/route.ts:35` → `reconcile.ts` (no batch processor), no inngest/queue, `createSession` `:135` immediate-only, `settlementMode` grep.
- Dead refs: `meter/route.ts:28/92/105/109/118/124/313` + `dev-ops:` sole ref `:113`; `meter-with-metadata/route.ts:140/153/191`; `proxy/[slug]/route.ts:117/156/229/1209/1485/1510/1581` + `forwardAndBill` 9 call sites (+1 def); `auth/developer/me/route.ts:40`; `settings/page.tsx:35/1260-1266/1779/1788`; `email.ts:364/371`; `metering.ts:298/303`.
- Migration toolchain: `drizzle.config.ts`, `drizzle/meta/_journal.json` (3 entries), single `0000_snapshot.json`, `scripts/bootstrap__drizzle_migrations.sql` (hash-seed convention), `tools` FK `schema.ts (tools).developerId notNull().references(developers.id)`.
- Tests: `multi-hop.test.ts:5-120/38-53/691-739` (harness + untested math), `db-schema.test.ts:57-59`, `settings.test.ts:116-138`, `metering.test.ts:184`, `billing-credits.test.ts:35-120` (regex guards + GROSS counts), `settlement-moat.test.ts:50-63`.
