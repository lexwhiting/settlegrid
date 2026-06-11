# (T) Terminal-transition integrity & credit observability — BUILD PLAN (2026-06-10)

> **STATUS: DRAFT — not executable until the independent pre-build audit (ARC 3) returns PLAN_READY 0-blocking.**
> Companion trace (decisions + census + cited evidence): `t-terminal-transition-trace-2026-06-10.md`.
> Handoff: `t-terminal-transition-integrity-handoff-2026-06-10.md`. Build atop HEAD `231b8693`.

## The bar (verbatim from the handoff §1)
Every terminal flip is keyed to the on-chain evidence that justified it (no stale-hash terminalization), every credit is recorded atomically-or-detectably with its flip (a sweep can enumerate settled-but-uncredited rows), the credit gate only fires for mainnet rows on reconcilable rails, and the exactly-once property (one actor flips, the flipper credits, never two) is preserved byte-for-byte in observable behavior.

## Batch order (each batch ends tsc-clean; interval self-verify after B2, B4, B6)
**B1 CAS → B2 reconciler tail+gate → B3 schema+migration → B4 marker writers → B5 sweep → B6 tests/fail-pre-fix already proven red at their batch → gates.**
Fail-pre-fix protocol: the NEW empirical tests (R-P2, R-P1 below) are written FIRST on the pristine tree, run RED, captured to `.audit/t-build/{p2,p1}-prefix-fail.txt`, then the fix batches land and the same tests run GREEN (`-postfix-pass.txt`).

---

## Recipe 1 — `src/lib/settlement/ledger.ts` (markSettlementFailed ONLY)
```ts
export async function markSettlementFailed(
  operationId: string,
  rail: string,
  txHash: string,          // REQUIRED (was optional) — the CAS key
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set({
      settlementStatus: 'failed',
      externalRef: txHash,
    })
    .where(
      and(
        eq(ledgerEntries.operationId, operationId),
        eq(ledgerEntries.rail, rail),
        eq(ledgerEntries.settlementStatus, 'pending'),
        // (T) CAS: terminalize ONLY on the evidence hash currently bound to the
        // row. A reconciler (or Redis-down sibling request) holding a STALE
        // external_ref from before a live-path resubmit can no longer flip
        // 'failed' while the resubmitted tx settles on-chain. Rejects ⇒ row
        // stays pending and is re-examined with a fresh ref (never a zombie:
        // every legitimate caller passes the hash it just confirmed, which the
        // write-ahead onBroadcast bound to the row before any flip).
        eq(ledgerEntries.externalRef, txHash),
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}
```
- Doc comment: rewrite to state the CAS contract + why settled-flip has none (trace §3).
- `markSettlementSettled` / `markSettlementBroadcast` / `findSettlementRow`: **byte-untouched**.
- Callers (3, all already pass the hash): zero edits needed; the WHERE-pending CONTRACT is narrowed (licensed), never widened.

