# V-N1 (+V-N3) — ② SEAL-GATING REVIEW handoff (2026-06-14)

> For the FRESH seal-review session. The chunk is BUILT, gate GREEN, LOCAL committed `3d0f36fa` on `main`
> (NOT pushed). This note carries all context the reviewer needs + the verbatim seal-gate review prompt at
> the end. HIGH-STAKES, real-USDC Base-mainnet prod, local-build cadence — **never push without explicit
> founder say-so.**

---

## 0. One-paragraph what-this-is

V-N1 adds a `validBefore` upper-bound cap at BOTH EIP-3009 verifiers: reject
`validBefore > now + MAX_VALIDBEFORE_WINDOW_SECONDS (=3600s, 1h)` with a new buyer-facing 402, killing the
immortal-`pending`-row + `pending_overdue`/`noTxhashCount` alarm-inflation + indexed-payer-PII cluster at the
root for NEW rows. Q2 = verify-time only (existing over-cap rows are a founder-gated prod-count follow-up).
V-N3 (bundled) = a GAP-documenting doc only (no production code). Inclusive boundary: `> now+MAX` rejects,
`== now+MAX` passes.

## 1. Coordinates

- **Repo:** `/Users/lex/settlegrid` (npm monorepo — `package.json` has `packageManager: npm@10.8.2`; use
  **npm**, NOT pnpm despite "pnpm" in older notes). Workspaces: `apps/web`, `packages/mcp`, `examples/*`.
- **Branch:** `main`. **Commit under review:** `3d0f36fa` ("V-N1: cap validBefore upper-bound at both
  verifiers (+ V-N3 gap doc)"). It is `ahead 1` of `origin/main`, **not pushed**.
- **The diff to review:** `git show 3d0f36fa` (or `git diff 3d0f36fa~1 3d0f36fa`). 14 files, +798/-10.
- **Tier:** HIGH-STAKES (buyer-facing contract = new 402 reject; anti-abuse/correctness boundary; PII/compliance
  boundary). RE-CONFIRM against the realized diff — it touches the x402 verifier's parse path (an input
  boundary) and the published SDK union, so do not silently lower.

## 2. Source-of-truth docs (read first)

- **Build handoff (comprehensive, audit-folded):** `docs/tech-debt/v-n1-validbefore-cap-handoff-2026-06-14.md`
  — §2 cap-value rationale, §3 the 5-surface map, **§4 the DC-12/BigInt-parse robustness section (the riskiest
  stretch — see below)**, §5 retroactivity, §6 V-N3 default-stop, §7 the test-fixture blast-radius, §8 frozen
  surfaces, §11 the pre-build plan audit disposition (5 lenses, 0 BLOCKERs, 18 findings folded).
- **V-N3 gap doc produced this chunk:** `docs/tech-debt/v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md`.
- **Register:** `docs/tech-debt/s-deep-audit-register-2026-06-10.md` (V-N1 = line ~136, V-N3 = ~153).
- **Defect-class ledger:** `.audit/defect-ledger/INDEX.md` — charge **DC-09** (immortal rows), **DC-18**
  (alarm-truthfulness), **DC-16** (V-N3 false-compliance risk), **DC-12** (cap totality / parse hole),
  **DC-07** (single literal, 5-surface), **DC-05** (test-fixture migration), **DC-15** (doc/contract drift).

## 3. Exactly what changed — the 5 code surfaces (review targets)

1. **`apps/web/src/lib/settlement/x402/types.ts`** — defines `export const MAX_VALIDBEFORE_WINDOW_SECONDS = 3600`
   (the ONE literal, DC-07; long rationale comment) + adds `'AUTHORIZATION_VALIDBEFORE_TOO_FAR'` to
   `X402VerifyErrorCode`.
2. **`apps/web/src/lib/settlement/circle-nano/verify.ts`** — imports the constant; cap placed AFTER the
   `CIRCLE_NANO_EXPIRED` check, BEFORE the amount check → `errorCode: 'CIRCLE_NANO_VALIDBEFORE_TOO_FAR'`.
   `nowSec` and `validBefore` were already strict bigints here (line ~134/165).
3. **`packages/mcp/src/adapters/circle-nano.ts`** — adds `'CIRCLE_NANO_VALIDBEFORE_TOO_FAR'` to the published
   `CircleNanoErrorCode` union (additive/non-breaking). **dist was rebuilt** (`npm run build` in packages/mcp)
   so the member is in `packages/mcp/dist/index.d.ts` — apps/web resolves the SDK via dist, not src.
