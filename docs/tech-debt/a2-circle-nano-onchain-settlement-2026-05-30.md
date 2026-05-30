# P3.K4 — A2: circle-nano on-chain settlement (2026-05-30)

> ## ⚠️ FUTURE AGENTS — READ THIS BEFORE GOING LIVE OR TOUCHING circle-nano SETTLEMENT
>
> A2 makes the `circle-nano` rail **move REAL USDC on-chain** (EIP-3009
> `transferWithAuthorization` via SettleGrid's gas wallet on Base). It is built,
> audited (3 independent fresh-context reviewers: correctness / crypto-deep /
> funds-safety), and committed locally — but circle-nano stays **DARK in prod**
> until the founder-gated go-live below. Sub-part 2 (x402 ledger write) status is
> at the bottom.
>
> ### 🔴 GO-LIVE CHECKLIST (founder-gated — do these together, none unprompted)
> Pushing + setting these turns on real money. Treat as ONE step.
> 1. **`git push`** the A2 commits to `origin/main` (founder-gated per push policy).
> 2. **Set `SETTLEGRID_USDC_RECIPIENT`** in Vercel **prod** to the `0x…` Base
>    platform-payee address. This is the master switch: until set,
>    `isCircleNanoKernelEnabled()` is false and the settle route 503s (DARK).
> 3. **Fund the gas wallet** (`SETTLEGRID_GAS_WALLET_KEY`'s address) with **ETH on
>    Base mainnet** — every settlement pays gas from it. An unfunded wallet →
>    every settle returns 503 (`CIRCLE_NANO_GAS_WALLET_INSUFFICIENT`), row stays
>    `pending`.
> 4. **Apply the index migration** `apps/web/drizzle/0010_ledger_operation_id_idx.sql`
>    **by hand in the Supabase SQL Editor** (migrations are not auto-applied; the
>    drizzle journal is intentionally incomplete). Without it the flip UPDATE
>    scans every circle-nano row.
> 5. **(Recommended, not required)** Set **`SETTLEGRID_BASE_RPC_URL`** in prod to a
>    dedicated mainnet provider (Alchemy/QuickNode/Coinbase). Falls back to viem's
>    public RPC, which is fine for Sepolia + low volume but rate-limited at scale.
> 6. **Test the FULL flow on Base Sepolia FIRST** (real signed proof → real submit
>    → confirmed receipt → row flips to `settled`+txHash) before mainnet.
>
> ### 🟡 DEFERRED / KNOWN GAPS (non-blocking; flagged by the A2 audit panel)
> - **Unowned priced tool reports `settled` without collecting.** If an *active*
>   tool has `costCents > 0` but `developerId IS NULL`, the settle route falls to
>   the free path and returns `settled` with **no on-chain submit** (the consumer's
>   authorization goes unspent). Pre-existing from A1; A2 inherits it. A misconfig
>   (real tools have owners) but a revenue-leak/honesty gap. Fix = reject a
>   positive-cost op that lacks an owning developer (will require updating the
>   circle-nano e2e-smoke test, whose mock tool has no developerId). See the gate
>   in `api/circle-nano/settle/route.ts` (`costCents > 0 && toolRow.developerId && parsedProof`).
> - **`value` (on-chain) vs `costCents` (ledger) can diverge.** The verifier allows
>   `authorization.value >= requiredBaseUnits`, and the engine moves the FULL signed
>   `value` on-chain while the ledger records `costCents`. Normal clients sign
>   exactly cost (the 402 challenge tells them `amount_usdc_base_units = cost*10000`),
>   so this is moot in practice; the full amount is recorded in the row metadata
>   (`authorizedValueBaseUnits`) for traceability. If real payers ever over-authorize,
>   reconciliation (`amountCents` vs on-chain value) will diverge by the surplus —
>   decide a policy (record the surplus, or reject value>cost) before that happens.
> - **No reconciler for stuck `pending` rows.** A timeout / RPC-error / revert-with-
>   nonce-consumed leaves a `pending` row carrying the broadcast txHash in
>   `external_ref`. A retry re-waits on it (recovery path), but with no retry the row
>   lingers `pending` until the authorization expires. A periodic reconciler (check
>   `authorizationState(from,nonce)` + the stored tx's eventual receipt, then flip)
>   is future work. Pending rows WITH an `external_ref` = "broadcast, confirmation
>   outstanding."
> - **Carried A1 DEBT (still live):** `accountId = tool.developerId` is a STAND-IN
>   (no `accounts` provisioning); `takeBps: 0` (no platform take computed);
>   `SETTLEGRID_BASE_RPC_URL` is wired into circle-nano settle only, NOT x402's
>   settle (x402 still uses the public RPC and still does NOT wait for a receipt).

**Chunk:** P3.K4 step **A2** — the "settle" half of "make the rails actually
settle + record." Sub-part 1 (circle-nano on-chain) is in this commit; sub-part 2
(x402 ledger write) + the prod env flip complete A2.

---

## Sub-part 1 — circle-nano on-chain settlement (THIS COMMIT)

### What it does
The `/api/circle-nano/settle` route, when a tool has a positive cost + an owning
developer + a parseable proof, now: re-verifies the EIP-3009 authorization offline
→ writes a write-ahead **`pending`** ledger row → submits `transferWithAuthorization`
on-chain via the gas wallet → **waits for a CONFIRMED receipt** → flips the row to
its terminal state. A settled on-chain payment returns `settlementType:'real-time'`
+ the `txHash` (adapter reports `settlementStatus:'on-chain'`); a reverted/unconfirmed
tx returns a structured HTTP error and is **NEVER** reported settled. Free /
unattributable calls keep the verify-and-record-only path (settled, no txHash).

### Funds-safety invariants (verified by the audit panel)
- A reverted, timed-out, or unconfirmed tx is **never** recorded `settled`.
- Idempotency keys on the stable `(network, from, nonce)` `operation_id`, NEVER
  signature bytes (EIP-3009 sigs are malleable); USDC enforces nonce-once on-chain.
- `'settled'` is terminal: every flip is guarded `WHERE settlement_status='pending'`,
  so a concurrent loser can't clobber a winner.
- The `pending` INTENT row is written (awaited) BEFORE the submit, and the broadcast
  txHash is persisted (via `onBroadcast`) BEFORE the receipt wait — so a crash at any
  point leaves a recoverable row with a re-waitable hash.
- Recovery never re-broadcasts a tx that may still be in the mempool (only re-submits
  on a clean revert with the nonce provably free).

### Crypto constants — GROUND-TRUTHED 2026-05-30
Read from the LIVE contracts (public RPC) for both networks; pinned + regression-
guarded in `__tests__/onchain-constants.test.ts` (recompute the EIP-712 domain
separator from the pinned {name,version,chainId,verifyingContract} and assert it
equals the live `DOMAIN_SEPARATOR()` — the exact check that would have caught the
prior Sepolia "USDC" vs "USD Coin" bug):
- Base mainnet (8453): USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, name
  "USD Coin", version "2", DOMAIN_SEPARATOR `0x02fa7265…834f`.
- Base Sepolia (84532): USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, name
  "USDC", version "2", DOMAIN_SEPARATOR `0x71f17a3b…9818`.

### Files
New:
- `apps/web/src/lib/settlement/circle-nano/settle-engine.ts` — pure viem engine
  (pre-submit nonce+balance guards, write, confirmed-receipt wait, `onBroadcast`).
- `apps/web/src/lib/settlement/circle-nano/settle.ts` — orchestrator (idempotency,
  write-ahead pending row, Redis per-authorization lock, recovery, ledger flip).
- `apps/web/drizzle/0010_ledger_operation_id_idx.sql` — `operation_id` index (APPLY MANUALLY).
- `__tests__/{settle,settle-engine,onchain-constants}.test.ts` — 40 tests.
Modified:
- `apps/web/src/lib/settlement/ledger.ts` — `findSettlementRow` + `markSettlementSettled`/`Failed`/`Broadcast` (explicit UPDATE on `operation_id`+`rail`, guarded `WHERE settlement_status='pending'`).
- `apps/web/src/app/api/circle-nano/settle/route.ts` — wired to `executeCircleNanoSettlement`; honesty flip.
- `apps/web/src/lib/env.ts` — `getBaseRpcUrl(network)`.
- `apps/web/src/lib/settlement/circle-nano/verify.ts` — exported `USDC_EIP712_DOMAINS`; updated the "deferred" comment.
- `packages/mcp/src/adapters/circle-nano.ts` — content honesty (header, settlementStatus comment, 402 `settlement` block on-chain) + its test.
- `apps/web/src/app/learn/protocols/[slug]/page.tsx` — content honesty (off-chain → on-chain).
- circle-nano route/e2e-smoke tests updated for the new contract.

### Audit panel (3 independent fresh-context reviewers)
- **crypto-deep: SHIP** (recomputed both domain separators + confirmed addresses).
- **correctness: SHIP** (exhaustiveness, lock try/finally, Drizzle, scoping clean).
- **funds-safety: SHIP-AFTER-FIXES** — no consumer double-charge and no
  revert/timeout-as-settled in any finding. Fixes applied: (1) recovery no longer
  blind-re-submits an in-flight tx; (2) broadcast hash persisted before the receipt
  wait (mid-wait-kill no longer loses it); (3) insufficient-balance leaves the row
  `pending` (retryable) instead of terminally `failed`; (4) engine BigInt parse
  guard; (5) defensive log on a settled-with-empty-hash anomaly. Deferred items
  (unowned-tool, value-vs-cost) are in the 🟡 section above.

### Verification
tsc clean (apps/web + packages/mcp); apps/web vitest 4107 pass / 1 PRE-EXISTING
unrelated fail (`processDataDeletion`, publisher-keys DEBT #5 — NOT ours); mcp
vitest 1893 pass / 1 skip; eslint 0 errors on changed files; `next build` OK;
mutation-tested the "unconfirmed never settled" invariant (RED→restored).

---

## Sub-part 2 — x402 ledger write — **PENDING (fresh session recommended)**

**Corrected finding (the handoff's "x402 settle route" framing was imprecise):**
x402 is internally called **`ln`** in this codebase. There are TWO x402 surfaces:
- **`/api/x402/settle` + `/api/x402/facilitator/v1/settle`** — generic, PUBLIC
  facilitator endpoints. They take a raw `{paymentPayload}` and have **NO tool /
  developer / cost context** (no DB lookup). A unified-ledger settlement row does
  **NOT** belong here — there is nothing to attribute it to (no `accountId`), and
  these settle arbitrary third-party x402 payments, not necessarily SettleGrid
  tool revenue.
- **`handleX402Proxy`** in `apps/web/src/app/api/proxy/[slug]/route.ts` (~line 1709)
  — the REAL per-invocation x402 tool settlement path. It HAS full tool context
  (`toolRow` incl. `developerId`, `costCents`, `slug`) and the settle result
  (`lnResult.txHash` / `payerAddress` / `network`), and currently writes **NO**
  `recordSettlementEntry` row. **This is where sub-part 2's ledger write belongs.**

**Sub-part 2 = add a `recordSettlementEntry` call in `handleX402Proxy`** mirroring
A1's circle-nano pattern: `rail`/`protocol` `'x402'`, `currency:'USDC'`,
`status:'settled'`, `settledAt`, `externalRef = lnResult.txHash`,
`accountId = toolRow.developerId`, `amountCents = costCents`, and a stable
`invocationId` keyed on the x402 authorization `(network, from, nonce)` —
**confirm `lnResult` / the validated request exposes the nonce** for the dedup key
(if only `txHash` is available, key on `x402:<network>:<txHash>` instead, but
`(from,nonce)` is preferable for parity with circle-nano). Lighter audit than
sub-part 1 (it records a payment that ALREADY settled on-chain — no new money
movement). `'settled'` rows MUST carry `settledAt` (validator throws otherwise).
