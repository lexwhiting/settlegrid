# Tech-Debt Register — Circle Nano Kernel Dispatch (P5 Tier-1, audit 2026-05-29)

> Produced by the mandatory 3-part audit chain (incl. an independent
> fresh-context hostile security review) over the Circle Nanopayments
> kernel-dispatch wiring. Read before touching
> `packages/mcp/src/adapters/circle-nano.ts`, `packages/mcp/src/kernel.ts`,
> `apps/web/src/lib/settlement/circle-nano/*`, `apps/web/src/lib/circle-nano-proxy.ts`,
> or `apps/web/src/app/api/circle-nano/*`. Companion local note (gitignored):
> the "CIRCLE-NANO — LANDED" section of
> `docs/phase-reports/P5-kernel-dispatch-expansion-deferred.md`.

## Status
**Shipped (code-complete, audited, locally committed; NOT pushed).** Circle
Nano graduated from a *no-op stub* to *settled end-to-end* through the SDK
dispatch kernel, at parity with x402/mpp/ap2. Verification is **offline**:
the EIP-3009 `transferWithAuthorization` is verified by recovering the EIP-712
signer (viem `recoverTypedDataAddress`) and enforcing payee ==
`SETTLEGRID_USDC_RECIPIENT`, the time window, and authorized amount >= the
tool's registered cost — no Circle account, API key, or chain RPC required.
Settle is verify-and-record at AP2 parity (no on-chain submission, no ledger
write). Verified: packages/mcp 1893 pass / 1 skip; apps/web 4041 pass (1
pre-existing unrelated failure — see below); tsc / eslint (0 errors on changed
files) / `next build` all clean. Audit verdict: **PASS** (0 blockers, 0
fix-now).

## Why Circle Nano (and not ACP, the originally-planned next rail)
Step-0 research established ACP (OpenAI/Stripe Agentic Commerce Protocol) is
**effectively Tier-2**: its verify is a live Stripe checkout-session lookup,
and merchant onboarding is gated (OpenAI ChatGPT waitlist/approval) with a
product-catalog model that does not fit per-tool-call agent micropayments. The
next nominal candidate (UCP) is a no-op stub. Circle's May-2026 Agent Stack
makes USDC nanopayments permissionless/self-serve, and EIP-3009 verifies
offline — so it is the highest-quality, only un-gated next rail and complements
the already-wired x402 crypto rail. (Founder-approved 2026-05-29.)

## What shipped (file list)
- `packages/mcp/src/adapters/circle-nano.ts` — `parseCircleNanoProof` +
  `validateCircleNanoProofString` (structural, replaces the `valid:true` stub)
  + `CIRCLE_NANO_SUPPORTED_NETWORKS`; `formatResponse.settlementStatus` now
  derives from `txHash` (honest `off-chain-confirmed` until on-chain lands);
  expanded `CircleNanoErrorCode`.
- `packages/mcp/src/index.ts` — export `parseCircleNanoProof`,
  `validateCircleNanoProofString`, `CIRCLE_NANO_SUPPORTED_NETWORKS`,
  `CircleNanoProof`, `CircleNanoAuthorization`.
- `packages/mcp/src/kernel.ts` — `'circle-nano'` in `PHASE_1_KERNEL_PROTOCOLS`
  + the facilitator branch (reuses `handleFacilitatorProtocol` unchanged).
- `apps/web/src/lib/settlement/circle-nano/verify.ts` — NEW offline EIP-3009
  verifier (viem), reuses x402 `USDC_ADDRESSES`.
