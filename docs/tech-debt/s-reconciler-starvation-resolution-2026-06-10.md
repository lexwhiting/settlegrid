# (S) Reconciler starvation-at-scale + truthful run telemetry — RESOLUTION / CAPSTONE (2026-06-10)

**Status: SEALED (② seal-gating review passed; HIGH-STAKES → ③ post-seal deep audit follows).
LOCAL commit only — NOT pushed.** Closes the **B1.4 register entirely** (items 2+3+4; item 1 was
closed by (G)) — the settlement spine's last open autonomous money-path debt.

## What shipped (8 code files; full chain: handoff → trace → audited plan → build → seal)

- **Rotation guarantee (item 2, LB-1 — deferral, never exclusion, BOUNDED):**
  `ledger_entries.last_reconciled_at` (migration `0015`, hand-written, **founder-applied to prod
  2026-06-10 BEFORE any deploy** — APPLY-THEN-DEPLOY honored) + window ordering
  **`COALESCE(last_reconciled_at, created_at) ASC, created_at ASC`** (a FIFO queue: position =
  last examined, else created) + **per-row mark-BEFORE-examine** watermark
  (`reconcile.ts` `reconcilePendingSettlements`). No WHERE change — exclusion is structurally
  impossible; the `isNotNull(externalRef)` guard is untouched.
- **Classified pending-age alert (items 2+4):** ONE `reconcile.pending_overdue` `logger.error`
  per run when pending rows on `RECONCILABLE_RAILS` exceed `overdueAfterMs` (default 6h);
  payload: `overdueCount`, `noTxhashCount` (settle-path-owned, outside the window by design),
  `oldestPendingAgeMs` (NaN-guarded), `overdueAfterMs`, `examinedThisRun`
  {nonceConsumed, unconfirmed, unparseable, unsupported, errored}. Best-effort: failure →
  `overdue: null` + `reconcile.overdue_check_failed` (carrying `examinedThisRun`), run completes.
- **Truthful telemetry (item 3):** `settled-noop`/`failed-noop` outcomes (raced flips no longer
  over-report transitions); `ReconcileSummary` gains `noop`/`errored`/`overdue: number|null`;
  invariant `scanned === settled+failed+pending+skipped+noop+errored` (test-pinned); cron
  done-log extended. `reconcile.watermark_update_failed` carries the failed rows'
  `operationIds` (≤ limit) + the last error.
- **Frozen spine byte-identical** (diff-verified at build, interval checks, AND seal):
  `creditSettlement`, all of `ledger.ts`, `settle-engine.ts`, `rails.ts`, packages/, sdk-python;
  `reconcileOneRow`'s only edits are the two flipped-false return values.
- **Regression suite** (`reconcile-starvation.test.ts`): a stateful in-memory table whose
  interpreter EXECUTES the emitted WHERE/ORDER BY/UPDATE — PG-faithful (plain `asc()` = NULLS
  LAST; COALESCE node; unhandled nodes throw). 3 scenarios, each with a captured red proof:
  rotation (`.audit/s-build/starvation-test-prefix-fail.txt`), reach-within-K=2 (same), and
  sustained-inflow (`.audit/s-seal/sealfix-proof-nullsfirst-red.txt`). Plus battery pins
  (empty aggregate; non-Error watermark rejection) in `reconcile.test.ts`.

## The seal-gating review (② — the review that decided the seal)

`wf_c7fd9ecf-2c1`: 4 hostile fresh-context **fable** lenses (correctness/determinism,
spec-conformance, funds-safety core-invariant, migration+observability) in coverage mode on the
real diff + clean gate logs + a 7-case hostile-input battery (script,
`.audit/s-seal/hostile-battery.txt`); per-finding **opus** refuters; session integrator (fable).
**27 findings → 15 sustained (1 high, 2 med, 12 low) → all reproduced/fixed/dispositioned →
fix-round re-review (fresh fable): FIXES-SOUND, 0 high/med.**

