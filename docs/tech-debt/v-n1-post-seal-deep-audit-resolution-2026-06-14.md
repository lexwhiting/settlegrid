# V-N1 (+V-N3) — ③ POST-SEAL DEEP AUDIT — RESOLUTION (2026-06-14)

> **VERDICT: ✅ RE-CERTIFIED.** The ② seal of the CODE (`3d0f36fa`) STANDS byte-identical — the integrated-whole
> deep audit found NO code defect. One sustained finding (a factual inaccuracy in the chunk's V-N3 doc) was
> HARDENED + independently re-verified. HIGH-STAKES, real-USDC Base-mainnet prod, local-build cadence — **never
> push without explicit founder say-so.** Founder-close (path-scoped LOCAL commit) is the only remaining step.

---

## 0. Scope & method

③ audited the **integrated whole on the committed tree** (HEAD `9fecf673` = the V-N1 lineage `3d0f36fa`→`3a05d99d`
→ seal `494e4072`, with a sibling ecosystem-metrics chunk `9fecf673` on top), distinct from ②'s diff scope.
Target: latent defects in the integrated system, cross-chunk seams, and recurrences of every defect class.

- **Tier:** HIGH-STAKES (re-confirmed). **Effort/model policy applied:** all reasoning roles `claude-opus-4-8`;
  3 lenses + integrator at `/effort xhigh`; the collective-miss critic at `/effort max` (operator-set, the
  pre-agreed second toggle). Orchestration: Agent-tool spawns (workflow NOT opted in — flagged candidate).
- **Mechanical pre-flight (clean isolated run, handed to all reviewers):** full gate GREEN (apps/web tsc 0 /
  lint 0 / vitest **4449/191/0**; packages/mcp build ok / lint 0 / **1898/1 skip**); a cap-coverage census
  (every verifier caller capped, ONE `MAX` literal); a 27-input real-verifier hostile battery (no over-cap
  accept; fail-closed malformed); frozen-surface integrity (diff = 5 code + 5 tests + docs only). Re-run on the
  final re-certified tree: **GREEN, unchanged** (the V-N3 doc edit is markdown — not in the build/test path).

## 1. The four reviewers + integrator (0 high / 0 med across all)

- **Lens A — integration seams & end-to-end public boundaries.** All 7 route boundaries traced (over-cap →
  correct reject, no money/row side-effect); `settleExactPayment` writes no pending row; V-N4 reconciler / B1.1
  gate / sibling-chunk seams clean. Findings: the `refreshPendingValidBefore` **ratchet** (LOW), Permit2
  `deadline` uncapped (LOW, flagged residual), standalone-route code-collapse (INFO, pre-existing).
- **Lens B — defect-class ledger recurrence (DC-01..20).** DC-09 fix complete end-to-end; DC-12 bypass closed
  with proven totality; only 2 recurrences, both already-recorded accepted residuals (F-S1 DC-18, F-S2 DC-15).
- **Lens C — core invariant re-derived from ground truth.** All 4 invariants HOLD (cap totality across every
  pending-row writer; no false-reject — >55 min clock-lead required; 3600 terminalizes ~4.9h before the 6h
  overdue alarm; V-N3 doc honest). Findings: the ratchet (LOW), the pre-existing `compliance.ts` false-scrub
  (LOW), a V-N3 doc line-number drift (INFO).
- **Collective-miss critic (max).** "No material collective miss." Independently RE-VERIFIED every load-bearing
  claim (settleExactPayment no-pending-row; only x402+circle-nano write `metadata.validBefore`; AP2
  settled-not-pending; circle-nano ordering) and CLEARED 8 hunt angles (published-SDK asymmetry by-design;
  dist fresh; time-units all-seconds; validAfter side; idempotency cache; deployment window; **V-N3 doc
  post-edit citations EXACT**; test non-vacuity 151/151).
- **Integrator (this session, max).** Folded the V-N3 doc fix (below); ran the pending-row census (AP2 +
  session/hop path are NOT additional immortal-row vectors — only the 2 capped rails write `metadata.validBefore`);
  confirmed threat-model completeness at the reconciler (a no-`validBefore` or unparseable-`validBefore` pending
  row is QUARANTINED, not skipped-forever — `reconcile.ts:558-566` — so there is no skip-forever sibling vector);
  cleared the published-SDK x402 code question (free-string outcome code, consistent with pre-existing
  `X402_WRONG_RECIPIENT`/`AMOUNT_MISMATCH`).

## 2. The one sustained finding — FIXED (hardened + re-verified)

**[was LOW/MED, DC-15/DC-16] The V-N3 doc mischaracterized `compliance.ts`.** The doc claimed "`compliance.ts`
does not reference [`ledgerEntries`] … an erasure request … would not see these rows at all." FALSE:
`processDataDeletion` lists `'ledger_entries'` under `retained` (`compliance.ts:540`) and its docstring
(`:354-355`) claims financial records' "PII is scrubbed" — yet the deletion transaction (`:426-546`) **never
touches `ledgerEntries`**, leaving the payer's raw EVM address (`operation_id` + `metadata.payer`) UN-scrubbed.

- **Fix (doc-only, no frozen surface, no deferred work pulled in):** corrected the V-N3 doc §2 to state the
  data-EXPORT path is clean but `processDataDeletion` actively names `ledger_entries` as retained with a
  **false "PII is scrubbed" claim** — an *active false-compliance surface*, not a mere absence. This
  **strengthens** the documented gap. Also fixed the §1 line-number `orchestrate.ts:157→159` and updated §5
  item 4 to require the V-N3-erasure chunk to correct the `compliance.ts:354-355` docstring + `retained` claim.
- **Re-verification (the fix's review):** the collective-miss critic independently verified the corrected
  citations (`:354-355`, `:540`, `:426-546`) against live `compliance.ts` and confirmed the "active
  false-compliance surface" characterization is factually exact with no introduced inconsistency. Doc-only →
  proportionate reduced re-review (a markdown change cannot affect the gate; gate re-run GREEN regardless).
- The **underlying `compliance.ts` false-scrub is PRE-EXISTING** (V-N1 does not touch `compliance.ts`); it is
  correctly routed to the V-N3-erasure chunk (§5 item 4), not hotfixed under V-N1.

## 3. Residuals carried (LOW/INFO — none block re-certification)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| R1 | LOW | `refreshPendingValidBefore` **ratchet**: a monotone GREATEST-raise lets sustained within-cap re-signs push a pending row's stored `validBefore` forward across instants. | NOT a cap bypass (each bound is ≤now+3600 at its own verify instant) and **self-defeating**: each re-submit's on-chain `transferWithAuthorization` forces settle-or-fail, the pending-preserving outcomes aren't attacker-controlled, and `pending_overdue` keys on `createdAt` (6h alarm fires regardless). → **V-follow-up:** a `createdAt`-anchored ceiling on the raised bound (touches the frozen (V) refresh — a separate chunk). |
| R2 | LOW | Pre-existing `compliance.ts` "PII is scrubbed" claim is false for `ledger_entries` payer PII. | PRE-EXISTING DC-16; routed to the **V-N3-erasure chunk** (§5 item 4). Not V-N1's to fix. |
| R3 | LOW | Permit2 `deadline` uncapped (`verifyUptoPayment`, `parseInt`). | Verify-only (no pending row — `parse.ts` rejects non-`exact` for settle); flagged verify-consistency follow-up (handoff F8). |
| F-S1 | LOW | x402 non-numeric `validBefore` → ERROR-level `x402.verify_exact_failed` / `VERIFICATION_RPC_ERROR` (vs circle-nano structured `AUTH_INVALID`). | Recorded ② residual; cross-rail observability follow-up (DC-18). Fail-closed, money-safe. |
| F-S2 | LOW | Additive published `CircleNanoErrorCode` union member not in `packages/mcp/CHANGELOG.md`. | Recorded ② residual; add at next SDK publish (DC-15). |
| F-S4 | INFO | `verifyFailureOutcome` is `Record<string>`+default (all 7 emittable codes mapped today). | Future structural hardening. |

## 4. Defect classes (re-confirmed + new evidence)

DC-09 (immortal rows) — fix COMPLETE end-to-end for NEW rows; the buyer-mintable vector is fully scoped to the
2 capped rails (AP2/session rails write no `metadata.validBefore`); no-vb/unparseable rows quarantine; **new
evidence:** the ratchet residual (R1) + its `createdAt`-ceiling follow-up. DC-12 (boundary totality) — closed,
re-proven. DC-16 (false-compliance) — the V-N3 doc stays DC-16-safe (corrected to be *more* accurate); a
pre-existing live DC-16 instance (R2, the `compliance.ts` false scrub-claim) is surfaced + routed. DC-07 / DC-05
/ DC-15 / DC-18 — re-confirmed (see ② seal capstone).

## 5. Verdict & next

- **③ = RE-CERTIFIED.** Sealed CODE stands byte-identical (`git diff 3d0f36fa HEAD` on the 5 surfaces = empty);
  the V-N3 doc was hardened + re-verified. Gate GREEN. Zero high/med open.
- **NEXT = founder-close** (path-scoped LOCAL commit of the V-N3 doc fix + this resolution + register/ledger/
  memory bookkeeping; **NEVER push**). Then ① for the next chunk.
- **Follow-ups routed (do NOT fold into V-N1):** R1 ratchet `createdAt`-ceiling (a (V)-refresh chunk) · the
  V-N3-erasure chunk (incl. the R2 `compliance.ts` false-scrub correction) · F-S1 cross-rail observability ·
  F-S2 SDK CHANGELOG at next publish · Permit2 `deadline` verify-consistency.
