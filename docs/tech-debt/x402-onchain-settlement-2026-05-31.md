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
- **Facilitator gas-wallet ISOLATION shipped (founder-greenlit, Part 2b).** `settleExactPayment`'s `getGasWallet` now prefers a DEDICATED `SETTLEGRID_FACILITATOR_GAS_WALLET_KEY` (falls back to the shared `SETTLEGRID_GAS_WALLET_KEY` until funded), so a gas-griefing drain of the free public facilitator can never starve the settlement wallet the revenue rails (proxy x402 + circle-nano) depend on. Payee-binding was correctly NOT done — it is a general-purpose relay. ACTIVATION (founder): provision + fund a dedicated wallet, set `SETTLEGRID_FACILITATOR_GAS_WALLET_KEY` in prod, extend the B1.3 gas monitor to watch it. Fast-follow: a per-window gas-budget circuit-breaker if public-facilitator volume grows.

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
1. **Facilitator gas-griefing — MITIGATED via wallet isolation (founder-greenlit).** The public `facilitator.settlegrid.ai` relays any valid authorization for free with no auth → ETH-drain. It now uses a DEDICATED gas wallet (`SETTLEGRID_FACILITATOR_GAS_WALLET_KEY`, fallback to the shared key) so a drain can't starve the revenue rails. **Founder activation:** fund + set that env in prod + extend the B1.3 monitor to it. **Fast-follow:** a per-window gas-budget circuit-breaker on the isolated wallet (if/when public-facilitator volume grows) + B1.3 facilitator-wallet alerting.
2. **Base-Sepolia e2e — ✅ DONE 2026-06-01 (was OWED before go-live).** A real
   viem-signed EIP-3009 `exact` authorization on Base Sepolia (eip155:84532) was
   driven through the UNMOCKED `executeX402Settlement` (real offline verifier +
   real SHARED circle-nano engine + real public Sepolia RPC + real gas wallet +
   real ledger write to an ISOLATED scratch Postgres — never prod) → returned
   `{status:'settled', txHash}`; the USDC moved payer→recipient on-chain
   (confirmed-receipt `Transfer` log + block-boundary balance Δ = 10000 base units
   + `authorizationState(from,nonce)=true`); the unified-ledger row read
   `settlement_status='settled'` + `external_ref=txHash`. Idempotent replay
   returned the SAME txHash with no second charge. Negatives NEVER settled:
   value≠cost → `X402_AMOUNT_MISMATCH`, wrong payee → `X402_WRONG_RECIPIENT`,
   non-Base → `X402_NETWORK_UNSUPPORTED` (all rejected OFFLINE — no submit, no
   ledger row, nonce unconsumed → no gas). On-chain constants were re-ground-
   truthed against the LIVE Sepolia USDC contract that day (name "USDC" / version
   "2" / recomputed EIP-712 domain separator == on-chain `DOMAIN_SEPARATOR()`).
   Settled txs (Base Sepolia): `0xcc78bf28…8cb6`, `0x9d7db3de…b3bf`,
   `0x290f4ea0…2a42`. Scope note: the e2e exercised the ORCHESTRATOR path (the
   money mechanics); `handleX402Proxy`'s thin forward-and-bill wrapper around it
   stays mock-covered. Throwaway payer key: `/Users/lex/.sg-sepolia-test/payer.key`.
   Reproduction recipe at the bottom of this doc.
