# SettleGrid Privacy Notice

> ⚠️ **DRAFT — pending lawyer review in P2.COMP1.** This document is an engineering-drafted starting point. It has NOT been reviewed by counsel and MUST be reviewed by a qualified privacy/data-protection attorney before being published to users. Specific clauses (GDPR lawful basis, DPDP notice language, data subject rights processes) are derived from `private/master-plan/compliance-posture.md` and from Stripe's published DPA / privacy documents. Engineering judgment was used; legal advice was not given.

**Document version:** Draft 1
**Drafted:** 2026-04-14
**Tracking ref:** P1.COMP2
**Effective date:** Not yet effective. No user has been notified under this draft.
**Applies to:** All users of the SettleGrid platform (Developers and Customers). Developer-specific terms are in the Developer Terms of Service (`docs/legal/terms-of-service-draft.md`).
**Architecture context:** This draft assumes Pattern A+ (Stripe-only with extensible RailAdapter). The earlier Pattern C plan referenced Polar.sh as a co-subprocessor; Polar was abandoned 2026-04-14 (see `docs/legal/polar-onboarding-status.md`). Subprocessor list reflects Stripe-only state; additional subprocessors may be added by amendment with notice.

---

## 1. Who we are

SettleGrid, Inc. ("SettleGrid," "we," "us," "our") is a Delaware corporation operating a payment infrastructure platform that helps software developers monetize Model Context Protocol (MCP) tool servers and HTTP APIs.

**Contact for privacy matters:** privacy@settlegrid.ai (or such address as SettleGrid may designate by amendment to this notice).

---

## 2. Scope of this notice

This Privacy Notice describes how SettleGrid collects, uses, stores, and shares personal information when you interact with the SettleGrid platform as either:

- **A Developer** — a person or entity who registers on SettleGrid to monetize a tool or API.
- **A Customer** — a person or entity who pays for an invocation of a Developer's tool through SettleGrid.
- **A Website Visitor** — a person who visits settlegrid.ai without necessarily registering an account.

