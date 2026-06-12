# (U) P4 — BUILD PLAN (DRAFT until the pre-build audit returns PLAN_READY): reconciler transport timeout + detector availability (2026-06-11)

> ARC step 2. Companion trace: `p4-transport-trace-2026-06-11.md` (all arithmetic + census there).
> Handoff: `p4-reconciler-transport-handoff-2026-06-11.md`. HEAD `f7a15925`. NO code is written
> until `.audit/u-prebuild/` returns PLAN_READY with 0 blocking findings.
> **R1 audit (`wf_743c7d47`, 7 lenses, 33→16 sustained, 0 dead): PLAN_NEEDS_FIXES — 2 blockers,
> both build-protocol text defects (B1 vacuous-red sequencing of Recipe 5; B2 unsatisfiable :668
> warn assert). Design verified sound (LB-1/LB-2/guarantee all independently re-derived). Both
> blockers + 5 improvements FOLDED into this revision (Recipe 5 batch-3 note, 6-red set, S11-
> successor test, Recipe 2e comment refreshes, gate-5 untracked check, line cites). R2 verdict:
> see `.audit/u-prebuild/R2-VERDICT.md`.**

## The bar (handoff §1, verbatim)
*"No single RPC call can prevent the reconcile run's detectors (`reconcile.pending_overdue`,
`reconcile.uncredited_settled`) from emitting; the reconciler's confirm path degrades to
'unconfirmed' (safe-direction) on timeout; the live settle path's transport and ALL funds
semantics are byte-identical."*

Chosen shape (trace §c): **(a) reconciler-bounded transport + (b-i) detectors-first run order**;
(b-ii) per-row deadline REJECTED (trace §c.2). LB-2 hazard confirmed live at
`settle-engine.ts:285-287` → in-seam fix, fail-pre-fix proven.

## Recipe 1 — `apps/web/src/lib/settlement/circle-nano/settle-engine.ts` (TRANSPORT SEAM ONLY)

**1a. Constants** (immediately after `RECEIPT_TIMEOUT_MS`, :46):
```ts
/**
 * (U) Reconciler-only RPC budget. The reconciler asks "is it mined NOW?" on a 15-min
 * rotation — patience buys nothing there, and unbounded patience starves the run's
 * detectors (the P4 ③-escalation). Worst per call = (RETRY_COUNT+1) × TIMEOUT_MS + 150ms
 * backoff = 6.15s; worst per examination (receipt + reverted-branch nonce read) = 12.3s,
 * inside the 20s tail behind the 40s examination budget (route maxDuration 60s).
 * The LIVE settle paths deliberately keep viem defaults (10s × 3 retries — the buyer is
 * on the line); publicClientFor must stay byte-identical (pinned by
 * transport-isolation.test.ts).
 */
export const RECONCILER_RPC_TIMEOUT_MS = 3_000
export const RECONCILER_RPC_RETRY_COUNT = 1
```

**1b. Bounded twin factory** (immediately after `publicClientFor`, :96-98 — which is NOT edited):
```ts
/** (U) Reconciler-bounded twin of {@link publicClientFor}: same chain + URL resolution,
 * bounded transport. ADDITIVE — the live factory above is byte-identical (LB-1). */
function reconcilerPublicClientFor(network: SupportedNetwork) {
  return createPublicClient({
    chain: SUPPORTED_CHAINS[network],
    transport: http(getBaseRpcUrl(network), {
      timeout: RECONCILER_RPC_TIMEOUT_MS,
      retryCount: RECONCILER_RPC_RETRY_COUNT,
    }),
  })
}
```

**1c. `confirmSettlementTx` client swap** (:262): `publicClientFor(...)` →
`reconcilerPublicClientFor(network as SupportedNetwork)`. (Type note: `interpretReceipt`'s
`publicClient` param is typed `ReturnType<typeof publicClientFor>` — confirmSettlementTx does NOT
call interpretReceipt, so no type ripple; verify with tsc.)

