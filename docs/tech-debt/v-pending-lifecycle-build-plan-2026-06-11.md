# (V) Pending-row lifecycle — BUILD PLAN (2026-06-11) — DRAFT until the pre-build audit passes

> Recipes derive from `v-pending-lifecycle-trace-2026-06-11.md` (census/LB matrices) + this
> session's reads of every touched file. Tier HIGH-STAKES (re-confirmed at trace). The bar =
> handoff §1 verbatim. NO migration (jsonb metadata; status CHECK untouched — schema.ts:981).
> **No vercel.json change** — the expiry pass is an in-run step (trace §d; flagged per handoff).

## File set (the ONLY files numstat may show; + docs)
`apps/web/src/lib/settlement/`: `ledger.ts` · `circle-nano/settle-engine.ts` ·
`circle-nano/settle.ts` · `x402/orchestrate.ts` · `reconcile.ts` ·
`__tests__/reconcile.test.ts` · `__tests__/terminal-transition.test.ts` (licensed per-assertion)
· `circle-nano/__tests__/settle-engine.test.ts` · `circle-nano/__tests__/settle.test.ts` ·
`x402/__tests__/orchestrate.test.ts`. PINNED ZERO-DIFF: `__tests__/reconcile-starvation.test.ts`,
`circle-nano/__tests__/transport-isolation.test.ts`,
`__tests__/reconcile-detector-availability.test.ts`.
Canonical wiring note (R1-N2): where the trace §c sketches the fresh-path nonceConsumed-arm
expectedPrior as "T_new itself", THIS plan's `null` is canonical (predicate-equivalent — the
own-hash disjunct covers it).

## Batch 1 — ledger.ts: the no-clobber CAS + the expiry terminalization writer
**1a. `markSettlementBroadcast` gains a 4th required param** `expectedPriorRef: string | null`
(NO default — a silent default = silently unprotected callers; all **6** prod sites wired in
Batch 3: the two onBroadcasts + the four applyOutcome-interior sites — the
reverted+nonceConsumed arms AND the broadcast-unconfirmed arms, both rails; probe P1a). WHERE becomes: pending AND rail/op match AND
(`external_ref IS NULL` OR `external_ref = txHash` OR [expectedPriorRef !== null:
`external_ref = expectedPriorRef`]). Drizzle: conditional `or(isNull(...), eq(..., txHash),
...(expectedPriorRef ? [eq(..., expectedPriorRef)] : []))`. Returns true iff a row updated
(unchanged contract). Doc comment: the LB-2 matrix cells (trace §c) — loser-clobber rejected,
same-actor T1→T2 re-point preserved, NULL always writable.
**1b. NEW writer `markSettlementExpiredNoBroadcast(operationId, rail, provedValidBefore,
evidence)`** (R2-B5 — the evidence-CAS): UPDATE SET settlementStatus='failed', `metadata =
COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('expiredTerminalized', <evidence:
{chainTs, checkedAt}>)` WHERE op/rail match AND `settlement_status='pending'` AND
`external_ref IS NULL` AND **`metadata->>'validBefore' = ${provedValidBefore}`** — TWO CAS
conjuncts: IS-NULL defeats any broadcast whose onBroadcast committed (a row that just
acquired a live tx), and the validBefore-equality defeats any re-sign whose refresh
committed (the R2 interleaving: pass reads vb1 → buyer re-signs, refresh commits vb2 →
pass proves expiry against STALE vb1 → without this conjunct the flip lands while the vb2
tx is broadcastable — the DC-06 lesson verbatim: a terminal flip must CAS on the evidence
it was keyed to). 0 rows ⇒ do-nothing; next run re-proves against the raised bound
(GREATEST refresh is monotone ⇒ converges — no DC-09 immortality). The evidence merge
rides the SAME statement (R2-imp8: the trace promised persisted terminalization evidence;
one statement, no second write). settled_at untouched (CHECK-safe: failed ⇒ NULL ✓).
external_ref stays NULL (no hash exists — honest). Returns boolean. Doc: callers must have
PROVEN chain-expired+unconsumed first (LB-1); this writer enforces the never-broadcast +
same-evidence preconditions structurally.
**1c. NEW writer `refreshPendingValidBefore(operationId, rail, validBefore)` (R1-B4,
R3-B6-corrected: RAISE-ONLY, never CREATE):** guarded UPDATE WHERE pending, SET
`metadata = CASE WHEN metadata ? 'validBefore' THEN COALESCE(metadata, '{}'::jsonb) ||
jsonb_build_object('validBefore', GREATEST((metadata->>'validBefore')::numeric,
<validBefore>::numeric)::text) ELSE metadata END` — the stored bound must cover EVERY
authorization ever broadcast for the row (EIP-3009 allows re-signing the same (from,nonce)
with a later validBefore; the idempotent INSERT is first-write-wins, so without the refresh
a retry under vb2 ≫ vb1 leaves the pass proving expiry against the WRONG bound). **The CASE
presence-guard is R3-B6:** an unconditional GREATEST(COALESCE(…,0), vb_new) would CREATE a
first bound on a legacy pre-(V) row from the retry proof alone — and that bound provably
cannot cover the row's ORIGINAL pre-(V) authorization (vb_orig is unknowable,
buyer-controlled, unbounded above; verifiers reject only `now > validBefore`), so the pass
could terminalize while the vb_orig tx is still mineable — the LB-1 forbidden end state.
Legacy rows keep NO bound and stay permanently quarantine-classified (`'legacy-no-
validbefore'` is PERMANENT BY CONSTRUCTION — the R2-imp9 marker-strip is DROPPED;
founder/runbook resolves the finite legacy inventory per handoff §1.2). Post-(V) rows lose
nothing: P5-i writes the bound at INSERT; GREATEST covers every later re-sign. The
COALESCE(metadata,…) wrap inside the THEN arm is the R1-B1 NULL-strictness rule (a
metadata?-true row is non-NULL, but keep the wrap for uniformity with the shared helper).
**Canonicalization (R3-imp1):** both verifiers accept BigInt-parseable strings incl.
hex/octal prefixes, but `::numeric` throws on those — P5-i AND the refresh param store/pass
`BigInt(proof.authorization.validBefore).toString(10)` (normalize at source), and the
stored-value cast is defensively regex-guarded inside the SQL. Idempotent re-run = no-op
(GREATEST + CASE). **Returns boolean (rows > 0;
R2-B5b):** the WHERE-pending guard means `false` ⇒ the row went TERMINAL between our step-1
read and now (incl. the expiry pass's flip landing before the refresh — the other ordering
of the R2 interleaving); both orchestrators on `false` re-read `findSettlementRow` and
return the P8-a-shaped terminal outcome instead of submitting (row failed pre-broadcast →
buyer told failed, no funds move — the closure is TOTAL across both orderings). A legacy
row (no stored bound) returns true via the CASE no-op merge and proceeds to submit exactly
as today. ~~The merge also STRIPS `expiryClass`…~~ **(R2-imp9 REVOKED by R3-B6:**
re-admitting a legacy row to the candidate set under a CREATED bound is exactly the B6
trap; the legacy class is permanent — no strip, ever). Called by both orchestrators
immediately after ensurePendingRow (Batch 3a); a throw propagates exactly like
ensurePendingRow's (pre-submit DB write — fail-closed, no money has moved).
**Tests (terminal-transition.test.ts — executes emitted SQL; per-assertion license):**
- R-V1 (red-pre-fix): loser `markSettlementBroadcast(op, rail, T_loser, null)` vs row
  ref=T_winner → row ref UNCHANGED (red today: 3-arg fn overwrites).
