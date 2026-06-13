# (V) Pending-row lifecycle — SCOPE-CONFIRM TRACE (2026-06-11)

> ① artifact. Ground state: the (U) close commit `adb1e849` atop `f7a15925`, tree clean
> (verified this session). Every file:line below was read in-session from that tree.
> Scope authority: `v-pending-lifecycle-handoff-2026-06-11.md` §1.

## (a) CENSUS

### a.1 `markSettlementBroadcast` callers (ledger.ts:627 — WHERE pending, NO ref conjunct)
Exactly **6** production call sites (MECHANICAL census, probe P1a — the hand census initially
said 4 and missed the two broadcast-unconfirmed arms; recorded as a DC-15 lesson):
| # | Site | Actor context | txHash passed |
|---|------|---------------|---------------|
| 1 | `circle-nano/settle.ts:258` (onBroadcast) | the actor that JUST broadcast this tx (fresh submit or recovery resubmit T1→T2) | the freshly-broadcast hash |
| 2 | `x402/orchestrate.ts:362` (onBroadcast) | same, x402 rail | same |
| 3 | `circle-nano/settle.ts:165` (reverted+nonceConsumed arm of applyOutcome) | holder of a REVERTED receipt for OUR tx; a DIFFERENT (untracked) tx consumed the nonce | OUR reverted hash |
| 4 | `x402/orchestrate.ts:206` (same arm, x402) | same | same |
| 5 | `circle-nano/settle.ts:174` (broadcast-unconfirmed arm of applyOutcome) | holder of an UNCONFIRMED result — fresh path (txHash = our just-broadcast tx, row ref NULL/own-hash via onBroadcast) or recovery path (txHash = the STORED ref, same-value write) | the unconfirmed hash |
| 6 | `x402/orchestrate.ts:226` (same arm, x402) | same — and the arm P8(g) newly routes the failed-nonce-recheck case through | same |
Sites 3-6 all live INSIDE the two applyOutcomes and are reachable from both the fresh-submit
path (`submitCircleNanoOnChain` → `interpretReceipt`) and the recovery path
(`confirmCircleNanoTx` on the STORED ref — txHash === the row's current ref by construction,
so the write is covered by the own-hash disjunct). The LB-2 matrix (§c) and the variant
wiring therefore cover sites 5/6 with the SAME expectedPrior threading as 3/4 (one options
param on applyOutcome reaches all four interior sites).

### a.2 Pending-row writers (status='pending' through `recordSettlementEntry`)
- `circle-nano/settle.ts:88-121 ensurePendingRow` — metadata: {method, latencyMs,
  settlementType:'real-time', network, payer, toolId, authorizedValueBaseUnits}. **proof in
  scope ✓; validBefore NOT stored (P5-i adds it).**
- `x402/orchestrate.ts:134-167 ensurePendingRow` — metadata: {method, settlementType:'on-chain',
  scheme:'exact', network, payer, toolId, authorizedValueBaseUnits}. **proof in scope ✓.**
- `sessions.ts:488 recordSettlementEntryAsync` (hop rows, status 'pending') — **(H)-guarded:
  `isReconcilableRail` rails are excluded by construction** (sessions.ts:470); hop rows ride
  NON-reconcilable rails only → OUTSIDE every (V) surface. No other pending writers
  (ap2 route writes 'settled' synchronously).
- Writes are idempotent first-write-wins (deterministic id + ON CONFLICT DO NOTHING,
  ledger.ts:465) → **a retry CANNOT add validBefore to a pre-existing row** — pre-(V) rows
  stay validBefore-less forever = the legacy class (b.4).

### a.3 Pending-row readers
`findSettlementRow` (both orchestrators' idempotency reads + mirror/broadcast-evidence
re-reads; reconciler stale-ref disambiguation reconcile.ts:196), the reconciler window
SELECT (reconcile.ts:579-614, `isNotNull(externalRef)` — **null-ref rows NEVER enter it**),
the overdue aggregate (:545-558, includes null-ref rows as noTxhashCount), the uncredited
sweep (settled-only), `verifyLedgerIntegrity` (settlement rows excluded-list S1-52).

