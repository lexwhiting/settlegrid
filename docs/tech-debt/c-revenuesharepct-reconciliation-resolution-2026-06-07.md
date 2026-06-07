# (C) revenueSharePct take-model reconciliation — RESOLUTION / CAPSTONE (2026-06-07)

> What shipped, the funds math, the audit-chain verdicts, the migration + deploy-ordering decision, and
> the residuals. LOCAL commit only — **NOT pushed; migration generated NOT applied; nothing published.**
> Full gate discipline (money-spine chunk): discovery trace → build plan → deep pre-build audit
> (PLAN_READY) → single-writer build → post-build **FUNDS-SEAL** (CERTIFIED) → founder-gated commit.

## 1. What this was

`revenueSharePct` was the **flat take model** that the progressive `calculateTakeCents`
(`lib/pricing.ts`) was meant to replace — but the replacement was incomplete. The column was dead on
the **meter** path (credit-full → progressive-take-at-payout, correct) EXCEPT one live divergent
consumer: `finalizeSession`'s deferred/atomic disbursement branch, which still took a **flat 15% session
fee** (from a live DB default of **85** that disagreed with the schema's `100` and that nobody chose),
then let payout take **progressively on top** — a structural **double-take** on session revenue. Plus a
trail of dead `revenueSharePct` refs and a schema/DB default drift. A Step-0 study reframed (C) from
"legacy cleanup hygiene" to a **money-spine funds-correctness reconciliation**.

## 2. What shipped (LOCAL commit)

**CENTERPIECE — the one intended behavior change** (`apps/web/src/lib/settlement/sessions.ts`,
`finalizeSession` deferred/atomic branch): the flat session fee is **removed**. Each disbursement now
credits the developer the **FULL** amount (`amountCents = entry.amountCents`, `platformFeeCents = 0`),
and the `settlementBatches` insert carries `platformFeeCents = 0`. The `developerRows`/`devMap`
`revenueSharePct` lookup was deleted (`toolDevMap` kept). **The single platform take now happens exactly
once, at payout** (`lib/payouts/process.ts:259-261`, `calculateTakeCents` on the pooled `balanceCents`)
— byte-identical to the meter path. The immediate-mode branch, `processSettlementBatch` credit,
rollback, and expiry are **unchanged**.

**Dead-ref cleanup (behavior-neutral):**
- `app/api/sdk/meter/route.ts` — removed `TIER_OPS_LIMITS`, `OVERAGE_REVENUE_SHARE_PCT`,
  `effectiveRevenueSharePct`, `const tier`, `const tierLimit`, the entire free-tier overage `if` block
  (incl. the self-contained `dev-ops:` Redis counter), the `revenueSharePct` select field, the
  `recordInvocationAsync` arg, and the now-orphaned `getRedis/tryRedis` import. Kept the `developerTier`
  select + join (live: tiered rate limiting at the `checkTieredRateLimit` call).
- `app/api/sdk/meter-with-metadata/route.ts` — removed the dead `revenueSharePct` select field + the
  now-orphaned `developers` join.
- `app/api/proxy/[slug]/route.ts` — removed three dead chains (`authenticateProxyRequest`
  return-type+select+assign; the MPP select; `lookupToolBySlug` → `verifiedTool` field →
  `forwardAndBill` param-type) + their three now-orphaned `developers` joins.
- `app/api/auth/developer/me/route.ts` — removed the dead select field.
- `app/(dashboard)/dashboard/settings/page.tsx` — removed the dead type field (the two "Revenue Share"
  UI sites were already static progressive strings).
- `lib/email.ts` — removed the dead optional `revenueSharePct?` param from `stripeConnectCompleteEmail`
  (body already uses progressive copy).
- `lib/metering.ts` — removed the legacy ignored `revenueSharePct` param from `recordInvocationAsync`;
  `metering.test.ts` dropped its arg.

**The migration (generated, NOT applied; founder-gated):**
- `lib/db/schema.ts` — dropped the `revenueSharePct` column from the `developers` table.
- NEW `drizzle/0014_drop_revenue_share_pct.sql` = `ALTER TABLE "developers" DROP COLUMN IF EXISTS
  "revenue_share_pct";` — **hand-written** (drizzle-kit `generate` is unusable here: `drizzle/meta` is
  intentionally partial — only `0000_snapshot.json` + a 3-entry journal vs 15 `.sql` files — so
  `generate` would diff against a stale snapshot and emit a wrong migration; 0002-0013 are all
  hand-written + hash-registered, the same convention).
- `scripts/seed-admin.ts` — dropped `revenueSharePct: 97` from the typed `insert(developers).values()`
  (would TS2769 against the dropped column otherwise).
- `scripts/bootstrap__drizzle_migrations.sql` — appended the 0014 hash row (sha256
  `e720ecaa…`, `created_at 1780790400000` > the prior MAX so drizzle-kit orders it last) + updated the
  POST-RUN footer (14 → 15 rows). `_journal.json`/snapshots left untouched (0002-0013 convention).
- `db-schema.test.ts` — removed the `has revenueSharePct column` test (the column is intentionally gone).

## 3. The funds math (the centerpiece — independently re-derived by the FUNDS-SEAL)

Per tool, per session disbursement:

| | BEFORE (pre-(C)) | AFTER (shipped) |
|---|---|---|
| Settlement-time fee | `Math.ceil(amount × (100 − 85)/100)` = flat **15%** | **0** |
| Credited to `balanceCents` | `amount − 15%` (post-fee) | **`amount`** (full) |
| Take at payout | progressive `calculateTakeCents` on the pooled balance | progressive `calculateTakeCents` on the pooled balance |
| Net platform take on session revenue | **15% flat + progressive** (double) | **progressive only** (single) |

Worked (re-derived by the seal against the actual diff):
- **sub-$1k/mo earner, $500 session:** BEFORE took a flat 7,500c (and payout 0 in the 0% bracket) →
  developer under-credited 7,500c; AFTER takes **0c** (0% bracket) → correct.
- **multi-bracket $60k/mo earner:** BEFORE ≈ **1,023,000c** double-take; AFTER a single **168,000c**
  marginal-bracket take (`0 + 18,000 + 100,000 + 50,000`, per `lib/pricing.ts` brackets) → correct.

`Math.ceil` is gone → integer full credit, no rounding asymmetry. The meter credit writer
(`metering.ts` `developerShareCents = costCents`; `balanceCents += developerShareCents`) and the payout
take logic are **byte-unchanged**.

## 4. Latency (why this was a latent bug, not active loss)

The double-take was **latent on three independent counts**, all re-verified: (a) `createSession`
hardcodes `settlementMode: 'immediate'` → no deferred/atomic session is ever created in prod, so the
flat-fee branch was unreachable; (b) `processSettlementBatch` has **no** route/cron/queue caller → staged
batches never credit balances; (c) prod is dormant. **No active money was lost.** (C) makes the code
correct *before* sessions carry real money.

## 5. Audit chain

- **Pre-build audit** (`.audit/c-prebuild/`, dynamic Workflow fan-out, 6 lenses → adversarial verify →
  guarded synthesis): **R1 PLAN_NEEDS_FIXES — 3 blocking** (all RED-gate, all in-scope, none
  funds-wrong): `meter/route.ts` `const tier` unused-after-deletion + `TIER_OPS_LIMITS` orphaned →
  eslint RED; `scripts/seed-admin.ts:51` typed insert → TS2769 missed forced edit. All fixed +
  independently re-verified → **R2 PLAN_READY — 0 blocking — non-degraded** (funds math independently
  re-derived clean). Verdicts: `round{1,2}-verdict.txt`.
- **Post-build FUNDS-SEAL** (`.audit/c-postbuild/`, 6 lenses incl. **migration-safety** +
  **zero-out-of-spine-diff**): **CERTIFIED — 0 blocking — 0 degraded.** Re-derived the take math,
  recomputed the migration sha256 (matches), confirmed ZERO live `developers.revenueSharePct` accessors
  remain, empty numstat across the entire spine, fail-pre-fix genuine, billing-credits GROSS 8/8.
  Verdict: `seal-verdict.txt` / `.audit/c-certify/certification-verdict.txt`.

## 6. Gates (end-state)

apps/web: `tsc` **0** · `vitest` **4283 / 182 files** (= 4282 − 1 db-schema column test + 2 new finalize
tests) · `next build` **0** · `eslint <changed>` **0**. packages/mcp: `vitest` **1898 / 1 skip**
(byte-stable). packages/sdk-python*: untouched (empty numstat). Scope: `git diff --numstat` +
`git status --porcelain` confined to the 13 tracked files + the new `0014.sql` + the new finalize test +
the `c-*` docs — **zero** pricing-rate / payout-logic / meter-credit / rate-limit / crypto / mcp /
sdk-python hunks. **Fail-pre-fix proven** (`.audit/c-build/fail-pre-fix.txt`: the new test red on pre-(C)
code, `expected 1500 to be +0`).

## 7. Deploy-ordering decision (plan gate)

**Ship (C)'s code + the generated `0014` file with the current local N/F2/F4/R bundle; APPLY `0014`
(via the Supabase SQL Editor + seed the bootstrap hash row) only AFTER that bundle deploys** —
expand/contract: deployed code stops SELECTing `revenue_share_pct` first (true after this chunk), then
the DROP is safe. Applying before deploy would break old instances mid-rollout. Prod is dormant so the
risk is minimal either way; code-first/drop-after is the disciplined order. **Applying is founder-gated.**

## 8. Residuals (honest)

- The migration `0014` is **generated, not applied** — founder applies it post-deploy.
- The sessions deferred/atomic path remains **triple-latent** (immediate-only creation + unwired
  `processSettlementBatch` + dormant prod). (C) fixes the *math*; wiring the batch processor and
  creating deferred sessions remain future, demand-gated work (the multi-hop (H) lead).
- The 3 live developer rows that carried `revenue_share_pct = 95` (and 12 at 85) lose a column that fed
  no money math — no functional data loss.

## 9. Files
- Trace: `c-revenuesharepct-reconciliation-trace-2026-06-07.md` · Plan:
  `c-revenuesharepct-reconciliation-build-plan-2026-06-07.md` (PLAN_READY) · Handoff:
  `c-revenuesharepct-reconciliation-handoff-2026-06-07.md`.
- Audit: `.audit/c-prebuild/` · `.audit/c-build/` · `.audit/c-postbuild/` · `.audit/c-certify/`.
- Register close-out: `publisher-api-keys-audit-2026-05-28.md` (UPDATE 2026-06-07 — (C)).
- Next-chunk handoff: `next-chunk-handoff-2026-06-07-post-c.md`.
