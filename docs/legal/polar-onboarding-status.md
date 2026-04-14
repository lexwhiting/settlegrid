# Polar Merchant Onboarding — Evaluation Decision Log

**Tracking ref:** P1.RAIL1
**Current Status:** ABANDONED — strategic pivot to Stripe-only settlement architecture
**Decision date:** 2026-04-14

---

## TL;DR

Polar was evaluated as a merchant-of-record rail for SettleGrid's SaaS billing layer. Polar's automated AUP reviewer rejected the application on the grounds that SettleGrid's overall business model includes payment facilitation between third-party sellers and buyers (the tool-revenue routing layer), which violates Polar's acceptable use policy.

A narrow-scope appeal was considered — use Polar only for SettleGrid's own SaaS subscription billing (Builder/Scale tiers + platform fees), with Stripe Connect separately handling the marketplace/payout layer. That appeal was abandoned after strategic review: Stripe Connect (the bottleneck for developer payouts) and Polar MoR have ~90%+ country overlap, so Polar would only add tax/compliance sugar for customers already reachable via Stripe — at the cost of a second payment integration.

**Decision:** Consolidate on Stripe (Stripe Billing + Stripe Tax for SaaS subscriptions, Stripe Connect for marketplace/payouts). No Polar integration planned.

---

## Timeline — Submission Status Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-14 | Submitted | Polar merchant application created; KYC via Stripe Identity; Go-Live requested |
| 2026-04-14 | Rejected (AI) | AUP decline: "facilitates payments and payouts for third-party sellers (marketplace/payment facilitation use case)" |
| 2026-04-14 | Evaluated narrow-scope appeal | Considered Polar-for-SaaS-only + Stripe-Connect-for-marketplace dual-processor setup |
| 2026-04-14 | Decision: Abandon | Stripe Connect country coverage is the binding constraint; Polar adds no unique reach. No appeal filed. |

---

## Decision Rationale

### The two money flows in SettleGrid

1. **Flow #1 — SaaS fees:** Developer → SettleGrid. Subscription (Builder $19/mo, Scale $79/mo) + usage-based platform fees.
2. **Flow #2 — Tool revenue:** AI-agent consumer → [SettleGrid routes] → tool developer, with SettleGrid taking a cut.

Polar correctly identified that flow #2 violates their AUP. Flow #1 would have been acceptable under a narrow-scope appeal.

### Why the narrow-scope appeal was abandoned

**Key insight:** Stripe Connect is the bottleneck for developer payouts (flow #2), and Stripe Connect's supported-countries list largely overlaps with Polar's.

- Developers in countries where **Polar works but Stripe Connect does NOT** cannot receive tool-revenue payouts via SettleGrid.
- Those developers therefore cannot use SettleGrid's core product.
- So enabling Polar to bill them for a SaaS subscription creates a broken experience: they can pay for the platform but cannot earn through it.

This reduces Polar's unique value from "reach more countries" to "better VAT/tax compliance handling." Stripe Tax covers that adequately for our use case — not as turnkey, but close enough that the operational simplicity of one processor wins.

### Trade-offs accepted by going Stripe-only

**Losses:**
- Turnkey VAT / sales-tax MoR → replaced by Stripe Tax (more configuration work, comparable outcome)
- Chargeback absorption on subscription charges → now SettleGrid's risk (typical <1% of subscription volume)
- Second-processor hedge against Stripe de-platforming → moot; Polar would reject for the same business-model reason

**Gains:**
- Unblocks Phase 1 immediately — no 2–3 week wait for Polar human review
- Single integration across all money movement — one SDK, one webhook pattern, one dashboard, one reconciliation path
- No AUP mismatch — Stripe Connect is explicitly designed for marketplace/platform models
- Phase 3 settlement-rail work can proceed against infrastructure already present in `apps/web/.env.example`

---

## Forward Architecture

### Stripe-only settlement architecture

| Layer | Provider | Purpose |
|-------|----------|---------|
| SaaS subscription billing | Stripe Billing | Collect $19/$79 monthly from developers |
| Sales tax / VAT on subscriptions | Stripe Tax | Auto-calculate + remit across jurisdictions |
| Developer payouts (marketplace flow) | Stripe Connect (Express accounts) | Route tool revenue to developers |
| Usage-based platform fees | Stripe Billing (metered pricing) | Charge on top of subscription based on invocation volume |
| Non-fiat rails (x402, MPP) | Protocol-layer adapters | Phase 3 — independent of Polar/Stripe |

### Phase 3 implications — action items for P3.RAIL rescoping

The existing `P3.RAIL1`, `P3.RAIL2`, `P3.RAIL3` spec cards were drafted assuming Polar would handle the fiat marketplace settlement layer. They need to be rescoped before Phase 3 kickoff:

- **P3.RAIL1** (previously "Polar payout integration"): → **"Stripe Connect Express onboarding + payout schedule for developers"**
- **P3.RAIL2** / **P3.RAIL3**: adjust to reference Stripe Connect as the primary fiat settlement rail; other rails (x402 stablecoins, MPP) remain as originally planned

The Polar merchant account remains in rejected state on Polar's side. No ongoing maintenance required.

---

## Code / Config Clean-up

Removed from `apps/web/.env.example`:
- `POLAR_API_KEY`
- `POLAR_ORG_ID`
- `POLAR_WEBHOOK_SECRET`

No Polar imports or integration code was written — no production-code change required.

---

## Reference Links (archived for reevaluation)

- Polar merchant signup: https://polar.sh/dashboard
- Polar MoR docs: https://polar.sh/docs/merchant-of-record/introduction
- Polar account reviews: https://polar.sh/docs/merchant-of-record/account-reviews
- Polar supported countries: https://polar.sh/docs/merchant-of-record/supported-countries
- Multi-rail architecture: `docs/multi-rail-architecture.md` (needs update to reflect Stripe-only settlement)

---

## When to revisit

Reopen the Polar evaluation if any of these change:

- SettleGrid expands into a region Stripe Connect doesn't support but Polar does (check: https://polar.sh/docs/merchant-of-record/supported-countries vs https://stripe.com/global)
- Stripe changes policy in a way that threatens the marketplace use case
- Polar adds explicit support for platform/marketplace models
- Stripe Tax proves inadequate for the international compliance load (expect to learn this in Phase 2 once real customers land)
