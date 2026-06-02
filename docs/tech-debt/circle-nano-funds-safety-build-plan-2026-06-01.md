# circle-nano funds-safety BUILD PLAN (2026-06-01)

> Surgical/additive build plan for the circle-nano funds-safety parity chunk. Rests on the
> verified trace (`circle-nano-funds-safety-trace-2026-06-01.md`) and the founder's Step-0
> decisions. Reference implementation to mirror: the sealed x402 fixes
> (`x402-seal-audit-fixes-2026-06-01.md`) + `handleX402Proxy` on `main`.
>
> **PRE-BUILD AUDIT — round 1 (wf_5f5c3c00-8e5): PLAN_NEEDS_FIXES.** 13/13 §7 assumptions verified
> TRUE; exactly-once holds across all 3 credit-sites; dedicated `handleCircleNanoProxy` confirmed
> correctly-scoped; both HIGH candidates refuted; NO under-scoped funds gap, NO over-scoped new money
> movement. 1 blocking (Part A gate-alignment over-scope) + 6 improvements — ALL APPLIED (⮑ markers).
>
> **PRE-BUILD AUDIT — round 2 (wf_bee56c2b-09b): PLAN_NEEDS_FIXES.** All 14 assumptions re-verified
> TRUE; design re-confirmed correct + to-spec + exactly-once + correctly-scoped (NO funds/correctness/
> scope defect). The one blocking + 4 improvements are **test-contract mechanics** (the plan-as-contract
> must enumerate the test edits its own changes force, so a literal follow yields a GREEN suite) — ALL
> APPLIED in this revision (⮑R2 markers).
>
> **PRE-BUILD AUDIT — round 3 (wf_6e1c3724-4c9): ✅ PLAN_READY (0 blocking) — GATE CLEARED.** All 14
> assumptions re-verified TRUE; exactly-once sound across all 3 credit-sites; Phase-1 dark-gate +
> dedicated handler + F2 pin confirmed correctly-scoped; both HIGH candidates refuted. 5 clarity-only
> build-notes (none gating): (i) `settle.test.ts:187/224` use `toEqual` EXACT → add `alreadySettled:true`
> to those two (fresh-flip :213 stays green); (ii) in `route.test.ts` mock `creditSettlement` as a
> `vi.fn()` (the `ACTIVE_TOOL` fixture has no `id`); (iii) `e2e-smoke.test.ts` is UNAFFECTED (its mock
> tool row has no `developerId` → free path, never credits); (iv) all test paths are under `__tests__/`;
> (v) `billing-credits.test.ts` counts `GROSS_WRITER_PATTERN` by role — keep count==5 via the shared
> `forwardAndBill` writer (the cited line numbers may drift; the count is the contract).

## 1. Problem (verified) + founder Step-0 decisions

circle-nano has TWO disjoint surfaces; neither does both collect-on-chain AND credit-the-dev
(x402 post-fix does both on the proxy). Payouts draw on `developers.balanceCents` only
(`processPayout`). Therefore:
- **Proxy** (`/api/proxy/[slug]` + `x-circle-nano-auth`): offline-verify → `forwardAndBill`
  CREDITS `balanceCents`, **never settles on-chain** → PHANTOM CREDIT. **LIVE in prod** (b1.1 doc).
- **Kernel `/settle`** (SDK kernel → `/api/circle-nano/settle`): settles on-chain + writes/flips
  the ledger row, **never credits `balanceCents`** → dev unpayable.

**Founder Step-0 (2026-06-01):** Q1 = proxy is LIVE in prod. Q2 = **dark-gate first, then
settle-in-path** (mirror `handleX402Proxy`). Q3 = credit on the `/settle` in-request flip +
reconciler widen for the async tail.

## 2. The exactly-once invariant (the spine all credit-sites preserve)

