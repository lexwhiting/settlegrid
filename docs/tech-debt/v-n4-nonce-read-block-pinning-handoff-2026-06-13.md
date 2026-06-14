# (V-N4) — reconciler expiry-pass nonce-read block-pinning — ① HANDOFF (scope-confirmed; pre-build plan audit CLOSED in-session, 2026-06-13)

> **① of the ARC.** Scope-confirm + the HIGH-STAKES pre-build plan audit are DONE and CLOSED in
> this session — the spec below IS the plan; **no build code exists yet.** **TIER = HIGH-STAKES.**
> Lifecycle: scope-confirm ✓ → draft plan ✓ → **pre-build plan audit ✓ (this session, closed before
> any build code)** → **BUILD (next session)** → executable gate → ② seal-gating review → seal +
> bookkeeping. Founder-gated: never commit / push / deploy / set-env; DB read-only.

## 0. One-line intent
Make the reconciler expiry pass's on-chain nonce read **deterministic with respect to its own
chain-time anchor** by pinning it to the SAME block whose timestamp proved chain-expiry — closing a
load-balanced/replica-lagging RPC window that can read a CONSUMED authorization nonce as UNCONSUMED,
causing (a) a WRONG terminalization of a row whose USDC actually moved and (b) silent suppression of
the P8(b) `nonce-consumed-untracked` detector (the only alarm guarding that real-loss window).

## 1. Intent — why this chunk exists, who consumes it, what it enables
The (V) pending-lifecycle chunk added an expiry pass that terminalizes provably-dead never-broadcast
`pending` rows and quarantine-classifies the rest, on a chain-time proof: it reads the SAFE-head
block timestamp (`chainTs`), and only when `chainTs > validBefore` (the authorization is chain-expired
— no future canonical block can validly consume it) does it read the on-chain `authorizationState`
nonce to decide terminalize (unconsumed-forever) vs quarantine (consumed-untracked → P8(b) detector).
The (V) ③ deep audit (register **V-N4**, `s-deep-audit-register-2026-06-10.md`) found these two reads
are NOT mutually consistent: the chain-time anchor reads `blockTag:'safe'` but the nonce read uses
viem's implicit `'latest'`. On a load-balanced or replica-lagging RPC the two calls (each builds its
own client) can hit different backends; a backend whose `'latest'` LAGS the safe head it was paired
with can report a consumed nonce as unconsumed. **Consumer:** the reconciler's correctness + the
P8(b) loss-detection guarantee. **What it enables:** the expiry pass's terminalize/quarantine
decision becomes provably exact (a row whose USDC moved can never be silently flipped
`expired-no-broadcast`), and the `reconcile.expired_nonce_consumed_quarantined` detector stops being
suppressible by replica lag — so the credit-tail loss window stays observable. Register ledger:
**DC-04 / DC-08** (and DC-18 detector-truthfulness, DC-05/DC-15 for the test/plan).

## 2. TIER = HIGH-STAKES — classification + triggering criteria (record; ② re-confirms, may escalate)
HIGH-STAKES because the chunk: **touches a correctness/money boundary** (the reconciler's terminalize
decision on real-USDC settlement rows on Base mainnet); **binds to on-chain ground truth** (DC-04 —
the block at which `authorizationState` is read changes what the rail believes about a consumed
nonce); **alters a determinism/reproducibility guarantee** (the entire point: make the nonce read
deterministic w.r.t. the safe anchor across replicas); **edits a recently (V)-③-certified surface**
(the bounded readers `readAuthorizationStateBounded` / `readSafeBlockTimestampBounded` and the
`runExpiryPass` decision block); and **changes a fail-mode** (DC-08 — the `'unknown'` direction and a
potential new liveness failure). It does NOT change a published claim, open a new untrusted-input
boundary (the RPC is the same trusted dependency; its values remain semi-trusted per the (V) absurd-
future clamp), or require a migration. Uncertain-leaning items resolved toward HIGH-STAKES.

## 3. Scope decision (sizing) — V-N4 STANDS ALONE; explicitly NOT merged
This is one coherent single-seam chunk (the expiry-pass nonce read + its safe anchor). It is **not
merged** with:
- **V-N5** (LOW, P6-ops: expiry-pass drain/concurrency — candidate-SELECT wall-expiry predicate +
  cron advisory lock). Shares the `runExpiryPass` FILE but is a SEPARABLE concern (throughput/
  concurrency, not nonce-read correctness). Merging would fold a LOW incremental item into a
  HIGH-STAKES chunk and dilute the audit's focus on the risky RPC-consistency seam — rejected per the
  sizing rule. V-N5 stays its own (later) chunk.