- `apps/web/src/lib/circle-nano-proxy.ts` — `validateCircleNanoCredentialString`
  (decode proof → `verifyCircleNanoAuthorization`); legacy direct-path
  `validateCircleNanoPayment` left intact (now structural; see DEBT #2).
- `apps/web/src/lib/env.ts` — `getCircleNanoRecipient` / `isCircleNanoKernelEnabled`
  (`SETTLEGRID_USDC_RECIPIENT`; no Circle API key needed for the kernel rail).
- `apps/web/src/app/api/circle-nano/{verify,settle}/route.ts` — facilitator
  endpoints (raw kernel contract; verify→{valid} @200, settle→SettlementResult).
- Demo (money-safe): sandbox `[...path]` stubs `/api/circle-nano/{verify,settle}`;
  `demo-kernel-config.ts` includes `circle-nano`; `demo/kernel/page.tsx` OG copy
  "4 settled" → "5 settled".
- Tests: kernel facilitator path (`circle-nano protocol` describe), adapter
  parser+structural matrix, the offline-crypto **gold test** (viem signs with
  the real USDC domain → verifier recovers + accepts; all tamper/policy
  rejections), `/api/circle-nano` route integration, demo-config pin (4→5),
  sandbox circle-nano stubs.

## DEBT (deferred — non-blocking; ranked)

| # | Severity | Item | Location | Notes / fix sketch |
|---|---|---|---|---|
| 1 | MED (shared) | Settle does NO on-chain submission, NO unified-ledger write, and NO on-chain nonce/balance check | `api/circle-nano/settle/route.ts` + kernel | SAME gap x402/mpp/ap2 have through the kernel; deferred to P3.K4 "router wiring" + the Circle Gateway on-chain batch-settlement work. Consequence: an authorization can be **replayed within its `[validAfter,validBefore]` window** (no `authorizationState` dedup) and a payer's balance isn't checked — identical posture to AP2 re-verifying a still-valid VDC. **When on-chain settlement lands:** dedup on `(from, nonce)` (NOT on signature bytes — viem's recovery accepts high-s malleable signatures, so dedup-by-sig is unsound), add `balanceOf`, submit `transferWithAuthorization`. |
| 2 | **MED (pre-existing, gated — FOUNDER ACTION)** | Legacy direct-proxy path accepts circle-nano on **structural validation only** (no EIP-712 signature, no payee check) | `apps/web/src/app/api/proxy/[slug]/route.ts:463,1977` → `circle-nano-proxy.validateCircleNanoPayment` | Gated behind `isCircleNanoEnabled()` ⇒ `CIRCLE_NANO_API_KEY` (a SEPARATE env from the kernel rail's `SETTLEGRID_USDC_RECIPIENT`). P5 **strictly tightened** this path (was an accept-any-header stub → now parses + checks network/time/amount), but it still lacks the authoritative crypto+payee gate the kernel route has. If `CIRCLE_NANO_API_KEY` is set in prod, a forged / third-party-payee authorization would be "accepted" on the legacy proxy. **FOUNDER ACTION:** confirm `CIRCLE_NANO_API_KEY` is UNSET in prod. **Follow-up:** route the legacy proxy through `verifyCircleNanoAuthorization` (needs a recipient source for that path) so both surfaces share the crypto gate. |
| 3 | LOW | Cost fail-open to 0 on malformed `pricingConfig` | `api/circle-nano/{verify,settle}` `resolveCostCents` | Mirrors AP2 + the proxy's `getCostCents`. Signature/payee/time remain the real gate; worst case = undercharge on a misconfigured tool, never unauthorized settlement. |
| 4 | LOW (repo-wide) | No request body-size cap on `/api/circle-nano/*`; spoofable `x-forwarded-for` IP rate-limit key | `api/circle-nano/{verify,settle}` | Intentional debt-inheritance — identical to x402/ap2. Folds into the repo-wide rate-limit hardening (publisher-keys DEBT #1 — fix centrally). |
| 5 | INFO (cosmetic) | `generateCircleNano402Response` computes `costCents * 10_000` as a JS number (not BigInt) | `adapters/circle-nano.ts` (402 builder) | Advisory 402 display text, not a settlement gate; `costCents` is integer-bounded by the pricing zod schema. Pre-existing in the adapter; left as-is. |

## Independent hostile review — headline
The security-critical offline EIP-712/EIP-3009 verifier is **sound**: domain is
exactly real USDC (`name "USD Coin"`, `version "2"`, Base 8453 / Sepolia 84532,
USDC `verifyingContract`); the gold test signs with that production domain so a
pass proves real wallet authorizations verify; check-order cannot be gamed
(`valid:true` only after signer recovery == `from`); payee/amount/time gates are
robust and case-safe; post-sign field tampering is caught by recovery; the demo
cannot reach the real route and `demo-sandbox-tool` has no real-money path.
**BLOCKERS: 0, FIX-NOW: 0, DEBT: 4** (items 1–4 above).

## Pre-existing, unrelated test failure observed (NOT introduced here)
`src/lib/__tests__/settlement-moat.test.ts > processDataDeletion > processes a
pending deletion and returns completed` fails at HEAD (returns `'failed'`).
`compliance.ts` + that test file are unmodified by this change and import
nothing from the circle-nano / kernel / `@settlegrid/mcp` surface. This is
publisher-keys DEBT #5 (`processDataDeletion` non-idempotency). Out of scope.

## Next Tier-1 / kernel-dispatch
No remaining clean offline drop-in: AP2 (self-issued VDC) + Circle Nano
(offline EIP-3009) were the genuinely env-derivable rails. ACP is gated
(OpenAI merchant onboarding); UCP's verify is a no-op stub; Visa TAP /
Mastercard / EMVCo / Circle-on-chain need partner sandboxes or RPC infra. The
kernel test `falls through to 402 when the matched adapter is not wired into
Phase 1` still uses **ACP** as its unwired example — correct (ACP remains
unwired); leave it until ACP is ever wired.

---

## Exhaustive Audit Round (2026-05-30) — findings + fixes

Founder requested a maximum-confidence pass before moving on. Five additional
audits ran (one on-chain ground-truth check + three independent fresh-context
review subagents + a self mutation/fuzz/smoke pass). **One real bug + one
correctness/hardening fix found; both fixed. Re-verified green: packages/mcp
1893 pass; apps/web 4053 pass (+11 new tests, 1 pre-existing unrelated fail);
tsc / eslint (0 err) / `next build` clean.** Commit amended.

### Bugs found + FIXED
1. **[was a real bug] Per-network EIP-712 domain `name`.** The verifier
   hardcoded `name: "USD Coin"` for all networks, but the **Base Sepolia** USDC
   contract's EIP-712 name is **`"USDC"`** (read live on-chain). Every Base
   Sepolia authorization would have failed (fail-closed, no forgery risk, but
   the testnet rail was broken). Self-consistent tests + the first hostile
   review missed it; the on-chain `name()`/`version()` read caught it. **Fixed:**
   `USDC_EIP712_DOMAINS` per-network map (`'USD Coin'` mainnet / `'USDC'`
   Sepolia, both `version "2"`) + a Sepolia regression test. The crypto review
   then reconstructed the offline domain separator and confirmed it is
   **byte-identical to the live on-chain `DOMAIN_SEPARATOR`** on both networks
   (mainnet `0x02fa7265…7834f`, Sepolia `0x71f17a3b…c9818`) — pinned as a test
   fixture so a future domain edit that diverges from chain fails in CI.
2. **[correctness + hardening] Signature canonicalization.** viem/noble
   recovery accepts high-s (malleable) signatures and v∈{0,1}, so one
   authorization had up to 4 valid byte-encodings — and, more importantly,
   USDC's *on-chain* `transferWithAuthorization` (OZ ECDSA) **rejects** high-s
   and v∉{27,28}, so an offline-accepted high-s sig would fail on-chain
   (verify/settle mismatch). **Fixed:** `verify.ts` now rejects non-canonical
   signatures (high-s, s=0, v∉{27,28}) before recovery — matching on-chain
   reality + eliminating the malleability/dedup footgun. Tests added for
   malleated/high-s, v∈{0,1}, and EIP-2098 compact (all now rejected).

### DEBT resolved by this round
- **DEBT #2 (legacy-proxy crypto gap) → RESOLVED.** `/api/proxy/[slug]` now
  routes circle-nano through the authoritative `validateCircleNanoCredentialString`
  (EIP-712 recovery + payee + amount), the same gate as the kernel route. The
  earlier FOUNDER-ACTION ("confirm `CIRCLE_NANO_API_KEY` unset") is no longer a
  security requirement — the path is crypto-safe regardless of that env (it now
  also needs `SETTLEGRID_USDC_RECIPIENT` to settle, like the kernel rail).
- **DEBT #1 malleability note → mitigated at the verify layer** (canonical-only
  now). The `(from, nonce)`-not-signature-bytes dedup guidance still stands for
  the future on-chain settler.

### Lower-severity fixes from the parity + content reviews
- Recipient now shape-validated (`isAddress`, strict:false) — a misconfigured
  `SETTLEGRID_USDC_RECIPIENT` fails closed **loudly** (logged) instead of
  silently rejecting every payment. (Crypto Finding 2.)
- Duplicate `circle_nano.verify_rejected` log removed from the proxy layer
  (the routes own rejection logging). (Parity finding.)
- `formatResponse` `success: 'settled' || 'pending'` divergence from the other
  rails — kept (correct for the off-chain-immediate-confirm model) + now
  documented inline. (Parity finding.)
- Content accuracy: the `learn/protocols` **circle-nanopayments** guide was
  overstating (payment channels + "settles on-chain periodically") — rewritten
  to the real offline-EIP-3009 verify + record-only model (on-chain batch =
  roadmap); fixed the stale `kernel.ts` "circle-nano NOT included" comment and a
  demo-config count-terminology comment. (Content review.) **Note:** the content
  review also flagged a *pre-existing, unrelated* stale count —
  `learn/integrations/page.tsx:213` "all 10 AI payment protocols" (should be 14)
  — left out of this chunk as out-of-scope; surfaced to the founder for a
  separate fix.

### New durable tests added
- `verify.test.ts`: +5 crypto edge cases (malleability/high-s, v∈{0,1},
  EIP-2098 compact, cross-network domain isolation, on-chain domain-separator
  fixture) + the Base Sepolia regression case.
- `verify.fuzz.test.ts` (NEW): ~1,800 random/adversarial inputs — parser +
  verifier never throw, never wrong-accept (incl. single-mutation of a signed
  proof).
- `e2e-smoke.test.ts` (NEW): unmocked real-route + real-verifier (real viem
  signature) and full kernel-dispatch via a fetch shim.
- Mutation audit (test-strength): 7/7 injected bugs caught, 0 survivors.
