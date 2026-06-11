-- (T) Terminal-transition integrity & credit observability (2026-06-10) —
-- the credited_at marker + the uncredited-row sweep's partial index.
--
-- Adds `ledger_entries.credited_at`: "the developer-balance credit COMMITTED,
-- in the same DB transaction as this marker." Written ONLY by the (T) credit
-- writers (creditSettlement — the reconciler tail + the kernel /settle route;
-- the proxy forwardAndBill on-chain credit transaction). A SETTLED row on a
-- reconcilable rail (circle-nano / x402) whose credited_at is NULL past the
-- sweep's 60-min grace window is an OPEN credit-resolution incident — the
-- reconcile cron's reconcile.uncredited_settled alert enumerates these every
-- run until the operator closes them (see the (T) runbook). This makes the
-- previously-INVISIBLE lost-credit class (a process kill between the
-- WHERE-pending settled-flip and the credit — ③ register P1) detectable.
--
-- ⚠️ DEPLOY ORDERING — APPLY-THEN-DEPLOY (after 0015, BEFORE the (T) bundle
-- deploys). Applying FIRST is zero-impact: currently-deployed code never
-- references the column (all from(ledgerEntries) reads use explicit column
-- lists; no bare .returning() on ledger_entries chains; no relational
-- db.query reads — verified at HEAD 231b8693). Deploying FIRST is a TOTAL
-- OUTAGE, strictly worse than 0015's broken cron: drizzle emits the FULL
-- schema column list on every INSERT, so EVERY ledger_entries INSERT throws
-- 'column "credited_at" does not exist' — ensurePendingRow fails PRE-broadcast
-- on BOTH on-chain rails (settlement admission dies fail-closed; no funds
-- move) and the ap2/sessions ledger writes fail; the credited_at marker
-- UPDATE inside every credit transaction for already-pending rows throws →
-- rollback → reconciler/kernel/proxy credits all fail (settlement.credit_failed
-- / billing_update_error storms); the sweep aggregate dies every run
-- (reconcile.uncredited_check_failed). Order: (1) paste this file in the
-- Supabase SQL Editor, (2) seed the 0016 hash row from
-- scripts/bootstrap__drizzle_migrations.sql, (3) only then deploy (T).
--
-- The backfill marks every PRE-(T) settled row on the two on-chain rails so
-- legacy rows NEVER page the sweep. The literal settled_at upper bound is the
-- 0016 AUTHORING time — it necessarily predates any (T) deploy, so no
-- (T)-era row can ever fall under it: the paste is text-idempotent
-- UNCONDITIONALLY (a re-paste at any time cannot erase live sweep evidence).
-- Rows settled BETWEEN the bound and the (T) deploy are outside the backfill
-- and will page on every post-deploy sweep run until closed — the runbook
-- carries the log-triage + one-time bulk-closure UPDATE for that bounded
-- window. The hardcoded rail pair below is a deliberate POINT-IN-TIME
-- SNAPSHOT of RECONCILABLE_RAILS (rails.ts) — correct for a one-time
-- historical statement; the live source of truth remains rails.ts.
--
-- The partial index serves the sweep's WHERE (settled + credited_at IS NULL +
-- settled_at < cutoff). Its predicate deliberately omits the rail pair so a
-- future rail can never silently fall outside index coverage (DC-07);
-- accepted trade: ap2 settled rows (never marked — outside the marker
-- universe) accumulate in the NULL-set; revisit via a future migration if
-- ap2 volume makes it material.
--
-- IF NOT EXISTS makes the one-shot Supabase SQL Editor paste idempotent.
-- Hand-written (NOT via drizzle-kit generate — drizzle/meta is intentionally
-- partial: only 0000_snapshot.json + a 3-entry journal, so generate would
-- diff against a stale snapshot and emit a wrong migration). Register the
-- applied hash in scripts/bootstrap__drizzle_migrations.sql.
--
-- FOUNDER-GATED: apply via the Supabase SQL Editor AFTER 0015 and BEFORE the
-- (T) bundle deploys. Do NOT auto-apply.

ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "credited_at" timestamp with time zone;

UPDATE "ledger_entries" SET "credited_at" = "settled_at"
WHERE "settlement_status" = 'settled' AND "rail" IN ('circle-nano', 'x402')
  AND "credited_at" IS NULL AND "settled_at" < '2026-06-10T20:00:00Z'::timestamptz;

CREATE INDEX IF NOT EXISTS "ledger_entries_uncredited_settled_idx"
  ON "ledger_entries" ("settled_at")
  WHERE "settlement_status" = 'settled' AND "credited_at" IS NULL;
