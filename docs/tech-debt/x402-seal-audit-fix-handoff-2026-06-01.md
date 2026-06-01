# SettleGrid x402 — seal-audit FIX chunk handoff (2026-06-01)

> **You are picking up SettleGrid's x402 on-chain settlement work.** The chunk is BUILT,
> the orchestrator-level on-chain path is **e2e-PROVEN on Base Sepolia**, and it has been
> **independently seal-audited → verdict DO-NOT-SEAL**. Your chunk: **implement the
> seal-audit fixes + the owed proxy-level integration test + a mandatory independent
> re-audit**, THEN founder-gated go-live (Task B), THEN the gas-budget circuit-breaker
> (Task C). This is **real money** — suggest `/effort max`.

---

## 0. Read first (in order), by ABSOLUTE path

1. **This doc.**
2. **`/Users/lex/settlegrid/docs/tech-debt/x402-onchain-settlement-2026-05-31.md`** — the chunk's
   build detail + the **"Seal-audit findings (2026-06-01)"** section (the authoritative fix list +
   action classes) + the corrected go-live section + the Base-Sepolia e2e reproduction recipe.
3. **`/Users/lex/.claude-3/projects/-Users-lex/memory/settlegrid-handoff-2026-05-31-x402-golive.md`**
   — the canonical thread handoff: DO-NOT-SEAL banner, standing rules, Task B (go-live) + Task C.
4. **`/Users/lex/settlegrid/docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md`** — the
   circle-nano A2 precedent (shares the engine/verifier/forwardAndBill; the same gaps likely exist there).

Standing-rule wikilinks restated inline below, so you're covered if a `[[link]]` doesn't resolve.

---

## 1. Repo state (re-confirm before editing)

```sh
cd /Users/lex/settlegrid
git fetch --no-tags origin
git log -1 --oneline                    # expect e3a56765
git rev-list --count origin/main..HEAD  # expect 4
git status --short                      # expect clean
cd apps/web && npx tsc --noEmit         # expect EXIT 0
```

- Branch `main` @ **`e3a56765`** — **4 ahead of `origin/main cdd2d73a`, NOT pushed** (founder-gated). Tree clean.
  - `75a5fb41` — x402 on-chain settlement chunk (Parts 1–3).
  - `29144821` — facilitator gas-wallet isolation (Part 2b).
  - `019cb2c2` — docs: Base-Sepolia e2e PASS recorded.
  - `e3a56765` — docs: seal-audit DO-NOT-SEAL + corrected go-live causality.

If origin/main moved or HEAD differs, a sibling/founder advanced things — reconcile before editing.

---

## 2. What the chunk does + what's already proven / NOT proven

**Does:** activates the x402 **exact** scheme to settle real USDC on Base in the production proxy
(`handleX402Proxy`), reusing circle-nano's audited EIP-3009 engine + offline verifier. DARK (proxy
503s) until `SETTLEGRID_PAYMENT_ADDRESS` is set in prod. Base-only; exact amount (`value ==
costCents*10000`); payee-bound; idempotency on `(network,from,nonce)`; confirm-before-deliver.

**PROVEN (this session, grounded in real on-chain + DB output):** the **orchestrator** path
`executeX402Settlement` end-to-end on Base Sepolia — real signed EIP-3009 exact auth → `{settled,
txHash}`; USDC moved payer→recipient (receipt Transfer log + block-boundary balance Δ +
`authorizationState=true`); `settled` ledger row + txHash; idempotent replay = same txHash, no 2nd
on-chain charge; wrong-amount/payee/non-Base rejected offline. Settled txs: `0xcc78bf28…`,
`0x9d7db3de…`, `0x290f4ea0…`. Live Sepolia USDC constants re-ground-truthed.

**NOT proven (your gap to close):** the **production proxy wrapper** `handleX402Proxy` →
`forwardAndBill` on a **settled** outcome is exercised by **NO running test**. That wrapper is where
billing/crediting/forwarding live, and where the seal-audit found the holes.

---

## 3. 🔴 LIVE PROD EXPOSURE (verified against `cdd2d73a`) — context for go-live

The OLD code live in prod **right now** has a structural-accept free-credit/free-service hole:
`isX402Enabled()` is true in prod (gated by `SETTLEGRID_GAS_WALLET_KEY`, which is set;
**independent of `SETTLEGRID_PAYMENT_ADDRESS`**, which is unset). OLD `validateX402Payment` with no
facilitator returns `valid:true` on a **structurally-valid but NOT on-chain-verified** payload (any
`0x`-prefixed "signature", fabricated `value ≥ cost`, valid time window) → `forwardAndBill` forwards
the tool call **and credits `developers.balanceCents`** (the payout source) with **zero USDC**. The
`payTo=ZERO_ADDRESS` advertised when `PAYMENT_ADDRESS` is unset only deters an *honest* payer; it
does not stop a fabricated payload. **Unexploited** (prior prod query: 0 historical x402 rows) but
open. **Pushing `main` CLOSES it** (the new dark-gate 503s x402 until `PAYMENT_ADDRESS` is set, and
real on-chain settlement replaces structural-accept). The dark-gate is currently the SOLE control
preventing live loss for the new code.