- **The `confirmSettlementTx` reverted-branch nonce recheck** (`settle-engine.ts:320-325`) — also an
  un-pinned `authorizationState` read, BUT a DIFFERENT semantic: it rechecks a SPECIFIC reverted tx's
  nonce-consumption (the (U)-sealed LB-2 reverted branch), not an as-of-expiry final state, and is NOT
  gated on `chainTs > vb`, so safe-block pinning is not obviously applicable. **OUT of scope** (note
  it as a possible future sibling; do NOT pull it in — scope-creep / a different invariant).
Nothing else shares this exact seam-and-invariant, so the largest coherent chunk IS V-N4 alone.

## 4. The defect — exact location (verified against the live tree this session)
- **Nonce read (the bug):** `apps/web/src/lib/settlement/circle-nano/settle-engine.ts:346-362`
  `readAuthorizationStateBounded(network, from, nonce)`. The `readContract({ ... functionName:
  'authorizationState', args: [from, nonce] })` at `:355-357` passes **no** `blockNumber`/`blockTag`
  ⇒ viem defaults to `'latest'`. Returns `'consumed' | 'unconsumed' | 'unknown'`; `catch → 'unknown'`.
- **Safe anchor (pairs with it):** `settle-engine.ts:389-402` `readSafeBlockTimestampBounded(network)`
  does `getBlock({ blockTag: 'safe' })` at `:394` and returns **`number | null`** — ONLY the timestamp
  (`Number(block.timestamp)`, with finite-positive + absurd-future-skew guards). It does NOT expose
  `block.number` today, although viem's block object carries it.
- **The pairing (`runExpiryPass`):** `apps/web/src/lib/settlement/reconcile.ts` (`runExpiryPass` @
  `:493`). `:573-576` reads + caches the safe timestamp per network in `chainTsByNetwork`; `:577-581`
  `chainTs===null → stays pending`, `chainTs <= vb → continue`; `:585` mid-candidate deadline guard;
  `:588` the nonce read; `:589-592` `'unknown' → stay pending` (LB-2); `:593-614` `'consumed' →
  quarantineClassify('nonce-consumed-untracked')` + `reconcile.expired_nonce_consumed_quarantined`
  (the P8(b) detector); `:616-629` `'unconsumed' → markSettlementExpiredNoBroadcast(...,{chainTs,
  checkedAt})` + `reconcile.expired_terminalized`. The `:587` comment already asserts the semantic the
  fix relies on: *"nonce state NOW (final: no future block can consume it past 3.5)."*

## 5. The fix shape (the plan)
Make the nonce read happen **at the exact safe block whose timestamp produced `chainTs`** — never a
fresh read, never `'latest'`.
1. **`readSafeBlockTimestampBounded` → return `{ ts: number; blockNumber: bigint } | null`** (rename
   to e.g. `readSafeBlockBounded` is optional; keep behavior). Pull `block.number` alongside
   `block.timestamp`; keep ALL existing guards (finite-positive ts, absurd-future-skew → `null`); if
   `block.number == null` (only happens for a pending block — impossible for `'safe'`, but be total)
   → `null`. The `null` contract and its skip-direction stay byte-for-byte semantically identical.
2. **`readAuthorizationStateBounded` → accept a `blockNumber: bigint` param** and pass it through:
   `readContract({ address, abi, functionName: 'authorizationState', args: [from, nonce], blockNumber })`.
   Keep `catch → 'unknown'` and the unsupported-network `'unknown'`. **Do NOT add an unpinned `'latest'`
   retry on failure** (see LB-2). Signature becomes `(network, from, nonce, blockNumber)`.
