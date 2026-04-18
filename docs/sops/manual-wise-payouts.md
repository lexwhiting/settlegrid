# Manual Wise Payouts — Stopgap SOP

**Document owner:** SettleGrid (Alerterra, LLC)
**Compliance officer:** Lex Whiting (founder)
**Effective date:** 2026-04-18
**Review cadence:** Every time a payout is executed + at any quarterly or yearly cap boundary. Policy revision review annual.

---

## Purpose

Until SettleGrid integrates a second payout rail (Paddle, Lemon Squeezy, Wise Business API, Razorpay Route, Flutterwave), developers earning revenue in **Stripe-unsupported corridors** (see `data/international/country-tracker.md` §5 "Cohort 1") cannot receive automated payouts through Stripe Connect.

This SOP documents the founder's **manual stopgap**: personal Wise Business account, strictly rate-limited, contractually short-term, with a paper trail that preserves optionality for a future second-rail migration.

**This is a stopgap, not a product.** It exists to honor a handful of high-value waitlist developers until demand justifies proper integration, not to be a scalable revenue channel. Any pattern that pushes the caps below should trigger a second-rail decision, not a cap extension.

---

## 1. Eligibility criteria

A developer qualifies for a manual Wise payout **only if all four are true**:

1. Their `country_iso` is in the Cohort-1 list (`data/international/country-tracker.md` §5) — Stripe-unsupported corridor with a viable Wise route.
2. They signed up for the `stripe-unsupported-corridor-waitlist` segment AND explicitly opted in to the Wise stopgap. Silent enrollment is not acceptable — the developer must know this is a non-productized channel with hard caps.
3. They have submitted a valid **W-8BEN** (individual) or **W-8BEN-E** (entity) form. US tax law requires the form before any payout to a foreign payee; no form, no payout.
4. Their earned revenue on SettleGrid exceeds $50 (de-minimis floor — below this the operational cost of the manual payout exceeds the value of the payout).

---

## 2. Hard caps

| Cap | Value | Enforcement |
|---|---|---|
| Payouts per quarter (platform-wide) | **≤5** | Spreadsheet counter; quarter boundaries at calendar quarter end |
| Payout per developer per year | **≤$2,000** USD equivalent | YTD tracker per developer |
| Single payout amount | **≤$1,000** USD equivalent | Split larger balances across quarterly payments |
| Waitlist enrollees across Cohort 1 | **≤100 total** | When crossed, second-rail decision (§6) is forced |

**Crossing any cap triggers the second-rail decision** (§6). The caps are NOT to be raised unilaterally — the caps exist because the manual process is structurally unscalable.

---

## 3. Pre-payout checklist

Before wiring any payout:

1. **Eligibility re-verified.** §1 criteria re-checked at the time of THIS payout; don't rely on a prior quarter's eligibility review.
2. **W-8BEN on file + non-expired.** Forms are valid for 3 years from signing year-end. Expired form → collect fresh form before paying.
3. **OFAC screening current.** Developer's `ofac_screened_at` (see `docs/legal/ofac-program.md` §4.1) is within the last 30 days. If older, re-screen before paying.
4. **Revenue math reconciled.** Balance shown in SettleGrid's internal ledger matches what the developer's dashboard shows. Any discrepancy is a stop-the-line.
5. **Cap space available.** This quarter's count +1 ≤ 5; this developer's YTD + payout amount ≤ $2,000; single payout ≤ $1,000.
6. **Payout amount determination.** Gross earnings (USD, platform-side) minus SettleGrid's progressive take rate (see `apps/web/src/app/pricing/page.tsx`) minus Wise transfer fees (sender pays). Resulting USD amount is what Wise converts to the developer's currency.

If any check fails, the payout is DEFERRED to the next review cycle; notify the developer with a specific reason and timeline.

---

## 4. Execution procedure

1. **Log into the founder's personal Wise Business account** (account owner: Lex Whiting / Alerterra, LLC — sole-member LLC treated as disregarded entity for tax purposes).
2. **Create a new transfer** with:
   - Recipient name: developer's legal name (matches W-8BEN)
   - Recipient account details: developer's bank (IBAN / local format)
   - Currency: developer's local currency
   - Source: USD from the Wise Business account's USD balance (pre-funded from SettleGrid's operating account)
   - Reference: `settlegrid-payout-<developer_id>-<YYYYQn>`
