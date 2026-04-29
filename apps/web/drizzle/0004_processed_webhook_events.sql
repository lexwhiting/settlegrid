-- Consumer-audit #1 — Stripe webhook idempotency ledger.
-- Without this table, retried checkout.session.completed events would
-- credit the consumer's balance twice.
CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
  "event_id"     text PRIMARY KEY,
  "source"       text NOT NULL DEFAULT 'stripe',
  "event_type"   text NOT NULL,
  "processed_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_webhook_events_processed_at_idx"
  ON "processed_webhook_events" ("processed_at" DESC);
