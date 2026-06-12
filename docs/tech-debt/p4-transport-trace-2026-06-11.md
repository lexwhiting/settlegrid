# (U) P4 — Scope-confirm trace: reconciler transport timeout + detector availability (2026-06-11)

> ARC step 1 of the (U) chunk (handoff: `p4-reconciler-transport-handoff-2026-06-11.md`).
> Every claim below was re-derived THIS session against HEAD `f7a15925` (= origin/main
> `a016685a` + the doc-only handoff commit). Sources: the live files, `node_modules/viem`
> (2.47.4 — read, not recalled), the ③ register P4 entry, the (T) deep VERDICT F5 line.

## (a) Caller census + RPC calls per examination + today's effective arithmetic

### a.1 `publicClientFor` — module-PRIVATE to `settle-engine.ts` (not exported)
Exactly THREE internal callers (`apps/web/src/lib/settlement/circle-nano/settle-engine.ts`):

| Caller | Line | Path | Disposition |
|---|---|---|---|
| `submitCircleNanoOnChain` | :146 | **LIVE** (buyer on the line) — guards (2 reads) + receipt wait via `interpretReceipt` | **BYTE-IDENTICAL** |
| `confirmCircleNanoTx` | :224 | **LIVE** (in-request crash-recovery re-wait) via `interpretReceipt` | **BYTE-IDENTICAL** |
| `confirmSettlementTx` | :262 | **RECONCILER-ONLY** immediate receipt check | **THE SEAM** — switches to a reconciler-bounded client |

`createWalletClient` at :176 (live submit) also builds a default `http(url)` transport — live, untouched.

### a.2 Entry-point census (production code, `apps/web/src` + `packages`)
- `confirmSettlementTx`: **ONE production caller** — `reconcile.ts:131` (`reconcileOneRow`). The only
  other non-test mention is a comment (`ledger.ts:583`). Tests: mocked in `reconcile.test.ts:101`,
  `reconcile-starvation.test.ts:236`, `terminal-transition.test.ts:308`; exercised directly in
  `settle-engine.test.ts`.
- `submitCircleNanoOnChain` / `confirmCircleNanoTx`: live callers only — `circle-nano/settle.ts:283,294`
  and `x402/orchestrate.ts:350,380` (⚠ BOTH rails ride this engine, per LB-1).
- Other viem clients in the tree (separate seams, NOT touched): `x402/verify.ts:159` (own
  `createPublicClient`), `x402/settle.ts:90-107` (facilitator-mode, latent — carries its OWN
  `SETTLE_RECEIPT_TIMEOUT_MS = 30_000` at :99/:244, classified by probe P5d), `gas-wallet-monitor.ts:64`.
- `reconcilePendingSettlements`: **ONE caller** — the cron route
  `app/api/cron/settlement-reconcile/route.ts:43` (`maxDuration = 60`, :17). The similarly-named
  `app/api/settlement/reconcile/route.ts` is a NAME-COLLISION non-caller (ledger-integrity check via
  `verifyLedgerIntegrity`; `maxDuration = 30`; never touches the engine).

### a.3 RPC calls per reconciler examination (`confirmSettlementTx`)
1. `getTransactionReceipt` (:266) — ALWAYS (1 call). Throw → caught :267 → `'unconfirmed'` (the catch
   fires only AFTER the transport exhausts its timeout×retries).
2. `readContract authorizationState` (:279) — ONLY on a reverted receipt when `eip3009` present
   (`reconcileOneRow` passes `parsed.eip3009` for BOTH rails — `parseSettlementOperationId`
   returns it for circle-nano :101 and x402 :109).

Note: a receipt that is merely NOT FOUND is fast — `eth_getTransactionReceipt` returns a null RESULT
(one round-trip, no transport retry); the action then throws `TransactionReceiptNotFoundError`
post-transport. The 41s worst case below is the DEGRADED-RPC shape (hangs / retryable 5xx), exactly
the weather the escalation targets.

