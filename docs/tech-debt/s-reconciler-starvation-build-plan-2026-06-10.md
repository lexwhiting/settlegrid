# (S) Reconciler starvation-at-scale + truthful run telemetry — BUILD PLAN (2026-06-10)

> **STATUS: PLAN_READY (audited).** R1 HIGH-STAKES audit `wf_bc93befc-f83` (7 opus lenses
> coverage-mode, 35 findings → 9 sustained post-refute → 1 blocking + 5 improvements — ALL
> folded); R2 re-audit `wf_8857f2ee-cbd` → PLAN_READY, 0 blocking, 3 nits (folded). Verdicts:
> `.audit/s-prebuild/R1-verdict.txt`, `R2-verdict.txt`; probes 21/21 `probes/RESULTS.txt`.
> Companion to `s-reconciler-starvation-trace-2026-06-10.md` (decisions) and
> `s-reconciler-starvation-handoff-2026-06-10.md` (spec). HEAD `c05d0203`. Baselines anchored
> this session: tsc 0 · vitest 4322 pass / 186 files / 0 fail · mcp untouched · python untouched.

## Bar (verbatim from handoff §1)
"No pending settlement row can be starved of eventual examination; every genuinely-overdue
pending row is alerted, classified honestly; the run summary reports only true transitions; the
exactly-once credit machinery is byte-identical."

## SCOPE GUARD
IN: the 8 files in §R below + docs + audit artifacts. OUT (reject on sight): B1.1, (G) seal
residuals, edits to `creditSettlement` / `markSettlement*` / `confirmSettlementTx` /
`RECONCILABLE_RAILS` / the `isNotNull(externalRef)` guard / `reconcileOneRow` on-chain outcome
semantics / packages/mcp / packages/rails / sdk-python. The ONLY `reconcileOneRow` edit is the
two flipped-false return values (R1.2). No push, no prod env, no migration APPLY, DB read-only.

## R — Per-file recipes

### R1. `apps/web/src/lib/settlement/reconcile.ts`
**R1.1 — `ReconcileOutcome`** (:49-56): add `'settled-noop'` and `'failed-noop'` members.

**R1.2 — `reconcileOneRow` truthful returns** (the ONLY edits inside this function):
- settled branch (:135): `return 'settled'` → `return flipped ? 'settled' : 'settled-noop'`.
- failed branch (:150): `return 'failed'` → `return flipped ? 'failed' : 'failed-noop'`.
The credit gate (`if (flipped && …)` :122) and every log line are UNCHANGED.

**R1.3 — `ReconcileSummary`** (:255-262): add fields
`noop: number` (true count of raced no-op flips), `errored: number` (rows that threw —
today they vanish from every bucket), `overdue: number | null` (total pending rows on
reconcilable rails older than `overdueAfterMs`; `null` = the overdue check itself failed).
`settled`/`failed` now count TRUE transitions only. `pending`/`skipped` arithmetic unchanged.
Invariant: `scanned === settled + failed + pending + skipped + noop + errored`.

**R1.4 — `emptyOutcomes()`** (:264-274): add `'settled-noop': 0, 'failed-noop': 0`.

**R1.5 — `reconcilePendingSettlements` rotation (LB-1, per-row mark-BEFORE-examine — v2,
probe-corrected):**
- opts gains `overdueAfterMs?: number`; `const overdueAfterMs = opts?.overdueAfterMs ?? 6 * 3_600_000`.
- SELECT (:291-298) adds `id: ledgerEntries.id, createdAt: ledgerEntries.createdAt`.
- ORDER BY (:315) becomes rotation order:
  ```ts
  .orderBy(sql`${ledgerEntries.lastReconciledAt} ASC NULLS FIRST`, asc(ledgerEntries.createdAt))
  ```
  (NULLS FIRST is load-bearing — PG ASC defaults NULLS LAST, which would deprioritize every
  never-examined row: the LB-1 trap, demonstrated by probe P3g. drizzle 0.38 `asc()` has no
  nulls arg → raw `sql`.)