**Founder options (their call — never push/set prod env yourself):**
- **(A) Conservative:** land the fixes below → push → set `PAYMENT_ADDRESS`.
- **(B) Expedited-safety:** push `e3a56765` NOW to go dark (closes the live hole; x402→503; the
  buggy settle path is unreachable while `PAYMENT_ADDRESS` is unset) → fix → re-audit → set
  `PAYMENT_ADDRESS` later.

---

## 4. YOUR CHUNK — the fixes (authoritative specs in the tech-debt doc's "Seal-audit findings")

All fixes are **additive/surgical** by design — **do NOT rewrite or refactor the e2e-proven
orchestrator/engine/verifier or the shared circle-nano code.** Line numbers are @ `e3a56765` —
verify before editing; prefer the named functions (lines drift).

### F1 — CRITICAL: proxy replay double-credit → proxy-layer idempotency (fix-before-go-live, low regression)
A replayed identical x402 authorization hits the orchestrator's idempotent-hit (returns `settled`,
no 2nd on-chain charge) but `handleX402Proxy` still re-runs `forwardAndBill` → **re-credits
`developers.balanceCents` + re-delivers** for ONE on-chain receipt. Trivially triggered by an SDK
auto-retry.
- **Anchors:** `apps/web/src/lib/settlement/x402/orchestrate.ts:266-270` (idempotent-hit returns the
  SAME `{status:'settled', txHash}` shape); `apps/web/src/app/api/proxy/[slug]/route.ts:1817` (sole
  gate is `status!=='settled'`) → `:1822-1828` (unconditional `forwardAndBill`) → `:1647-1660`
  (`balanceCents += actualCost`, no dedup); `recordProtocolInvocation` is a bare insert
  (`route.ts:~1534`); `invocations` has only non-unique indexes (`schema.ts`).
- **Fix:** make the credit idempotent on the **on-chain settlement identity** (operationId =
  `x402:<network>:<from>:<nonce>`), NOT on `outcome.status`. Surgical: have the orchestrator's
  idempotent-hit branch return a distinguishable shape (add `alreadySettled: true` to
  `X402SettlementOutcome`); in `handleX402Proxy`, on `alreadySettled` **still forward** the upstream
  response (the buyer paid once) but **SKIP** the `balanceCents`/`totalRevenueCents` credit and tag
  the invocation as a non-billed replay. Leaves the proven settle path byte-unchanged.

### F2 — HIGH (headline-critical): testnet-USDC settles on a mainnet deploy → prod network-pin (fix-before-go-live, low regression)
`SUPPORTED_CHAINS`/`USDC_EIP712_DOMAINS`/`USDC_ADDRESSES` include Base Sepolia (`eip155:84532`); the
proxy path has **no mainnet gate** (the dark-gate is network-agnostic). On a mainnet deploy a
Sepolia-network payload settles with **free testnet USDC** → **real withdrawable** dev credit. (The
402 advertises only `eip155:8453` — advertised ≠ enforced.)
- **Anchors:** `circle-nano/verify.ts:39-45`; `circle-nano/settle-engine.ts:37-40,116-118`;
  `x402/types.ts:16-20`; no gate in `route.ts` (after `parseX402ExactPayload` ~`:1795`, before
  `executeX402Settlement` ~`:1808`) or `orchestrate.ts:243-263`; `env.ts:179-181` (dark-gate is
  network-agnostic); `packages/mcp/src/adapters/x402.ts:~588` (advertises `eip155:8453`).
- **Fix:** env-driven network allowlist gate in `handleX402Proxy` after parse, before settle: reject
  `exactPayload.network !== 'eip155:8453'` in production with a 402 `X402_NETWORK_UNSUPPORTED`
  (testnet allowed only behind an explicit flag that is OFF in prod). Additive. Keep the prod gas
  wallet key distinct from any test key.

### F4 — HIGH: reconciler-confirmed settles never credit the dev (fix-before-go-live, MEDIUM regression)
The B1.4 reconciler flips `pending→settled` but **never writes `developers.balanceCents` /
`tools.totalRevenueCents`**; the proxy already returned `pending` (no `forwardAndBill`). So an
async-confirmed settlement (broadcast-then-timeout → reconciler later confirms) = **USDC collected,
dev permanently uncredited.**
- **Anchors:** `apps/web/src/lib/settlement/reconcile.ts:25` (imports only `markSettlement{Settled,
  Failed}`), `:99-104` (settled flip writes only `settlement_status`), `:161-214` (no balance write);
  `orchestrate.ts:183-233` (pending = no-bill); `route.ts:1817-1819` (pending → error).
