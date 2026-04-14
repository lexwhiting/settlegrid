# Stripe Data Processing Addendum (DPA) — Execution Status

**Tracking ref:** P1.COMP2
**Current status:** NOT YET EXECUTED — pending founder action
**Created:** 2026-04-14
**Stripe DPA URL:** https://stripe.com/legal/dpa

---

## ⚠️ Action required from founder

The Stripe Data Processing Addendum is a standard contract that SettleGrid (as a customer of Stripe) must execute in order to formally establish Stripe as a processor of personal data on SettleGrid's behalf under GDPR, UK GDPR, and certain US state privacy laws. This execution is required before any personal data of EU/UK data subjects flows through the platform.

**Since EU developer onboarding is currently blocked at MVP (pending SettleGrid's DAC7 reporting infrastructure — see `docs/legal/privacy-notice-draft.md` § 6), the DPA is not yet operationally blocking any data flow.** However, executing it preemptively is good practice because:

1. It establishes the baseline processor relationship before any EU data arrives.
2. Stripe's DPA is a take-it-or-leave-it standard form — executing it is a ~10-minute task that doesn't benefit from delay.
3. It's a visible checkmark in a privacy due-diligence conversation with future enterprise customers or partners.

## How to execute

Stripe offers DPA execution via two equivalent mechanisms. Pick whichever is easier:

### Option A — Stripe Dashboard (preferred)

1. Log in to the SettleGrid Stripe account at https://dashboard.stripe.com
2. Navigate to **Settings → Legal and documents → Data Processing Addendum**
3. Review the current DPA text (Stripe posts the version at https://stripe.com/legal/dpa)
4. Click **Accept** or **Execute** (the exact label may vary)
5. Stripe will issue a countersigned PDF. Download it.
6. Save the PDF locally at `docs/legal/stripe-dpa-executed.pdf` (gitignored — do not commit the PDF itself; only reference it in this status document)
7. Update the "Execution details" table below

### Option B — Direct execution via Stripe legal page

1. Visit https://stripe.com/legal/dpa
2. Scroll to the bottom of the DPA page — Stripe provides an execution flow for customers who can't use the Dashboard (or whose Dashboard access is locked to a non-admin account)
3. Follow the signing workflow
4. Save the executed copy as above

## What this DPA covers

Per the Stripe DPA template at https://stripe.com/legal/dpa (read once before executing to confirm the terms):

- **Processor relationship:** Stripe acts as a data processor on SettleGrid's behalf for the subset of personal data SettleGrid forwards to Stripe for payment processing purposes.
- **EU Standard Contractual Clauses (SCCs):** The Stripe DPA incorporates the EU Commission's modular SCCs for international data transfers from the EEA to Stripe's US infrastructure.
- **UK International Data Transfer Addendum:** Equivalent protection for UK-origin personal data.
- **Subprocessing authorization:** General authorization for Stripe to use its own subprocessors (e.g., AWS) with notice requirements.
- **Data subject rights assistance:** Stripe commits to reasonable assistance when SettleGrid receives a data-subject-access, erasure, or portability request that touches Stripe-held data.
- **Security measures:** Schedule of technical and organizational measures.
- **Audit rights:** Annual audit rights against Stripe's published SOC 2 / ISO 27001 reports.

## Execution details (founder: fill in after signing)

| Field | Value |
|---|---|
| Execution date | _YYYY-MM-DD_ |
| Stripe DPA version | _e.g., "Version dated March 1, 2025" — visible at https://stripe.com/legal/dpa_ |
| Signatory (SettleGrid) | _Founder name_ |
| Signatory title | _e.g., "Chief Executive Officer"_ |
| Stripe counterparty entity | _Stripe Payments Company (US) or Stripe Payments Europe Ltd (EU)_ |
| Countersigned PDF path | _docs/legal/stripe-dpa-executed.pdf (gitignored — PDF not committed)_ |
| SCC modules enabled | _Typically Module 2 (controller-to-processor)_ |
| Notification preference for subprocessor changes | _email to founder@settlegrid.ai, or similar_ |

## Related documents

- `docs/legal/privacy-notice-draft.md` — the privacy notice that identifies Stripe as a subprocessor and references this DPA status
- `docs/legal/terms-of-service-draft.md` — the Developer Terms of Service that bind Developers to pass-through compliance with Stripe's own agreements (§ 8)
- `private/master-plan/compliance-posture.md` — the overall compliance posture from which this P1.COMP2 prompt was derived

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-04-14 | Initial tracker created; DPA not yet executed | Claude (P1.COMP2 drafting) |

_(Append new rows when the DPA is executed, re-executed after a Stripe version change, or amended.)_
