# V-N2 — ③ POST-SEAL DEEP AUDIT — RESOLUTION (2026-06-15)

> Integrated-whole deep audit of the SHIPPED V-N2 result (credit the ACTUAL settled value). HIGH-STAKES
> (re-confirmed). **VERDICT: HARDENED-AND-RE-CERTIFIED** — one in-scope MEDIUM closed fix-first (DC-20
> standing-state legacy-fallback over-credit); the sealed money invariant stands; the headline residual is
> a PRE-EXISTING, out-of-scope HIGH carried to its own chunk. LOCAL atop `3bcf27ac`, NOT pushed; founder-close
> after this. Seal capstone: `v-n2-seal-2026-06-15.md`. ③ handoff this consumed: `v-n2-post-seal-deep-audit-handoff-2026-06-15.md`.

## Scope (distinct from the ② diff scope)
The integrated whole on the shipped tree: V-N2 × the sealed sibling subsystems + the full creditor set + the
new `metadata.settledValueBaseUnits` field's lifecycle + defect-class-ledger recurrence. Tree verified = the
V-N2 sealed state with ZERO foreign drift in the shared worktree; no migration (top `0016`); §13.H holds.

## Mechanical pre-flight (scripted, handed to reviewers)
- Gate (clean): apps/web tsc 0 · lint 0 errors · vitest 4469 passed / 0 failed (193 files); mcp build 0 ·
  1898 passed / 1 skipped · lint 0 errors.
- Invariant re-derivation (all hold): 1 credit site; both prod verifiers `exactAmount:true`; value supplied
  fresh-submit / omitted recovery+reconciler; detect 2 orchestrator sites / 0 reconciler; ledger value-param
  optional (omitted-branch byte-identical); reconciler markSettlementSettled 3-arg (no value); census 4/4.
- Hostile-input battery over the new public boundaries (`settledBaseUnitsToCents` + `detectSettledValueDivergence`):
  **56/56** (floors, rejects >int4, never over-credits; detector loss-only-error, never throws). Ephemeral, removed.

## Panel (Opus 4.8 `claude-opus-4-8` throughout; Agent-tool spawns — workflow NOT opted in, flagged candidate; /effort max)
Three integrated-whole lenses (NOT a re-run of the ② diff lenses) + a final collective-miss critic:
1. **Integration-seams** — V-N2 × expiry pass / sweep+marker / INSERT freeze / cross-surface credit / GDPR-retention /
   validBefore-cap+rotation. 0 high/med; all six seams proven sound.
2. **Defect-class recurrence** — charged DC-01..DC-20. 0 high; the one substantive recurrence = DC-20 (below).
3. **Ground-truth core-invariant** — credited==collected across the full creditor set + lifecycle + process-kill.
   0 new high in the reconciler; re-confirmed the carried #2 HIGH; surfaced the DC-20 standing-state (below).
4. **Collective-miss critic (/effort max)** — pre-mortemed the fix + cleared the unexamined surfaces (below).

## CLOSED FIX-FIRST (this audit)

### DC-20 — swallowed `onBroadcast` write → standing-state legacy-fallback over-credit (MEDIUM → CLOSED)
- **Found by:** defect-class lens (DC-20) + ground-truth lens (F2), independently.
- **Mechanism:** `onBroadcast`'s `markSettlementBroadcast` (which records `settledValueBaseUnits` + `external_ref`
  in one UPDATE) is best-effort — the engine SWALLOWS a throw (`settle-engine.ts:232-238`). On a fresh submit, if
  that write throws (a DB blip at the broadcast instant) and the receipt then times out (`broadcast-unconfirmed`),
  `applyOutcome`'s broadcast-unconfirmed branch re-set `external_ref` WITHOUT the value → row left
  `external_ref`-but-`settledValueBaseUnits`-NULL. The reconciler then reads that absence as "legacy/pre-deploy"
  (`reconcile.ts:212`) and credits the frozen `amountCents` — the exact over/under-credit vector V-N2 closes,
  re-opened as a STANDING post-deploy state (not just the ~1h pre-deploy window §13.G bounds), and under-observed
  (the broadcast-seam detector is skipped because onBroadcast threw; `settled_value_legacy_fallback` is warn, not
  Sentry-paged).
