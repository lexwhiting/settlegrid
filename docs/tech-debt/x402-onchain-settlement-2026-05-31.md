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

## Go-live (founder-gated — real money) — ⛔ BLOCKED by SEAL-AUDIT (2026-06-01)

> ⛔ **DO-NOT-SEAL** (independent seal-audit, 2026-06-01). Two CRITICAL funds-safety
> holes live in the un-e2e'd proxy wrapper (replay double-credit; testnet-USDC settles
> on a mainnet deploy) + HIGH issues. **Do NOT push and do NOT set
> `SETTLEGRID_PAYMENT_ADDRESS` until the fixes land + a re-audit passes.** Findings +
> action classes: see "Seal-audit findings (2026-06-01)" at the bottom of this doc.

> ⚠️ **CORRECTED CAUSALITY** (supersedes the earlier "setting the env re-opens the
> hole" framing, which was factually WRONG — verified against `cdd2d73a`): the
> structural-accept free-credit/free-service path is **ALREADY LIVE in current prod**,
> gated by `SETTLEGRID_GAS_WALLET_KEY` (set in prod), **independent of
> `SETTLEGRID_PAYMENT_ADDRESS`**. OLD `validateX402Payment` with no facilitator returns
> `valid:true` on a *structurally-valid (NOT on-chain-verified)* payload →
> `forwardAndBill` credits the developer balance with **no USDC received**.
> `PAYMENT_ADDRESS` in the OLD code only sets the advertised 402 `payTo` and is NOT
> checked on accept. So the **PUSH is what CLOSES the hole** (it adds the dark-gate +
> real on-chain settlement) — a STRICT security improvement. Order stays push-FIRST,
> but because the push is the FIX, not because the env "re-opens" anything. (Prior
> session's prod query found 0 historical x402 invocations → unexploited; the founder
> should still confirm no developer balances were credited via structural-accept x402
> before enabling payouts.)

Safe order (only AFTER the seal-audit fixes land + a re-audit passes):
1. Base-Sepolia orchestrator e2e — ✅ DONE (DEBT #2 above).
2. Land the seal-audit fixes (replay-idempotency, prod network-pin, reconciler-credit) + the owed proxy-level integration test, then re-audit.
3. Founder reviews the local commits (`git log origin/main..HEAD`, the diff, this doc).
4. **Push `main`** → CLOSES the live structural-accept hole + deploys the dark-gate (`SETTLEGRID_PAYMENT_ADDRESS` unset → 503) + real on-chain settlement. Lands the facilitator honesty fix + `upto` drop; circle-nano untouched.
5. Verify the Vercel deploy is healthy (the required "Vercel" status check may need bypass-on-push).
6. Confirm `SETTLEGRID_USDC_RECIPIENT` + `SETTLEGRID_BASE_RPC_URL` set in prod; gas wallet funded on Base MAINNET.
7. **THEN** set `SETTLEGRID_PAYMENT_ADDRESS` in Vercel prod = the platform payee (recommend the SAME wallet as `SETTLEGRID_USDC_RECIPIENT`; move both off the hot gas wallet per carried B1 debt) → flips x402 LIVE.

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

## Seal-audit findings (2026-06-01) — verdict: ⛔ DO-NOT-SEAL → 🔧 FIXES APPLIED (re-audit pending)

> **FIXES APPLIED 2026-06-01** — F1 (replay double-credit), F2 (prod network-pin),
> F4 (reconciler credit-on-flip) FIXED; F3 (loss alerts + stop-swallowing, NO
> auto-refund) FIXED; F6 DOCUMENTED (deferred). Owed proxy-level integration test
> added (8 cases). Full record + file:line anchors + runbooks:
> `docs/tech-debt/x402-seal-audit-fixes-2026-06-01.md`. **The mandatory re-audit
> (3-part chain + independent funds-safety panel) must pass before the seal is
> re-attempted / any push.** The findings below are the ORIGINAL audit.

Independent multi-agent seal-audit (4 fresh-context finders × adversarial verify ×
synthesis) of the production proxy/billing surface the orchestrator-level e2e did NOT
exercise. Verdict driven by two reproduced CRITICAL funds-safety holes; the rest are
HIGH/MED/doc. Each was re-verified against the actual code. **Fix the must-fix items +
re-audit before any push.** (Detailed surgical fix specs are in the fix-handoff for the
next session.)

| # | Finding | Sev | Action |
|---|---|---|---|
| 1 | **Replay double-credit** — a replayed x402 authorization hits the orchestrator's idempotent-hit (returns `settled`, no 2nd on-chain charge) but `handleX402Proxy` still re-runs `forwardAndBill` → re-credits `developers.balanceCents` (payout source) + re-delivers. No proxy-layer dedup. Trivially triggered by an SDK auto-retry. | CRITICAL | **fix-before-go-live** — make the credit idempotent on the on-chain settlement identity (operationId), NOT on `outcome.status`. Surgical: orchestrator's idempotent-hit returns a distinguishable `alreadySettled` flag; proxy still forwards but SKIPS the credit + tags a non-billed replay. Additive; proven settle path byte-unchanged. |
| 2 | **Testnet-USDC settles on a mainnet deploy** — `SUPPORTED_CHAINS`/`USDC_EIP712_DOMAINS`/`USDC_ADDRESSES` include Base Sepolia (`eip155:84532`); the proxy path has NO mainnet gate (dark-gate is network-agnostic). Free testnet USDC → real withdrawable credit. (402 advertises only `eip155:8453` — advertised ≠ enforced.) | HIGH | **fix-before-go-live** — env-driven network allowlist gate in `handleX402Proxy` after parse, before settle: reject `network !== 'eip155:8453'` in prod (testnet behind an explicit OFF-in-prod flag). Additive. |
| 3 | **Settle-then-upstream-fail / swallowed billing error** — on-chain USDC settles (`settled` row) but if upstream returns non-2xx (or the billing UPDATE throws, currently swallowed) the dev is credited 0, no refund, no compensating entry. Asymmetric to the prepaid rails (can't un-charge on-chain). Shared with circle-nano. | HIGH | **document-as-accepted-tradeoff** — standard x402 settle-final / refund-out-of-band. Disclose as accepted-risk DEBT + manual refund runbook (keyed by `external_ref` txHash + payer); emit an alertable signal on the loss branches; stop swallowing the billing-UPDATE error. NO auto-refund (new irreversible money path — own audit). |
| 4 | **Reconciler-confirmed settles never credit the dev** — `reconcile.ts` flips `pending→settled` but never writes `developers.balanceCents`/`tools.totalRevenueCents`; the proxy already returned `pending` (no `forwardAndBill`). Async-confirmed (broadcast-then-timeout) settlements → USDC collected, dev permanently uncredited. | HIGH | **fix-before-go-live** (med regr.) — in `reconcileOneRow`'s settled case, when `markSettlementSettled` returns `flipped===true` (race-safe via the `WHERE pending` guard), credit the dev + tool revenue in-txn by `amountCents`. Requires storing `toolId` in the settlement-row metadata at `ensurePendingRow`. Decide+document the undelivered sub-case. |
| 5 | **Go-live doc causality was factually wrong** — see the CORRECTED CAUSALITY banner above. The structural-accept hole is live now (gas-key-gated, PAYMENT_ADDRESS-independent); the push CLOSES it. | HIGH | **✅ FIXED 2026-06-01 (doc-only, this commit)** — banner rewritten + this section added. Founder action: confirm no dev balances were credited via structural-accept x402 before enabling payouts (prior prod query: 0 historical x402 rows → likely none). |
| 6 | **No dev-balance reconciliation control** — `verifyLedgerIntegrity` audits the `accounts` table, not `developers.balanceCents`; will mis-report once single-sided settlement rows exist. | MED | **defer-post-go-live** — add a per-developer balance ⇄ settled-inflow detective job + alert, OR document as accepted go-live debt with an operator runbook. |

**Residual risks still uncovered** (carry into the fix session): the proxy wrapper on a
*settled* outcome is exercised by NO running test — a route-level integration test
(settled→single gross credit+txHash header; non-settled→no forward/credit; 5xx upstream→no
credit; **replayed header→exactly one credit**) is owed. Mainnet USDC constants ("USD Coin"/
"2"/`DOMAIN_SEPARATOR`) NOT re-ground-truthed against the live mainnet contract this session
(only Sepolia). On-chain REVERT + broadcast-then-timeout branches NOT exercised empirically.
circle-nano shares `forwardAndBill` → the same double-credit / no-refund / reconciler-no-credit
gaps very likely exist there too (re-review before its own mainnet cutover). `maxDuration=90`
assumes a Vercel Pro plan (DEBT #7) — if Hobby, in-path receipt waits truncate and push more
settlements into the un-credited reconciler path.
