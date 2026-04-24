-- P3.K4 — Unified settlement ledger.
--
-- Extends ledger_entries with the per-invocation settlement-record
-- columns every rail adapter writes to via
-- packages/mcp/src/ledger.ts's recordLedgerEntry helper. The
-- existing double-entry balance semantics (accountId / entryType /
-- counterparty) remain intact; the new columns are all NULLABLE so
-- legacy rows continue to work without backfilling.
--
-- This migration is intentionally idempotent:
--   * CREATE TABLE IF NOT EXISTS     — works on a fresh DB AND on a
--                                     dev DB where the table was
--                                     previously materialized by
--                                     `drizzle-kit push`.
--   * ADD COLUMN IF NOT EXISTS       — adds the P3.K4 columns even
--                                     when the table pre-exists
--                                     without them.
--   * ADD CONSTRAINT + exception-
--     swallowing anonymous blocks    — re-running the migration
--                                     after a prior partial apply
--                                     is a no-op.
--
-- Rollback (per card): see the matching `ledger_entries`-column drop
-- block at the bottom, commented out. Operator runs that block
-- manually when reverting the code deploy (git revert does not
-- revert applied migrations).

-- ─── 1. Create the base table if it doesn't exist ──────────────────

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "entry_type" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency_code" varchar(3) NOT NULL DEFAULT 'USD',
  "category" text NOT NULL,
  "operation_id" text,
  "batch_id" text,
  "counterparty_account_id" uuid,
  "description" text NOT NULL,
  "metadata" jsonb,
  "tax_cents" integer NOT NULL DEFAULT 0,
  "tax_jurisdiction" varchar(8),
  -- P3.K4 settlement columns (duplicated as NOT NULL-free so this
  -- matches the ALTER COLUMN IF NOT EXISTS block below when the
  -- table pre-existed):
  "session_id" uuid,
  "rail" text,
  "protocol" text,
  "take_bps" integer,
  "take_cents" integer,
  "settlement_status" text,
  "settled_at" timestamp with time zone,
  "external_ref" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ─── 2. Add P3.K4 columns if the table pre-existed without them ────

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "session_id" uuid;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "rail" text;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "protocol" text;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "take_bps" integer;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "take_cents" integer;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "settlement_status" text;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "settled_at" timestamp with time zone;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "external_ref" text;

-- ─── 3. Indexes for P3.K4 lookup patterns ──────────────────────────

CREATE INDEX IF NOT EXISTS "ledger_entries_rail_idx"
  ON "ledger_entries" ("rail");

CREATE INDEX IF NOT EXISTS "ledger_entries_settlement_status_idx"
  ON "ledger_entries" ("settlement_status");

CREATE INDEX IF NOT EXISTS "ledger_entries_session_id_idx"
  ON "ledger_entries" ("session_id");

CREATE INDEX IF NOT EXISTS "ledger_entries_external_ref_idx"
  ON "ledger_entries" ("external_ref");

-- ─── 4. Check constraints (one-shot, idempotent via exception) ────
--
-- Hostile fix H32: on a fresh DB the `CREATE TABLE IF NOT EXISTS`
-- above doesn't carry the P2.TAX1 check constraints
-- (`amount_positive`, `entry_type_check`,
-- `tax_jurisdiction_required`). Re-add them here with the same
-- DO-block pattern so a fresh-DB run gets them AND an existing-DB
-- run is a no-op. Without this, a fresh DB would accept
-- amount_cents=0 rows that the apps/web code assumes the DB
-- rejects.

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_amount_positive"
    CHECK ("amount_cents" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_entry_type_check"
    CHECK ("entry_type" IN ('debit', 'credit'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_tax_jurisdiction_required"
    CHECK (
      ("tax_cents" = 0 AND "tax_jurisdiction" IS NULL)
      OR ("tax_cents" > 0 AND "tax_jurisdiction" IS NOT NULL)
      OR ("tax_cents" = 0 AND "tax_jurisdiction" IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_settlement_status_check"
    CHECK (
      "settlement_status" IS NULL OR
      "settlement_status" IN ('pending', 'settled', 'voided', 'failed', 'reversed')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_take_bps_range"
    CHECK (
      "take_bps" IS NULL OR ("take_bps" >= 0 AND "take_bps" <= 10000)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_take_cents_nonneg"
    CHECK ("take_cents" IS NULL OR "take_cents" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_settled_at_shape"
    CHECK (
      ("settlement_status" IS NULL AND "settled_at" IS NULL)
      OR ("settlement_status" = 'settled' AND "settled_at" IS NOT NULL)
      OR ("settlement_status" IS NOT NULL AND "settlement_status" <> 'settled' AND "settled_at" IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. Manual rollback (NOT run automatically) ────────────────────
--
-- To revert P3.K4 columns (keeping the double-entry shape intact):
--
--   ALTER TABLE "ledger_entries" DROP COLUMN "session_id";
--   ALTER TABLE "ledger_entries" DROP COLUMN "rail";
--   ALTER TABLE "ledger_entries" DROP COLUMN "protocol";
--   ALTER TABLE "ledger_entries" DROP COLUMN "take_bps";
--   ALTER TABLE "ledger_entries" DROP COLUMN "take_cents";
--   ALTER TABLE "ledger_entries" DROP COLUMN "settlement_status";
--   ALTER TABLE "ledger_entries" DROP COLUMN "settled_at";
--   ALTER TABLE "ledger_entries" DROP COLUMN "external_ref";
--   DROP INDEX IF EXISTS "ledger_entries_rail_idx";
--   DROP INDEX IF EXISTS "ledger_entries_settlement_status_idx";
--   DROP INDEX IF EXISTS "ledger_entries_session_id_idx";
--   DROP INDEX IF EXISTS "ledger_entries_external_ref_idx";
--
-- Test this down-migration on a dev DB before running in prod —
-- any rows populated with settlement data will lose it.
