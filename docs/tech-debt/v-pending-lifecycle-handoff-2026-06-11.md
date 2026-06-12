# (V) Pending-row lifecycle: terminalization-evidence + mirror-window prevention — CHUNK HANDOFF (2026-06-11)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> Closes the ③ register's **P5 + P8 (incl. the (U)-③ addendum P8(g))** — the (U) handoff §0
> queued them as ONE chunk ("prevention lifecycle — write-ahead/terminalization"); the register
> P8 entry itself says "fits naturally WITH P5".

## ⛔ 0. HARD PRECONDITION — the (U) CLOSE must be COMPLETE before this chunk's BUILD starts
Verify before anything: the (U) chunk (③-register P4) is ②-SEALED + ③-SEAL-STANDS but its tree
was UNCOMMITTED at ③-end. The close (founder-gated path-scoped LOCAL commit of the (U) diff +
capstone + register-P4 close + the ③ CLOSE WORK-LIST in `.audit/u-deep/VERDICT.md` — register
addenda incl. P8(g), operator-doc edits, defect-ledger folding) MUST land first:
- `git log --oneline -2` must show the (U) commit atop `f7a15925`; `git status` must be clean
  of the (U) settlement files. Building (V) atop an uncommitted (U) contaminates the commit
  boundary (the shared-worktree/path-scoped-commit hazard) — DO NOT proceed; run/request the
  close instead.
- The register P5/P8 entries should then carry the ③ addenda; if the close session missed any,
  THIS handoff quotes everything (V) needs (§1) — the handoff is authoritative for scope.

## 0.5 Source-of-truth confirmation (derived 2026-06-11 — re-verify cited lines, not the queue)
Queue: the (U) handoff §0 + the register + memory all agree: after (U) → **P5+P8 as ONE chunk**
→ B1.1 (forbidden-dilution INCREMENTAL, stays standalone) → P6 ops → P7 hygiene → (G) tidies.
The (U) ③ (`.audit/u-deep/VERDICT.md`) added **P8(g)** (live-engine LB-2 twin — HIGH,
register-routed with fix shape) and a **NEW credit-finality policy item** (founder decision —
EXCLUDED here, operator gate). Cadence trail to inherit: `.audit/{u-prebuild,u-build,u-seal,
u-deep}/` + `docs/tech-debt/p4-*-2026-06-11.md`.

## 1. SCOPE (record verbatim; sized at ① to current capability — the largest coherent chunk on ONE seam)
**The pending-row WRITE-AHEAD LIFECYCLE + the terminalization-evidence invariant, across six
licensed faces (P5 + P8 a/c/e/f + P8(g)):**
1. **(P5-i) validBefore capture:** both `ensurePendingRow`s (`circle-nano/settle.ts:88`,
   `x402/orchestrate.ts:134`) store `proof.authorization.validBefore` in row metadata (both
   already have the proof in scope; metadata is jsonb — NO migration).
2. **(P5-ii) expiry terminalization/quarantine:** never-broadcast (`external_ref` NULL) pending
   rows whose authorization is PROVABLY dead terminalize 'failed' — the proof obligation is
   BOTH (a) `now > validBefore + margin` (margin ≥ receipt-wait 30s + clock/block-timestamp
   skew; trace pins it) AND (b) a bounded on-chain `authorizationState(from,nonce)` read
   returning **false** (unconsumed). Nonce CONSUMED ⇒ the P8(b) untracked-hash class just
   SURFACED — quarantine-classify + alert (funds moved, no tracked hash; runbook attribution),
   NEVER 'failed'. Read FAILS ⇒ stay pending (the (U) LB-2 rule). Legacy rows without
   metadata.validBefore: quarantine-classify only (validBefore is NOT recoverable from the
   opid) — never guess expiry. WHERE the pass runs (inside the reconcile run as its own
   bounded step vs a separate cron) is the trace's structural decision — weigh the (U)
   detectors-first guarantee (must not be diluted), the run budget, and the (S) rotation.
3. **(P8-a) live resubmit terminal re-check:** the recovery-resubmit path re-reads row status
   immediately before a fresh submit and aborts if terminal (shrinks the mirror window;
   surviving race stays DETECTED by the (T) evidence alerts).
