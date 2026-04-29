# Quarterly Tax Filing SOP

**Document owner:** SettleGrid founder
**Last reviewed:** 2026-04-18
**Cadence:** Executed quarterly. One pass per registration listed in `docs/legal/tax-registrations.md`.

---

## Context

Stripe Tax calculates and collects VAT / GST / sales tax at checkout, but it does NOT file the return for SettleGrid in most jurisdictions. The founder pulls Stripe Tax's per-jurisdiction report each quarter and submits it through the authority's portal.

**The one exception** is EU VAT OSS: Stripe Tax produces an OSS-compatible report that the founder uploads to the Irish Revenue OSS portal. Ireland remits to the other 26 member states. Non-EU filings (UK, US states) are one-by-one.

SettleGrid treats tax as a pass-through: Stripe Tax's reported collection must equal the `tax_cents` SUM on the ledger for the same period. Any mismatch is a reconciliation blocker for the next filing.

---

## Quarterly cadence

```
 Quarter ends (e.g., Q1 = Jan-Mar) → review period Apr 1–15 → all filings submitted by Apr 30
```

The review window is 15 days: pulling reports, running reconciliation, filling each portal. US state deadlines can be sooner than EU — CA, NY, and WA all have due dates around the 20th of the month after quarter-end. Set calendar reminders for the earliest deadline per jurisdiction.

---

## Step-by-step

### 0. Preconditions

- All Stripe charges for the period have settled (wait at least 48 hours after quarter-end for last-minute transactions to clear).
- The ledger reconciliation job has run for the period — Stripe Tax collection should equal `SUM(tax_cents)` on the ledger. Run:
  ```sql
  SELECT tax_jurisdiction, SUM(tax_cents) AS collected_cents
  FROM ledger_entries
  WHERE created_at >= '<quarter-start>'
    AND created_at <  '<quarter-end>'
    AND tax_jurisdiction IS NOT NULL
  GROUP BY tax_jurisdiction
  ORDER BY collected_cents DESC;
  ```
- Compare against Stripe Dashboard → Tax → Reports → by jurisdiction.
- Any mismatch → stop, resolve, don't file until resolved.

### 1. EU VAT OSS filing

1. Log into Stripe Dashboard → Tax → Registrations → EU.
2. Download the OSS report (CSV + OSS XML) for the quarter.
3. Log into the Irish Revenue OSS portal (https://ros.ie).
4. Upload the OSS XML. Review the summary. Submit.
5. Pay the total due via SEPA (settles from SettleGrid's operating EUR account).
6. Download the filing confirmation; save to `~/SettleGrid/filings/<year>-Q<n>-EU-OSS.pdf`.
7. Update `docs/legal/tax-registrations.md`'s "Next filing due" row for EU.

### 2. UK VAT filing

1. Log into Stripe Dashboard → Tax → Registrations → GB.
2. Download the UK VAT report (Making Tax Digital-compatible format).
3. Log into HMRC (https://www.gov.uk/log-in-register-hmrc-online-services).
4. Submit the MTD VAT return. Review the calculated total.
5. Pay via bank transfer (GBP operating account).
6. Save the confirmation PDF.
7. Update tax-registrations.md's "Next filing due" row for UK.

### 3. Per US state

Per each US state listed as "Active" in tax-registrations.md:

1. Pull that state's Stripe Tax report.
2. Log into the state's revenue portal (links in Stripe's registration details).
3. Submit the return (some states are monthly — check the cadence column).
4. Pay via ACH.
5. Save the confirmation PDF.

### 4. After all filings submitted

1. Total remitted should equal `SUM(tax_cents)` from the ledger query in step 0.
2. Update `docs/legal/tax-registrations.md` — bump "Next filing due" dates forward one period.
3. Archive this quarter's Stripe Tax reports to `~/SettleGrid/filings/<year>-Q<n>/`.
4. Close the "Q<n> tax filings" calendar event.

---

## Failure modes + recovery

| Failure | Recovery |
|---|---|
| Stripe Tax report shows a jurisdiction SettleGrid didn't register for | Retroactively register (ASAP — penalties may apply). In the interim, file a zero-return for the missed period once registered. |
| Reconciliation mismatch (ledger vs Stripe Tax) | Do NOT file. Audit the ledger writes for the period — look for subscription charges where `tax_cents=0` and the customer's country is in-scope. Correct via compensating entries before filing. |
| Authority portal rejects the XML / CSV | Contact Stripe Tax support. Do NOT hand-edit the report. If the authority's format has drifted, Stripe may need to push an adapter update. |
| Missed filing deadline | File as soon as possible. Late-filing penalties vary by jurisdiction; typically percentage-of-liability. Log in tax-registrations.md under "Change log". |
| Stripe Tax disabled accidentally mid-period | Disaster mode. Stripe Tax returns rate=0 when disabled; any subscription charged during that window has no tax. Re-enable immediately. Manually invoice affected customers for the missing VAT via Stripe Invoice with a zero-rated line + the VAT line, referencing the original charge. See next paragraph. |

### Reverse-billing affected customers after a Stripe Tax outage

If Stripe Tax was disabled during a period when customers in taxable jurisdictions were charged:

1. Export the list of affected charges (check `ledger_entries.tax_cents = 0 AND customer_country IN <taxable_list>` for the outage window).
2. For each, create a follow-up Stripe Invoice with a single line item: the VAT amount calculated post-hoc from the rate that would have applied.
3. Email the customer referencing the original charge + explaining the follow-up.
4. After collection, post a ledger entry with `tax_cents` = the collected amount and `tax_jurisdiction` = the customer's country.
5. File the collected amounts with the next quarterly return.

---

## Change log

| Date | Change |
|---|---|
| 2026-04-18 | SOP created as part of P2.TAX1. Stripe Tax dashboard enablement + OSS/UK registrations pending. Next filing date TBD once registrations activate. |
