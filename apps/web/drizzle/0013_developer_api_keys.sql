-- Publisher API keys — backing store for programmatic tool publishing.
--
-- Before this, `developers.api_key_hash` was a single nullable column with
-- ZERO write paths anywhere in the codebase, which made PUT /api/tools/publish
-- (the API-key publish path) effectively un-callable. This migration replaces
-- that dead column with a proper table mirroring the consumer `api_keys`
-- design: multiple keys per developer (CI + human + per-environment), soft
-- revoke with history, and prefix/last-used metadata for the dashboard UI.
--
-- The new table is keyed to developers.id with ON DELETE CASCADE. Note the
-- GDPR data-deletion path (lib/settlement/compliance.ts) ANONYMIZES the
-- developer row rather than deleting it, so the cascade does not fire there —
-- that path deletes these rows explicitly.
--
-- Dropping api_key_hash is safe: the column held no data (no issuance code ever
-- wrote it) and its only reader (authenticateDeveloperByApiKey) is migrated to
-- this table in the same change set.

CREATE TABLE IF NOT EXISTS "developer_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "developer_id" uuid NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" varchar(12) NOT NULL,
  "label" text,
  "status" text DEFAULT 'active' NOT NULL,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "developer_api_keys_developer_id_developers_id_fk"
    FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "developer_api_keys_developer_id_idx"
  ON "developer_api_keys" ("developer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "developer_api_keys_key_hash_idx"
  ON "developer_api_keys" ("key_hash");

ALTER TABLE "developers" DROP COLUMN IF EXISTS "api_key_hash";

-- ─── Down (manual rollback) ────────────────────────────────────────
-- ALTER TABLE "developers" ADD COLUMN IF NOT EXISTS "api_key_hash" text;
-- DROP INDEX IF EXISTS "developer_api_keys_key_hash_idx";
-- DROP INDEX IF EXISTS "developer_api_keys_developer_id_idx";
-- DROP TABLE IF EXISTS "developer_api_keys";
