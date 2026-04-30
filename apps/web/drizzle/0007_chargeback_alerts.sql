-- P3.RAIL3 — Chargeback velocity alerts + onboarding-pause + payout-schedule cache.
--
-- Idempotent: every ALTER TABLE / CREATE TABLE uses IF NOT EXISTS so
-- running the migration on a fresh DB, a dev DB previously synced
-- via `drizzle-kit push`, or after a partial apply all converge to
-- the same shape.
--
-- Rolls back via the explicit DOWN block at the bottom (commented;
-- run manually).

-- ─── developers: onboarding-pause flag + payout-schedule cache ────────

ALTER TABLE "developers"
  ADD COLUMN IF NOT EXISTS "onboarding_paused" boolean NOT NULL DEFAULT false;

ALTER TABLE "developers"
  ADD COLUMN IF NOT EXISTS "onboarding_paused_at" timestamp with time zone;

ALTER TABLE "developers"
  ADD COLUMN IF NOT EXISTS "onboarding_paused_reason" text;

ALTER TABLE "developers"
  ADD COLUMN IF NOT EXISTS "payout_schedule_synced_at" timestamp with time zone;

ALTER TABLE "developers"
  ADD COLUMN IF NOT EXISTS "payout_schedule_weekday" text;

ALTER TABLE "developers"
  ADD COLUMN IF NOT EXISTS "payout_schedule_month_day" integer;

CREATE INDEX IF NOT EXISTS "developers_onboarding_paused_idx"
  ON "developers" ("onboarding_paused");

-- ─── chargeback_alerts ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "chargeback_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "developer_id" uuid NOT NULL
    REFERENCES "developers"("id") ON DELETE CASCADE,
  "tier" text NOT NULL,
  -- Decimal-as-text for portability (numeric column would also work,
  -- but text avoids dialect-specific scale/precision drift).
  "rate_by_count" text NOT NULL,
  "rate_by_volume" text NOT NULL,
  "charges_count" integer NOT NULL,
  "chargebacks_count" integer NOT NULL,
  "charges_volume_cents" integer NOT NULL,
  "chargebacks_volume_cents" integer NOT NULL,
  "paused_onboarding" boolean NOT NULL DEFAULT false,
  "details" jsonb,
  "email_status" text NOT NULL DEFAULT 'skipped',
  "resolved_at" timestamp with time zone,
  "resolved_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chargeback_alerts_tier_check"
    CHECK ("tier" IN ('yellow', 'red')),
  CONSTRAINT "chargeback_alerts_email_status_check"
    CHECK ("email_status" IN ('sent', 'rate_limited', 'skipped', 'failed')),
  CONSTRAINT "chargeback_alerts_counts_nonneg"
    CHECK ("charges_count" >= 0
       AND "chargebacks_count" >= 0
       AND "charges_volume_cents" >= 0
       AND "chargebacks_volume_cents" >= 0)
);

CREATE INDEX IF NOT EXISTS "chargeback_alerts_developer_id_idx"
  ON "chargeback_alerts" ("developer_id");

CREATE INDEX IF NOT EXISTS "chargeback_alerts_tier_idx"
  ON "chargeback_alerts" ("tier");

CREATE INDEX IF NOT EXISTS "chargeback_alerts_created_at_idx"
  ON "chargeback_alerts" ("created_at" DESC);

-- ─── Rollback (manual; NOT run automatically) ─────────────────────────
--
--   DROP INDEX IF EXISTS "chargeback_alerts_created_at_idx";
--   DROP INDEX IF EXISTS "chargeback_alerts_tier_idx";
--   DROP INDEX IF EXISTS "chargeback_alerts_developer_id_idx";
--   DROP TABLE IF EXISTS "chargeback_alerts";
--   DROP INDEX IF EXISTS "developers_onboarding_paused_idx";
--   ALTER TABLE "developers" DROP COLUMN "payout_schedule_month_day";
--   ALTER TABLE "developers" DROP COLUMN "payout_schedule_weekday";
--   ALTER TABLE "developers" DROP COLUMN "payout_schedule_synced_at";
--   ALTER TABLE "developers" DROP COLUMN "onboarding_paused_reason";
--   ALTER TABLE "developers" DROP COLUMN "onboarding_paused_at";
--   ALTER TABLE "developers" DROP COLUMN "onboarding_paused";
--
-- Any rows in chargeback_alerts (and any flagged-paused developers)
-- will lose their data when run on production. Coordinate with the
-- on-call founder before running.