4. **`apps/web/src/lib/settlement/x402/verify.ts`** (`verifyExactPayment`) — **§4, the hard stretch:** the
   time-field parse was unified from `parseInt` onto strict `BigInt`, INCLUDING
   `const now = BigInt(Math.floor(Date.now()/1000))`. The cap is placed AFTER the `AUTHORIZATION_EXPIRED`
   check, BEFORE the on-chain `authorizationState` (nonce) read → `errorCode: 'AUTHORIZATION_VALIDBEFORE_TOO_FAR'`.
5. **`apps/web/src/lib/settlement/x402/orchestrate.ts`** — `verifyFailureOutcome` map gains
   `CIRCLE_NANO_VALIDBEFORE_TOO_FAR: { code: 'X402_VALIDBEFORE_TOO_FAR', httpStatus: 402 }`.

## 4. ⚠ Hunt hardest HERE (the builder's self-identified risky stretch — §4 BigInt unification)

`x402/verify.ts:verifyExactPayment` now parses `now`, `validAfter`, `validBefore` as `BigInt`. The trap the
plan called out (folded finding F1, HIGH): converting `now` to BigInt forces the not-yet-valid/expired message
arithmetic (`validAfter - now`, `now - validBefore`) and `${...}` interpolation to stay **bigint-bigint** —
a `bigint - number` would throw `TypeError`, get swallowed by the function-wide catch, and silently return
`VERIFICATION_RPC_ERROR` (wrong code) while breaking the reason-string asserts at `x402.test.ts` (~lines
416-428). The reviewer should independently confirm: (a) every operand in those two branches is bigint;
(b) the digit output of the reason strings is unchanged; (c) no `parseInt` remains for these two fields.

**Parse-hole / strict-parse semantics to attack:** a non-numeric `validBefore` (`'abc'`, `'1e3'`, `'12.9'`)
makes `BigInt(...)` throw → caught by the function-wide `try/catch` → fail-CLOSED `VERIFICATION_RPC_ERROR`
(`isValid:false`). Hex is tolerated (`BigInt('0x..')` — relied on elsewhere, e.g. `orchestrate.test.ts`
R-V7-hex and the metadata writer). `''`/whitespace → `0n` → EXPIRED reject. Probe whether any input slips
past BOTH the time checks AND the cap (the original `parseInt`→NaN bug). The hostile-input battery should
target this boundary specifically.

**Minor implementation choice the builder made (audit it):** the non-numeric x402 case routes to
`VERIFICATION_RPC_ERROR` via the existing function-wide catch — NOT a new dedicated code — deliberately
matching the established `verifyUptoPayment` convention already codified by `x402.test.ts` (the upto
`amount:'not-a-number'` → `VERIFICATION_RPC_ERROR` test). It logs `x402.verify_exact_failed` at error level on
that path (same as the upto sibling). Decide if that's acceptable or a DC-18 mis-classification worth flagging.

## 5. Test changes (DC-05 blast radius)

- **4 shared far-future fixtures migrated to within-cap** (NOT per-case — the cap is the 6th check, so
  inheriting reject cases would otherwise flip code):
  - `circle-nano/__tests__/verify.test.ts` `DEFAULT_AUTH.validBefore` → `'1300'` (PARAMS.now=1000, cap=4600).
  - `circle-nano/__tests__/verify.fuzz.test.ts` `validSignedProof().validBefore` → `'1300'`.
  - `app/api/circle-nano/__tests__/e2e-smoke.test.ts` shared `validBefore` → `String(Math.floor(Date.now()/1000)+300)`.
  - `lib/__tests__/circle-nano-402-discovery.test.ts` `validBefore` → `1_300n`.
- **New cap tests added:** circle-nano `verify.test.ts` (ACCEPT @ now+3600 inclusive · REJECT @ now+3601 ·
  far-future reject · EXPIRED-still-wins ordering); x402 `lib/__tests__/x402.test.ts` (ACCEPT @ now+3600 ·
  REJECT @ now+3601 with `mockReadContract` NOT called · far-future 2099 reject · non-numeric strict-parse
  reject); `x402/__tests__/orchestrate.test.ts` (the map-entry → `X402_VALIDBEFORE_TOO_FAR`/402, mocked verify).
  The x402 boundary tests pin `Date.now` via `vi.spyOn(Date,'now').mockReturnValue(now*1000)` with
  `spy.mockRestore()` in `finally` (verifyExactPayment has no injectable clock).
- **`X402VerifyErrorCode` enumeration test** bumped 10→11 in `x402.test.ts`.

## 6. Gate (run this FIRST, clean isolated run; hand results to reviewers)

- **packages/mcp:** `cd packages/mcp && npm run build && npm test && npm run lint`
- **apps/web:** `cd apps/web && npx tsc --noEmit && npm run lint && npm test`
- **Builder's recorded results (floor → post):**
  - apps/web: tsc 0 · lint 0 err · vitest **4449 / 191 files / 0 fail** (floor 4440 → **+9** new tests).
  - packages/mcp: build success · lint 0 err (6 pre-existing warnings in kernel.ts etc., not V-N1) · vitest
    **1898 pass / 1 skip** (unchanged).
