# x402 on-chain settlement activation ("A2 for x402") — 2026-05-31

> Activates REAL on-chain USDC settlement for the **x402 exact** scheme in the
> production proxy path, by reusing the audited circle-nano EIP-3009 engine +
> offline verifier. Closes the dormant B1.2→B1.4 loop. Real-money. **Gated DARK
> in prod** until the founder sets `SETTLEGRID_PAYMENT_ADDRESS` (the go-live).

## What shipped (Parts 1–3)

**Part 1 — the money path (apps/web-only, no SDK crypto added):**
- `lib/settlement/eip3009/types.ts` (NEW) — shared `Eip3009SettleProof` (rail-agnostic; `CircleNanoProof` + `X402ExactPayload.payload` both satisfy it).
- `lib/settlement/circle-nano/settle-engine.ts` — engine fn params widened `CircleNanoProof`→`Eip3009SettleProof` (logic byte-identical).
- `lib/settlement/circle-nano/verify.ts` — `verifyCircleNanoAuthorization`→`verifyEip3009Authorization` (+ back-compat alias), param widened, NEW `exactAmount?: boolean` (true ⇒ `value === required`, the x402 exact rule; default `>=` ⇒ circle-nano unchanged).
- `lib/settlement/x402/parse.ts` (NEW) — `extractX402PaymentHeader` + `parseX402ExactPayload` (base64/JSON decode, exact-only, strict shape; structural gate only — verify is authoritative).
- `lib/settlement/x402/orchestrate.ts` (NEW) — `executeX402Settlement`, a close mirror of `executeCircleNanoSettlement`: offline verify (recover + payee-bind + EXACT amount + Base-only, RPC-free → rejects bad sig before burning gas) → idempotency on `(network,from,nonce)` → write-ahead `pending` row → Redis lock → submit + CONFIRMED-receipt wait → guarded flip. x402-flavored error codes.
- `lib/env.ts` — `getX402PaymentAddress()` (trimmed) + `isX402SettlementEnabled()` (gas key AND payment address).
- `app/api/proxy/[slug]/route.ts` — `handleX402Proxy` rewired: dark-gate → structural validate → parse exact payload → `executeX402Settlement` → **forward + bill ONLY on a confirmed `settled` outcome** (confirm-before-deliver); 402/502/503 otherwise. `maxDuration` 60→90 (in-path receipt wait). Removed the B1.2 `buildX402SettlementRow` write.
- `lib/x402-proxy.ts` — dropped `facilitatorUrl` from the proxy's `validateX402Payment` (D1: the orchestrator is the SOLE settle path — removes the double-settle hazard); advertise the **trimmed** `getX402PaymentAddress()` as the 402 `payTo` so it matches the enforced payee.
- `lib/settlement/reconcile.ts` (B1.4) — x402 `operation_id` keying `x402:<network>:<txHash>` → `x402:<network>:<from>:<nonce>`; x402 now gets the same reverted-but-nonce-consumed recheck circle-nano has.
- Retired `lib/settlement/x402-ledger.ts` + its test (B1.2 builder, superseded by the orchestrator's write-ahead row).

**Part 2 — public facilitator honesty (safe half):**
- `lib/settlement/x402/settle.ts` — `settleExactPayment` now waits for a CONFIRMED receipt (`waitForTransactionReceipt`, `status==='success'`) before reporting success; a revert/timeout is a FAILURE and is NOT cached. Matches the canonical x402 V2 facilitator. (Makes Part 3's "confirms" prose true.)
- **HELD for founder input:** the facilitator's pre-existing gas-griefing exposure (free, no-auth public relay on the shared hot gas wallet) is NOT addressed here — payee-binding would break its general-purpose marketing. Decision pending (keep + per-window gas-budget circuit-breaker [recommended] / gate-auth / retire). See "Deferred".

**Part 3 — honesty / `upto`-drop (proxy-scoped):**
- `packages/mcp/src/adapters/x402.ts` — `generateX402_402Response` advertises EXACT only (dropped the `upto` accept entry + fixed instructions to "exactly"); `validateX402Payment` rejects non-exact (removed the upto branch). SDK rebuilt.
- Prose: facilitator page "broadcasts"→"settles … confirmed receipt"; learn page USDT→USDC, multi-token→USDC/Base.
- **Deferred (documented):** the standalone public facilitator's already-honest `upto` verify-beta surface (`/api/x402/{verify,supported}` + `/v1/*`) is left intact — full `upto`/`verifyUptoPayment` teardown is separate cleanup, not a correctness need.

## Ground-truthing (real-money, non-negotiable)
- The x402 V2 **exact** rule = strict equality was ground-truthed against `coinbase/x402` `main` (`typescript/packages/mechanisms/evm/.../eip3009.ts`: `if (BigInt(value) !== BigInt(requirements.amount)) → invalid`; settle waits for `waitForTransactionReceipt` + `status==='success'`). `exactAmount:true` matches this.
- On-chain constants (USDC addresses, EIP-712 domains, ABI) are **reused unchanged** from circle-nano (live-contract-guarded in `circle-nano/__tests__/onchain-constants.test.ts`). No new constant duplicated → the A2 Base-Sepolia domain-divergence class cannot recur.
- Base-only enforced at verify (`USDC_EIP712_DOMAINS` = Base mainnet + Sepolia); `eip155:1` fails closed BEFORE any chain write → **retires B1.4 DEBT #1** (non-Base x402 unconfirmable) for the proxy path.

## Verification (all green)
- packages/mcp: build 0 · tsc 0 · vitest **1896 pass / 1 skip**.
- apps/web: tsc 0 · vitest **4184 pass / 1 PRE-EXISTING unrelated fail** (`settlement-moat > processDataDeletion`) · eslint 0 · **next build 0**.
- New tests: `x402/__tests__/parse.test.ts`, `x402/__tests__/orchestrate.test.ts` (funds-safety branch coverage mirroring circle-nano), + `exactAmount` direct tests in `circle-nano/__tests__/verify.test.ts` (mutation-resistant: an ignore-the-flag regression fails the over-payment-reject case).

## Audit chain
- **Spec-diff:** the change matches the founder-greenlit Step-0 (D1 durable code path; exact-only; Base-only; `(from,nonce)` keying; payee-bind; dark-gate; confirm-before-deliver). Diverges from the original Part-2 plan (corrected: do NOT payee-bind the *public* facilitator — it's general-purpose by design).
- **Independent fresh-context panel (3 reviewers):** funds-safety **SHIP** (all 6 invariants hold), crypto **SHIP** (reuse sound; circle-nano byte-identical), correctness **SHIP-AFTER-FIXES** → the one money-path fix (advertise the trimmed payTo) was applied + re-verified. NITs recorded under "Deferred".
- **Tests + verification:** gates above; the green suite alone would NOT have caught the trim divergence — the panel did (consistent with feedback-ke2-independent-audit-mandatory).

## Carried / new DEBT + deferred (none blocking the code; some gate go-live)
1. **Facilitator gas-griefing (pre-existing, HELD for founder):** the public `facilitator.settlegrid.ai` relays any valid authorization for free with no auth on the shared hot gas wallet → ETH-drain/abuse. Fix is a product decision (keep + per-window gas-budget circuit-breaker [recommended] / gate-auth / retire). Not introduced here.
2. **Base-Sepolia e2e — OWED before go-live:** a real signed EIP-3009 on Sepolia → proxy → confirmed settle + ledger row (the empirical gate the mocked tests can't cover; A2 did the circle-nano equivalent). Throwaway payer key at `/Users/lex/.sg-sepolia-test/payer.key`.
3. **Standalone facilitator `upto` surface** — left as honest verify-beta; full teardown deferred.
4. **settle.ts facilitator path writes no write-ahead ledger row** → a broadcast-then-timeout there is invisible to the B1.4 reconciler (pre-existing facilitator-surface debt; the proxy path is fully covered).
5. **`getPublicClientForSettle` uses the default public RPC** (consistent with the file's existing `getWalletClient`; a reliability nit on the facilitator surface, not the proxy).
6. **Carried A2:** `takeBps:0` (no platform take in the settle path); `accountId = developerId` stand-in (accounts table unprovisioned).
7. **`maxDuration=90`** assumes a Pro plan (exceeds the 60s Hobby cap) — confirm the deploy plan.
8. **Adapter detection-path `upto` branches** (extractPaymentContext classification) left intact — detection ≠ acceptance; harmless.

## Go-live (founder-gated — real money)
1. Review the local commit(s).
2. Set `SETTLEGRID_PAYMENT_ADDRESS` in Vercel prod = the platform payee (recommend the SAME wallet as `SETTLEGRID_USDC_RECIPIENT`; move both off the hot gas wallet per carried B1 debt). Until set, x402 stays DARK.
3. Confirm `SETTLEGRID_BASE_RPC_URL` (+ Sepolia) set; gas wallet funded on Base mainnet.
4. Run the Base-Sepolia e2e (DEBT #2).
5. Push `main` (the go-live).
