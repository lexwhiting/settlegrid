-- Phase 4: Revenue Stack & Discovery Fixes
-- Adds auto-refill, newsletter subscription, and premium template columns.

-- B1: Auto-refill columns on consumers
ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS auto_refill_pack_id text,
  ADD COLUMN IF NOT EXISTS auto_refill_trigger_cents integer;

-- B3: Newsletter subscription on consumers (default true for new signups)
ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS newsletter_subscribed boolean NOT NULL DEFAULT true;

-- B2: Premium template columns on tools
ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_price_cents integer;