3. **`runExpiryPass` (reconcile.ts) — thread the SAME block N, and update EVERY `chainTs` consumer to
   the scalar `.ts`** (audit L4-F4: the return-shape change ripples to 3 sites beyond the gate; missing
   one silently breaks behavior or a money-path record):
   - **cache type** (`reconcile.ts:528`): `Map<string, number | null>` → `Map<string, { ts: number;
     blockNumber: bigint } | null>`; populate the object per network once per pass (`:573-574`).
   - **gate** (`:576-581`): `chainTs === null → unknown/continue`; the comparison `chainTs <= vb` MUST
     become **`chainTs.ts <= vb`** (a stale bare-number mock makes `chainTs.ts` `undefined` →
     `undefined <= vb` is `false`, a silent wrong-reason pass — see §9).
   - **nonce read** (`:588`): pass `chainTs.blockNumber` as the new 4th arg — **this threading IS the
     fix in reconcile.ts** and MUST be tested end-to-end (§9, audit L4-F2).
   - **evidence** (`:619-622`) + **log** (`:629`): keep passing the SCALAR —
     `markSettlementExpiredNoBroadcast(..., { chainTs: chainTs.ts, checkedAt })` and the
     `reconcile.expired_terminalized` log `{ ..., chainTs: chainTs.ts }`. The evidence object stays
     byte-shape identical (`{ chainTs: number, checkedAt }`); do NOT embed the object (would silently
     mutate a money-path audit record — audit L4-F4).
4. **Optional evidence `blockNumber` — DEFERRED (do NOT build).** Threading `blockNumber` into the
   `markSettlementExpiredNoBroadcast` evidence (`ledger.ts:683-704`) would change a frozen evidence
   shape AND pull in an un-enumerated test file (`terminal-transition.test.ts`, 6 call sites — audit
   L3-F1). The pin's value is in the READ, not the record. Keep evidence `{chainTs:number, checkedAt}`
   exactly as today. (Fold-on-open if a future chunk opens the ledger evidence surface.)
5. **NEW — close the fail-mode this chunk introduces (DC-18, audit L2-F3).** Pinning can raise the
   `'unknown'` rate (a degraded / lagging / state-pruning RPC fails the pinned read — see LB-2). Today
   a total terminalization stall is visible only INDIRECTLY, up to 6h later, via
   `reconcile.pending_overdue` (`reconcile.ts:854-863`, `logger.error`) — the very alarm (V)
   de-fatigued. Add a dedicated, same-run signal in `runExpiryPass`: when the pass examined ≥1 expiry
   candidate but `terminalized === 0 && quarantined === 0 && unknown > 0` (the anchor/pin-degradation
   signature), emit `logger.error('reconcile.expiry_anchor_degraded', { examined, unknown, … })`. This
   is an in-process metric, NOT an RPC-provider change → in scope; it is the build-side backstop for
   LB-2's liveness risk and must have its own test (§9).