- R-V2 (must pass pre+post — the DC-09 zombie-inverse pin): same-actor re-point
  `(op, rail, T2, T1)` vs row ref=T1 → lands.
- R-V3: ref NULL + `(op, rail, T1, null)` → lands.
- R-V4 (red): `markSettlementExpiredNoBroadcast` vs ref-NULL pending row (matching vb) →
  failed + evidence merged; vs ref-bearing pending row → 0 rows + stays pending; vs settled
  row → 0 rows; **(R2-B5 cell, red-pre-fix): row whose metadata.validBefore was concurrently
  raised to vb2 while the caller proved vb1 → 0 rows, row stays pending.**
- R-V4b (red — R2-B5b + R3-B6): `refreshPendingValidBefore` vs a pending row WITH a stored
  bound → true + raised; vs a terminal row → false (0 rows); **(R3-B6 cell, red-pre-fix
  against the unconditional-GREATEST form): legacy pending row (NO stored validBefore) +
  refresh(vb_new) → returns true BUT metadata still has NO validBefore and keeps its
  expiryClass — the pass still quarantines it 'legacy-no-validbefore'.**
  **Assert style for V4/V4b (R3-imp5):** status flips stay state-executed; the
  evidence/GREATEST/CASE merge outcomes are SHAPE-asserted via the raw SET node read off
  the mutated row (the harness writes SET nodes verbatim at terminal-transition.test.ts:207;
  no set-arg spy exists) — same license as R-V22.
**Harness license (explicit, per-assertion):** the terminal-transition evaluator handles
and/eq/inArray/isNotNull/isNull/lt ONLY — R-V1..V3's `or(...)` WHERE needs (i) `or` added to
its drizzleMock factory and (ii) an `'or'` case in `evalWhere` (PG-faithful: `args.some`);
ledger.ts itself gains `or, isNull` in its drizzle-orm import (check the suite's drizzle-orm
factory carries both keys). **R-V4's validBefore-CAS conjunct additionally needs ONE
jsonb-text-eq `'sql'` case in `evalWhere`** (match the raw `metadata->>'validBefore' = $`
node → compare `row.metadata?.validBefore` as text — same licensed-extension discipline as
the or-node). **R-V22's refresh cell is SHAPE-ASSERTED, not executed (R2-imp2):** the
suite's update mock assigns raw-sql SET nodes verbatim, so executing GREATEST/COALESCE
would need a jsonb-SET evaluator — over-license; instead assert the emitted SET's SQL
strings/params carry the COALESCE wrap + GREATEST + ::text shape, with monotonicity resting
on PG semantics (the writer-level no-op-second-time property is covered for the
plain-SET writers, which stay state-executed). Moved-vs-changed: every existing assertion
in the suite stays byte-identical.
⚠ tsc breaks at every existing 3-arg call site the moment 1a lands → Batches 1+3 commit-unit
must compile together; build order runs 1a tests via the table harness first (red), then
wires callers (Batch 3) before the full-gate. [Forced edits **(census corrected per R1-N1 =
probe P6f)**: existing `toHaveBeenCalledWith(OP_ID, rail, hash)` asserts at
settle.test.ts:148,157 + orchestrate.test.ts:200 gain the 4th arg (settle.test.ts:257 is a
`mockResolvedValue(false)` — NO edit); re-enumerate ALL assert styles at build via grep
(`toHaveBeenCalledTimes`/`not.toHaveBeenCalled` need no edit).]
Also add R-V22 (pass pre+post, DC-06/DC-17): same-args re-runs of the variant, of
`markSettlementExpiredNoBroadcast`, and of `refreshPendingValidBefore` are no-ops the
second time (table-harness cells).