**The decisive finding (S1 high + S3 med, independently by two lenses, live-reproduced
`.audit/s-seal/repro-S1-S3-results.txt`):** the built `NULLS FIRST` ordering gave never-examined
rows ABSOLUTE priority — sustained inflow ≥ limit/run deferred a watermarked row's re-examination
for the flood's duration (victim never re-examined in 200 simulated runs ≈ 50h). **Fix:** the
COALESCE FIFO ordering (above) — arrivals after a victim's examination sort BEHIND it, so
deferral is bounded under every arrival pattern; all prior properties re-proven (rotation,
reach-within-K=2, capacity-crash 35/35, poison-row 34/34, day-one == oldest-first; emitted SQL
re-derived via drizzle `QueryBuilder().toSQL()` and semantics validated against real Postgres in
the re-review). **S2 (med):** the regression interpreter's JS null-coercion sorted NULLs FIRST
under plain `asc()` (opposite of PG) — a future `asc(lastReconciledAt)` "cleanup" would have
starved prod while tests stayed green; fixed PG-faithfully + proof it now bites
(`sealfix-proof-plainasc-red.txt`: 2 red under the trap; `sealfix-proof-coalesce-green.txt`).

**Accepted dispositions (recorded, not deferred — each verified):**
- `0015` is **byte-frozen as applied** (hash `40943692cf53…` = sha256 of file, re-verified
  post-fix); its header narrates the superseded NULLS-FIRST ordering — THIS doc is the
  breadcrumb. Editing an applied migration is the DC-14 sin; the column semantics are identical
  under COALESCE (NULL = never examined; no backfill).
- `ledger_entries_last_reconciled_at_idx` (applied with 0015) cannot serve the COALESCE ORDER BY
  (seal S5/S12) — the window query is driven by the status/rail predicate indexes and re-sorts a
  small filtered set; kept as applied (dropping = a new founder-gated migration; negligible cost
  at current volume; non-HOT watermark updates likewise negligible). Honest note in `schema.ts`.
- `reconcileOneRow:162` "retry next run" comment imprecision (re-review low #3): NOT edited —
  the comment sits on the frozen surface whose "only two return lines changed" property is
  load-bearing across every audit artifact; recorded here instead.
- Theoretical NaN-overdue (battery H2 / seal S7+S14): `Number(garbage)` can't arise from real
  `count(*)`; the alert correctly stays silent in that shape; a guard would be gold-plating.
  JSON serializes NaN → null in the cron response, which reads as "check failed" — acceptable.
- Boundedness doc nuance (re-review INFO): app-clock ahead of DB-clock by Δ admits preemption by
  arrivals within Δ — bounded, graceful, NTP-scale negligible.
- Sustained-inflow ≥ 25 new stuck-pendings / 15min is ALSO an operational incident in itself;
  the 6h `pending_overdue` alert fires on exactly those rows (the backstop existed even pre-fix).

## Gates at seal (all from tool runs this session; logs in `.audit/s-seal/gates/`)
tsc **0** · vitest **4334 / 187 files / 0 fail** (`vitest-final.log`; 4322 baseline + 12 new
tests: 7 reconcile + 3 starvation-regression + 2 battery pins; intermediate clean run 4331
pre-fix-round) ·
build **0** (`build-postfix.log`) · eslint changed **0** · `git diff --numstat packages/` empty ·
python byte-stable · numstat confined to the 8 chunk files + docs · 0015 hash frozen.

## Founder state / next
- **Applied (done, founder, 2026-06-10):** 0015 + hash row + verification (16 rows, MAX
  `1781049600000`).
- **Deploy:** push (publishes (G) `c05d0203` + this (S) commit) whenever chosen — the migration
  precondition is already satisfied. Post-deploy: watch one cron cycle for
  `cron.settlement_reconcile.done` carrying `noop/errored/overdue`.
- **Queue after (S):** ③ post-seal deep audit (HIGH-STAKES cadence) → then **B1.1 enable-gate
  split** (INCREMENTAL, different rail) + small (G) residual tidies (x402 advertisement seam) +
  founder/BD-gated items. The B1.4 register is CLOSED.
