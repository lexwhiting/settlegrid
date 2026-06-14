# V-N1 (+V-N3) — ③ POST-SEAL DEEP AUDIT handoff (2026-06-14)

> For the FRESH ③ session. V-N1 is **② SEALED** (capstone:
> `docs/tech-debt/v-n1-validbefore-cap-seal-2026-06-14.md`). Code is LOCAL committed `3d0f36fa` on `main`,
> NOT pushed, BYTE-IDENTICAL at seal (no fix landed). HIGH-STAKES, real-USDC Base-mainnet prod, local-build
> cadence — **never push without explicit founder say-so.** Founder-close (path-scoped LOCAL commit) happens
> AFTER this ③.

---

## 0. What ③ is (and is not)

The ② seal-gating review hunted the BUILT DIFF in isolation (correctness, spec-conformance, core-invariant)
and found 0 high / 0 med. ③ is the **integrated-whole** deep audit: re-derive the invariants from canonical
ground truth, audit the chunk AS PART OF THE LIVE SYSTEM (the reconciler lifecycle, the settle paths, the
facilitator endpoints, the SDK consumers), and adversarially attack the accepted residuals. ③ may land
test-fidelity / doc hardenings on V-N1's OWN non-frozen surface; it must NOT perturb a frozen surface or
re-open sealed behavior without escalating.

## 1. Coordinates

- Repo `/Users/lex/settlegrid` (npm monorepo; npm not pnpm). Branch `main`. Seal commit `3d0f36fa`.
- Diff: `git show 3d0f36fa` (14 files). Live code at HEAD (`3a05d99d` = the ② handoff note, doc-only).
- Read FIRST: the ② seal capstone (above), the build handoff
  `docs/tech-debt/v-n1-validbefore-cap-handoff-2026-06-14.md` (§4 BigInt-parse, §5 retroactivity, §6 V-N3),
  the register `docs/tech-debt/s-deep-audit-register-2026-06-10.md` (V-N1 ~line 136, now marked SEALED).

## 2. ③ priority targets (the accepted ② residuals — attack these hardest)

1. **F-S1 — x402 non-numeric `validBefore` → `VERIFICATION_RPC_ERROR`.** ② accepted it as a pre-existing
   `verifyUptoPayment` convention. ③ should decide whether the cross-rail inconsistency (x402 RPC_ERROR vs
   circle-nano `CIRCLE_NANO_AUTH_INVALID`) is worth a dedicated structured x402 client-input code, and whether
   the error-level `logger.error('x402.verify_exact_failed', …)` on malformed CLIENT input is an alarm-noise /
   log-spam vector (DC-18) an attacker can drive. Money-safe either way (fail-closed); this is observability.
2. **F-S3 — unbounded `BigInt(validBefore)` CPU cost.** ② measured ~69 ms / 1M digits; pre-existing (the
   `value` field already does this). ③ should confirm the Vercel body-limit bound and decide whether a cheap
   length pre-bound on the uint256 string fields belongs in a hardening chunk (it would also cover `value`,
   `validAfter`, Permit2 `amount`/`deadline`).
3. **F-S4 — `verifyFailureOutcome` is `Record<string>`+default.** ③ may consider tightening to
   `Record<CircleNanoErrorCode, …>` (a compile-time exhaustiveness guard) — but verify it does not pull in
   deferred work or perturb the orchestrator's frozen money path.
4. **F-S2 — SDK CHANGELOG / DC-15.** Confirm the additive union member is recorded wherever the SDK publish
   pipeline reads; decide if an "Unreleased" CHANGELOG entry should be added now vs at the next version bump.
5. **F-S5 — stale `verify.test.ts:103` comment.** A trivial cosmetic sweep candidate (test-only).

## 3. Integrated-whole re-derivation (the moat — re-confirm independently)

- **Cap totality:** re-derive that NO `validBefore` input reaches a ref-NULL `pending`-row writer with an
  over-cap value. ② proved this via (a) a node `BigInt` table, (b) a real circle-nano hostile battery, and
  (c) a writer-reachability trace (every pending-row path — `executeX402Settlement` → `ensurePendingRow`,
  `handleCircleNanoProxy`/kernel `circle-nano/settle` → `executeCircleNanoSettlement`,
  `refreshPendingValidBefore` — is gated by a capped verify that returns first). ③ should re-trace from the
  canonical EIP-3009 contract semantics and confirm no path was missed (e.g. any future/alternate settle
  entrypoint, a replay/cache path, the facilitator settle route).
- **No false-reject:** re-confirm the 3600s magnitude vs the 300s advertised anchor and the 6h `overdueAfterMs`
  alarm; re-confirm the clock-skew direction (cap compares BUYER `validBefore` vs SERVER clock; false-reject
  needs >55 min of buyer-clock LEAD).
- **V-N3 honesty:** re-read `docs/legal/privacy-notice-draft.md` + `compliance.ts` and confirm the V-N3 doc
  records the financial/AML basis as a CANDIDATE (never asserts the exemption covers anonymous payers — that
  would be the DC-16 false-compliance trap). Confirm the §5 prod-count claim (`ledger_entries` empty in prod →
  no existing over-cap population) still holds and the re-check trigger (settlement traffic before the cap
  ships) is recorded.

## 4. Frozen / out-of-scope (reject any ③ fix that perturbs these)

EIP-712 recovery; the credit path (V-N2); the reconciler / `runExpiryPass` (V-N4-sealed); the
`metadata.validBefore` writer / `refreshPendingValidBefore`; `X402_MAX_TIMEOUT_SECONDS=300`; the Permit2
`deadline` upper bound (verify-only follow-up); existing-over-cap-row cleanup + V-N3-erasure (founder-prod-count
gated). The 2 standalone settle routes' generic `PAYMENT_VERIFICATION_FAILED` collapse is PRE-EXISTING (the diff
does not touch them) — do not "fix" it under V-N1.

## 5. ③ orchestration policy (same as ②, escalate if the diff proves riskier)

- Model: `claude-opus-4-8` for every lens + the integrator. Effort: xhigh lenses + integrator; a `/effort max`
  isolated core-invariant pass; high refuters. Per-subagent effort is not settable — queue the operator for the
  switches (or proceed at current effort and flag, as ② did). Workflow = prime candidate if opted in (ultracode
  / "run this as a workflow"); else Agent-tool spawns.
- Mind the shared-worktree hazard: never run a tree-MUTATING reviewer concurrently with a tree-READING one;
  re-verify `git diff 3d0f36fa == empty` for the 5 surfaces after any mutation.

## 6. After ③

If ③ = SEAL STANDS: founder-close (path-scoped LOCAL commit of `3d0f36fa` lineage + the ③ resolution doc;
NEVER push). Update the register V-N1 entry → ③-confirmed, the ledger faces, and memory
(`settlegrid-debt-chunks.md` + MEMORY.md). Then ① for the next chunk (queue: V-N2 credit-amount-mismatch is
the next register HIGH; or the V-N4 DC-18 observability follow-up; or the V-N3-erasure chunk — all founder-gated).
If ③ finds a sustained high/med: state it plainly and route the fix.