**1d. `SettlementTxConfirmation` unconfirmed branch gains an OPTIONAL discriminant-preserving
field** (:240):
```ts
  /** Not mined yet / dropped / RPC error — leave the row 'pending' and retry next run.
   * (U) reason (optional, additive): 'revert-nonce-unverifiable' = a reverted receipt whose
   * nonce-state recheck failed — incomplete evidence deliberately NOT terminalized (LB-2). */
  | { kind: 'unconfirmed'; txHash: Hex; reason?: 'revert-nonce-unverifiable' }
```
The :269 receipt-unavailable return stays EXACTLY `{ kind: 'unconfirmed', txHash }` (no new field —
keeps every existing `toEqual` pin and the wire shape byte-identical for the common case).

**1e. LB-2 fix — the reverted-branch nonce read** (:276-289, through the reverted return) becomes:
```ts
  let nonceConsumed = false
  if (eip3009) {
    try {
      nonceConsumed = (await publicClient.readContract({
        address: usdcAddress,
        abi: EIP3009_ABI,
        functionName: 'authorizationState',
        args: [eip3009.from, eip3009.nonce],
      })) as boolean
    } catch {
      // (U) LB-2 — the funds trap: a failed nonce-state read after a reverted receipt is
      // INCOMPLETE evidence. Defaulting nonceConsumed:false would let the reconciler
      // CAS-flip 'failed' while a concurrent winner may have moved the USDC (the (T) CAS
      // cannot protect — the ref matches). Safe direction: 'unconfirmed' — the row stays
      // pending and re-examines next rotation with fresh evidence. The no-eip3009 branch
      // is unaffected (no nonce exists to check; the receipt is complete evidence).
      return { kind: 'unconfirmed', txHash, reason: 'revert-nonce-unverifiable' }
    }
  }
  return { kind: 'reverted', txHash, nonceConsumed }
```
NOT touched: `interpretReceipt` (incl. its :306-313 default-false — live path, sealed),
`submitCircleNanoOnChain`, `confirmCircleNanoTx`, `RECEIPT_TIMEOUT_MS`, `SUPPORTED_CHAINS`,
result types other than 1d.

## Recipe 2 — `apps/web/src/lib/settlement/reconcile.ts` (RUN-ORDERING per option b-i)

**2a. Move the two detector blocks BEFORE the window SELECT** (:464), preserving each block's
internal code byte-for-byte EXCEPT the two payload deltas in 2b. New run order inside
`reconcilePendingSettlements`:
1. cutoffs/deadline computation (:448-462 — unchanged, stays first)
2. **(T) uncredited sweep block** (today :612-658 incl. its lead comment — the P1 loss detector
   emits FIRST)
3. **(S) overdue aggregate block** (today :567-610 — comment-inclusive, from the nine-line lead
   comment at :567-575; R2 cite fix)
4. window SELECT (:464-499)
5. examination loop (:501-565, unchanged incl. watermark/budget/deferred)
6. **NEW post-loop classification carrier (2c)**
7. summary return (:660-678, unchanged shape — `overdue`/`uncredited` now carry the pre-loop values)

Mechanics: `let overdue`/`let uncredited` declarations move with their blocks;
`examinedOverdue`/`OVERDUE_CLASS` stay with the loop (declared before it, as today). A leading
block comment records the (U) ordering guarantee: *detector emission happens-before any RPC call
or examination-loop DB write; the aggregates report PRE-run standing-incident state (the more
honest reading per the register escalation note).*

**2b. Two payload deltas inside the moved overdue block:**
- the `reconcile.pending_overdue` payload DROPS `examinedThisRun` (cannot exist pre-loop; carried
  by 2c instead) — all other fields byte-identical;
- `reconcile.overdue_check_failed` payload becomes `{}` (+ err, unchanged) — the S11 intent
  (classification survives an aggregate failure) is now carried strictly better by 2c, which emits
  regardless of aggregate outcome.