- **Non-vacuity already proven by the builder:** neutralizing BOTH caps (`if (false && …)`) turned exactly the
  4 core reject cases RED (2 circle-nano + 2 x402); ACCEPT/EXPIRED/strict-parse stayed green; production files
  restored byte-identical. The seal reviewer should re-prove independently (revert-to-HEAD-of-the-2-source-
  files → expect RED → restore), as a hostile-input/non-vacuity script.
- **Independent fresh-context verifier** (run during the build) returned PASS on all 9 spec-conformance items
  with file:line evidence — treat as a SANITY input, NOT a substitute for the hostile seal review.

## 7. Frozen / out-of-scope (reject any fix that perturbs these)

- EIP-712 domain/signature recovery (`USDC_EIP712_DOMAINS`, `TRANSFER_WITH_AUTHORIZATION_TYPES`,
  `checkCanonicalSignature`, `recoverTypedDataAddress`).
- Credit path (V-N2), reconciler / `runExpiryPass` (V-N4-sealed), the `metadata.validBefore` writer /
  `refreshPendingValidBefore`, `X402_MAX_TIMEOUT_SECONDS=300`.
- Retroactive cleanup of EXISTING over-cap rows (founder-gated on a prod count — §5).
- Permit2 `deadline` upper bound (`verifyUptoPayment`) — same pattern but verify-only (no pending row);
  flagged as a deferred verify-consistency follow-up, NOT in V-N1 scope.
- V-N3 = doc only; no erasure/anonymization code this chunk.

## 8. Known residuals / follow-ups (do NOT fold into the seal)

- The 2 standalone settle routes (`x402/settle/route.ts`, `facilitator/v1/settle/route.ts`) collapse every
  verify code into generic `PAYMENT_VERIFICATION_FAILED` — PRE-EXISTING, not a V-N1 regression.
- Permit2 verdict-inconsistency residual (above).
- V-N3-erasure chunk (lawful-basis + `operation_id`-dedup-vs-anonymization tension) + the existing-over-cap-row
  cleanup, both gated on the founder prod-count.

## 9. After the seal

If SEALED: bookkeeping = status block in memory `settlegrid-debt-chunks.md` (already has a V-N1 block to
update to ②-SEALED) + the MEMORY.md index line + the defect-class ledger faces + a seal capstone doc +
the ③ post-seal-deep-audit handoff. Founder-close (local commit, never push) AFTER ③. If BLOCKED: state the
blocking findings plainly.

Memory locations (account1): `/Users/lex/.claude-account1/projects/-Users-lex/memory/MEMORY.md` +
`settlegrid-debt-chunks.md` (the canonical chunk-series file; V-N1 block is at the top).

---

## 10. ▶ VERBATIM SEAL-GATE REVIEW PROMPT (paste into the fresh session)

The chunk is built and its executable gate is green. Before sealing, run an independent, hostile, fresh-context review of the actual diff — the review that DECIDES the seal. Assume a defect exists and work to exhibit it; do not certify by inspection. Scope is the BUILT CODE — not the plan, not the integrated system; do it fully and defer no finding to a later audit. The existence of any later phase must not reduce this one's rigor.

Inherit the chunk's risk tier from the handoff and RE-CONFIRM it against what was actually built; if the realized diff is riskier than the plan predicted (touched a frozen surface, opened an input boundary, etc.), escalate — never silently lower. Size the review to the tier, but never below a floor of lens-distinct, fresh-context reviewers driving the REAL diff and live code: correctness/determinism, spec-conformance, and the core invariant (security, false-positive rate, data integrity — whatever the moat is). Reviewers report in coverage mode: every finding, including ones they are uncertain about or consider low-severity, each tagged with confidence and severity. They must not self-filter for importance — live reproduction downstream is the filter, and a surfaced finding that gets filtered beats a silently dropped defect (Opus 4.8 follows a "be conservative" or "high-severity only" instruction literally and will drop real bugs, depressing recall). Run the project's full verification gate first in a clean, isolated run and hand the results to reviewers so none re-derive checkable facts. Hunt hardest at the new public boundaries under hostile or malformed input — the hostile-input battery itself stays a script. Concentrate extra scrutiny, too, wherever the build flagged a hard or uncertain stretch (e.g. where it recommended a `/effort max` escalation): keep full coverage, but the builder's self-identified risky spots are where silent defects cluster. Charge each reviewer with a precise, self-contained brief — its lens only, never the cadence, scope spelled out (Opus 4.8 is literal; a vague brief will not be generalized).

