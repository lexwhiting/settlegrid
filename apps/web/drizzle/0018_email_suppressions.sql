-- email-compliance (G6-1/G6-2/G6-3) — the canonical email suppression table.
--
-- ONE durable store for every marketing/bulk opt-out, hard bounce, and spam
-- complaint, keyed by (email, stream). Replaces the four disjoint ad-hoc
-- opt-out stores (PG newsletterSubscribed, three Redis key prefixes) with a
-- single gate every bulk sender consults via lib/email-suppression.ts.
--   stream:  'all' (hard bounce / complaint — suppresses every bulk stream via
--            the OR in isSuppressed) | 'newsletter' | 'consumer-digest' |
--            'outreach' | 'weekly-report' | 'abandoned-checkout'
--   reason:  'unsubscribe' | 'bounce' | 'complaint' | 'manual'
--   source:  'link' | 'list-unsub-post' | 'resend-webhook' | 'admin' (audit)
--
-- `email` is ALWAYS stored normalized (trim().toLowerCase() via normalizeEmail).
-- The UNIQUE EXPRESSION index on (lower("email"), "stream") is the DB backstop
-- that enforces one canonical row per (email, stream) even if an app writer
-- ever skips normalization (DC-14 hardening — text + app-normalize alone has
-- no backstop). suppress() upserts with ON CONFLICT DO NOTHING against it
-- (idempotent), so a redelivered webhook or a double-clicked unsubscribe is a
-- no-op.
--
-- ⚠️ DEPLOY ORDERING — APPLY-BEFORE-DEPLOY is REQUIRED (see the consumer-digest
-- caveat below). A deploy-first window is never an OUTAGE, but it is NOT fully
-- lossless:
--   * Bulk READS fail CLOSED — isSuppressed() catches the missing-table error
--     inside each sender's per-item try/catch and returns true, so bulk sends
--     PAUSE (skip) rather than crash the cron or leak to opted-out addresses.
--   * Unsubscribe WRITES: outreach + newsletter record a durable fallback FIRST
--     (legacy Redis unsub:outreach: key / consumers.newsletter_subscribed=false)
--     and call suppress() best-effort, so a click never 500s or loses the opt-out
--     even before the table exists.
--   * ⚠️ consumer-digest / weekly-report / abandoned-checkout have NO durable
--     fallback (the table is their ONLY sink). Their SENDERS fail closed pre-table,
--     BUT the consumer-digest unsub link ALREADY ships at HEAD (email.ts) — those
--     links are already in inboxes, so a click during a deploy-BEFORE-migration
--     window is swallowed best-effort (HTTP 200, no row) and the opt-out is LOST.
--     This is why migration-first is REQUIRED, not merely preferred. (weekly-report
--     / abandoned-checkout links are net-new here → no in-inbox backlog.)
--   * The Resend webhook returns a non-2xx if the table is absent → Resend
--     redelivers until it exists (suppress is idempotent).
-- Order: (1) paste this file in the Supabase SQL Editor, (2) seed the 0018 hash
-- row from scripts/bootstrap__drizzle_migrations.sql, (3) then deploy the seal.
-- Applying FIRST is zero-impact (no currently-deployed code references the
-- table); deploying first merely pauses bulk sends until the table exists.
--
-- IF NOT EXISTS makes the one-shot Supabase SQL Editor paste idempotent.
-- Hand-written (NOT via drizzle-kit generate — drizzle/meta is intentionally
-- partial: only 0000_snapshot.json + a 3-entry journal, so generate would diff
-- against a stale snapshot and emit a wrong migration). Register the applied
-- hash in scripts/bootstrap__drizzle_migrations.sql.
--
-- FOUNDER-GATED: apply via the Supabase SQL Editor BEFORE the seal commit
-- deploys. Do NOT auto-apply.

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email"      text NOT NULL,
  "stream"     text NOT NULL,
  "reason"     text NOT NULL,
  "source"     text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_lower_email_stream_idx"
  ON "email_suppressions" (lower("email"), "stream");
