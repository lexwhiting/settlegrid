# Backup MoR Activation SOP

**Status:** ⚠ **STUB — activation procedure not yet operational**
**Document owner:** SettleGrid (Alerterra, LLC)
**Created:** 2026-04-18
**Activated:** *(blank — this SOP is not live until a backup MoR is pre-arranged per Phase 3 RAIL work)*

---

## Why this file exists

`docs/legal/incident-response-playbook.md` Scenario A (Stripe de-platforms SettleGrid) references a "pre-arranged backup MoR, ready to activate within 48 hours." That contingency is a **design commitment**, not currently an operational capability — SettleGrid has not yet signed a merchant agreement with a backup MoR (Paddle, Lemon Squeezy, or other).

This file exists so a reader following the IR-playbook cross-reference lands on a correct page instead of a 404. When the backup MoR is arranged (target: Phase 3 or sooner if Stripe exposure forces it), this stub is replaced with the actual activation SOP.

---

## What the real SOP will contain (once written)

1. **Pre-arrangement prerequisites** — merchant agreement executed with backup MoR; data-processing addendum signed; price-point parity confirmed; AUP compatibility reviewed; integration credentials stored in 1Password
2. **Activation decision criteria** — what specifically triggers activation vs. continued negotiation with Stripe? (Scenario A triggers are in IR playbook §1; this SOP fills in the precise go/no-go threshold)
3. **Communications plan** — order of notifications: counsel → Stripe (proactive, "we're activating backup for operational continuity") → backup MoR → developers (with template announcement) → consumers (only if Stripe side is fully terminated)
4. **Customer migration mechanics** — subscription migration at renewal (not retroactive); payment-method re-authorization requirement; Stripe Customer → backup-MoR customer ID mapping; data-retention posture for the Stripe-side data that can't move
5. **Payout migration mechanics** — developer Connect account → backup-MoR payout account; tax-form implications (1099 from both rails for the same year is a real filing); pending payouts reconciliation
6. **Timeline commitments** — 48-hour activation target; 7-day full migration; 30-day Stripe wind-down + data export
7. **Rollback** — if Stripe re-platforms mid-migration, does SettleGrid return to Stripe-only? Backup-MoR contractual minimums may make this costly; the SOP documents the commitment level

---

## Current status

**Pre-arrangement:** not executed as of 2026-04-18. The Phase 3 plan identifies this as a pre-Phase-4-launch requirement (`private/master-plan/multi-rail-architecture.md` — Pattern A+ § on backup MoR).

**Counsel review:** the E-001 engagement (`docs/legal/lawyer-engagement-log.md`) covers the Stripe-only compliance posture. A separate engagement will be opened when backup-MoR negotiations progress — merchant agreements with Paddle or Lemon Squeezy warrant counsel review before signature.

**Testing:** once pre-arranged, the SOP is tabletop-tested quarterly. A live activation has NOT been performed; the 48-hour target is currently aspirational and will be validated in the first tabletop exercise.

---

## Change log

| Date | Change |
|---|---|
| 2026-04-18 | Stub created as part of P2.COMP1 hostile-review follow-up. Activation SOP scheduled for Phase 3 once a backup MoR is pre-arranged. |