This notice does NOT cover:
- Personal information that Developers collect from their own end users via their Tools. For that, each Developer is the data controller and their own privacy policy governs.
- Personal information handled by Stripe Payments Company as part of the payment processing flow — Stripe's privacy practices are governed by [Stripe's Privacy Policy](https://stripe.com/privacy).

---

## 3. Data we collect

SettleGrid's collection is deliberately narrow. The design principle is that SettleGrid never receives raw know-your-customer (KYC) documents, government IDs, or payment instruments — those flow directly from the user to Stripe's infrastructure without transiting SettleGrid's systems.

### 3.1 From Developers (account registration + platform use)

The list below describes the categories of personal information that SettleGrid itself stores in its own database. It was derived by auditing SettleGrid's `developers` table and the related tables that reference it (tools, invocations, payouts, webhook endpoints, referrals, and audit logs); it does NOT include personal information that Stripe collects independently during Connect onboarding or that Supabase stores in its own authentication tables (see the explicit exclusions in Section 3.2).

- **Identity data:** email address (required), optional display name, and a URL-safe slug used as the Developer's public identifier (e.g., `settlegrid.ai/d/<slug>`).
- **Authentication data:** a password hash (for password-based login, stored by SettleGrid's auth layer; never the plaintext password) and a reference to the Supabase auth user record if the Developer has signed up via Supabase Auth. If the Developer uses SSO, the OAuth linkage is handled by Supabase Auth and the Developer's identity-provider metadata is stored by Supabase, not by SettleGrid.
- **API-key material:** a one-way hash of any programmatic API key the Developer has generated, used solely to authenticate that key on incoming requests. The plaintext key is shown once at creation and is not retrievable from SettleGrid afterward.
- **Public profile data (only if the Developer has opted into a public profile):** an optional short bio and an optional avatar image URL, displayed at the Developer's slug URL. These are off by default.
- **Subscription billing references (only if the Developer is on a paid plan):** a Stripe Customer ID and a Stripe Subscription ID for the Developer's Builder or Scale plan, used to pull the monthly charge via Stripe. SettleGrid does not store card numbers or bank details — those are held by Stripe.
- **Payout configuration:** the Developer's Stripe Connected Account ID (a reference only — not the underlying bank account number, tax ID, or any KYC document), the payout schedule (e.g., monthly), a minimum payout threshold, and the Developer's current earned balance in cents.
- **Tool metadata:** tool names, slugs, descriptions, pricing configurations, categories, tags, version strings, and a source repository URL (if the Developer links a GitHub or other code-hosting repository to a tool).
- **Notification preferences:** which event types the Developer has opted in to receive, and any webhook URLs the Developer has registered for notification forwarding (for example, a Slack or Discord incoming-webhook URL the Developer has chosen to add).
- **Data-retention preferences:** the log-retention windows the Developer has selected for invocation logs, webhook delivery logs, and audit logs.
- **Usage and billing records (via related tables):** per-invocation records of the Developer's tools, including the tool invoked, an opaque consumer reference, method/cost/latency/status, an optional developer-supplied metadata field (up to 1 KB), and timestamps; payout history records; webhook endpoint configurations and webhook delivery history (with signing secrets redacted on export).
- **Referral program records:** an invite code issued to the Developer, a reference to the Developer who referred them (if any), and a cumulative bonus-operations balance earned from successful referrals.
- **Founding-member cohort flag:** a boolean recording whether the Developer is part of the first-100 founding-member cohort and, if so, the timestamp of that designation.
- **Administrative audit records:** a log of administrative actions the Developer has taken (such as creating or revoking an API key, triggering a payout, changing settings, or requesting a data export) together with the IP address and user agent captured at the time of each recorded administrative action. These are recorded when the Developer performs an auditable action, not as a general login log.
- **Account timestamps:** account creation time and last-modification time.

### 3.2 What SettleGrid does NOT collect from Developers

- Tax identifiers of any kind — SSN, EIN, ITIN, VAT number, or foreign equivalents — whether in full or in a truncated form such as "last four digits." All tax identifiers are collected directly by Stripe during Connect onboarding.
- Bank account numbers, routing numbers, IBAN, SWIFT/BIC codes, or any other payout instrument details. All payout banking data is collected directly by Stripe.
- Government-issued identity documents (passport, driver's license, national ID). These are uploaded directly to Stripe Identity via a Stripe-hosted flow; they never transit SettleGrid's infrastructure.
- Selfie or other biometric data used for KYC verification. Any biometric data used for identity verification is collected and held by Stripe Identity, not SettleGrid.
- Credit card or debit card numbers for any purpose. SettleGrid has no direct card-on-file functionality; cards are always tokenized by Stripe.
- A Developer's phone number. SettleGrid does not have a phone-number field on the Developer account; any phone numbers the Developer provides to Stripe during Connect onboarding are held by Stripe.
- A Developer's business name, legal entity name, or website URL. SettleGrid does not have schema fields for these; any such details required for KYC are collected by Stripe.
- The content of tool invocation payloads (request bodies or responses) beyond the optional developer-supplied `metadata` field the Developer chooses to attach to their own invocation records. SettleGrid does not archive full request or response bodies for invoiced invocations.

### 3.3 From Customers (using paid tools)

- **Transaction metadata:** which tool was invoked, when, at what price, and whether the invocation succeeded
- **Consumer identity reference:** an opaque consumer ID linked to a Stripe customer (no raw PII stored against the consumer ID beyond what's needed for billing reconciliation)
- **Payment method reference:** a Stripe payment method token (never the underlying card number or bank details)
- **Optional account fields if the Customer creates a SettleGrid account:** email, optional display name

### 3.4 From Website Visitors (pre-registration browsing)

- **Request logs:** IP address, user agent, requested path, referrer, timestamp — retained for 30 days for security and debugging, then aggregated or deleted
- **Cookies:** see Section 8 below

---

## 4. How we use your data

Personal information collected above is used for the following purposes and no others:

(a) **Operating the Platform** — authenticating you, provisioning your tools, running invocations, computing fees, displaying your dashboard.

(b) **Processing payments** — forwarding the minimum information needed to Stripe to create charges, capture payouts, and reconcile ledger entries.

(c) **Compliance** — verifying that your activity does not violate our Acceptable Use Policy or applicable sanctions, tax, or anti-money-laundering rules (Sanctions screening is handled by Stripe; see Section 5.1).

(d) **Customer support** — responding to tickets, debugging issues, investigating abuse reports.

(e) **Service improvements** — aggregated, de-identified analytics on how the platform is used. SettleGrid does not combine aggregated analytics with personal identifiers to profile individual users.

(f) **Legal obligations** — responding to lawful requests, preserving records required by tax law (typically 7 years for US tax records), complying with subpoena or court order.

**We do not:**
- Sell your personal information to third parties for their own marketing
- Engage in cross-context behavioral advertising as defined in California Consumer Privacy Act regulations
- Use your tool invocation payloads to train AI models
- Share your data with Stripe or any other subprocessor for purposes other than those described in Section 5

---

## 5. Subprocessors and data sharing

### 5.1 Stripe Payments Company

**Role:** Sole payment processor + sole KYC/sanctions-screening provider. Sub-processor of personal information for the purposes of charging Customers, disbursing payouts to Developers, issuing tax forms (1099-K, 1099-NEC), and continuous OFAC / SDN List screening of connected accounts.

**What we share with Stripe:** tool metadata (slug, name, pricing), transaction amounts, Customer identifiers (for tokenized payment method lookup), Developer Connect Account references.

**What Stripe independently collects from you:** full tax ID, bank account details, government-issued identity documents, selfie biometrics, income/revenue data — all collected directly via Stripe Connect Express onboarding and Stripe Identity, NOT through SettleGrid.

**Stripe's legal terms:** [Stripe Services Agreement](https://stripe.com/legal/ssa), [Stripe Connected Account Agreement](https://stripe.com/legal/connect-account), [Stripe Privacy Policy](https://stripe.com/privacy), [Stripe DPA](https://stripe.com/legal/dpa).

**DPA status:** The Stripe Data Processing Addendum is in effect for SettleGrid's account via automatic incorporation into the Stripe Services Agreement SettleGrid accepted at account creation. Stripe no longer exposes a separate click-to-execute DPA flow for this account type — the Dashboard's compliance settings show only PCI as a compliance framework, which we have confirmed. All standard DPA protections (EU SCCs Module 2, UK International Data Transfer Addendum, subprocessor authorization, security measures schedule, data subject rights assistance, SOC 2 / ISO 27001 audit rights) are in force from the date of SSA acceptance. A countersigned PDF copy is optional and available from Stripe compliance on request. Full status and version history: `docs/legal/stripe-dpa-status.md`.

### 5.2 Supabase (authentication + database)

**Role:** Authentication provider (email + password, OAuth) and PostgreSQL database host for SettleGrid's application data.

**What we store in Supabase:** all SettleGrid-managed tables including developers, consumers, tools, invocations, audit logs, and the marketplace directory data. Customer PII minimized per Section 3.

**Supabase's legal terms:** [Supabase Privacy Policy](https://supabase.com/privacy), [Supabase DPA](https://supabase.com/legal/dpa).

### 5.3 Upstash (Redis for rate limiting)

**Role:** In-memory data store for rate limiting, session state, and short-lived caches.

**What we store in Upstash:** rate-limit counters keyed by IP or API key (the keys are hashed identifiers, not raw PII).

**Upstash's legal terms:** [Upstash Privacy Policy](https://upstash.com/privacy), [Upstash DPA](https://upstash.com/legal/dpa).

### 5.4 Resend (transactional email)

**Role:** Delivery of transactional email (account verification, password reset, receipts, outreach replies).

**What we share with Resend:** the recipient email address, subject line, and message body for each email sent.

**Resend's legal terms:** [Resend Privacy Policy](https://resend.com/legal/privacy-policy), [Resend DPA](https://resend.com/legal/dpa).

### 5.5 Sentry (error monitoring)

**Role:** Error and performance monitoring for SettleGrid's frontend and backend.

**What we send to Sentry:** error stack traces, request metadata (URL path, user agent), and in limited cases the authenticated user's ID so errors can be correlated with sessions.

**Sentry's legal terms:** [Sentry Privacy Policy](https://sentry.io/privacy/), [Sentry DPA](https://sentry.io/legal/dpa/).

### 5.6 PostHog (product analytics)

**Role:** Product analytics for understanding how Developers and Customers use the Platform.

**What we send to PostHog:** aggregated event data (page views, button clicks, conversion events). Events are tied to an opaque user ID; raw PII is not transmitted.

**PostHog's legal terms:** [PostHog Privacy Policy](https://posthog.com/privacy), [PostHog DPA](https://posthog.com/dpa).

### 5.7 Vercel (hosting platform + analytics)

**Role:** Hosts the SettleGrid web application (settlegrid.ai) and its API routes. Vercel operates the edge network, serverless functions, and build pipeline that serve the Platform. Also provides Vercel Analytics, a server-side web analytics product that captures aggregate page-view and performance metrics.

**What Vercel processes on SettleGrid's behalf:**
- HTTP request/response traffic for all Platform pages and API routes (inherent in hosting)
- Server-side analytics events (page paths, response codes, latencies) — aggregated, no raw PII
- Build artifacts and source-code hashes during deployments

**What Vercel does NOT process:** your application's database contents (that is Supabase; see 5.2) or payment information (that is Stripe; see 5.1).

**Vercel's legal terms:** [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy), [Vercel DPA](https://vercel.com/legal/dpa).

### 5.8 Future subprocessors

SettleGrid may add subprocessors over time (e.g., additional payment rails such as Paddle or Lemon Squeezy, alternative email providers, alternative analytics). Any addition will be announced via an update to this notice at least 30 days before the new subprocessor receives personal information, except where a shorter timeline is required by law. Developers subject to EU GDPR or equivalent regulations who have executed a Data Processing Addendum with SettleGrid may object to a new subprocessor and terminate their relationship with SettleGrid if the objection cannot be resolved.

---

## 6. Lawful basis for processing (GDPR + UK GDPR)

**Current status: EU developer onboarding is blocked at the MVP phase pending SettleGrid's DAC7 reporting infrastructure.** This means SettleGrid is NOT currently processing personal information of EU-resident Developers under a GDPR lawful basis, because no such Developer can register. When DAC7 infrastructure is operational (Phase 6+) and EU Developer onboarding opens, the following GDPR lawful bases will apply:

(a) **Contract performance** (Article 6(1)(b) GDPR) — the core processing needed to operate the Platform for a Developer who has accepted the Developer Terms of Service is necessary for performance of that contract.

(b) **Legal obligation** (Article 6(1)(c) GDPR) — tax reporting, anti-money-laundering, and sanctions-screening obligations.

(c) **Legitimate interest** (Article 6(1)(f) GDPR) — fraud detection, security monitoring, service improvements. SettleGrid conducts a balancing test for each legitimate-interest use and will document the balancing test before any EU Developer is onboarded.

(d) **Consent** (Article 6(1)(a) GDPR) — for cookies and analytics that are not strictly necessary, and for any optional marketing emails (currently none).

For Developers who are NOT EU residents, GDPR does not apply, but SettleGrid voluntarily applies similar principles of purpose limitation, data minimization, and security.

### 6.1 International data transfers (when applicable)

When EU Developer onboarding opens, any transfer of personal data from the European Economic Area or the United Kingdom to SettleGrid's U.S.-hosted systems will rely on the European Commission's Standard Contractual Clauses (SCCs) and the UK International Data Transfer Addendum, as incorporated into subprocessor DPAs.

---

## 7. Notice to India-resident Developers (DPDP Act 2023)

India's Digital Personal Data Protection Act, 2023 ("DPDP Act") governs the processing of personal data of Indian data principals by data fiduciaries. SettleGrid's status as a data fiduciary and the applicability of the DPDP Act depend on whether Indian Developers are onboarded and the nature of the processing.

**Current status for India-resident individuals:** Stripe Connect Express does not support individual accounts for India-resident Developers (Stripe India is invite-only and businesses-only since May 2024). Individual Indian Developers therefore cannot currently complete payout onboarding on SettleGrid. Entity-incorporated Indian Developers may onboard if Stripe Connect Express supports their entity type.

**For Indian Developers who can onboard (entities currently, individuals when a supported corridor ships):**

(a) **Purpose of processing:** SettleGrid processes your personal data to operate the Platform and to facilitate payment processing via Stripe Payments Company (see Section 5.1).

(b) **Consent:** By registering a SettleGrid account and accepting the Developer Terms of Service, you consent to SettleGrid's processing of your personal data as described in this Notice. You may withdraw consent at any time by closing your account, subject to the retention rules in Section 10.

(c) **Notice of processing:** This Privacy Notice constitutes the itemized notice required under the DPDP Act. It describes the personal data processed (Section 3), the purposes (Section 4), the subprocessors (Section 5), and the data subject rights (Section 9).

(d) **Data Protection Officer (DPO):** SettleGrid has not yet appointed a DPO. When the DPDP Act's significant-data-fiduciary rules become operative (or sooner if triggered by volume), a DPO will be appointed and this notice updated.

(e) **Cross-border transfer:** SettleGrid's web application is hosted on Vercel and its primary database is hosted on Supabase (see Section 5). The specific geographic region in which each subprocessor stores Developer data is determined by the subprocessor's configuration for SettleGrid's account; the current region for each subprocessor will be identified in an amendment to this Notice before any India-resident Developer is onboarded. Any transfer of personal data from India to SettleGrid's subprocessor regions will rely on the lawful-transfer mechanisms available under the DPDP Act as of the transfer date; SettleGrid will re-confirm the permissibility of the transfer (including any country-specific restrictions the Data Protection Board of India may have imposed by notification) before onboarding begins.

**Grievance redressal:** privacy@settlegrid.ai. Indian data principals may also escalate unresolved grievances to the Data Protection Board of India.

---

## 8. Cookies and analytics disclosures

SettleGrid uses cookies and similar technologies on settlegrid.ai. We classify them as follows:

(a) **Strictly necessary** — session authentication, CSRF protection, load balancer affinity. These cannot be disabled.

(b) **Functional** — remembering your dashboard preferences (dark mode, column order, tool sort). Disabling these makes the platform harder to use but does not break core functionality.

(c) **Analytics** — PostHog event tracking. See Section 5.6. These are subject to your explicit consent via the cookie banner shown on first visit.

(d) **Advertising** — SettleGrid does NOT use advertising cookies or retargeting pixels. No third-party advertising network has access to your browsing data.

You can manage your cookie preferences at any time via the "Cookie settings" link in the footer of settlegrid.ai.

---

## 9. Data subject rights

You have the following rights regarding your personal information. The exact legal basis depends on your jurisdiction:

(a) **Right of access** — request a copy of the personal information SettleGrid holds about you.

(b) **Right of correction / rectification** — correct inaccurate personal information.

(c) **Right of deletion / erasure** — request deletion of your personal information, subject to the retention exceptions in Section 10 (we must retain certain records for tax and anti-money-laundering purposes).

(d) **Right of portability** — receive your personal information in a structured, commonly used, machine-readable format.

(e) **Right to object** — object to processing based on legitimate interest (Section 6(c)).

(f) **Right to withdraw consent** — where processing is based on consent (Section 6(d) and analytics cookies), withdraw consent at any time.

(g) **Right to lodge a complaint** — with a supervisory authority in your jurisdiction:
   - EU: your national Data Protection Authority (when EU onboarding opens)
   - UK: the Information Commissioner's Office (ICO) (when UK onboarding opens)
   - California: the California Privacy Protection Agency (CPPA)
   - India: the Data Protection Board of India (see Section 7)

**How to exercise these rights:** email privacy@settlegrid.ai with your request. Include enough information for us to verify your identity (the email address on your SettleGrid account is usually sufficient). SettleGrid will respond within 30 days, or 45 days in complex cases with an intermediate notice.

SettleGrid will not retaliate against you for exercising any of these rights. You do not need to provide a reason for your request.

---

## 10. Data retention

SettleGrid retains personal information for the following periods:

| Category | Retention | Rationale |
|---|---|---|
| Account identity data (name, email) | Life of account + 90 days after deletion | Allow account recovery within a grace period |
| Tool metadata | Life of account + 7 years after deletion | Tax and accounting records |
| Transaction history (invocations, payouts, fees) | 7 years minimum | IRS recordkeeping requirements |
| Audit logs (security events, admin actions) | 2 years | Security investigation window |
| Cookie/analytics data | 13 months (standard PostHog default) | Analytics usefulness window |
| Support tickets | 3 years after resolution | Customer support reference |
| Sanctions / OFAC screening records | 5 years after last screen | OFAC recordkeeping requirements |
| Request logs (IP, user agent, path) | 30 days | Security and debugging |

When a retention period expires, personal information is either irreversibly deleted or anonymized such that it can no longer be associated with an identifiable natural person.

---

## 11. Security

SettleGrid implements technical and organizational measures intended to protect personal information, including:

- Encryption in transit (TLS 1.2+) and at rest (AES-256 for database columns containing sensitive fields)
- Role-based access control for internal systems
- Audit logging of administrative actions
- Regular dependency updates and security patches
- Incident response procedures (see `docs/legal/incident-response-playbook-draft.md` when available — pending P2.COMP1)

No system is perfectly secure. If you believe your SettleGrid account has been compromised, email security@settlegrid.ai immediately.

---

## 12. Children

The Platform is not directed to children under 16 years of age (or the equivalent age of majority in your jurisdiction), and SettleGrid does not knowingly collect personal information from children. If we learn that we have collected personal information from a child, we will delete it.

---

## 13. Changes to this notice

SettleGrid may update this Privacy Notice from time to time. Material changes will be communicated via email to registered account holders at least 30 days before taking effect, except where a shorter timeline is required by law. The "Document version" and "Drafted"/"Effective" dates at the top of this notice will be updated on each revision.

---

## 14. Jurisdiction-specific disclosures

### 14.1 California residents (CCPA / CPRA)

California residents have additional rights under the California Consumer Privacy Act as amended by the California Privacy Rights Act:

- **Right to know** — see Section 3 for categories collected and Section 4 for purposes.
- **Right to delete** — see Section 9(c).
- **Right to correct** — see Section 9(b).
- **Right to opt-out of sale or sharing** — SettleGrid does not sell personal information and does not engage in cross-context behavioral advertising. No action required.
- **Right to limit use of sensitive personal information** — SettleGrid does not collect sensitive personal information as defined in CCPA (Social Security Number, driver's license or state identification number, account log-in with access credentials, precise geolocation, racial or ethnic origin, religious beliefs, genetic data, biometric data, health data, contents of mail/email/text messages, or information concerning sex life or sexual orientation). Tax identifiers, government-issued IDs, and KYC biometric data are collected directly by Stripe during Connect onboarding and are not received by SettleGrid (see Sections 3.2 and 5.1). SettleGrid therefore has nothing to limit under this subsection.
- **Shine the Light (Cal. Civ. Code § 1798.83)** — SettleGrid does not share personal information with third parties for their direct marketing.

Exercise any CCPA right via privacy@settlegrid.ai.

### 14.2 Virginia, Colorado, Connecticut, Utah, and other US state privacy laws

SettleGrid extends the rights described in Section 9 to residents of these states regardless of whether the specific state law applies, as a matter of policy. Residents of states with stricter local requirements may have additional rights under their state law.

---

## Drafting Notes (engineering, not part of the published Notice)

The following notes are for the lawyer reviewing this draft. They are NOT part of the executed Privacy Notice and should be removed (or moved to a separate review memo) before publication.

- **Subprocessor list (Section 5):** the current list was compiled by inspecting `apps/web/package.json` (installed SDKs) and `apps/web/next.config.ts` + `apps/web/src/` (actual usage) rather than by reading `apps/web/.env.example` alone — the latter only contains a minimal subset (Stripe, Resend, Postgres, Upstash Redis, JWT). Services currently listed: Stripe, Supabase, Upstash, Resend, Sentry (confirmed via `withSentryConfig` wrapper in `next.config.ts`), PostHog (confirmed via `posthog.capture()` calls across multiple pages), and Vercel (confirmed via `@vercel/analytics/next` import in `layout.tsx`). If production has additional subprocessors wired up via `.env.local` / Vercel environment variables that aren't represented in `.env.example` (e.g., an email-deliverability backend behind Resend, a log-aggregation service, or an error-telemetry layer), please add them. The Polar entry from the earlier draft was removed after Polar declined SettleGrid's merchant application on 2026-04-14.

- **GDPR lawful basis (Section 6):** the draft says EU onboarding is blocked at MVP and the GDPR bases only apply when EU onboarding opens. Please confirm this matches the risk posture in `private/master-plan/compliance-posture.md`. If EU onboarding is opened earlier than Phase 6+, the lawful-basis analysis and the balancing tests for legitimate-interest processing should be fully in place before the first EU Developer registers.

- **DPDP Act (Section 7):** the draft gives Indian data principals the notice they're entitled to under the act. Please confirm (a) that SettleGrid does not yet meet the "significant data fiduciary" threshold that would require a DPO, (b) that the grievance-redressal contact is adequate, and (c) that the cross-border transfer language is current as of the review date (India's Data Protection Board has the power to restrict transfers to specific countries by notification).

- **Retention periods (Section 10):** the 7-year retention for transaction history is based on IRS requirements for business records. The 5-year retention for OFAC screening records comes from the OFAC recordkeeping rule at 31 CFR § 501.601. Please confirm both citations are current and that the other retention periods (90 days for account identity post-deletion, 2 years for audit logs, etc.) are defensible under applicable state privacy laws.

- **California "do not sell" signal (Section 14.1):** SettleGrid does not sell personal information, so no action is required. If future advertising/marketing cookies are added, this section must be updated and a Global Privacy Control (GPC) handler implemented.

- **DPA status language (Section 5.1):** an earlier version of this draft said SettleGrid "has executed (or will execute)" the Stripe DPA. That was based on an incorrect assumption that Stripe exposed a click-to-execute flow in the Dashboard. Verification on 2026-04-14 confirmed that SettleGrid's Stripe account uses the auto-incorporated-via-SSA model (Dashboard compliance settings show only PCI as a framework). The language has been updated to accurately describe the in-force state. Please confirm that (a) this characterization is legally correct, (b) the claim about SCC modules and the UK IDTA being in force matches Stripe's current published DPA, and (c) the phrase "available from Stripe compliance on request" is appropriate for a published privacy notice or whether it should be removed (it's informational for internal readers but might look odd to an external reader).

- **Data-collection list (Sections 3.1, 3.2, and 14.1) — audit-driven correction on 2026-04-14:** the first draft of Section 3.1 listed several fields that turned out to be fictional when the list was cross-checked against SettleGrid's actual Postgres schema in `apps/web/src/lib/db/schema.ts` — specifically "business name," "optional phone number," "website URL," and "last four digits of the tax ID the Developer provides to Stripe." None of these correspond to columns on SettleGrid's `developers` table, and a code audit confirmed SettleGrid has never persisted them. The first draft also mis-characterized the IP address and user agent fields: they are captured against administrative audit-log events (e.g., key revocation, payout trigger, settings change) via SettleGrid's `audit_logs` table, not against login events — the login IP/UA is held by Supabase Auth in its own tables and is not in SettleGrid's schema. Section 3.1 was rewritten from the actual schema fields — `developers` columns plus the related `tools`, `invocations`, `payouts`, `webhook_endpoints`, `referrals`, `audit_logs`, and `compliance_exports` tables that store Developer-related records — so that the published notice is truthful about what SettleGrid itself holds. Section 3.2 was expanded to explicitly state that SettleGrid never receives tax IDs in any form (not even truncated) and to list the other fields Stripe holds exclusively. Section 14.1's CCPA sensitive-PII carveout was rewritten to remove the fictional "tax ID last-four retained for reconciliation" exception, since SettleGrid has nothing to limit under that subsection. Please (a) confirm that the rewritten Section 3.1 covers the CCPA-required category list at a sufficient level of detail, and (b) confirm the new Section 3.2 exclusions are phrased acceptably for a public notice (e.g., whether "in any form (not even truncated)" is helpful clarity or unnecessary detail).

- **DPDP cross-border transfer language (Section 7(e)) — audit-driven correction on 2026-04-14:** the first draft asserted that "SettleGrid's servers are primarily located in the United States and European Union (Supabase regions)," which was speculative — no configuration file or Supabase dashboard setting was checked before making that claim, and SettleGrid has not independently verified its subprocessors' storage regions. The language has been rewritten to say that the region is determined by each subprocessor's configuration and that the specific current regions will be identified in an amendment before any India-resident Developer is onboarded. Please confirm whether (a) this deferred-disclosure approach is acceptable under the DPDP Act (specifically, whether a data fiduciary must disclose storage regions in a notice before the fiduciary has any Indian data principals), or (b) the specific Supabase / Vercel regions must be identified up front in the notice as soon as any DPDP-covered data is plausibly in scope.

- **Missing items that a lawyer may add:** a detailed description of automated decision-making (if any), a specific deletion workflow SLA, a list of the exact fields stored per user (SettleGrid's data dictionary), and a formal DPA template for B2B Developer-to-SettleGrid processor relationships. These were intentionally omitted from the engineering-drafted version pending lawyer judgment.
