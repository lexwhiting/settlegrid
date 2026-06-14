# (V-N4) — ③ POST-SEAL DEEP AUDIT — HANDOFF (HIGH-STAKES; paste into a fresh session)

> **③ of the ARC.** V-N4 (reconciler expiry-pass nonce-read block-pinning) was BUILT, gated green, and
> **② SEALED 2026-06-13** (`v-n4-nonce-read-block-pinning-seal-2026-06-13.md`). This ③ is the post-seal
> deep audit warranted for a HIGH-STAKES chunk. Lifecycle: ① handoff ✓ → pre-build plan audit ✓ → BUILD
> ✓ → ② seal-gating review ✓ (SEALED) → **③ post-seal deep audit = YOU**. Founder-gated: never
> commit/push/deploy/set-env; DB read-only. Nothing is committed — HEAD is still `b3b1e175`; the sealed
> bytes are UNCOMMITTED in the working tree (fingerprint in the seal doc).

## What ③ is (and how it differs from ②)
② reviewed the BUILT DIFF in isolation (the 5 files), hostile and fresh-context, and DECIDED the seal.
③ takes the **integrated-whole** view: re-derive the core money invariant across the *integrated*
reconciler (window pass + expiry pass + the live submit/confirm path + the ledger CAS) and the **deploy
posture**, and hunt the collective blind spot the ② panel could structurally miss because each lens was
scoped. ③ does NOT re-litigate the seal mechanically; it asks "now that this is wired into the running
system and a real RPC provider, what breaks?"

## Tier = HIGH-STAKES (inherited; re-confirm)
Real-USDC Base-mainnet terminalize decision; on-chain ground truth; determinism guarantee; edits a
(V)-③-certified surface. ② re-confirmed no escalation trigger fired in the build (no frozen surface
touched, no new input boundary). ③ re-confirm against the integrated system.

## The change (one line)
The expiry pass pins its on-chain `authorizationState` nonce read to the SAME safe block N whose
timestamp proved chain-expiry (was implicit `'latest'` against a `'safe'` anchor), closing a
replica-lag window that could wrong-terminalize a row whose USDC moved + suppress the P8(b) detector.
Sealed bytes: `settle-engine.ts` (the two readers) + `reconcile.ts` (`runExpiryPass`) + their two test
files + the a2 deploy-precondition doc. Diff/fingerprint/gate: see the seal doc + `.audit/v-n4-seal/`.

## ② carried these SUSTAINED residuals — ③'s priority targets (all accepted as non-blocking at seal)
1. **Detector sensitivity (VN4-D1 + VN4-C1, DC-18, the headline ③ item).** The new
   `reconcile.expiry_anchor_degraded` same-run pager fires ONLY on a TOTAL stall
   (`terminalized===0 && quarantined===0 && unknown>0`, `reconcile.ts:660`). A genuine pin-degraded
   nonce-`unknown` is SUPPRESSED whenever an unrelated chain-independent quarantine (legacy/unparseable
   row) OR a terminalize co-occurs in the same ≤3-row pass (reproduced `{examined:2,quarantined:1,
   unknown:1}`→no fire). Accepted at seal because: it's the spec-chosen threshold (avoid the alert-fatigue
   (V) cured), masking is transient/self-resolving (quarantined rows set `expiryClass`, exit the pool),
   and it's backstopped by `pending_overdue` ≤6h + the per-run `expiry_pass{unknown>0}` feed. **③: is
   the spec threshold the right sensitivity/specificity point, or should pin-degraded nonce-`unknown` be
   tracked SEPARATELY from anchor-null `unknown` and paged regardless of co-occurrence? Model the
   realistic steady-state (EXPIRY_PASS_LIMIT=3/pass, 15-min cron) — how long can a sustained pin
   degradation stay masked by a backlog of quarantine-able rows?**
