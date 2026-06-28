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

## ── ADDENDUM (honest-claims-sweep ③ post-seal deep audit, 2026-06-28) — widen the inventory ──

The ③ deep audit surfaced more pre-existing claim-vs-runtime overclaims to fold into this chunk:

- **NEW SUB-CLASS DC-18b — implemented-but-UNREACHABLE: "multi-hop atomic settlement / everyone gets paid
  or no one does / rolls back as one unit / no partial payments"** is asserted live on ~12 surfaces, but the
  atomic disbursement/rollback engine is **unreachable**: `createSession` hardcodes `settlementMode:'immediate'`
  (`apps/web/src/lib/settlement/sessions.ts:136`), `/api/sessions` POST schema does NOT accept `settlementMode`
  (`route.ts:14-20`), the disbursement-map + batch live only in the dead `'deferred'|'atomic'` branch
  (`sessions.ts:580-660`), and `processSettlementBatch`/`rollbackSettlementBatch` have **zero runtime callers**.
  The reachable `immediate` path settles each hop independently → the all-or-nothing guarantee is FALSE.
  Sharpest: `apps/web/src/app/compare/nevermined/data.ts:320-322` cites the two zero-caller functions as the
  "unique moat … shipped code" on a page whose thesis is "Claims anchored to shipped code." Surfaces to
  reconcile: `README.md:69`, `use-cases/page.tsx:149,151`, `docs/page.tsx:669,681,1921-1927`, `llms.txt:45,65,81`,
  `llms-full.txt:403,409,427`, `changelog/page.tsx:162-164`, `learn/handbook/page.tsx:589-597`,
  `learn/glossary/page.tsx:80-83`, `faq/page.tsx:227`, `compare/nevermined/page.tsx:384-385`. **This is the
  same FINANCIAL-INTEGRITY split as concern 2 above** (a published all-or-nothing money guarantee that the
  reachable path does not provide) → route to the launch-gate/security owner. Owner ruling needed: wire the
  atomic path vs. demote the claim (settlement code is FROZEN; claims-authoring → single-writer build).
- **Surface inventory beyond `[slug]`:** the same AP2/Visa-TAP "pay" overclaims also live on
  `apps/web/src/app/docs/page.tsx:351,355,359` and `compare/nevermined/page.tsx:381-384` ("merchants accept
  whatever protocol the buyer arrives with" — MPP off-by-default, Circle Nano testnet). Widen the prose
  re-scan past `[slug]` to `docs/page.tsx` + `compare/nevermined`.
- **Sibling-field (DC-16d) MPP `[slug]:66` `howItWorks`** "SettleGrid verifies the SPT, captures the payment …
  returns the result" present-tense for a `Pending` rail — fold a parity qualifier (match the x402 B19
  `howItWorks` treatment).

## Defect-class note
DC-18 (claim-vs-adapter-runtime) + **DC-18b (claim-vs-REACHABILITY: real code, no public caller).** Recurring
root: an honesty sweep that reconciles claims↔config-status will miss claims↔runtime-implementation AND
claims↔reachability. A complete claims audit must, per cited capability, trace the adapter runtime AND a
reachable public entry point — not just its config gate / status badge / a unit test that calls it directly.
