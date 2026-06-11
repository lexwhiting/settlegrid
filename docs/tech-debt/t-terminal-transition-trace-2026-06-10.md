# (T) Terminal-transition integrity & credit observability — SCOPE-CONFIRM TRACE (2026-06-10)

> **② SEAL ADDENDUM (2026-06-10): SEALED** — see `.audit/t-seal/SEAL.md`. The seal panel
> exhibited ONE HIGH beyond this trace: the **P2 MIRROR ordering** (failed-flip on CURRENT-ref
> evidence inside the resubmit gap → the resubmitted tx settles onto a `failed` row → the
> settled-only sweep is blind). Fixed detect-side in ② (receipt-time + broadcast-time alerts in
> both orchestrators — a RECORDED license extension; outcome shapes byte-identical); prevention
> = register **P8**. §3's zombie-inverse walk and probe S1/H7 modeled only the re-point-FIRST
> orderings — the lesson (now in DC-01's detection cue): enumerate, per terminal-state writer,
> WHICH observer would see money arriving AFTER the row went terminal. The C-class table in §1c
> gains an implicit C8: settled-evidence-on-failed-row — detected by the live path's alerts,
> NEVER by the sweep.

> ARC step 1 of the (T) chunk (handoff: `t-terminal-transition-integrity-handoff-2026-06-10.md`).
> Every claim below was re-derived against live code at HEAD `231b8693` in THIS session.
> Baselines re-anchored before any edit: tsc **0** · vitest **4336 / 187 files / 0 fail** (full run, 16.1s).

## 0. Handoff claims re-verified (cited lines, this session)

| Handoff claim | Verified at | Status |
|---|---|---|
| `markSettlementSettled`/`markSettlementFailed`/`markSettlementBroadcast` WHERE-pending flips | `ledger.ts:543-624` | ✓ exact |
| `markSettlementFailed` txHash OPTIONAL (`...(txHash ? ...)`) | `ledger.ts:580,586` | ✓ |
| Credit gate hardcoded `rail === 'x402' \|\| rail === 'circle-nano'` | `reconcile.ts:131` | ✓ |
| Reconciler credit tail (flip → `creditSettlement`, non-atomic) | `reconcile.ts:122-143` | ✓ |
| `creditSettlement` residual: flip committed before credit; DB error → row never re-selected | `reconcile.ts:199-202` (doc), `229-261` (code) | ✓ |
| Fresh-submit fall-through after clean nonce-free revert (makes P2 real) | x402 `orchestrate.ts:329-336`; circle-nano `settle.ts:233-240` | ✓ both rails |
| `markSettlementBroadcast` re-points `external_ref` on a still-pending row | `ledger.ts:607-624`; called write-ahead at broadcast (`settle-engine.ts:196-205`) | ✓ |
| Reconciler holds the batch-SELECT's `externalRef` (stale-able) | `reconcile.ts:365-400` (SELECT), `:118` (confirm uses it) | ✓ |
| `RECONCILABLE_RAILS` single source of truth | `rails.ts:18` = `['circle-nano','x402']` | ✓ |
| F2 pin predicates | `env.ts:201` `X402_MAINNET_NETWORK='eip155:8453'`; `env.ts:213` `isX402TestnetSettlementAllowed()` bakes in `!isProduction()` | ✓ real names confirmed |
| Migration next = `0016`, hand-written per 0014/0015 precedent | `drizzle/` listing (`0015_reconcile_watermark.sql` is last); bootstrap tail registers 0015 hash | ✓ |
| Reconcile cron route 60s maxDuration, summary logged | `app/api/cron/settlement-reconcile/route.ts:17,45-59` | ✓ |

P1/P2 mechanism walk (one line each):
- **P1** — reconciler: `markSettlementSettled` commits (`reconcile.ts:122`), then `creditSettlement` runs as a SEPARATE transaction (`:137`); a process kill between them loses the credit with **no log and no marker**, and the now-terminal row is never re-selected. Live proxy paths: the flip commits inside `executeX402Settlement`/`executeCircleNanoSettlement` and the credit happens in `forwardAndBill` **after the upstream fetch** (≤30s timeout) — a much larger kill window (handoff critic C1 confirmed).
- **P2** — reconciler batch SELECT captures `externalRef=H1`; live path's recovery resubmits `H2` (`orchestrate.ts:329-336`) and `markSettlementBroadcast` re-points the row to H2; reconciler confirms H1 = clean revert and `markSettlementFailed(op, rail, H1)` flips `failed` (WHERE pending matches — no ref predicate) while H2 settles on-chain → live path's `markSettlementSettled` no-matches → `alreadySettled:true` → forwards **without credit**. USDC collected, dev never credited, row terminally `failed`, zero alerts. Also reproducible live-vs-live with Redis down (two concurrent settles, A's revert flip vs B's resubmit).

## 1. LB-1 — credit-writer CENSUS (the sweep's honesty proof)

**Row universe the sweep will scan:** `ledger_entries` WHERE `settlement_status='settled'` AND `rail IN RECONCILABLE_RAILS`.

### 1a. Every producer of a row in that universe
| # | Producer | Path | Notes |
|---|---|---|---|
| R1 | `ensurePendingRow` (x402) | `orchestrate.ts:129-162` → `recordSettlementEntry` | always `status:'pending'`, `costCents>0` only, accountId + `metadata.toolId` always set |
| R2 | `ensurePendingRow` (circle-nano) | `settle.ts:79-112` | same |
| F1 | `markSettlementSettled` ← reconciler | `reconcile.ts:122` | pending→settled |
| F2 | `markSettlementSettled` ← x402 applyOutcome | `orchestrate.ts:171` | pending→settled |
| F3 | `markSettlementSettled` ← circle-nano applyOutcome | `settle.ts:121` | pending→settled |

**Exhaustiveness proof (mechanical, re-runnable):** greps over `src --include=*.ts` excluding tests found **no other** `settlementStatus:'settled'` writer or `insert(ledgerEntries)` site that can carry a reconcilable rail:
- `recordSettlementEntry` callers: ap2 settle route (`rail:'ap2'`, status 'settled' — **outside** the universe), R1, R2 only.
- `recordSettlementEntryAsync` sole caller `sessions.ts:488` writes hop rows status `'pending'` AND is **excluded from reconcilable rails by construction** — the (H) `isReconcilableRail` guard at `sessions.ts:470-487` skips the ledger write entirely for x402/circle-nano hops.
- Facilitator `settleExactPayment` (`x402/settle.ts:166`) is **Redis-idempotency only** — zero DB/ledger references (grep: no `db`, `ledgerEntries`, `recordSettlementEntry`, `markSettlement*`, `balanceCents` in `x402/settle.ts`). The `/api/x402/settle` route uses it; produces no ledger rows.
- Direct `insert(ledgerEntries)`: only `ledger.ts:133,151` (postLedgerEntry — legacy double-entry, no settlementStatus) and `:437` (recordSettlementEntry itself).
- `settlementStatus` UPDATEs: only `ledger.ts:551` (settled) and `:585` (failed). `adapters/circle-nano.ts:100` is a response-DTO field, not a DB write.

### 1b. Every writer that commits a developer credit FOR a row in that universe
| # | Writer | Code site | Gate | Mechanism |
|---|---|---|---|---|
| W1 | Reconciler tail | `reconcile.ts:137` → `creditSettlement` | `flipped===true` | `db.transaction` (developers + tools) |
| W2 | Kernel circle-nano `/settle` | `app/api/circle-nano/settle/route.ts:204` → `creditSettlement` | `outcome.alreadySettled !== true` | same shared fn |
| W3 | Proxy x402 | `handleX402Proxy` → `forwardAndBill` credit block `route.ts:1679-1705` | `upstreamOk && !skipCredit` (skipCredit ⟺ alreadySettled, `:1911`) | **own SQL — `Promise.all` of two separate UPDATEs, not a transaction** |
| W4 | Proxy circle-nano | `handleCircleNanoProxy` → same `forwardAndBill` block | same (`:2048`) | same |

**Only TWO code sites implement the credit** (`creditSettlement` for W1+W2; the `forwardAndBill` block for W3+W4) → the marker has exactly two write points. `forwardAndBill` is also called by non-on-chain handlers (ap2/visa-tap/acp/l402/protocol/free paths) whose invocations have **no** settlement row — the marker write must be keyed by an explicit settlement identity passed ONLY by the two on-chain handlers' fresh-flip paths, and the existing `Promise.all` behavior must stay byte-identical for every other caller.

**Full `developers.balanceCents` INCREMENT census (mechanical probe P1a — 13 sites)**, each classified against the row universe:
| Site | Domain | In universe? |
|---|---|---|
| `reconcile.ts:233` (creditSettlement) | W1+W2 | **YES — marker writer** |
| proxy `route.ts:1689` (forwardAndBill) | W3+W4 (+ non-settlement rails via same block) | **YES when on-chain — marker writer (conditional)** |
| proxy `route.ts:693,960,1353,2515` | prepaid/balance/MPP handlers — no settlement rows | no |
| `sessions.ts:695` | settlement-batch disbursements (workflowSessions/settlementBatches; (H) guard excludes reconcilable-rail hop ledger rows) | no |
| `billing/webhook/route.ts:741`, `cron/process-payouts/route.ts:249`, `payouts/process.ts:477` | payout-failure refunds / rollback re-credits (payouts domain — debits being reversed) | no |
| `sdk/meter/route.ts:336`, `sdk/meter-with-metadata/route.ts:189`, `metering.ts:349` | SDK metering revenue share (off-chain metering; no x402/circle-nano settlement rows) | no |

None of the 9 non-member sites credits FOR a settled reconcilable-rail row (verified by reading each site's context this session) — they must NOT write the marker, and they don't touch the sweep's universe. **POST-(T) note (R2 audit fix B3): the built tree has 14 increment sites** — Recipe 4's transactional branch adds a twin of the forwardAndBill credit at the same code site (proxy route count 5→6); the census pin test allowlists the POST-(T) 14 (both route.ts credit-block sites classified together as the W3/W4 marker-writer pair), so any NEW increment site fails the build until classified. Probe P1a's 13 is the PRE-build snapshot.

### 1c. Settled-row classes that legitimately LACK a committed credit
| Class | Cause | Today's signal | Sweep disposition (decision §2) |
|---|---|---|---|
| C1 | F3 upstream-failed after on-chain settle (no credit ever; manual buyer-refund runbook) | `proxy.onchain_settled_upstream_failed` | OPEN incident — pages until operator closes via runbook |
| C2 | `forwardAndBill` billing UPDATE threw | `proxy.onchain_credit_lost_after_settle` | OPEN — genuine loss |
| C3 | `creditSettlement` DB error | `settlement.credit_failed` | OPEN — genuine loss |
| C4 | `creditSettlement` no-data (pre-F4 row shape) | `settlement.credit_skipped_no_data` | legacy → backfilled; a NEW occurrence = anomaly, pages (correct) |
| C5 | **P1 process kill between flip and credit** | **NOTHING (the headline defect)** | OPEN — the sweep's reason to exist |
| C6 | NEW: P3 pin blocks a testnet-row credit | (new `logger.error` `reconcile.credit_blocked_testnet`) | OPEN — a Sepolia row in a prod DB is a real anomaly; DC-13 latent |
| C7 | Pre-(T) legacy settled rows | n/a | migration 0016 backfills `credited_at = settled_at` — never page |

## 2. Marker semantics — DECIDED
**`credited_at` (timestamptz, nullable) = "the developer-balance credit COMMITTED, in the same DB transaction as this marker."** Written ONLY at the two credit sites, at credit-commit. Never written by any non-crediting path.

- A settled reconcilable-rail row with `credited_at IS NULL` (past the grace window) = an **OPEN credit-resolution incident**. The sweep enumerates open incidents every run until closed (posture parity with `reconcile.pending_overdue` — one structured error line per run while the condition persists).
- C1/C2/C3/C6 deliberately do NOT self-mark: each is a genuine unresolved money incident; the runbook's closure step is an operator `UPDATE ... SET credited_at = now()` after the manual credit/refund/investigation. This keeps the census trivially honest (writers = credit-committers, nothing else) and avoids the false-negative arm of LB-1 (a non-crediting path writing the marker would hide a loss). Alarm-fatigue is bounded: these classes are rare, enumerated with operationIds, and each one is real work the operator owes.
- **Grace window:** the sweep ignores rows with `settled_at >= now() - 60min` — between flip and credit there are legitimately seconds-to-30s (W3/W4 credit after the upstream fetch). 60min is unambiguous and immune to slow requests/clock skew.
- **Legacy:** 0016 backfills `credited_at = settled_at` on settled reconcilable-rail rows **with a literal `settled_at < '2026-06-10T20:00:00Z'` upper bound** (R1 fix F6 + R2 fix I2 — the bound is the AUTHORING time, which necessarily predates any (T) deploy, so the text-idempotency claim is unconditional: a re-paste at any time cannot erase live sweep evidence by construction). Legacy rows NEVER page (LB-1 charge); rows settled between the bound and the (T) deploy page on EVERY sweep run until closed (no de-dup by design — R2 fix I4); the runbook carries log-triage (`settlement.credited` present?) + a bounded one-time BULK-closure UPDATE for the verified gap window.
- Marker UPDATE matching zero rows inside the credit transaction → **log `settlement.credit_marker_unmatched`, do NOT throw** (throwing would roll back a real credit — the LB-2-inverse direction; a lost marker self-surfaces via the sweep, a lost credit would not).
- Considered & rejected: a CHECK tying `credited_at` to settled status (adds migration risk, no defect it prevents — writers only run post-flip); making the reconciler's flip+credit one transaction (doesn't generalize to W3/W4 whose credit must stay post-delivery; the marker+sweep covers all four writers uniformly; would be scope growth).

## 3. LB-2 — CAS shape — DECIDED
**One function, hash REQUIRED:** `markSettlementFailed(operationId, rail, txHash: string)` adds `AND external_ref = txHash` to the WHERE. No new function.

- **Caller census (complete):** exactly 3 production callers — `reconcile.ts:157`, `orchestrate.ts:196`, `settle.ts:142` — **all already pass the hash they confirmed** (`confirmation.txHash` / `result.txHash`). Making the param required compiles every caller unchanged; the optional-param hole closes.
- **Hash provenance is exact:** `confirmSettlementTx` returns the INPUT hash in all branches (`settle-engine.ts:269,271,289`), and the engine's reverted result carries the hash it broadcast/waited on (`:301-319`). So the CAS compares "ref now" vs "ref when the evidence was gathered" — it rejects exactly the stale-hash interleavings and nothing else.
- **No legitimate caller can be blocked (zombie-inverse walked):**
  - Live fresh-submit: `onBroadcast` persists the hash BEFORE the receipt wait (`settle-engine.ts:196-205`, awaited) → on a clean revert, `external_ref` equals the hash passed → CAS satisfied.
  - Live recovery path: a stale stored tx that cleanly reverted does NOT call `markSettlementFailed` — it falls through to resubmit (`settle.ts:233-240`, `orchestrate.ts:329-336`), and `onBroadcast` re-points the ref before any flip.
  - Reconciler: confirms the ref it just SELECTed; CAS fails only if re-pointed since the SELECT — the defect.
  - Analyzed edge: `onBroadcast`'s write is swallowed on failure (`settle-engine.ts:202-204`) → ref can be NULL/stale when a clean revert flips. CAS rejects → row STAYS pending → terminalized later (ref=stale: next reconciler pass confirms that very hash and the CAS matches; ref=NULL: outside the reconciler window by design, buyer retry resubmits). Degraded-but-safe, not a zombie; pre-fix behavior (immediate flip) was the unsafe direction.
  - NULL `external_ref` + SQL `=`: `NULL = x` is not-true → no flip → safe direction (a row this code fails always had its ref written first; no caller flips failed on a never-broadcast row — reconciler skips null-ref rows at `reconcile.ts:110`).
- **Reconciler telemetry on CAS-reject (DC-18):** `flipped=false` now has two meanings (already-terminal vs stale-ref-still-pending). On false, re-read via `findSettlementRow`: still-`pending` → NEW outcome **`'pending-stale-ref'`** (CANONICAL name — the plan's Recipe 2a supersedes this trace's earlier `failed-stale-ref` working name; R1 audit fix F4) counted in the summary's `pending` bucket (the row IS still pending and re-examined next rotation with a fresh ref) + `reconcile.failed_flip_stale_ref` warn; terminal → `'failed-noop'` as today. Summary identity (`scanned === settled+failed+pending+skipped+noop+errored+deferred`) preserved.
- **Settled-flip needs NO CAS (handoff §5.1c question, walked):** `confirmSettlementTx`/`interpretReceipt` return `settled` only when THAT hash has a success receipt for the bound (from,nonce) transfer — a settled flip always records true on-chain evidence, whichever actor flips. Wrong-txHash-as-evidence is impossible; both racers hold success receipts only if they hold the SAME mined tx (one (from,nonce) can consume once). Adding a CAS there would CREATE the zombie class (e.g. the swallowed-onBroadcast edge would leave a row pending forever while USDC moved — DC-17 inverse). WHERE-pending stays the settled-flip's only guard (the contract narrows for failed only; never widens — spine clause respected).

## 4. P3 — credit-gate hardening — DECIDED
`reconcile.ts:131` becomes: `if (flipped && isReconcilableRail(rail) && (parsed.network === X402_MAINNET_NETWORK || isX402TestnetSettlementAllowed()))` (shapes final per plan; `parsed` is already in scope from `reconcile.ts:112`).
- **Pin gates ONLY the credit, not the flip** — flipping a Sepolia row settled-on-Sepolia is honest bookkeeping; blocking the flip would mint an immortal pending row (DC-09). A pin-blocked credit logs loudly (`reconcile.credit_blocked_testnet`) and deliberately leaves the row unmarked → sweep pages it (C6; a Sepolia row in prod IS an incident — (G) closed the front door, this closes the credit).
- Mainnet rows are untouched: `eip155:8453 === X402_MAINNET_NETWORK` short-circuits true regardless of env ((G) LB-2 over-broad-guard trap avoided). In non-prod with the testnet flag, Sepolia credits still flow (e2e unaffected). DC-13: the pin is latent in prod today (the (G) allowlist already rejects non-Base admission) — tested as latent.
- `RECONCILABLE_RAILS` unification kills the hardcoded rail pair (DC-07). NOTE: `isReconcilableRail(rail)` is behavior-identical to the literal check today (`rails.ts:18` = exactly those two rails).

## 5. Sweep delivery — DECIDED: fold into the reconcile run
One aggregate query + alert appended to `reconcilePendingSettlements` after the overdue block (`reconcile.ts:473-507` pattern, including the postgres-js string-count normalization — DC-18):
- `SELECT count(*), array_agg(operation_id ORDER BY settled_at ASC LIMIT-bounded)` over the universe WHERE `credited_at IS NULL AND settled_at < now() - 60min`.
- Alert `reconcile.uncredited_settled` (logger.error, one line per run while it persists, operationIds bounded ≤ 25); best-effort try/catch mirroring `reconcile.overdue_check_failed`.
- Summary gains `uncredited: number | null` (extending the SUMMARY is explicitly licensed when the sweep folds in); cron route logs it.
- Budget: one indexed aggregate ≈ the existing overdue aggregate; runs AFTER the examination loop, inside the same 60s maxDuration headroom the (S③) budget reserves. No new cron, no vercel.json change.

## 6. Migration `0016_credited_at` shape
Hand-written (drizzle-kit generate FORBIDDEN — meta intentionally partial), 0015 conventions:
1. `ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "credited_at" timestamp with time zone;` (nullable, no default)
2. Backfill: `UPDATE ledger_entries SET credited_at = settled_at WHERE settlement_status='settled' AND rail IN ('circle-nano','x402') AND credited_at IS NULL AND settled_at < '2026-06-10T20:00:00Z'::timestamptz;` (literal authoring-time bound → unconditionally text-idempotent paste, R1 fix F6 + R2 fix I2; the hardcoded rail pair is a deliberate point-in-time snapshot of `RECONCILABLE_RAILS` — one-time historical statement, live source stays rails.ts, R1 fix F3)
3. Partial index for the sweep: `CREATE INDEX IF NOT EXISTS "ledger_entries_uncredited_settled_idx" ON "ledger_entries" ("settled_at") WHERE "settlement_status" = 'settled' AND "credited_at" IS NULL;` (rails deliberately NOT in the predicate — a future rail addition must not silently fall outside the index's coverage of the sweep's NULL set; the query stays correct regardless — DC-07 note)
4. Header comment: APPLY-THEN-DEPLOY (after 0015, before the (T) deploy — old code never references the column: all `from(ledgerEntries)` reads use explicit column lists, INSERT value lists omit it — same 0015 verification, re-confirmed for `credited_at` by construction since the column is new) **stating the deploy-first consequence explicitly** (R1 fix F5: with (T) code live before apply, the marker UPDATE throws inside EVERY credit transaction → rollback → reconciler/kernel/proxy on-chain credits all fail + the sweep dies every run — strictly worse than 0015's broken-cron blast radius); founder-gated.
5. Register sha-256 hash + epoch in `scripts/bootstrap__drizzle_migrations.sql` (0015 row precedent). `db/schema.ts` gains `creditedAt` + the partial index entry (schema-side `.where(...)` per drizzle partial-index API — verify exact drizzle-orm version support during build; 0015's plain index at `schema.ts:938` is the pattern anchor).
6. `0015` file + its registered hash remain byte-untouched (gate).

## 7. Forced-test sweep (DC-05) — files the new symbols/columns touch
- `src/lib/settlement/__tests__/reconcile.test.ts` — mocks `markSettlementFailed` (`:85`); credit-gate tests; new: CAS outcome `pending-stale-ref` (canonical name), pin gating, marker-in-credit, sweep aggregate + summary key.
- `src/lib/settlement/__tests__/reconcile-starvation.test.ts` — stateful in-memory table executing emitted SQL (the interpreter block `~:44-179`; `:229-232` is the `vi.mock('../ledger')` factory — the spot that gains the `findSettlementRow` key): the harness pattern for the P2 interleaving fail-pre-fix test + sweep-query semantics.
- `src/lib/settlement/circle-nano/__tests__/settle.test.ts`, `src/lib/settlement/x402/__tests__/orchestrate.test.ts` — mock `markSettlementFailed`; signature now requires hash (their calls already pass it).
- `src/app/api/circle-nano/__tests__/route.test.ts` (+ `e2e-smoke.test.ts` db mock) — W2 credit/marker.
- `src/app/api/proxy/[slug]/__tests__/x402-proxy-settlement.test.ts`, `circle-nano-proxy-settlement.test.ts`, `billing-credits.test.ts` — W3/W4 forwardAndBill credit block change (transaction + marker when settlement identity passed; byte-identical otherwise).
- `src/app/api/cron/settlement-reconcile/__tests__/route.test.ts` — summary shape (`uncredited`).
- `src/lib/__tests__/ledger.test.ts` — UNTOUCHED (`recordSettlementEntry` suite `:532` is inert to the column addition; CAS semantics are covered empirically in the new terminal-transition harness — the plan deliberately does NOT touch this file; R2 audit fix I6).
- packages/mcp untouched (`RailSettlementRow`/canonical validator never see `credited_at`) → byte-stable gate intact.
- ⚠ register P7 isolation flakes (`hop-rail-guard`, `gas-wallet-monitor`): gate on the FULL suite only.

## 8. Scope guard (verbatim posture from handoff §1)
IN: `ledger.ts` (markSettlementFailed only — settled/broadcast byte-stable), `reconcile.ts` (creditSettlement + reconcileOneRow tail + gate + sweep + summary), `forwardAndBill` credit block + the two on-chain handlers' call sites (settlement-identity plumb), kernel circle-nano route credit call (pass rail/marker key if signature changes), `db/schema.ts`, `drizzle/0016`, bootstrap script, cron route log line, tests, runbook doc.
OUT (reject as scope growth): P4 transport timeout, P5 terminalization, B1.1, (G) tidies, settled-flip CAS, atomic flip+credit, auto-refund, any `confirmSettlementTx`/engine/rails.ts/`markSettlementBroadcast`/`recordSettlementEntry` edit, payouts/pricing, packages/*.