- **Watermark strategy — per-row, immediately BEFORE examining that row** (probe matrix
  P3e/P3f/P3h/P3i, `.audit/s-prebuild/probes/RESULTS.txt`): batch mark-at-select (plan v1)
  leaves a stable never-examined orbit under a repeating capacity crash (maxDuration timeout
  under slow RPC — 30/35 coverage); mark-after-examine stalls under a poison row that kills the
  run when examined (7/35). Mark-before-examine survives BOTH (35/35 and 34/34-reachable): the
  killing row is already watermarked when it kills, so it rotates out; unexamined tail rows are
  NOT watermarked, so they keep their place.
  ```ts
  let watermarkFailures = 0
  for (const row of rows) {
    try {
      await db
        .update(ledgerEntries)
        .set({ lastReconciledAt: new Date() })
        .where(eq(ledgerEntries.id, row.id))
    } catch {
      watermarkFailures++ // rotation degrades for THIS row this run; examination proceeds
    }
    try {
      outcomes[await reconcileOneRow(row)]++   // existing loop body, + errored++ in catch (R1.6)
    } catch (err) { /* R1.6 */ }
  }
  if (watermarkFailures > 0)
    logger.error('reconcile.watermark_update_failed', { count: watermarkFailures })
  ```
  No status guard on the watermark UPDATE: it touches only the new column; setting it on a
  concurrently-flipped row is harmless (flipped rows leave the window via `status !=
  'pending'`). Cost: ≤25 single-row indexed-PK UPDATEs per run on a 15-min cron — negligible
  next to the per-row RPC confirm.

**R1.6 — loop tallies** (:318-326): `let errored = 0`; the catch increments `errored++` (log
line unchanged). SEPARATELY track per-class counts of THIS run's examined-and-still-stuck
OVERDUE rows (`row.createdAt < overdueCutoff`), keyed by outcome → class map:
`pending-nonce-consumed` → `nonceConsumed`, `pending-unconfirmed` → `unconfirmed`,
`skipped-unparseable` → `unparseable`, `skipped-unsupported` → `unsupported`, thrown →
`examinedErrored` (declare `let examinedErrored = 0`, incremented in the loop catch ONLY when
`row.createdAt < overdueCutoff` — DISTINCT from the summary's run-level `errored`, which counts
every thrower). Terminal outcomes (settled/failed and both noops) are NOT stuck — excluded.

**R1.7 — pending-age classified alert (LB-2 / DC-18; mechanism = structured `logger.error`,
the verified operator channel — trace (c)):** after the loop:
  ```ts
  const overdueCutoff = new Date(Date.now() - overdueAfterMs)
  let overdue: number | null = null
  try {
    const [agg] = await db
      .select({
        total: sql<number>`count(*)`,
        noTxhash: sql<number>`count(*) filter (where ${ledgerEntries.externalRef} is null)`,
        oldestCreatedAt: sql<string | null>`min(${ledgerEntries.createdAt})`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.settlementStatus, 'pending'),
          inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
          lt(ledgerEntries.createdAt, overdueCutoff),
        ),
      )
    overdue = Number(agg.total)
    if (overdue > 0) {
      logger.error('reconcile.pending_overdue', {
        overdueCount: overdue,
        noTxhashCount: Number(agg.noTxhash),       // settle-path-owned class (outside the window by design)
        // min(created_at) comes back from postgres-js as a STRING — a literal
        // subtraction would be NaN telemetry (DC-18). R6 test 5 pins non-NaN.
        oldestPendingAgeMs:
          agg.oldestCreatedAt !== null ? Date.now() - new Date(agg.oldestCreatedAt).getTime() : null,
        overdueAfterMs,
        examinedThisRun: { nonceConsumed, unconfirmed, unparseable, unsupported, errored: examinedErrored },
      })
    }
  } catch (err) {
    logger.error('reconcile.overdue_check_failed', {}, err)   // never aborts the run
  }
  ```
  Notes pinned for the audit: (i) deliberately NO `isNotNull` here — the §1 bar alerts EVERY
  overdue pending row; null-`external_ref` rows are classified `noTxhash`, not admitted to the
  window. (ii) ONE error line per run while the condition persists (not per-row) — the
  anti-spam posture; mirrors `settlement.credit_failed` precedent. (iii) Default 6h = 24 cron
  runs; Base txs confirm in seconds, so 6h is unambiguously anomalous yet immune to transient
  RPC outages. (iv) count(*) FILTER / min() come back as driver strings → wrap in Number()/Date.

**R1.8 — return** (:328-338): add `noop: outcomes['settled-noop'] + outcomes['failed-noop']`,
`errored`, `overdue`. Top-level `settled: outcomes.settled` / `failed: outcomes.failed` now
exclude noops BY CONSTRUCTION (separate outcome keys).

### R2. `apps/web/src/lib/db/schema.ts` (ledgerEntries, :844-953)
In the P3.K4 settlement-columns block (after `externalRef` :892): add
```ts
// (S) 2026-06-10 — reconciler rotation watermark. Set PER-ROW immediately
// BEFORE that row is examined (mark-before-examine; batch mark-at-select and
// mark-after-examine were REJECTED — they exclude rows under repeating
// capacity-crash / poison-row runs, see the (S) trace §b + probe P3 matrix).
// ORDER BY last_reconciled_at ASC NULLS FIRST, created_at ASC makes the bounded
// window a fair rotation: deferral, never exclusion (a sticky row can occupy
// the window at most once per rotation). NULL = never examined (sorts FIRST —
// do not backfill).
lastReconciledAt: timestamp('last_reconciled_at', { withTimezone: true }),
```
and in the index list (after :918): `index('ledger_entries_last_reconciled_at_idx').on(table.lastReconciledAt),`.

