# V-N1 (+V-N3) — `validBefore` upper-bound cap — ② SEAL CAPSTONE (2026-06-14)

> **VERDICT: ✅ SEALED.** HIGH-STAKES (re-confirmed against the realized diff — it opens the x402
> verifier's parse boundary and the published `@settlegrid/mcp` SDK union; tier NOT lowered).
> Commit under seal: `3d0f36fa` ("V-N1: cap validBefore upper-bound at both verifiers (+ V-N3 gap doc)")
> on `main`, **LOCAL, ahead 1 of `origin/main`, NOT pushed.** Local-build cadence — never push without
> explicit founder say-so. Code BYTE-IDENTICAL at seal (no fix landed; all findings LOW/INFO, accepted/deferred).

---

## 1. What was sealed

A `validBefore` upper-bound cap at BOTH EIP-3009 verifiers: reject
`validBefore > now + MAX_VALIDBEFORE_WINDOW_SECONDS (=3600s, 1h)` with a new buyer-facing 402, rooting the
immortal-`pending`-row + `pending_overdue`/`noTxhashCount` alarm-inflation + indexed-payer-PII cluster for
NEW rows. Inclusive boundary (`== now+MAX` passes, `> now+MAX` rejects). Verify-time only (Q2). V-N3 = a
gap-documenting doc only (no production code). 5 code surfaces; build handoff:
`docs/tech-debt/v-n1-validbefore-cap-handoff-2026-06-14.md`.

## 2. Seal method (② seal-gating review)

- **Tier:** HIGH-STAKES, re-confirmed against the built diff.
- **Gate (clean isolated run, results handed to reviewers):** apps/web `tsc --noEmit` **0**, lint **0 err**,
  vitest **4449 passed / 191 files / 0 fail**; packages/mcp build **ok**, lint **0 err** (6 pre-existing
  warnings), vitest **1898 passed / 1 skip / 52 files**. Overall **RC=0**. Matches the builder's recorded
  floor (4440 → +9).
- **Reviewers:** 3 lens-distinct, fresh-context, hostile reviewers, ALL pinned to `claude-opus-4-8`, coverage
  mode (every finding tagged severity+confidence; no self-filtering). Operator chose "proceed at current
  effort" (per-subagent effort is not settable; model — the primary lever — was pinned). Orchestration =
  Agent-tool spawns (workflow NOT opted in this turn — flagged prime candidate, not blocked).
  1. **Correctness / determinism** (the BigInt-unification risky stretch). VERDICT: clean — 0 defects, 3 info.
  2. **Spec-conformance / contract-wiring** (the 3 new codes across every consumer + the published SDK union).
     VERDICT: 2 low + 1 info, no high/med.
  3. **Core invariant** (cap-totality / data-integrity + no-false-reject). VERDICT: cap total & no false-reject
     confirmed — 1 low (pre-existing) + 1 info.
- **Integrator live reproduction (this session):**
  - **Parse-boundary table** (node, real `BigInt` semantics): 29 hostile inputs → no input is accepted with an
    over-cap value; the historical `parseInt`→NaN fail-OPEN bypass is closed (non-numeric → throw → fail-closed).
  - **Real-verifier hostile battery** (ephemeral vitest against the live circle-nano verifier, 27 inputs, then
    deleted): every accepted input resolves to the in-window value 4600 (inclusive boundary);
    `4601`/`9999999999`/`4070908800` → `CIRCLE_NANO_VALIDBEFORE_TOO_FAR`; all non-numeric → fail-closed
    `CIRCLE_NANO_AUTH_INVALID`. Load-bearing assertions PASSED (1/1).
  - **Non-vacuity (independent re-prove):** reverted ONLY the 2 verifier source files to pre-cap (`3d0f36fa~1`,
    working-tree only, index untouched) → **exactly 5 tests RED** (the 4 cap-reject guards + the strict-parse
    guard); ACCEPT/EXPIRED-ordering correctly stayed green; restored **byte-identical** to `3d0f36fa`.
  - **Consumer wiring:** all 6 consumers of the new code verified (circle-nano-proxy passthrough; facilitator +
    internal x402 verify 200-envelope; orchestrator remap → `X402_VALIDBEFORE_TOO_FAR`/402; the 2 standalone
    settle routes collapse to the pre-existing generic `PAYMENT_VERIFICATION_FAILED` — confirmed the diff does
    not touch those files, so it is NOT a V-N1 regression).
  - **Final tree state:** the 5 code surfaces are byte-identical to `3d0f36fa`; working tree clean except an
    unrelated sibling-session edit to `apps/web/src/app/api/cron/ecosystem-metrics/route.ts` (NOT part of V-N1,
    left untouched — see §5).

## 3. Seal criteria

- Gate green ✓ · Zero high-severity findings open ✓ (zero high AND zero medium) · Reviewers' evidence supports
  it ✓ (3 lenses + live reproduction converge: cap total, no false-reject, no bypass, non-vacuous, all
  consumers wired). → **SEALED.**

## 4. Findings ledger (all LOW/INFO — accepted or deferred; NO fix landed)

| # | Sev | Conf | Finding | Disposition |
|---|-----|------|---------|-------------|
| F-S1 | LOW | high | x402 non-numeric `validBefore` → `VERIFICATION_RPC_ERROR` (function-wide catch), whereas circle-nano returns the structured `CIRCLE_NANO_AUTH_INVALID`. Cross-rail classification inconsistency; both fail-closed/funds-safe. | ACCEPTED. Pre-existing `verifyUptoPayment` convention (the diff comment cites it); the closure of the NaN bypass is the win. The `RPC_ERROR` label for a malformed CLIENT input is an ops-triage nit, not a safety hole. Anticipated by handoff §4. → observability / cross-rail-consistency follow-up (DC-18-adjacent), NOT hotfixed under the seal. |
| F-S2 | LOW | high | The additive published-SDK union member `CIRCLE_NANO_VALIDBEFORE_TOO_FAR` is not in `packages/mcp/CHANGELOG.md` (latest entry 0.3.0); no version bump. | ACCEPTED/deferred. Genuinely additive/non-breaking; recorded in the register + handoff now (satisfies DC-15 "note it"). The SDK is not re-published this chunk → add the CHANGELOG entry at the next SDK publish/version bump. |
| F-S3 | LOW | high | `BigInt(authorization.validBefore)` has no length pre-bound → a ~1M-digit `validBefore` costs ~69 ms CPU. | ACCEPTED. PRE-EXISTING (the `value` field already used `BigInt`); not a V-N1 regression; bounded by the Vercel body limit (~4.5 MB → ~300 ms single-request worst case). Hardening note. |
| F-S4 | INFO | high | `verifyFailureOutcome` (orchestrate.ts) is `Record<string, …>` + a runtime default, not a type-exhaustive `Record<CircleNanoErrorCode, …>`. | NOTED. All 7 codes the orchestrator's verifier can emit are explicitly mapped today (verified by enumeration); a FUTURE new CircleNanoErrorCode would silently degrade to `X402_SETTLEMENT_FAILED`. Future structural hardening idea. |
| F-S5 | INFO | high | Stale comment `circle-nano/__tests__/verify.test.ts:103` still says `validBefore=2e9`, but `DEFAULT_AUTH.validBefore` is now `'1300'` (changed by this diff's fixture migration). | NOTED (cosmetic, test-only, non-load-bearing). Candidate sweep at the founder-close / ③. |
| F-S6 | INFO | high | Weak count-pin (`toHaveLength(11)` pins count, not exhaustiveness) + latent real-clock drift tolerance in `x402.test.ts:~416-428`. | NOTED. Pre-existing test-design patterns, unchanged by V-N1 (the bigint conversion yields byte-identical reason-string digits). |

**No high or medium finding was surfaced by any lens or by the integrator.** Both correctness sub-claim (a)
(the `bigint - number` TypeError-swallow trap) and the cap-totality bypass were specifically hunted and REFUTED.

## 5. ⚠ Tree note (shared-worktree hazard)

At seal time the working tree carried ONE unrelated modification —
`apps/web/src/app/api/cron/ecosystem-metrics/route.ts` (an email-summary label edit, NOT part of V-N1) — from a
concurrent sibling Claude session. It was left untouched and is OUTSIDE the seal scope. Reviewer A and the
integrator both temporarily mutated the verifier source files (inclusivity flip / pre-cap revert) and restored
byte-identical; the 5 code surfaces were re-verified `git diff 3d0f36fa == empty` AFTER all concurrent activity.
See [[feedback-shared-worktree-hazard]]: the founder-close commit must be path-scoped and taken from a state
whose shasums match `3d0f36fa` for the 5 surfaces.

## 6. Defect classes charged

DC-09 (immortal/unconfirmable rows — root-fixed for NEW rows) · DC-18 (alarm-inflation root cause) · DC-16
(V-N3 false-compliance-claim AVOIDED — documents the gap, never asserts exemption) · DC-12 (cap totality: the
strict-BigInt parse closes the parseInt-NaN fail-open) · DC-07 (ONE `MAX_VALIDBEFORE_WINDOW_SECONDS` literal,
5 surfaces consistent) · DC-05 (4 fixtures migrated, non-vacuity proven) · DC-15 (SDK/register doc note; F-S2
residual).

## 7. After the seal

- **NEXT = ③ post-seal deep audit** (HIGH-STAKES) — handoff:
  `docs/tech-debt/v-n1-post-seal-deep-audit-handoff-2026-06-14.md`.
- **Founder-close** (path-scoped LOCAL commit; NEVER push) happens AFTER ③.
- **Carried follow-ups (do NOT fold into the seal):** F-S1 (x402 error-class / cross-rail observability) ·
  F-S2 (SDK CHANGELOG at next publish) · F-S3 (BigInt length pre-bound, pre-existing) · the standalone-settle
  code-collapse (pre-existing) · the Permit2 `deadline` verify-consistency residual · V-N3-erasure chunk +
  existing-over-cap-row cleanup (both founder-prod-count-gated; prod census = 0 / `ledger_entries` empty per
  handoff §5, so MOOT unless settlement traffic precedes the cap shipping).