3. **Standalone facilitator `upto` surface** — left as honest verify-beta; full teardown deferred.
4. **settle.ts facilitator path writes no write-ahead ledger row** → a broadcast-then-timeout there is invisible to the B1.4 reconciler (pre-existing facilitator-surface debt; the proxy path is fully covered).
5. **`getPublicClientForSettle` uses the default public RPC** (consistent with the file's existing `getWalletClient`; a reliability nit on the facilitator surface, not the proxy).
6. **Carried A2:** `takeBps:0` (no platform take in the settle path); `accountId = developerId` stand-in (accounts table unprovisioned).
7. **`maxDuration=90`** assumes a Pro plan (exceeds the 60s Hobby cap) — confirm the deploy plan.
8. **Adapter detection-path `upto` branches** (extractPaymentContext classification) left intact — detection ≠ acceptance; harmless.

## Go-live (founder-gated — real money) — SAFE ORDER (corrected 2026-06-01)

> ⚠️ ORDER IS FUNDS-SAFETY-CRITICAL. **Push FIRST** (deploys the dark-gate + the
> on-chain settle code), **THEN** set `SETTLEGRID_PAYMENT_ADDRESS`. Setting the env
> BEFORE the push would, against the OLD deployed code (which has NO dark-gate),
> advertise a real `payTo` and re-open the structural-accept free-credit hole.
> (This SUPERSEDES the prior set-then-push ordering, which was unsafe.)

1. Base-Sepolia e2e — ✅ DONE (DEBT #2 above).
2. Founder reviews the local commits (`git log origin/main..HEAD`, the diff, this doc).
3. **Push `main`** → x402 deploys DARK (`SETTLEGRID_PAYMENT_ADDRESS` unset → 503; strictly safer than today). Also lands the facilitator honesty fix + the `upto` drop; circle-nano untouched.
4. Verify the Vercel deploy is healthy (the repo's required "Vercel" status check may need bypass-on-push).
5. Confirm `SETTLEGRID_USDC_RECIPIENT` + `SETTLEGRID_BASE_RPC_URL` set in prod; gas wallet funded on Base MAINNET.
6. **THEN** set `SETTLEGRID_PAYMENT_ADDRESS` in Vercel prod = the platform payee (recommend the SAME wallet as `SETTLEGRID_USDC_RECIPIENT`; move both off the hot gas wallet per carried B1 debt) → flips x402 LIVE.

## Base-Sepolia e2e — reproduction recipe (2026-06-01)

The mocked suite covers the branching; it cannot prove a real signed payment
actually settles. To re-run this empirical gate (e.g. before the MAINNET cutover):

1. **Scratch ledger DB (NEVER prod).** The app `db` module hardcodes TLS
   (`ssl:{rejectUnauthorized:false}`), so a plain local Postgres is rejected
   ("server does not support SSL"). Run an ephemeral Postgres with SSL enabled
   (self-signed cert + `ALTER SYSTEM SET ssl='on'`), apply BOTH
   `drizzle/0005_unified_ledger.sql` AND `drizzle/0006_ledger_authorization_fields.sql`
   (together they create `ledger_entries` + every column the insert writes —
   `authorization_signals`/`authorization_artifact` come from 0006; 0005 alone
   throws `column "authorization_signals" does not exist`), then point
   `DATABASE_URL` at it. `account_id` has NO FK, so any uuid sentinel works.
2. **Ground-truth** the live Sepolia USDC (`0x036CbD…3dCF7e`): assert
   `name()=="USDC"`, `version()=="2"`, and recomputed EIP-712 domain separator ==
   the on-chain `DOMAIN_SEPARATOR()`. Verify payer test-USDC + gas-wallet
   Sepolia-ETH balances (payer needs no ETH — the gas wallet submits).
3. **Sign** a `TransferWithAuthorization` (viem `signTypedData`, Sepolia domain
   {name:"USDC",version:"2",chainId:84532,verifyingContract:USDC}) with
   `value == costCents*10000`, `to == SETTLEGRID_PAYMENT_ADDRESS`, a random nonce;
   build the `X402ExactPayload`; set env (`DATABASE_URL`=scratch,
   `SETTLEGRID_GAS_WALLET_KEY`, `SETTLEGRID_PAYMENT_ADDRESS`); call
   `executeX402Settlement` from a vitest `*.e2e.ts` (alias `@`→`src`, node env)
   run via a DEDICATED config so it stays OUT of the default suite (whose
   `include` is `src/**/*.test.ts`). Redis can be left unset — `tryRedis` degrades
   to "proceed unlocked".
4. **Assert from the confirmed receipt** (lag-immune): `status==='success'` + the
   USDC `Transfer(payer→recipient, value)` log. The public Base Sepolia RPC
   (`https://sepolia.base.org`) is load-balanced + eventually-consistent — a
   just-mined block or `balanceOf("latest")` can read stale ("block not found" /
   zero delta), so wrap any post-tx chain read (block-boundary balances,
   `authorizationState`) in retry-until-consistent. Query the scratch ledger row
   for `settled` + the txHash. Run the negatives (wrong amount/payee/network) —
   they reject offline (no submit, no gas).