### R3. NEW `apps/web/drizzle/0015_reconcile_watermark.sql` (HAND-WRITTEN — do NOT run drizzle-kit generate; APPLY is founder-gated)
Hand-written per the 0014 precedent — drizzle-kit generate would diff the intentionally-partial
meta snapshot and emit a wrong migration. Header comments: purpose, NULLS-FIRST semantics,
**APPLY-THEN-DEPLOY** (additive column the NEW code SELECTs/ORDERs on ⇒ code-first breaks the
prod cron every 15 min; old code ignores the new column ⇒ apply-first is zero-impact), and the
SQL-Editor idempotency note. Body:
```sql
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "last_reconciled_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "ledger_entries_last_reconciled_at_idx" ON "ledger_entries" ("last_reconciled_at");
```
Nullable, NO default, NO backfill.

### R4. `apps/web/scripts/bootstrap__drizzle_migrations.sql`
Append the 0015 hash row before COMMIT (existing `WHERE NOT EXISTS` pattern):
hash = `shasum -a 256` of the final 0015 file (compute AFTER R3 is final; verified convention:
0014's registered hash == sha256 of file bytes), created_at = `1781049600000`
(2026-06-10 00:00 UTC > 0014's 1780790400000). Update the POST-RUN VERIFICATION footer:
"Expected: 16 rows. MAX(created_at) = 1781049600000 (0015_reconcile_watermark)."

### R5. `apps/web/src/app/api/cron/settlement-reconcile/route.ts`
Extend the `cron.settlement_reconcile.done` log (:36-42) with `noop: summary.noop,
errored: summary.errored, overdue: summary.overdue`. Response body is already
`successResponse(summary)` — additive, no other change.

### R6. `apps/web/src/lib/settlement/__tests__/reconcile.test.ts`
- Schema mock (:42-55): add `id: 'id'` and `lastReconciledAt: 'last_reconciled_at'` only
  (`createdAt` already present at :48).
- `mockDb` (:20-27): add db-level `update`/`set` chain for the watermark UPDATE
  (`db.update(...).set(...).where(...)` — resolves to anything; distinct from `mockTx`).
  The second SELECT (overdue aggregate, no `.orderBy/.limit`) terminates at `.where(...)` —
  rework the chain so each `db.select()` call returns a FRESH chain object backed by a
  per-call result queue (window rows for call 1, aggregate `[{ total, noTxhash,
  oldestCreatedAt }]` for call 2). Call-1's (window) terminal `.limit()` must CONTINUE to
  delegate to `mockDb.limit` so every existing `mockDb.limit.mockResolvedValue(...)` test
  passes un-edited; ONLY call-2 (the aggregate, terminating at `.where()`) is served from the
  per-call queue/default. Default aggregate result `[{ total: 0, noTxhash: 0,
  oldestCreatedAt: null }]` in `beforeEach` so all existing tests pass un-edited in behavior.
- Existing summary test (:316-339): extend asserts — `noop: 0`, `errored: 0`, invariant
  `scanned === settled+failed+pending+skipped+noop+errored`.
- "one row throwing" test (:341-353): add `expect(summary.errored).toBe(1)`.
- NEW tests:
  1. `flipped:false on settled → 'settled-noop'` (+ no credit — reuses the existing
     flip-LOST scenario, now asserting the outcome AND summary `noop:1, settled:0`).
  2. `flipped:false on failed → 'failed-noop'`.
  3. Per-row watermark UPDATE issued for each selected row id, BEFORE that row's
     `confirmSettlementTx` call (per-row call-order assertion), and zero UPDATEs when 0 rows.
  4. A watermark UPDATE throwing → that row still examined, run completes,
     `reconcile.watermark_update_failed` logged ONCE with the failure count.
  5. Alert: aggregate total>0 → ONE `reconcile.pending_overdue` logger.error with classified
     payload (incl. `noTxhashCount`, `examinedThisRun` breakdown from an overdue
     nonce-consumed row in the window, AND `oldestPendingAgeMs` a finite non-NaN number when
     the mocked aggregate returns `oldestCreatedAt` as a postgres-js-style STRING — pins the
     Date conversion, DC-18); total=0 → no alert; aggregate query throws → `overdue: null`,
     `reconcile.overdue_check_failed`, run completes.
  6. FROZEN-SPINE pins stay green un-edited: credit-on-flip suite (:185-298 incl. B4 guard),
     funds-safety mapping (:133-183), RECONCILABLE_RAILS pin (:355-362).

### R7. NEW `apps/web/src/lib/settlement/__tests__/reconcile-starvation.test.ts` — the LB-1 regression (MUST FAIL PRE-FIX) — re-specified per R1 audit (blocking finding)
Self-contained mocks (own `vi.mock` set) around a stateful in-memory table whose chain
EXECUTES what the code emits — not arg-shape assertions:
- The mocked drizzle operators return inspectable nodes (same shapes as R6's mocks); a small
  interpreter applies the captured WHERE conjuncts (eq/inArray/isNotNull/lt) as filters and the
  captured ORDER BY list as a sort — including the `sql` node for
  `last_reconciled_at ASC NULLS FIRST` (detect via the template's literal containing
  `ASC NULLS FIRST`; sort key = the interpolated column ref, nulls first) — then applies
  `limit`. The mocked update chain `db.update().set({lastReconciledAt}).where(eq(ledgerEntries.id,
  <single id>))` — the PER-ROW shape R1.5 actually emits, once per loop iteration (NOT a batch
  `inArray(id, ids)`; an interpreter keyed to the batch shape would never apply the watermarks
  and the test could not distinguish fixed from broken — R1 audit blocking finding (a)) —
  mutates that one row in the same in-memory table. `confirmSettlementTx` mock: sticky rows
  resolve `{ kind: 'unconfirmed' }`, confirmable rows `{ kind: 'settled' }`;
  `markSettlementSettled` mock flips the in-memory row's status.
- Scenario A (rotation guarantee — probe P3c's provable property; the earlier "zero
  re-examination across runs" assertion is mathematically FALSE post-fix because the window
  REFILLS with re-examined rows behind the never-examined ones — R1 audit blocking finding (b)):
  30 sticky pending rows, limit 25. Run 1 examines+marks 25. Assert on run 2's window: (i) all
  5 still-NULL-watermark rows are IN the window, and (ii) every re-examined (watermarked) row in
  the window sorts AFTER every NULL-watermark row (none displaced). Equivalently: a sticky row
  must not occupy the window two consecutive runs AHEAD of any never-examined pending row.
  **Pre-fix fails** (pre-fix run-2 window = the same oldest-25; the 5 newest never enter).
- Scenario B (reach-within-K): 30 sticky (oldest) + 5 confirmable (newest), limit 25; assert
  every confirmable row reaches `markSettlementSettled` within 2 runs. **Pre-fix fails**
  (confirmable rows never selected).
- Empirical fail-pre-fix proof (step 4): run this file against the PRE-fix `reconcile.ts`
  (stash/order the edits so the test lands first), capture red output to
  `.audit/s-build/starvation-test-prefix-fail.txt`, then land the fix and capture green.

### R8. `apps/web/src/app/api/cron/settlement-reconcile/__tests__/route.test.ts`
Extend the mocked summary with `noop/errored/overdue` + outcomes keys; assert the done-log
includes the new fields.

## Gates (executable, in order)
1. `npx tsc --noEmit` → 0 (apps/web).
2. `npx vitest run` → 4322 + N pass / 0 fail (N = new tests; count recorded at build).
3. `npm run build` (apps/web) → 0 errors.
4. `npx eslint <changed .ts files>` → 0.
5. `packages/mcp`: `git diff --numstat packages/` → EMPTY (byte-stable; 1898/1-skip suite not
   re-run unless diff non-empty).
6. Python: `git diff --numstat` shows no sdk-python paths.
7. `git diff --numstat` confined to: `reconcile.ts`, `schema.ts`, `drizzle/0015_*.sql` (new),
   `scripts/bootstrap__drizzle_migrations.sql`, cron `route.ts`, `reconcile.test.ts`,
   `reconcile-starvation.test.ts` (new), cron `route.test.ts`, `docs/tech-debt/s-*`,
   `.audit/s-prebuild/**`, `.audit/s-build/**`.
8. Fail-pre-fix artifacts exist in `.audit/s-build/` (red pre-fix + green post-fix).

## Founder runbook (surfaced at close; LB-2 pin)
**APPLY-THEN-DEPLOY — inverse of 0014:** (1) paste `0015_reconcile_watermark.sql` into the
Supabase SQL Editor (idempotent); (2) seed the 0015 hash row from the bootstrap script;
(3) ONLY THEN push/deploy the (S) bundle. Deploying code first breaks the reconcile cron
(SELECT references a missing column) every 15 min until the migration lands.

## Interval self-verification plan (step 4)
Fresh-context sonnet read-only diff vs handoff §1/§2/§4 after each batch: (i) rotation landed
(R1.5/R2/R3/R4), (ii) alert + summary landed (R1.1-R1.4, R1.6-R1.8, R5), (iii) tests landed
(R6-R8 + fail-pre-fix proof). Re-confirm every reported hit live before acting.
