# circle-nano funds-safety topology TRACE (2026-06-01)

> Step-1 investigation for the circle-nano funds-safety parity review (handoff
> `circle-nano-funds-safety-parity-handoff-2026-06-01.md` §3.1 + §4). Every claim
> below is grounded in code read this session (file:line). This trace is the input
> the BUILD PLAN's factual-assumptions section rests on and the pre-build audit
> verifies. **Headline: circle-nano's funds-safety gaps are NOT the x402 F1/F3/F4
> shape — the topology is materially different (see §A).**

## A. The two disjoint surfaces (the core finding)

circle-nano has TWO completely separate consumption surfaces. They are **disjoint**:
neither does both "collect USDC on-chain" AND "credit the developer." x402 (post-fix)
does both on one surface; circle-nano splits them and each half does only one.

| | **Proxy mode** | **Kernel / facilitator mode** |
|---|---|---|
| Entry | `POST /api/proxy/[slug]` + `x-circle-nano-auth` header | SDK `createDispatchKernel` → `POST /api/circle-nano/{verify,settle}` |
| Enable gate | `isCircleNanoEnabled()` = `!!CIRCLE_NANO_API_KEY` (circle-nano-proxy.ts:41-43) | `isCircleNanoKernelEnabled()` = `!!SETTLEGRID_USDC_RECIPIENT` (env.ts:249-252) |
| Dispatch | route.ts:474-475 → `handleProtocolProxy(..., 'circle-nano')` | kernel.ts:405-420 → `handleFacilitatorProtocol` |
| Verify | offline only (`validateCircleNanoCredentialString` → `verifyCircleNanoAuthorization`) | same offline verifier, twice (`/verify` then re-verify in `/settle`) |
| **On-chain USDC collected?** | **NO** — never calls `executeCircleNanoSettlement` | **YES** — `executeCircleNanoSettlement` submits EIP-3009 + waits for confirmed receipt |
| Unified-ledger row written? | **NO** (only an analytics `invocations` row via `recordProtocolInvocation`, route.ts:1518) | **YES** — write-ahead `pending` → flipped `settled` (settle.ts) |
| **Credits `developers.balanceCents`?** | **YES** — `forwardAndBill` (route.ts:2219), no options | **NO** — `/settle` writes the ledger row but never touches `balanceCents` |
| Forwards the tool? | YES (it's a proxy) | NO (the dev runs their own handler in their kernel) |
| Replay-dedup? | **NONE** (no idempotency key, no ledger row, no nonce check) | YES — `operation_id` = `circle-nano:network:from:nonce` + on-chain nonce-once (settle.ts:66-68, 178-192) |

**Payout source of truth = `developers.balanceCents` only** (`processPayout`,
payouts/process.ts:211/250/259/303 — reads balance, Stripe-transfers, zeroes it).
The unified-ledger settlement rows are **NOT read by payouts at all.**

Cross these two facts and both halves are broken in OPPOSITE directions:

- **Proxy mode → PHANTOM CREDIT (platform loss).** Credits a withdrawable
  `balanceCents` (real USD via Stripe payout) for a payment that is **never settled
  on-chain**. The signed EIP-3009 authorization is validated offline, used to credit,
  then discarded — the USDC is never collected. This is the circle-nano analog of the
  OLD x402 structural-accept hole the x402 chunk just FIXED — except unaddressed, and
  using the authoritative verifier (so the auth is cryptographically valid, just never
  submitted). Severity hinges on whether `CIRCLE_NANO_API_KEY` is set in prod (→ Step-0).
- **Kernel mode → UNCREDITED REVENUE (dev stiffed).** Collects USDC on-chain to the
  platform payee, writes a ledger row, but **never credits `balanceCents`**, so the dev
  is never paid out for kernel-mode revenue. This is BROADER than the x402 F4 (which was
  only the async-confirmed reconciler tail) — here even the in-request `/settle` success
  path (the common case) doesn't credit.

A2 (the on-chain chunk, 2026-05-29/31) wired REAL on-chain settlement into `/settle`
ONLY; the legacy proxy path (env.ts:236 calls it "legacy direct-proxy") was left in its
pre-A2 "validate offline + credit, settle deferred/never" state. The intended behavior
(learn page, `learn/protocols/[slug]/page.tsx:322`: "SettleGrid submits the
transferWithAuthorization on-chain … before recording the settlement") is honored by
`/settle` and **violated by the proxy.**

## B. The §4 UNKNOWNS — resolved

1. **What does `handleProtocolProxy` do for circle-nano?** (route.ts:2141-2160, 2219)
   Offline-verify via `validateCircleNanoCredentialString` (recovers EIP-712 signer +
   payee-bind + amount + window + canonical-sig, all RPC-free — verify.ts:14-22 says it
   intentionally does NOT submit, check nonce, or check balance) → `forwardAndBill` with
   **no `options`** → credits `balanceCents`/`totalRevenueCents` + forwards. **No on-chain
   settle, no ledger row, no `skipCredit`/`irreversibleOnChain`.** Credit rests on offline
   validation alone. → answer (a) in the handoff.
2. **How do the two surfaces relate / where does USDC move?** Disjoint modes (§A). A proxy
   invocation does NOT trigger a `/settle`. USDC moves on-chain ONLY in kernel mode; the
   dev is credited ONLY in proxy mode. They never compose for one invocation.
3. **Is the credit tied to an irreversible on-chain charge?** **NO** (proxy credits with no
   on-chain settle). So x402's F1/F3 (which bite only when crediting AFTER an irreversible
   settle) do NOT apply in the x402 shape; the proxy instead has the credit-without-settle
   (phantom) hole.
4. **Replay?** Proxy: trivially re-creditable — replay the header N times → N phantom
   credits (no dedup whatsoever). `/settle`: replay-safe (operation_id + on-chain nonce-once).
5. **Is the F4 reconciler-credit fix mis-shaped for circle-nano?** **YES.** The proxy
   produces no ledger/`pending` row for the reconciler to act on, and `/settle`'s in-request
   success path (the majority) is what fails to credit — not just the async-confirmed tail.
   An x402-style reconciler-only credit would cover only the broadcast-then-timeout subset
   and leave the common in-request settle uncredited. The credit must live in `/settle`'s
   in-request success flip, with the reconciler covering ONLY the async tail (exactly-once
   via the `markSettlementSettled` `WHERE pending` flip guard).

## C. Reusable machinery on `main` (from the x402 fixes)

- `forwardAndBill(..., { skipCredit?, irreversibleOnChain? })` (route.ts:1590-1610) — credit
  gated on `!skipCredit`; F3 loss alerts on `irreversibleOnChain`.
- `markSettlementSettled(opId, rail, txHash)` (ledger.ts:539) — the SOLE guarded
  `WHERE settlement_status='pending'` flip → exactly one flip-winner (the credit-once anchor).
- `creditReconciledX402Settlement` (reconcile.ts:185) — credits dev+tool in one txn iff
  `flipped && rail==='x402'`; reads `amountCents`/`accountId`/`metadata.toolId`. circle-nano
  is deliberately excluded (reconcile.ts:121, 174-177) AND its pending rows store no `toolId`
  (settle.ts:91-101 — `ensurePendingRow` metadata has method/latencyMs/settlementType/network/
  payer/authorizedValueBaseUnits, **no toolId**).

## D. What is NOT a gap (scope guards)

- `/api/circle-nano/verify` — pure offline verify; no credit, no settle. Benign.
- The on-chain engine/verifier (`settle-engine.ts`/`verify.ts`) money mechanics are A2-
  Sepolia-proven + byte-stable references — do NOT rewrite.
- The F6 ledger-integrity `balanced:false` reporting artifact is already live + documented
  (x402 fix doc) — not this chunk.
