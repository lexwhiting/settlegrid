# SettleGrid Developer Terms of Service

> ⚠️ **DRAFT — pending lawyer review in P2.COMP1.** This document is an engineering-drafted starting point. It has NOT been reviewed by counsel and MUST be reviewed by a qualified U.S. fintech attorney before any developer onboards under it. Specific clauses (agent-of-payee language, sanctions representation, chargeback allocation, geographic restrictions) are derived from `private/master-plan/compliance-posture.md` and CA DFPI's 2017 Stripe agent-of-payee letter. Engineering judgment was used; legal advice was not given.

**Document version:** Draft 1
**Drafted:** 2026-04-14
**Tracking ref:** P1.COMP1
**Effective date:** Not yet effective. No developer has been bound by this draft.
**Architecture context:** This draft assumes Pattern A+ (Stripe-only with extensible RailAdapter). The earlier Pattern C plan (Stripe + Polar.sh as Merchant of Record) was abandoned 2026-04-14 after Polar declined SettleGrid's merchant application — see `docs/legal/polar-onboarding-status.md`. References to Polar were removed from the operative clauses; a future revision can reintroduce additional rails when integrated.

---

## 1. Preamble

SettleGrid, Inc. ("SettleGrid," "we," "us," "our") operates a payment infrastructure platform that helps software developers monetize Model Context Protocol (MCP) tool servers and HTTP APIs. SettleGrid uses Stripe Payments Company ("Stripe") and its Stripe Connect Express product as the licensed payment processor and money transmitter for all developer payouts. **SettleGrid does not hold, custody, or transmit customer funds.** All customer funds are processed and held by Stripe in accordance with the Stripe Connected Account Agreement and the Stripe Services Agreement.

These Terms of Service (these "Terms") govern your use of the SettleGrid platform as a developer (a "Developer"). By creating a SettleGrid account, accepting these Terms, or using any part of the platform, you agree to be bound by these Terms.

If you are accepting these Terms on behalf of a company, partnership, or other legal entity, you represent that you have the authority to bind that entity. The terms "you" and "your" refer to both you individually and to any entity on whose behalf you are accepting.

---

## Definitions

For clarity throughout these Terms:

- **"Developer"** means you, the person or entity registering for and using SettleGrid to monetize a tool, API, or service.
- **"Customer"** means any natural person or entity that pays for an invocation of a Developer's tool through the SettleGrid platform.
- **"Tool"** means a Developer's software service made available via the SettleGrid platform — typically an MCP server or HTTP API.
- **"Invocation"** means a single, billable execution of a Tool's method or endpoint.
- **"Platform"** means the SettleGrid software-as-a-service platform, including the dashboard at settlegrid.ai, the @settlegrid/mcp SDK, and the hosted Smart Proxy.
- **"Payment Processor"** means Stripe Payments Company. Additional licensed payment processors may be added in the future via amendment to these Terms.
- **"Sanctioned Jurisdiction"** means any country, region, or person subject to comprehensive sanctions administered by the U.S. Office of Foreign Assets Control (OFAC), the U.S. Department of State, or the United Nations Security Council, as updated from time to time.

---

## 2. Agent-of-Payee Appointment (CA + NY compliant)