3. **Confirm FX rate shown** before executing; record the rate in the ledger.
4. **Execute the transfer.** Wise returns a transaction ID; save it.
5. **Download the PDF confirmation** and file at `docs/legal/manual-payouts/<YYYY-Qn>/<developer-id>.pdf` — this is the audit trail.

Transfer typically lands within 24 hours. If it doesn't, Wise support via the app.

---

## 5. Ledger + tax bookkeeping

Every manual payout MUST be recorded in SettleGrid's internal ledger (`apps/web/src/lib/settlement/ledger.ts`) as a `payout` category entry:

- `debitAccountId` = SettleGrid's platform-operational account
- `creditAccountId` = developer's SettleGrid account (marks the payout as applied)
- `amountCents` = payout amount in USD (pre-FX)
- `category` = `payout`
- `operationId` = the Wise transaction ID
- `description` = `Manual Wise payout ${quarter}: ${developer_legal_name}`
- `metadata` = `{ wiseFees: <sender_fee_cents>, fxRate: <rate>, recipientCurrency: <ISO-4217>, w8benOnFile: true }`
- `taxCents` = 0 (payouts don't carry tax under our ledger model — tax is only on the SaaS subscription charges)

**1099-NEC obligation.** If a developer receives ≥$600 in a calendar year (manual Wise payouts + any other SettleGrid payouts combined), SettleGrid is required to file a 1099-NEC for them. Because the Cohort-1 developers are foreign persons with W-8BEN on file, 1099-NEC is generally NOT applicable (1099-NEC is for US persons; 1042-S is the non-US form). **Counsel review of the 1042-S filing obligation for manual Wise recipients is part of the Phase-2 lawyer engagement (E-001 in `docs/legal/lawyer-engagement-log.md`)** — do NOT assume "no US person = no filing"; the filing rules depend on whether the income is US-source.

---

## 6. Second-rail decision criteria

The manual stopgap is intentionally constrained. When ANY of these fire, the founder prioritizes the second-rail integration:

1. **Cap breach.** A quarter ended with 5 payouts executed AND at least one waitlist developer was deferred due to cap limits.
2. **Waitlist volume threshold.** Cumulative Cohort-1 waitlist enrollees > 100.
3. **Concentration.** A single Cohort-1 country accounts for ≥50% of outstanding waitlist (suggests a specific rail integration — e.g., if India density spiked we'd look at Razorpay Route; if Nigeria spiked, Flutterwave).
4. **Operational burden.** Manual payouts take >2 founder-hours per quarter (proxy for "operationally unscalable").

The second-rail candidates as of 2026-04-18 are Paddle, Lemon Squeezy, and Wise Business API (in that order of likely first pick). The `RailAdapter` interface (`packages/mcp/src/rails/types.ts`) is already built to accept a new rail without changes to the dashboard or webhook layers — integration is a localized addition.

---

## 7. Rollback / recovery

If a manual Wise payout fails to land (returned payment, incorrect recipient details, Wise account review):

1. **Do not retry without verification.** Re-confirm developer's bank details with them directly.
2. **Hold the ledger entry in pending state** — don't mark the developer's balance as paid until Wise confirms the successful transfer.
3. **If Wise returns the money:** the Wise Business account retains the USD. Retry with corrected details OR refund the developer's SettleGrid balance (reverse the ledger entry).
4. **If Wise flags the account:** stop all pending payouts; contact Wise support; document the flag reason in `docs/legal/incidents/`. This may force the second-rail decision to accelerate.

---

## 8. Contact + change log

- **Operational questions:** founder (compliance@settlegrid.ai)
- **Developer-side questions:** developers reach the founder via the reply thread from the waitlist-confirmation email; no dedicated support portal for this volume.

### Change log

| Date | Change |
|---|---|
| 2026-04-18 | SOP drafted under P2.INTL1. No live payouts yet — the SOP is ready for the first Cohort-1 waitlist opt-in. Counsel review of the 1042-S filing obligation is pending under E-001. |