**2c. Post-loop classification carrier** (after the loop's watermark-failure block, :559-565):
```ts
  // (U) — the (S) item-4 classification, displaced from the pre-loop alert payload by the
  // detectors-first reorder: classification can only exist AFTER examination. warn (not a
  // page) — the guaranteed pre-loop error line carries the incident; this line names the
  // sticky classes whenever this run examined overdue rows. Emits regardless of the
  // aggregate's own success (supersedes the S11 fallback payload).
  if (Object.values(examinedOverdue).some((n) => n > 0)) {
    logger.warn('reconcile.overdue_examined', { examinedThisRun: examinedOverdue, overdueAfterMs })
  }
```

**2d. The unconfirmed outcome log gains the LB-2 reason passthrough** (:210-213):
```ts
    case 'unconfirmed':
      // Still in mempool / dropped / RPC blip — leave pending, retry next run. (U): reason
      // distinguishes the LB-2 incomplete-revert-evidence case from plain receipt-unavailable.
      logger.info('reconcile.unconfirmed', {
        operationId, rail, txHash: confirmation.txHash,
        reason: confirmation.reason ?? 'receipt-unavailable',
      })
      return 'pending-unconfirmed'
```
**2e. Comment-only refreshes inside the already-licensed file** (R1 audit improvements — zero
behavior delta; comments that become FALSE once (U) ships):
- :454-458 (runBudget comment): "(A single row's in-flight RPC can still overrun … the registered
  follow-up is a reconciler-specific transport timeout)" → rewritten to state the (U) reality (the
  reconciler transport IS bounded — `RECONCILER_RPC_*`; detectors emit pre-loop; the budget now
  guards the SUMMARY's headroom).
- ~:370-376 (`deferred` docstring): "previously a degraded RPC (viem default ~10s × 3 retries per
  row) could blow the 60s budget and Vercel killed the run BEFORE the alert" → updated to note the
  (U) bounded transport + detectors-first ordering (the alert no longer depends on the loop at all).
- :606-609 (the S11 catch comment): "The classification already computed from THIS run's window
  still surfaces here (seal fix S11)" → updated: the classification now surfaces via the post-loop
  `reconcile.overdue_examined` carrier regardless of aggregate outcome; the catch payload is `{}`.

NOT touched: `reconcileOneRow`'s verdict mapping/flips/credit gate, `creditSettlement`, the window
WHERE/ORDER/limit, the loop body, watermark, budget/deferred, `ReconcileSummary` SHAPE, both
aggregates' WHERE/SELECT internals, `emptyOutcomes`, `parseSettlementOperationId`.

## Recipe 3 — `settle-engine.test.ts` (ONE test flipped — the LB-2 fail-pre-fix)
:120-128 becomes (title + expectation):
```ts
  it('reverted but the nonce-recheck RPC throws → unconfirmed (incomplete evidence is never terminalized — LB-2)', async () => {
    mockGetReceipt.mockResolvedValue({ status: 'reverted' })
    mockReadContract.mockRejectedValue(new Error('rpc down'))
    expect(await confirmSettlementTx('eip155:84532', TXH, { from: FROM, nonce: NONCE })).toEqual({
      kind: 'unconfirmed',
      txHash: TXH,
      reason: 'revert-nonce-unverifiable',
    })
  })
```
Red on pre-fix code (returns `reverted{nonceConsumed:false}`) — capture to `.audit/u-build/`.
No other test in the file changes (1d adds no field to the :269 shape; the mocked client factory
ignores the new transport arg).

## Recipe 4 — NEW `circle-nano/__tests__/transport-isolation.test.ts` (the LB-1 pin)
Harness: `vi.mock('viem', ...)` with `http: mockHttp` (arg-capturing, returns a sentinel),
`createPublicClient`/`createWalletClient` returning a stub client
(`readContract` nonce=false/balance=10^12, `waitForTransactionReceipt`/`getTransactionReceipt`
status success, `writeContract` → '0xTX'); `vi.mock('viem/accounts')` as in settle-engine.test.ts;
`SETTLEGRID_GAS_WALLET_KEY` + `SETTLEGRID_BASE_SEPOLIA_RPC_URL='https://rpc.test'` set in
beforeEach (positional URL assert).
The viem factory SPREADS `...await importOriginal()` before overriding http/createPublicClient/
createWalletClient (exact sibling parity with settle-engine.test.ts:20-23 — removes the latent
access-time tripwire on any unmocked viem export). Tests (each drives a real entry point, then
asserts on `mockHttp.mock.calls`):
1. **live submit pin:** `submitCircleNanoOnChain(PROOF)` → EVERY http call (public + wallet
   clients) has `args[0] === 'https://rpc.test'` AND `args.length === 1` (no options — fails if
   live transport options EVER drift; ≥2 calls asserted).
