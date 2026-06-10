# (S) Reconciler starvation-at-scale + truthful run telemetry — SCOPE-CONFIRM TRACE (2026-06-10)

> ARC step 1 of the (S) chunk (`s-reconciler-starvation-handoff-2026-06-10.md`). Every claim
> below was re-derived against live code THIS session at HEAD `c05d0203` (confirmed:
> `git log -3 --oneline` → `c05d0203` atop `origin/main = 23663006`; tree clean except the
> handoff doc; last migration `0014_drop_revenue_share_pct.sql`).

## 0. Handoff §0/§4 re-verification (cited lines re-read live)

| Handoff claim | Verified at | Status |
|---|---|---|
| `reconcilePendingSettlements` SELECT window, `limit 25`, `olderThanMs` 5 min, oldest-first | `reconcile.ts:282-316` (`limit = opts?.limit ?? 25` :287; `olderThanMs ?? 5*60_000` :286; `orderBy(asc(ledgerEntries.createdAt))` :315) | ✅ exact |
| `ReconcileSummary` ~:255, `emptyOutcomes` ~:264 | `reconcile.ts:255-274` | ✅ exact |
| `isNotNull(externalRef)` anti-starvation guard + load-bearing inline comment | `reconcile.ts:305-311` | ✅ KEEP (frozen) |
| `RECONCILABLE_RAILS` shared constant | `rails.ts:18` (`['circle-nano','x402']`), consumed `reconcile.ts:304` | ✅ |
| Cron route + `*/15 * * * *` + maxDuration 60 | `app/api/cron/settlement-reconcile/route.ts:17,35-43`; `vercel.json` crons entry | ✅ |
| `tryRedis` fail-open | `lib/redis.ts:22-28` (catch → null) | ✅ |
| Last migration `0014`; next = `0015` | `ls apps/web/drizzle/` | ✅ |
| B1.4 register: item 1 closed by (G); items 2/3/4 open | `b1.4-settlement-reconciler-2026-05-31.md` banner + DEBT 2/3/4 | ✅ |
| (G) capstone stale-B4 pointer (rider target) | `g-x402-network-allowlist-resolution-2026-06-09.md:88-91` lists B4 under "Next-chunk pointers" — B4 was SEALED `be43b501` 2026-06-04 | ✅ rider needed |
| `/api/settlement/reconcile` is NOT a `ReconcileSummary` consumer | route runs `verifyLedgerIntegrity` (ledger-integrity, different feature) | ✅ — summary consumers are the cron route + tests ONLY |

## (a) Sticky-row classes that REMAIN post-(G)

A "sticky row" = a row satisfying the SELECT (`status='pending'` ∧ rail ∈ {circle-nano,x402} ∧
`external_ref` NOT NULL ∧ `created_at` < cutoff) whose examination can never reach a terminal
flip. By `reconcileOneRow`'s outcome map (`reconcile.ts:96-164`):

1. **Dropped-tx / never-mined** → `confirmSettlementTx` `getTransactionReceipt` throws
   (`settle-engine.ts:265-270`) → `unconfirmed` → outcome `pending-unconfirmed`, forever.
   (Indistinguishable in-protocol from "not mined YET" — honest permanent-pending; item 4.)
2. **`reverted` + nonce-consumed** → outcome `pending-nonce-consumed` (`reconcile.ts:137-147`),
   forever (we can't attribute the winning txHash — frozen funds-safety semantic).
3. **`skipped-unparseable`** — rail ∈ set + external_ref non-null but `operation_id` doesn't
   parse. No LIVE writer produces these post-(H) (`rails.ts` doc: recordHop skips unified-ledger
   writes for on-chain rails; both settle paths build parseable opIds), but PRE-(H) hop rows may
   persist in the prod table (DC-09 evidence S1-06/S2-33). Cannot confirm from here (DB
   read-only and no prod query run this session) — the alert must therefore classify this class
   rather than assume it empty.
4. **`skipped-unsupported`** — post-(G) no NEW row can carry a non-canonical network (origin
   removed), but pre-(G) `eip155:1` rows may persist. Same treatment as 3.
5. **NEW class found this trace — the persistent-throw row:** `reconcileOneRow` throwing (e.g. a
   row whose data poisons an RPC call deterministically) is caught per-row
   (`reconcile.ts:322-325`) and lands in NO outcome bucket; the row stays at the window head.
   Under the CURRENT oldest-first ordering it is exactly as sticky as classes 1-4. The rotation
   fix must rotate error rows too — mark-before-examine handles this (see (b)): the killing row
   is watermarked before it kills, so it rotates out; a mark-AFTER-examination would NOT cover a
   row that kills the whole run (e.g. via maxDuration 60s timeout with slow RPCs).

`skipped-no-txhash` is unreachable from the window (the `isNotNull` guard) — it remains only as
a defensive branch. The pending-age ALERT, however, should classify null-`external_ref` pending
rows as their own settle-path-owned class (the §1 bar says EVERY genuinely-overdue pending row
is alerted+classified; those rows are outside the reconciler's window by design but are still
wedge-able money state).

## (b) LB-1 decision: **WATERMARK COLUMN (`last_reconciled_at`, migration 0015) — Redis cooldown REJECTED**

The handoff's NB ("prefer Redis if equal safety at zero schema change") was evaluated honestly;
Redis is NOT equal safety. Three independent disqualifiers:

1. **Cooldown × limit-25 = the exclusion trap the handoff itself flags.** The cooldown filter is
   app-side, AFTER the DB returns the oldest 25. With ≥25 sticky rows at the head, every run
   re-SELECTs the same 25, filters all of them out, and processes ZERO rows — rows beyond
   position 25 are never selected at all. Equal-safety would require keyset pagination
   ("keep selecting past cooled-down rows"), which (i) must itself be bounded (maxDuration 60)
   → a NEW exclusion class once sticky count > MAX_PAGES×25, and (ii) is strictly more code on
   the frozen money path than an ORDER BY change.
2. **`tryRedis` fail-open degrades to the bug.** Redis down ⇒ no cooldown data ⇒ behavior
   reverts to today's starvation exactly while degraded (`redis.ts:22-28` returns null on any
   failure). The column path has no degraded mode: ordering lives in the same DB query that
   defines the window.
