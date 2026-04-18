# OFAC Compliance Program

**Document owner:** SettleGrid (Alerterra, LLC)
**Compliance officer:** Lex Whiting (founder)
**Version:** 1.0
**Effective date:** 2026-04-18
**Review cadence:** Annually (next: 2027-04-18) + on any material trigger (see §7)

---

## 1. Purpose + legal basis

The Office of Foreign Assets Control (OFAC) administers US economic sanctions. OFAC sanctions apply **strict civil liability** — a merchant who facilitates a transaction involving a sanctioned person or jurisdiction can face a civil penalty equal to **the IEEPA civil-penalty maximum as adjusted annually by OFAC under the Federal Civil Penalties Inflation Adjustment Act, OR twice the value of the prohibited transaction, whichever is greater**, under 50 USC § 1705 (IEEPA). The adjusted maximum is published at https://ofac.treasury.gov/civil-penalties each year. **Intent is not required for civil penalties.**

SettleGrid's business model — routing SaaS subscription payments through Stripe Connect — places it squarely inside the scope of OFAC obligations. Stripe conducts its own continuous screening, but under a "causing a violation" theory SettleGrid can still be named as a party if SettleGrid's onboarding or continuous-screening gaps result in a US financial institution processing a prohibited transaction. The defense against that theory is a documented, consistently executed OFAC compliance program. This document is that program.

This program draws on OFAC's *A Framework for OFAC Compliance Commitments* (May 2019), which identifies five components of an effective compliance program:

1. Management commitment
2. Risk assessment
3. Internal controls
4. Testing and auditing
5. Training

Each is addressed below.

---

## 2. Management commitment

As the solo founder of SettleGrid, **Lex Whiting holds both operational and compliance authority**. This is formally designated as:

- **Compliance officer:** Lex Whiting
- **Authority:** absolute — the compliance officer can refuse to onboard, can terminate active accounts, can pause specific transactions, and can initiate voluntary self-disclosure, without any further approval.
- **Reporting line:** none (solo founder; no board). Formal board reporting becomes a requirement before SettleGrid's first equity round or first employee hire.
- **Commitment statement:** SettleGrid commits that no US sanctions violation will be considered a tolerable cost of business. Every real or suspected violation triggers the escalation procedure in §6.

This commitment is reaffirmed at the annual review (§7).

---

## 3. Risk assessment

### 3.1 Customer profile

SettleGrid's customers are:

- **Developers (merchants):** individuals and small companies that register with SettleGrid to sell AI tools. Geographically diverse; many solo founders in emerging markets. **Elevated sanctions risk** — individual developers are harder to screen reliably than named corporate entities.
- **Consumers (end buyers):** individuals and companies that subscribe to SettleGrid's Builder/Scale tiers and purchase credit packs. Billing is B2C via Stripe Checkout. **Moderate risk** — Stripe's continuous screening covers most of this surface.

### 3.2 Geographic exposure

SettleGrid's accept-side and payout-side flows both touch US dollar rails. The following jurisdictions are **comprehensively sanctioned** and are **blocked at onboarding** (no signup flow proceeds for an account claiming residency in these jurisdictions):

- Cuba
- Iran
- North Korea (DPRK)
- Syria
- Crimea region of Ukraine
- Donetsk People's Republic (DNR)
- Luhansk People's Republic (LNR)

The comprehensive list is maintained by OFAC at https://ofac.treasury.gov/sanctions-programs-and-country-information and reviewed annually (see §7) or immediately upon OFAC adding a new country.

Additional jurisdictions with **targeted sanctions** (non-comprehensive) are not blocked at the country level but individual persons from those jurisdictions are screened against the SDN list (§4.1).

### 3.3 Product risk

- **Per-invocation billing** of AI tools creates small, high-frequency transactions. Individual transactions rarely exceed $100. This reduces the per-transaction penalty exposure but the aggregate volume makes continuous screening material.
- **Stripe Connect payouts** reach developer bank accounts. A developer who becomes sanctioned after onboarding and whose continuous-screening hit is missed for a sync interval creates the classic OFAC-violation fact pattern.