2. **live re-wait pin:** `confirmCircleNanoTx(PROOF, TXH)` → same no-options assert.
3. **reconciler bounded options:** `confirmSettlementTx('eip155:84532', TXH, {from, nonce})` →
   exactly one http call, `args[1]` deep-equals
   `{ timeout: RECONCILER_RPC_TIMEOUT_MS, retryCount: RECONCILER_RPC_RETRY_COUNT }` (imported), AND
   the VALUE pin `RECONCILER_RPC_TIMEOUT_MS === 3_000` / `RECONCILER_RPC_RETRY_COUNT === 1`
   (a silent constant edit is loud). **Red pre-fix** (call has 1 arg) — capture.
4. **seam separation:** after running 1+3 in one test, the live calls remain options-free while the
   reconciler call is bounded (the additive-not-shared proof).

## Recipe 5 — `reconcile.test.ts` (order-dispatch updates + payload-carrier moves)
**⚠ APPLIED IN BATCH 3 ONLY, together with Recipe 2** (R1 audit fix B1): the seq flips and the
carrier asserts encode the POST-fix order/payloads — applied against pre-fix src, the positional
dispatch hands the window SELECT an aggregate shape (`.orderBy` TypeError → ~15 vacuous reds).
reconcile.test.ts is NOT a fail-pre-fix vehicle; the reorder's fail-pre-fix proof lives in the
order-agnostic Recipe 6 file.
- :169 default seq → `['sweep', 'overdue', 'window']`; :496 → `['sweep', 'sample', 'overdue',
  'window']`; :132-142 dispatch comment updated to the new canonical order (sweep → [sample] →
  overdue → window).
- (R2 improvement) the file's OTHER stale-order text goes with it: the :65 hoisted seq init
  `['window','overdue','sweep']` (dead value — beforeEach :169 overwrites; grep-truth only) flips
  to the new order, and the :50-51 "the run's SECOND db.select()" / :56-57 "THIRD"/"a FOURTH
  select" ordinal comments are refreshed to the new canonical order (sweep 1st → [sample] →
  overdue → window LAST).
- :592 test: alert-payload assert for `examinedThisRun` (:614-616) moves to
  `logger.warn('reconcile.overdue_examined', { examinedThisRun: expect.objectContaining({
  nonceConsumed: 1, ... }), overdueAfterMs: 6 * 3_600_000 })`; the pending_overdue payload asserts
  (:611-613, :618-620) stay (minus examinedThisRun).
- :668 test: ONLY the `overdue_check_failed` payload assert becomes `{}` + the test's S11 comment
  (:677-678) refreshed to point at the carrier (R1 fix B2: the previous "ADD warn assert here" was
  unsatisfiable — that test's row is non-overdue with a terminal outcome, so the carrier's nonzero
  guard never fires there).
- NEW test (S11-successor pin, R1 fix B2 option b): *aggregate fails + examined sticky overdue row
  → both signals emit* — one window row with `createdAt` 10h old, `mockConfirm` →
  `{kind:'unconfirmed', txHash: TX}`, `agg.error` set → assert `summary.overdue` null,
  `overdue_check_failed` called with `{}` + Error, AND `logger.warn('reconcile.overdue_examined',
  { examinedThisRun: expect.objectContaining({ unconfirmed: 1 }), overdueAfterMs: 6 * 3_600_000 })`.
- NEW test: *silent when no overdue rows were examined* — a run with zero examined-overdue rows
  never calls `logger.warn('reconcile.overdue_examined', ...)`.
- All other tests: unchanged (shape-identical aggregates; budget tests :643/:656 untouched — they
  assert emission, which the reorder strengthens).

