-- Phase 3: Consumer Referral Program + Volume Discount Credit Packs
-- Adds referral tracking and global balance columns to consumers table.

ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_consumer_id uuid,
  ADD COLUMN IF NOT EXISTS global_balance_cents integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS consumers_referral_code_idx ON consumers (referral_code);