### a.4 `interpretReceipt` consumer arms (LB-3 blast radius — the COMPLETE set)
`interpretReceipt` is reached ONLY via `submitCircleNanoOnChain` (engine:237) and
`confirmCircleNanoTx` (engine:255). Their only consumers (grep-verified): the two
orchestrators, each at exactly 2 sites:
1. **applyOutcome** (settle.ts:124 / orchestrate.ts:170): 'reverted'+nonceConsumed:false →
   `markSettlementFailed` + buyer `failed/…REVERTED/402` (settle.ts:169, orchestrate.ts:216);
   'broadcast-unconfirmed' → `markSettlementBroadcast` + buyer
   `pending/…PENDING_CONFIRMATION/502` (settle.ts:173-177, orchestrate.ts:225-235). Both
   rails' broadcast-unconfirmed arms are ALREADY the safe shape P8(g) retargets onto ✓
   (re-verified, not inherited from the ③ VERDICT).
2. **The recovery predicate** `storedTxDefinitivelyFailed = kind==='reverted' &&
   !nonceConsumed` (settle.ts:284, orchestrate.ts:351). **⚠ P8(g) DELTA BEYOND THE FAILED
   FLIP**: today a failed nonce-recheck during RECOVERY reads as "definitively failed" →
   falls through to a FRESH SUBMIT on incomplete evidence (could double-broadcast while the
   prior tx's nonce state is unknown — gas waste + ref churn; funds-safe only because USDC
   enforces (from,nonce)-once). After P8(g) it reads broadcast-unconfirmed → applyOutcome →
   row stays pending, NO resubmit this request. SAFER direction, but it is a second
   behavioral face of the one-branch change — the plan MUST test it on both rails.
3. **Buyer-facing**: kernel route (circle-nano/settle/route.ts:184-193) and proxy
   (route.ts:1941/2094) consume `outcome.status/httpStatus/code` GENERICALLY — non-settled →
   error response with the outcome's code. P8(g) shifts that buyer verdict from
   `402 …SETTLEMENT_REVERTED` (terminal lie under incomplete evidence) to
   `502 …PENDING_CONFIRMATION` (retryable truth). No structural consumer change. **(R2-imp16
   correction: the orchestrator's pending OUTCOME carries txHash (orchestrate.ts:233) but
   BOTH routes' error envelopes DROP it — the buyer-visible delta is exactly
   status/code/reason; no later chunk may assume "the buyer already holds the hash".)**
   `X-SettleGrid-Tx-Hash` (route.ts:1960/2114) is emitted on settled outcomes only →
   P8(f)'s surface.

