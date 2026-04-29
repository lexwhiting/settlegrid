# Directory-claim decoupling status

**Tracking ref:** P1.INTL1 (part 2 — the structural requirement)
**Status date:** 2026-04-15

---

## Current status (2026-04-15) — closed

| Requirement | State | Reference |
|---|---|---|
| **Decoupling #1 — claim-vs-billing** | ✅ Shipped | `apps/web/src/app/api/tools/claim/route.ts` (claim route has zero Stripe calls) |
| **Decoupling #2 — claim-vs-visibility** | ✅ Shipped via P2.INTL2 | Commits `e0850c5` → `649be0a` → `472aa3d` → `f6bbe55` (schema + migration + query updates + dashboard toggle + hostile-review fixes + test close-out) |
| **Sandeep reply dispatched** | 🚫 Mothballed (2026-04-14) | Founder directive: "mothball the whole conversation around Sandeep for now". Draft preserved at `data/cold-outreach/sandeep-reply-MOTHBALLED.md` (renamed from `sandeep-reply.md`, gitignored either way). Gate check 27 correctly stays in DEFER state as a result. |
| **Listing page claim-status + country-routed monetize CTA** | ⏭️ Deferred to P2.RAIL1 | Properly scoped to Pattern A+ Stripe-eligibility pre-check / waitlist UX |

Net P1.INTL1 state: **every in-scope structural requirement is satisfied.** The only open item is the voluntarily-mothballed Sandeep reply; nothing code-level remains. Sections below preserve the full audit trail — the "NOT DONE" and "proposed for follow-up prompt" language in the decoupling-#2 subsections below was accurate when written on 2026-04-14 and is retained as a historical record of the audit that led to P2.INTL2 being carved out as its own spec card.

---

## What P1.INTL1 asks for

The P1.INTL1 spec requires that any developer (in any country, regardless of Stripe Connect eligibility) can claim their SettleGrid directory listing without going through payment-rail onboarding first. Claimed listings should carry the verified badge + analytics + attribution. Monetization is a separate later upgrade.

Spec literal wording:
- Route: `/dashboard/listings/claim/[slug]`
- Table: `listings` with a new `claim_status` enum (`unclaimed | claimed | verified`)
- Flow requires email verification only — no Stripe handshake

## What exists in the codebase