## Recipe 2 — `src/lib/settlement/reconcile.ts`
### 2a. `ReconcileOutcome` + summary plumbing
- Add `'pending-stale-ref'` to the union (placed with the pending-* group) with doc: "the failed-flip CAS rejected a stale external_ref — the row was re-pointed (live-path resubmit) after this run's batch SELECT; it remains pending and re-examines next rotation with a fresh ref."
- `emptyOutcomes()`: add key.
- Summary `pending` bucket: `+ outcomes['pending-stale-ref']` (identity `scanned === settled+failed+pending+skipped+noop+errored+deferred` preserved; doc the bucket choice).
- `OVERDUE_CLASS`: add `'pending-stale-ref': 'staleRef'`; `examinedOverdue` gains `staleRef: 0`. **LICENSED EXTENSION (R2-final improvement #8, recorded for the §5.4 mid-build drift checks):** this extends the overdue ALERT payload (`examinedThisRun`), not just the ReconcileSummary — exceeding the literal "(S) machinery frozen, SUMMARY may extend" wording. Licensed on the merits: without it, pending-stale-ref rows would be silently unclassified in `examinedThisRun` (DC-18 — the exact lumping the (S) item-4 work forbade). No other (S)-machinery touch.

### 2b. `reconcileOneRow` 'reverted' branch (lines ~146-160)
```ts
const flipped = await markSettlementFailed(operationId, rail, confirmation.txHash)
if (!flipped) {
  // Disambiguate CAS-reject (row still pending, ref re-pointed) from a
  // concurrent terminal winner (the (S) noop class).
  const current = await findSettlementRow(operationId, rail)
  if (current?.settlementStatus === 'pending') {
    logger.warn('reconcile.failed_flip_stale_ref', {
      operationId, rail, staleTxHash: confirmation.txHash, currentRef: current.externalRef,
    })
    return 'pending-stale-ref'
  }
}
logger.warn('reconcile.failed', { operationId, rail, txHash: confirmation.txHash, flipped })
return flipped ? 'failed' : 'failed-noop'
```
- Import `findSettlementRow` from `./ledger`. (`reconcile.failed` keeps firing for true flips AND terminal-noops — existing log contract preserved; the stale branch returns before it.)

### 2c. Credit gate (line ~131) — P3
```ts
if (flipped && isReconcilableRail(rail)) {
  // F2 mainnet pin (parity with handleX402Proxy / handleCircleNanoProxy / the
  // kernel /settle route — the reconciler was the ONLY credit-capable surface
  // without it). Gates the CREDIT only, never the flip (a Sepolia row settled
  // on Sepolia is honest bookkeeping; blocking the flip would mint an immortal
  // pending row). Blocked ⇒ loud log + row left unmarked ⇒ the uncredited
  // sweep enumerates it (a testnet row in a prod DB is a real incident).
  if (parsed.network !== X402_MAINNET_NETWORK && !isX402TestnetSettlementAllowed()) {
    logger.error('reconcile.credit_blocked_testnet', { operationId, rail, network: parsed.network })
  } else {
    /* existing toolId extraction */
    await creditSettlement({ developerId: row.accountId, toolId, amountCents: row.amountCents, operationId: row.operationId, rail })
  }
}
return flipped ? 'settled' : 'settled-noop'
```
- Imports: `isReconcilableRail` from `./rails`; `X402_MAINNET_NETWORK`, `isX402TestnetSettlementAllowed` from `@/lib/env`.
- `parsed` is in scope (`reconcile.ts:112`). `isReconcilableRail(rail)` ≡ the literal pair today (DC-07 unification).

### 2d. `creditSettlement` — marker in the SAME transaction (P1, writers W1+W2)
- Params gain `rail: string`.
- Inside the existing `db.transaction`, after the tools update:
```ts
const marked = await tx
  .update(ledgerEntries)
  .set({ creditedAt: new Date() })
  .where(and(
    eq(ledgerEntries.operationId, operationId!),
    eq(ledgerEntries.rail, rail),
    eq(ledgerEntries.settlementStatus, 'settled'),
    isNull(ledgerEntries.creditedAt),
  ))
  .returning({ id: ledgerEntries.id })
```
- After the transaction commits: if `marked.length === 0` → `logger.error('settlement.credit_marker_unmatched', { operationId, rail, developerId })`. **Never throw on marker miss** (a thrown marker would roll back a REAL credit — the exact inversion LB-2 forbids; an unmarked-but-credited row self-surfaces via the sweep and is closed by runbook). Capture `marked` via a `let` outside the txn.
- `operationId` is `string | null` in params today; the marker runs only when truthy — when null (never in practice for W1/W2: both pass it) skip the marker UPDATE and emit `credit_marker_unmatched` with `operationId: null`.
- Imports: `isNull` from drizzle-orm; doc-comment updates (marker contract + open-incident semantics).
- Callers updated: `reconcile.ts` tail (`rail` — see 2c), kernel route (`rail: 'circle-nano'`).

### 2e. Sweep (P1 observability) — appended to `reconcilePendingSettlements` after the overdue block
```ts
const CREDIT_GRACE_MS = 60 * 60_000  // flip→credit is seconds-to-30s live; 1h is unambiguous
let uncredited: number | null = null
try {
  const graceCutoff = new Date(Date.now() - CREDIT_GRACE_MS)
  const [agg] = await db.select({ total: sql<string>`count(*)` }).from(ledgerEntries).where(and(
    eq(ledgerEntries.settlementStatus, 'settled'),
    inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
    isNull(ledgerEntries.creditedAt),
    lt(ledgerEntries.settledAt, graceCutoff),
  ))
  uncredited = Number(agg.total)              // postgres-js count = STRING (DC-18)
  if (uncredited > 0) {
    const sample = await db.select({ operationId: ledgerEntries.operationId, settledAt: ledgerEntries.settledAt })
      .from(ledgerEntries).where(/* same conjuncts */).orderBy(asc(ledgerEntries.settledAt)).limit(25)
    logger.error('reconcile.uncredited_settled', {
      uncreditedCount: uncredited,
      graceMs: CREDIT_GRACE_MS,
      oldestSettledAt: sample[0]?.settledAt ?? null,
      // R2-final improvement #3: operation_id is ALREADY rail-prefixed by
      // construction (circleNanoOperationId/x402OperationId) — a `${rail}:` prefix
      // would emit 'x402:x402:…'. Bare operationIds match the runbook's closure
      // UPDATE keys exactly. Bounded ≤ 25.
      operationIds: sample.map((s) => s.operationId),
    })
  }
} catch (err) {
  logger.error('reconcile.uncredited_check_failed', {}, err)   // best-effort, never aborts the run
}
```
- `ReconcileSummary` gains `uncredited: number | null` (doc: count of settled reconcilable-rail rows past the grace window with no committed credit marker — each is an OPEN credit-resolution incident: silent P1 loss, F3 upstream-fail, credit_failed, or a pin-blocked testnet credit; one structured error line per run while any persist; null ⇒ the check itself failed). Return it.
- The two queries run AFTER the examination loop (overdue-block posture); aggregate is indexed by the 0016 partial index. `olderThanMs`-style opts knob: add `creditGraceMs?: number` to opts for testability (default 60min).

## Recipe 3 — `src/lib/db/schema.ts` + migration `0016` + bootstrap
- Schema: `creditedAt: timestamp('credited_at', { withTimezone: true }),` after `lastReconciledAt` (~line 906) with a (T)-contract comment; index block gains
  `index('ledger_entries_uncredited_settled_idx').on(table.settledAt).where(sql`${table.settlementStatus} = 'settled' AND ${table.creditedAt} IS NULL`),` (drizzle-orm 0.38 partial-index API — verify emitted type at build; if `.where` is unavailable on this version's index builder, record a plain comment instead and keep the migration as truth — schema is documentation here, generate is FORBIDDEN).
- `drizzle/0016_credited_at.sql` (hand-written; header comment per 0015 conventions — purpose, APPLY-THEN-DEPLOY after 0015 / before the (T) deploy, old-code-inert proof, founder-gated, IF NOT EXISTS idempotent paste — PLUS, per R1 audit fixes F5/F6/F3:
  - **state the deploy-before-apply CONSEQUENCE explicitly** (0015-precedent wording; the blast radius here is strictly worse than 0015's broken cron, and worse than credit rollbacks alone — R2 audit fix I3, verified against drizzle 0.38 `buildInsertQuery` which emits the FULL schema column list on every INSERT): with (T) code deployed before 0016 is applied, (a) EVERY `ledger_entries` INSERT throws `column "credited_at" does not exist` — `ensurePendingRow` fails PRE-broadcast on both on-chain rails (total settlement-admission outage; fail-closed, no funds move) and the ap2/sessions ledger writes fail; (b) the marker UPDATE inside every credit transaction for already-pending rows throws → rollback → reconciler/kernel/proxy credits all fail (`settlement.credit_failed` / `billing_update_error` storms); (c) the sweep aggregate dies every run (`reconcile.uncredited_check_failed`);
  - **DC-07 note on the backfill's hardcoded rail pair**: a deliberate point-in-time SNAPSHOT of `RECONCILABLE_RAILS` (rails.ts:18) — correct for a one-time historical statement; the live source of truth remains rails.ts and the runtime sweep uses it;
  - the backfill carries a **literal settled_at upper bound** making the paste TEXT-IDEMPOTENT FOREVER — a re-paste at any time, even post-deploy, cannot erase live sweep evidence by construction):
```sql
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "credited_at" timestamp with time zone;

-- Legacy backfill — pre-(T) settled rows must never page the sweep. The literal
-- upper bound (the 0016 AUTHORING time — BEFORE any (T) deploy can exist, so no
-- (T)-era row can ever predate it; R2 audit fix I2) makes this UPDATE
-- text-idempotent UNCONDITIONALLY: rows settled after it are NEVER touched, so
-- a re-paste at any time cannot erase live sweep evidence.
UPDATE "ledger_entries" SET "credited_at" = "settled_at"
WHERE "settlement_status" = 'settled' AND "rail" IN ('circle-nano', 'x402')
  AND "credited_at" IS NULL AND "settled_at" < '2026-06-10T20:00:00Z'::timestamptz;

CREATE INDEX IF NOT EXISTS "ledger_entries_uncredited_settled_idx"
  ON "ledger_entries" ("settled_at")
  WHERE "settlement_status" = 'settled' AND "credited_at" IS NULL;
```
  (Trade documented in the runbook: rows settled between the literal bound and the (T) deploy are outside the backfill → they page on EVERY post-deploy sweep run until closed — the sweep has no de-dup BY DESIGN (R2 audit fix I4; same one-line-per-run-while-persisting posture as `reconcile.pending_overdue`). The runbook gets a bounded BULK-closure recipe for exactly this verified gap window: `UPDATE ledger_entries SET credited_at = settled_at WHERE settlement_status='settled' AND rail IN ('circle-nano','x402') AND credited_at IS NULL AND settled_at < '<the (T) deploy timestamp>';` run ONCE after verifying via logs that each gap row was credited (`settlement.credited`) or is a known alerted incident. Erase-evidence hazard remains structurally gone: the bound predates any possible (T) deploy.
  R2 audit fix I5 — index-growth note for the 0016 header + trace §6.3: the partial index predicate (no rail conjunct) permanently captures every ap2 settled row (ap2 rows never get `credited_at` — outside the marker universe), so the index NULL-set grows with all-time ap2 volume. Documented trade at current volume; revisit (add the rail pair to the predicate via a future migration) if ap2 volume makes it material. Do NOT widen the marker census to "fix" this.)
- `scripts/bootstrap__drizzle_migrations.sql`: append the 0016 row before COMMIT — hash = `shasum -a 256 drizzle/0016_credited_at.sql` of the FINAL file (convention verified: 0014/0015 registered hashes are exactly the file sha-256), `created_at = 1781136000000` (> 0015's 1781049600000); update the POST-RUN expected-rows comment (16 → 17, new MAX).
- 0015 file + its bootstrap row: byte-untouched (gate).

## Recipe 4 — `src/app/api/proxy/[slug]/route.ts` (writers W3+W4)
- `forwardAndBill` options gain:
```ts
/** (T) On-chain settlement identity — passed ONLY by the x402/circle-nano
 *  handlers' fresh-flip path. When present, the credit runs as ONE transaction
 *  (tools + developers + the credited_at marker on the settlement row) so the
 *  marker commits iff the credit commits. Absent ⇒ the legacy Promise.all
 *  credit is byte-identical (non-settlement rails have no row to mark). */
settlement?: { operationId: string; rail: 'x402' | 'circle-nano' }
```
- Credit block (`:1679-1705`): branch on `options?.settlement`:
```ts
if (options?.settlement) {
  const { operationId, rail } = options.settlement
  let marked = 0
  let devMatched = 1
  await db.transaction(async (txn) => {
    // LOCK-ORDER IS LOAD-BEARING (R2 audit fix B1): developers THEN tools — the
    // SAME order creditSettlement acquires (reconcile.ts:231→246). Inverting it
    // would create an AB-BA deadlock class between a reconciler/kernel credit
    // and a proxy credit on the same developer+tool; PG would abort one txn and
    // roll back a REAL credit+marker into a manufactured open incident.
    const dev = await txn.update(developers).set({ /* identical SET */ }).where(eq(developers.id, toolRow.developerId))
      .returning({ id: developers.id })
    devMatched = dev.length
    await txn.update(tools).set({ /* identical SET */ }).where(eq(tools.id, toolRow.id))
    if (devMatched > 0) {
      const rows = await txn.update(ledgerEntries).set({ creditedAt: new Date() })
        .where(and(eq(ledgerEntries.operationId, operationId), eq(ledgerEntries.rail, rail),
                   eq(ledgerEntries.settlementStatus, 'settled'), isNull(ledgerEntries.creditedAt)))
        .returning({ id: ledgerEntries.id })
      marked = rows.length
    }
  })
  // R2 audit fix I1 (LB-1 false-negative arm): a dangling developerId must NOT
  // mark the row "credited" — skip the marker (the row keeps paging truthfully)
  // and log; never throw (a thrown marker would roll back a real credit — and
  // B4-style throws in forwardAndBill are explicitly out of scope).
  if (devMatched === 0) logger.error('settlement.credit_zero_row_unmarked', { operationId, rail, slug, requestId })
  else if (marked === 0) logger.error('settlement.credit_marker_unmatched', { operationId, rail, slug, requestId })
} else {
  /* existing Promise.all — BYTE-IDENTICAL */
}
```
  (same catch wrapper — `billing_update_error` + F3 `onchain_credit_lost_after_settle` semantics unchanged; a transaction failure now also loses the tools-stat update, which is the correct coupling: marker ⟺ credit. Imports: `ledgerEntries` + `isNull` added to the route's existing drizzle imports. The duplicated SET objects in the transaction branch are a deliberate choice over hoisting shared consts: the legacy `Promise.all` branch stays BYTE-identical — the stronger neutrality pin — at the cost of bumping the two source-scan tests, scheduled in Recipe 8 (R2 audit fixes B2/B3).)
- `handleX402Proxy` fresh-flip call (`:1911`): `isReplay ? { skipCredit: true } : { irreversibleOnChain: true, settlement: { operationId: x402OperationId({ network: exactPayload.network, authorization: exactPayload.payload.authorization, signature: exactPayload.payload.signature }), rail: 'x402' } }` — `x402OperationId` is EXPORTED (`orchestrate.ts:98`) and reads only `network` + `authorization.from/nonce`; the inline proof object is exactly the private `toProof` mapping (`orchestrate.ts:89-95`).
- `handleCircleNanoProxy` fresh-flip call (`:2048`): `settlement: { operationId: circleNanoOperationId(proof), rail: 'circle-nano' }` — `circleNanoOperationId` is EXPORTED (`settle.ts:70`), `proof` is in scope (`:1984`), and the kernel route already does this exact recomputation (`circle-nano/settle/route.ts:208`).
- **R1 audit fix F1+F2 (supersedes the earlier orchestrator-field design): ZERO orchestrator edits.** The settled-outcome types, `settle.ts`, and `orchestrate.ts` stay byte-stable — consistent with the handoff §4 UNFROZEN list and trace §8; the operationId is recomputed at the two handler call sites from the exported deterministic builders (same inputs ⇒ same key; the builders ARE the operation_id source of truth). Orchestrate/settle test suites need no outcome-shape updates.
- Free-op and replay calls: untouched (no settlement key → legacy path).
- Route imports add `x402OperationId` (from `@/lib/settlement/x402/orchestrate`) + `circleNanoOperationId` (from `@/lib/settlement/circle-nano/settle`).

## Recipe 5 — `src/app/api/circle-nano/settle/route.ts` (writer W2)
- `creditSettlement({ ..., rail: 'circle-nano' })` — one-line param addition (`:204-209`).

## Recipe 6 — `src/app/api/cron/settlement-reconcile/route.ts`
- Add `uncredited: summary.uncredited` to the `cron.settlement_reconcile.done` log object (comment: (T) open credit-resolution incidents).

## Recipe 7 — Runbook (new): `docs/tech-debt/t-credited-at-runbook-2026-06-10.md`
Founder-facing: (1) 0016 APPLY-THEN-DEPLOY steps (paste 0016.sql → seed bootstrap row → verify 17 rows → deploy (T)) **including the explicit deploy-first consequence** (every on-chain credit transaction rolls back until applied — R1 fix F5); (2) the sweep's operator contract — `reconcile.uncredited_settled` anatomy, triage table (check `settlement.credited` / `credit_failed` / `onchain_settled_upstream_failed` / `credit_blocked_testnet` logs by operationId), closure step `UPDATE ledger_entries SET credited_at = now() WHERE operation_id = $1 AND rail = $2 AND settlement_status='settled' AND credited_at IS NULL;` after manual credit/refund/investigation; (3) backfill-bound gap note (rows settled between the 0016 literal bound and the (T) deploy page on EVERY sweep run until closed — no de-dup by design; includes the bounded BULK-closure UPDATE for the verified gap window, run once after log triage — R1 fix F6 + R2 fix I4); (4) marker semantics one-pager. The deploy-first consequence wording must include the FULL blast radius per R2 fix I3 (admission outage via INSERT column-list breakage, not just credit rollbacks).

## Recipe 8 — Tests
### NEW `src/lib/settlement/__tests__/terminal-transition.test.ts` (empirical, in-memory-table harness per reconcile-starvation precedent, but with REAL `../ledger` — NOT mocked — so the actual emitted UPDATE SQL executes)
Harness deltas vs starvation file: `update().set().where()` returns `{ returning: async () => matchedRows }` AND applies the mutation; `eq` over `external_ref` evaluated; `isNull` node; `transaction(cb)` executes cb against the same state (with rollback-on-throw for the marker/credit tests); aggregate-select thenable computes `count(*)` from `evalWhere` instead of returning '0'; **`select().from().where().limit()` WITHOUT orderBy resolves from in-memory state** (R2-final improvement #4 — the R-P2 companion path reaches the REAL `findSettlementRow` (`ledger.ts:519-535`, no orderBy), which an orderBy-terminated select chain would throw on).
- **R-P2 (fail-pre-fix, the HIGH):** row pending `externalRef='0xH2'`; call REAL `markSettlementFailed(op, rail, '0xH1')` → assert returns false AND row still `pending` with ref `'0xH2'`. **Pre-fix this RED** (the flip lands) — capture. Companion: full interleaving through `reconcileOneRow` (confirm mock returns reverted for 0xH1) → outcome `'pending-stale-ref'` post-fix.
- **R-P2-inverse (zombie pin):** row pending ref `'0xH1'`; `markSettlementFailed(op, rail, '0xH1')` → true, row `failed`, ref kept. Must pass pre-AND-post (legitimate failures still land).
- **R-P1 (fail-pre-fix, the HIGH):** row `settled`, `creditedAt: null`, `settledAt` 2h old → run `reconcilePendingSettlements()` → assert `summary.uncredited === 1` + `reconcile.uncredited_settled` logged with the operationId. **Pre-fix RED** (no sweep/field). Companion kill-simulation: pending row + confirm-settled + `db.transaction` (credit) throws → row settled, unmarked → next run's sweep enumerates it.
- **R-marker:** reconciler tail full pass (row with accountId/amountCents/toolId) → row gains `creditedAt` non-null, dev credited once; second pass → no re-credit (row no longer pending), marker untouched.
- **R-grace:** settled-unmarked row 5 min old → `uncredited === 0` (no page inside the grace window).
- **R-pin (DC-13 latent):** `parsed.network` Sepolia row (opid `eip155:84532`) confirmed settled → flip lands, NO credit transaction, `reconcile.credit_blocked_testnet` logged, row unmarked; mainnet row → credit flows (the (G) LB-2 trap pin).
### NEW `src/lib/settlement/__tests__/credit-writer-census.test.ts` (LB-1 pin)
Walks `src` (fs, like a lint) and asserts: (a) the `developers.balanceCents` increment census is EXACTLY the **POST-(T) 14 sites** (R2 audit fix B3: trace §1b's 13 + the Recipe-4 transactional twin in the proxy route — route.ts count becomes 6, with BOTH route.ts credit-block sites classified together as the W3/W4 marker-writer pair); (b) every `markSettlementFailed(` call site passes 3 args; (c) `creditSettlement(` call sites all pass `rail`. A NEW credit writer or hash-less failed-flip fails this test until censused (the "fails when a census member is missing" pin). Line numbers are NOT asserted (file+count granularity — line drift must not flake the suite). NOTE: `.audit/t-prebuild/probes/probes.mjs` P1a documents the PRE-build 13-site state — it is a pre-build snapshot, NOT a post-build gate; do not re-run it as one.
### Updated
- `reconcile.test.ts` (R2 audit fixes B5+B6 — enumerated):
  - drizzle-orm mock factory (`:72-80`) gains **`isNull`**; the schema `ledgerEntries` mock gains **`settledAt` + `creditedAt`** keys; `../ledger` mock gains **`findSettlementRow`** (for the CAS-reject re-read).
  - `mockTx` plumbing extends to a THIRD in-txn chain: `update(ledgerEntriesMock).set().where().returning()` (the marker).
  - Exact-count updates: `:241` + `:266` `toHaveBeenCalledTimes(2)` → **3** with `toHaveBeenNthCalledWith(3, <ledgerEntries mock>)`; `:309` no-toolId test `toHaveBeenCalledTimes(1)` → **2** (developers + marker, no tools). Add a marker-WHERE shape assert (operationId + rail + settled + isNull conjuncts).
  - **Rework the (S)-era odd/even `db.select` parity routing (`:115`) into an explicit per-call queue** (window → overdue aggregate → sweep aggregate → optional id-sample) — the sweep adds a 3rd/4th select per run, so parity routing cannot survive; all existing tests must keep their semantics under the queue (default queue entries mirror today's defaults: overdue `{total:'0',...}`, sweep `{total:'0'}`).
  - New asserts: summary-identity updated for `pending-stale-ref` + `uncredited`; CAS-reject → `pending-stale-ref` outcome test; pin gating (mainnet credits / Sepolia blocked + logged, latent — DC-13).
- `reconcile-starvation.test.ts` (R2 fix B5): drizzleMock gains **`isNull`**; `ledgerEntriesMock` + COL map gain **`settledAt` + `creditedAt`**; `../ledger` mock gains **`findSettlementRow`**; the aggregate-terminating thenable serves the sweep aggregate too (`{total:'0'}` default); **add one assertion that `summary.uncredited` is a number, NOT null** — otherwise a missing mock capability silently dark-ens the sweep in this suite (`uncredited:null` via the catch) and the rotation tests would still pass.
- `circle-nano/__tests__/settle.test.ts`, `x402/__tests__/orchestrate.test.ts`: UNCHANGED (R1 fix F1+F2 — no outcome-shape change; `markSettlementFailed` mocks already 3-arg). They stay green as frozen pins.
- proxy `x402-proxy-settlement.test.ts` / `circle-nano-proxy-settlement.test.ts` (R2 audit fix B4 + R2-final improvement #1): the orchestrator module mock factories currently export ONLY `executeX402Settlement` / `executeCircleNanoSettlement` (`:70` / `:70-72`) — route.ts now imports **`x402OperationId`** and **`circleNanoOperationId`** from exactly those modules, so BOTH factories must add the key or every test in the files throws (vitest no-export → route 500). **Use `importActual` passthrough for the builders** (pure deterministic functions) so marker-WHERE operationId assertions are exact. Transactional-branch rework — ENUMERATED:
  1. The fresh-settle dbUpdate-count asserts INVERT post-(T): x402 `:171` + circle-nano `:174` currently assert the Promise.all `db.update` calls — rework to transaction-branch asserts (txn dev + tools + marker updates in ORDER, ZERO direct `db.update` calls on the fresh-flip path).
  2. x402 `:239-247`'s `H.updateWhere.mockRejectedValue` failure-injection becomes unreachable (the credit no longer flows through that chain) — re-inject the failure into the TRANSACTION mock and assert the SAME `proxy.onchain_credit_lost_after_settle` alert fires (the F3 pin must survive the plumbing move).
  3. Transaction mock shape SPECIFIED (DC-05 bare-mock-chain class — a harness TypeError must not vacuously green the F3 test): `tx.update(table)` returns a chain whose `.set(args)` CAPTURES args, `.where(cond)` captures cond, and `.returning()` resolves `[{ id: 'x' }]` (dev UPDATE) / `[{ id: 'row' }]` (marker) by default; per-test overrides inject rejections.
  Replay path: no marker, no credit (unchanged); free path: legacy Promise.all (unchanged).
- `billing-credits.test.ts` (R2 audit fix B2 — moves from "unchanged" to UPDATED): the route source-scan `expect(matches.length).toBe(5)` (`:84-90`) becomes **`toBe(6)`** with the comment naming the 6th site: the (T) on-chain transactional twin of the forwardAndBill credit (`cached, x402-collected, mpp, api-key, failover, onchain-transactional`). The NET-writer zero-match assertions stay untouched and must stay green (the new SET is GROSS — same `+ ${actualCost}` shape). The non-on-chain byte-identical Promise.all pin remains this file's job.
- `circle-nano/__tests__/route.test.ts` (+e2e-smoke if it shape-checks): `creditSettlement` called with `rail: 'circle-nano'`.
- `cron/settlement-reconcile/__tests__/route.test.ts`: summary passthrough includes `uncredited`.
- `src/lib/__tests__/ledger.test.ts`: only if it touches markSettlementFailed (it doesn't — recordSettlementEntry suite; credited_at never set at insert → inert).

## Behavior-neutral pins (all must hold)
1. Exactly-once credit: every existing flip-winner-credits / alreadySettled-no-recredit test passes unchanged.
2. Every existing credit path still credits (proxy billing, kernel route, reconciler tail tests).
3. Legitimate failed-flips still land (R-P2-inverse + existing reverted tests in orchestrate/settle/reconcile suites).
4. Non-settlement `forwardAndBill` callers: empty diff in behavior (billing-credits suite + the `else` branch being the moved-verbatim original block).
5. (S)/(S③) rotation, watermark, budget, overdue machinery untouched (starvation suite + reconcile suite green; only the SUMMARY extends — licensed).
6. WHERE-pending contract: narrowed on failed (CAS) only; settled/broadcast flips byte-identical.

## Gates (executable, end of build)
1. `npx tsc --noEmit` → 0.
2. `npx vitest run` FULL suite → 4336 + N new, 0 fail (never gate on isolated runs — register P7 flakes).
3. `npx next build` → 0 errors.
4. `npx eslint <changed files>` → 0.
5. `git diff --numstat packages/` empty → mcp byte-stable (else run mcp suite 1898-1); python untouched.
6. `git status`/numstat confined to: `ledger.ts`, `reconcile.ts`, `db/schema.ts`, `drizzle/0016_credited_at.sql` (new), `scripts/bootstrap__drizzle_migrations.sql`, proxy route, circle-nano settle route + its tests, cron route, the named test files, the two docs + runbook, `.audit/t-*`. (R1 fix F1+F2: `x402/orchestrate.ts` + `circle-nano/settle.ts` are NOT modified — operationId recomputed at the handler call sites from the exported builders.)
   **⚠ SUPERSEDED at ②/③ (deep-audit fix F4): the SEALED tree DOES modify both orchestrators + their test files** (② P2-mirror alerts + ③ lock-TTL fix, recorded license extensions). The AUTHORITATIVE commit list is `docs/tech-debt/t-close-checklist-2026-06-10.md` — committing from THIS gate-6 list would ship without the funds-critical alerts.
7. `shasum -a 256 drizzle/0015_reconcile_watermark.sql` = `40943692…d826d` (untouched) AND the 0016 bootstrap hash row = the final file's sha-256. **PLUS (R2-final improvement #2, DC-14):** the bootstrap script's PRE-existing content is byte-guarded — `git diff scripts/bootstrap__drizzle_migrations.sql` hunks confined to the appended 0016 row + the POST-RUN footer arithmetic, and a grep pins the 0015 row intact (`40943692cf5313ffca9d9f1ecda722c33ddf9922015dcb44b92558976d9d826d` + `1781049600000` both still present verbatim).
8. Fail-pre-fix artifacts exist: `.audit/t-build/{p2,p1}-prefix-fail.txt` + matching post-fix green captures.

## Scope guard
Trace §8 verbatim. Reject during build: P4/P5/B1.1, settled-flip CAS, atomic flip+credit refactors, auto-refund, engine/rails/`markSettlementBroadcast`/`recordSettlementEntry`/payouts/pricing/packages edits, B4-style zero-row throws added to forwardAndBill, any vercel.json/cron change.

## Register dispositions carried at close (R2-final improvement #7, DC-15)
The register's critic-C4 note (fold a `creditSettlement` tools-UPDATE zero-row check into P1's chunk) is deliberately NOT folded into (T): the tools update is the per-tool revenue STAT only (stat-only blast radius — the dev balance, the payout source of truth, already has the B4 zero-row throw), so it stays register-P7-class hygiene. Re-point the register entry at chunk close; record in the capstone.