## Recipe 6 — NEW `__tests__/reconcile-detector-availability.test.ts` (the structural guarantee)
Minimal SHAPE-dispatched harness (starvation-style: select → thenable-at-`where()` = aggregate
[answers `{total:'0', noTxhash:'0', oldestCreatedAt:null}`]; `orderBy().limit()` = window;
`update().set().where()` = watermark no-op) + a `timeline: string[]` instrumented at: each
aggregate resolution (pushes `agg:<n>`), the window limit (pushes `window`), and `mockConfirm`
(pushes `confirm`). Engine + ledger mocked as in the starvation suite. Because dispatch is by
SHAPE, the file runs CORRECTLY against pre-fix AND post-fix code — red/green lands on the assert,
never on a harness error (the (T)-audit vacuous-red rule).
Tests:
1. **detectors emit BEFORE any examination RPC (fail-pre-fix):** one window row; assert both `agg`
   marks precede the first `confirm` mark AND both `reconcile.uncredited-`/`overdue-` logger
   evaluation points ran (uncredited/overdue non-null in the summary). **Red pre-fix** (aggregates
   trail the loop) — capture.
2. **detectors emit even when the window SELECT throws:** shape-harness window limit throws;
   `await expect(...).rejects.toThrow()`; assert both aggregates resolved first (timeline) —
   the strictly-better property the reorder buys.
3. **a slow examination cannot delay detector emission:** `mockConfirm` resolves after 50ms fake
   work; assert timeline order unchanged (agg marks before confirm) — the escalation's exact
   starvation shape, structurally pinned.