4. **(P8-e) no-clobber broadcast:** in the reverted+nonceConsumed branch, a lock-less loser's
   `markSettlementBroadcast` must NOT overwrite a DIFFERENT existing ref (needs a
   markSettlementBroadcast variant in ledger.ts — frozen surface, licensed here). ⚠ must NOT
   break the legitimate same-actor T1→T2 re-point of a genuinely dropped tx.
5. **(P8-f) winning-hash response** in the mirror branch (return the winner, not the row's
   reverted ref) + **(P8-c)** the reconciler's settled-`!flipped` arm gains the failed-row
   re-read classification (divergent-receipt views named, not lumped into settled-noop).
6. **(P8(g)) live-engine LB-2 twin** (the (U)-③ HIGH): `interpretReceipt`'s reverted-branch
   nonce-recheck CATCH maps to `broadcast-unconfirmed` (NOT nonceConsumed:false → terminal
   'failed') — one branch; both orchestrators already map that kind to pending +
   markSettlementBroadcast; flip the settle-engine test expectation as the red/green proof
   (mirror of the (U) reconciler fix). Verify BOTH rails' consuming arms + buyer-facing
   response semantics under the new kind.
**Registered fold-on-open riders (zero new surface, only if the file opens anyway):** the stale
`confirmSettlementTx` docstring (P7/critic-C5 — settle-engine.ts opens via P8(g)); the
`creditSettlement` tools-UPDATE zero-row check (P7/critic-C4) ONLY if reconcile.ts opens.
**REJECTED merges:** credit-finality policy (founder gate — NEW register item, untouched);
B1.1 (register-forbidden dilution); P6 ops (cron-429 trail, RPC-health discriminator, dead-man
switch); P7 hygiene beyond the two riders; P8(b) (irreducible — register note only); ANY
reconciler-transport change (sealed by (U)); migrations; pushes/deploys.
**The bar:** *"No pending settlement row is immortal-by-construction: a never-broadcast
authorization terminalizes once provably expired AND nonce-unconsumed on-chain, and
quarantine-classifies otherwise; NO actor — live path, reconciler, or the new expiry pass —
terminalizes on incomplete evidence (a failed nonce-recheck or a failed expiry-proof read
always degrades to a pending-side state); a known-good ref is never clobbered; the live
resubmit re-checks terminality pre-submit; every surviving race remains DETECTED; the (U)
detectors-first guarantee and the live submit/receipt transport are byte-identical."*

## 2. TIER: **HIGH-STAKES** (re-confirm at ① of the build session against the realized plan)
Triggers (any one suffices; all five fire): (i) adds a NEW terminal-transition actor (the
expiry pass — the most dangerous kind of change this system takes; a wrong predicate silently
buries recoverable credits); (ii) edits frozen money surfaces — `settle-engine.ts`
interpretReceipt (the LIVE path this time — the very branch (U) refused to touch),
`ledger.ts` (broadcast variant), BOTH orchestrators; (iii) changes a write contract
(pending-row metadata gains validBefore, consumed later as terminalization evidence);
(iv) touches the exactly-once/credit invariants (the core moat); (v) alters failure-direction
guarantees (the LB-2 rule extended to the live path).

### The LOAD-BEARING decisions most likely to be SILENTLY WRONG
**LB-1 — the expiry-proof predicate (THE funds trap).** "Expired" alone is NOT proof of
no-movement: a row whose writeContract succeeded but whose onBroadcast died (the P8(b) window)
has external_ref NULL yet its tx may have MINED before validBefore passed — nonce consumed,
USDC moved. Terminalizing that row 'failed' = the silent lost-credit class this whole register
exists to kill. The predicate MUST be conjunctive (expired AND nonce-unconsumed-NOW), the
nonce read's failure direction MUST be pending-side, and the consumed arm MUST quarantine+alert
(it is a DETECTION WIN, not an expiry). Every test of the pass must include the
mined-then-expired row as the adversarial case. DC-08/DC-09/DC-01.
**LB-2 — the no-clobber conjunct vs legitimate re-points.** markSettlementBroadcast's variant
must reject a LOSER overwriting a known-different winner ref while preserving the SAME-ACTOR
crash-recovery re-point (T1 dropped → resubmit T2) that (T)-era code intends. The wrong
conjunct either silently bricks crash recovery (immortal pending, DC-09) or silently re-opens
P2 (stale-ref terminalization). The trace must enumerate every markSettlementBroadcast caller
+ every (actor × ref-state) cell BEFORE the plan fixes the WHERE.
**LB-3 — P8(g)'s blast radius on the live path.** The one-branch interpretReceipt change is
consumed by BOTH rails' orchestrator arms and ultimately by buyer-facing responses; the
broadcast-unconfirmed arm must leave rows pending + re-pointable + reconciler-recoverable on
both rails (the ③ VERDICT records the consuming arms as already-compatible — RE-VERIFY, don't
inherit).

