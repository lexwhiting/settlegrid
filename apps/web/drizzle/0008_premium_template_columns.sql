-- 0008 — Premium template columns + listed_in_marketplace catch-up
--
-- Two schema-drift fixes hand-applied to prod on 2026-04-29 after
-- /api/tools, /marketplace/trending, /api/v1/discover, and the
-- premium-template purchase flow began returning 500s with
-- "column ... does not exist" errors. This file is the source-of-
-- truth record of what was applied; prod was patched in-place via
-- idempotent ALTER TABLE statements (`ADD COLUMN IF NOT EXISTS`),
-- so re-running this migration through drizzle-kit on a fresh
-- environment will produce the same end state.
--
-- Why this migration exists:
--   1. `is_premium` and `premium_price_cents` were added to
--      `apps/web/src/lib/db/schema.ts` (lines 124-125) without a
--      corresponding migration ever being generated. The schema
--      declared them, three API routes referenced them
--      (`api/templates/purchase`, `api/templates/[slug]/download`,
--      and `api/tools/quick-publish` via the schema's INSERT
--      column list), but no .sql file in this directory ever
--      added the columns. Prod went without them since they were
--      introduced.
--   2. Migration `0001_listed_in_marketplace.sql` was generated
--      and recorded in `meta/_journal.json`, but never applied
--      to the prod database — Vercel does not auto-run drizzle
--      migrations on deploy, and no manual `drizzle-kit migrate`
--      step was run against the prod DATABASE_URL after 0001 was
--      authored. This file folds the same column add into 0008
--      with `IF NOT EXISTS` so a future fresh-environment apply
--      produces a coherent end state regardless of whether 0001
--      already ran.
--
-- Known broader drift (out of scope for this migration, see follow-
-- up triage card): `drizzle.__drizzle_migrations` in prod is empty
-- — Drizzle has no record of any migration applied even though
-- the base schema was provisioned somehow. Migrations 0002-0007
-- exist as files in this directory but have not been applied to
-- prod. This file does NOT attempt to reconcile those.

ALTER TABLE "tools" ADD COLUMN IF NOT EXISTS "is_premium" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN IF NOT EXISTS "premium_price_cents" integer;
--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN IF NOT EXISTS "listed_in_marketplace" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "tools" SET "listed_in_marketplace" = false WHERE "status" = 'draft' AND "listed_in_marketplace" = true;