- **Fix (in V-N2 scope — completes the orchestrators' value-threading; no frozen surface, no deferred work):**
  thread `settledValueBaseUnits` into the `broadcast-unconfirmed` `markSettlementBroadcast` call in BOTH
  orchestrators (`x402/orchestrate.ts`, `circle-nano/settle.ts`). `result.txHash` is THIS request's broadcast tx,
  so the value (fresh-submit = its proof value; recovery = `undefined`, leaving the prior tx's recorded value
  intact) is the correct value to pair with it. Now a swallowed onBroadcast is BACKSTOPPED by the applyOutcome
  write — reaching a NULL-value row post-deploy requires a DOUBLE swallow (onBroadcast AND this write both throw),
  far narrower; the legacy-fallback then only fires for genuine pre-deploy rows (benign). The `reverted-nonce-consumed`
  branch is deliberately left value-free (that row never auto-credits, and `result.txHash` reverted/moved nothing).
- **Why safe (critic-validated pre-mortem):** the recorded value is consumed for a credit ONLY in the reconciler's
  `settled` branch under `flipped===true`; a broadcast-unconfirmed tx that later REVERTS lands in the failed /
  pending-nonce-consumed path → never credited; the value↔ref pairing survives re-points (same-UPDATE merge + CAS).
- **Reproduction (live, fail→pass):** updated the broadcast-unconfirmed assertions (both rails) to require the
  value-backstop (5th arg) → **2 RED** against the shipped code → applied the fix → **2 GREEN**. Full gate re-green.
- **Re-review calibration:** mechanical (param-threading into one more branch, symmetric across rails); the
  collective-miss critic had already pre-mortemed and validated this exact direction, so the fix-class re-review =
  the critic's pre-mortem + the live fail→pass + the full gate. Proportionate.

## CARRIED — NOT fixed here (out of V-N2 scope; render for the founder / next chunks)

### [HIGH — own chunk] The recovery-seam credit divergence (#2), now sharpened on three axes
The in-request **recovery-confirm** credit (`forwardAndBill` / kernel `/settle`) credits the CURRENT request's
`costCents` while the PRIOR broadcast tx collected a different value (re-sign-same-nonce-at-new-price →
`x402/orchestrate.ts:432` / `circle-nano/settle.ts:373` return `settled` WITHOUT `alreadySettled` →
`route.ts:1713` credits `costCents`). The ③ confirmed it REACHABLE (buyer-controlled nonce-reuse + value; PATCH
price change unguarded) and added two unexamined facets:
- **detector-blind (critic F-CM1):** `detectSettledValueDivergence` runs only in `onBroadcast` (fresh-submit); the
  recovery branch bypasses it → the one money-incident the detector was built for is invisible on this exact path.
- **sweep-masked (critic F-CM2):** the live creditor writes `credited_at` in the same txn as the wrong-amount
  credit → the (T) uncredited sweep sees the row as resolved and never flags it.
So #2 is a real (latent-under-exactAmount) money error that is BOTH undetected and unswept. Fix belongs to its own
HIGH-STAKES chunk: make the in-request recovery-confirm credit read the now-available `settledValueBaseUnits`
instead of `costCents` (and/or add detect coverage to the recovery seam). Touches the §3-fenced `forwardAndBill`
+ orchestrator recovery-return — NOT authorized in V-N2. **This CORRECTS the register's ③-(T) note** ("exact-amount
closes the amount face in practice" — false for the re-sign-at-new-price path; the note assumed a retry reuses the
SAME authorization). DC-01 + DC-16.

### [LOW — registered] (defensive / observability / pre-existing / founder-judgment / contrived-edge)
- **Zero-floor strands the sweep** (seam lens): a settled value flooring to 0 would route to `credit_skipped_no_data`
  leaving `credited_at` NULL → the sweep pages forever. UNREACHABLE under universal exactAmount (recorded value is
  always a whole-cent multiple ≥10000). Defensive only; register (would be gold-plating to fix an unreachable path).