**A credit fires exactly once, iff THIS actor flips the settlement row `pending→settled`.** The
flip is the single guarded `UPDATE … WHERE settlement_status='pending'` (`markSettlementSettled`,
ledger.ts:539) → exactly one flip-winner per `operation_id` (= `circle-nano:network:from:nonce`).
After Phase 2 there are three credit-sites; each gates on its own flip, so the SAME authorization
can never double-credit across surfaces:
- **Proxy** (`handleCircleNanoProxy`): `forwardAndBill` credits iff `!skipCredit`; `skipCredit` is
  set from `outcome.alreadySettled` (replay / concurrent-loser → did NOT flip → no credit).
- **Kernel `/settle`**: credits iff `outcome.alreadySettled === false` (this call flipped fresh).
- **Reconciler**: credits iff `markSettlementSettled` returns `flipped === true` (it flipped the tail).

A replay/idempotent-hit returns `alreadySettled` and never re-credits anywhere. If the same
authorization is used on BOTH surfaces (pathological), the second is an idempotent-hit (existing
`settled` row) → `alreadySettled` → no second credit. ✔ exactly-once holds cross-surface.
*(Pre-build audit independently re-derived + confirmed this.)*

---

## 3. PHASE 1 — dark-gate (Commit 1, immediately pushable)

**Goal:** stop the proxy crediting PAID circle-nano without collecting on-chain. Minimal, scoped to
circle-nano, leaves every other protocol + free circle-nano calls byte-unchanged.

**Change — `apps/web/src/app/api/proxy/[slug]/route.ts`, the `else if (protocol === 'circle-nano')`
branch of `handleProtocolProxy` (currently ~2141-2160):** after the existing offline-verify
succeeds, before falling through to the shared `forwardAndBill` (2219), add a guard:

```ts
// DARK-GATE (funds-safety 2026-06-01): the direct-proxy circle-nano path verifies the EIP-3009
// authorization OFFLINE but does NOT settle it on-chain, so crediting here credits a withdrawable
// balance (payouts draw on it) for USDC that is never collected — a phantom credit. Reject PAID
// circle-nano on the direct proxy until it settles in-path (Phase 2). Free calls move no money and
// pass unchanged. PROXY-ONLY — the kernel /api/circle-nano/settle path is unaffected.
if (costCents > 0) {
  logger.warn('proxy.circle_nano_proxy_settlement_unavailable', { slug, requestId })
  return errorResponse(
    'Circle Nanopayment settlement is not available on the direct proxy. Use the SettleGrid SDK kernel, which settles on-chain.',
    503, 'CIRCLE_NANO_PROXY_SETTLEMENT_UNAVAILABLE', requestId,
  )
}
```

- 503 (not 402): the auth is valid; the SERVER cannot currently accept it via this surface
  (honest; the auth nonce is unspent so the consumer can use the SDK). No forward, no credit.
- Free calls (`costCents <= 0`) still forward (`forwardAndBill` credits 0 → no phantom).

**Tests (Phase 1):**
- `proxy` integration test: a PAID circle-nano proxy request (valid auth) → 503
  `CIRCLE_NANO_PROXY_SETTLEMENT_UNAVAILABLE`, asserts NO `developers.balanceCents` /
  `tools.totalRevenueCents` update and NO upstream forward.