Both decouplings the spec describes — **claim-vs-billing** (explicit in the spec) and **claim-vs-visibility** (implied by the spec's value proposition) — are now implemented.

- **Decoupling #1 (claim-vs-billing)**: already done pre-audit; confirmed by direct code inspection. See subsection below.
- **Decoupling #2 (claim-vs-visibility)**: identified as a gap by the P1.INTL1 hostile audit on 2026-04-14, then shipped the same day as a carved-out sibling spec card `P2.INTL2`. See subsection below for the before-and-after.

The "What already exists" wording below was written mid-audit; both subsections preserve their drafting-era analysis for the audit trail, with "SHIPPED via P2.INTL2" markers added where the state has changed.

### Decoupling #1: claim-vs-billing — ALREADY DONE

| Spec expectation | Actual implementation |
|---|---|
| `listings` table | `tools` table (same concept, earlier naming) |
| `claim_status` enum (unclaimed/claimed/verified) | `tools.status` field: `'unclaimed'` → `'draft'` on claim → `'active'` when the developer sets pricing and publishes. Separate boolean `tools.verified` defaults false and flips true only after the first real invocation (`apps/web/src/app/api/sdk/meter/route.ts:markToolVerified`). |
| `/dashboard/listings/claim/[slug]` | `/claim/[token]` (token-based, 48-hex opaque identifier) |
| Email verification only | Supabase session (email + password or OAuth); no Stripe handshake required to claim |
| Monetization as a separate step | Confirmed: the claim transition is `unclaimed` → `draft`. Going `active` (the monetization transition) is what requires a pricing config — and that's what touches Stripe. Claim itself is Stripe-independent. |

**Concrete verification:** `apps/web/src/app/api/tools/claim/route.ts` performs the ownership transfer in a single transaction that sets `developerId` + `status='draft'` + clears `claimToken`. It does NOT call Stripe. Any developer with a valid claim token + a SettleGrid auth session can claim, regardless of country, regardless of Stripe Connect availability.

### Decoupling #2: claim-vs-visibility — originally NOT DONE, now SHIPPED via P2.INTL2

> **Update (2026-04-15):** the gap described below was surfaced by the P1.INTL1 hostile audit on 2026-04-14 and shipped as its own carved-out spec card `P2.INTL2` the same day. The text in this subsection preserves the original finding verbatim for the audit trail; the fix is described in the "Shipped fix" block immediately after the pre-fix table.

This was the gap the P1.INTL1 hostile audit surfaced. The spec's value proposition ("any developer in any country can claim a listing today" and "discovery/visibility is retained") requires that a claimed-but-unpublished listing remain visible in the public marketplace. At the time of the original audit it did not.

**Before P2.INTL2 (historical, 2026-04-14):**

| Status | `/marketplace` visibility | `/tools/[slug]` visibility | Owner dashboard | Notes |
|--------|---------------------------|----------------------------|-----------------|-------|
| `unclaimed` | ✅ via `inArray(status, ['active', 'unclaimed'])` | ❌ filters `status='active'` only | N/A (no owner) | Shadow-directory behavior |
| `draft` (post-claim) | ❌ | ❌ | ✅ | **Removed from public directory on claim** |
| `active` (post-publish) | ✅ | ✅ | ✅ | Requires pricing config → Stripe touch |

**The bug (pre-fix):** claiming transitioned `unclaimed` → `draft` which DROPPED the tool from the public marketplace. To get back into the marketplace, the developer had to set pricing and go `active` — which required Stripe — which was exactly the blocker Sandeep (and the ~20-25% of global AI developers in Stripe-unsupported corridors) couldn't clear.

**Net effect (pre-fix):** for a developer in a Stripe-unsupported corridor, claiming today REDUCED public visibility of their listing. That was the opposite of what the spec intended and the opposite of what Sandeep said was valuable about the directory.

**After P2.INTL2 (current state, 2026-04-15):**

| Status + `listedInMarketplace` | `/marketplace` visibility | `/tools/[slug]` visibility | Owner dashboard | Notes |
|--------|---------------------------|----------------------------|-----------------|-------|
| `unclaimed` (any flag) | ✅ unconditional | ❌ filters `status='active'` only | N/A (no owner) | Unchanged |
| `draft` + `listedInMarketplace=true` | ✅ via `or(inArray(['active','unclaimed']), and(eq('draft'), eq(true)))` | ❌ | ✅ | **New post-claim default** — visibility preserved through the `unclaimed→draft` transition |
| `draft` + `listedInMarketplace=false` | ❌ | ❌ | ✅ | Developer opted out via dashboard toggle, OR pre-P2.INTL2 draft that the backfill set to `false` to avoid retroactively exposing in-progress work |
| `active` (any flag) | ✅ unconditional | ✅ | ✅ | Unchanged |

**Shipped fix (P2.INTL2):** a `tools.listed_in_marketplace` boolean column (non-null, default `true`) was added via migration `0001_listed_in_marketplace.sql`. The marketplace inclusion predicate is now `or(inArray(status, ['active','unclaimed']), and(eq(status, 'draft'), eq(listedInMarketplace, true)))` — expressed as a reusable `marketplaceInclusionPredicate()` helper across 4 query surfaces (marketplace content, trending page ×2, discovery API). The claim route (`apps/web/src/app/api/tools/claim/route.ts`) sets `listedInMarketplace=true` on the unclaimed→draft transition so visibility is preserved by construction. A dashboard toggle PATCH endpoint (`/api/tools/[id]/listed-in-marketplace`) lets developers opt their draft tools in/out of marketplace visibility. Marketplace cards now surface an amber "Claimed" badge for `status='draft'` tools via `shouldShowClaimedBadge()`. 25 regression tests in `apps/web/src/lib/__tests__/marketplace-visibility.test.ts` lock the behavior.

### Why the prior audit missed this

An earlier revision of this document concluded "decoupling is already code-complete" by only examining whether the claim route touches Stripe (it doesn't — true). It failed to trace the downstream effect of the `status='draft'` transition on the marketplace query (`apps/web/src/app/marketplace/marketplace-content.tsx:81` and related). The hostile audit caught it.

### The marketplace-visibility fix — shipped as P2.INTL2 (2026-04-14)

**Original proposal (kept for historical context):**

- Minimal code change: expand the marketplace query to include `'draft'` status for tools that the owner has opted in to public listing. This requires either (a) an additional boolean column like `listedInMarketplace` with a sensible default, or (b) a separate status value like `'claimed-public'` distinct from `'draft'` (private polishing).
- Safer default: option (a) with `listedInMarketplace` defaulting to `true` for newly-claimed tools (preserves visibility through the claim transition) and `false` for existing drafts (avoids exposing existing developers' in-progress work). Developers get a toggle in the dashboard.
- Recommended to land as a new spec card in Phase 2 — `P2.INTL2` or a new prompt between P2.RAIL1 and P2.TAX1. Adding it to P1.INTL1 would expand scope well beyond the original "decouple claim from billing" ask.

**What actually shipped:** option (a), per the "Safer default" recommendation above. Delivered as `P2.INTL2` in the same build session (2026-04-14), with its own 4-phase audit chain:

| Phase | Commit | What it landed |
|---|---|---|
| Initial | `e0850c5` | Schema column + migration + claim-route fix + 3 marketplace query surfaces + dashboard toggle endpoint + "Claimed" badge component |
| Spec-diff | `649be0a` | Test coverage gaps closed per spec DoD #6 |
| Hostile review | `472aa3d` | `/api/v1/discover` consistency fix (public API was using the old `inArray` predicate) + UPDATE WHERE TOCTOU guard on the PATCH endpoint |
| Test close-out | `f6bbe55` | Schema + migration + zero-error baseline tests |

See `apps/web/drizzle/0001_listed_in_marketplace.sql` for the migration (adds the column default-true; backfills existing `draft` rows to `false` so pre-addendum drafts aren't retroactively exposed) and `apps/web/src/lib/marketplace-visibility.ts` for the pure-function inclusion rule + Zod patch schema. The backfill UPDATE is intentionally narrow (only `status='draft'`); `unclaimed` and `active` rows inherit the default `true`, which is both correct and consistent with the pre-addendum marketplace behavior for those statuses.

## Sandeep-specific path (mothballed 2026-04-14)

> **Mothball note (2026-04-14 → 2026-04-15):** the founder directed that "the whole conversation around Sandeep" be mothballed while the expansion phase is fine-tuned. The draft reply was renamed from `data/cold-outreach/sandeep-reply.md` to `data/cold-outreach/sandeep-reply-MOTHBALLED.md`. Gate check 27 correctly stays in DEFER state as a result — the gate script looks for the original filename. When the mothball is lifted, rename back to `sandeep-reply.md` and append a sent-timestamp line; gate check 27 will flip to PASS.
>
> The two-option framing below was the honest stance at the moment of the mothball. Since then, P2.INTL2 shipped (see above) — so Option A is no longer caveated by a visibility gap. When/if the reply is unmothballed, this section should be revisited to reflect the post-P2.INTL2 state (Option A is now unconditionally "claim today, retain marketplace visibility immediately").

Given the (then-open) visibility gap at the time of the mothball, the honest offer to Sandeep was:

- **Option A** (as of 2026-04-14): Claim now, accept a temporary public-visibility gap, wait for the marketplace-visibility fix to ship. Gains: ownership lock, ability to edit listing, analytics account ready.
- **Option B** (as of 2026-04-14): Hold off on claiming; SpecLock stays in the marketplace as an unclaimed listing (pre-P2.INTL2 behavior). Gains: uninterrupted discovery/visibility. Trade-off: no ownership lock until he acts.

Option B was probably what Sandeep actually wanted given his original email. The Sandeep reply presented both options honestly rather than overstating the benefits of claiming today.

For either option, the operational prerequisite for Sandeep to claim (if/when he chooses to) is that a claim token exists on the SpecLock row. The founder can generate this via:

1. The standard cold-outreach claim-token flow (`apps/web/src/app/api/cron/claim-outreach/route.ts`) manually triggered for SpecLock
2. One-off SQL: `UPDATE tools SET claim_token = <48-hex> WHERE slug = 'speclock' AND status = 'unclaimed'`

**Post-P2.INTL2 (2026-04-15) update to the options:** since the marketplace-visibility fix has shipped, the caveat on Option A ("accept a temporary public-visibility gap") no longer applies. A future unmothballed reply should present a single cleaner path: claim today, keep marketplace visibility by default, flip the `listedInMarketplace` toggle in the dashboard if the developer wants to privatize their draft. The two-option framing above is retained as the drafting-era snapshot of what was almost sent.

## Why the spec and the code disagree on shape

The P1.INTL1 spec was authored as part of the Round 1/Round 2 settlement-layer expansion research (see `private/master-plan/phase-1-foundation.md`). The spec author proposed a new slug-based claim flow without auditing the existing token-based flow. The existing flow already satisfies the spec's intent:

- **"Decouple claim from billing onboarding"** — already decoupled: claim flow does not call Stripe APIs.
- **"Any developer in any country"** — already true: the flow requires only a valid claim token + SettleGrid auth, both of which are country-agnostic.
- **"Verified badge + analytics + attribution"** — claim transitions the row to `status='draft'` and sets `developerId` to the claimant (the tool appears on the developer's dashboard; analytics accumulate against the `developerId`; attribution is visible in the directory). The "verified" part is deliberately distinct: `tools.verified` is a separate boolean that the meter flips to `true` after the first real invocation — "verified" means "proven live," not "claimed." The claim transition carries a distinct amber "Claimed" badge in the marketplace via `shouldShowClaimedBadge()` (P2.INTL2). Marketplace visibility through the claim transition was originally NOT preserved — the main gap the audit caught — and shipped as P2.INTL2.

## What was NOT built under P1.INTL1

Explicitly out of scope for this prompt (handled elsewhere, deferred, or rejected on security grounds):

- **Slug-based claim route** (`/dashboard/listings/claim/[slug]`) with email-verification-only: **rejected on security grounds.** Email verification proves the email address, not ownership of the underlying tool/repo. Anyone with a valid SettleGrid account could claim any listing's slug. The existing token-based flow sidesteps this because the token is emailed only to the address that the cold-outreach crawler extracted from the repo's public metadata — possession of the token is weak-but-meaningful proof of repo access. A secure self-serve slug claim would require either (a) GitHub OAuth + verification that the authenticated GitHub account has push access to the source repo, or (b) a token emailed to the repo's public contact at claim-request time. Both are substantially larger than the spec implied.
- **New `listings` table + migration**: not built. The existing `tools` table carries all the state the spec proposes.
- **Marketplace visibility for claimed-but-unpublished tools**: originally deferred out of P1.INTL1 scope as a new Phase 2 card after the hostile audit surfaced the gap; **shipped on 2026-04-14 as P2.INTL2** (commits `e0850c5` → `f6bbe55`) — see "Decoupling #2" section above for the full before/after + implementation notes. This item is no longer "not built"; it's closed under a sibling spec card and referenced here so this decoupling doc stays a single source of truth.
- **Tool-page monetize CTA reflecting Stripe-supported vs waitlist country**: not built. Current `apps/web/src/app/tools/[slug]/page.tsx` filters to `status='active'` only, so the CTA question only applies AFTER publish (which requires monetization setup). A post-claim monetize flow with country-routed UX is a `P2.RAIL1` concern (developer onboarding + country eligibility check + waitlist). Scope confirmed as P2.RAIL1 under Pattern A+ (Stripe-only with extensible `RailAdapter` — Polar was abandoned 2026-04-14 after the Polar AUP rejection; see `docs/legal/polar-onboarding-status.md`).

These items are tracked as follow-ups in `private/master-plan/phase-2-distribution.md` under `P2.RAIL1` (now also responsible for the country-eligibility UX under Pattern A+) and `P2.TAX1`.

## Why the Sandeep reply was originally the entire user-facing deliverable (superseded by mothball)

> **Status (2026-04-15):** the framing below is preserved as the drafting-era rationale for prioritizing the Sandeep reply. It was superseded on 2026-04-14 when the founder mothballed the Sandeep conversation (see "Sandeep-specific path" section above). The reply is no longer the "entire user-facing deliverable" because it isn't being dispatched; the user-facing deliverable of P1.INTL1 is now the shipped Decoupling #2 marketplace-visibility behavior (via P2.INTL2), which any claimant — Sandeep or otherwise — benefits from automatically.

The Sandeep reply was originally framed as the highest-leverage user-facing artifact from P1.INTL1 because:

1. It would have unblocked Sandeep specifically — the most consequential customer-development signal SettleGrid had received
2. It would have communicated the Pattern C → Pattern A+ pivot honestly to an external stakeholder
3. It would have demonstrated the decoupled-claim capability concretely (via the included claim link)
4. The decoupling itself was already code-complete; no new code was required to enable Sandeep

Gate check 27 (`data/cold-outreach/sandeep-reply.md` with a sent-timestamp marker) **stays in DEFER** as long as the mothball is in effect. When the mothball is lifted, the filename rename (`sandeep-reply-MOTHBALLED.md` → `sandeep-reply.md`) + the sent-timestamp line append will flip check 27 to PASS.

---

## Spec-diff: literal P1.INTL1 requirements vs what shipped

This section is the comprehensive deviation list, kept in one place so future Claude sessions don't repeat the audit work.

### Reply requirements

> **Dispatch status (2026-04-15):** the reply checkmarks below indicate that each requirement was satisfied in the *drafted* reply text. The reply itself was mothballed by founder directive on 2026-04-14 and was never dispatched. So "✅" here means "present in the draft," not "delivered to Sandeep."

| Spec requirement | Present in draft? | Notes |
|---|---|---|
| Confirm SpecLock is his to claim today | ✅ | Covered in "Two things I can offer" section of the draft |
| Explain Stripe Connect is invite-only in India for individuals | ✅ | Stated as "Stripe Connect India individual-account block"; semantically equivalent |
| Commit to Polar.sh integration in Phase 3 with him as first customer | **Justified deviation** | Polar declined the merchant application 2026-04-14. Replaced with honest Pattern C→A+ explanation. Cannot commit to a non-existent rail. |
| Offer manual Wise stopgap for Q1 if SpecLock earns >$100 | ✅ (added in spec-diff phase) | Originally missed; added per spec literal. Wise stopgap is spec-aligned: ≤few payouts/quarter, ≤$2k/year, W-8BEN required, founder personal Wise Business account. Matches the policy in the proposed `P2.INTL1` SOP. |
| Sign off without an ask | ✅ | "No asks from you" closing line |

### Decoupling requirements

| Spec requirement | Shipped? | Notes |
|---|---|---|
| Claim flow requires only email verification (no Stripe handshake) | ✅ **Shipped (justified deviation)** | Existing token-based `/claim/[token]` flow doesn't require Stripe (✓). Uses Supabase auth (email or OAuth), not just email verification — more secure than spec proposed. Pure email-verification-only was rejected on security grounds (anyone could claim any slug). |
| Claimed listings get verified badge + analytics + attribution | ✅ **Shipped across P1.INTL1 + P2.INTL2** | `tools.verified` is meter-driven, not claim-driven (intentional semantic — the "verified" badge means "proven live," which requires a real invocation). Marketplace visibility on claim was the real gap and shipped as P2.INTL2 (commits `e0850c5` → `f6bbe55`) including an amber "Claimed" badge (`shouldShowClaimedBadge()`) distinct from "Verified." Owner dashboard shows the claimed tool with edit + analytics access immediately. |
| Monetization is a separate later upgrade | ✅ **Shipped** | Existing architecture: claim transitions to `status='draft'`; going `active` is a separate step that requires pricing config (which touches Stripe). |
| Listing page shows claim status + monetize CTA (country-routed) | ⏭️ **Deferred to P2.RAIL1** | `/tools/[slug]` filters `status='active'` only — CTA is only relevant post-monetize-setup. Country-routed onboarding UX is properly scoped to P2.RAIL1 under Pattern A+ (Stripe Connect eligibility pre-check + waitlist UI for unsupported corridors). |

### File-level deviations

| Spec said to touch | Status | Reason |
|---|---|---|
| `apps/web/src/app/dashboard/listings/claim/[slug]/page.tsx` (new) | Not created | Slug-based flow rejected on security grounds. Existing `/claim/[token]` covers the function. |
| `apps/web/src/app/api/listings/claim/route.ts` (new) | Not created | Existing `/api/tools/claim` covers the function. |
| `apps/web/src/app/(marketing)/mcp/[owner]/[repo]/page.tsx` | Path doesn't exist in repo | Spec was written against an assumed marketing-route structure that wasn't built. Real marketing tool-page is `apps/web/src/app/tools/[slug]/page.tsx` and renders only `status='active'` tools. |
| `apps/web/src/lib/db/schema.ts` (add `claim_status`) | Not modified | `tools.status` enum already covers the same lifecycle states (`unclaimed`/`draft`/`active`); no `listings` table exists — `tools` is the equivalent. |
| `apps/web/drizzle/<timestamp>_add_listing_claims.sql` (migration) | Not generated | No schema change needed. |
| `docs/decisions/sandeep-reply-sent.md` (record of what was sent) | **Path deviation** — landed at `data/cold-outreach/sandeep-reply.md` | Same path-mismatch pattern as P1.SDK5 (sdk vs mcp) and P1.RAIL1 (launches vs legal). Gate check 27 looks at `data/cold-outreach/sandeep-reply.md`; spec card was outdated. Used the gate path. |

### Implementation steps that were skipped

| Step | Status | Reason |
|---|---|---|
| 4. Add `claim_status` enum field to listings table | Skipped | No schema change needed (see above) |
| 5. Generate and run Drizzle migration | Skipped | No schema change needed |
| 6. Implement claim flow page + API route | Skipped | Existing `/claim/[token]` + `/api/tools/claim` cover this |
| 7. Add claim status display + monetize button to listing page | Deferred to P2.RAIL1 | Listing page only renders active tools; CTA work belongs with country-routed onboarding UX |
| 8. Test claim flow end-to-end with test listing | Skipped | Existing claim flow has its own test coverage (`apps/web/src/app/api/__tests__/claim-emails-kill-switch.test.ts` + standard route tests). No new code, no new tests. |

### Net spec-diff result

5 spec-literal deviations identified; 4 documented as justified (Polar pivot, security-driven slug rejection, schema sufficiency, path mismatch with gate); 1 was a real omission (Wise stopgap offer) and was added in the spec-diff phase. Marketplace-visibility regression for claimed tools — the most substantive code gap — was not in the original spec but was surfaced by the hostile audit and scoped as a new P2.INTL2 card.

### Open decision point — RESOLVED 2026-04-14: ship P2.INTL2 as a carved-out sibling card

**Resolution:** the founder selected "ship P2.INTL2 now" (the shipping path) rather than holding to Sandeep-reply-first. P2.INTL2 landed the same day with its own 4-phase audit chain (see "Shipped fix" block in the Decoupling #2 section above). The Sandeep reply was then mothballed before dispatch — a separate, independent founder decision made after the visibility fix had already shipped. Net effect: the "case for shipping" arguments below materialized into actual code; the "case for deferred" arguments below were set aside in favor of landing the fix.

**The case for keeping it deferred to P2.INTL2 (historical):**

- Estimated 4-6 hours of work (migration with backfill + marketplace query update + dashboard toggle + claimed-tool badge in marketplace card)
- Touches the public marketplace query path — broad blast radius
- Backfill needs hostile review (existing developers' draft tools should not be retroactively exposed to the public marketplace)
- Belongs to its own audit chain rather than bundled into P1.INTL1's

**The case for shipping it as a P1.INTL1 extension (historical — this argument won):**

- The P1.INTL1 spec headline ask is "any developer in any country can claim a listing today." Without the visibility fix, claiming today *reduced* visibility — the spec's promise wasn't actually delivered.
- Sandeep's original quote ("discovery/visibility alone is valuable") implies he expected visibility to persist post-claim. The then-current "two options" framing in the reply was honest but soft.
- Shipping the visibility fix first meant the Sandeep reply could offer Option 1 (claim today, retain visibility) without the caveat, which would be a substantively better customer experience.

**Actual outcome:** the visibility fix shipped via P2.INTL2 on the same day as the audit (2026-04-14); the Sandeep reply was then independently mothballed by the founder before dispatch. The two decisions are orthogonal — the visibility fix stands whether or not any reply is ever sent to Sandeep, and benefits every claimant going forward.
