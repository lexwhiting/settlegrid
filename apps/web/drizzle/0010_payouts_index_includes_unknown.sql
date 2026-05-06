-- P5.PAYOUTS-CLEANUP-2 — extend the per-developer mutex index so a
-- payout in 'unknown' status (Stripe call returned indeterminate
-- error: timeout, 5xx, idempotency conflict, etc.) blocks retries
-- the same way 'processing' does.
--
-- Why this matters: without the 'unknown' coverage, a row stuck in
-- 'unknown' (Stripe may have actually paid the dev — we don't know)
-- would NOT block a new payout INSERT. The dev would be free to
-- trigger a second transfer for the same balance, producing a
-- silent double-pay if Stripe really did complete the first.
--
-- The DROP and CREATE are wrapped in a single transaction (BEGIN ...
-- COMMIT) so there's no millisecond window where the table has no
-- mutex protection. Postgres holds an ACCESS EXCLUSIVE lock for the
-- duration; on the small payouts table (≤7 rows in production at
-- migration time) this is microseconds.
--
-- ROLLBACK (manual; not run automatically):
--   BEGIN;
--   DROP INDEX IF EXISTS "payouts_one_processing_per_dev";
--   CREATE UNIQUE INDEX IF NOT EXISTS "payouts_one_processing_per_dev"
--     ON "payouts" ("developer_id")
--     WHERE "status" = 'processing';
--   COMMIT;
--
-- Idempotent: re-running this is a no-op (DROP IF EXISTS + CREATE IF
-- NOT EXISTS). Safe to apply against a fresh DB or one that already
-- ran 0009 + 0010.

BEGIN;

DROP INDEX IF EXISTS "payouts_one_processing_per_dev";

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_one_processing_per_dev"
  ON "payouts" ("developer_id")
  WHERE "status" IN ('processing', 'unknown');

COMMIT;