## 6. The 1–2 LOAD-BEARING decisions (where audit judgment concentrates — "passes every test yet wrong")
1. **Pin to the CACHED safe block N, not a fresh read — and the exactness proof (RESTATED per audit
   L1-F1).** The nonce read MUST use the very `blockNumber` whose `timestamp` was compared against
   `validBefore` — read `ts` and `number` off the SAME `getBlock` response (one fetch). Semantic proof
   for the money-critical direction: USDC's `transferWithAuthorization`/`receiveWithAuthorization`
   impose a STRICT time gate `block.timestamp < validBefore` on the value-moving consume; Base L2
   timestamps strictly increase (2s/block); the pass only reaches the nonce read when `chainTs(N) >
   vb`. Therefore **no valid TRANSFER consume can occur at any block after N**, so `authorizationState`
   AS OF block N captures every consume that moved USDC — reading at N is exact for the terminalize
   decision, and a lagging replica's `'latest'` (< N) is the ONLY thing that can read it wrong.
   **CAVEAT — do NOT claim the nonce bit is literally "final" at N:** `cancelAuthorization` is NOT
   time-gated and can consume the nonce in a block AFTER N. This does NOT break the decision — a
   post-N cancel moves no money, so terminalizing a chain-expired row as `expired-no-broadcast` is
   correct regardless; a pre-N cancel reads `'consumed'` → quarantine (attributive: "transfer OR
   cancel", as `reconcile.ts:595-597` + the runbook already say). **During build, correct the
   `reconcile.ts:587` comment** ("no future block can consume it") to scope it to TRANSFER consumes.
   The silent-wrong traps: (a) a SECOND `getBlock({blockTag:'safe'})` for the nonce read (the safe head
   advances between calls → a fresh window); (b) threading the wrong block (`'latest'`'s number, or a
   per-row instead of the per-network-cached N); (c) reading `block.number` from a different fetch than
   the `timestamp`. ② will charge **DC-04** (on-chain ground-truth) + the determinism guarantee.
2. **Failure direction is `'unknown'` (stay pending) — never `'latest'` — AND the liveness backstop is
   a HARD precondition, not "interim" (RAISED per audit L2-F1/F3).** (i) An implementer must NOT add a
   "fallback" that retries the read UNPINNED at `'latest'` on error — it DEFEATS the fix (re-opens the
   lag bug). The existing `catch → 'unknown'` IS the entire correct fallback; reinforce it with a code
   comment at the catch and a test asserting NO second unpinned call (§9). (ii) **Liveness (the
   audit's HIGH finding).** A pinned `eth_call` at block N requires the node to serve N's state. Two
   collision mechanisms: a standard Geth full node retains only ~128 blocks ≈ ~4.3 min of state (older
   → "missing trie node"); and — sharply — the SAME load-balanced laggy backend the fix targets has N
   in its FUTURE (its tip < N → "block not found"). On that population today's `'latest'` read
   *succeeds* (stale) while the pinned read *hard-fails to `'unknown'`* → if frequent, the pass STOPS
   terminalizing and `pending_overdue` climbs again — the P5 alarm-fatigue (V) cured. Pinning to a
   ~minutes-old safe block is served fine by a deep-retention/archive, single-view-consistent provider,
   so the response is: **(a) elevate the founder RPC requirement to a HARD build/deploy PRECONDITION**
   — `SETTLEGRID_BASE_RPC_URL` MUST be a single-view-consistent endpoint that serves historical
   `eth_call` at a ~10-min-old block (archive or deep-retention; NOT a load-balanced pool with
   divergent heads, NOT a `'latest'`-only provider); record it as a founder/deploy checklist line and
   flag it for ② to confirm. **(b) Ship the in-process stall detector** (§5 step 5,
   `reconcile.expiry_anchor_degraded`) so a degradation pages on the same run, not 6h later. ② will
   charge **DC-08** (fail-mode + liveness) + **DC-18** (detector truthfulness).

## 7. Frozen / existing surfaces to BUILD ON (do not edit)
- **`publicClientFor` (`settle-engine.ts:117-119`) — FROZEN, byte-identical**, pinned by
  `transport-isolation.test.ts`. The fix touches ONLY the (V)-additive readers + `reconcilerPublicClientFor`
  call sites; the LIVE submit/confirm client and path must not change. Do not perturb the bounded-
  transport options (`RECONCILER_RPC_TIMEOUT_MS=3000`, `RECONCILER_RPC_RETRY_COUNT=1`).
- **`reconcile.ts` outside `runExpiryPass`** — the window pass, the credit gate, the sweep/overdue
  detectors: untouched. Only the expiry-pass chain-anchor + nonce-read lines change.
- **`ledger.ts` evidence-CAS** (`markSettlementExpiredNoBroadcast`) — treat as frozen unless the
  optional blockNumber-in-evidence is truly free; never change the CAS predicate.
- The `'safe'`-vs-`'latest'` chain-time reasoning, the absurd-future clamp (③ finding 8), the
  finite-positive guard, the LB-2 `'unknown'`-stays-pending rule — all PRESERVE exactly.
- `EIP3009_ABI`, `USDC_ADDRESSES`, `SUPPORTED_CHAINS`, `getBaseRpcUrl` / `SETTLEGRID_BASE_RPC_URL`
  (`env.ts:286-295`) — read-only; do not edit.

## 8. EXPLICITLY HELD (reject as scope-creep)
The `confirmSettlementTx` reverted-recheck un-pinned read (`settle-engine.ts:320-325`); the live-path
`submitCircleNanoOnChain` pre-submit guard (`:185-190`) and `interpretReceipt` recheck (`:420-422`);
V-N5 drain/concurrency; the optional ledger evidence field if it perturbs the CAS; any RPC-provider
config change (founder/env). None belong in V-N4.

## 9. Test plan (the build MUST land these; AS-IS the current suite would NOT catch the bug — the plan audit found 4 HIGH test-fidelity gaps, all closed below)
1. **RPC-level pin assertion — the NON-VACUOUS form is mandatory (audit L4-F1).** In
   `circle-nano/__tests__/settle-engine.test.ts` (describe `:310-361`; today `:311-321` assert ONLY the
   resolved value, no block arg): invoke the reader with a CONCRETE bigint and match that exact value —
   `await readAuthorizationStateBounded('eip155:84532', from, nonce, 12345n)` then
   `expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 12345n }))`.
   Do NOT use a 3-arg call or assert `blockNumber: undefined` — `objectContaining({blockNumber:
   undefined})` matches an absent key and passes BOTH pre- and post-fix (vacuous). This goes RED on
   today's no-block code, GREEN after.
2. **`readSafeBlock…` new return shape (audit L4-F5).** Update the `getBlock` mock (`:324`) to include
   `number` as a **bigint literal** (`{ timestamp: …, number: 12345n }`) and assert the reader returns
   `{ ts, blockNumber: 12345n }`. ADD the §5.1 totality case: valid `timestamp` but **`number`
   absent/undefined → returns `null`** (a NEW code path, otherwise untested). Keep malformed-ts→null
   (`:335-347`), absurd-future→null (`:341`), bounded-transport (`:350-360`) green.
3. **THREADING test — the actual reconcile.ts fix, currently UNTESTED (audit L4-F2, the load-bearing
   gap).** `__tests__/reconcile.test.ts` mocks the reader (`mockNonceState`/`mockChainTs` @ `:119-124`),
   so settle-engine.test.ts CANNOT prove `runExpiryPass` threads the cached blockNumber. ADD an explicit
   4th-arg assertion: `mockChainTs.mockResolvedValue({ ts: NOW_SEC - 100, blockNumber: 777n })`,
   `mockNonceState.mockResolvedValue('unconsumed')`, run the pass, then
   `expect(mockNonceState).toHaveBeenCalledWith(<network>, <from>, <nonce>, 777n)`. Without this, a build
   that forgets the thread (or passes `'latest'`/a wrong value) keeps the entire suite green.
4. **Convert EVERY `mockChainTs` literal to the new shape — and know the false-green mode (audit
   L4-F3).** `mockChainTs` is an untyped `vi.fn()`, so a stale bare-number does NOT throw: `chainTs.ts`
   becomes `undefined`, `undefined <= vb` is `false`, and happy-path cases PASS for the wrong reason.
   Literal `mockResolvedValue` sites to convert to `{ts, blockNumber}`: default (`:206-209`,
   `9_999_999_999`), R-V13 (`:918`, `NOW_SEC-100`), R-V24 (`:1025`, `Number(VB_EXPIRED)-10`; the `:1036`
   `null` STAYS null), R-V25 (`:1049`, `NOW_SEC-1_000`). (R-V12 `:847` / R-V17 `:980` ride the default —
   no literal there; do not edit those lines.) Then **keep R-V13's evidence assertion
   `objectContaining({ chainTs: NOW_SEC - 100 })` UNCHANGED** — it is the guard that the evidence field
   stays the scalar `.ts` (audit L4-F4); if it would have to become an object to pass, the build wrongly
   embedded the object → REJECT.
5. **Failure-direction test (§6 LB-2).** A pinned read that throws (pruned/transient) → `'unknown'` →
   row stays pending (no terminalize, no quarantine); assert `mockReadContract` was called ONCE with a
   `blockNumber` and there is NO second unpinned `'latest'` call.
6. **Stall-detector test (§5 step 5, DC-18, audit L2-F3).** Drive a pass that examines ≥1 candidate, the
   nonce read returns `'unknown'`, nothing terminalizes/quarantines → assert `logger.error` fired with
   `'reconcile.expiry_anchor_degraded'`; a normal pass (something terminalized) does NOT fire it.
7. **RECOMMENDED — differential lag test (audit L4-F6, the clearest proof).** In settle-engine.test.ts:
   `mockReadContract.mockImplementation(({ blockNumber }) => blockNumber === N)` then
   `expect(await readAuthorizationStateBounded(net, from, nonce, N)).toBe('consumed')` — directly shows
   "an unpinned/`latest` read would see unconsumed; pinned-to-N sees the true consumed." Add if cheap.
- The reader-boundary mocks in reconcile.test.ts CANNOT catch a block-tag regression by themselves —
  that is exactly why tests 1+3 (the RPC-level pin assertion AND the reconcile threading assertion) are
  both mandatory, not either/or.

## 10. Build baseline + gate
- Build from the current working tree: **HEAD `b3b1e175` + the sealed-but-uncommitted (W) hygiene
  chunk in the working tree.** (W) touches `logger.ts` + 6 test files — a file set DISJOINT from V-N4's
  (`settle-engine.ts`, `reconcile.ts`, their tests, optional `ledger.ts`), so the two diffs do not
  conflict and the ② review can isolate V-N4 by path. Do NOT commit/revert (W) (founder-gated).
- Gate baseline (post-(W), from `cd apps/web`): `tsc 0 · vitest 4434/191/0 · eslint 0 · next build 0`.
- The chunk ADDS tests (block-pin assertions + the consistency test) and changes existing (V) reader/
  expiry mocks; expect the vitest count to rise by the net new tests. Gate must return green with
  `git diff` (path-filtered to the V-N4 files) confined to the surfaces in §5/§7.
- Run from `cd /Users/lex/settlegrid/apps/web`: `npx tsc --noEmit` · `npx vitest run` · `npx eslint
  <changed files>` · `npx next build`.

## 11. Mechanical ground-truth already established this session (do not re-derive)
- No `blockNumber` pinning and no `getTransactionCount` exist anywhere in `apps/web/src` (grep: 0 hits)
  — the pin is net-new. No pruned/archive-node fallback precedent exists; the only fallback convention
  is the typed `catch → 'unknown'` / `→ null`. The readers are (V)-ADDITIVE in the engine file (not the
  frozen `publicClientFor`). The sole non-test callers are in `runExpiryPass`. viem `readContract`
  accepts `blockNumber: bigint` (mutually exclusive with `blockTag`); `getBlock`'s returned `.number`
  is a `bigint` (null only for pending).

## 12. ② will charge: DC-04 (on-chain ground-truth / block-pin correctness), DC-08 (fail-mode + liveness/'unknown' direction), DC-18 (detector truthfulness), DC-05 (test-double surface — the reader-mock shape change must actually catch the bug), DC-15 (plan↔realized drift). Ledger: `.audit/defect-ledger/INDEX.md`.

## 13. Lifecycle (state explicitly)
scope-confirm ✓ → draft plan ✓ → **pre-build plan audit ✓ (this session)** → BUILD (next session, fresh
agent via the kickoff block) → executable gate (green) → ② seal-gating review (high-stakes panel) →
seal + bookkeeping. Founder-gated throughout: no commit/push/deploy/env; DB read-only.

## 14. PRE-BUILD PLAN-AUDIT RESOLUTION (closed in-session 2026-06-13; for ② traceability)
HIGH-STAKES plan audit: 4 lens-distinct opus reviewers @ xhigh (correctness/on-chain-semantics ·
fail-mode/liveness · spec-conformance/scope · test-double fidelity), coverage mode, via Agent-tool
spawns (operator did not opt into a Workflow this turn). 0 findings invalidated the fix; all sustained
findings hardened the spec and are FOLDED above. Integrator re-confirmed each against the live tree
before folding. Folded:
- **L2-F1 (HIGH, liveness)** → §6 LB-2 raised the founder RPC requirement to a HARD precondition +
  §5 step 5 adds the in-process `reconcile.expiry_anchor_degraded` stall detector. (Adversarially
  weighed: real but provider-dependent; pinning stays the correct fix, backstopped not abandoned.)
- **L4-F2 (HIGH, untested threading)** → §9 test 3 (the `mockNonceState` 4th-arg assertion).
- **L4-F1 (HIGH, vacuous pin assertion)** → §9 test 1 (concrete bigint, no `undefined`/3-arg).
- **L4-F4 (HIGH, evidence-shape ripple)** → §5 step 3 (scalar `.ts` at gate `:581`, evidence `:619-622`,
  log `:629`) + §9 test 4 (keep R-V13's number assertion as the scalar guard).
- **L4-F3 (HIGH, stale-mock false-green)** → §9 test 4 (enumerated literal sites + undefined-compare warning).
- **L2-F3 (med-high, observability)** → §5 step 5 + §9 test 6. **L1-F1 (med, proof overclaim)** → §6 LB-1
  restated (transfer-consume scope + cancel lemma) + the `:587` comment fix mandated. **L3-F1 (med,
  un-enumerated test file)** → §5 step 4 now DEFERS the optional ledger evidence field (keeps the
  evidence shape frozen; `terminal-transition.test.ts` stays untouched). **L4-F5/F6 (med)** → §9 tests 2/7.
- **Verified SOUND by the audit (no change):** strict 2s timestamp monotonicity on Base; viem pinned-
  read end-of-block semantics; cross-replica "correct-or-`unknown`, never wrong" closure; per-network-
  shared-N exactness for every per-row vb; all §4–§11 file:line citations; frozen `publicClientFor`
  protection; the scope exclusions (§8); the (W)-vs-V-N4 file-set disjointness (HEAD `b3b1e175`).
- **Low/wording (record only):** transport-isolation pins `publicClientFor` indirectly (L3-F2); minor
  §9 line-cite off-by-one (L3-F3); "provably exact" tempered re the quarantine arm (L1-F2).