- **Detector error-pages on a legitimate re-sign-at-lower-price** (ground-truth F3): `settled_value_below_frozen`
  at error/Sentry level on a non-loss (V-N2 credits the lower value correctly). But this is **§13.F-mandated**
  (error on the loss direction, "as a signal") — changing the level would DEVIATE from the founder-ratified spec.
  Founder judgment: keep paging price-change-during-pending, or downgrade to warn. Register (DC-18).
- **Detector `frozenAmountCents` basis mis-source on the Redis-down/unlocked path** (seal carry + critic F-CM5):
  a missed-loss-page possible (no false-page, no money impact — the credit uses the recorded value, not this basis).
  Observability only. Register (DC-18).
- **Metadata 16KB byte-cap bypassed by the jsonb-merge UPDATE writers** (critic F-CM4): enforced at INSERT only;
  the merge writers (settledValueBaseUnits ×2, plus the pre-existing expiry/validBefore merges) append uncapped.
  `settledValueBaseUnits` is ~50 bytes → no live overflow. Pre-existing class. Register.
- **The new key has no GDPR erasure/retention path** (handoff #5 + critic F-CM3): `ledger_entries` is retained by
  design (7-yr financial); the new key inherits that. Likely correct-by-design; route the explicit disposition to
  the V-N3-erasure chunk. Register (DC-16-adjacent).
- **`verifier-exactamount-census` regex would false-pass on a comment containing the literal** (critic F-CM6): the
  load-bearing exactAmount guard has a comment-injection edge; no live offender (both real call-site comments are
  prose). Latent test fragility. Register.
- **`credit_marker_unmatched` manual-double-credit trap** (ground-truth F4): an operator acting on a false
  `uncredited_settled` alert could manually double-credit. PRE-EXISTING (T)-era; no automatic double-credit. Register.
- **Test-coverage gap: no EXECUTING test drives `settledValueBaseUnits` through the real jsonb-merge** (seam lens):
  terminal-transition exercises only the value-omitted branch; the F5 key-sync source-scan guards a rename but not
  a switch-to-bare-SET. Register (DC-05; candidate for the V-N6 terminal-transition sql-node evaluator).

## Collective-miss critic — coverage-complete clearances (axes verified, no gap)
Byte-identical-when-omitted (vs `git diff HEAD`) · cross-rail x402/circle-nano mirror-identical · test diffs
non-vacuous (no weakened/vacuous assertions; `filter(v===30) && filter(v===50)===0` distinguishes the basis) ·
floor/overflow math correct · **NO leak of `settledValueBaseUnits`** into any reporting cron / analytics / CSV /
export / hub / `verifyLedgerIntegrity` / GDPR-export (confined to ledger.ts writers + reconcile.ts reader) · SDK /
published surface has zero knowledge of the key · the DC-20 fix pre-mortem (reverted-tx never credits) · the
`expiredTerminalized` × `settledValueBaseUnits` mutual exclusion · the detector reads no DB row.

## Gate (post-fix, clean)
apps/web tsc 0 · lint 0 errors · vitest **4469 passed / 0 failed** (193 files); packages/mcp (untouched) build 0 ·
**1898 passed / 1 skipped** · lint 0 errors.

## Defect-ledger
No new class warranted (all findings fit existing classes). Faces updated: **DC-20** (the swallowed-onBroadcast
standing-state — CLOSED by the broadcast-unconfirmed value-backstop) · **DC-01** (the carried #2 recovery-seam
cluster — sharpened: detector-blind + sweep-masked) · DC-18 (detector level/basis residuals) · DC-16 (the ③-(T)
register-note correction) · DC-05 (the executing-jsonb-merge coverage gap).

## NEXT
Founder-close (path-scoped LOCAL commit of the V-N2 surfaces + the ③ resolution; NEVER push). Then ① the carried
**#2 recovery-seam credit chunk** (HIGH-STAKES — the prime next pick: make the in-request recovery-confirm credit
read the recorded settled value; add detect + sweep coverage to the recovery seam). ⚠ SEPARATE & URGENT (not part
of V-N2): the exposed-Postgres-credential incident — see `SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md`.