- **Fix:** in `reconcileOneRow`'s settled case, when `markSettlementSettled` returns `flipped===true`
  (the `WHERE settlement_status='pending'` guard makes the credit fire exactly once, race-safe with
  the live path), credit the dev + tool revenue in the same txn by the row's `amountCents`. Requires
  storing `toolId` in the settlement-row metadata at `ensurePendingRow` (`orchestrate.ts:113-142`;
  it already records method/network/payer at `:130-139`). **Decide + document** the
  broadcast-unconfirmed/nonce-consumed sub-case where upstream was NOT delivered (credit + accept
  payer charged for an undelivered request, OR flag for manual refund). If it can't land pre-go-live,
  at minimum add a reconciliation alert + document as a known go-live gap.

### F3 — HIGH: settle-then-upstream-fail / swallowed billing error (document-as-accepted-tradeoff, NOT a code rewrite)
On-chain USDC settles (`settled` row) but if upstream returns non-2xx — or the billing UPDATE throws
(currently swallowed) — the dev is credited 0, no refund, no compensating entry; the payer is charged
irreversibly. Asymmetric to the prepaid rails (you can't un-charge on-chain). Shared with circle-nano.
- **Anchors:** `route.ts:1808-1815` (settle first), `:1644-1645` (`actualCost = upstreamOk ?
  costCents : 0`), `:1647-1660` (credit gated on `upstreamOk`), `:1661-1663` (billing error
  swallowed/logged); `orchestrate.ts:150-159` (flip before forward).
- **Fix (proportionate, NO auto-refund):** (1) add this as an explicit accepted-risk DEBT item with a
  manual off-band refund runbook (keyed by the settled row's `external_ref` txHash + payer =
  `authorization.from`); (2) emit a distinct **alertable signal** on the loss branches (x402 &&
  `!upstreamOk`; and the billing-UPDATE catch) carrying txHash/payer/costCents/upstreamStatus; (3)
  stop swallowing the billing-UPDATE error for the credit (it's the payout source of truth). An
  automatic on-chain auto-refund is a NEW irreversible money path — needs its own audit; **defer**.

### F6 — MEDIUM: no dev-balance reconciliation control (defer-post-go-live)
`verifyLedgerIntegrity` audits the `accounts` table, not `developers.balanceCents`, and will
mis-report once single-sided settlement rows exist in prod.
- **Anchors:** `apps/web/src/lib/settlement/ledger.ts:220-307` (targets accounts/ledgerEntries),
  `:404-464` (single-sided sentinel credit); `schema.ts` `developers.balanceCents` vs
  `accounts.balanceCents`.
- **Fix:** add a per-developer balance ⇄ settled-inflow detective job + alert AND fix
  `verifyLedgerIntegrity` to apply its promised `settlement_status` filter — OR document as accepted
  go-live debt with an operator runbook. Do not block solely on this medium.

### Owed: proxy-level integration test (currently NOTHING runs `handleX402Proxy`/`forwardAndBill`)
Add a route-level test exercising `handleX402Proxy` on a **settled** outcome (mock the orchestrator
or the engine; the existing `apps/web/src/app/api/proxy/[slug]/__tests__/billing-credits.test.ts` +
`unified-dispatch.test.ts` are the nearest patterns):
- settled → exactly ONE gross dev credit + the `X-SettleGrid-Tx-Hash` header,
- non-settled (402/502/503) → NO forward, NO credit,
- 5xx upstream after settle → NO credit (and the F3 alert fires),
- **replayed header → exactly ONE credit** (the F1 regression test).

---

## 5. MANDATORY re-audit before re-attempting the seal

Per the funds-safety guardrail, after the fixes run the **full 3-part audit chain + an independent
fresh-context funds-safety panel** (the green suite missed all of these — proven this round).

- The seal-audit was a multi-agent workflow (4 dimension finders × 2-lens adversarial verify ×
  guarded synthesis; 35 agents, ~2.6M tokens — **explicit opt-in**). The script (with the
  **over-auditing regression guard** baked into the synthesis spine) is at:
  `/Users/lex/.claude-account2/projects/-Users-lex-settlegrid/6ecd1b15-5930-45cd-a279-bd9d745b9c3a/workflows/scripts/x402-golive-seal-audit-wf_7f6058db-8c5.js`
  Re-invoke with `Workflow({scriptPath: "<that path>"})`. If the path is gone (session-scoped),
  re-author per this design — **and keep the regression guard**: classify each finding
  `fix-before-go-live` / `document-as-accepted-tradeoff` / `defer-post-go-live`; never rewrite
  proven/shared code; never add new money-movement as a go-live fix; don't let finding *volume* or
  low-confidence/doc-nits inflate the verdict (only high-confidence funds-safety/correctness gates it).
- Re-prove on Base Sepolia if you change the settle path: the reproduction recipe is in the tech-debt
  doc §"Base-Sepolia e2e — reproduction recipe". Key gotchas: app `db` forces TLS → scratch Postgres
  needs SSL on; apply BOTH `drizzle/0005_unified_ledger.sql` + `drizzle/0006_ledger_authorization_fields.sql`;
  public Base Sepolia RPC is eventually-consistent → assert from the receipt's Transfer log
  (lag-immune), wrap post-tx chain reads in retry. Throwaway payer key:
  `/Users/lex/.sg-sepolia-test/payer.key` (~19.96 test USDC left); gas wallet
  `0x0859cF704798619133241A385220D6797C635c95` (~0.0002 Sepolia ETH, ~230 txs).

---

## 6. Standing rules / guardrails (load-bearing)

- **Push founder-gated** — do NOT `git push` and do NOT set/change any prod env unprompted. The push
  and the `SETTLEGRID_PAYMENT_ADDRESS` set are the founder's go-live toggles. [[feedback-push-policy]]
- **Mandatory audit chain + independent fresh-context funds-safety panel** for any new substantive
  money-path change. [[feedback-ke2-independent-audit-mandatory]] Re-ground-truth any on-chain
  constant you touch against the LIVE contract (mainnet USDC `name()`/`version()`/`DOMAIN_SEPARATOR()`
  was NOT re-confirmed this session — do it before a mainnet cutover).
- **Over-auditing regression guard** — additive/surgical fixes only; leave proven code byte-unchanged;
  document tradeoffs instead of churning; the audit reports, it does not regress code.
- **npm** not pnpm; vitest node-env; **viem is apps/web only** (`packages/mcp` is zero-crypto);
  rebuild the SDK (`cd packages/mcp && npm run build`) after ANY `packages/mcp` change (e.g. if you
  touch the adapter's advertised network for F2).
- **Path-scoped commits** (`git add -- <explicit paths>`); **quote bracketed dirs**
  (`"apps/web/src/app/api/proxy/[slug]/route.ts"`); re-verify branch+HEAD before committing.
  `git config user.name` is UNSET → commit with
  `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit …`;
  trailer `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`. Commit LOCAL-ONLY.
- **Mask-the-exit trap:** never `cmd | tail` to judge success — use `> log 2>&1; echo $?` then grep.
- Migrations are hand-applied SQL via the Supabase SQL Editor (the drizzle journal is intentionally
  incomplete). The `apps/web/.env.local` DATABASE_URL is **production** — never point test writes at it.
- **Context-degradation standing order** — warn the founder the moment degradation risks
  implementation quality. [[feedback-context-degradation-alert]]

## 7. Verification commands (the green ones)

```sh
cd /Users/lex/settlegrid/packages/mcp && npm run build && npx tsc --noEmit && npx vitest run   # ONLY if you edit packages/mcp
cd /Users/lex/settlegrid/apps/web && npx tsc --noEmit                                           # EXIT 0
npx vitest run                       # full suite: 4184 pass / 1 PRE-EXISTING unrelated fail (processDataDeletion). Run the FULL suite.
npx eslint <changed files>           # 0
npx next build                       # EXIT 0 (before any push)
```

## 8. After the fixes + re-audit pass

- **Task B — founder-gated go-live** (real money). Safe order in the tech-debt doc's go-live section:
  fixes+re-audit → founder reviews commits → **push** (closes the live hole + deploys dark-gate +
  settlement) → verify Vercel healthy → confirm `SETTLEGRID_USDC_RECIPIENT`+`SETTLEGRID_BASE_RPC_URL`
  set + gas wallet funded on Base MAINNET → **then** set `SETTLEGRID_PAYMENT_ADDRESS` (flips LIVE).
- **Task C — fast-follow:** public-facilitator gas-budget circuit-breaker in
  `apps/web/src/lib/settlement/x402/settle.ts` (`settleExactPayment`) + extend the B1.3 gas monitor
  cron to the facilitator wallet. Details in the canonical handoff (Task C) + tech-debt DEBT #1.
- Update the canonical `.claude-3` handoff + this doc when the chunk seals.

## 9. Carried debt (full register in the tech-debt doc)

`takeBps:0` (no platform take); `accountId = developerId` stand-in; `maxDuration=90` assumes a Vercel
Pro plan (if Hobby, in-path receipt waits truncate → more settlements into the reconciler path — fix
F4 matters more); standalone facilitator `upto` verify-beta left honest; circle-nano shares
`forwardAndBill` so F1/F3/F4 gaps likely exist there too (re-review before its own mainnet cutover).
