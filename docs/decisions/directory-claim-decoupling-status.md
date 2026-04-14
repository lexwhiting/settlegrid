# Directory-claim decoupling status

**Tracking ref:** P1.INTL1 (part 2 — the structural requirement)
**Status date:** 2026-04-14

---

## What P1.INTL1 asks for

The P1.INTL1 spec requires that any developer (in any country, regardless of Stripe Connect eligibility) can claim their SettleGrid directory listing without going through payment-rail onboarding first. Claimed listings should carry the verified badge + analytics + attribution. Monetization is a separate later upgrade.

Spec literal wording:
- Route: `/dashboard/listings/claim/[slug]`
- Table: `listings` with a new `claim_status` enum (`unclaimed | claimed | verified`)
- Flow requires email verification only — no Stripe handshake

## What already exists in the codebase

The decoupling the spec describes is **already implemented** via a different design the spec didn't anticipate:

| Spec expectation | Actual implementation |
|---|---|
| `listings` table | `tools` table (same concept, earlier naming) |
| `claim_status` enum (unclaimed/claimed/verified) | `tools.status` field: `'unclaimed'` → `'draft'` on claim → `'active'` when the developer sets pricing and publishes |
| `/dashboard/listings/claim/[slug]` | `/claim/[token]` (token-based, 48-hex opaque identifier) |
| Email verification only | Supabase session (email + password or OAuth); no Stripe handshake required to claim |
| Monetization as a separate step | Confirmed: the claim transition is `unclaimed` → `draft`. Going `active` (the monetization transition) is what requires a pricing config — and that's what touches Stripe. Claim itself is Stripe-independent. |

**Concrete verification:** `apps/web/src/app/api/tools/claim/route.ts` performs the ownership transfer in a single transaction that sets `ownerId` + `status='draft'` + clears `claimToken`. It does NOT call Stripe. Any developer with a valid claim token + a SettleGrid auth session can claim, regardless of country, regardless of Stripe Connect availability.

## Why the spec and the code disagree on shape

The P1.INTL1 spec was authored as part of the Round 1/Round 2 settlement-layer expansion research (see `private/master-plan/phase-1-foundation.md`). The spec author proposed a new slug-based claim flow without auditing the existing token-based flow. The existing flow already satisfies the spec's intent:

- **"Decouple claim from billing onboarding"** — already decoupled: claim flow does not call Stripe APIs.
- **"Any developer in any country"** — already true: the flow requires only a valid claim token + SettleGrid auth, both of which are country-agnostic.
- **"Verified badge + analytics + attribution"** — already provided by the `status='draft'` state after claim (the tool appears on the developer's dashboard; analytics accumulate against the `ownerId`; attribution is visible in the directory).

## Sandeep-specific path

For Sandeep to claim SpecLock today, he needs a fresh claim token on the SpecLock row in the `tools` table. Options:

1. **Trigger the standard cold-outreach claim-token flow** for the existing SpecLock listing (the cron in `apps/web/src/app/api/cron/claim-outreach/route.ts` generates these; run it manually against the SpecLock row)
2. **One-off SQL**: `UPDATE tools SET claim_token = <48-hex> WHERE slug = 'speclock' AND status = 'unclaimed'`
3. **Wait for the next cron pass** if SpecLock is queued for outreach anyway

The Sandeep reply at `data/cold-outreach/sandeep-reply.md` has a placeholder for the claim link and a checklist item reminding the founder to generate the token before dispatch.

## What was NOT built under P1.INTL1

Explicitly out of scope for this prompt (handled elsewhere or deferred):

- **Slug-based claim route** (`/dashboard/listings/claim/[slug]`): not built. The existing `/claim/[token]` flow serves the same purpose. Adding a parallel slug-based route would duplicate functionality without adding capability.
- **New `listings` table + migration**: not built. The existing `tools` table carries all the state the spec proposes.
- **Tool-page monetize CTA reflecting Stripe-supported vs waitlist country**: not built. Current `apps/web/src/app/tools/[slug]/page.tsx` filters to `status='active'` only — unclaimed tools do not render there, so the CTA question only applies AFTER claim. A post-claim monetize flow with country-routed UX is a P2.RAIL1 concern (developer onboarding + country eligibility check + waitlist).

These items are tracked as follow-ups in `private/master-plan/phase-2-distribution.md` under `P2.RAIL1` (now also responsible for the country-eligibility UX under Pattern A+) and the new `P2.TAX1`.

## Why the Sandeep reply is the entire user-facing deliverable

The Sandeep reply is the highest-leverage user-facing artifact from P1.INTL1 because:

1. It unblocks Sandeep specifically — the most consequential customer-development signal SettleGrid has received
2. It communicates the Pattern C → Pattern A+ pivot honestly to an external stakeholder
3. It demonstrates the decoupled-claim capability concretely (via the included claim link)
4. The decoupling itself is already code-complete; no new code is required to enable Sandeep

Gate check 27 (`data/cold-outreach/sandeep-reply.md` with a sent-timestamp marker) will PASS once the founder dispatches the reply and appends the sent-log line.