**By agreeing to these Terms, you appoint SettleGrid, Inc. as your agent for the limited purpose of receiving and processing payments from customers on your behalf. Delivery of payment to SettleGrid (or to a payment processor acting on SettleGrid's behalf) shall be deemed payment to you and shall extinguish the customer's payment obligation to you. SettleGrid assumes no risk of loss to the payor in connection with this arrangement.**

(The preceding paragraph is the core agent-of-payee appointment and tracks the language used in California Department of Financial Protection and Innovation's 2017 letter regarding Stripe Connect, which is the published template for this exemption. Lowercase "customer" and "payment processor" in the quoted language match the DFPI letter's phrasing; where these terms are capitalized elsewhere in these Terms, they refer to the defined terms "Customer" and "Payment Processor".)

The agency appointed above is limited to the receipt, processing, and onward disbursement of Customer payments via the Payment Processor and does not extend to any other matter. You acknowledge that this agency arrangement is essential to the structure of the Platform and that SettleGrid's role as your agent for payment is limited to the activities described in this Section 2.

This clause is structured to satisfy:

- The agent-of-payee exemption from money transmitter licensing in California under California Financial Code § 2010(l) and as interpreted in the California Department of Financial Protection and Innovation's 2017 letter regarding Stripe Connect (the "DFPI Letter").
- The analogous agent-of-payee exemption in New York under 23 NYCRR § 200.3(c)(2).
- The corresponding payment processor exemption from federal money transmitter status under 31 CFR § 1010.100(ff)(5)(ii)(B), which requires (i) facilitating purchase of goods or services rather than standalone money transmission, (ii) operation through clearance and settlement systems that admit only BSA-regulated financial institutions, (iii) provision of the service pursuant to a formal agreement, and (iv) the funds-recipient being a person other than the payor.

---

## 3. Flow of Funds Disclaimer

**SettleGrid does not hold, custody, or transmit customer funds. All customer funds are processed and held by licensed payment processors (currently Stripe Payments Company) in accordance with their respective terms of service.**

The Stripe Connected Account Agreement and the Stripe Services Agreement are incorporated by reference into these Terms (see Section 8 below). Additional licensed payment processors may be added by amendment to these Terms; until such an amendment takes effect, Stripe Payments Company is the sole Payment Processor.

Specifically:

- Customer payments are charged via Stripe's payment infrastructure, with funds held in a Stripe-controlled account from receipt through disbursement.
- Disbursements to your bank account are made by Stripe directly via Stripe Connect Express's transfer mechanism.
- SettleGrid's "platform fees" (the per-invocation amount SettleGrid charges as compensation for use of the Platform) are deducted via Stripe's `application_fee_amount` mechanism at the time of charge, never via a separate transfer. SettleGrid does not at any point hold the gross amount and disburse the net.
- SettleGrid maintains internal ledger entries that record Customer payment activity for reconciliation, dispute, and reporting purposes. These ledger entries are accounting records, not custody.

You acknowledge that SettleGrid's compliance posture (specifically, exemption from federal and state money transmitter licensing requirements) depends on this no-custody arrangement, and that any modification to the flow of funds requires advance written notice from SettleGrid and an opportunity for you to terminate this Agreement.

---

## 4. Sanctions Representation and Immediate-Termination Right

You represent and warrant that, as of the effective date of these Terms and continuously throughout your use of the Platform:

(a) You are not located in, ordinarily resident in, or organized under the laws of, any Sanctioned Jurisdiction;

(b) You are not on the U.S. Department of the Treasury's List of Specially Designated Nationals and Blocked Persons (the "SDN List"), the Sectoral Sanctions Identifications List, the Foreign Sanctions Evaders List, or any analogous list maintained by OFAC or by the United Nations, the European Union, or the United Kingdom;

(c) You are not owned 50% or more in the aggregate, directly or indirectly, by one or more persons listed on any of the lists referenced in clause (b);

(d) You will not use the Platform to provide goods or services to, or accept payment from, any person or entity covered by clauses (a), (b), or (c) above, knowingly or otherwise, and you will use commercially reasonable measures to detect such persons among your Customers; and

(e) You will notify SettleGrid in writing within 24 hours if you become aware of any fact or change in circumstances that would render any of the foregoing representations untrue.

**SettleGrid reserves the unilateral right to terminate this Agreement, freeze your Tool's access to the Platform, and cooperate with any sanctions hold or governmental inquiry, immediately and without notice, upon any actual or suspected breach of this Section 4.** Termination under this Section 4 is without liability to SettleGrid and does not entitle you to any refund or settlement of pending invocations.

---

## 5. Chargeback Liability Allocation

You acknowledge that Customer chargebacks, payment disputes, refund requests, and similar reversals (collectively, "Chargebacks") are an inherent risk of accepting electronic payments. You agree to the following allocation:

(a) **You bear the financial liability for all Chargebacks attributable to your Tool**, including the original transaction amount, any Stripe-imposed dispute fees, and any reasonable third-party costs incurred by SettleGrid in handling the Chargeback.

(b) **SettleGrid reserves the right to maintain a rolling reserve** of up to 20% of your gross transaction volume, held back from payouts for up to 30 days from the original transaction date, to secure your Chargeback liability. The reserve percentage and hold period may be adjusted by SettleGrid at any time based on your account history, dispute rate, fraud risk indicators, and other commercially reasonable factors.

(c) **SettleGrid reserves the right to recover Chargeback amounts** from any pending payouts, your reserve balance, or by direct invoice if no balance is available.

(d) **SettleGrid reserves the right to terminate or suspend your account** if your Chargeback rate exceeds 0.5% of monthly transaction volume in any rolling 30-day window, or if Stripe imposes account-level interventions on your Connect Express account due to chargeback activity.

(e) You agree to cooperate in good faith with all Chargeback investigations, including providing transaction documentation, tool invocation logs, and Customer communications upon request, within 5 business days of request.

You acknowledge that the rolling-reserve mechanism is necessary because Stripe Connect Express makes the Platform (SettleGrid) liable to Stripe for connected-account negative balances if your reserve and ongoing payouts are insufficient to cover Chargebacks. This is a real exposure for SettleGrid; the reserve is the mitigation.

---

## 6. Tax Responsibility Allocation

You are solely responsible for all federal, state, and local taxes arising from your use of the Platform, including but not limited to:

(a) Income tax on amounts disbursed to you;

(b) Self-employment, payroll, or business taxes applicable to you;

(c) Any sales tax, value-added tax (VAT), goods-and-services tax (GST), or analogous transaction tax imposed by any jurisdiction on the goods or services you provide via your Tool, except where Stripe Tax (configured by SettleGrid) collects and remits such tax on your behalf as a registered seller in that jurisdiction; and

(d) Any tax or reporting obligation imposed on you specifically as a result of your tool's revenue volume or geographic footprint.

**You consent to SettleGrid issuing United States Internal Revenue Service Form 1099-K or Form 1099-NEC**, or analogous tax-reporting documentation in other jurisdictions, in connection with payments disbursed to you through the Platform, where required by law. You agree to provide and keep current any tax-identification information (W-9 for U.S. persons, W-8BEN or W-8BEN-E for non-U.S. persons) reasonably requested by SettleGrid or by Stripe to support tax reporting.

You acknowledge that Stripe collects W-9/W-8 information directly through its Connect Express onboarding flow, and that your providing accurate information to Stripe satisfies the corresponding obligation to SettleGrid.

---

## 7. Geographic Restrictions

The Platform is currently available to Developers subject to the following geographic restrictions, which SettleGrid may modify in its discretion as the Platform expands:

**Permitted (subject to all other Terms):**
- Developers organized under or ordinarily resident in countries supported by Stripe Connect Express for the entity type registered (individual or company), excluding the restrictions below.

**Not permitted:**

(a) **Sanctioned Jurisdictions** — as defined in Section 1. No exceptions.

(b) **Florida** — pending state-specific legal opinion regarding the applicability of Florida Statute § 560.103's money transmitter licensing exemption for agent-of-payee arrangements. Florida-resident individuals and Florida-organized entities are blocked at signup.

(c) **New Jersey** — pending state-specific legal opinion regarding the applicability of N.J.S.A. § 17:15C's money transmitter licensing exemption for agent-of-payee arrangements. New Jersey-resident individuals and New Jersey-organized entities are blocked at signup.

(d) **European Union member states** — Developers ordinarily resident in or organized under the laws of any European Union member state are blocked at signup pending SettleGrid's implementation of DAC7 (EU Council Directive 2021/514) reporting infrastructure. This restriction is expected to lift once DAC7 reporting is operationalized.

(e) **Stripe-unsupported corridors** — Developers in countries or with entity types that Stripe Connect Express does not support cannot complete payout onboarding. Such Developers may join the SettleGrid waitlist (see `docs/decisions/directory-claim-decoupling-status.md` for the current waitlist mechanism). The waitlist does not constitute acceptance under these Terms; acceptance occurs only when the Developer completes Stripe Connect Express onboarding.

You represent and warrant that you are eligible under the geographic restrictions above. SettleGrid may suspend or terminate your account if you become ineligible after onboarding.

---

## 8. Pass-Through Compliance Clauses

By using the Platform, you acknowledge and agree to be bound by:

(a) **The Stripe Services Agreement**, available at https://stripe.com/legal/ssa, as updated by Stripe from time to time.

(b) **The Stripe Connected Account Agreement**, available at https://stripe.com/legal/connect-account, as updated by Stripe from time to time. You acknowledge that you are entering into a direct legal relationship with Stripe Payments Company as a connected account, and that SettleGrid is not a party to that relationship.

(c) **Stripe's published acceptable use policy**, including the Stripe Restricted Businesses list at https://stripe.com/legal/restricted-businesses. Tools or services prohibited under Stripe's acceptable use policy are also prohibited under these Terms, regardless of whether SettleGrid's own acceptable use policy explicitly addresses them.

If a conflict arises between these Terms and any pass-through agreement above, the pass-through agreement governs the relationship between you and the relevant payment processor; these Terms govern the relationship between you and SettleGrid. SettleGrid will use commercially reasonable efforts to mitigate conflicts, but cannot indemnify you against the operation of the pass-through agreements.

If a future amendment to these Terms adds an additional Payment Processor (e.g., a non-Stripe rail), the corresponding pass-through clauses will be added to this Section 8 and you will be given notice and an opportunity to terminate before the amended Terms take effect.

---

## 9. Data Processing Consent and Privacy Notice Reference

You consent to SettleGrid's processing of personal information about you (and, where applicable, about your end Customers as forwarded to SettleGrid via the Platform) for the purposes of operating the Platform, processing payments via Stripe, complying with sanctions and tax obligations, and providing customer support. This processing is governed by SettleGrid's Privacy Notice, available at `docs/legal/privacy-notice-draft.md` (also pending lawyer review under P1.COMP2 and P2.COMP1), which is incorporated by reference into these Terms.

You acknowledge that:

(a) Stripe Payments Company is a sub-processor of personal information for the purposes of payment processing, and Stripe's privacy policy at https://stripe.com/privacy applies to Stripe's handling of that information.

(b) Customer-side personal information that you collect through your Tool and pass to SettleGrid (e.g., as part of an invocation payload) is processed by SettleGrid solely as a sub-processor on your behalf. You remain the data controller for that information.

(c) SettleGrid does not sell personal information and does not engage in cross-context behavioral advertising as defined in California Consumer Privacy Act regulations.

(d) If you are a data controller subject to the EU General Data Protection Regulation (GDPR) or analogous law, you are responsible for executing a Data Processing Addendum (DPA) with SettleGrid before processing any EU-resident personal information through the Platform. A DPA template will be available under P1.COMP2 / P2.COMP2.

---

## 10. Indemnification

**You will defend, indemnify, and hold harmless SettleGrid**, its officers, directors, employees, contractors, and agents from and against any third-party claims, liabilities, damages, losses, fines, penalties, and reasonable expenses (including attorneys' fees) arising out of or related to:

(a) Your breach of these Terms, including any representation or warranty made under Sections 4 (Sanctions) or 7 (Geographic Restrictions);

(b) The content, functionality, or operation of your Tool, including any claim that your Tool infringes a third party's intellectual property, violates applicable law, or causes harm to a Customer;

(c) Any tax liability arising from your activity under Section 6 that is incorrectly assessed against SettleGrid by a taxing authority;

(d) Any Chargeback amount or Stripe dispute fee not satisfied by your reserve or pending payouts under Section 5; and

(e) Any third-party claim that you misrepresented the nature, capability, or pricing of your Tool to Customers.

**SettleGrid will defend, indemnify, and hold harmless you** from and against any third-party claim that the Platform itself (separate from any Tool you publish on it) infringes the third party's U.S. patent, copyright, trademark, or trade secret, provided that you (i) promptly notify SettleGrid of the claim, (ii) give SettleGrid sole control of the defense, and (iii) cooperate reasonably with SettleGrid's defense.

**Cap on liability:** Each party's aggregate liability under this Section 10 and otherwise under these Terms (excluding liabilities under Sections 4 and 5, which are uncapped, and excluding obligations to pay amounts indisputably owed to the other) is capped at the greater of (i) $10,000 USD or (ii) the amount you paid SettleGrid in platform fees in the 12 months preceding the event giving rise to the claim. **In no event will either party be liable for indirect, incidental, consequential, special, or punitive damages**, even if advised of the possibility of such damages. This cap survives termination of these Terms.

---

## 11. Governing Law

These Terms are governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict-of-laws principles. The exclusive forum for any dispute arising under or relating to these Terms is the state and federal courts located in New Castle County, Delaware, and you and SettleGrid each consent to the personal jurisdiction of those courts and waive any objection based on inconvenient forum.

The United Nations Convention on Contracts for the International Sale of Goods does not apply to these Terms.

If you are a U.S. consumer (you reside in the United States and use the Platform primarily for personal, family, or household purposes), then any claim against SettleGrid arising under these Terms is also subject to the small-claims and consumer-protection laws of your state of residence to the extent not waivable by contract; nothing in this Section 11 limits your rights under those laws.

---

## Standard Contract Provisions

### Term and Termination

These Terms commence when you accept them and continue until terminated. Either party may terminate for convenience on 30 days' written notice; SettleGrid may terminate immediately for breach of Sections 4 (Sanctions), 5 (Chargeback Liability), or 7 (Geographic Restrictions). Termination does not affect amounts indisputably owed before termination, and Sections 5, 6, 10, and 11 survive termination.

### Modifications

SettleGrid may modify these Terms by posting the updated version at `docs/legal/terms-of-service.md` (post-finalization path) and providing notice via email to your registered SettleGrid account address. Changes take effect 30 days after notice unless they (i) are required to address a legal or compliance change with a shorter mandated effective date, or (ii) are favorable to Developers (e.g., relaxing a restriction), in which case they may take effect immediately. Continued use of the Platform after the effective date constitutes acceptance.

### Assignment

You may not assign these Terms without SettleGrid's prior written consent. SettleGrid may assign these Terms (in whole or in part) to a successor in interest without your consent in connection with a merger, acquisition, financing, or sale of substantially all assets, provided the successor agrees in writing to be bound.

### Severability

If any provision of these Terms is held unenforceable, the remaining provisions remain in full effect and the unenforceable provision is reformed to the minimum extent necessary to make it enforceable while preserving its intent.

### Entire Agreement

These Terms (together with the pass-through agreements referenced in Section 8 and the Privacy Notice referenced in Section 9) constitute the entire agreement between you and SettleGrid regarding your use of the Platform and supersede all prior or contemporaneous understandings, written or oral.

### Notices

Notices to SettleGrid: legal@settlegrid.ai (or such other address as SettleGrid may designate by amendment to these Terms).
Notices to you: the email address associated with your SettleGrid account, as kept current by you.

---

## Drafting Notes (engineering, not part of the Terms)

The following notes are for the lawyer reviewing this draft. They are NOT part of the executed Terms and should be removed (or moved to a separate review memo) before publication.

- **Pattern A+ vs Pattern C:** The compliance-posture document was originally written assuming Pattern C (Stripe + Polar.sh as MoR). Polar declined SettleGrid's merchant application 2026-04-14; this draft reflects the resulting Stripe-only architecture (Pattern A+). Section 8 is structured so additional Payment Processors can be added by amendment without rewriting the whole document. If a future rail (Paddle, Lemon Squeezy, Wise, etc.) is integrated, please advise on whether a single-document amendment or a rail-specific addendum is the better legal structure.

- **Agent-of-payee language source:** Section 2 derives from the CA DFPI 2017 Stripe letter. The four-condition federal exemption language at the end of Section 2 derives from 31 CFR § 1010.100(ff)(5)(ii)(B). Please confirm both citations are current as of the review date and that the wording matches the published authorities.

- **Stripe Connect Express chargeback exposure (Section 5):** Per Stripe's documentation, the platform is liable for Express-account negative balances. The 20% / 30-day rolling reserve is the mitigation. Please confirm 20% is within Stripe's permitted reserve range and that the right-to-modify language is enforceable in CA and NY.

- **Florida and New Jersey blocking (Section 7):** These states do not recognize the agent-of-payee exemption per the compliance-posture analysis. Please confirm or update the cited statutes (Florida § 560.103, NJSA § 17:15C). If newer authority allows operating in these states without state-level MTL, the geographic block can be removed.

- **EU + DAC7 blocking (Section 7):** Per the compliance posture, EU developers are blocked pending DAC7 reporting infrastructure. The block is expected to lift in Phase 6+ when reporting is operationalized.

- **Indemnification cap (Section 10):** The "$10,000 or 12-month fees" greater-of formula is borrowed from common B2B SaaS conventions. Please advise whether this is appropriate for SettleGrid's risk profile or whether a different cap (e.g., flat $50,000, or 6-month fees, or fees-only with no floor) is a better fit.

- **What is missing from this draft that lawyers typically add:** dispute resolution (arbitration vs. courts; class-action waiver), warranty disclaimers (more aggressive than what's in Section 10), force majeure, IP licensing language for the Platform itself, and the SDK-specific click-through license terms. These were intentionally omitted from the engineering-drafted version pending lawyer judgment about which are needed for SettleGrid's specific posture.