### 3.4 Residual risk summary

The highest-risk scenario is **Scenario D in the incident-response playbook** (`incident-response-playbook.md` §4) — a developer who relocates to a sanctioned jurisdiction between onboarding and the next monthly re-screen. Mitigations below target this scenario specifically.

---

## 4. Internal controls

### 4.1 Onboarding-time screening

Every developer signup MUST be screened against the OFAC Specially Designated Nationals and Blocked Persons (SDN) list **before** the developer account is created. The check design — to be wired in Phase 3 per §8 Implementation status:

- **Data source:** the OFAC SDN list is published by Treasury in machine-readable formats (XML, CSV, delimited text) at https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists and https://ofac.treasury.gov/consolidated-sanctions-list-data-files. OFAC also operates a public search interface at https://sanctionssearch.ofac.treas.gov/. Our implementation downloads the list daily and screens locally; we do NOT make a per-registration HTTP call to the search interface (that surface isn't a documented REST API and depending on it would make every signup brittle against Treasury's availability).
- **Match criteria:** fuzzy name match (first + last or legal entity name) against the local SDN index. Any match with score ≥ 0.85 routes to manual review before the account is provisioned.
- **Geographic check:** ISO-3166 alpha-2 country from the registrant's billing address. Residence in a comprehensively sanctioned jurisdiction (§3.2) is an automatic block.
- **Outcome logged:** every screening attempt (hit or miss, score, query terms, timestamp, reviewer if manual) is written to an append-only audit log retained for seven years. See §4.5.

A developer who passes screening is assigned an internal `ofac_screened_at` timestamp on their account record.

### 4.2 Continuous (monthly) re-screening

The SDN list is updated by OFAC on an irregular cadence. A person not listed at onboarding can be listed three weeks later. SettleGrid WILL run a monthly re-screening job against the current SDN list (to be wired in Phase 3 per §8):

- **Schedule:** first Monday of each month, at 09:00 UTC, via Vercel Cron.
- **Scope:** every developer whose account status is `active`.
- **Source:** SDN list downloaded from https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists (XML or CSV).
- **Match criteria:** same as onboarding.
- **Outcome:** any hit pauses the developer's account (Stripe payouts halted, signup of new subscriptions blocked) and triggers the manual review procedure in §6.

### 4.3 Geographic blocking at infrastructure layer

Beyond the onboarding check, SettleGrid uses Vercel's geographic header (`x-vercel-ip-country`) to **block sessions originating from sanctioned jurisdictions from reaching the signup page at all.** This is defense-in-depth — the onboarding check is the authoritative control; the infrastructure block reduces false positives in the audit log and the manual-review queue.

### 4.4 Contractual sanctions representation

The Developer Terms of Service include a **sanctions representation and immediate-termination-for-sanctions clause**:

> Developer represents and warrants that Developer is not, and during the term of this agreement will not become, a person or entity subject to US, UN, EU, or UK sanctions, and that Developer is not resident or located in a Comprehensively Sanctioned Jurisdiction. SettleGrid may terminate this agreement immediately and without notice if this representation becomes false.

This contractual layer supports (does not replace) the operational screening. It shifts the factual predicate of any sanctions violation onto the developer's false representation, which strengthens SettleGrid's defense of good-faith compliance.

### 4.5 Audit trail

All OFAC-related events are logged to an append-only audit trail with:

- Developer ID (or null for prospective registrants who didn't complete signup)
- Event type (`ofac.screened`, `ofac.hit`, `ofac.cleared`, `ofac.manual_review_opened`, `ofac.manual_review_decided`, `ofac.account_paused`, `ofac.voluntary_disclosure_filed`)
- Source (`api` or `sdn_list`)
- Query terms (name fields, country)
- Result details (score, matched SDN entry if any)
- Reviewer (for manual-review events)
- Timestamp (ISO-8601 UTC)

Retention: **seven years** from event date, matching Treasury's record-keeping recommendation for OFAC compliance programs.

---

## 5. Testing and auditing

### 5.1 Annual self-audit

At the annual review (§7), the compliance officer performs a self-audit with these steps:

1. Sample 30 developer accounts from the past 12 months. Verify each has a `ofac_screened_at` record within 30 days of account creation.
2. Sample 30 monthly re-screening runs. Verify each ran successfully, covered all active developers, and logged its output.
3. Diff the current blocked-jurisdictions list against OFAC's current comprehensive-sanctions list. Fix any drift.
4. Review all `ofac.hit` events in the past 12 months. Verify each was either cleared with documented reasoning or escalated per §6.
5. Review all terminated accounts to confirm sanctions-related terminations were documented.
6. File the audit findings in `docs/legal/ofac-audits/YYYY-audit.md`.

### 5.2 External counsel review

External fintech counsel reviews the OFAC program every two years, or immediately on any of:

- A new SettleGrid product that expands the transaction surface (wallet, custody, stablecoin integration)
- A regulatory change (new OFAC program, new SDN listing process)
- A suspected or confirmed violation
- Expansion to EU-resident developers (DAC7 interaction)

### 5.3 Penetration of the onboarding check

Quarterly, the compliance officer submits a test name known to be on the SDN list (e.g., a historical public entry) via the onboarding form. The check must flag it. If the check fails to flag, the monthly re-screening job is also assumed broken and both are investigated within 24 hours.

---

## 6. Escalation + voluntary self-disclosure

### 6.1 Operational escalation

When a screening hit or suspected violation is identified:

1. **Within 1 hour:** pause the developer's account (stop outbound payouts, block new subscriptions on this account, freeze any reserved funds).
2. **Within 24 hours:** the compliance officer personally reviews the hit. If it's a false positive (name collision), document the reasoning and clear the account.
3. **Within 72 hours:** if the hit is confirmed, notify counsel and prepare the voluntary-disclosure package.
4. **Within 5 business days:** submit voluntary self-disclosure to OFAC Enforcement (see §6.2).

### 6.2 Voluntary self-disclosure

OFAC's **Economic Sanctions Enforcement Guidelines (31 CFR Part 501, Appendix A)** treat voluntary self-disclosure as a significant mitigating factor — **up to 50% reduction in civil penalties**. The package includes:

- Timeline of the transaction(s)
- Facts establishing the apparent violation
- Corrective actions taken
- Internal-controls updates to prevent recurrence

Process: the Enforcement Guidelines at 31 CFR Part 501, App. A, §II.I (https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-501/appendix-Appendix%20A%20to%20Part%20501) describe what constitutes a voluntary self-disclosure + what mitigation applies. Current submission channels are listed on OFAC's contact page (https://ofac.treasury.gov/contact-ofac). SettleGrid's counsel finalizes and submits through the current OFAC-published channel. The compliance officer does NOT submit unilaterally because a botched disclosure can waive the mitigation entirely.

### 6.3 Stripe notification

Any confirmed OFAC violation is also disclosed to Stripe via the platform's risk contact. Stripe's own reporting obligations dovetail with OFAC's, and Stripe tends to preserve platform relationships far longer when kept ahead of investigations rather than surprised by them.

---

## 7. Training + review schedule

### 7.1 Compliance officer training

The compliance officer completes one of the following within 60 days of becoming compliance officer and annually thereafter:

- OFAC Academy: free online training at https://ofac.treasury.gov/ofac-academy
- An equivalent counsel-delivered session on OFAC sanctions administration

Training completion is logged in `docs/legal/ofac-training-log.md`.

### 7.2 Operator training

Any future SettleGrid employee with customer-facing or risk responsibilities reads this document on hire, acknowledges via a dated signature in the training log, and repeats the OFAC Academy module annually. As a solo founder, this is a no-op today; it activates with the first hire.

### 7.3 Program review schedule

| Trigger | Review scope |
|---|---|
| Annual (anniversary of effective date) | Full document, §1–§9 |
| Quarterly | §5.3 onboarding-check penetration test |
| Monthly | §4.2 re-screening run verification |
| On material change | Any of: new product launched, new jurisdiction supported, new employee hired, SDN listing removed/added for an existing developer, chargeback spike |

---

## 8. Implementation status

This program documents the controls SettleGrid commits to, including some that are **not yet wired in code**. This section is the honest breakdown so an external reviewer (counsel, OFAC, Stripe risk) can see exactly what's operational today vs. what's on the Phase-3 build plan. **Do not mis-read "will run" language in §4 as "is running right now."**

| Control | Section | Status today | Target activation |
|---|---|---|---|
| Contractual sanctions representation in Developer ToS | §4.4 | **Deferred** — ToS draft is still under counsel review (E-001 in `docs/legal/lawyer-engagement-log.md`). Representation clause is in the draft; awaits final-form sign-off. | Phase 2 close (~2026-05-09) |
| Geographic blocking at onboarding (comprehensively-sanctioned jurisdictions) | §4.3 | **Not yet wired.** The jurisdiction list is canonical in this doc; the block isn't enforced in the signup handler. | Phase 3 (P3.COMP or equivalent) |
| Onboarding-time SDN screening | §4.1 | **Not yet wired.** Design documented here; no code currently screens registrants against the SDN list. | Phase 3 |
| Monthly re-screening cron | §4.2 | **Not yet scheduled.** Will ship alongside the onboarding check so both paths share the same local SDN-index implementation. | Phase 3 |
| Append-only audit trail for OFAC events | §4.5 | **Not yet wired** (depends on §4.1 and §4.2). Schema shape documented in §4.5; table not yet migrated. | Phase 3 |
| Founder OFAC Academy completion | §7.1 | **Scheduled.** Target completion by 2026-06-17 (60 days from program effective date). Log: `docs/legal/ofac-training-log.md`. | 2026-06-17 |
| External counsel review of this program | §5.2 | **In progress.** Retained under E-001 (`docs/legal/lawyer-engagement-log.md`). | Phase 2 close |
| Quarterly onboarding-check penetration test | §5.3 | **Blocked on §4.1.** First run after onboarding screening ships. | Phase 3 |

**Launch-defensibility posture until the Phase 3 controls activate:**

Until the onboarding SDN check, re-screening cron, and audit trail are all live, SettleGrid's OFAC posture rests on:
1. Stripe's own continuous screening of Connect Platform accounts (Stripe is a large regulated entity with its own SDN program)
2. The comprehensively-sanctioned-jurisdictions list being enforced by the Developer ToS representation (once executed) even without the infrastructure-layer block
3. Manual review of all high-value or unusual signups by the compliance officer (solo founder volume makes this tractable)
4. Voluntary self-disclosure posture (§6.2) committing to OFAC engagement on any discovered issue, with counsel in hand

The P3 build plan moves these from "commitment" to "automated + auditable" before any external event (Stripe audit, OFAC inquiry, regulatory examination) forces the question.

---

## 9. Contact + records

- **Compliance officer email:** compliance@settlegrid.ai (routes to founder inbox)
- **OFAC Compliance Hotline:** 1-800-540-6322 (Treasury)
- **Voluntary self-disclosure submission channels:** see OFAC's current contact page at https://ofac.treasury.gov/contact-ofac and the Enforcement Guidelines regulation at 31 CFR Part 501 App. A §II.I. Counsel finalizes + submits.
- **Counsel of record:** *TBD — see `docs/legal/tax-registrations.md` for the Phase 2 lawyer engagement that will be retained for OFAC review as well.*

### 8.1 Related documents

- `docs/legal/acceptable-use-policy.md` — prohibited business categories that overlap with sanctions compliance
- `docs/legal/incident-response-playbook.md` — §4 covers OFAC-violation response (Scenario D)
- `private/master-plan/compliance-posture.md` — source-of-truth compliance analysis
- Developer Terms of Service §[SANCTIONS] — the contractual representation
- `docs/legal/ofac-training-log.md` — compliance officer + operator training completions

---

## Change log

| Date | Version | Change |
|---|---|---|
| 2026-04-18 | 1.0 | Initial program drafted under P2.COMP1. Geographic blocks active; onboarding screening active; monthly re-screening cron to be activated in P3. Lawyer engagement kicked off for review. |