## INTENT
*Why:* (T) gave terminal flips evidence-keying and credits a detector; (U) made the detectors
unstarvable and fixed the reconciler's evidence rule. The remaining structural holes are the
two LIFECYCLE ones: rows that can never terminalize (P5 — permanent pending_overdue, alarm
fatigue on the one alert guarding the credit tail, 96 error lines/day once any exists) and
terminalization on incomplete/raceable evidence at the live seam (P8 + P8(g) — the ③ audit's
HIGH). *Who consumes:* the operator (pending_overdue becomes ACTIONABLE again — every line is
a real anomaly; the quarantine class gives the P8(b) window its first detector); the buyer
(no terminal 'failed' verdicts on funds that moved); P6's dead-man/ops work (assumes alert
hygiene); the credit-finality founder decision (cleaner substrate). *What it enables:* after
(V), the register's money-path structural items are CLOSED — the queue drops to standalone
B1.1, P6 ops, P7 hygiene, (G) tidies.

## 3. Ground state + frozen surfaces
- Repo `/Users/lex/settlegrid`, branch `main`. Build atop the (U) CLOSE commit (see ⛔ §0).
  Baseline gate at (U)-seal: apps/web tsc **0** · vitest **4368 / 191 / 0** · build **0** ·
  packages byte-stable. ⚠ register-P7 isolation flakes (hop-rail-guard, gas-wallet-monitor):
  gate on the FULL suite only. ⚠ vitest stays 2.1.9 — do NOT upgrade mid-chunk.
- **UNFROZEN (the licensed surface):** `ensurePendingRow` metadata (both files), the expiry
  pass (placement per trace — reconcile.ts step or new cron + vercel.json line IF the trace
  picks a cron; flag EITHER WAY in the plan), `ledger.ts` markSettlementBroadcast variant +
  its callers, the orchestrators' resubmit/mirror branches (P8 a/e/f), `settle-engine.ts`
  interpretReceipt's reverted-branch CATCH ONLY (P8(g)) + the stale docstring rider,
  reconcile.ts settled-`!flipped` arm (P8-c) + the tools-UPDATE rider if opened, tests, docs.
- **BYTE-STABLE spine (zero behavioral delta; reject any "fix" that perturbs it):** the (U)
  reconciler transport (RECONCILER_RPC_*, reconcilerPublicClientFor, confirmSettlementTx) +
  detectors-first ordering + the error-level overdue_examined carrier; publicClientFor +
  wallet client + RECEIPT_TIMEOUT_MS + submit guards; all (T) CAS/flip WHEREs (the variant is
  ADDITIVE), creditSettlement + marker, the sweep WHERE/alert semantics; the (S) rotation
  (COALESCE, mark-before-examine, watermark, budget/deferred); the cron route's auth/shape;
  RECONCILABLE_RAILS; payouts/pricing; packages/; migrations (NONE expected — metadata is
  jsonb; if the trace concludes otherwise, STOP and re-scope). The PINNED un-edited suites:
  `reconcile-starvation.test.ts` + `transport-isolation.test.ts` +
  `reconcile-detector-availability.test.ts` — zero diff lines, stay green.
  (`terminal-transition.test.ts` MAY open — P8-c/e touch its surface; any edit needs the
  moved-vs-changed discipline + the plan's explicit license per assertion.)
- **Real-money guardrails:** prod LIVE on this stack — local commits only, founder-gated push;
  DB read-only; single-writer build, fan-out for audits only. zsh: QUOTE bracketed paths.
- The expiry pass's nonce read SHOULD reuse the (U) bounded-transport pattern (its own client
  or the reconciler's — trace decides; never the live path's unbounded defaults, and never
  blocking a live request on it).

