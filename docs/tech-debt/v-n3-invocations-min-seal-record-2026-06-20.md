# V-N3-invocations-min — ② SEAL RECORD + ③ post-seal deep-audit kickoff (2026-06-20)

> Companion to the build handoff `v-n3-invocations-min-handoff-2026-06-20.md` (read that first for
> intent/scope/load-bearing decisions). This doc records the ② seal evidence and hands the carried
> residuals to ③. Base = `main` @ `bc7abc3e`. This chunk = the SECOND DC-16 census surface
> (`invocations.metadata` EVM-payer minimization), DARK behind a default-OFF flag.

## 1. Seal verdict — SEALED (clean), high-stakes, NOT escalated
② seal-gating review closed clean. Gate green, zero high-severity findings open in the built code,
reviewers' evidence supports it. Tier re-confirmed HIGH-STAKES against the realized diff (no frozen
surface perturbed; the only prod-reachable change is the flag-gated merged-metadata object, which is
byte-identical to the prior inline literal when the flag is OFF).

## 2. Gate (clean, isolated, this session)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run`
→ tsc **0** · lint **0 errors** (12 pre-existing warns) · vitest **207/207 files pass**, incl. the two
new files: `invocations-payer-min.test.ts` (27) + `invocations-payer-census.test.ts` (10). The build
session left no self-verify digest as a durable artifact → the ② integrator substituted its OWN clean
isolated gate run (the evidence above) per the seal protocol.

## 3. Review fleet (5 fresh-context Agent-tool lenses, all `claude-opus-4-8[1m]`, session xhigh)
correctness/determinism · spec-conformance · core-invariant/PII-census · SEAM · literal-execution.
Outcome: **zero high, zero medium defects in the built code.** Highlights:
- **Core-invariant lens** independently RE-DERIVED the EVM-payer census from live source (all 13 rails,
  both protocol writers + all 6 `db.insert(invocations)` sites). The invariant HOLDS BOTH directions:
  no EVM payer leaks with the flag ON; no non-EVM opaque id is over-minimized. `EVM_PAYER_RAILS` is
  EXACTLY the EVM set vs the 13-rail `PaymentMethod` union. JS minimizer ≡ SQL backfill key-set.
- **SEAM lens** resolved the `?`-operator concern with conclusive static evidence (Drizzle renders bound
  params as native `$N`; postgres.js v3.4.8 has no `?`→`$N` rewrite), confirmed the `jsonb_typeof='object'`
  guard is on BOTH the SELECT and UPDATE, the three-branch `verifyCronAuth` is byte-identical to the
  sibling (DC-08), and the `::text` microsecond keyset cursor mirrors the sibling with no Date-derived
  regression path.
- **Spec lens** confirmed every §3 IN item present, every EXCLUDED item genuinely excluded
  (`vercel.json`, `compliance.ts`, the compliance-honesty test, `anonymize-payer.ts`, the schema all
  byte-untouched), and no §7 gold-plating copied from the ledger sibling.

## 4. Live engine verification (the ② integrator, read-only, against PG 17.6)
The dominant residual flagged by 3 lenses — the backfill SQL had no live-DB execution coverage (handoff
§9 explicitly SANCTIONED the "assert the SQL builds" fallback) — was UPGRADED from hand-traced to
EXECUTED. A fully read-only, constant-expression run (inside a `READ ONLY` transaction, `ROLLBACK`, zero
application data touched, no DDL/DML on real tables) on the real engine proved:
- the parameterized `metadata ? $1::text` operator executes (`t`/`f`);
- the candidate guard selects EXACTLY the EVM payer-bearing rows (x402/circle-nano/drain → candidate;
  ap2/kyapay non-EVM → not; clean/scalar/null/mpp-sentinel → not — the `jsonb_typeof='object'` guard
  empirically prevents the 22023 "cannot delete from scalar" error);
- the `-` chain + rail-gated CASE removes precisely the right keys — incl. the ATTACKER-CASED x402 payer
  (rail-gate is value-shape-independent) and the NUMBER `drainNonce` (removed by name) — preserving all
  retained keys;
- convergence: minimized rows re-test as non-candidate → idempotent re-run scans zero.

## 5. Carried residuals → ③ deep audit (all LOW / latent; none seal-blocking)
1. **Census-guard hardening (DC-05 family).** The static guard's `propertyKeys` extractor misses SHORTHAND
   (`{ payerEoa }`) and COMPUTED/bracket (`{ ["payerAddr"]: v }`) keys, a SPREAD (`{ ...payerBag }`) is
   invisible, and the `EVM_PAYER_SHAPED` classifier has name false-negatives (`evmFrom`, `txOrigin`,
   `beneficiary`, `spender`, …). LATENT: no current source triggers any of these (all extraMetadata are
   explicit `key: value` literals with conventional names); the guard conforms to handoff §5#5 and the
   current census is verified COMPLETE. ③ should weigh hardening the extractor for shorthand + broadening
   the classifier WITHOUT introducing false-positives on retained keys.
2. **`PROTOCOL_SENTINEL_ID` cross-file drift.** The literal is duplicated (module ↔ proxy `route.ts:1538`),
   both match today, but the "kept in sync" comment has no executable guard that fails on drift. A future
   route-sentinel edit would silently scope the backfill to the wrong consumer id while reporting success.
3. **Cosmetic.** Module-comment line-number drift (`route.ts:1552`→`1545`, `:1476`→`1478`, `:1536`→`1538`);
   "byte-for-byte no-op" / "per-shell env var cannot defeat" prose over-claims (semantically true, loosely
   worded); the `completed` field's `true ⇒ drained` half is violated only in the SAFE direction at an
   exact batch-cap boundary (a harmless extra re-run; no `completed:true`-with-rows-remaining path exists).

No NEW SEAM or LITERAL-EXECUTION defect-class recurrence (all SEAM findings were confirmations; the
literal-execution findings were cosmetic/safe). The two load-bearing prose claims (counts-only/payer-never-
in-memory; no-mutation copy-before-delete) are genuinely enforced by executable constructs.

## 6. Frozen / unchanged (re-confirmed at seal)
`recordMppInvocation`, proxy money/control flow, the deletion scrub + retention purge, `anonymize-payer.ts`,
`compliance.ts`, `vercel.json` (both dark routes correctly unwired), the schema — all byte-untouched.

## 7. Sequencing
This chunk ships DARK. With it landed (alongside chunk-1 log-redaction @bc7abc3e), BOTH DC-16 census
surfaces now have a minimization mechanism → the **V-N3-erasure ENABLE-RUNBOOK** (separate counsel-gated
act, handoff §11) becomes unblockable. That runbook MUST: (1) flip BOTH flags; (2) RUN both backfills —
and do a **live backfill dry-run on staging FIRST** (the SQL is now engine-verified on constant expressions
but has never run against a populated `invocations` table) — before amending the disclosure; (3) amend
`compliance.ts` to enumerate the invocations payer paths; (4) add a flag-ON regression pin. Do NOT do any
of these in this chunk.

## 8. ③ deep-audit charge
The post-seal deep audit reviews the INTEGRATED WHOLE (this chunk + how it composes with chunk-1 and the
existing proxy/settlement system), not just the diff. Concentrate on: the §5 residuals above; the
JS-minimizer ↔ SQL-backfill equivalence as a system invariant; the dark-flag posture vs the DC-16 honesty
claim across BOTH surfaces; and whether the enable-runbook coupling (§11) remains correctly and safely
deferred.
