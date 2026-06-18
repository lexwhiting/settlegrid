# DC-18 — expiry-pass `anchor_degraded` pager de-masking (observability) — ① BUILD HANDOFF (2026-06-18)

> Standalone handoff for the FRESH build agent. READ THIS FIRST, before any code. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**, run gate from `apps/web`).
> This chunk is the dedicated **DC-18 observability follow-up** that V-N4's ③ post-seal deep audit
> escalated and explicitly ROUTED OUT to "its own chunk" (money-safe, deliberately not hotfixed).
> Base = `main` @ `aee3a5e8` (V-N3 compliance-honesty SLICE 5 sealed + ③ SEAL STANDS + PUSHED to origin/main).
>
> READ THESE TOO (step zero, before code):
> - `docs/tech-debt/v-n4-post-seal-deep-audit-resolution-2026-06-14.md` — esp. the "DEFER-FORWARD: the DC-18
>   observability chunk" section (the 4-point recommendation this chunk implements) + the "DC-18 masking
>   cluster" table row (the precise breadth: multi-network + per-call-transient + chain-independent quarantine).
> - `.audit/defect-ledger/DC-18-observability-telemetry-silently-wrong.md` — the class definition + detection cue.
> - The (V) alert-fatigue context: `s-deep-audit-register-2026-06-10.md` P5 + the `(V)` closure banner (the
>   expiry pass was built to CURE alarm fatigue — a naive "page on any unknown>0" REGRESSES that cure; this is
>   the load-bearing constraint, LB-2 below).

## 0. Intent, tier, lifecycle
- **WHY (the defect, money-SAFE but operator-blinding):** `runExpiryPass` (`apps/web/src/lib/settlement/reconcile.ts`)
  fires a same-run "terminalization stall" pager — `logger.error('reconcile.expiry_anchor_degraded', {...stats})` at
  **`reconcile.ts:704-706`** — only when `stats.terminalized === 0 && stats.quarantined === 0 && stats.unknown > 0`.
  This predicate is **pass-GLOBAL**, so it is **co-occurrence-suppressible**: any single terminalize OR quarantine
  ANYWHERE in the pass masks the unknown-only signal. V-N4's ③ OVERTURNED the seal's "single-network uniform"
  premise — the mask triggers on (a) **multi-network co-occurrence** (mainnet + testnet in one pass — ROUTINE in
  staging: testnet terminalizes a row while mainnet's anchor/nonce reads are degraded → `terminalized>0` → pager
  suppressed); (b) **per-call transient RPC errors within one network** (independent `eth_call`s producing a
  terminalize+unknown mix); (c) **chain-independent quarantines** (an unparseable/legacy row quarantines while a
  real RPC degradation goes unpaged). When masked, a total terminalization stall is visible only INDIRECTLY, up to
  **6h later** via the `pending_overdue` alert — the very alarm the (V) chunk de-fatigued. The `{...stats}` payload
  ALSO carries **no network field**, so even when it fires the operator cannot tell which network degraded.
- **WHO CONSUMES IT:** prod operators (the Sentry/error pager). `reconcile.expiry_anchor_degraded` is the SAME-RUN
  detector guarding the expiry-pass terminalization tail. No code consumer; this is purely an operational signal.