### a.5 Null-external_ref pending row classes (code-derived; prod row check = founder-side,
DB creds not assumed in-session — categorize-by-metadata query included in §g for the close)
| Class | Producer | metadata shape | validBefore recoverable? |
|---|---|---|---|
| submit-error (RPC/gas-wallet) | both rails, engine 'submit-error' → applyOutcome leaves row untouched (ref NULL) | full ensurePendingRow shape | post-(V) rows: yes (P5-i); legacy: NO |
| insufficient-balance (the unfunded-wallet x402 class — P5's headline) | engine pre-check; row already written | same | same |
| nonce-already-used | engine pre-check guard 1 | same | same |
| pre-broadcast process kill | kill between ensurePendingRow and onBroadcast | same | same |
| legacy hop rows on on-chain rails | pre-(H) sessions writes (bare-UUID opid) | hop shape, opid UNPARSEABLE | NO — and from/nonce unparseable either → quarantine-classify only |
The opid parse (reconcile.ts:90-91) recovers (network, from, nonce) for BOTH rails on every
properly-formed row — so the expiry pass can do the nonce read even on legacy rows; what it
can NEVER recover is validBefore (not in the opid) → the legacy arm quarantines, never
guesses (handoff §1.2 verbatim).

## (b) LB-1 PROOF-OBLIGATION WALK — evidence state × actor → verdict
The invariant: terminal 'failed' requires BOTH (i) provably-expired AND (ii)
nonce-unconsumed-NOW. **Soundness (R1-B3 corrected — the wall clock is NOT the proof
carrier):** USDC FiatTokenV2 requires `block.timestamp < validBefore` to mine
`transferWithAuthorization` (§e), and consensus requires block timestamps to be strictly
increasing — so once an OBSERVED SAFE-HEAD block (reorg-immune; the plan's safe-tag fold) carries `timestamp > validBefore`, every
future block does too and **no future block can consume the nonce**: unconsumed-NOW is
unconsumed-FOREVER. The draft's wall-clock-margin version was REFUTED by the audit: a Base
sequencer stall > margin produces catch-up blocks whose timestamps lag wall-now by the
stall length and which DO mine queued pre-expiry txs — wall-expired ≠ chain-expired. The
predicate therefore anchors conjunct (i) to CHAIN time (one bounded `getBlock('safe')` —
the L1-derived safe head, immune to unsafe-head reorgs; lag is skip-direction —
read per candidate network per pass; failure → that network's candidates stay pending) and
keeps the wall-clock `now > validBefore + 300s` test only as the cheap candidate
PRE-FILTER. Conjunct (ii)'s read must happen-after (i) is chain-established. **Race-freedom
(R2-B5 corrected — the draft's "race-free by construction" was FALSE as written):** the
flip is race-free against any broadcast whose onBroadcast has COMMITTED (the IS-NULL
conjunct) AND against any re-sign whose refresh has COMMITTED (the writer's
validBefore-equality CAS — the flip CASes on the exact bound it proved expiry against);
the residual read-to-refresh sliver resolves via the refresh's boolean: a flip landing
first leaves the row failed PRE-broadcast and the orchestrator's refresh-false abort
returns terminal without submitting — no ordering moves funds onto a terminal row. ② must
audit the REALIZED WHERE against this interleaving: pass reads vb1 → buyer re-signs,
refresh commits vb2 → writeContract broadcasts, onBroadcast not yet committed → pass
(≤20.15s into bounded reads) proves chainTs>vb1 + unconsumed → the flip must match 0 rows
(validBefore CAS). **Premise guard (R1-B4):** stored
metadata.validBefore must bound EVERY authorization ever broadcast for the row — EIP-3009
allows re-signing the same (from,nonce) with a later validBefore and the idempotent
first-write-wins INSERT would hold the stale bound; both orchestrators therefore REFRESH
the stored value to GREATEST(stored, proof.validBefore) before every submit. **Value guard
(R1-B2):** a present-but-malformed validBefore (NaN, '', '0', non-canonical) must
quarantine as 'unparseable' BEFORE any expiry comparison — `Number()` NaN/zero coercions
otherwise fall into the expired arm.

**⚠ TABLE PARTIALLY SUPERSEDED (R2-imp7, DC-15):** rows below encode the DRAFT wall-clock
predicate; the AUDITED predicate (the plan's Batch 4a, canonical) inserts the
canonical-integer guard (malformed vB ⇒ quarantine 'unparseable'), the unsupported-network
arm, AND the chain-time anchor (`safeTs > vB` required between the wall-clock pre-filter
and the nonce read; safe-read null/≤vB ⇒ stay pending/skip) — and the terminal flip CASes
on {ref IS NULL ∧ validBefore = proved}. The probe P2 14-cell table is the executable
truth table; this prose table remains for the actor/evidence walk only.
| Row evidence state | Actor: expiry pass | Verdict |
|---|---|---|
| metadata.validBefore present, now ≤ vB+margin | not yet provably dead | SKIP (stays pending; ages into a later run) |
| vB present, now > vB+margin, authorizationState=false | expired AND unconsumed | **terminalize 'failed'** (evidence recorded in metadata; settled_at stays NULL — CHECK-safe) |
| vB present, expired, authorizationState=true | nonce consumed — funds may have moved via an UNTRACKED tx (the P8(b) window just SURFACED), **or the payer canceled** (EIP-3009 `cancelAuthorization` also consumes the nonce — the alert wording must not assert "funds moved"; runbook attributes via (from,nonce) on-chain) | **quarantine-classify + alert**, NEVER 'failed' (a DETECTION WIN) |
| vB present, expired, authorizationState read THROWS | incomplete evidence | stay pending, NO classification ((U) LB-2 rule; re-tries next pass) |
| vB ABSENT (legacy row) | expiry unprovable; never guess | **quarantine-classify 'legacy-no-validbefore' + alert once**; excluded from re-examination (rotation hygiene §d) |
| opid unparseable (legacy hop rows) | nothing recoverable | quarantine-classify 'unparseable'; excluded from re-selection |
| **ADVERSARIAL: mined-then-expired** (writeContract succeeded, onBroadcast died → ref NULL; tx MINED before vB passed) | row looks identical to unfunded-wallet class; ONLY the nonce read distinguishes | authorizationState=true → **quarantine** (must be THE test case of every pass test suite — handoff §2 LB-1 verbatim) |
| Mined-then-expired + RPC down (read throws) | conjunct (ii) unprovable | stays pending — the failure direction that makes the predicate safe |
Other actors: the reconciler NEVER sees these rows (window excludes null ref ✓ a.3); the
live path retries them only via a fresh buyer request (idempotent ensurePendingRow + fresh
submit — unchanged by (V)). The expiry pass is the FIRST and ONLY terminal-transition actor
for the null-ref class — exactly why its predicate is THE funds trap.

Terminalization writer: `markSettlementFailed` is UNUSABLE here (its (T) CAS conjunct
`external_ref = txHash` can never match a NULL ref — ledger.ts:611 comment is explicit).
The pass needs its OWN guarded writer — **⚠ the single-conjunct form below is SUPERSEDED
(R2-B5/R3-imp6); the plan's Batch 1b is canonical:**
`UPDATE … SET settlement_status='failed' WHERE operation_id=? AND rail=? AND
settlement_status='pending' AND external_ref IS NULL AND metadata->>'validBefore' =
<provedValidBefore>` — TWO CAS conjuncts: IS NULL makes the flip lose against ANY broadcast
whose onBroadcast committed (a buyer retry re-pointing the row between our SELECT and our
flip ⇒ ref non-NULL ⇒ 0 rows), and the validBefore-equality makes it lose against ANY
re-sign whose refresh committed (the R2-B5 interleaving — without it the IS-NULL conjunct
alone does NOT defeat a re-signed authorization whose tx is broadcast but whose onBroadcast
has not yet committed). Evidence (the proved validBefore, chainTs, checkedAt) merges in the
SAME statement. Status value 'failed' is in the DB
CHECK's frozen set (schema.ts:981-983) — **quarantine is NOT a status** (the CHECK forbids a
new value without a migration = re-scope STOP): quarantine = metadata marker + alert, row
STAYS 'pending'.

## (c) LB-2 — markSettlementBroadcast caller × ref-state matrix → the variant's conjunct
Cells for the write `markSettlementBroadcast(op, rail, T_new)` against the row's CURRENT ref R:
| Caller | R = NULL | R == T_new | R == T_prior (the ref THIS actor just confirmed dead) | R == OTHER (unknown/winner) |
|---|---|---|---|---|
| 1/2 onBroadcast, FRESH submit (no recovery read) | legit (first broadcast) | no-op rewrite | n/a (actor read no prior) | **CLOBBER — must reject** (a sibling/winner re-pointed mid-request; today silently overwritten) |
| 1/2 onBroadcast, RECOVERY resubmit (actor confirmed T_prior clean-reverted-nonce-free this request) | legit (ref cleared? doesn't happen — ref persists; cell unreachable) | no-op | **legit T1→T2 re-point — MUST keep working** (the (T)-era crash-recovery intent; blocking it = immortal pending, DC-09) | **reject** (a third actor re-pointed after our recovery read — our T_new is a duplicate broadcast racing a live tx; rejecting leaves THEIR ref + our (T) broadcast-evidence alert posture intact) |
| 3/4 reverted+nonceConsumed arm | legit (puts SOME evidence ref on a row entering quarantine territory — gives the reconciler's nonce-consumed recheck a handle) | no-op | same-actor: legit (it IS our stored ref — recovery path passes the stored hash back) | **CLOBBER — the ③-(e) trace: a lock-less loser overwrites a known-good winner ref; if the winner then dies pre-flip the row loops pending-nonce-consumed forever, auto-credit impossible. Must reject** |
**The conjunct:** the variant takes the caller's EXPECTED prior ref and writes
`WHERE pending AND (external_ref IS NULL OR external_ref = T_new OR external_ref =
expectedPrior)` — i.e. compare-and-swap against what THIS actor last read, exactly mirroring
the (T) failed-flip CAS philosophy. Caller wiring: fresh-submit onBroadcast passes
expectedPrior = the `existing.externalRef` read at step 1 (NULL when no row/ref existed);
recovery-resubmit passes T_prior; arms 3/4 pass the ref their confirm ran against (fresh
path: T_new itself — the row holds our own just-broadcast hash; recovery: the stored ref).
A rejected write returns false → callers keep the EXISTING (T) `broadcast_evidence…`/no-op
handling; NO new terminal transition, NO retry loop. ADDITIVE: a new exported variant (or an
optional 4th arg defaulting to today's behavior is REJECTED — silent default = silently
unprotected callers; the plan makes all 6 sites pass it explicitly (R2-imp6 — the matrix's
caller rows 3/4 stand in for all four applyOutcome-interior sites 3-6 of the a.1 census)
and the old 3-arg shape is removed from those sites; the function itself stays for any
out-of-scope callers — there are none, so prefer: extend the signature, update all 6
sites, zero default).
[Exact recipe = the plan's; the matrix above is the licensed decision basis.]

## (d) Expiry-pass placement — IN-RUN bounded step (cron REJECTED)
**Decision: a bounded step INSIDE `reconcilePendingSettlements`, after the two detectors,
before the window SELECT.** Rationale against a new cron: a separate cron adds a route +
auth + vercel.json line + its own Sentry/401/429 surface (P6 debt twice over) for work that
shares the run's transport, rails constant, and operator surface; the register P5 fix shape
("own small chunk + runbook") never asked for a new schedule. Rationale for the position:
(i) detectors-first is PRESERVED — both detectors emit before the pass runs (the (U)
guarantee undiluted; the pinned detector-availability suite must stay green BY ORDER, and
the pass must sit after the sweep+overdue blocks); (ii) the pass must not starve under
examination load — placed AFTER the loop it inherits an empty tail whenever the loop
exhausts the 40s budget, precisely during the degraded weather that mints its candidate
rows. Budget arithmetic: route maxDuration 60s; (U) worst nominal examination = 40s budget
+ ~12.3s in-flight tail ≈ 52s. The pass gets its OWN sub-budget and row cap:
**EXPIRY_PASS_LIMIT = 3 rows, EXPIRY_PASS_BUDGET_MS = 14_000** (raised from the draft's 8s
by the R1 audit's B3 fix — the pass now also carries one bounded chain-time read per
candidate network; worst-case 2 bounded reads = 12.3s fit). ~~deadline = passEnd +
(runBudgetMs − passElapsed)~~ **SUPERSEDED (R1 I1, DC-15): the `examinationDeadline` stays
computed exactly where (U) computes it (reconcile.ts:470, byte-identical) and is NOT
recomputed** — the pass's elapsed time then debits the shared 40s envelope automatically
(detector time already does the same today), keeping the 60s route ceiling intact. [Final
constants = plan's; the structure is the trace decision.] Rotation hygiene INSIDE the pass
(the (S)/DC-09 lesson): candidates = pending + reconcilable rail + `external_ref IS NULL` +
created_at < cutoff + NOT already quarantine-classified (jsonb marker filter), ordered
`COALESCE(last_reconciled_at, created_at) ASC` with per-row mark-before-examine — null-ref
rows never enter the (U) window, so reusing the watermark column cannot perturb the (S)
rotation (disjoint row sets BY the window's isNotNull predicate); quarantined rows are
excluded from re-selection entirely (else the bounded LIMIT re-feeds the permanently-stuck
head every run — the exact (S) starvation shape). The (S) suite stays byte-green: window
WHERE/ORDER untouched.

## (e) validBefore ground truth (DC-04 — read from the tree, not recalled)
- Vendored ABI (`x402/verify.ts` EIP3009_ABI): `validBefore`/`validAfter` are `uint256`;
  `authorizationState(authorizer address, nonce bytes32) → bool`; `cancelAuthorization`
  exists (⇒ consumed-nonce ≠ funds-moved — quarantine wording must stay attributive).
- Authorization values are decimal-string EPOCH SECONDS: the offline verifier compares
  `parseInt(authorization.validBefore,10)` against `now = Math.floor(Date.now()/1000)`
  (verify.ts:283-300); the engine BigInts the same strings for the on-chain args
  (settle-engine.ts:169-175). ~~P5-i stores the RAW STRING~~ **⚠ SUPERSEDED (R4-B7 → plan
  Batch 1c/3a): P5-i stores `BigInt(vb).toString(10)` — canonical decimal.** The
  settle-path verifier is `circle-nano/verify.ts` (BigInt — accepts hex/octal prefixes);
  `x402/verify.ts`'s parseInt is the facilitator-route verifier only. A raw-stored hex
  value would fail the pass's `^\d+$` guard and permanently quarantine a live retryable
  row.
- Contract semantics: USDC FiatTokenV2 requires `block.timestamp < validBefore` to mine
  (EIP-3009; engine header records ground-truthing vs the LIVE Base contracts 2026-05-30,
  regression-pinned by `__tests__/onchain-constants.test.ts`). The pre-build audit's
  mechanical probe re-verifies the comparison direction + uint sizes against the vendored
  ABI. **(R1-B3 superseded the margin's role:** the wall-clock test `nowSec >
  Number(metadata.validBefore) + 300` is the cheap PRE-FILTER only; the proof obligation is
  the chain-time anchor `safeBlock.timestamp > validBefore` read on the bounded
  reconciler client — see §b.)
- ⚠ `Number()` on the seconds string is exact (≤ 2^53); BigInt unnecessary in the pass —
  but the value must first pass the canonical-integer guard (R1-B2: `/^\d+$/` + finite +
  > 0), else quarantine 'unparseable'.

## (f) DC-05 forced-test sweep (suites/harnesses modeling the touched chains)
| Suite | Models | (V) impact |
|---|---|---|
| `circle-nano/__tests__/settle.test.ts` | orchestrator w/ mocked engine+ledger | P8-a/e/f + P8(g)-recovery arms; new ensurePendingRow metadata assert; mocks of markSettlementBroadcast gain the new arg — **forced** |
| `x402/__tests__/orchestrate.test.ts` | x402 twin | same — **forced** |
| `circle-nano/__tests__/settle-engine.test.ts` | engine w/ mocked viem | P8(g) expectation FLIP (reverted-branch catch → broadcast-unconfirmed) = the red/green proof — **forced** |
| `__tests__/reconcile.test.ts` | reconciler w/ mocked engine; `selectPlan.seq` db-mock dispatch BY CALL ORDER (:143-167 et al) | expiry pass inserts SELECT/UPDATE calls into the run's db sequence → **seq arrays + ordinals shift — forced**; P8-c arm tests |
| `__tests__/terminal-transition.test.ts` | CAS/flip WHEREs against emitted SQL | MAY open (P8-c/e surface); every edit needs moved-vs-changed + per-assertion license (handoff §3) |
| PINNED zero-diff: `reconcile-starvation`, `transport-isolation`, `reconcile-detector-availability` | (S) rotation / LB-1-(U) / detectors-first | the expiry pass must not perturb: window WHERE/ORDER byte-stable; detectors stay first; live transport untouched |
| Route suites: `cron/settlement-reconcile`, `circle-nano route.test`, proxy `x402-proxy-settlement` + `circle-nano-proxy-settlement` + `billing-credits` | buyer-facing mapping + cron summary | summary shape: the pass adds fields? — NO: keep `ReconcileSummary` IDENTITY (handoff behavior-pin) → pass telemetry via its own log keys only; route suites unaffected unless asserting log calls |
| `onchain-constants.test.ts` | ABI ground-truth pins | read-only reference for the audit probe |

## (g) Founder-side at close (not blocking)
One read-only prod query (categorize the live null-ref inventory before the runbook update):
`SELECT rail, metadata->>'toolId' IS NOT NULL AS has_tool, metadata ? 'validBefore' AS has_vb,
count(*) FROM ledger_entries WHERE settlement_status='pending' AND external_ref IS NULL
AND rail IN ('circle-nano','x402') GROUP BY 1,2,3;`

## Scope-confirm VERDICT
The handoff §1's six faces map onto exactly the surfaces censused above; no face requires a
migration (metadata jsonb ✓ schema.ts:26-of-ledgerEntries; status CHECK untouched ✓); no
face touches the (U) spine (transport/detectors/rotation byte-stable — the expiry pass is
additive-after-detectors); the two riders' files open (settle-engine.ts ✓ P8(g);
reconcile.ts ✓ P5-ii) so BOTH riders are licensed. TIER: HIGH-STAKES RE-CONFIRMED — all
five §2 triggers still fire on the realized shape. Scope = CONFIRMED as charted.
