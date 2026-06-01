# x402 seal-audit FIXES — applied 2026-06-01

> Companion to `x402-onchain-settlement-2026-05-31.md` ("Seal-audit findings
> (2026-06-01) — verdict: ⛔ DO-NOT-SEAL") and the fix-chunk handoff
> `x402-seal-audit-fix-handoff-2026-06-01.md`. This records what was actually
> changed to clear the DO-NOT-SEAL verdict, the owed test, the residual runbooks,
> and what stays deferred. **Additive/surgical only — the e2e-proven orchestrator /
> engine / verifier / shared circle-nano code is byte-unchanged.**

## Unifying invariant (F1 + F4)

**Credit fires exactly once, iff this actor flips the settlement row `pending→settled`.**
The flip is a single guarded `UPDATE … WHERE settlement_status='pending'` (`markSettlementSettled`),
so exactly one actor wins it. The live proxy path credits iff the orchestrator flipped
(and F1's `alreadySettled` covers the concurrent-loser); the B1.4 reconciler credits iff
*it* flipped (F4). A row flips once → it is credited once. The proxy and the reconciler can
never both credit the same settlement.

## What changed (file:line anchors at the fix commit — verify with git)

### F1 — CRITICAL: proxy replay double-credit → on-settlement-identity idempotency  ✅ FIXED
- `lib/settlement/x402/orchestrate.ts` — `X402SettlementOutcome` settled variant gains
  `alreadySettled?: true`; set on BOTH non-flip-winner returns (the idempotent-hit branch
  AND `applyOutcome`'s `!flipped` concurrent-loser branch). The fresh-flip return is
  unflagged → the proxy credits. Status/txHash byte-unchanged (the proven e2e assertions
  still hold).
- `app/api/proxy/[slug]/route.ts` `forwardAndBill` — new trailing `options?: { skipCredit?: boolean }`;
  the `developers.balanceCents` / `tools.totalRevenueCents` credit is gated on `!skipCredit`
  (byte-identical for all 6 existing callers). `handleX402Proxy` passes `skipCredit:true` +
  tags `replay:true` on `alreadySettled` — still forwards (the buyer paid once) but never
  re-credits; the replay invocation records `costCents 0`.
- Tests: `orchestrate.test.ts` (idempotent-hit + concurrent-loser return `alreadySettled`);
  `x402-proxy-settlement.test.ts` (replay → forwarded, NOT re-credited, cost header `0`).

### F2 — HIGH: testnet-USDC settles on a mainnet deploy → prod network-pin  ✅ FIXED
- `lib/env.ts` — `X402_MAINNET_NETWORK='eip155:8453'` + `isX402TestnetSettlementAllowed()`
  (`SETTLEGRID_X402_ALLOW_TESTNET==='true' && !isProduction()` — **production is hard-pinned
  to mainnet; no flag can re-open it**, belt-and-suspenders beyond the spec's "flag OFF in prod").
- `app/api/proxy/[slug]/route.ts` `handleX402Proxy` — gate after `parseX402ExactPayload`, before
  `executeX402Settlement`: reject `network !== X402_MAINNET_NETWORK` (402 `X402_NETWORK_UNSUPPORTED`)
  unless testnet is explicitly allowed (non-prod only). The Base-Sepolia e2e is unaffected — it
  drives the orchestrator directly, not this proxy gate; `USDC_EIP712_DOMAINS` untouched. The
  adapter already advertises only `eip155:8453`, so **no `packages/mcp` change / SDK rebuild.**
- Tests: `x402-proxy-settlement.test.ts` (testnet payload → 402, settle NEVER attempted;
  mainnet → settle attempted).

### F4 — HIGH: reconciler-confirmed settles never credit the dev  ✅ FIXED (x402-scoped)
- `lib/settlement/x402/orchestrate.ts` — `ExecuteX402SettlementParams` gains `toolId`; stored in
  the pending-row metadata (the dev is keyed by the row's `accountId` column).
- `app/api/proxy/[slug]/route.ts` — `handleX402Proxy` passes `toolId: toolRow.id`.
- `lib/settlement/reconcile.ts` — the `settled` case, when `markSettlementSettled` returns
  `flipped===true` AND `rail==='x402'`, credits `developers.balanceCents` + `tools.totalRevenueCents`
  by the row's `amountCents` in one `db.transaction` (`creditReconciledX402Settlement`). The
  reconciler query now also selects `amountCents`/`accountId`/`metadata`.
- **Delivery decision (the undelivered sub-case):** the original request returned `pending`
  (NOT delivered). Delivery is available via the buyer's **idempotent retry** — F1 forwards a
  now-settled replay WITHOUT re-charging. If the buyer never retries, the on-chain payment is
  final (F3 settle-final). **NO auto-refund.**
- Tests: `reconcile.test.ts` (x402+flipped+data → credits dev+tool in one txn; circle-nano → no
  credit; flip-lost → no credit; missing accountId → no db credit, flagged; no toolId → dev
  credited, tool stat skipped).

### F3 — HIGH: settle-then-upstream-fail / swallowed billing error  ✅ FIXED (alerts; documented tradeoff; NO auto-refund)
- `app/api/proxy/[slug]/route.ts` `forwardAndBill` — new `options.irreversibleOnChain` (set on a
  FRESH x402 settle; never on a replay). Emits distinct, alertable signals on the loss branches:
  - upstream unreachable/timeout after settle → `proxy.onchain_settled_upstream_failed`;
  - upstream non-2xx after settle → `proxy.onchain_settled_upstream_failed`;
  - the billing UPDATE throws → `proxy.onchain_credit_lost_after_settle` (**stops swallowing** —
    the generic `*_billing_update_error` log is no longer the only signal).
  Each carries `txHash` (paymentId), `payer`, `costCents`, `upstreamStatus`. Reversible/prepaid
  rails leave `irreversibleOnChain` false → unchanged (an upstream failure there costs nothing).
- **NO auto-refund** — a new irreversible on-chain money path needs its own audit. Disclosed as
  accepted-risk DEBT with the refund runbook below.
- Tests: `x402-proxy-settlement.test.ts` (5xx-after-settle → no credit + the alert; billing-throw
  → the credit-lost alert, buyer still served 200).

### F6 — MED: no dev-balance reconciliation control  📄 DOCUMENTED (deferred; see runbook)
Not code-changed in this chunk (shared, prod-exposed via `/api/settlement/reconcile`, 5 dedicated
`settlement-moat.test.ts` tests; the seal-audit classified it defer-post-go-live / do-not-block).
See "F6 operator runbook" below. **Already-live note:** circle-nano (live) writes single-sided
settlement-credit rows, so `verifyLedgerIntegrity` (which sums ALL `ledger_entries` debits-vs-credits
with no `settlement_status` filter) will report `balanced:false` on the operator endpoint — a
**reporting artifact, NOT corruption**; payout balances are correct.

---

## Runbooks

### F3 — manual off-band refund runbook (on a loss alert)
A `proxy.onchain_settled_upstream_failed` alert means: USDC settled on-chain (irreversible) but the
tool was NOT delivered → the payer is owed a refund (no auto-refund by design).
1. Take `txHash` + `payer` + `costCents` from the alert payload.
2. Confirm on-chain: the `Transfer(payer → SETTLEGRID_PAYMENT_ADDRESS, value)` for that `txHash`.
3. **First, tell the payer they can simply re-send the SAME x402 authorization** — the idempotent
   replay (F1) delivers the tool result WITHOUT a second charge (`alreadySettled` → forward, skip
   credit). This is the preferred resolution; no money movement needed.
4. Only if the payer cannot/should not retry: refund `costCents` of USDC off-band from the platform
   payee wallet to `payer`, referencing `txHash`.

A `proxy.onchain_credit_lost_after_settle` alert means: settled + delivered, but the dev-balance/
tool-revenue UPDATE failed → the dev is owed `costCents`. Manually credit `developers.balanceCents`
(and `tools.totalRevenueCents`) for the developer owning the tool, referencing `txHash` + `payer`.

### F6 — operator runbook (ledger-integrity false alarm)
When `/api/settlement/reconcile` (or `verifyLedgerIntegrity`) reports `balanced:false`:
1. It sums ALL `ledger_entries` without the documented `settlement_status IS NULL` filter, so
   single-sided settlement rows (`settlement_status IS NOT NULL`, written `entryType:'credit'`)
   inflate `totalCredits`. This is EXPECTED once any x402/circle-nano settlement row exists.
2. Re-run the debit=credit sum with `WHERE settlement_status IS NULL` (the true double-entry rows).
   If that is balanced, the original imbalance == the sum of settlement-row credits → **not
   corruption**, the known F6 artifact.
3. Real corruption = an imbalance among the `settlement_status IS NULL` rows. Escalate that.

---

## Re-proof + audit status
- **Base-Sepolia re-proof NOT required for these fixes:** the on-chain settle path
  (`submitCircleNanoOnChain` / `confirmCircleNanoTx` / the verifier / the guarded flip) is
  **byte-unchanged**. F1 adds a return flag + proxy credit-gating; F2 rejects before settle; F4
  changes the reconciler (off the live settle path); F3 adds alerts + billing-error surfacing. The
  proxy/reconciler layers that changed are covered by the new mocked integration + unit tests, which
  is the correct gate here (the orchestrator's money mechanics were already Sepolia-proven 2026-06-01).
- **Mandatory re-audit — ✅ PASSED (verdict SEAL, 2026-06-01).** Independent fresh-context multi-agent
  re-audit (4 dimension finders × 2-lens adversarial verify × guarded synthesis): **0 blocking findings**
  (no HIGH+/fix-before-go-live defect survived). It independently re-derived the exactly-once-credit
  invariant (`markSettlementSettled` is the sole guarded `'settled'` writer → exactly one flip-winner;
  proxy credits iff `!alreadySettled`, reconciler iff it flipped; they can never both credit; credit
  implies a confirmed receipt). Accepted tradeoffs (documented above): replay service-amplification;
  non-atomic reconciler credit (loudly alerted); F6 reporting artifact; gross-credit/`takeBps:0`.
  Deferred (non-gating): **circle-nano F1/F3/F4 own-chunk re-review** (LIVE on mainnet, shares the code);
  the pre-existing reverted+nonce-consumed dropped-credit edge (byte-identical in `HEAD~1`); a reconciler
  `totalInvocations` metric gap. Its one recommended hardening — a direct unit test of the F2 prod
  hard-pin — was applied (`env.test.ts`: prod + flag-ON → testnet REJECTED).

## Carried / deferred (NOT in this chunk)
- **circle-nano shares `forwardAndBill` + the reconciler** → the F1 (replay double-credit) and F3
  (settle-then-fail) gaps very likely exist on its proxy path too, and the F4 reconciler-credit is
  intentionally x402-only here. circle-nano is LIVE on Base mainnet → **re-review circle-nano against
  F1/F3/F4 as its own scoped chunk + audit.** (circle-nano DOES credit on its in-request proxy path
  via `handleProtocolProxy → forwardAndBill`; the gap is the async/reconciler path + replay.)
- **F6 proper fix (deferred):** apply `settlement_status IS NULL` to `verifyLedgerIntegrity` +
  `computeBalanceFromLedger` (match the documented contract; update the 5 `settlement-moat.test.ts`
  cases) AND add a per-developer `developers.balanceCents` ⇄ settled-inflow detective job + alert
  (NEW reconciliation control — own design/audit).
- **F1 replay re-forwards upstream:** an honest SDK retry is re-delivered (no re-charge), but a
  malicious payer can replay one paid authorization for many free upstream calls (service
  amplification, NOT a double-credit). Bounded to one tool + one paid nonce. Mitigate later with
  replay throttling or response caching if abuse appears.
- Carried A2/B1: `takeBps:0`; `accountId = developerId` stand-in; move the platform payee off the
  hot gas wallet; `maxDuration=90` assumes a Pro plan.
