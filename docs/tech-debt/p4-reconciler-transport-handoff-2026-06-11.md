# (U) Reconciler transport timeout + detector availability — CHUNK HANDOFF (2026-06-11)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> Closes the ③ register's **P4** (`s-deep-audit-register-2026-06-10.md`) — MED, **③-ESCALATED
> by the (T) deep audit**: the (T) uncredited sweep (the system's ONLY P1 silent-loss detector,
> LIVE in prod since 2026-06-11) emits LAST in the reconcile run and fate-shares the budget-
> overrun kill window with the slowest RPC call.

## 0. Source-of-truth confirmation (derived 2026-06-11 — RE-VERIFY cited lines, do not re-derive the queue)
Ordering chain: the ③ register (P1/P2/P3 CLOSED by (T); P4 carries the escalation addendum) +
the (T) ③ VERDICT (`.audit/t-deep/VERDICT.md`) + the (T) close (deployed) all agree P4 is next.
P5+P8 stay queued BEHIND this chunk as ONE later chunk (prevention lifecycle — different seam:
write-ahead/terminalization, NOT transport). B1.1 remains the forbidden-dilution INCREMENTAL.
No migration is expected for this chunk. The (T) capstone trail: `.audit/t-{prebuild,build,seal,deep}/`.

## 1. SCOPE (record verbatim; size at session start against current capability)
**P4 with its ③ escalation — ONE seam: the reconciler's confirm-path transport + the run's
detector-emission ordering.**
- **(a) CORE — reconciler-specific RPC timeout:** `confirmSettlementTx` uses `publicClientFor`'s
  default viem `http()` transport (no timeout config → ~10s × retries per call; worst observed
  analysis ~41s for receipt + nonce-state reads). One degraded row can eat the entire 40s
  examination budget (and worse — see (b)). Fix shape per the register: a RECONCILER-SPECIFIC
  client/transport (`http(url, { timeout: 3_000, retryCount: 1 })` or similar) used ONLY by the
  reconciler's confirm path. **The live settle path's transport must remain BYTE-IDENTICAL** —
  it deliberately tolerates long waits (the buyer is on the line; aborting early there has
  funds-UX consequences the reconciler doesn't have).
- **(b) ESCALATION — detector availability:** the (S③) budget only checks BETWEEN rows
  (`reconcile.ts` examination loop); a mid-band slow row (~20-45s) admitted just under the 40s
  deadline lands completion past the route's 60s maxDuration → Vercel kills the run BEFORE the
  overdue aggregate and the (T) sweep emit. The two candidate shapes (trace decides, audit
  ratifies): (i) run the sweep + overdue aggregates BEFORE the examination loop (they are
  independent DB-only queries — but this REORDERS the (S③)-sealed run structure; weigh
  telemetry semantics: pre-loop aggregates report the PRE-run state, which arguably is the more
  honest "standing incidents" reading anyway); and/or (ii) a hard per-row deadline
  (`Promise.race` on `examinationDeadline - now`) so no single row can overrun the envelope.
  (a) alone may shrink the band enough that (b) is belt-and-suspenders — the trace must do the
  arithmetic (timeout × retries × reads-per-row vs the 20s tail headroom) and PROVE which
  combination guarantees the detectors always emit.
**REJECTED merges:** P5+P8 (prevention lifecycle — own chunk), B1.1, P6 ops items, P7 test
hygiene, any live-settle transport/behavior change, any new alert beyond what (b) preserves.
**The bar:** *"No single RPC call can prevent the reconcile run's detectors
(`reconcile.pending_overdue`, `reconcile.uncredited_settled`) from emitting; the reconciler's
confirm path degrades to 'unconfirmed' (safe-direction) on timeout; the live settle path's
transport and ALL funds semantics are byte-identical."*

## 2. TIER: **HIGH-STAKES** (conservative — re-confirm at ① against the realized plan)
Triggers: opens **frozen `settle-engine.ts`** (shared by the LIVE settle path — the (T)-era
freeze list held it byte-stable through four chunks) and possibly the **(S③)-sealed run
structure** (option b-i). The funds INVARIANTS are not edited, which is why this is the lighter
end of HIGH-STAKES — but a drift in the shared file IS a live-money risk, so the full cadence
(①→②→③) applies.

### The LOAD-BEARING decisions most likely to be SILENTLY WRONG
**LB-1 — live-path transport isolation.** `publicClientFor` (settle-engine.ts) serves BOTH the
live submit/wait path and the reconciler's confirm path. The fix must be ADDITIVE (a second
client factory or an options param defaulted to today's behavior) such that
`submitCircleNanoOnChain`/`confirmCircleNanoTx` (live) emit byte-identical RPC behavior. Pin
with a test that fails if the live path's transport options change. ⚠ x402 AND circle-nano both
ride this engine — census every `publicClientFor` caller before choosing the seam.
**LB-2 — timeout failure-direction.** A reconciler timeout MUST surface as `'unconfirmed'`
(row stays pending; rotation re-examines next run) — NEVER as a clean revert. Walk the FULL
confirm path: `getTransactionReceipt` timeout (today: caught → 'unconfirmed' at
settle-engine.ts ~:266-269 — verify the new transport's error shape still lands in that catch);
AND the reverted-branch's **nonce-state read** (`authorizationState`/eip3009 recheck): if THAT
read times out after a receipt says reverted, what does `nonceConsumed` default to? A timeout
there must NOT yield `reverted+nonceConsumed:false` (which the reconciler would CAS-flip
`failed` — terminalizing on incomplete evidence; the (T) CAS does NOT protect against this
because the ref matches). This is the chunk's funds trap: prove the timeout cannot manufacture
a clean-revert verdict. If today's code already has this hazard at the default timeouts, it is
IN scope to fix (it is the same seam), and the fail-pre-fix test must demonstrate it.

## INTENT
*Why:* the (T) chunk gave the system its first lost-credit detectors, and the ③ deep audit
proved they fate-share the run's kill window with the slowest RPC call — the detectors are most
likely to be starved EXACTLY during the partial-RPC-degradation episodes that mint the
uncredited rows they exist to surface. This chunk makes detector emission unconditional and
bounds the reconciler's per-call patience. *Who consumes:* (1) the operator — the
`pending_overdue` + `uncredited_settled` alerts become guaranteed-per-run instead of
best-weather; (2) the reconciler itself — bounded confirms mean the rotation actually rotates
under degraded RPC instead of burning the budget on one row; (3) the P5+P8 chunk — prevention
work assumes a reliable detector baseline. *What it enables:* closes the last register item
standing between the credit machinery and "observable under all weather"; after it, the queue
is prevention (P5+P8) and hygiene (B1.1, P6, P7).

## 3. Ground state (2026-06-11) + frozen surfaces
- Repo `/Users/lex/settlegrid`, branch `main`. **`origin/main` = local HEAD = `a016685a`** —
  the full (G)+(S)+(S③)+(T) stack is **DEPLOYED + LIVE-VERIFIED** (Vercel prod GREEN; first
  cron run on real DB: `uncredited: 0`; migration 0016 APPLIED + schema-verified; Sentry rules
  armed: one rule, two message filters — `reconcile.uncredited_settled` +
  `_evidence_on_terminal_failed_row` — selector "any"). Working tree clean at handoff-write
  time except this handoff (+ its local doc commit).
- **Baselines (re-run to anchor BEFORE any edit):** `apps/web`: tsc **0** · vitest **4357 /
  189 files / 0 fail** · build **0** · eslint changed **0**. packages/mcp + python byte-stable
  unless touched (they must NOT be). ⚠ register-P7 isolation flakes (`hop-rail-guard`,
  `gas-wallet-monitor`) — gate on the FULL suite only.
- **UNFROZEN (the licensed surface):** `settle-engine.ts` TRANSPORT seam ONLY (client factory /
  timeout options — NOT `interpretReceipt`'s verdict mapping, NOT submit logic),
  `reconcile.ts` run-ordering/per-row-deadline per option (b), tests, docs. NOTHING else.
- **BYTE-STABLE spine:** all flips + CAS (`ledger.ts`), `creditSettlement` + marker, the sweep's
  WHERE/alert semantics, both orchestrators (incl. the ② alerts + TTL 100), the F2 pin,
  RECONCILABLE_RAILS, the (S) rotation (COALESCE ordering, mark-before-examine, watermark),
  payouts/pricing, packages/, migrations 0000-0016 + bootstrap (⚠ open bookkeeping note: when
  the bootstrap NEXT opens for a real reason, also register `0010_ledger_operation_id_idx`'s
  hash — the index EXISTS in prod, row missing; do NOT open the file just for this).
- **Real-money guardrails:** prod is LIVE on this code — local commits only, **founder-gated
  push** (every push = a Vercel build); no migration expected; DB read-only; single-writer
  core, fan-out for audit gates only. zsh: quote bracketed paths.

## 4. THE ARC (do not skip/reorder — the (T) pattern verbatim)
1. **Scope-confirm trace** (`p4-transport-trace-2026-06-11.md`): (a) `publicClientFor` caller
   census + the exact RPC calls per reconciler examination (receipt, nonce-state, anything
   else) with today's effective timeout arithmetic; (b) the LB-2 walk (every timeout/error
   shape → which verdict — esp. the reverted-branch nonce read); (c) the (b)-option decision
   with the budget arithmetic; (d) viem transport options vs the installed version
   (node_modules — verify, don't recall); (e) DC-05 forced-test sweep (engine tests +
   reconcile suites + the in-memory harness's relationship to transport, if any).
2. **Build plan** (DRAFT until audited): per-file recipes; fail-pre-fix tests (a slow-RPC
   simulation must show the detectors dying pre-fix and emitting post-fix; the LB-2
   nonce-read-timeout test must show the verdict direction); behavior pins (live transport
   byte-identical; summary identity; rotation untouched); gates (tsc 0 / vitest 4357+N / build
   0 / eslint 0 / packages byte-stable / numstat confined).
3. **MANDATORY pre-build audit** — HIGH-STAKES shape: adapt `.audit/t-prebuild/prebuild-audit.mjs`
   (hardened tail VERBATIM) → `.audit/u-prebuild/`. Full lens set in COVERAGE MODE + per-finding
   refuters (default-refuted). MECHANICAL-FIRST: caller-census grep; a timeout-arithmetic
   probe; an error-shape→verdict simulation. **RECURRENCE LENS** (`.audit/defect-ledger/INDEX.md`):
   charge **DC-08** (fail-mode on outage — the headline here), **DC-13** (the timeout is
   latent until RPC degrades — test as latent), DC-18 (detector truthfulness under the new
   ordering), DC-04 (transport constants vs chain reality), DC-07 (timeout constants
   single-source; remember the TTL lesson — enumerate ALL transitive callers per timeout),
   DC-05, DC-15, DC-09 (no new immortal-row class from early-abort), DC-01 (the sweep's
   availability IS the P1 detector). MODEL POLICY per the cadence: lenses+synth = fable;
   refuters = opus; mechanics = scripts; no effort knob exists — record on the Policy line.
   R1→fix→R2; degraded ≠ pass; defer NO finding; PLAN_READY 0-blocking before any code.
4. **Single-writer build + INTERVAL SELF-VERIFICATION** (fresh-context read-only drift checks
   vs THIS handoff §1/§2/§3 after each major batch); fail-pre-fix proven EMPIRICALLY
   (capture to `.audit/u-build/`).
5. **Executable gate** → END the build session with a CADENCE-STATUS report flagging ② (seal
   panel; HIGH-STAKES → ③ follows).
6. At close (after ②/③): founder-gated LOCAL commit (path-scoped) + capstone + close register
   P4 + ledger + memory. Surface to the founder: deploy is push-only (no migration); the
   remaining queue = **P5+P8** (one chunk: terminalization + mirror-window prevention) →
   B1.1 → P6 ops → P7 hygiene → (G) tidies.

## 5. Conduct (binding — the (T) wording verbatim)
(a) self-verify per §4.4 with fresh-context subagents; (b) ground EVERY progress claim in a
tool result from the session; (c) act once you have enough information — the §0 queue
archaeology is DONE, the (T)/(S) decisions are SETTLED; (d) NEVER stop, summarize, or suggest
a new session on account of context limits — the harness manages context; (e) end the build
session with the CADENCE-STATUS report the moment the executable gate is green.
