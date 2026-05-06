-- P5.PAYOUTS-1 — Per-developer mutex on the payouts table.
--
-- The /api/payouts/trigger route is now reachable from three distinct
-- callers (the existing route handler, the upcoming /dashboard/payouts
-- "Trigger payout" button, and the upcoming daily cron). Without a
-- server-side mutex, two concurrent calls for the same developer
-- both pass the eligibility checks, both INSERT a 'processing'
-- payouts row, both create a Stripe transfer — multi-pay risk.
--
-- A partial unique index on (developer_id) WHERE status='processing'
-- is the simplest atomic guard. The route INSERTs the row early
-- (line 91 of route.ts), so a second concurrent attempt hits the
-- unique-constraint violation on INSERT and bails out with a 409
-- PAYOUT_IN_PROGRESS — before any Stripe call fires.
--
-- Idempotent. Safe to re-run on a fresh DB or any environment that
-- already has the index (which none currently do).
--
-- ROLLBACK (manual; not run automatically):
--   DROP INDEX IF EXISTS "payouts_one_processing_per_dev";

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_one_processing_per_dev"
  ON "payouts" ("developer_id")
  WHERE "status" = 'processing';