### a.4 Today's effective timeout arithmetic (verified in viem 2.47.4 source — §d)
- Per attempt: `timeout = 10_000` ms (http.js:14 default; nothing overrides it — `publicClientFor`
  passes bare `http(url)`).
- Attempts: `retryCount = 3` default ⇒ 4 attempts (createTransport.js:6; withRetry.js: retries while
  `count < retryCount`, count from 0).
- Retry delays: `(1 << count) × 150` ms ⇒ 150 + 300 + 600 = 1,050 ms.
- **Worst per hung call: 4 × 10,000 + 1,050 = 41.05 s** (matches the register's "~41s").
- **Worst per examined row: receipt (41.05s) + reverted-branch nonce read (41.05s) ≈ 82.1 s** + per-row
  DB ops (watermark UPDATE, flip, possible `findSettlementRow`, possible credit txn).
- The (S③) budget (`runBudgetMs` 40s) checks ONLY between rows (`reconcile.ts:526`). A row admitted at
  t=39.99s can therefore complete at **t ≈ 122 s ≫ maxDuration 60 s** → Vercel kills the run → the
  overdue aggregate (:576), the uncredited sweep (:612), and the summary NEVER emit. The escalation's
  mid-band (~20-45s row) needs only ONE degraded call to land completion past 60s. **Confirmed.**

## (b) LB-2 walk — every timeout/error shape → verdict (the funds trap)

`confirmSettlementTx` today:

| Evidence state | Code path | Verdict today | Reconciler action | Safe? |
|---|---|---|---|---|
| Receipt read fails (timeout/RPC/not-found) | :267 catch | `unconfirmed` | row stays pending | ✅ |
| Receipt `success` | :271 | `settled` | flip + credit | ✅ (complete evidence) |
| Receipt `reverted`, nonce read OK=false | :279-288 | `reverted{nonceConsumed:false}` | CAS-flip `failed` | ✅ (complete evidence) |
| Receipt `reverted`, nonce read OK=true | :279-288 | `reverted{nonceConsumed:true}` | left pending (`pending-nonce-consumed`) | ✅ |
| **Receipt `reverted`, nonce read FAILS (timeout/RPC)** | **:285-287 catch → `nonceConsumed` stays `false`** | **`reverted{nonceConsumed:false}`** | **CAS-flips `failed` on INCOMPLETE evidence** | ❌ **THE HAZARD — EXISTS TODAY** |
| `eip3009` absent (legacy x402 call shape) + reverted | :277 skip | `reverted{nonceConsumed:false}` | flip `failed` | ✅ (receipt IS complete evidence; no nonce exists to check — branch unchanged) |

Why the hazard is real money: a reverted tx whose (from,nonce) was consumed by a CONCURRENT winner
means the USDC **moved**. If the nonce read times out, today's code defaults `false` → verdict
`reverted` → `reconcileOneRow:189` calls `markSettlementFailed` → the (T) CAS **does not protect**
(the ref matches — same broadcast hash) → row terminalizes `failed` while funds may have moved →
the credit is silently lost AND the row exits the pending window forever (no detector ever
re-examines a terminal row; the uncredited sweep only watches SETTLED rows). The probability is
highest precisely under degraded RPC — the same weather that makes concurrent-winner races likelier
(timeout → live-path resubmit → two txs on one nonce).

**In-seam fix (handoff LB-2 licenses it):** in `confirmSettlementTx` ONLY, a failed nonce-state read
after a reverted receipt returns `{ kind: 'unconfirmed', txHash }` (safe direction — row stays
pending, re-examined next rotation with fresh evidence). The live path's `interpretReceipt`
(:306-313) keeps its existing default-false semantics BYTE-IDENTICAL (out of scope per handoff §1;
its evidential context differs — the wait just succeeded on the same client — and the orchestrators'
sealed mapping consumes it).

**Existing test pins the hazard as intended:** `settle-engine.test.ts:120-128` ("reverted but the
nonce-recheck RPC throws → treated as not-consumed (failure side)") asserts
`reverted{nonceConsumed:false}`. The fix FLIPS this expectation to `unconfirmed` — and the flipped
assertion is the natural fail-pre-fix proof (red on today's code, green post-fix).

New-error-shape check (LB-2 sentence 1): with `http(url, { timeout, retryCount })`, a timeout
surfaces as viem `TimeoutError` THROWN from the transport — same throw channel today's
10s-default timeouts use. Both :267 and :285 catches are bare `catch` (shape-agnostic) → the
receipt-read timeout still lands in :267 → `'unconfirmed'`. ✅ No catch-shape drift possible.

## (c) The option-(b) decision — budget arithmetic

### c.1 Fix (a) alone is NOT sufficient (arithmetic)
With the register's shape `http(url, { timeout: 3_000, retryCount: 1 })`:
- Per hung call: 2 attempts × 3,000 + 150 = **6.15 s**; per row (2 calls): **12.3 s**.
- Worst loop overrun: row admitted at t=39.99s → RPC done ≈ t=52.3s; + per-row DB ops; the
  detectors + summary then need the remainder of the 60s envelope.
- Nominal DB (≲0.5s/query): completes ≈ t=56s < 60s ✅. But under combined RPC + DB degradation
  (DB queries ~2s: 4 per-row queries + 3 detector queries ≈ 14s): t ≈ 52.3 + 8 + 6 > 60s ❌.
- (a) alone shrinks the starvation band ~6.7× but **cannot PROVE detector emission** — the proof the
  handoff demands.

### c.2 Chosen shape: **(a) + (b-i) aggregates-first**; (b-ii) per-row deadline REJECTED
**(b-i)** moves the uncredited sweep + the overdue aggregate (both independent DB-only queries,
`reconcile.ts:576-658`) BEFORE the window SELECT + examination loop. Detector emission then depends
on NOTHING downstream of run start — no RPC call exists upstream of them. The bar's clause "no
single RPC call can prevent the detectors from emitting" becomes structurally true rather than
arithmetically probable. Order within the pre-loop block: **sweep first** (`uncredited_settled` is
the P1 loss detector), then overdue, then the window/loop — a kill between the two queries loses
the lesser signal.

Semantics deltas (the handoff licenses the reorder; flagged for the audit, DC-18):
1. The aggregates now report the PRE-run "standing incidents" state — the handoff itself argues this
   is the more honest reading. Equivalence checks: the sweep's result set is INVARIANT to the loop
   (the loop only flips PENDING→terminal rows; rows it settles get `settledAt ≈ now`, inside any
   real grace window — and the loop never credits previously-settled rows, so it cannot remove a
   sweep member either). The overdue aggregate CAN count a >6h-pending row the same run then
   resolves (rare: Base confirms in seconds; an operator correlates with the same run's `done` line).
2. `examinedThisRun` (the (S) item-4 classification, today embedded in the alert payload
   `reconcile.ts:602` and in `overdue_check_failed` :609) cannot exist pre-loop. Carrier: a
   post-loop `logger.warn('reconcile.overdue_examined', { examinedThisRun })` emitted ONLY when a
   nonzero class exists — preserving the (S) classification observability (NOT a new page: warn
   level, fires only on examined-overdue runs; it is the same payload the reorder displaces, which
   strictly improves on S11 by surfacing classification even when the aggregate query succeeds).
   The pre-loop `overdue_check_failed` drops the field (nothing examined yet).
3. Error-isolation unchanged: each pre-loop block keeps its own best-effort try/catch
   (`uncredited_check_failed` / `overdue_check_failed` — never abort the run).

**(b-ii) (hard per-row `Promise.race` deadline) REJECTED:** once (b-i) makes the detectors
structurally unconditional, (b-ii) would only protect the SUMMARY (S③-accepted best-effort
telemetry, not a P1 detector) while adding real hazards: an abandoned-but-running examination
continues in the background on a Fluid-Compute instance (its flip/credit can land AFTER the
summary reports — a new truthfulness gap in `scanned === Σ buckets`), a new outcome class, and
fake-timer test complexity. (a) already bounds the loop's RPC tail to 12.3s/row. Cost/benefit fails.

### c.3 Post-fix envelope (the proof the bar asks for)
- Detectors: emit before any RPC; depend only on their own 2-3 DB queries at run start. A DB outage
  that blocks them blocks every DB-backed detector by definition (and the cron `done`/500 trail +
  Sentry 401 trail cover run-level liveness) — out of transport scope.
- Loop: per-row RPC ≤ 12.3s ⇒ worst completion ≈ 52.3s + per-row DB ⇒ summary emits < 60s in all
  but combined RPC+DB pathology, where ONLY the summary (not a detector) is lost.
- Live path: byte-identical (`publicClientFor`, `createWalletClient`, `interpretReceipt`,
  `RECEIPT_TIMEOUT_MS` untouched; pinned by a new http-spy test — §e).

## (d) viem transport options vs the INSTALLED version (2.47.4, read from node_modules)
- `node_modules/viem/package.json` → `"version": "2.47.4"` (monorepo root; apps/web has no own copy).
- `_cjs/clients/transports/http.js:9-14` — `http(url, config)` accepts `timeout` + `retryCount` +
  `retryDelay`; `timeout = timeout_ ?? config.timeout ?? 10_000` where `timeout_` comes from the
  CLIENT invocation.
- `_cjs/clients/createClient.js:20-24` — the client invokes `transport({ account, chain,
  pollingInterval })` — **no client-level timeout/retryCount** ⇒ our `config.timeout`/`config.retryCount`
  are EFFECTIVE (nothing overrides them). Verified, not recalled.
- `_cjs/clients/transports/createTransport.js:6` — `retryCount = 3, retryDelay = 150` defaults.
- `_cjs/utils/buildRequest.js:100-142` — delay `(1 << count) * retryDelay`; `shouldRetry`: viem
  `TimeoutError` (extends BaseError, no numeric `code`, NOT an HttpRequestError) falls through to the
  default `return true` ⇒ **timeouts ARE retried** ⇒ retryCount participates in the worst-case product.
- `_cjs/utils/promise/withRetry.js:7-23` — count starts 0, retries while `count < retryCount`.

Register's proposed options are valid and effective at this version: `http(url, { timeout: 3_000,
retryCount: 1 })`. (`getBaseRpcUrl` may return `undefined` → `http(undefined, opts)` falls back to
the chain's default public RPC — same fallback the live path has today; behavior preserved.)

## (e) DC-05 forced-test sweep — harness ↔ transport/order relationships

| Suite | Harness style | Reorder impact | Transport impact |
|---|---|---|---|
| `settle-engine.test.ts` | mocks viem `createPublicClient`/`createWalletClient` (factory IGNORES args; `...actual` spread keeps `http` real-but-unobserved) | none | invisible to existing tests EXCEPT :120-128 (the LB-2 pin — must FLIP, §b); the new bounded client flows through the same factory |
| `reconcile.test.ts` | `selectPlan.seq` — dispatch by db.select CALL ORDER (default `['window','overdue','sweep']`, :143-167) | **the 2 LIVE `selectPlan.seq` assignment sites (:169/:496) + the :65 dead init + the :50-57 ordinal comments must reorder** (sweep/sample/overdue before window); alert-payload asserts :614 + `overdue_check_failed` asserts :668-697 move to the new `reconcile.overdue_examined` carrier; budget tests :643/:656 unaffected (aggregates complete pre-loop trivially) | engine mocked — none |
| `reconcile-starvation.test.ts` | stateful interpreter, dispatch by CHAIN SHAPE (`orderBy().limit()` = window; thenable-at-`where()` = aggregate) | **order-agnostic — no edits** (aggregate thenable answers any number of aggregate selects, returns `total:'0'`) | engine mocked — none |
| `terminal-transition.test.ts` | stateful interpreter, shape-dispatched (:158-188) | **order-agnostic — no edits expected**: every sweep assertion either pre-seeds settled rows (:406) or deliberately uses the NEXT-run posture with backdated `settledAt` (:422-436, :469-487 — "the flip happened 'this ms'" comments). Run-1 sweep observations are identical pre/post reorder (pending rows aren't sweep members; freshly-flipped rows fail `settledAt < cutoff` strictly-less even at grace 0) | engine mocked — none |
| cron route test | mocks `reconcilePendingSettlements` wholesale | none | none |

**The LB-1 pin test (new file, e.g. `circle-nano/__tests__/transport-isolation.test.ts`):** mock viem
with `http: vi.fn()` (capturing args) + arg-capturing client factories; drive all three entry points;
assert (1) every `http` call made by `submitCircleNanoOnChain` (public + wallet clients) and
`confirmCircleNanoTx` passes **NO options argument** (today's exact call shape — fails if live
transport options ever drift), (2) `confirmSettlementTx`'s `http` call passes exactly
`{ timeout: RECONCILER_RPC_TIMEOUT_MS, retryCount: RECONCILER_RPC_RETRY_COUNT }` (fails pre-fix —
the second fail-pre-fix proof). Constants exported from settle-engine.ts (DC-07 single-source;
transitive caller chain per constant recorded in §a/§c — the TTL lesson).

**Empirical (not just arg-pinned) timeout proof:** a one-off node probe (captured to
`.audit/u-build/`) runs both client shapes against a deliberately-hanging local HTTP server and
measures wall-clock: default client ≈ 41s, bounded client ≈ 6.15s — grounding the §c arithmetic in
observed behavior once, with the suite then pinning the OPTIONS (keeps the suite fast).

**Detector-availability fail-pre-fix (empirical, suite-resident):** a reconcile.test.ts-level
simulation: one window row whose `confirmSettlementTx` mock resolves slowly; assert the RELATIVE
ORDER of the sweep/overdue selects vs the slow confirm — pre-fix the aggregates happen-after the
slow row (red under the new assertion), post-fix they happen-before (green). This pins the
structural guarantee itself, independent of wall-clock.

## Scope statement (recorded against handoff §1)
- **Files to be touched (build plan will enumerate recipes):** `settle-engine.ts` (transport seam:
  bounded client factory + constants + the LB-2 unconfirmed return — NOT `interpretReceipt`, NOT
  submit logic), `reconcile.ts` (run-ordering + the `overdue_examined` carrier + optional
  `unconfirmed.reason` passthrough log field), tests (`settle-engine.test.ts` flip,
  `reconcile.test.ts` seq/payload updates, new `transport-isolation.test.ts`, possible new
  detector-order test), docs (this trace, plan, capstone, register close — at close).
- **Byte-stable (verified untouched by the design):** `interpretReceipt` verdict mapping,
  `submitCircleNanoOnChain`/`confirmCircleNanoTx` behavior, `RECEIPT_TIMEOUT_MS`, all of
  `ledger.ts`/flips/CAS, `creditSettlement` + marker, sweep WHERE/alert semantics (only its
  POSITION + the classification carrier change), both orchestrators, the F2 pin,
  `RECONCILABLE_RAILS`, the (S) rotation (COALESCE ordering, mark-before-examine, watermark,
  budget/deferred), the cron route, payouts/pricing, packages/, migrations.
- **Rejected (per handoff):** P5+P8, B1.1, P6, P7, any live-settle transport/behavior change,
  (b-ii) per-row deadline (§c.2), any new error-level alert (the warn-level `overdue_examined` is
  the displaced (S) classification's carrier, argued above — audit to ratify).
