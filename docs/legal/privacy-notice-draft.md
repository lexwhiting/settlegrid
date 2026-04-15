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

- **Identity data:** name, email address, business name (if registering as an entity)
- **Authentication data:** password hash (Supabase-managed), OAuth tokens (for GitHub, Google, etc. if the Developer signs in via OAuth)
- **Profile data:** slug (public display name), bio, avatar URL, website URL (if provided)
- **Contact data:** email address, optional phone number (if provided for account recovery)
- **Tool metadata:** tool names, slugs, descriptions, pricing configurations, categories, source repository URLs (if the Developer associates a tool with a GitHub repo)
- **Usage data:** invocation counts, revenue totals, login timestamps, IP address at login, user agent at login
- **Tax identifiers:** last four digits of the tax ID the Developer provides to Stripe (not the full ID — full number is held by Stripe, not SettleGrid)
- **Payout reference:** the ID of the Developer's Stripe Connected Account (not the bank account number — bank account details are held by Stripe, not SettleGrid)

### 3.2 What SettleGrid does NOT collect from Developers

- Full tax ID / Social Security Number / EIN in plaintext (held by Stripe)
- Bank account numbers, routing numbers, or other payout instruments (held by Stripe)
- Government-issued identity documents (passport, driver's license, national ID) — uploaded directly to Stripe Identity, never to SettleGrid
- Selfie / biometric data used for KYC verification — held by Stripe Identity, never received by SettleGrid
- Credit card or debit card numbers for any purpose (SettleGrid has no direct card-on-file functionality; cards are always tokenized by Stripe)

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

(e) **Cross-border transfer:** SettleGrid's servers are primarily located in the United States and European Union (Supabase regions). Transfers from India to these regions are permitted under the DPDP Act as of the draft date; this will be re-confirmed before any India-resident Developer onboards.

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
- **Right to limit use of sensitive personal information** — SettleGrid does not collect sensitive personal information as defined in CCPA (SSN, driver's license number, precise geolocation, racial/ethnic origin, etc.) beyond the tax ID last-four retained for reconciliation. SettleGrid uses that solely for the reconciliation purpose disclosed in Section 4.
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

- **Missing items that a lawyer may add:** a detailed description of automated decision-making (if any), a specific deletion workflow SLA, a list of the exact fields stored per user (SettleGrid's data dictionary), and a formal DPA template for B2B Developer-to-SettleGrid processor relationships. These were intentionally omitted from the engineering-drafted version pending lawyer judgment.
