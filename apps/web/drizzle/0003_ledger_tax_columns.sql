-- P2.TAX1 — Add tax_cents + tax_jurisdiction columns to ledger_entries.
--
-- Pattern A+ uses Stripe Tax for VAT/GST/sales-tax compliance on SaaS
-- subscription charges (see docs/legal/tax-registrations.md). The
-- unified ledger must store the tax component of each charge
-- separately so reconciliation can confirm SettleGrid never
-- recognized tax as revenue — tax is a pass-through to tax
-- authorities, not merchant earnings.
--
-- tax_cents:
--   NOT NULL with default 0. Non-tax entries (metering, payouts,
--   internal transfers) MUST write 0 (not NULL) so queries that
--   SUM(tax_cents) never need to coalesce. Subscription charges
--   write the tax portion; the main amount_cents stays ex-tax.
--
-- tax_jurisdiction:
--   Optional string. For US: 'US-<state>' (e.g., 'US-CA'). For
--   non-US: ISO-3166 alpha-2 country code. NULL when not applicable
--   (reverse-charge, non-tax entries, or rate-zero jurisdictions).

ALTER TABLE "ledger_entries"
  ADD COLUMN "tax_cents" integer NOT NULL DEFAULT 0;

ALTER TABLE "ledger_entries"
  ADD COLUMN "tax_jurisdiction" varchar(8);

-- A ledger entry with a non-zero tax amount MUST have a jurisdiction
-- recorded, and vice versa — either both are set or neither is. This
-- prevents a class of reconciliation bugs where tax is collected but
-- can't be filed because the authority is unknown.
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_tax_jurisdiction_required"
  CHECK (
    ("tax_cents" = 0 AND "tax_jurisdiction" IS NULL)
    OR ("tax_cents" > 0 AND "tax_jurisdiction" IS NOT NULL)
    OR ("tax_cents" = 0 AND "tax_jurisdiction" IS NOT NULL)
  );

-- Secondary index for tax-reporting queries that aggregate by
-- jurisdiction. Partial on non-null so it stays small for the
-- overwhelming majority of entries (non-tax) that won't match.
CREATE INDEX "ledger_entries_tax_jurisdiction_idx"
  ON "ledger_entries" ("tax_jurisdiction")
  WHERE "tax_jurisdiction" IS NOT NULL;

-- ROLLBACK (copy into a new down migration if reverting):
--   DROP INDEX "ledger_entries_tax_jurisdiction_idx";
--   ALTER TABLE "ledger_entries"
--     DROP CONSTRAINT "ledger_entries_tax_jurisdiction_required";
--   ALTER TABLE "ledger_entries" DROP COLUMN "tax_jurisdiction";
--   ALTER TABLE "ledger_entries" DROP COLUMN "tax_cents";
--
-- Cautions on rollback (from the P2.TAX1 spec "Rollback Instructions"):
--   "Existing charges with tax collected must stay as-is — the tax
--    amounts were already remitted (or will be at next filing); don't
--    try to reverse them."
