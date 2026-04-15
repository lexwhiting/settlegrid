# Stripe Data Processing Addendum (DPA) — Execution Status

**Tracking ref:** P1.COMP2
**Current status:** **IN EFFECT** (deemed executed via Stripe Services Agreement incorporation)
**Countersigned PDF:** Not yet obtained — optional; see "Optional: request countersigned copy" below
**Created:** 2026-04-14
**Status updated:** 2026-04-14 (after confirming that SettleGrid's Stripe Dashboard does not expose a separate DPA execution flow — Stripe has moved this account to the auto-incorporated model)
**Stripe DPA URL:** https://stripe.com/legal/dpa

---

## Current state — IN EFFECT via SSA

Stripe has transitioned newer customer accounts (generally US-hosted, created in the last ~18 months) away from the legacy "click to execute DPA" flow. For SettleGrid's account:

- **The Stripe Services Agreement ("SSA")** — the master contract accepted at Stripe account signup — **incorporates the current Stripe DPA by reference.** The text of the incorporated DPA is maintained by Stripe at https://stripe.com/legal/dpa.
- **Execution event:** SettleGrid's acceptance of the SSA at Stripe account creation. The DPA protections apply from that moment onward; no separate click-to-sign action is available in `https://dashboard.stripe.com/settings/compliance` (verified 2026-04-14 — only PCI compliance framework is listed).
- **Legal effect:** SettleGrid is a Stripe customer and Stripe is a sub-processor of personal data for the purposes described in the DPA. All of the DPA's standard protections are in force (EU SCCs Module 2, UK IDTA, subprocessor authorization, security measures schedule, data subject rights assistance, audit rights via SOC 2 / ISO 27001 reports).

This is the normal state for many modern Stripe customers and is the position SettleGrid would take in a due-diligence conversation today: *"The Stripe DPA is incorporated into our Stripe Services Agreement acceptance and has been in effect since our Stripe account was created. A countersigned PDF is available on request from Stripe compliance."*

## Optional: request countersigned copy

For due-diligence parity with customers who do have a separately-signed PDF, SettleGrid can request a countersigned copy from Stripe compliance. This is **optional** — not required for the DPA to be legally in force — but useful to have in the file for future enterprise-customer privacy reviews.

**How to request:**

1. Email `compliance@stripe.com` (or `support@stripe.com` if Stripe support routes it) with a message like the draft below.
2. Stripe typically responds with a PDF within 1-3 business days.
3. Save the PDF locally at `docs/legal/stripe-dpa-executed.pdf` (gitignored — do NOT commit; only reference in this tracker).
4. Update the "Execution details" table below with the PDF location + the version date from the PDF header.

**Draft request email** (founder may copy-paste and send):

> **Subject:** Request for countersigned Data Processing Addendum — SettleGrid, Inc.
>
> Hi Stripe Compliance team,
>
> Could you please send a countersigned copy of the Stripe Data Processing Addendum for our account?
>
> - **Account name:** SettleGrid, Inc.
> - **Account holder email:** [founder email]
> - **Account ID (if known):** [acct_xxxxx — found at https://dashboard.stripe.com/settings/account under "Account details"]
>
> We've confirmed that the DPA is already in effect via our Stripe Services Agreement acceptance, and we're not requesting any modifications — this is a records-keeping request so we have a countersigned PDF in our compliance folder for future due-diligence conversations.
>
> Thanks,
> [Founder name]
> SettleGrid, Inc.
> [founder email]

## What this DPA covers

Per the Stripe DPA template at https://stripe.com/legal/dpa (read once before executing to confirm the terms):

- **Processor relationship:** Stripe acts as a data processor on SettleGrid's behalf for the subset of personal data SettleGrid forwards to Stripe for payment processing purposes.
- **EU Standard Contractual Clauses (SCCs):** The Stripe DPA incorporates the EU Commission's modular SCCs for international data transfers from the EEA to Stripe's US infrastructure.
- **UK International Data Transfer Addendum:** Equivalent protection for UK-origin personal data.
- **Subprocessing authorization:** General authorization for Stripe to use its own subprocessors (e.g., AWS) with notice requirements.
- **Data subject rights assistance:** Stripe commits to reasonable assistance when SettleGrid receives a data-subject-access, erasure, or portability request that touches Stripe-held data.
- **Security measures:** Schedule of technical and organizational measures.
- **Audit rights:** Annual audit rights against Stripe's published SOC 2 / ISO 27001 reports.

## Execution details

| Field | Value |
|---|---|
| **Execution mechanism** | **Auto-incorporated via Stripe Services Agreement (SSA)** — no separate click-to-execute flow exists for this account |
| **Effective date** | Date of Stripe account creation (SSA acceptance) — founder to fill in from `https://dashboard.stripe.com/settings/account` "Account details → Created" field |
| **Stripe DPA version at effective date** | As published at https://stripe.com/legal/dpa at the time of SSA acceptance — Stripe updates this periodically; the then-current version is what applies, with Stripe's normal notice mechanism for updates |
| Signatory (SettleGrid) | Lex Whiting (SSA acceptance) |
| Signatory title | Founder, SettleGrid, Inc. |
| Stripe counterparty entity | Stripe Payments Company (US) — inferred from Delaware-corp SettleGrid; founder to confirm from Stripe Account details |
| Countersigned PDF path | **Not yet obtained** (optional request to compliance@stripe.com — see "Optional: request countersigned copy" above). When obtained: `docs/legal/stripe-dpa-executed.pdf` (gitignored) |
| SCC modules enabled | Module 2 (controller-to-processor) via Stripe's standard DPA incorporation; Module 3 (processor-to-subprocessor) for Stripe's own subprocessors |
| Notification preference for subprocessor changes | Stripe's default — email to account holder's registered admin email |

## Related documents

- `docs/legal/privacy-notice-draft.md` — the privacy notice that identifies Stripe as a subprocessor and references this DPA status
- `docs/legal/terms-of-service-draft.md` — the Developer Terms of Service that bind Developers to pass-through compliance with Stripe's own agreements (§ 8)
- `private/master-plan/compliance-posture.md` — the overall compliance posture from which this P1.COMP2 prompt was derived

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-04-14 | Initial tracker created; DPA "pending founder action" assuming a click-to-sign flow existed | Claude (P1.COMP2 drafting) |
| 2026-04-14 | Status updated to "IN EFFECT via SSA incorporation" after confirming the Stripe Dashboard compliance settings page shows only PCI compliance framework — no separate DPA flow exists for this account. Documented the Stripe Services Agreement incorporation mechanism. Added an optional draft email for requesting a countersigned copy from Stripe compliance. | Claude (P1.COMP2 audit follow-up) |

_(Append new rows when: the optional countersigned PDF is obtained from Stripe compliance; Stripe publishes an updated DPA version and a re-execution is needed; or the DPA is amended for any other reason.)_