2. **The deploy precondition as a SAFETY question (clamping-backend, DC-08).** ②'s core-invariant lens
   (@/effort max) could not exhibit a money loss, but flagged: the "liveness not safety" framing rests
   on the EMPIRICAL claim that no mainstream RPC silently clamps a FUTURE numeric block N (tip < N) to an
   encoded-stale `false` (→ wrong `'unconsumed'`→terminalize) instead of erroring. All documented client
   behaviors (geth `0x`→viem-throws→`'unknown'`; reth errors; EIP-1474 `-32001`) fail SAFE. **③: confirm
   against the ACTUAL prod `SETTLEGRID_BASE_RPC_URL` provider's documented future-block behavior (founder/
   ops input). If any candidate provider can return a successful stale-encoded answer for a future block,
   the precondition is load-bearing for SAFETY, not just liveness — escalate.**
3. **VN4-TF-1 test-robustness (DC-05).** The `beforeEach` default `mockChainTs` (now `{ts,blockNumber}`)
   is not independently guarded — a future revert to a bare number passes 60/60 (NOT a current vacuity;
   the pin IS pinned by R-V30 + the settle-engine concrete-bigint tests; reverting SOURCE goes 11-RED).
   Spec §9.4 consciously accepted "R-V12/R-V17 ride the default." **③: decide whether a one-line
   default-mock guard is worth a test-tuning pass.**
4. **F-DC15 env.ts comment (DC-15).** `env.ts:280` "(Recommended, not required)" is now understated;
   env.ts is FROZEN so it was correctly NOT edited (a2 GO-LIVE item 5 carries the authoritative version).
   **③: fold the comment only when env.ts next legitimately opens.**

## Frozen / out-of-scope (do NOT pull in)
Same as ② §7/§8: `publicClientFor` + bounded-transport options; `ledger.ts` `markSettlementExpiredNoBroadcast`
CAS + evidence shape; `env.ts`; `EIP3009_ABI`/`USDC_ADDRESSES`/`SUPPORTED_CHAINS`/`getBaseRpcUrl`; the
held un-pinned reads (`confirmSettlementTx` reverted-recheck, `interpretReceipt` recheck,
`submitCircleNanoOnChain` pre-submit guard); V-N5 drain/concurrency; the optional ledger evidence
`blockNumber` field. ③ AUDITS these for interactions; it does not EDIT them.

## Verified-SOUND at seal (don't re-derive — attack the INTEGRATION instead)
USDC strict `<` time gate (Circle EIP3009.sol); Base strict timestamp monotonicity (OP-stack spec); viem
end-of-block-N pinned-read snapshot; the cancel lemma (`_cancelAuthorization` moves no money); the
cross-replica correct-or-`unknown` closure; viem throws `AbiDecodingZeroDataError` on `0x` (empty ≠
`false`); all 7 tests non-vacuous (11-RED live); frozen surfaces byte-clean; only two callers, both
updated. Gate: tsc 0 · eslint 0 · vitest 4440/191/0 · next build success.

## Evidence pointers
- Seal: `docs/tech-debt/v-n4-nonce-read-block-pinning-seal-2026-06-13.md` + `.audit/v-n4-seal/{SEAL-STATUS.md,
  built.diff, gate.log, fingerprint.txt}`.
- Plan/spec: `docs/tech-debt/v-n4-nonce-read-block-pinning-handoff-2026-06-13.md` (§5/§6/§9).
- Deploy precondition: `docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md` GO-LIVE item 5.
- Ledger: `.audit/defect-ledger/` DC-04/DC-08/DC-18/DC-05/DC-15 (V-N4 faces).

## ③ kickoff
Run the HIGH-STAKES post-seal deep-audit cadence: independent fresh-context lenses on the INTEGRATED
whole (money-invariant across the full reconciler + deploy posture; the detector-sensitivity question;
the RPC-provider safety question), adversarial verify, integrate in-session, reproduce sustained
findings live. Policy: opus (claude-opus-4-8) all reasoning; xhigh seal-grade lenses; the integrated
money-invariant lens most rewards /effort max in its own pass. Workflow: a prime candidate (the operator
can opt in with "ultracode" / "run as a workflow"); else Agent-tool spawns. Decide whether any residual
escalates to a fix-warranting finding; if all hold as accepted, ③ RE-CERTIFIES the seal.