## Recipe 7 — empirical probes → `.audit/u-build/`
- `probe-timeout-arithmetic.mjs` (one-off, NOT suite-resident; the SCRIPT lives at
  `.audit/u-build/probe-timeout-arithmetic.mjs` — inside gate 5's allowed untracked set, R2 fix):
  local HTTP server that accepts and never responds; build a default `http(url)` client and a
  bounded `http(url, {timeout: 3_000, retryCount: 1})` client (real viem from node_modules);
  `getTransactionReceipt` against each; record wall-clocks (~41s vs ~6.2s expected — trace
  §a.4/§c.1 arithmetic grounded empirically). Output captured beside it to
  `.audit/u-build/probe-timeout-arithmetic.txt`.
- Fail-pre-fix red captures (R1 fix B1 — the FULL derived red set, all red AT the assert): **{Recipe
  3, 4.3, 4.4, 6.1, 6.2, 6.3}** run against PRE-fix src → `.audit/u-build/prefix-fail-*.txt`; the
  same suites green post-fix → `.audit/u-build/postfix-green.txt`. (4.4's bounded-options half fails
  on the 1-arg pre-fix http; 6.2's timeline has no agg marks pre-fix because the window SELECT
  throws first; 6.3's agg marks trail the loop pre-fix.)

## Build sequence (single-writer; interval self-verification after each numbered batch)
1. Tests first: Recipes 3, 4, 6 ONLY (the order-agnostic fail-pre-fix vehicles; Recipe 5 is batch 3
   — R1 fix B1). Run the three touched suites → capture the SIX expected reds {3, 4.3, 4.4, 6.1,
   6.2, 6.3} and confirm **every test NOT in the expected-red set is green** (no vacuous failures —
   each red must fail AT its assert). Runner semantic this depends on (R2 note): batch-1's 4.3/4.4
   import the not-yet-existing `RECONCILER_RPC_*` constants from the REAL settle-engine.ts; on the
   installed vitest/vite-node 2.1.9 a missing named export from a real module resolves `undefined`
   (no module-link error), so 4.3's pre-fix red reads "expected undefined to be 3000" — AT-assert,
   not vacuous — while 4.1/4.2 stay green. Do NOT upgrade vitest mid-chunk (strict module-runner
   semantics would flip the file to a vacuous load-error red).
2. Recipe 1 (engine) → settle-engine + transport-isolation suites fully green; capture.
3. Recipes 2 + 5 TOGETHER (reconcile src + its order-coupled suite) → all reconcile suites green
   (incl. Recipe 6's file flipping to green); capture.
4. Probe (Recipe 7) + INTERVAL SELF-VERIFICATION: fresh-context read-only subagent diffs the work
   vs handoff §1/§2/§3 after batches 1-3 land.
5. Full executable gate (below).

## Gates (all must hold at end-state)
1. `tsc --noEmit` exit 0.
2. FULL vitest suite: 4357 baseline + N new, 0 fail (N enumerated at gate: Recipe 4 ≈ 4, Recipe 6
   ≈ 3, Recipe 5 +2 new −0 removed, Recipe 3 net 0 ⇒ expected N ≈ 9; file count 189 + 2). Gate on
   the FULL suite only (register-P7 isolation flakes).
3. `next build` exit 0.
4. eslint on changed files: 0 errors/warnings.
5. `git diff --numstat packages/` EMPTY (byte-stable); numstat confined to: `settle-engine.ts`,
   `reconcile.ts`, `settle-engine.test.ts`, `reconcile.test.ts`, the two NEW test files, docs/
   tech-debt (trace+plan), `.audit/u-prebuild/`, `.audit/u-build/`. PLUS (R1 improvement):
   `git status --porcelain` — every UNTRACKED path must fall inside the same allowed new-file set
   (numstat alone is blind to untracked files).
6. Behavior pins green UN-EDITED: `reconcile-starvation.test.ts` (rotation),
   `terminal-transition.test.ts` (sweep semantics + summary identity + credit machinery) — ZERO
   diff lines in both files.
7. Pre-fix red + post-fix green captures present in `.audit/u-build/` for the SIX-test fail-pre-fix
   red set {Recipe 3, 4.3, 4.4, 6.1, 6.2, 6.3} + the timeout probe output.

## Behavior-neutral pins (what must NOT change, and what pins it)
| Surface | Pin |
|---|---|
| Live transport (both rails) | Recipe 4 tests 1/2/4 (no-options assert) |
| `interpretReceipt` verdict mapping | settle-engine.test.ts submit-path tests (un-edited) |
| Summary identity `scanned === Σ` | reconcile.test.ts :478/:530/:652 (un-edited) |
| (S) rotation (COALESCE/mark-before-examine/watermark) | starvation suite (ZERO edits) |
| (S③) budget/deferred | reconcile.test.ts :643/:656 (un-edited) |
| Sweep WHERE/alert semantics + (T) credit machinery | terminal-transition suite (ZERO edits) |
| Receipt-unavailable wire shape | settle-engine.test.ts :115-118 (un-edited; 1d adds no field there) |
| packages/mcp + sdk-python | numstat-empty gate |

## DELIBERATE decisions for the audit to scrutinize on the merits (not hidden)
1. **(b-i) chosen, (b-ii) rejected** — trace §c.2 arithmetic + abandoned-promise hazards.
2. **Sweep-first ordering** within the pre-loop block (P1 detector first; kill window between the
   two queries loses the lesser signal).
3. **`reconcile.overdue_examined` warn carrier** for the displaced (S) item-4 classification —
   preservation of a sealed observability contract, argued NOT a new alert (warn level, fires only
   when this run examined overdue rows; replaces the alert-payload + S11-fallback embeddings).
4. **Pre-run aggregate semantics** — standing-incidents reading (handoff licenses; trace §c.2
   equivalence analysis: sweep result-set INVARIANT to the loop; overdue can count a row the same
   run resolves — rare and correlatable).
5. **`unconfirmed.reason` optional field** (1d/2d) — observability for the LB-2 branch without a
   wire-shape change for the common case. Drop cleanly if judged gold-plating.
6. **3_000ms / retryCount 1** — the register's own shape; 10× headroom over Base's normal latency,
   one retry for transient blips; arithmetic at trace §c.1/§c.3.

## REJECTED (hold the line — same list the audit enforces)
P5+P8 (terminalization/prevention — own chunk), B1.1, P6 ops, P7 hygiene, ANY live-settle
transport/behavior change (incl. "fixing" interpretReceipt's default-false), (b-ii) per-row
deadline, new error-level alerts, summary-shape changes, cron-route edits, migrations, env changes,
pushes/deploys.