3. **The alert wants the same durable surface.** A queryable per-row examination timestamp also
   serves operator forensics; Redis TTL state is invisible and flushable.

**Chosen mechanism (provably deferral-never-exclusion):**
- `ORDER BY last_reconciled_at ASC NULLS FIRST, created_at ASC` (replaces the bare
  `created_at ASC`). **No WHERE change** ⇒ no row can become unexaminable — exclusion is
  structurally impossible; the ordering is a pure rotation (round-robin over pending rows).
- **NULLS FIRST is load-bearing:** Postgres ASC defaults to NULLS LAST, which would deprioritize
  every never-examined row behind every examined one — the LB-1 "NULL-watermark sorted out"
  trap. Must be explicit SQL (`sql\`... NULLS FIRST\`` — drizzle-orm 0.38 `asc()` has no
  nulls-ordering arg).
- **Watermark timing — AMENDED by mechanical probe (P3 matrix, `.audit/s-prebuild/probes/
  RESULTS.txt`):** the trace's first choice (batch mark-at-select) was DISPROVEN by the
  simulation: under a REPEATING capacity crash (process dies after examining ~C rows every run
  — e.g. maxDuration 60s with slow RPCs), batch-marking watermarks 25 rows but examines only C,
  and the ordering settles into a stable orbit where 5/35 rows are watermarked every run yet
  NEVER examined (probe P3e: 30/35 coverage) — a silent exclusion class. Mark-after-examination
  fails the poison-row scenario instead (the killing row is never watermarked, pins the head —
  probe P3h: 7/35). **Chosen: per-row mark-BEFORE-examine** — watermark THIS row, then examine
  it: the killing row is already marked when it kills (rotates out), and unexamined tail rows
  are never marked (keep their place). Survives clean/capacity-crash/poison scenarios (P3b/c/d/
  f/i: full coverage; reach-within-K=2 intact).
- **Error/crash timing is deferral-bounded:** the worst case for any row (RPC blip, crash,
  watermark set on an unexamined row) is one full rotation ≈ `ceil(N_pending/25)` runs × 15 min.
  A confirmable row behind S sticky rows is reached within `ceil((S+1)/25)+1` runs. The
  watermark-update failing (DB blip) is caught + logged and the run proceeds (rotation degrades
  for one run; examination never blocked).
- The flip/credit machinery is untouched: the watermark UPDATE touches only the new column, no
  status guard needed (setting it on a concurrently-flipped row is harmless — flipped rows leave
  the window via `status != 'pending'`).

**Reach-within-K guarantee to pin in the regression test:** with 30 sticky + 5 confirmable
(confirmable newest): run 1 examines sticky 1-25 (watermarked); run 2 examines sticky 26-30 +
the 5 confirmable. K=2. Pre-fix, the confirmable rows are NEVER reached (sticky 1-25 re-selected
every run). The test must execute real ordering semantics (a stateful mock that sorts by the
ORDER BY the code emits — see (e)), not assert argument shapes.

Tier note: HIGH-STAKES stands (reconciler edit + schema migration + new invariant).

## (c) The project's real alert mechanism: structured `logger.error` — NO invented infra

Confirmed precedents (no email/pager infra exists in-repo):
- `settlement.credit_failed` — `logger.error`, documented in-code as "the operator signal to
  credit manually" (`reconcile.ts:191-200,251`).
