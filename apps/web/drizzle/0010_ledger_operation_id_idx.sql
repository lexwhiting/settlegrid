-- P3.K4 A2 — index ledger_entries.operation_id for the on-chain settlement flip.
--
-- A2 flips the circle-nano 'pending' settlement row to 'settled'/'failed' via an
-- UPDATE matched on (operation_id, rail) (see
-- apps/web/src/lib/settlement/ledger.ts markSettlementSettled/Failed/Broadcast
-- and findSettlementRow). schema.ts already DECLARES
-- `ledger_entries_operation_id_idx`, but no prior migration SQL created it — the
-- drizzle journal is intentionally incomplete and migrations are hand-applied
-- via the Supabase SQL Editor, so the physical index is NOT guaranteed to exist
-- in prod. Without it, the flip UPDATE scans every circle-nano row (the only
-- other usable index is on the low-cardinality `rail` column).
--
-- Idempotent (IF NOT EXISTS) so it is safe to run whether or not the index was
-- previously materialized by `drizzle-kit push` on some environment.
--
-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ DEFERRED → A2 GO-LIVE (founder action): APPLY THIS MANUALLY in the Supabase  │
-- │ SQL Editor before/at circle-nano go-live. git revert does NOT revert applied │
-- │ migrations; rollback = DROP INDEX IF EXISTS "ledger_entries_operation_id_idx";│
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS "ledger_entries_operation_id_idx"
  ON "ledger_entries" ("operation_id");