- A FREE circle-nano proxy request → still forwards (unchanged).
- ⮑ **(improvement #5)** No existing test to flip: the pre-build audit confirmed NO proxy
  integration test drives a paid `x-circle-nano-auth` POST to a `balanceCents`-credit assertion (the
  circle-nano refs in `proxy-equivalence`/`unified-dispatch` are detection-only). So just **ADD** the
  new 503 test — do not hunt for a paid-credit assertion to change.

**Verify + commit:** tsc 0 · full vitest (baseline 4206/1 pre-existing) · eslint 0 · next build 0.
Commit 1 path-scoped to `route.ts` + the new test. Founder may push it immediately.

---

## 4. PHASE 2 — settle-in-path parity + kernel credit + reconciler (Commit 2)

Removes the Phase-1 dark-gate (relocates circle-nano off `handleProtocolProxy`) and makes both
surfaces collect-AND-credit, mirroring the sealed x402 design.

### Part A — proxy settles on-chain in-path (mirror `handleX402Proxy`)

**Design decision (pre-build audit CONFIRMED correctly-scoped, not churn):** add a dedicated
`handleCircleNanoProxy` that mirrors `handleX402Proxy`, and route circle-nano to it — rather than
threading on-chain settle + conditional `forwardAndBill` options through the generic
`handleProtocolProxy` (shared by 6 forward-only protocols). Rationale: isolates the money path,
mirrors the proven+sealed x402 handler structure, removes circle-nano's coupling to the generic
handler.

⮑ **(blocking fix b) `route.ts` dispatch — REROUTE ONLY; leave the enable gates UNCHANGED.**
circle-nano reaches `handleProtocolProxy` from TWO call sites: the **unified-dispatch switch CASE**
(route.ts:387, no gate there) and the **legacy chain** (route.ts:475, gated by the
`isCircleNanoEnabled()` check at 474). **Reroute BOTH** to `handleCircleNanoProxy(request, slug,
requestId, startTime)`. (Verify the exact dispatch structure by reading route.ts:320-530 at build;
function declarations are hoisted, so the new handler can be defined near `handleX402Proxy` ~1921 and
called from 387/475.) **Do NOT touch the enable gates** — `isCircleNanoEnabled` (`CIRCLE_NANO_API_KEY`)
lives at the `enabledMap` (route.ts:333 — the gate the LIVE unified path consults via
`_unified-dispatch.ts:130`) AND the legacy-chain condition (route.ts:474). The B1.1 enable-gate-split
(`CIRCLE_NANO_API_KEY` vs recipient) is **orthogonal debt, OUT OF SCOPE here**: aligning it would
have to touch 333 + 474 + the `proxy-equivalence.test.ts` synthetic-map replica (170) + its
`SETTLEGRID_USDC_RECIPIENT=''` stub (274) in lockstep or silently drift (the test feeds a synthetic
`enabledMap`, so a gate edit isn't test-caught) — churn unrelated to the phantom-credit fix.
**The funds-safety money boundary is `handleCircleNanoProxy`'s OWN internal `isCircleNanoKernelEnabled()`
503 gate (step 2 below)** — it closes the hole regardless of the dispatch gate, and
`validateCircleNanoCredentialString` is itself recipient-gated (circle-nano-proxy.ts:71-88). Prod has
both envs set → no prod behavior change.

- **Remove** the `else if (protocol === 'circle-nano')` branch from `handleProtocolProxy` (incl. the
  Phase-1 guard) and drop `'circle-nano'` from its `protocol` union type. Leaves the other 6
  protocols byte-unchanged.
- ⮑R2 **New imports in `route.ts`** for the handler: `parseCircleNanoProof` (`@settlegrid/mcp`),
  `executeCircleNanoSettlement` + `circleNanoOperationId` (`@/lib/settlement/circle-nano/settle`),
  `isCircleNanoKernelEnabled` (`@/lib/env`). `X402_MAINNET_NETWORK` + `isX402TestnetSettlementAllowed`
  are already imported (route.ts:42/44); the `isCircleNanoEnabled` import (route.ts:31) stays (the
  dispatch gates still use it).
- **New `handleCircleNanoProxy`** (mirror `handleX402Proxy` lines 1779-1921):
  1. `lookupToolBySlug`; `costCents = getCostCents(...)`.
  2. Dark-gate: if `!isCircleNanoKernelEnabled()` → 503 `CIRCLE_NANO_NOT_CONFIGURED`. **(money boundary)**
  3. Offline-validate via `validateCircleNanoCredentialString(header, toolConfig)`; invalid → 402
     (`generateCircleNano402Response`).
  4. Free op (`costCents <= 0`): `forwardAndBill(..., 'circle-nano', ..., undefined, payerAddress,
     {}, {...}, /* no options */)` — no settlement (mirror x402 1843-1851).
  5. Paid op: `parseCircleNanoProof(header)`; unparseable → 402 `CIRCLE_NANO_AUTH_INVALID`.
  6. **F2 network-pin (Part D):** if `proof.network !== X402_MAINNET_NETWORK` and
     `!isX402TestnetSettlementAllowed()` → 402 `CIRCLE_NANO_NETWORK_UNSUPPORTED`.
  7. `outcome = await executeCircleNanoSettlement({ proof, costCents, accountId: toolRow.developerId,
     toolId: toolRow.id, toolSlug, method: \`proxy:${request.method}\`, latencyMs: Date.now()-startTime })`.
  8. `outcome.status !== 'settled'` → return the structured error (`outcome.code` / `reason` /
     `httpStatus`); no forward, no credit.
  9. `isReplay = outcome.alreadySettled === true`; `forwardAndBill(..., 'circle-nano', ...,
     outcome.txHash, proof.authorization.from, { 'X-SettleGrid-Tx-Hash': outcome.txHash },
     { network: proof.network, ... , ...(isReplay ? { replay: true } : {}) },
     isReplay ? { skipCredit: true } : { irreversibleOnChain: true })` — credits on a fresh flip,
     skips on a replay, gets F3 loss-alerts on a fresh irreversible settle (all already in
     `forwardAndBill`). `maxDuration=90` on the route already covers the in-path receipt wait.
- ⮑R2 ⚠️ **`billing-credits.test.ts` GROSS-writer guard:** that test asserts EXACTLY 5
  `balanceCents: sql` writers in route.ts (695/962/1357/1697/2406). `handleCircleNanoProxy` MUST credit
  via the shared `forwardAndBill` (the existing 1697 `actualCost` writer) — do NOT inline a new
  `balanceCents` write in the handler (count→6 would fail the guard).

### Part B — `executeCircleNanoSettlement` gains `toolId` + `alreadySettled` (mirror x402 orchestrate)

`apps/web/src/lib/settlement/circle-nano/settle.ts`:
- `ExecuteCircleNanoSettlementParams` += `toolId: string`.
- `CircleNanoSettlementOutcome` settled variant += `alreadySettled?: true`.
- `ensurePendingRow`: store `toolId` in the metadata object (settle.ts ~91-101) — JSONB, **no schema
  migration** (mirror x402 F4).
- Set `alreadySettled: true` on the two non-flip-winner settled returns: the idempotent-hit
  (settle.ts ~188) and the concurrent-loser in `applyOutcome` (`!flipped`, ~117-118). The fresh-flip
  return (~121) stays unflagged. **On-chain mechanics byte-unchanged** (these are return-value flags
  off the submit/receipt path).

### Part C — kernel `/settle` credits on the fresh flip

`apps/web/src/app/api/circle-nano/settle/route.ts`:
- Add `id: tools.id` to the tool select (currently 99-109).
- Pass `toolId: toolRow.id` into `executeCircleNanoSettlement` (157-164).
- F2 network-pin (Part D) BEFORE settle (the route currently has none — once we credit, a Sepolia
  payload in a prod deploy would credit real balance for free testnet USDC).
- ⮑ **(improvements #2 + #4)** The credit lives **INSIDE the existing
  `if (costCents > 0 && toolRow.developerId && parsedProof)` block** (settle/route.ts:156-200, the
  only place an `outcome` exists) — **NOT** after both settled returns; the free/unattributable return
  (205-221) must NEVER credit. On `outcome.status === 'settled' && outcome.alreadySettled !== true`,
  credit via the shared `creditSettlement({ developerId: toolRow.developerId, toolId: toolRow.id,
  amountCents: costCents, operationId: circleNanoOperationId(parsedProof) })`. Use the **STABLE**
  `circleNanoOperationId(parsedProof)` (= the `operation_id` column value) for the helper's
  `operationId` — NOT the route's `randomUUID()` SettlementResult id (settle/route.ts:180) — so the
  `credit_failed` / `credit_missing_toolid` alerts are reconcilable against the ledger row the
  reconciler logs by `operationId`.

### Part C2 — shared credit helper + reconciler widen

`apps/web/src/lib/settlement/reconcile.ts`:
- Refactor `creditReconciledX402Settlement` into a rail-agnostic `creditSettlement({ developerId,
  toolId, amountCents, operationId })` (credit `developers.balanceCents` + `tools.totalRevenueCents`
  in one `db.transaction`). Used by BOTH the reconciler tail AND kernel `/settle` (Part C). The
  reconciler passes the row's `operationId`/`accountId`/`metadata.toolId`/`amountCents`; `/settle`
  passes them directly. ⮑R2 **EXPORT** `creditSettlement` — the legacy `creditReconciledX402Settlement`
  (reconcile.ts:185) is module-PRIVATE; `/settle` is a different module → it must be exported or tsc fails.
- Widen the reconciler credit gate (reconcile.ts:121) from `rail === 'x402'` to `rail === 'x402' ||
  rail === 'circle-nano'`; update the x402-only deferral comment (174-177). circle-nano rows now
  carry `metadata.toolId` (Part B), so the tail credit works.
- ⮑ **(improvement #6)** RENAME the x402-named alert keys to rail-agnostic so a circle-nano row never
  emits an `'x402'`-named alert: `reconcile.x402_credit_failed` → `settlement.credit_failed`;
  `reconcile.x402_credit_missing_toolid` → `settlement.credit_missing_toolid`;
  `reconcile.x402_credited` → `settlement.credited`; `reconcile.x402_credit_skipped_no_data` →
  `settlement.credit_skipped_no_data` (reconcile.ts ~191/220/222/224). (Legacy live-A2 circle-nano
  pending rows lack `metadata.toolId`, so on the async tail the dev IS credited but the per-tool stat
  is skipped + the missing-toolid alert fires — benign; the rename keeps it correctly labeled.)

### Part D — F2 network-pin (shared, REUSE x402)

⮑ **(improvement #3)** **REUSE the existing x402 `X402_MAINNET_NETWORK` (env.ts:190) +
`isX402TestnetSettlementAllowed()` (env.ts:202-203) DIRECTLY** on both circle-nano surfaces — single
source of truth; both rails are Base USDC and `CIRCLE_NANO_402_NETWORK` is already `eip155:8453`
(pre-build audit confirmed). **No new env var.** The pin MUST preserve x402's prod-hard-pin semantics:
`isX402TestnetSettlementAllowed()` is `SETTLEGRID_X402_ALLOW_TESTNET==='true' && !isProduction()`, so
production can NEVER be re-opened to testnet by a stray flag — copy that guard, not just the raw flag.
Applied in Part A step 6 (proxy) and Part C (kernel `/settle`).

### Phase 2 tests
- `settle.test.ts`: idempotent-hit + concurrent-loser return `alreadySettled`; fresh flip does not;
  `ensurePendingRow` stores `toolId`.
- New `handleCircleNanoProxy` integration tests (drive the exported `POST`, NOT a direct handler
  export — route files may only export HTTP verbs + Next config): settled→single gross credit +
  `X-SettleGrid-Tx-Hash`; not-settled→no forward/credit; replay (`alreadySettled`)→forwarded, NOT
  re-credited; 5xx-after-settle→no credit + `proxy.onchain_settled_upstream_failed`; testnet payload
  in prod→`CIRCLE_NANO_NETWORK_UNSUPPORTED`, settle never attempted.
- `circle-nano/settle/route` test (`route.test.ts`): ⮑R2 the existing mocks (~lines 35-57) don't mock
  `@/lib/settlement/reconcile` and `mockDb` has no `transaction`, and the settled-case mocks return no
  `alreadySettled` → Part C's credit would throw on the existing settled cases (~201/213). So **mock
  `creditSettlement`** (or add a `transaction` stub to `mockDb`) AND add `alreadySettled:true` to the
  no-credit-case mocks. Assertions: settled (fresh flip)→credits dev+tool once; `alreadySettled`→no
  credit; free/unattributable→no credit; testnet-in-prod→rejected pre-settle.
- `reconcile.test.ts`: ⮑R2 **(blocking)** REWRITE the EXISTING circle-nano negative case at
  reconcile.test.ts:205-214 (`'circle-nano settled + flipped → NO credit here …'`, which asserts
  `mockDb.transaction` not-called) → INVERT it to assert credit-once, mirroring the x402 positive case
  at 183-195 (dev THEN tool in one txn; amountCents 50 into both sql interpolations) — Part C2's widen
  now credits circle-nano, so the old assertion WILL fail. RELABEL the describe at reconcile.test.ts:173
  to drop 'x402 only' (rail-agnostic). Plus: circle-nano flip-LOST → no credit; missing toolId → dev
  credited, tool stat skipped + `settlement.credit_missing_toolid`; the existing x402 cases still pass
  under the renamed alerts + shared helper.

---

## 5. Metadata / migration

- `toolId` is stored in the existing JSONB `metadata` column → **NO schema migration** (mirror the
  x402 F4 fix). The `operation_id` index (`drizzle/0010`) already exists in prod (A2 go-live).
- No new columns, no new tables, no new env var (Part D reuses x402's).

## 6. Verification + re-proof

- Gates (handoff §9): tsc 0 · full `vitest` (baseline 4206 pass / 1 pre-existing fail
  `processDataDeletion`) · eslint 0 · next build 0. **No `packages/mcp` change** (viem is apps/web
  only; the adapter/SDK are untouched) → no SDK rebuild, no mcp suite. *(Confirm during build that no
  packages/mcp edit creeps in.)*
- **Base-Sepolia re-proof:** `executeCircleNanoSettlement`'s on-chain mechanics (engine + verifier +
  guarded flip) stay byte-stable — Part B adds only off-path return flags + a metadata field. Per the
  x402-SEAL precedent ("no re-proof when the on-chain settle path is byte-unchanged; mocked
  integration tests are the correct gate"), a full Sepolia re-proof is **not strictly required**.
  The founder's Step-0 choice expects a Sepolia confirmation for the newly-activated proxy settle
  surface → plan an orchestrator-level Sepolia e2e of `executeCircleNanoSettlement` (reuse the A2
  recipe: isolated SSL scratch Postgres, NEVER prod `DATABASE_URL`; re-ground-truth live Sepolia USDC
  constants). The post-build funds-safety panel + founder confirm the exact bar.

## 7. Technical + factual assumptions (pre-build audit verified all 13 below TRUE; #14 added this revision)

1. The circle-nano proxy branch (`handleProtocolProxy`, route.ts ~2141-2160) credits via the shared
   `forwardAndBill` (~2219) with NO `options`; `forwardAndBill` credits `developers.balanceCents` +
   `tools.totalRevenueCents` when `upstreamOk && !skipCredit`. ✓
2. The proxy branch NEVER calls `executeCircleNanoSettlement`; that fn is called ONLY from
   `/api/circle-nano/settle/route.ts:157`. No cron/batch settles proxy-validated authorizations. ✓
3. `executeCircleNanoSettlement` / `/settle` do NOT credit `developers.balanceCents` /
   `tools.totalRevenueCents`. ✓
4. `payouts/process.ts` draws solely on `developers.balanceCents`; never reads `ledger_entries`. ✓
5. Proxy is LIVE in prod (`CIRCLE_NANO_API_KEY` + `SETTLEGRID_USDC_RECIPIENT` both set — b1.1 doc +
   two live facts: mainnet settling ⇒ recipient set; phantom-crediting ⇒ API key set). ⮑
   **(improvement #1)** This is the one assumption resting on live Vercel env, not code → **founder
   confirms the prod env state (`vercel env ls production | grep CIRCLE_NANO`) before pushing either
   commit** (push is founder-gated regardless).
6. `markSettlementSettled` is the sole guarded `WHERE settlement_status='pending'` flip → one winner. ✓
7. `forwardAndBill` already supports `{ skipCredit, irreversibleOnChain }` (route.ts ~1590-1610) +
   emits F3 alerts (`onchain_settled_upstream_failed` / `onchain_credit_lost_after_settle`). ✓
8. x402's orchestrator sets `alreadySettled` (orchestrate.ts 177/294) + stores `toolId` (59/155). ✓
9. `reconcile.ts` credits only `rail === 'x402'` (121), reads `metadata.toolId` (198-202); circle-nano
   pending rows currently store NO `toolId` (settle.ts ~91-101). ✓
10. The proxy route already declares `maxDuration = 90` (route.ts:56). ✓
11. The verifier accepts BOTH `eip155:8453` and `eip155:84532` → F2 pin genuinely required once
    Part B/A credit. ✓
12. circle-nano is an ADVERTISED proxy rail (FAQ; adapter 402 instructs the header flow). ✓
13. No `packages/mcp` change is required (all edits apps/web). ✓
14. ⮑ **(added)** circle-nano reaches `handleProtocolProxy` from route.ts:387 (unified-dispatch switch
    case) + route.ts:475 (legacy chain); Part A reroutes BOTH to `handleCircleNanoProxy` and leaves the
    enable gates UNCHANGED (`enabledMap` route.ts:333 + legacy condition route.ts:474). *(Verify the
    dispatch structure at route.ts:320-530 at build.)*

## 8. Scope guards (over-auditing guard — additive/surgical only)

- **Byte-stable (do NOT rewrite):** the on-chain engine (`settle-engine.ts`), the offline verifier
  (`verify.ts`), the x402 SEAL commits, `forwardAndBill`'s core, `markSettlementSettled`, the payout
  pipeline, `rate-limit.ts`.
- **No new money movement** (no auto-refund). The fix activates the EXISTING on-chain settle on the
  proxy + credits the existing collection — not a new money path.
- **Explicitly OUT OF SCOPE:** the B1.1 enable-gate-split alignment (orthogonal debt — blocking-fix
  b); x402 go-live; Task C (facilitator circuit-breaker); the F6 ledger-integrity reporting artifact;
  the carried A2 debt (`takeBps:0`, `accountId=developerId` stand-in, value-vs-cost, unowned-priced-
  tool) — note but do not fix here (audit confirmed orthogonal to credit-once; credit amount stays
  `costCents` as in the sealed x402 path).
- ⮑R2 ⚠️ **FOUNDER-AWARENESS (operator backfill, NOT a code gate):** any circle-nano kernel `/settle`
  settlements in the ~1-day live window since A2 collected USDC on-chain but never credited the dev are
  now terminal `settled` rows. Part C/C2 does NOT backfill them — the reconciler selects only
  `settlement_status='pending'`, and these are already `settled`. This is an uncredited-revenue DATA gap
  (NOT a platform-loss hole), resolved by a one-time operator credit (sum settled circle-nano ledger
  rows per dev → credit `balanceCents`), founder-decided. Surface to the founder at seal.

## 9. Sequencing + commits (founder-gated push)

- **Commit 1 (Phase 1 dark-gate):** `route.ts` + the new proxy test. Pushable immediately.
- **Commit 2 (Phase 2):** `route.ts` (new handler + reroute dispatch 387/475 + remove the branch),
  `settle.ts`, `reconcile.ts`, `circle-nano/settle/route.ts`, + tests. (env.ts reuses x402's pin — no
  edit unless a shared helper extraction is cleaner.) After tsc/vitest/eslint/build green + the
  post-build funds-safety panel (SEAL) + Sepolia confirm.
- Path-scoped, LOCAL-ONLY, quote bracketed dirs, do NOT touch the x402 SEAL commits. Trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