- `rate_limit.fail_open` — `logger.error` (H1 limiter pattern, `rate-limit.ts:183`).
- `reconcile.unsupported_network` — deliberately `logger.warn` to AVOID alarm-spam on known-stuck
  rows (`reconcile.ts:156-162`); the B1.4 doc records the error→warn downgrade.

**Design (anti-spam + honest classification):** ONE structured `logger.error`
(`reconcile.pending_overdue`) per run, fired ONLY when ≥1 pending row (reconcilable rails) is
older than the threshold; payload carries the total overdue count, the oldest age, and a
per-class breakdown — sticky classes named honestly (`nonceConsumed`, `unconfirmed`
(dropped-or-slow), `unparseable`, `unsupported`, `errored`, plus `noTxhashCount`
(settle-path-owned, outside the window) — an overdue row that REACHES a terminal outcome this
run is deliberately not classified: it resolved; SEAL-CORRECTED from an earlier draft that also
named an `overdue-confirmable/other` class the built payload does not carry — seal finding S8). One log line per run while the condition persists mirrors
the accepted `credit_failed` posture (a real operator condition re-asserted per run is not
spam; per-ROW logging would be). Classification source: rows examined THIS run that are overdue
are classified by their outcome; the total comes from one cheap COUNT (grouped by
`external_ref IS NULL`) — rotation guarantees every overdue row cycles through examination, so
classes converge within one rotation. Threshold: `overdueAfterMs`, default 6h (= 24 cron runs;
Base txs confirm in seconds, so 6h is unambiguously anomalous while immune to transient RPC
outages). Default pinned in the plan; opts-overridable like `olderThanMs`/`limit`.

## (d) Item 3 — exact summary-truthfulness fix

`reconcileOneRow` returns `'settled'`/`'failed'` regardless of the `markSettlement*` boolean
(`reconcile.ts:113,148` — `flipped` only gates the credit and rides the log line). A row flipped
by a concurrent winner (live settle path or overlapping run) therefore tallies as a transition
THIS run performed — the over-report. Fix:
- `flipped === false` in the `settled` branch → return new outcome `'settled-noop'` (credit
  already correctly skipped — that gate is frozen and unchanged).
- `flipped === false` in the `failed` branch → `'failed-noop'`.
- `ReconcileOutcome` + `emptyOutcomes()` gain both members; `ReconcileSummary` gains
  `noop: number` (= the two noop tallies); top-level `settled`/`failed` now count TRUE
  transitions only. Cron log line adds `noop`. Consumers: cron route + tests only (verified §0).
- Summary arithmetic invariant for tests: `scanned = settled + failed + pending + skipped + noop
  + errored` where `errored` = rows that threw (today they vanish from every bucket —
  `reconcile.ts:319-326`). Truthful telemetry should count them: add `errored: number` to the
  summary (tallied in the existing catch). This is within item 3's "run summary reports only
  true transitions / truthful tallies" bar, not scope growth — without it the summary still
  lies by omission about examined-but-errored rows.

## (e) Forced-test sweep (DC-05 sweep against every new/changed symbol)

- `lib/settlement/__tests__/reconcile.test.ts` (363 lines): `mockDb` lacks `update`/`set` keys
  (`:20-27`) — the new PER-ROW watermark UPDATE (one `db.update(...)` per loop iteration, keyed
  `eq(ledgerEntries.id, row.id)`) goes through `db.update(...)`, so the mock MUST
  gain `update`/`set`/`where`-chain support at the db (not just tx) level; the schema mock
  (`:42-55`) must gain `id`, `lastReconciledAt` keys; the drizzle-orm mock already covers
  `inArray`/`sql` (`:56-64`). Summary tests (`:315-339`) must extend to the new
  `noop`/`errored` fields + outcomes; the "one row throwing does not abort" test (`:341-353`)
  now also asserts `errored: 1`.
- **NEW starvation regression test (fail-pre-fix, REAL):** a stateful in-memory "table" behind
  the mock whose `limit()` resolves by EXECUTING the captured where/orderBy structures (the
  mocked `asc`/`sql`/`and` produce inspectable objects; the interpreter sorts/filters by what the
  CODE emitted, and the mocked `db.update` mutates the same rows). Two scenarios: (i) a sticky
  row must not occupy the window two runs straight; (ii) 30 sticky + 5 confirmable → confirmable
  reached within K=2 runs. Pre-fix both fail (code emits `created_at ASC` only and never
  watermarks). Empirical fail-pre-fix proof captured to `.audit/s-build/` in step 4.
- New alert tests: fires once with classified payload when overdue rows exist; silent when none;
  threshold boundary; never throws the run (alert failure must not abort examination).
