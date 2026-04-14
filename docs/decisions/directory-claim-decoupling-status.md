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

The **claim-vs-billing** decoupling the spec describes is partly implemented, but a second decoupling the spec also implies (**claim-vs-visibility**) is NOT implemented and blocks the spec's stated value proposition.

### Decoupling #1: claim-vs-billing — ALREADY DONE

| Spec expectation | Actual implementation |
|---|---|
| `listings` table | `tools` table (same concept, earlier naming) |
| `claim_status` enum (unclaimed/claimed/verified) | `tools.status` field: `'unclaimed'` → `'draft'` on claim → `'active'` when the developer sets pricing and publishes. Separate boolean `tools.verified` defaults false and flips true only after the first real invocation (`apps/web/src/app/api/sdk/meter/route.ts:markToolVerified`). |
| `/dashboard/listings/claim/[slug]` | `/claim/[token]` (token-based, 48-hex opaque identifier) |
| Email verification only | Supabase session (email + password or OAuth); no Stripe handshake required to claim |
| Monetization as a separate step | Confirmed: the claim transition is `unclaimed` → `draft`. Going `active` (the monetization transition) is what requires a pricing config — and that's what touches Stripe. Claim itself is Stripe-independent. |

**Concrete verification:** `apps/web/src/app/api/tools/claim/route.ts` performs the ownership transfer in a single transaction that sets `developerId` + `status='draft'` + clears `claimToken`. It does NOT call Stripe. Any developer with a valid claim token + a SettleGrid auth session can claim, regardless of country, regardless of Stripe Connect availability.

### Decoupling #2: claim-vs-visibility — NOT DONE

This is the gap the P1.INTL1 hostile audit surfaced. The spec's value proposition ("any developer in any country can claim a listing today" and "discovery/visibility is retained") requires that a claimed-but-unpublished listing remains visible in the public marketplace. Currently it does not.

| Status | `/marketplace` visibility | `/tools/[slug]` visibility | Owner dashboard | Notes |
|--------|---------------------------|----------------------------|-----------------|-------|
| `unclaimed` | ✅ via `inArray(status, ['active', 'unclaimed'])` | ❌ filters `status='active'` only | N/A (no owner) | Shadow-directory behavior |
| `draft` (post-claim) | ❌ | ❌ | ✅ | **Removed from public directory on claim** |
| `active` (post-publish) | ✅ | ✅ | ✅ | Requires pricing config → Stripe touch |

**The bug:** claiming transitions `unclaimed` → `draft` which DROPS the tool from the public marketplace. To get back into the marketplace, the developer must set pricing and go `active` — which requires Stripe — which is exactly the blocker Sandeep (and the ~20-25% of global AI developers in Stripe-unsupported corridors) can't clear.

**Net effect:** for a developer in a Stripe-unsupported corridor, claiming today REDUCES public visibility of their listing. That's the opposite of what the spec intended and the opposite of what Sandeep said was valuable about the directory.

### Why the prior audit missed this

An earlier revision of this document concluded "decoupling is already code-complete" by only examining whether the claim route touches Stripe (it doesn't — true). It failed to trace the downstream effect of the `status='draft'` transition on the marketplace query (`apps/web/src/app/marketplace/marketplace-content.tsx:81` and related). The hostile audit caught it.

### The marketplace-visibility fix (proposed for follow-up prompt)

**Minimal code change:** expand the marketplace query to include `'draft'` status for tools that the owner has opted in to public listing. This requires either (a) an additional boolean column like `listedInMarketplace` with a sensible default, or (b) a separate status value like `'claimed-public'` distinct from `'draft'` (private polishing).

**Safer default:** option (a) with `listedInMarketplace` defaulting to `true` for newly-claimed tools (preserves visibility through the claim transition) and `false` for existing drafts (avoids exposing existing developers' in-progress work). Developers get a toggle in the dashboard.

**Recommended to land as a new spec card in Phase 2** — `P2.INTL2` or a new prompt between P2.RAIL1 and P2.TAX1. Adding it to P1.INTL1 would expand scope well beyond the original "decouple claim from billing" ask.

## Sandeep-specific path (revised)

Given the visibility gap, the honest offer to Sandeep is:

- **Option A**: Claim now, accept a temporary public-visibility gap, wait for the marketplace-visibility fix to ship (next prompt on the backlog). Gains: ownership lock, ability to edit listing, analytics account ready.
- **Option B**: Hold off on claiming; SpecLock stays in the marketplace as an unclaimed listing (current behavior). Gains: uninterrupted discovery/visibility. Trade-off: no ownership lock until he acts.

Option B is probably what Sandeep actually wants given his original email. The Sandeep reply at `data/cold-outreach/sandeep-reply.md` has been updated to present both options honestly rather than overstating the benefits of claiming today.

For either option, the operational prerequisite for Sandeep to claim (if/when he chooses to) is that a claim token exists on the SpecLock row. The founder can generate this via:

1. The standard cold-outreach claim-token flow (`apps/web/src/app/api/cron/claim-outreach/route.ts`) manually triggered for SpecLock
2. One-off SQL: `UPDATE tools SET claim_token = <48-hex> WHERE slug = 'speclock' AND status = 'unclaimed'`

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

Explicitly out of scope for this prompt (handled elsewhere, deferred, or rejected on security grounds):

- **Slug-based claim route** (`/dashboard/listings/claim/[slug]`) with email-verification-only: **rejected on security grounds.** Email verification proves the email address, not ownership of the underlying tool/repo. Anyone with a valid SettleGrid account could claim any listing's slug. The existing token-based flow sidesteps this because the token is emailed only to the address that the cold-outreach crawler extracted from the repo's public metadata — possession of the token is weak-but-meaningful proof of repo access. A secure self-serve slug claim would require either (a) GitHub OAuth + verification that the authenticated GitHub account has push access to the source repo, or (b) a token emailed to the repo's public contact at claim-request time. Both are substantially larger than the spec implied.
- **New `listings` table + migration**: not built. The existing `tools` table carries all the state the spec proposes.
- **Marketplace visibility for claimed-but-unpublished tools**: NOT built in P1.INTL1 (see "Decoupling #2" above). This is the critical gap surfaced by the P1.INTL1 hostile audit. Proposed as a new Phase 2 spec card.
- **Tool-page monetize CTA reflecting Stripe-supported vs waitlist country**: not built. Current `apps/web/src/app/tools/[slug]/page.tsx` filters to `status='active'` only, so the CTA question only applies AFTER publish (which requires monetization setup). A post-claim monetize flow with country-routed UX is a `P2.RAIL1` concern (developer onboarding + country eligibility check + waitlist).

These items are tracked as follow-ups in `private/master-plan/phase-2-distribution.md` under `P2.RAIL1` (now also responsible for the country-eligibility UX under Pattern A+) and `P2.TAX1`. The marketplace-visibility fix warrants its own card and is flagged accordingly.

## Why the Sandeep reply is the entire user-facing deliverable

The Sandeep reply is the highest-leverage user-facing artifact from P1.INTL1 because:

1. It unblocks Sandeep specifically — the most consequential customer-development signal SettleGrid has received
2. It communicates the Pattern C → Pattern A+ pivot honestly to an external stakeholder
3. It demonstrates the decoupled-claim capability concretely (via the included claim link)
4. The decoupling itself is already code-complete; no new code is required to enable Sandeep

Gate check 27 (`data/cold-outreach/sandeep-reply.md` with a sent-timestamp marker) will PASS once the founder dispatches the reply and appends the sent-log line.