## ⚠ "Committed tree" adaptation (READ FIRST — this project is founder-gated)
The verbatim prompt below says *"Scope is the INTEGRATED WHOLE on the committed tree."* V-N4 is
**founder-gated and NOT committed** — the cadence defers the founder-close (path-scoped LOCAL commit,
never pushed) until AFTER ③. So for THIS chunk the "committed tree" == the **working tree**: HEAD
`b3b1e175` + the uncommitted sealed V-N4 bytes + the disjoint uncommitted (W) hygiene tree. Audit that
integrated working-tree state. Do NOT wait for a commit (it won't happen pre-③); do NOT
commit/push/deploy/set-env yourself (DB read-only).

**Before auditing, re-verify the sealed bytes are present and unchanged** (~15 live `claude` sessions
share this tree; a sibling could sweep the uncommitted bytes). Sealed-bytes fingerprint
(`.audit/v-n4-seal/fingerprint.txt`):
```
3216deac01e887f03cdd5583e50c086c9899939d  apps/web/src/lib/settlement/circle-nano/settle-engine.ts
5356b2a945b42cf900dd70e774449e1a1ab95195  apps/web/src/lib/settlement/reconcile.ts
da95d57d0a59279a4f3944f23c747b55a5aa5f1a  apps/web/src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts
c27ffbbe25e0f974b32af967ac08ec8407c06535  apps/web/src/lib/settlement/__tests__/reconcile.test.ts
4c2ba1f0ecd3676ec4cbf3329748dddddcbf2784  docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md
```
Verify: `cd /Users/lex/settlegrid && shasum <the 5 files above>` and diff against this block. If they
drift, HALT and surface it before auditing.

## Mechanical entry points
- Re-run the gate clean (from `cd /Users/lex/settlegrid/apps/web`): `npx tsc --noEmit` · `npx vitest run`
  · `npx eslint src/lib/settlement/circle-nano/settle-engine.ts src/lib/settlement/reconcile.ts
  src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts src/lib/settlement/__tests__/reconcile.test.ts`
  · `npx next build`. Expected: `tsc 0 · vitest 4440/191/0 · eslint 0 · next build success`.
- Isolated V-N4 diff: `cd /Users/lex/settlegrid && git --no-pager diff -- <the 5 files above>`.
- Live code: `settle-engine.ts` readers ~:353-430 + `reconcilerPublicClientFor` :117-131; `reconcile.ts`
  `runExpiryPass` :493-669 (gate :582, threading :598, evidence :630, log :639, stall detector :651-662).

## VERBATIM ③ POST-SEAL DEEP AUDIT PROMPT (run this)

> This chunk is sealed. It reaches this phase only if the seal-gating review flagged it HIGH-STAKES — confirm that in one line; if it's incremental, stop and say this phase isn't warranted. If it runs, certify the SHIPPED result at the highest confidence merited — air-tight, to-spec, technically and factually accurate — without over-auditing or hallucinating regressive fixes. Scope is the INTEGRATED WHOLE on the committed tree, distinct from the seal-gating review's diff scope; do not just re-run those lenses.
>
> Target what a diff-scoped review structurally COULD NOT: latent defects in the integrated whole, cross-chunk integration seams, and recurrences of every class in the project's defect-class ledger. Run a mechanical pre-flight first — the full verification gate in a clean run, a re-derivation of every claimed invariant, a hostile-input battery over every public boundary, all scripted — and hand its results to the reviewers so none re-derive checkable facts. Reviewers try to break the shipped code and report in coverage mode: every finding, tagged with confidence and severity, no self-filtering — the live-reproduction step and the critic pass are the filters. Then run a final collective-miss pass: what did the reviewers, taken together, fail to look at? Any proposed fix is reproduced live (failing against the shipped code, then passing) before it lands, and must not pull in deferred work or perturb a frozen surface the handoff didn't authorize. Charge each reviewer with a precise, self-contained brief — its lens only, never the cadence (Opus 4.8 is literal; spell out the scope). If a structured result is lost to a tool or transport failure, integrate the completed parts by hand and re-run every load-bearing claim live.
>
> [Model, effort & orchestration policy — operational; resolve BEFORE the phase, in one pass:
> • One model for all reasoning: every reasoning role here runs on Opus 4.8 (`claude-opus-4-8`). Do NOT down-tier (flat Opus pricing; Sonnet is a recall cut). The cost/depth dial is EFFORT.
> • Effort: every reasoning role → `xhigh`. The collective-miss critic most rewards `max`; because it is the final pass (it runs after the other reviewers), raise the session to `/effort max` for just that pass — remembering `max` is whole-session and runtime-only (not per-subagent, not persistable). Never below `high`. Above policy = cost note; a role below `high` is forbidden in this phase.
> • Per-subagent MODEL is settable at spawn — SET it explicitly, never silently inherit. Per-subagent EFFORT is not settable; effort is session-level/operator-only. If the session running this phase is below `xhigh`, queue that switch before starting; resume on confirmation. Queuing an operator-only effort switch is a PERMITTED pause under the autonomy rule below — it's a genuine operator-only decision; resolve it once, up front, then run to 100%. Never proceed at below-policy effort just to avoid pausing.
> • Orchestration: this deep-audit fan-out (parallel lenses → break-the-shipped-code → collective-miss critic) is a prime workflow candidate. If the operator has opted into a workflow this turn (the `ultracode` keyword, or "run this as a workflow"), run the fan-out + verification as one deterministic workflow, pinning each agent's model to `claude-opus-4-8`. The fix-fold and the final verdict stay in THIS session. The collective-miss critic's `max` pass stays a separate `/effort max` run (per-agent effort isn't settable inside a workflow). If the operator hasn't opted in, flag it on the Workflow status line and proceed via Agent-tool spawns; don't block.
> • Refusals: rare on Opus 4.8 for legitimate review. A refused reviewer comes back as a declining or empty final result (HTTP 200 stop_reason "refusal"). Re-spawn that lens once with the legitimate-review context foregrounded; if it persists, run the lens yourself or record the coverage gap on the Policy line. Never instruct a reviewer to echo its chain of thought (reasoning_extraction).
> • Cheaper models only for capability-insensitive mechanical fan-out, sized to the subagent's prompt.
> • Mechanics: scripts for the checks. For the fan-out: the workflow (above) if opted in, else Agent-tool spawns — one reviewer first to warm the shared-prefix cache, then batch-spawn the rest (a workflow's runtime manages this concurrency for you). Keep working while reviewers run, and intervene if one goes off track or is missing context it needs. Record the outcome on the Policy/Workflow lines.]
>
> You are operating autonomously through this phase. Execute to 100%: do not end the turn on a plan, a question, or a statement of intent — if your last paragraph promises work, do that work now. (Opus 4.8 is more deliberate and asks more often than prior models; in this autonomous phase, proceed on reversible actions that follow from the charge and reserve questions for genuine operator-only decisions — the one sanctioned pause is queuing an effort switch the operator must make, resolved up front.) Close every sustained finding fix-first under a risk-proportionate re-review; update the defect-class ledger with any new class; render a clear verdict — stands as-is, or hardened-and-re-certified — with the evidence. Close with:
>
> ━━ CADENCE STATUS ━━
> Done:  ③ post-seal deep audit → [SEAL STANDS | RE-CERTIFIED]
> Policy: [applied | ⚠ awaiting operator switch: <model/effort + role>]
> Workflow: [ran as workflow | proceeded via Agent-tool spawns | ▸ candidate — opt in to run the fan-out as a workflow]
> ▶ NEXT: paste ① for the next chunk.