- `app/api/cron/settlement-reconcile/__tests__/route.test.ts` (58 lines): summary shape in the
  mocked `reconcilePendingSettlements` return + the log-line assertion extend.
- Behavior-neutral pins that must STAY green (frozen spine): all credit-on-flip tests
  (`reconcile.test.ts:185-298` incl. B4 semantic guard), funds-safety mapping tests
  (`:133-183`), `RECONCILABLE_RAILS` pin (`:355-362`), `confirmSettlementTx` engine tests
  (untouched file).
- `packages/mcp` (1898/1 skip) + sdk-python: byte-stable — no surface touched.

## (f) Migration 0015 shape + APPLY-THEN-DEPLOY runbook (LB-2 / DC-14)

**Convention (verified):** migrations are HAND-WRITTEN — `0014`'s header states drizzle-kit
generate would diff a stale snapshot (`drizzle/meta` holds only `0000_snapshot.json` + a 3-entry
journal) and emit a WRONG migration. So: hand-write `0015_reconcile_watermark.sql` + edit
`schema.ts` in the same change + append the hash row to
`scripts/bootstrap__drizzle_migrations.sql` (existing `WHERE NOT EXISTS` idempotent-insert
pattern; update its POST-RUN VERIFICATION footer: 16 rows, new MAX(created_at)). Do NOT run
drizzle-kit generate; do NOT apply (founder applies via Supabase SQL Editor).

```sql
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "last_reconciled_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "ledger_entries_last_reconciled_at_idx" ON "ledger_entries" ("last_reconciled_at");
```
Nullable, NO default, NO backfill — NULL means never-examined and sorts FIRST by design.
IF NOT EXISTS keeps the SQL-Editor paste idempotent (0014 precedent).

**Deploy-ordering blast radius (verified):** all four `from(ledgerEntries)` call sites use
explicit column lists; ONLY the reconciler's new SELECT/ORDER BY/UPDATE references the new
column. Code deployed before the migration ⇒ the cron's SELECT errors (`column does not exist`)
every 15 min ⇒ NO row is examined — a total reconciler outage (worse than the bug). Hence the
runbook MUST pin **APPLY-THEN-DEPLOY** (inverse of 0014's expand/contract DROP which was
deploy-then-apply; additive columns are the apply-first direction — old code simply ignores the
new column, so apply-first has zero impact on the running deployment). Runbook lands in the
resolution/capstone doc at close (step 6): (1) paste 0015 SQL in Supabase SQL Editor, (2) seed
the hash row, (3) only then push/deploy the (S) bundle.

## SEAL AMENDMENT (2026-06-10, ② review `wf_c7fd9ecf-2c1`) — ordering evolved NULLS FIRST → COALESCE

The seal review's funds-safety + spec lenses independently exhibited (and live simulation
reproduced, `.audit/s-seal/repro-S1-S3-results.txt`) a starvation class the §(b) ordering missed:
`last_reconciled_at ASC NULLS FIRST` gives never-examined rows ABSOLUTE priority, so sustained
inflow ≥ limit/run of new stuck-pendings defers a watermarked row's re-examination for the
duration of the flood (victim never re-examined in 200 simulated runs). The shipped ordering is
**`COALESCE(last_reconciled_at, created_at) ASC, created_at ASC`** — a FIFO queue (position =
last examined, else created). Deferral is bounded under EVERY arrival pattern: rows arriving
after a victim's examination sort behind it by construction. All §(b) properties re-proven under
COALESCE (rotation, reach-within-K=2, capacity-crash 35/35, poison-row 34/34, day-one ==
oldest-first); the NULLS-FIRST paragraphs above are superseded on the ordering choice but remain
correct on mark-before-examine timing. The regression suite gained a sustained-inflow scenario
(red under NULLS FIRST — `.audit/s-seal/sealfix-proof-nullsfirst-red.txt`) and a PG-faithful
interpreter (plain `asc()` sorts NULLs LAST, so the natural-but-starving `asc(lastReconciledAt)`
refactor now fails the suite — `sealfix-proof-plainasc-red.txt`; seal finding S2). Migration 0015
is UNCHANGED (column semantics identical; the file is byte-frozen as applied to prod).

## Scope guard (re-affirmed from handoff §1)
IN: rotation (column path per (b)), pending-age classified alert (c), truthful summary (d),
starvation regression + forced tests (e), migration + runbook (f), docs-only (G)-capstone B4
rider at close. OUT: B1.1, (G) seal residuals, any edit to the frozen spine (`creditSettlement`,
`markSettlement*`, `reconcileOneRow` outcome semantics for on-chain states, `isNotNull` guard,
`RECONCILABLE_RAILS`, confirm engine, packages/mcp, python). The ONLY `reconcileOneRow` change
is the flipped-false return value (item 3 — its on-chain semantics are unchanged).
