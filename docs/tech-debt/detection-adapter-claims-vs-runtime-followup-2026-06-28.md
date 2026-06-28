# FOLLOW-UP CHUNK — detection-adapter claims-vs-runtime (DC-18) — opened 2026-06-28

**Origin:** surfaced by the completeness/SEAM (core-invariant) lens during the honest-claims-sweep ②
round-6 seal review (F2–F6). PRE-EXISTING and OUT-OF-BUCKET for honest-claims-sweep (those entries were
never touched by that chunk; the settlement adapters are a frozen surface there). honest-claims-sweep was
sealed on its bucketed scope; this is its sibling follow-up. **Status: NOT yet planned (needs ① + a
founder loop).**

## The finding (NEW defect class DC-18 — claim vs adapter RUNTIME)
Public `/learn/protocols/[slug]` integration prose for several detection/auth adapters asserts present-tense
LIVE settlement/processing, but the adapter RUNTIME is a stub / always-fails / self-issues / sandbox-default.
This is distinct from DC-16 (claim vs config-gating STATUS): it is invisible to a status-badge reconciliation
and is detectable only by tracing the adapter implementation.

| Rail (status) | Public claim (`[slug]/page.tsx`) | Runtime (per lens-1 trace of `packages/mcp/src/adapters/*` — NEEDS proxy-path re-verification) |
|---|---|---|
| **Mastercard-VI** (Pending) | `:292` "validates it with Mastercard's infrastructure … and **processes the payment**"; `:309` "verified automatically" | `validateMastercardPayment` always returns `valid:false` (`MC_NOT_YET_SUPPORTED`); proxy maps to 503 `protocol_detected` stub — never validates, never processes, never credits |
| **AP2** (Ready) | `:152` "**validates them against Google's AP2 infrastructure** … records the charge … **settlement transparently**" | verifies a **self-issued HS256 JWT** (issuer must == `settlegrid.ai`), mints random `transactionId`; **no Google call**; "charge" is a **phantom credit to the developer's withdrawable balance**, NOT Stripe Connect |
| **UCP** (Ready) | `:217` "SettleGrid **handles the settlement flow**, meters the invocation, and records the transaction" | pure stub gated by `UCP_API_KEY`; on `valid:true` credits the withdrawable balance with **no money collected**; not routed through Stripe Connect |
| **Visa-TAP** (Ready) | `:182` "**authorizes a Visa charge**, and meters" | genuinely wired to Visa VTS (verify+authorize) BUT defaults to the **sandbox** host, gated by `VISA_TAP_API_KEY`, adapter file titled "(Stub)"; present-tense with no "when enabled" qualifier |
| **DRAIN** (Testnet) | `:560` "full EIP-712 structural validation … **Voucher signature recovery uses the EIP-712 typed data standard**" | `drain.ts` returns `recoveredAddress: voucher.payer` — **trusts the claimed payer; no signature recovery** (length/hex check only) |
| **F1 fold** (x402, defensible) | `[slug]:132` "x402 payments are verified automatically" | facilitator verify IS live; defensible-as-written, but in the `sg.init` dev-revenue context the proxy settlement path is dark (503). Optional consistency tightening to fold here. |

(Clean/defensible for contrast: ACP verifies a *paid* Stripe Checkout session — real money; KYAPay claims
verification-only; EMVCo well-scoped future-tense; MCP/REST genuinely live.)

## ⚠ Two distinct concerns — split them
1. **CLAIMS honesty (marketing):** the `[slug]` prose overclaims for these rails → demote/qualify (same
   spirit as honest-claims-sweep, but a different detection mechanism). **Needs founder confirm of TRUE
   adapter status** (the founder may know of partner integrations the runtime doesn't show, or confirm the
   rails are genuinely stub/not-live). Prose-only fixes; the settlement adapters stay frozen.
2. **FINANCIAL-INTEGRITY / launch-gate (potential P-item):** the AP2/UCP **phantom-credit-to-withdrawable-
   balance** path — crediting a developer's withdrawable balance with no money collected — is a money bug,
   NOT a marketing issue, IF confirmed against the proxy runtime. Route to the launch-gate / security track
   for assessment; could be a promotion-blocker. Do NOT treat as a claims-sweep item.

## Required first steps (before any build)
- **Runtime re-verification against the PROXY path:** lens-1 traced `packages/mcp/src/adapters/*` (the SDK
  copy). The path backing the public claim is the web proxy → `apps/web/src/lib/settlement/adapters/*`
  (FROZEN, thinner/different copy) via `apps/web/src/app/api/proxy/[slug]/route.ts`. Confirm each rail's
  actual proxy behavior (always-503? phantom credit? Stripe-Connect-backed?) before changing any prose.
- **Founder confirm** of true live/stub status per rail (AP2, UCP, Visa-TAP, Mastercard-VI, DRAIN).
- Then `/p1` a new chunk for the claims fixes; route the phantom-credit angle to the launch-gate owner.

## Defect-class note
DC-18 (claim-vs-adapter-runtime). Recurring root: an honesty sweep that reconciles claims↔config-status will
miss claims↔runtime-implementation. A complete claims audit must, per rail, trace the adapter runtime, not
just its config gate / status badge.