## Batch 2 — settle-engine.ts: P8(g) + the bounded nonce reader + the docstring rider
**2a. P8(g) (the (U)-③ HIGH):** `interpretReceipt`'s reverted-branch nonce-recheck CATCH
(:347-353) returns `{ kind: 'broadcast-unconfirmed', txHash, reason:
'revert-nonce-unverifiable' }` instead of falling through with nonceConsumed:false. Union
extension (additive): `broadcast-unconfirmed.reason: 'timeout' | 'rpc-error' |
'revert-nonce-unverifiable'`. Both orchestrators' arms already map the kind to pending +
markSettlementBroadcast (trace a.4.1 re-verified) and log `result.reason` through. **Known
second face (trace a.4.2): the recovery predicate `storedTxDefinitivelyFailed` now reads the
catch case as NOT-definitively-failed → no fresh resubmit on incomplete evidence (safe
direction; tested 3c).**
**2b. NEW exports (both on `reconcilerPublicClientFor` — the (U) bounded transport, NEVER
the live client; both NEVER throw — failure direction encoded in the type, DC-08):**
`readAuthorizationStateBounded(network, from, nonce): Promise<'consumed'|'unconsumed'|'unknown'>`
('unknown' on any error/unsupported network) and **(R1-B3)**
`readSafeBlockTimestampBounded(network): Promise<number | null>` — `getBlock({ blockTag:
'safe' })` → `Number(block.timestamp)` (seconds); null on any error/unsupported
**[⚠ SUPERSEDED: the SEALED reader adds the ② F-1 finite/positive guard AND the ③ finding-8
UPPER plausibility clamp (`> now + 900s` → null); the bare `Number(block.timestamp)` here is
the pre-seal shape. See `.audit/v-seal/SEAL.md` (F-1) + `.audit/v-deep/VERDICT.md` (finding 8).]**
network/unsupported tag. The block read is the expiry pass's CHAIN-TIME anchor: consensus
timestamps are strictly increasing, so an observed `timestamp > validBefore` proves no
future block can mine the authorization — wall-clock expiry alone was REFUTED
(sequencer-stall catch-up blocks mine queued txs with past timestamps; R1-B3). **blockTag
'safe', not 'latest' (builder-fold atop R1-B3):** the OP-stack unsafe head can reorg — an
observed latest-tip timestamp > validBefore could vanish and the canonical chain still
mine the tx; the L1-derived safe head cannot (its minutes-scale lag is immaterial at a
15-min cadence on rows hours old, and the failure direction of a lagging safe head is
skip/stay-pending — never a wrong terminalization). The deep reorg-policy question stays
register-P9 (founder) — this choice is the locally-airtight one for THIS predicate.
**2a-note (R1-I9):** the `broadcast-unconfirmed` doc comment ("The tx MAY still confirm",
engine :78) becomes false for the new reason — add the (U)-style caveat line (twin of the
:269-272 note): 'revert-nonce-unverifiable' = a CONFIRMED-reverted receipt whose nonce
recheck failed; pending-side because the EVIDENCE is incomplete, not because the tx may
confirm. Behavior unaffected (all consumers reason-opaque — verified by the R1 audit).
**2c. Rider (P7/critic-C5):** fix the `confirmSettlementTx` doc lines (:282-284) — x402 DOES
carry (from,nonce) in its opid and passes eip3009 (reconcile.ts:103-109); the "x402 omits
eip3009, revert is a plain failure" claim is stale.
**Tests (settle-engine.test.ts):**
- R-V5 (red-pre-fix — THE P8(g) proof; no existing test pins the catch path on
  interpretReceipt): submit path, receipt reverted, recheck REJECTS (mockReadContract
  implementation: authorizationState call #2 throws — call #1 is the pre-submit guard) →
  expect `{kind:'broadcast-unconfirmed', txHash:'0xTX', reason:'revert-nonce-unverifiable'}`
  (today: `{kind:'reverted', nonceConsumed:false}` — red AT the assert). **Twin via
  `confirmCircleNanoTx` needs its OWN mock shape (R1-I8): no pre-submit guard runs there, so
  the recheck is authorizationState call #1 — use a plain
  `mockReadContract.mockRejectedValue` + reverted receipt.**
- R-V6: `readAuthorizationStateBounded` — true→'consumed', false→'unconsumed',
  throw→'unknown', unsupported network→'unknown'; `readSafeBlockTimestampBounded` —
  block→Number(timestamp) **with the positive cell asserting `getBlock` was called with
  `{ blockTag: 'safe' }`** (the safe-tag fold's ONLY pin — R2-imp1), throw/unsupported→null.
  **TWO forced factory edits in settle-engine.test.ts:** (R1-I3) wrap `http` as a `vi.fn`
  passthrough and assert `mockHttp.mock.calls[n][1]` deep-equals
  `{timeout: RECONCILER_RPC_TIMEOUT_MS, retryCount: RECONCILER_RPC_RETRY_COUNT}` (mirroring
  transport-isolation.test.ts:135-138's technique WITHOUT editing that pinned file); and
  (R2-imp1) the harness's mocked client gains a hoisted `mockGetBlock` + `getBlock` key
  (today absent — without it the safe reader can only ever return null in that harness and
  the positive cell is red POST-fix).

## Batch 3 — both orchestrators: P5-i + P8-a + P8-e wiring + P8-f
Symmetric edits (settle.ts / orchestrate.ts):
**3a. P5-i:** ensurePendingRow metadata gains `validBefore:
BigInt(proof.authorization.validBefore).toString(10)` (**canonical decimal seconds —
R3-imp1/R4-B7; supersedes the draft's raw-string form:** the settle-path verifier is the
circle-nano BigInt one, which accepts hex/octal-prefixed strings today — stored raw, such a
value would fail the pass's step-2.5 `^\d+$` guard and permanently quarantine a LIVE
retryable row; idempotent writer ⇒ legacy rows stay without ✓) —
**plus (R1-B4) an awaited `refreshPendingValidBefore(operationId, RAIL,
BigInt(proof.authorization.validBefore).toString(10))` (canonicalized per Batch 1c
R3-imp1; R5 kickoff edit) immediately after ensurePendingRow in BOTH orchestrators**
(covers fresh AND recovery flows; the INSERT is first-write-wins so the refresh is the only
writer that can raise a stale stored bound). **(R2-B5b) On `false` (the row went terminal
between the step-1 read and the refresh — incl. the expiry flip landing in that sliver):
re-read `findSettlementRow` and return the P8-a-shaped terminal outcome (failed →
PREVIOUSLY_FAILED-shaped; settled → settled alreadySettled; null → the failed-shaped
outcome) — NO submit. This plus the writer's validBefore-CAS closes BOTH orderings of the
refresh-vs-flip race; the residual (flip lands first) leaves the row failed PRE-broadcast —
no funds move, buyer told failed, total.**
**3b. P8-e wiring (6 sites):** onBroadcast (settle.ts:258 / orchestrate.ts:362) passes
`expectedPriorRef = existing?.externalRef ?? null` (existing from the step-1 read — capture
in closure); the four applyOutcome-interior sites (reverted+nonceConsumed at settle.ts:165 /
orchestrate.ts:206 AND broadcast-unconfirmed at settle.ts:174 / orchestrate.ts:226) — thread
`expectedPriorRef` into applyOutcome as a new options param: recovery callers pass
`existing.externalRef`; fresh-submit callers pass `null` (NULL/own-hash disjuncts cover the
legitimate cells — trace §c matrix; the recovery broadcast-unconfirmed write is always
own-hash, txHash === stored ref). A rejected write (false) takes the EXISTING (T)
broadcast-evidence/no-op handling — no new control flow.
**3c. P8-a:** in the recovery path, after `storedTxDefinitivelyFailed` and IMMEDIATELY before
the fresh `submitCircleNanoOnChain`: re-read `findSettlementRow`; if status==='failed' →
return the rail's PREVIOUSLY_FAILED-shaped failed outcome (no submit); if 'settled' → return
`{status:'settled', txHash: row.externalRef ?? '', alreadySettled: true}` (no submit; no
credit — alreadySettled). Surviving race (flip lands after our re-read) stays DETECTED by the
(T) alerts — the bar's promise, unchanged.
**3d. P8-f:** the mirror branch (settle.ts:155 / orchestrate.ts:197): when the re-read row is
terminally NON-settled (the mirror case) return `txHash: result.txHash` (the WINNING hash we
hold the receipt for — runbook §3's authoritative hash, now also the response +
`X-SettleGrid-Tx-Hash`); the row-is-settled case keeps `row.externalRef` (the recorded
winner). Exact recipe: `txHash: row && row.settlementStatus !== 'settled' ? result.txHash :
(row?.externalRef ?? result.txHash)`.
**3e (R1-I2 — the ③-(U) F2 fold-on-open trigger DISCHARGED; register note: "fold when the
orchestrator mirror branch opens" — Batch 3 opens those exact arms):** in BOTH rails'
clean-reverted arms (settle.ts:169 / orchestrate.ts:216), READ markSettlementFailed's CAS
boolean (today discarded): on `false`, re-read `findSettlementRow` — still-pending (the CAS
rejected a STALE ref: the live twin of the reconciler's pending-stale-ref) → return the
rail's PENDING_CONFIRMATION-shaped outcome (the row's CURRENT tx may settle; telling the
buyer terminal-'failed' was the F2 lie) + a warn log (`*.settle_reverted_stale_ref`);
terminal 'failed' → keep the failed response (truthful); 'settled' → settled
alreadySettled:true with the row's ref; **row null (typed-nullable, ledger.ts:522) → keep
the failed response (R2-imp12 — the recipe is now total).** On `true` (the flip landed):
byte-identical behavior.
**Tests (settle.test.ts / orchestrate.test.ts — each face on BOTH rails, red-pre-fix):**
- R-V7 (red; **re-specced per R4-B7 — the draft's raw-equality assert was
  fixture-degenerate**): ensurePendingRow metadata contains validBefore ===
  `BigInt(PROOF.authorization.validBefore).toString(10)` AND `refreshPendingValidBefore`
  called with the SAME canonical value right after it (both flows; the ledger factories
  gain the key — vi.fn resolving true). **PLUS one non-canonical cell on the circle-nano
  rail (hex fixture, e.g. validBefore '0x2540BE3FF') asserting the stored/passed value is
  the DECIMAL string — the canonicalization's only red/green coverage.**
- R-V8 (red): recovery resubmit + row re-read returns 'failed' → submitCircleNanoOnChain NOT
  called + failed outcome (mockFindRow.mockResolvedValueOnce(pending-with-ref)
  .mockResolvedValueOnce(failed-row)).
- R-V9 (**R1-I7 corrected — these are licensed expectation FLIPS, not adds**): the two
  (T-seal) mirror tests (settle.test.ts:243 / orchestrate.test.ts:266) `toEqual` the WHOLE
  outcome including `txHash:'0xH1'` (the stored reverted ref) — post-fix the value becomes
  the WINNING hash '0xH2': flip those two literals under explicit license, captured
  red-pre-edit; the suites' '0xWINNER'-style settled-loser twins (row settled) stay
  byte-identical.
- R-V9b (red, per rail): the F2 fold (3e) — clean-reverted + mockFailed→false + findRow→
  still-pending(ref='0xNEW') → PENDING_CONFIRMATION outcome + stale-ref warn (today: 402
  REVERTED — red at the assert); findRow→failed keeps the 402; findRow→settled returns
  settled alreadySettled.
- R-V10 (red): nonceConsumed arm calls mockBroadcast with the 4th arg (null on fresh path;
  stored ref on recovery path) — plus the forced 4th-arg sweep of existing asserts (Batch 1
  note).
- R-V11 (pass pre+post): recovery where stored tx confirms broadcast-unconfirmed
  ('revert-nonce-unverifiable') → pending outcome, NO fresh submit (locks the P8(g) recovery
  face on both rails).

## Batch 4 — reconcile.ts: the expiry pass (P5-ii) + P8-c + the C4 rider
**4a. The expiry pass** — new bounded step between the detectors and the window SELECT
(detectors-first PRESERVED). **Deadline pin (R1-I1): `examinationDeadline` stays computed
exactly at reconcile.ts:470, byte-identical, NOT recomputed after the pass** — pass time
debits the shared 40s envelope automatically (the trace §d recompute formula is marked
superseded); net 60s ceiling unchanged:
- Constants: `EXPIRY_MARGIN_SECONDS = 300` (wall-clock PRE-FILTER only — R1-B3),
  `EXPIRY_PASS_LIMIT = 3`, `EXPIRY_PASS_BUDGET_MS = 14_000` (raised for the chain-time
  read: worst-case 2 bounded reads = 12.3s fit; still debits the shared 40s envelope).
- Candidates SELECT: pending + `inArray(rail, RECONCILABLE_RAILS)` + `isNull(externalRef)` +
  `createdAt < cutoff` (reuse the run's olderThan cutoff) + NOT already classified
  (`sql\`(metadata->>'expiryClass') IS NULL\``), ORDER BY
  `COALESCE(last_reconciled_at, created_at) ASC, created_at ASC`, LIMIT EXPIRY_PASS_LIMIT.
  (Disjoint from the (S) window BY isNotNull/isNull — rotation suite untouched.)
- **The candidates SELECT is issued UNCONDITIONALLY every run (R1-I5 — only per-candidate
  examination checks the deadlines**; a whole-pass deadline guard would skip the SELECT and
  misalign reconcile.test.ts's order-dispatched zero-/10ms-budget tests at :668/:693).
- Per candidate (**deadline check FIRST, then watermark, then examine — the same
  check-before-watermark order the window loop pins at reconcile.ts:639-644 (R2-imp13:
  watermark-first would cost a deadline-stopped candidate its queue position)**; stop when
  `Date.now() ≥ passDeadline` or `≥ examinationDeadline`; **plus a MID-candidate deadline
  re-check between the chain-time read and the nonce read (R2-imp3)** — without it a 2nd
  candidate admitted at t≈13.9s on another network runs 2 more bounded reads ⇒ ~26s; with
  it the pass's true worst ≈ 14,000 + 6,150 ms ≈ **20.15s** (probe P7b) — still inside the shared envelope via
  the R1-I1 debit; §DELIBERATE 8 + probe P7b carry the corrected arithmetic):
  1. opid parse fails OR rail/shape alien → quarantine-classify `'unparseable'`. **Network
     not supported → quarantine-classify `'unsupported-network'` (R2-imp10: decidable at
     parse time, permanent — without the arm such rows loop 'unknown' forever; near-empty
     in prod via the (G) allowlist, but the class is structural). Membership source
     (R3-imp4 **corrected by R4-B8** — USDC_ADDRESSES is a strict SUPERSET of the readers'
     decidable domain: it contains eip155:1 while SUPPORTED_CHAINS is Base-only, so a real
     eip155:1 candidate would pass the arm and loop 'unknown' forever — the exact loop the
     arm exists to kill): **`isCanonicalX402Network(network)` /
     `CANONICAL_X402_NETWORKS` from `x402/networks.ts`** — pinned identical to
     keys(SUPPORTED_CHAINS) by x402-networks.test.ts:26-27, a pure zero-import constants
     module, UNMOCKED in all three reconcile suites (verified: no networks-module vi.mock;
     the engine factory must NOT be the source — its module mock lacks SUPPORTED_CHAINS
     and every candidate would die via the missing-export throw absorbed as
     expiry_pass_failed).**
  2. `metadata.validBefore` absent → quarantine-classify `'legacy-no-validbefore'` (NEVER
     guess — handoff §1.2).
  2.5 **(R1-B2 — the malformed-value guard, BEFORE any expiry comparison):** the value must
     be a canonical positive integer (`typeof vb === 'string' && /^\d+$/.test(vb) &&
     Number.isFinite(Number(vb)) && Number(vb) > 0`) → else quarantine-classify
     `'unparseable'`; the nonce reader is NEVER called (Number('')===0 and Number('abc')
     ===NaN both otherwise fall INTO the expired arm — NaN comparisons are false on the
     ≤-side).
  3. `nowSec ≤ Number(validBefore) + EXPIRY_MARGIN_SECONDS` → skip (cheap PRE-FILTER; not
     provably dead; no classification, no log).
  3.5 **(R1-B3 — the CHAIN-TIME anchor, the actual proof of expiry):**
     `readSafeBlockTimestampBounded(network)` — cached per network per pass (ONE read per
     candidate network per run). null → 'unknown' handling (stay pending, count unknown++,
     no classification — DC-08 direction). `chainTs ≤ Number(validBefore)` → skip (wall
     clock says expired but the CHAIN does not — sequencer-stall catch-up blocks can still
     mine the authorization; not provably dead). Only `chainTs > Number(validBefore)`
     proceeds — strictly-increasing consensus timestamps make unconsumed-after-this FINAL.
  4. chain-expired → [mid-candidate deadline re-check] →
     `readAuthorizationStateBounded(network, from, nonce)`:
     'unconsumed' → `markSettlementExpiredNoBroadcast(op, rail, candidateRow.metadata.
       validBefore, {chainTs, checkedAt})` (**the CANDIDATE-READ value — the evidence CAS,
       R2-B5**) → flipped && `logger.info('reconcile.expired_terminalized', {operationId,
       rail, validBefore, chainTs, ageMs})`; flipped===false → the row acquired a
       ref/terminal state OR a raised validBefore concurrently → do nothing (next run
       re-proves against whichever bound/window now owns it).
     'consumed' → quarantine-classify `'nonce-consumed-untracked'` +
       `logger.error('reconcile.expired_nonce_consumed_quarantined', {operationId, rail,
       from, nonce, validBefore})` — wording attributive (funds may have moved via an
       untracked tx OR the payer canceled — EIP-3009 cancelAuthorization also consumes;
       runbook attributes on-chain). THE detection win; NEVER 'failed'.
     'unknown' → nothing (stays pending, unclassified, retried next pass — the LB-2 rule).
- Run-level telemetry: ONE `logger.info('reconcile.expiry_pass', {examined, terminalized,
  quarantined, unknown})` when examined > 0 (truthful carrier for the pass's own work — a
  persistently-failing nonce read must not look like a clean pass; DC-18). NOT a summary
  field (summary identity pinned).
- Quarantine-classify = metadata merge UPDATE guarded WHERE pending — **(R1-B1, the
  NULL-strictness rule):** `metadata = COALESCE(metadata, '{}'::jsonb) ||
  jsonb_build_object('expiryClass', …, 'expiryClassifiedAt', …)` via ONE shared helper for
  all FOUR classes and every evidence merge (a bare `metadata || …` is NULL-strict in
  Postgres: on the NULL-metadata legacy-hop class it silently writes NULL back, the row is
  never classified, re-enters the LIMIT-3 SELECT every run — the exact (S) starvation shape —
  and the "one-shot" alert fires every 15 minutes). The UPDATE terminates at `.where()` — NO
  `.returning()` (R1-I10: neither reconcile-suite update mock exposes it; zero-row detection
  unneeded). **⚠ SUPERSEDED BY THE ② SEAL FIX S1 (`.audit/v-seal/SEAL.md`; DC-15 finding [20]):
  the SEALED tree DOES chain `.returning({id})` and DOES carry `isNull(externalRef)` in
  `quarantineClassify`'s WHERE — the truth CAS — and gates the alerts + `stats.quarantined` on
  the rowcount. This recipe's "zero-row detection unneeded" is the PRE-SEAL shape; do NOT copy
  it.** Row STAYS 'pending' (status CHECK frozen); classified rows drop out of the
  candidate SELECT (anti-starvation — the (S) lesson) and stay visible via
  pending_overdue/noTxhashCount.
  For 'legacy-no-validbefore'/'unparseable' use logger.error once at classification
  (`reconcile.expiry_unprovable`) — founder/runbook resolves; **'unsupported-network' uses the SAME one-shot error key (R3-imp7 — DC-18: only error level reaches Sentry; a silent cause contradicts §DELIBERATE 2's posture).**
- **⚠ LOAD-BEARING MECHANICS (pinned-suite tolerance — verified against the actual harnesses
  this session; the audit re-verifies):** (i) the ENTIRE pass is wrapped in its own
  best-effort try/catch → `logger.error('reconcile.expiry_pass_failed')` + run continues —
  required for prod posture parity with the detectors AND because the PINNED
  `reconcile-starvation` interpreter throws on the candidates SELECT's FIRST unhandled
  WHERE node — per R2-imp15 that is the `isNull(externalRef)` conjunct (its evalWhere
  handles and/eq/inArray/isNotNull/lt only; the jsonb marker node would throw too;
  unhandled nodes throw by design) — the catch absorbs it and the suite's scenarios
  proceed untouched. (ii) The PINNED `reconcile-detector-availability` harness dispatches selects
  by SHAPE: the expiry candidates SELECT (`orderBy().limit()` terminal) collides into its
  'window' branch — its asserts are ALL `indexOf` ordering pins (agg:1/agg:2/emit <
  first-'window' < 'confirm'), which the extra select satisfies (it runs AFTER both
  aggregates); in its windowThrows test the expiry select throws the boom FIRST — absorbed
  by (i) — and the REAL window select still rejects the run as asserted. Its windowRows
  flow into the pass as pseudo-candidates: no `metadata.validBefore` → the legacy-quarantine
  arm (inert UPDATEs + an unasserted log key) and the engine reader is NEVER reached —
  which matters because (iii) ALL three reconcile-suite engine-module factories define ONLY
  `confirmSettlementTx`: `readAuthorizationStateBounded` is undefined at runtime in the two
  PINNED suites and callable nowhere in their flows (guards (ii) + zero real candidates);
  the EDITABLE `reconcile.test.ts` factory MUST gain the keys
  (`readAuthorizationStateBounded: mockNonceState`, `readSafeBlockTimestampBounded:
  mockChainTs` — default a timestamp far past every fixture vb) **and (R1-I6) its
  '../ledger' factory MUST gain `markSettlementExpiredNoBroadcast: mockExpired` (default
  resolved true)** — vitest throws 'No export defined on the mock' otherwise, leaving
  R-V13 red post-fix; the two PINNED suites' ledger factories deliberately lack the key
  (unreachable there: starvation dies at the candidates SELECT; detector-availability
  exits via the legacy-quarantine arm before any ledger writer). The 'expiry' selectPlan
  step resolves a full `from→where→orderBy→limit` chain returning `expiryPlan.candidates`
  (default `[]`).
**4b. P8-c:** in `reconcileOneRow`'s settled arm, on `flipped===false` → re-read
`findSettlementRow`; if status==='failed' → `logger.error(
'settlement.settled_evidence_on_terminal_failed_row', {operationId, rowStatus,
winningTxHash: confirmation.txHash, storedRef})` — the EXACT (T) key (one operator surface,
runbook §3 already owns it). Outcome tally STAYS 'settled-noop' (summary identity preserved —
§DELIBERATE 3).
**4c. Rider (P7/critic-C4):** `creditSettlement`'s tools UPDATE (:315-320) chains
`.returning({id})`; zero rows → `logger.error('settlement.credit_tool_stat_unmatched',
{operationId, toolId})` — NEVER throw (stat-only; a throw would roll back the REAL developer
credit — the inverted defect, per the credited_at doc's own rule).
**Tests (reconcile.test.ts; the selectPlan.seq machinery gains an 'expiry' step):**
- Mechanics: default `selectPlan.seq = ['sweep', 'overdue', 'expiry', 'window']` (and
  `['sweep','sample','overdue','expiry','window']` at :518's non-zero-sweep test); 'expiry'
  resolves `expiryPlan.candidates` (default `[]` — all existing tests then see zero
  candidates and zero new UPDATE traffic). Quarantine/flip UPDATEs ride mockDb.update chains —
  distinguish by call payload (`set` arg shape) not order where asserted.
- R-V12 (red — THE adversarial case, mandatory per handoff §2 LB-1): candidate expired,
  `readAuthorizationStateBounded`→'consumed' (the mined-then-expired row) → NO
  status-flip UPDATE; quarantine metadata UPDATE + `expired_nonce_consumed_quarantined`
  error. 
- R-V13 (red): expired + 'unconsumed' → `markSettlementExpiredNoBroadcast` called +
  `expired_terminalized` info; NOT failed-CAS, NOT markSettlementFailed.
- R-V14 (red — **R1-I4 positive asserts added**; negative-only would pass vacuously
  pre-fix): 'unknown' nonce read → the reader WAS called AND the
  `reconcile.expiry_pass` info line carries {examined:1, unknown:1}; no UPDATE, no
  classification, no class alert.
- R-V15 (red): legacy row (metadata without validBefore) → quarantine
  'legacy-no-validbefore'; never reads the chain. **PLUS the R1-B1 fixture: a
  NULL-metadata candidate → the emitted SET uses the COALESCE(metadata,'{}') form (assert
  on the captured set-arg SQL/params) and the row is classified — the bare-|| recipe's
  silent NULL writeback is the red.**
- R-V16 (red — R1-I4): within-margin row → candidates SELECT issued + the row examined
  (positive: appears in the pass's examined count) but reader NOT called, row untouched.
- R-V23 (red — R1-B2): malformed validBefore ('', 'abc', '0') → quarantine 'unparseable';
  the nonce reader and chain reader NEVER called; no status flip.
- R-V24 (red — R1-B3; **positive asserts per R2-imp5** — negative-only passes vacuously
  pre-fix): wall-expired candidate but `readSafeBlockTimestampBounded` → vb−10 → the chain
  reader WAS called with the candidate's network AND the `expiry_pass` info line carries
  {examined:1, terminalized:0}; NO terminalization, no classification; chainTs null →
  counts unknown, stays pending (same positive pair).
- R-V25 (red — R1-B4, the adversarial stale-bound case; **same positive-assert pattern;
  concrete values per R3-imp3 — the fixture MUST also pass the wall pre-filter on vb2 or
  the chain reader is never called and the positive assert is red POST-fix:** vb1 =
  now−7200s, vb2 = now−400s [`now > vb2+300` ✓], chainTs = now−1000s [∈ (vb1, vb2)]):
  examined:1 + chain reader called + NO terminalization (the refreshed bound governs).
  Companion orchestrator-side R-V7 asserts the refresh call itself; the refresh-false abort
  is R-V8b.
- R-V26 (red — R3-imp8, the only predicate arm without a fail-pre-fix cell):
  out-of-allowlist network in the opid (e.g. eip155:1 — IN USDC_ADDRESSES but NOT canonical,
  exercising exactly the R4-B8 superset gap; goes green under the
  isCanonicalX402Network source) → quarantine 'unsupported-network' +
  the one-shot `reconcile.expiry_unprovable` error; BOTH readers never called; no flip;
  counted in examined. Probe header gains the out-of-model note (the P2 table models the
  post-step-1 predicate only).
- R-V8b (red — R2-B5b, both rails; **Once-queue recipe per R3-imp2 so the pre-fix red lands
  AT the assert, not at the step-1 idempotency exit or a harness undefined-throw:**
  `mockFindRow.mockResolvedValueOnce(null)` [step-1 read: no row]
  `.mockResolvedValueOnce(<terminal row>)` [the abort re-read], `mockRefresh.
  mockResolvedValueOnce(false)`, `mockSubmit` default settled): refresh→false +
  findRow→failed → PREVIOUSLY_FAILED-shaped outcome, `submitCircleNanoOnChain` NOT called;
  findRow→settled → settled alreadySettled, no submit; findRow→null → failed-shaped
  outcome, no submit (three arms, same Once-queue discipline).
- R-V17 (**re-specified, R2-imp14 — the draft's seq-ordinal version was circular: a
  reordered SELECT under ordinal dispatch MISROUTES rather than reddens**): pin the order
  via side-effect sequencing, not seq position — assert
  `mockLogger.error.mock.invocationCallOrder` for the detector emissions precede
  `mockNonceState.mock.invocationCallOrder[0]` (and the candidates-SELECT's resolution
  marker) on a run with a non-zero overdue + one expiring candidate. The PINNED
  detector-availability suite's collision pins remain the primary structural order guard.
- R-V18 (red): quarantined row excluded: candidate fixture with expiryClass set never
  reaches examination (the SELECT filter is in the WHERE — assert via the emitted-SQL/chain
  contract consistent with the suite's style).
- R-V19 (red): P8-c — settled confirmation + mockSettled→false + findRow→failed → the (T)
  alert key logged with winningTxHash; outcome 'settled-noop'; summary identity unchanged.
- R-V20 (red): C4 — tools UPDATE matches 0 rows → `credit_tool_stat_unmatched` error; dev
  credit still commits; NO throw (mockReturning.mockResolvedValueOnce([{id:'dev-7'}])
  .mockResolvedValueOnce([]) — dev then tools).
- R-V21 (pass pre+post): summary identity `scanned === settled+failed+pending+skipped+noop+
  errored+deferred` with a non-empty expiry pass in the run — expiry work appears in NO
  summary bucket (its rows are outside `scanned`; §DELIBERATE 2/3).

## Batch 5 — executable gate + docs
**Close-time riders (recorded here, executed at close — R2-imp11):** founder close-checklist
gains one curl — verify the prod `SETTLEGRID_BASE_RPC_URL` endpoint serves
`eth_getBlockByNumber("safe", false)` (if rejected, the P5 headline silently no-ops with
only the info-level unknown counter); runbook gains the degradation cue: "`expiry_pass`
unknown===examined across consecutive runs ⇒ the chain-time anchor is degraded — check the
RPC's safe-tag support and the provider's health." Also (R2-imp17, accepted-unreachable
note for the LB-2 doc comment): a corrupted `''`-ref row would be wiring-absent
(`?? null` drops it) but CAS-real; no prod writer can produce `''` — record, don't code.

Gate (FULL suite only — P7 flakes): apps/web `tsc` **0** · FULL `vitest run` **4368 + N_new /
0 fail** (N pinned at build once batches land; every R-V* red captured pre-fix to
`.audit/v-build/`) · `next build` **0** · eslint changed files **0** · `git diff --numstat
packages/` **empty** · numstat ⊆ the §File-set · `git status` untracked ⊆ expected · PINNED
suites: zero diff lines + green in the full run. Docs: runbook addendum (the quarantine
classes + expired_terminalized + the actionable-overdue posture) + register/capstone at
close, NOT in-build.

## Behavior pins (zero-delta surfaces — reject any recipe drift into them)
The (U) spine verbatim (handoff §3): live transport/`publicClientFor`/wallet client/
`RECEIPT_TIMEOUT_MS`/submit guards; detectors-first order + both detector payloads + the
error-level `overdue_examined` carrier; the (S) rotation (window WHERE/ORDER, watermark,
budget/deferred semantics); `markSettlementSettled`/`markSettlementFailed` byte-identical
((T) CAS untouched); `creditSettlement` except the C4 lines; summary shape/identity (NO new
outcome keys, NO new summary fields); cron route; RECONCILABLE_RAILS; packages/; migrations
NONE. Buyer-facing deltas (R2-imp4 + R3-imp9; a ② buyer-delta census must find these and
ONLY these) — four NON-ABORT response deltas: (1) the P8-f mirror txHash (winner not stored
ref) — §1; (2) P8(g)'s 402→502 on the failed-nonce-recheck branch — §1; (3) 3e
CAS-false+still-pending: 402 REVERTED → 502 PENDING_CONFIRMATION — register ③-(U) F2 note +
R1-I2; (4) 3e CAS-false+settled: 402 → 200 settled alreadySettled — same license. PLUS
three licensed RACE-WINDOW ABORT deltas (requests that previously proceeded now exit
early on terminal evidence): (5) the P8-a pre-submit terminal-abort — §1; (6) the R2-B5b
refresh-false terminal-abort (+ its fail-closed throw point, parity with ensurePendingRow)
— R2-B5; (7) P8(g)'s recovery face: stored-tx recheck-failure → 502 pending, no resubmit —
§1/LB-3. Everything else byte-identical.

## §DELIBERATE (flagged, not hidden — scrutinize on the merits)
1. Expiry pass IN-RUN (not a cron) at detectors→pass→window position; pass time debits the
   shared 40s envelope (trace §d arithmetic).
2. Quarantine = jsonb marker + ONE-SHOT classification error + standing visibility via
   pending_overdue (not per-row page-until-closed: the row remains in the overdue count
   every 15 min — a second standing per-row error class would recreate the P5 alarm-fatigue
   face; the uncredited-sweep precedent pages-until-closed because its rows are otherwise
   INVISIBLE — quarantined rows are not).
3. P8-c tallies stay 'settled-noop' (summary identity is ②-pinned wire shape); the NAMING
   the register demands is the (T) alert key — one operator surface, zero shape drift.
4. `markSettlementBroadcast` signature EXTENDED in place (**6** explicit call-site wirings — 2 onBroadcasts + 4 applyOutcome-interior, probe P1a (R3-nit: the hand-census-missed-2 incident is the recorded DC-15 lesson), no
   default arg, no parallel variant fn) — a defaulted/parallel API leaves un-migrated callers
   silently unprotected (DC-07).
5. `EXPIRY_MARGIN_SECONDS = 300` is the cheap wall-clock PRE-FILTER only — the PROOF of
   expiry is the chain-time anchor (R1-B3): `safeBlock.timestamp > validBefore` on the
   bounded client, one read per candidate network per pass, null → stay pending.
6. The bounded readers' typed returns ('consumed'/'unconsumed'/'unknown'; number|null) —
   never throw (DC-08 by construction).
7. P8(g) extends the broadcast-unconfirmed reason union with 'revert-nonce-unverifiable'
   (truthful telemetry parity with the (U) reconciler fix; additive optional field; the :78
   doc comment gains the R1-I9 caveat).
8. EXPIRY_PASS_LIMIT=3 / 14s sub-budget operating point. **Corrected worst-case arithmetic
   (R2-imp3):** per-candidate-only checks would admit a candidate at t≈13.9s and run 2 more
   bounded reads (~26s); the MID-candidate re-check between the chain and nonce reads bounds
   the pass at 14,000 + 6,150 ms ≈ **20.15s** worst (probe P7b) — absorbed by the R1-I1 shared-envelope debit
   (the window loop sees a correspondingly earlier deadline; route ceiling unchanged).
   Backlog drains ≤3/run = 288/day; judge the operating point, not the guarantee —
   terminalization is idempotent + resumable.
10. (R1-B4) `refreshPendingValidBefore` is AWAITED and un-caught in both orchestrators —
   parity with ensurePendingRow (pre-submit DB write, fail-closed before money moves);
   GREATEST keeps it monotone + idempotent.
11. (R1-I2) the ③-(U) F2 register trigger is FOLDED (Batch 3e) — the arms it names are
   open in this chunk; deferring would re-create the fold-on-open debt the register
   explicitly queued.
9. Expiry candidates reuse `last_reconciled_at` mark-before-examine + exclude classified
   rows (DC-09; provably disjoint from the (S) window via isNull/isNotNull).