[Model, effort & orchestration policy — operational; resolve BEFORE the fan-out, in one pass:
• One model for all reasoning: every seal-deciding reviewer, refuter, and the integrator runs on Opus 4.8 (`claude-opus-4-8`). Do NOT down-tier (flat Opus pricing; Sonnet is a recall cut). The cost/depth dial is EFFORT.
• Effort by decisiveness: all seal-deciding reviewers and the integrator → `xhigh`. Single-finding refuters → `high`. Never below `high`. The core-invariant lens on a high-stakes chunk most rewards `max` — but effort is WHOLE-SESSION (not per-subagent) and `max` is runtime-only (not persistable), so honor it by running that lens in its OWN session at `/effort max`, spawned and awaited separately from the `xhigh` seal-deciding fan-out (which runs concurrently and would otherwise inherit `max` too). Because this phase's policy spans `high`/`xhigh`/`max`, it cannot be one session state: sequence the `/effort` switches at their boundaries (xhigh reviewers → the isolated max core-invariant pass → high refuters), front-loading the predictable ones in the upfront pause. Above policy = cost note; a decisive role below `high` is forbidden.
• Per-subagent MODEL is settable at spawn — SET it explicitly, never silently inherit. Per-subagent EFFORT is not settable; effort is session-level/operator-only. If a role needs more than the current setting, pause and queue the operator with the exact switch; resume on confirmation. The integrator runs in your own session: if the session effort is below `xhigh`, queue that switch before integrating.
• Orchestration: this seal-gating fan-out (parallel lenses → adversarial verify → structured findings) is a prime workflow candidate. If the operator has opted into a workflow this turn (the `ultracode` keyword, or "run this as a workflow"), run the fan-out + verification as one deterministic workflow, pinning each agent's model to `claude-opus-4-8`. The INTEGRATOR/SEAL decision stays in THIS session — reproducing findings live and deciding the seal is operator-visible judgment; don't bury it in the workflow. The `max` core-invariant pass also stays a separate `/effort max` run (per-agent effort isn't settable inside a workflow). If the operator hasn't opted in, flag it on the Workflow status line and proceed via Agent-tool spawns; don't block.
• Refusals: rare on Opus 4.8 for legitimate auth/crypto/money review (it lacks Fable 5's classifier layer and is Fable's fallback target). A refused reviewer comes back as a declining or empty final result (HTTP 200 stop_reason "refusal" — not a 5xx, so error monitoring won't catch it). Re-spawn that lens once with the legitimate-review context foregrounded; if it persists, run the lens yourself or record the coverage gap on the Policy line. Never instruct a reviewer to echo its chain of thought (reasoning_extraction).
• Cheaper models only for capability-insensitive mechanical fan-out, sized to the subagent's prompt.
• Mechanics: scripts for the checks. For the fan-out: the workflow (above) if opted in, else Agent-tool spawns — one reviewer first to warm the shared-prefix cache, then batch-spawn the rest (a workflow's runtime manages this concurrency for you). Keep working while reviewers run, and intervene if one goes off track or is missing context it needs. Record the outcome on the Policy/Workflow lines.]

Integrate as the single integrator, triaging by severity and confidence: reproduce every sustained high- and medium-severity finding live — failing against the built code, then passing after the fix — before it lands; batch and spot-reproduce lows. (Live fail-then-pass reproduction is the seal's filter; it is harder to fool than score-thresholding a finding list, and it guards Opus 4.8's reported tendency to report success without running the check.) Each fix re-enters a fresh review of its class (a purely mechanical fix may take a proportionate reduced re-review — record the calibration). Reject any fix that pulls in deferred work, gold-plates, or perturbs a frozen surface the handoff didn't authorize. If a structured result is lost to a tool or transport failure, integrate the completed parts by hand and re-run every load-bearing claim live. Before reporting, audit each claim against a tool result from this session; report only work you can point to evidence for — if something is not yet verified, say so explicitly. Seal only when the gate is green, zero high-severity findings are open, and the reviewers' evidence supports it; then do the bookkeeping (status, log, derived snapshots, the defect-class ledger, the next handoff). If you cannot seal, say so plainly with the blocking findings. Close with:

━━ CADENCE STATUS ━━
Done:  ② seal-gating review → [SEALED | BLOCKED]
Tier:  [high-stakes | incremental]  (escalated? y/n)
Policy: [applied | ⚠ awaiting operator switch: <model/effort + role>]
Workflow: [ran as workflow | proceeded via Agent-tool spawns | ▸ candidate — opt in to run the fan-out as a workflow]
▶ NEXT: [high-stakes] paste ③ the post-seal deep audit · [incremental] ③ not warranted — proceed to ① for the next chunk.
