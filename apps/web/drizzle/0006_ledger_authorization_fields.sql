-- P3.K6 — Add authorization-gate audit columns to ledger_entries.
--
-- `authorize_invocation()` (packages/mcp/src/authorize.ts) returns an
-- AuthorizationResult whose `signals` array records which built-in
-- checks + plugins ran and their verdicts. Compliance audits
-- (OFAC strict-liability especially) need demonstrable evidence
-- that the gate executed — these columns store that evidence
-- alongside the settlement row.
--
-- Hostile-review (e): the 403 HTTP response must NOT expose the
-- signals array to the caller. Queries that serve external APIs
-- MUST filter the column out; the audit use case is internal-only.
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` + `DO` blocks for the
-- check constraint. Applies cleanly on a fresh DB, a dev DB
-- previously updated via `drizzle-kit push`, and on a prior
-- partial apply.

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "authorization_signals" jsonb;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "authorization_artifact" text;

-- Index for audit-by-check-category queries. Typical compliance
-- query: "how many OFAC-denied invocations in the last 30 days?"
-- is served by `WHERE authorization_signals @> '[{"check":"ofac","passed":false}]'`
-- (JSONB containment operator uses this GIN index).
CREATE INDEX IF NOT EXISTS "ledger_entries_authorization_signals_idx"
  ON "ledger_entries" USING GIN ("authorization_signals");

-- ─── Rollback (manual; NOT run automatically) ─────────────────────
--
-- To revert P3.K6 columns (leaving the P3.K4 settlement shape
-- intact):
--
--   DROP INDEX IF EXISTS "ledger_entries_authorization_signals_idx";
--   ALTER TABLE "ledger_entries" DROP COLUMN "authorization_signals";
--   ALTER TABLE "ledger_entries" DROP COLUMN "authorization_artifact";
--
-- Any rows populated with gate signals / artifacts will lose that
-- data — coordinate with the compliance team before running on
-- production.