## 4. THE ARC (do not skip/reorder — the (T)/(U) pattern verbatim)
1. **Scope-confirm trace** (`v-pending-lifecycle-trace-2026-06-11.md`): (a) census — every
   markSettlementBroadcast caller, every pending-row writer/reader, every interpretReceipt
   consumer arm (both rails, incl. buyer-response mapping), the null-external_ref row classes
   live in prod (categorize by metadata shape); (b) the LB-1 proof-obligation walk (every
   evidence state × actor → verdict table, incl. the mined-then-expired adversarial row and
   the legacy-row arm); (c) the LB-2 caller×ref-state matrix → the variant's exact conjunct;
   (d) the expiry-pass placement decision (in-run step vs cron) with the (U)-guarantee +
   budget arithmetic; (e) validBefore ground truth vs the LIVE USDC contract semantics
   (DC-04 — verify block.timestamp comparison + uint sizes in the vendored ABI, not recalled);
   (f) DC-05 forced-test sweep (which suites/harnesses model the touched chains).
2. **Build plan** (DRAFT until audited): per-file recipes; fail-pre-fix tests for EVERY face
   (the P8(g) expectation flip; the expired+consumed quarantine case red-pre-fix; the
   no-clobber cell red-pre-fix; the resubmit re-check); behavior pins (live transport + (U)
   spine byte-identical; summary identity; rotation untouched); gates (tsc 0 / FULL vitest
   4368+N / build 0 / eslint 0 / packages byte-stable / numstat confined / untracked confined
   / pinned suites zero-diff).
3. **MANDATORY pre-build audit — HIGH-STAKES shape** (closes before ANY code): adapt
   `.audit/u-prebuild/prebuild-audit.mjs` (hardened tail VERBATIM — degraded-run guard,
   refuter-death fail-safe-sustained, synthesizer-death inline fallback) → `.audit/v-prebuild/`.
   MECHANICAL-FIRST: scripted censuses (callers, row classes, consumer arms), a
   predicate-truth-table probe, the validBefore ABI check. Full lens set in COVERAGE MODE +
   per-finding refuters (default-refuted). **RECURRENCE LENSES** (`.audit/defect-ledger/INDEX.md`):
   **DC-01** (credit atomicity — the headline) · **DC-09 BOTH directions** (immortal rows AND
   the wrong-expiry inverse — burying a recoverable credit) · **DC-08** (every new read's
   failure direction) · DC-02 (resubmit idempotency) · DC-06 (the broadcast variant is an
   idempotent-writer edit) · DC-04 (validBefore/authorizationState vs live contract) · DC-05 ·
   DC-13 (expiry/race weather is latent — test as latent) · DC-15 · DC-17 (the expiry pass
   re-runs idempotently) · DC-18 (the quarantine class's truthfulness; pending_overdue becomes
   actionable). MODEL POLICY: lenses/synth = fable (effort high; no per-agent effort knob in
   this harness — record on the Policy line); refuters = opus; mechanics = scripts.
   R1→fix→R2; degraded ≠ pass; defer NO finding; PLAN_READY 0-blocking before any code.
4. **Single-writer build + INTERVAL SELF-VERIFICATION:** after EACH numbered batch, a
   fresh-context read-only subagent diffs the work vs THIS handoff §1/§2/§3 (scope, the three
   LBs, frozen spine, pinned suites); fail-pre-fix proven EMPIRICALLY (captures to
   `.audit/v-build/`).
5. **Executable gate** → END the build session with a CADENCE-STATUS report flagging readiness
   for ② (seal panel; HIGH-STAKES → ③ follows in later sessions).
6. At close (after ②/③): founder-gated path-scoped LOCAL commit + capstone + register
   P5/P8/P8(g) close + ledger folding + memory + the runbook updates (the quarantine class +
   the actionable-overdue posture).

## 5. Conduct (binding — the (T)/(U) wording)
(a) self-verify per §4.4 with fresh-context subagents at every batch boundary; (b) ground EVERY
progress claim in a tool result from the session — report only evidence-backed work; (c) act
once you have enough information — the queue archaeology is DONE, the (T)/(S)/(U) decisions are
SETTLED, do not re-derive or re-litigate them; (d) NEVER stop, summarize, or suggest a new
session on account of context limits — the harness manages context; (e) end the build session
with the CADENCE-STATUS report the moment the executable gate is green.
