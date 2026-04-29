# Tax Registrations

**Document owner:** SettleGrid founder (Alerterra, LLC)
**Last reviewed:** 2026-04-18
**Cadence:** Reviewed quarterly at filing time + any time a new registration is added.

---

## Purpose

Track every jurisdiction where SettleGrid is (or is pending to be) registered to collect and remit sales tax / VAT / GST. Stripe Tax auto-calculates the correct rate at checkout per this registration list; a jurisdiction not listed here is NOT taxed (Stripe returns `rate: 0`).

If this file is out of sync with the Stripe Dashboard → Settings → Tax → Registrations screen, **the Stripe Dashboard is authoritative**. Update this file to match after any registration-status change.

## Status glossary

- **Active** — registration number issued by the authority; Stripe Tax is collecting.
- **Pending** — application submitted, awaiting the authority (OSS registrations can take ~2 weeks).
- **Monitoring** — nexus thresholds tracked in Stripe Tax's nexus-alerts; no registration yet.
- **Planned** — future jurisdiction identified by demand signal; no application filed.

---

## Phase 2 launch registrations

These cover the bulk of early customers per the master-plan geographic projection.

### European Union — VAT OSS (One-Stop-Shop)

| Field | Value |
|---|---|
| Scope | B2C digital services sold to EU-resident consumers; B2B reverses charge via VIES |
| Registration number | *Pending — applied YYYY-MM-DD* |
| Issuing authority | Irish Revenue (home-state election for Delaware C-corp / LLC filers) |
| Filing frequency | Quarterly |
| Next filing due | *TBD after registration issues* |
| Stripe-Tax registration ID | *Paste from Stripe Dashboard after activation* |
| Notes | The OSS scheme is a single registration covering all 27 EU member states for B2C digital services — removes the need for per-country VAT registration up to the €10,000 threshold (SettleGrid will exceed this almost immediately). |

### United Kingdom — VAT

| Field | Value |
|---|---|
| Scope | UK consumer sales + B2B where the customer is NOT VAT-registered |
| Registration number | *Pending — applied YYYY-MM-DD* |
| Issuing authority | HMRC |
| Filing frequency | Quarterly |
| Next filing due | *TBD after registration issues* |
| Stripe-Tax registration ID | *Paste from Stripe Dashboard after activation* |
| Notes | B2B UK customers with a valid VAT ID trigger reverse charge (we do not collect VAT; they self-assess). The VAT ID is validated via HMRC's check-uk-vat-number API before the subscription treats the customer as reverse-charge eligible. |

### United States — state-by-state sales tax

SettleGrid picks up economic nexus in a state when it crosses that state's thresholds (commonly $100K/year in sales OR 200 transactions/year). Stripe Tax's nexus-alerts surface approaching thresholds; the founder MUST register in the state within ~30 days of crossing.

| State | Nexus status | Threshold crossed | Registration | Filing frequency | Notes |
|---|---|---|---|---|---|
| Delaware | No sales tax | N/A | Not required | N/A | SettleGrid's state of incorporation; Delaware has no state sales tax. |
| California | Monitoring | — | Planned on crossing | Quarterly | $500K economic nexus threshold. Franchise-tax obligation separate (handled by state filings, not sales tax). |
| New York | Monitoring | — | — | Quarterly | $500K + 100-transaction threshold. |
| Texas | Monitoring | — | — | Monthly | $500K threshold. |
| Washington | Monitoring | — | — | Monthly | $100K threshold; much lower — likely first state crossed. |

States not listed are **monitoring via Stripe Tax nexus-alerts**. Add rows as nexus is approached.

### US federal income-tax obligations — OUT OF SCOPE for this file

Delaware franchise tax, federal income tax, and sales-tax-on-services distinctions are handled by the company's corporate filings (not by Stripe Tax). This file only tracks consumption-tax (sales / VAT / GST) registrations.

---

## Operational roles

- **Founder (Lex Whiting)** owns the registration list and quarterly filings.
- **Stripe Tax** calculates rates at checkout + produces filing-ready reports.
- **Tax authority portals** (HMRC, Revenue, US states) are where the actual filings are submitted.
- **Stripe does NOT file on behalf of the merchant** outside the limited EU VAT OSS case. For every other jurisdiction, the founder pulls the Stripe Tax report each quarter and files via the authority's portal. See `docs/legal/quarterly-tax-filing-sop.md`.

## Watch items (from the P2.TAX1 prompt)

1. **VAT OSS registration calendar wait** — approximately 2 weeks from application to issued registration. START THIS ON DAY 1 OF THE P2.TAX1 EXECUTION WINDOW, not day 2.
2. **US nexus is stateful** — Stripe Tax monitors but does NOT register on behalf. Set a 30-day SLA on crossing a new state's threshold → registration.
3. **Reverse charge is not automatic fraud prevention** — we validate EU VAT IDs via VIES before treating any subscription as reverse-charged. See `apps/web/src/lib/stripe-tax.ts:validateEuVatId`.

## Legal-review log

| Date | Consultant | Question asked | Answer |
|---|---|---|---|
| *Pending* | *Fintech lawyer* | OSS home-state election (Ireland vs Germany) for a Delaware-C-corp filer | *Answer when received* |
| *Pending* | *Same* | When does SettleGrid have California nexus as a SaaS-services seller? | *Answer when received* |

Legal-review budget for Phase 2: **up to $500** for a one-off fintech-lawyer consult (per P2.TAX1 spec, budget constraints).

---

## Change log

| Date | Change |
|---|---|
| 2026-04-18 | File created as part of P2.TAX1. All registrations in "Pending" or "Monitoring" state until the Stripe Tax dashboard configuration + legal filings complete. |
