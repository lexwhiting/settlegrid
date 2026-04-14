-- P2.INTL2: marketplace visibility for claimed-but-unpublished tools
--
-- Adds a per-tool boolean controlling whether a tool with status='draft'
-- (claimed but not yet monetized/published) appears in the public marketplace.
-- The column is consulted only for status='draft'; 'unclaimed' and 'active'
-- tools are always in the marketplace regardless of this flag.
--
-- Backfill rule:
--   - Existing 'draft' rows -> false (don't retroactively expose developers'
--     in-progress work to the public marketplace).
--   - Existing 'unclaimed' and 'active' rows -> true (no behavioral change;
--     they were already in the marketplace under the old query).
--
-- New rows default to true so the claim flow's status='unclaimed' -> 'draft'
-- transition preserves marketplace visibility for the freshly-claimed tool.

ALTER TABLE "tools" ADD COLUMN "listed_in_marketplace" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "tools" SET "listed_in_marketplace" = false WHERE "status" = 'draft';