- **MONEY-SAFETY (unchanged by this chunk — assert it, don't re-litigate it):** the masking is OBSERVABILITY
  LATENCY only (≤6h). Rows that come back `unknown` STAY `pending` (the LB-2 incomplete-evidence rule); no flip,
  credit, or terminalize decision changes. A TOTAL outage (every row unknown, zero progress) DOES still page today.
  This chunk MUST NOT alter any flip/credit/terminalize/quarantine decision — only the pager predicate, the stats
  counters, and (optionally) the summary surfacing.
- **TIER: HIGH-STAKES.** Triggers: (1) edits the FROZEN money-path reconciler surface (`reconcile.ts`), even though
  only its observability arm; (2) alters an operator ALERT/DETECTOR contract; (3) must PRESERVE the (V)
  alert-fatigue invariant — a regression here re-floods operators (a "silently wrong" failure in the DC-18 sense);
  (4) DC-18 silently-wrong-observability is itself a correctness boundary (a mis-tuned pager either re-masks →
  operators stay blind, or over-fires → alarm fatigue → real signals ignored). Initial tier; ② re-confirms.
- **Lifecycle:** scope-confirm → (this handoff) → pre-build plan audit [runs in the ① orchestrator session, closes
  before any build code] → BUILD → executable gate → ② seal-gating review → seal + bookkeeping → founder-close
  (path-scoped LOCAL commit) → `/push-go`. **Carry-forward (EXCLUDE at founder-close):** the working tree still
  carries an uncommitted out-of-scope `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (slugify UI) — leave
  untouched, exclude again.

## 1. The subject + the two load-bearing decisions (where audit judgment concentrates)

**Subject:** `apps/web/src/lib/settlement/reconcile.ts` — `interface ExpiryPassStats` (`:481-486`), `runExpiryPass`
(`:537-713`), specifically the post-loop pager/telemetry block (`:695-712`) and the two `unknown` increment sites.
Everything else in `reconcile.ts` is FROZEN (§3).

### The two `unknown` sources (the seed of LB-1)
`stats.unknown++` is incremented at TWO distinct sites for TWO distinct degradations:
- **`reconcile.ts:622-624` — ANCHOR-null:** `readSafeBlockTimestampBounded(network)` returned `null` (the safe-head
  block-timestamp read failed) → `chainTs === null` → `stats.unknown++; continue`. The row can't be proven expired.
- **`reconcile.ts:643-645` — NONCE pin-degraded:** `readAuthorizationStateBounded(network, from, nonce, blockNumber)`
  returned `'unknown'` (the nonce-state read PINNED to block N could not be served — a pruning node or a backend
  whose tip < N; this is the precise risk V-N4's block-pin introduced) → `stats.unknown++; continue`.

### LOAD-BEARING DECISION 1 — the de-masked pager predicate (MOST likely silently wrong)
Replace the pass-global `terminalized===0 && quarantined===0 && unknown>0` with a predicate that fires on a genuine
per-network terminalization-stall degradation, DECOUPLED from co-occurring progress elsewhere. The V-N4 ③
recommendation (build it, but the plan audit rules the exact shape):
- **Split the counter** into `unknownAnchor` (the `:622-624` site) and `unknownNonce` (the `:643-645` site) — keep a
  derived total if useful. Both are RPC-degradation signals that stall terminalization; the V-N4 ③ specifically
  calls out the pin-degraded NONCE 'unknown' as the signature the block-pin introduced, but the anchor-null ALSO
  stalls terminalization, so the plan audit must rule whether the page keys on `unknownNonce` alone or
  `unknownAnchor + unknownNonce` (recommended: page on EITHER degradation, but track them separately so the payload
  attributes the cause — under-paging on a real anchor stall would re-mask).
- **Make the predicate PER-NETWORK,** not pass-global: aggregate the stats per `network` (the `parsed.network` key
  already drives `chainTsByNetwork`) and evaluate the degraded-stall signature for EACH network independently, so a
  testnet terminalize cannot mask a mainnet stall (the core de-masking). Put the **network in the pager payload**.
- **The silently-wrong traps the audit must probe:** (i) re-masking — a predicate that still ANDs against
  pass-global or cross-network progress; (ii) attribution inversion — paging on the wrong counter so a real
  degradation type is missed; (iii) a network that examined rows but had ZERO unknowns/terminalize/quarantine (all
  wall-clock-skipped at `:615`/`:626`) must NOT page; (iv) the `examined===0` early-out (the whole block is gated on
  `stats.examined > 0` at `:695`) must be preserved per-network (a network with zero candidates never pages).

### LOAD-BEARING DECISION 2 — preserve the (V) alert-fatigue cure WITHOUT cross-pass state (the other silently-wrong)
The (V) chunk built this pass specifically to END alarm fatigue; the V-N4 ③ rec #3 is explicit: gate the page on a
**SUSTAINED-rate signal (N consecutive passes, OR an unknown-rate threshold)** — "a naive per-pass page on any
unknown REGRESSES it." **Constraint that makes this load-bearing:** the cron (`api/cron/settlement-reconcile`,
`maxDuration=60`, every 15 min per `vercel.json`) is **STATELESS per run** — each invocation is a fresh process, so
"N consecutive passes" has **no in-memory home**; it requires either persistence (a store/marker → heavier, a
migration) OR a **within-pass rate threshold** (no cross-pass state). The recommended minimal-risk realization
(plan-audit confirms): a **within-pass, PER-NETWORK "zero-progress + degraded" signature** — page for a network only
when it made ZERO terminalization/quarantine progress AND its degraded-unknown count dominates its examined set
(e.g. `unknownNonce (+/or unknownAnchor) === examined_for_that_network` with `terminalized===0 && quarantined===0`
for that network). This de-masks the co-occurrence cases WITHOUT re-introducing per-pass fatigue (a single transient
unknown amid real progress on a network no longer pages; a network that is wholly stalled-and-degraded does). **Do
NOT add a DB table / migration / KV store for cross-pass counters unless the plan audit rules the within-pass
signature insufficient** — that would be scope creep and a new frozen surface. The trap: a threshold so sensitive it
re-floods (regress (V)), or so strict it never fires (re-mask). State the chosen threshold + its (V)-preservation
rationale in the build report.

## 2. Build scope (recommended sequence — the plan audit may refine)
**(A)** Extend `ExpiryPassStats` with the per-network breakdown + the two-way unknown split. Minimal shape: keep the
flat totals for the existing `reconcile.expiry_pass` info feed (`:710`, frozen telemetry — do not break its shape
for existing log consumers; ADD fields, don't rename), and add per-network aggregation for the pager. Recommended:
track `byNetwork: Map<string, { examined, terminalized, quarantined, unknownAnchor, unknownNonce }>` populated at
each `stats.*++` site (the network is `parsed.network`; the anchor-null site at `:622` has `parsed.network` in
scope; ensure both unknown sites and the terminalize/quarantine sites update the per-network bucket).
**(B)** Rewrite the pager block (`:695-706`): iterate the per-network buckets; emit ONE
`reconcile.expiry_anchor_degraded` per degraded network (per LB-1 predicate), with the **network + the split counts**
in the payload. Preserve the `examined > 0` guard per network.
**(C)** Keep the `reconcile.expiry_pass` info feed (`:707-710`) truthful — extend its payload with the split/network
breakdown (additive), do not remove the existing keys.
**(D) OPTIONAL (plan-audit-gated — default: INCLUDE only if low-risk, else DEFER):** surface `ExpiryPassStats` in
`ReconcileSummary` (`:723+`) — `runExpiryPass`'s return is currently DISCARDED at `:943`. If included: add an
`expiry` field to `ReconcileSummary`, assign the `:943` call, and extend the cron's `reconcile.settlement_reconcile.done`
summary log. This is additive observability; it must not change the `(S)` truthful-run-telemetry invariant
(`scanned === settled + failed + pending + skipped + noop + errored + deferred`) — `expiry` is a SEPARATE sub-object,
not part of that sum.
**(E) Tests** (`apps/web/src/lib/settlement/__tests__/reconcile.test.ts` — the existing pager assertions live here;
V-N4 added the by-name `expiry_anchor_degraded` assertion + the null-anchor route assertion):
- Re-key the existing `expiry_anchor_degraded` assertions to the new per-network/split shape.
- **The de-masking pins (the point of the chunk):** a pass where network A terminalizes a row AND network B is
  wholly anchor/nonce-degraded MUST now page for network B (the OLD pass-global predicate did NOT — this is the
  regression test that proves the fix; assert it fires with B's network + the degraded counts).
- A pass where a network made real progress with ONE transient unknown MUST NOT page for that network (the (V)
  alert-fatigue preservation pin).
- The `examined===0` / no-candidates path still never pages.
- Prove EVERY new/changed assertion **non-vacuous**: revert the source change → the pin goes RED (record the exact
  revert + the RED in the build report; an evidence-free green is RED).

## 3. Frozen / unchanged (do NOT perturb)
Everything in `reconcile.ts` except the `ExpiryPassStats` shape + the `runExpiryPass` pager/telemetry block
(`:695-712`) + the per-network bucketing at the existing `stats.*++` sites: the candidate SELECT + ordering, the
decidability gates, `quarantineClassify` + its truth-CAS + the `reconcile.expiry_unprovable` error, the
terminalize/`markSettlementExpiredNoBroadcast` evidence-CAS, the `reconcile.expired_nonce_consumed_quarantined`
detection win, the LB-2 incomplete-evidence-stays-pending rule, the deadline/budget discipline, the
mark-before-examine watermark, the window loop, the detectors (`reconcile.uncredited_settled`, the pending-age
overdue alert), the `ReconcileSummary` `(S)` invariant, `markSettlementExpiredNoBroadcast`, the V-N4 block-pin
(`chainTs.blockNumber` plumbing — the nonce read STAYS pinned to N; this chunk does NOT touch the pin, only how its
'unknown' result is COUNTED + paged). **Do NOT** change any flip/credit decision, add locking, add a migration/DB
table/KV store (unless the plan audit explicitly rules LB-2 needs cross-pass persistence), touch `packages/mcp`, or
fold in the OTHER DC-18 ledger instances (dashboard rounding, OFAC log-level, telemetry SQL casts, CSP, CLI-in-CI —
all unrelated surfaces, OUT of scope). `tools/page.tsx` stays untouched + excluded at founder-close.

## 4. Gate + the named "silently-wrong" risks
- **Gate:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → `tsc` 0 · `lint` 0 err (8
  pre-existing `<img>`/unused-disable warns) · `vitest` ALL-pass. Baseline @ `aee3a5e8` = **4572 / 197 / 0**; this
  chunk ADDS/changes reconcile pager tests (expect a small `+N`). `${PIPESTATUS}` is empty under zsh — read the
  `Test Files`/`Tests` summary lines. `packages/mcp` UNTOUCHED.
- **Risks most likely silently wrong** (audit concentrates here): **LB-1** the de-masked predicate (re-masking /
  attribution inversion / a network that should-not-page firing); **LB-2** the alert-fatigue threshold (regress (V)
  vs re-mask) given the stateless cron — and whether a cross-pass store is truly needed (default: NO).
- **Money-safety is an INVARIANT to assert, not a thing to change:** confirm no flip/credit/terminalize path is
  edited; the `unknown`-stays-pending rule is untouched.

## 5. Defect classes in play (from `.audit/defect-ledger/`)
- **DC-18** (observability silently wrong) — the PRIMARY class: a pager that masks (status quo) or over-fires (a bad
  fix). The detection cue: "does a high-severity event reach the operator at a level/shape that distinguishes it
  from routine, and does it actually fire when it should and NOT when it shouldn't?"
- **DC-05** (test-double surface divergence) — the reconcile mock rig is elaborate; the new per-network assertions
  must bite against it (non-vacuity) and not pass vacuously because the mock doesn't model multi-network.
- **DC-15** (docstring/comment ↔ behavior sync) — the `:695-704` comment block justifies the OLD pass-global
  predicate ("a pass that examined ≥1 candidate yet terminalized AND quarantined NOTHING…"); it MUST be rewritten to
  the per-network/split model — a surviving stale rationale beside the new code is the exact DC-15 nit.
- **DC-08** (implicit wrong fail-mode) — ensure a network with examined>0 but all-wall-clock-skipped (no unknowns,
  no progress) does NOT trip the degraded pager (it is not a degradation).
- **SEAM** (standing) — re-validate against: the (V) alert-fatigue contract (P5 / the `(V)` banner); the `(W)`
  `logger.emit` spread-fix (the `{...stats}` payload must not let a `msg`/reserved key clobber — keep the structured
  keys); the stateless-cron constraint (no in-memory cross-pass state survives). **LITERAL-EXECUTION** (standing) —
  read each `logger.error`/`logger.info` call + the per-network iteration as it executes (a `Map` iteration order,
  an empty-network bucket, the `examined>0` guard).

## 6. PLAN-AUDIT HARDENING (MANDATORY — 2026-06-18; BINDING, SUPERSEDES any softer wording above)
The ① pre-build plan audit (5 fresh-context lens-distinct Opus-4.8 reviewers — correctness/LB-1 · alert-fatigue/LB-2
· SEAM · literal-execution · scope+test-fidelity+DC-recurrence, xhigh, coverage mode) CONFIRMED the de-masking
DIRECTION (per-network split is sound + money-safe) and produced these BINDING refinements. Two were
ground-truthed live by the integrator against source. Build ALL of them.

**RESOLVED — LB-2 the page predicate (the highest-risk decision; integrator-verified):**
- **REJECT the `unknown === examined_net` "dominance" variant floated in §1/§LB-2.** The (V) operator runbook
  `docs/tech-debt/v-pending-lifecycle-runbook-2026-06-12.md:134-138` ALREADY RETIRED `unknown===examined` as
  false-negative-prone: `stats.examined++` (reconcile.ts:584) counts a row BEFORE the wall-clock pre-filter (:615)
  and the chain-not-expired skip (:626), so wall-skips INFLATE `examined` and a genuinely-degraded network can have
  `unknown < examined` and never page (a re-mask). Verified at source.
- **BUILD the per-network form of the runbook's documented correct cue** (runbook:138): page network N iff
  `terminalized_N === 0 && quarantined_N === 0 && (unknownAnchor_N + unknownNonce_N) > 0`.
- **Do NOT add a floor/ratio damper, and do NOT add ANY cross-pass persistence (KV / DB table / migration).**
  Rationale (integrator ruling, resolving the one L1↔L2 reviewer tension): this bare per-network form is the
  per-network analogue of the ALREADY-SHIPPED pass-global pager (:704) — it does NOT newly introduce single-row
  fatigue (that per-run posture is pre-existing and accepted by (V)/V-N4); the SUSTAINED / "across consecutive
  runs" judgment lives in the persistent `reconcile.expiry_pass` INFO feed (:710 — the runbook's documented human
  cue) and `pending_overdue` (≤6h) is the money-safe backstop; the page is capped at ≤2 lines/pass (2 canonical
  networks) so it cannot flood. This satisfies the INTENT of V-N4 ③ rec #3 (preserve the (V) cure) via the
  runbook's mechanism, and a floor would UNDER-page vs the shipped posture. V-N4 ③ rec #3's "naive per-pass page on
  any unknown REGRESSES (V)" warns against DROPPING the `terminalized===0 && quarantined===0` no-progress gate — the
  predicate above KEEPS that gate, so it is not the naive form. A cross-pass store would be scope creep + a new
  frozen surface (the stateless 15-min cron has no in-memory home; confirmed at source — reconcile.ts has no
  module-level mutable state, the cron route persists nothing).

**RESOLVED — LB-1 per-network bucket KEYS (prevents a pager-disabling null-deref; integrator-verified):**
- Aggregate the per-network buckets ONLY at the SIX CANONICAL-network outcome sites, where `parsed.network` is a
  validated canonical string: `:603` (legacy-no-validbefore quarantine), `:609` (malformed-vb quarantine), `:623`
  (anchor-null → `unknownAnchor`), `:644` (nonce-unknown → `unknownNonce`), `:659` (nonce-consumed quarantine),
  `:678` (terminalized).
- **Do NOT bucket per-network at `:584` (`examined++`, runs BEFORE `parsed` exists), `:591` (unparseable —
  `parsed===null`, so `byNetwork.get(parsed.network)` THROWS → caught at :690 → the WHOLE pager block is skipped →
  observability-fatal), or `:595` (unsupported-network — `parsed.network` is non-canonical).** These three sites
  increment the FLAT `stats.*` totals ONLY. (Excluding them is also CORRECT for de-masking: the network-less /
  chain-independent quarantines must not be able to mask, nor be attributed to, a real network's RPC degradation.)
- **Create per-network buckets LAZILY** (do NOT pre-seed both networks). Bucket-existence ⟺ that network reached ≥1
  canonical outcome this pass; iterate only existing buckets → a network with zero canonical candidates (or only
  wall-clock-skipped rows) never pages (this IS the per-network `examined>0` guard; preserves §1 LB-1(iii)/(iv)).

**RESOLVED — attribution: page on EITHER unknown counter (integrator-verified):**
- The PAGE predicate uses `(unknownAnchor_N + unknownNonce_N) > 0` (inclusive-OR); the two-way split is for PAYLOAD
  ATTRIBUTION ONLY (so the operator sees which read degraded). Paging on `unknownNonce` ALONE re-masks a total
  anchor-read outage: the anchor-null `continue` (:624) precedes the nonce read (:642), so a network whose
  `readSafeBlockTimestampBounded` is wholly down yields `unknownAnchor>0, unknownNonce=0` and never reaches the
  nonce read (verified at source).

**RESOLVED — flat totals + info-feed preserved (no NEW DC-18 telemetry regression):**
- Keep the FLAT `stats.*` counters incremented EXACTLY where they are today; the per-network map is ADDITIVE,
  NEVER the source of the flat totals (else `reconcile.expiry_pass`'s `examined` etc. silently change).
- The `reconcile.expiry_pass` INFO feed (:710) MUST retain a flat `unknown` key (= `unknownAnchor + unknownNonce`):
  test R-V24 (~reconcile.test.ts:1171-1174) asserts `objectContaining({ examined, unknown, terminalized })` on that
  line — dropping the flat `unknown` reddens it. Extend the info-feed payload ADDITIVELY (add the split +
  per-network breakdown); never rename/remove an existing key. (The `(W)` logger spread-fix protects reserved keys
  `level`/`msg`/`ts`; `network`/`unknownAnchor`/`unknownNonce` collide with none — confirmed at logger.ts.)

**RESOLVED — accepted residual (state explicitly; do NOT de-mask — avoids over-engineering):**
- INTRA-network quarantine co-occurrence: the predicate gates on `quarantined_N === 0`, so WITHIN one network a
  quarantine (a legacy/malformed-vb row at :603/:609) co-occurring with a degraded-unknown still suppresses that
  network's page THAT pass. ACCEPTED: the quarantined row sets `expiryClass` → drops from the candidate SELECT
  (:562) within ≤1–2 passes (≤30 min) → only the degraded-unknowns remain → the network then pages; `pending_overdue`
  (≤6h) backstops. Matches the ledger's accepted-LOW posture. Record it; do NOT add complexity to de-mask it.

**RESOLVED — rec-4 (surface ExpiryPassStats in ReconcileSummary): DEFERRED — do NOT build §2(D).**
- It touches the `(S)` `ReconcileSummary` truthful-telemetry invariant surface and breaks R-V21's exact-keys pin
  (`Object.keys(summary).sort()).toEqual([…])`, ~reconcile.test.ts:1228) for ZERO de-masking benefit — the
  per-network pager + the info feed already deliver the observability. Leave `runExpiryPass`'s return discarded at
  :943. (Doc-correction for the record: the cron summary event is `cron.settlement_reconcile.done` (route.ts:44),
  not the §2(D) typo `reconcile.settlement_reconcile.done` — moot now that §2(D) is dropped.)

**TEST-FIDELITY (DC-05 — BLOCKING; the headline pin is VACUOUS without this):**
- The de-masking regression pin (network A terminalizes a row WHILE network B is wholly degraded → MUST page for B,
  MUST NOT page for A) is the POINT of the chunk and CANNOT be expressed against the current rig: `mockChainTs` /
  `mockNonceState` (~reconcile.test.ts:79) are FLAT singletons (one `mockResolvedValue`) returning the same result
  regardless of network. BUILD MUST: (a) convert both readers to `mockImplementation((network, …) => …)` so the two
  canonical networks `eip155:8453` + `eip155:84532` (both pass `isCanonicalX402Network`) diverge within ONE pass;
  (b) seed a second-network candidate op-id (EXPIRY_PASS_LIMIT=3 admits ≥2 candidates). NON-VACUITY: revert the
  source to the pass-global predicate → the two-network pin goes RED (A's terminalize makes pass-global
  `terminalized===0` false → no page at all → B's expected page absent). Record the revert→RED evidence per pin.
- ADD a per-network↔flat reconciliation pin: `sum over byNetwork buckets of each counter === the flat stats
  counter` (for the canonical-bucketed counters) — catches a missed bucket-increment (info-feed↔pager divergence).
- Re-key the existing R-V24 null-anchor pin to assert the page fires with `unknownAnchor` populated (not nonce).
- ADD the (V)-preservation pin (a network making real progress with ONE transient unknown does NOT page) and the
  DC-08 pin (a network with `examined>0` but ALL rows wall-clock/chain-not-expired-skipped — no unknown — does NOT
  page per network).

**DC-15 (comment + runbook sync — required deliverables):** rewrite the `:695-704` comment block to the
per-network / two-counter / inclusive-OR model (today it justifies the pass-global predicate AND mentions only the
nonce route — both wrong post-fix). Update the (V) runbook's expiry-pager cue (`…runbook…:134-147`) to the
per-network shape (the runbook is documentation, in-scope to touch).

**MONEY-SAFETY (assert in the build report; do NOT change):** no flip/credit/terminalize/quarantine DECISION is
edited — only the counters, the pager block, and the comment. The `unknown`-stays-pending `continue` (:624/:645)
and the V-N4 block-pin (:642) are UNTOUCHED. A missed page is bounded ≤6h by `pending_overdue`; the correct bias is
toward NOT over-firing (an over-fire regresses (V); an under-fire is ≤6h-latency-bounded).
