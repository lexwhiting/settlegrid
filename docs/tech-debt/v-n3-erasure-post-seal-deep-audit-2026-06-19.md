# V-N3-erasure — ③ POST-SEAL DEEP AUDIT — VERDICT (2026-06-19)

> Subject: the SEALED, DARK (`LEDGER_PAYER_ANONYMIZE_ENABLED` default off) payer-PII
> MINIMIZATION build on the committed-equivalent working tree — `anonymize-payer.ts`
> transform/predicate/runner + the cron + admin-backfill routes + `env.ts` getters +
> `compliance.ts` disclosure. Distinct from the ② seal's diff scope: this certifies the
> INTEGRATED WHOLE. Doc of record for intent/scope: `v-n3-erasure-handoff-2026-06-18.md`
> (binding fixes §6.5 F1–F12); ② verdict: `v-n3-erasure-seal-review-2026-06-19.md`.

## Verdict: SEAL STANDS on the shipped DARK code + live disclosure — ENABLE is now BLOCKED on a DC-16 completeness gate
The shipped dark code is air-tight and to-spec: no money/data defect, the de-identification
invariant holds, the re-sign/nonce fail-closed chain is re-derived for BOTH rails, the F-A
keyset fix is verified against live PostgreSQL 16, hostile-input/auth/dark-gate/frozen-surfaces
are clean. The LIVE (flag-OFF) runtime disclosure is honest. **No code defect → the code seal
stands byte-identical (no change folded).** The ③ DID surface one material, previously-unrecorded
**DC-16 census-completeness gap** (the raw payer address also persists in `invocations.metadata` +
in settlement logs/Sentry) that does NOT affect the dark artifact's correctness but **hardens the
counsel-gated ENABLE-runbook into a DC-16 honesty blocker** and corrects the handoff §4 census.
Tier re-confirmed HIGH-STAKES (irreversible money-rail idempotency-key mutation + two public route
boundaries).

## Mechanical pre-flight (clean run, this session)
- Gate GREEN, isolated: `npx tsc --noEmit` exit 0 · `npm run lint` 0 err (8 pre-existing warns,
  none in V-N3 scope) · `npx vitest run` **202 files / 4631 tests / 0 failed** — byte-matches the
  recorded seal baseline.
- Invariants re-derived from the live tree (handed to the reviewers so none re-derived checkable
  facts): the two op_id builders = `{rail}:{network}:{from.toLowerCase()}:{nonce.toLowerCase()}`
  (`orchestrate.ts:117`/`settle.ts:90`), `invocationId == operationId` for both rails; PK
  `id = sha256("settlement:"+operationId)` (`ledger.ts:396`), unchanged by anonymization;
  `RECONCILABLE_RAILS=['circle-nano','x402']`; `MAX_VALIDBEFORE_WINDOW_SECONDS=3600`; the window
  floor is **86400s (1 day)** — `Math.max(3600+25200, 86400)` clamps UP to ONE_DAY (the ②/handoff
  "28800s/8h" figure is superseded; the real floor is stricter, still ≫ the 3600s replay cap).
- Orchestration: 5 fresh-context lens-distinct Opus-4.8 reviewers (model pinned `claude-opus-4-8`,
  inherited session `xhigh`) spawned concurrently → break-the-shipped-code in coverage mode → a
  collective-miss critic (`xhigh`; the optional `max` bump was NOT taken — operator chose the xhigh
  baseline) + the integrator's own source-level ground-truth. Agent-tool spawns (operator opt-in;
  bypassPermissions moots the workflow loud-pause edge; focused diff).

## The ③ FOCUS — re-sign + nonce-reuse-AFTER-anonymize fail-closed chain (BOTH rails), re-derived
The subtlest seam (L1's ②-flagged item), independently re-traced at depth by the core lens AND the
integrator, for x402 (`executeX402Settlement`) and circle-nano (`executeCircleNanoSettlement`):

A buyer re-submits the SAME EIP-3009 authorization (same `from`+`nonce`) after its ledger row was
anonymized. The op_id is rewritten to `{rail}:{network}:anon:{id}`, so the op_id-keyed idempotency
read MISSES. Safety does NOT rest on that read; it rests on **two independent backstops**, either
sufficient alone:
1. **Deterministic-PK collision (the decisive guarantor).** `ensurePendingRow` re-derives
   `id = sha256("settlement:"+ORIGINAL_opid)` — identical to the anonymized row's UNCHANGED PK
   (anonymization rewrites op_id + metadata only, never `id`). The INSERT `onConflictDoNothing`
   collides → NO fresh pending row. Then `refreshPendingValidBefore(ORIGINAL_opid, …)` matches 0
   rows (its WHERE needs `operation_id=ORIGINAL AND status='pending'`; the only PK-matching row now
   carries the anon op_id and a terminal status) → `false` → re-read null → **PREVIOUSLY_FAILED**
   (orchestrate.ts:462 / settle.ts:357). No on-chain submit, no forward, no credit.
2. **Verifier expiry.** The window floor (≥ replay cap + 7h reconciler margin, clamped to 1 day)
   guarantees a re-sign of the SAME authorization is EXPIRED at verify, rejected before any read.

The HOSTILE variant — a re-sign with a FRESH `validBefore` on the same `(from,nonce)` (op_id
excludes `validBefore`, so it equals the ORIGINAL and passes verify) — defeats backstop #2 but is
caught by backstop #1 (PK collision). On-chain nonce is a tertiary backstop (settled→nonce
consumed→revert; failed→nonce free, but #1 returns before any submit). **Conclusion: fail-CLOSED on
both rails; no double-forward, double-credit, re-identification, or orphan row is reachable.** The
in-code safety comment (anonymize-payer.ts:55-61) leads with the verifier-expiry argument and
under-documents that the PK-collision is the load-bearing guarantor of the fresh-`validBefore` case
— code correct, comment incomplete (LOW; a future refactor decoupling the PK from the op_id would
silently reopen the hole; recorded, not changed — the PK derivation is itself stable/frozen).

## F-A keyset µs-fix — second independent trace, verified against live PostgreSQL 16
- `timestamptz::text` is LOSSLESS and ALWAYS emits an explicit UTC offset (`+00`/`-05`/`+05:30`);
  `::timestamptz` re-parses to the EXACT same instant REGARDLESS of session TimeZone (the parser
  reads the embedded offset, not the GUC). Empirically confirmed cross-TZ (Kolkata→Chatham) →
  instant-identical.
- For a ms-precise row the new `::text` anchor compares IDENTICALLY to the old `toISOString()`
  anchor → no pagination regression for today's data.
- The projection is consumed correctly: `rowKeysetCursor` reads `cursorCreatedAt` (the lossless
  text), not the JS-Date `createdAt`. The bug-it-prevents reproduced live (old ms anchor on a µs
  row → self-requalifies = stall; new anchor → advances via the id tiebreaker).
- **NEW angle (cutoff ms-vs-µs):** the SQL pre-filter `lt(createdAt, cutoff)` is µs-precise; the TS
  re-check `row.createdAt < cutoff` is ms-precise. Provably NON-exploitable: `cutoff` is always
  exact-ms (`now - days*86400*1000`), so the dangerous direction (`sql_excludes ∧ ts_includes`)
  requires `floor_ms(row) < cutoff ≤ row` with `cutoff` exact-ms — a contradiction (0 cases in a
  2001-point live sweep). Safe-direction by construction.

## De-identification invariant — confirmed (the brute-force argument holds)
The EIP-3009 nonce is stored in `operation_id` ONLY. `ledger_entries.authorizationSignals` /
`authorizationArtifact` are NULL for x402/circle-nano settlement rows (neither `ensurePendingRow`
populates them; they hold OFAC gate-evidence / external policy tokens — schema.ts:922-933), and no
other column or metadata key holds `from`/`nonce` (codebase-wide grep: 0 other writers). Nothing
FKs `ledger_entries.id`. The nonce is 256-bit (`0x[64hex]`), so removing payer+nonce from op_id
leaves the PK's sha256 preimage brute-force-infeasible → leaving the PK (and re-using it as the
`:anon:{id}` token, already a queryable column) leaks nothing. The minimization de-identifies the
`ledger_entries` row as designed.

## HEADLINE FINDING — DC-16 census-completeness gap (HIGH, → ENABLE blocker; out of dark-merge scope to fix)
The handoff §4 / decision-brief premise — SettleGrid's queryable payer-address surfaces are
**EXACTLY** `ledger_entries.operation_id` + `ledger_entries.metadata.payer`, and "Confirmed CLEAN:
no payer address in any log/Sentry sink" — is **FACTUALLY INCOMPLETE**. Two further surfaces hold
the raw payer (and one the nonce), neither addressed by V-N3 nor named by any doc of record:

1. **`invocations.metadata.payer` + `invocations.metadata.payerIdentifier`** (indexed jsonb,
   schema.ts:335) — written from `proof.authorization.from` for both payer-bearing rails
   (proxy `route.ts:1550` payerIdentifier, `:2168` `payer: proof.authorization.from`). A
   `SELECT metadata->>'payerIdentifier' FROM invocations` returns every x402/circle-nano payer.
   V-N3 touches ONLY `ledger_entries`. Bounded but real: `data-retention` purges invocations only
   if a developer's `logRetentionDays > 0` (`data-retention/route.ts:72-73`, **"0 = keep forever"**),
   keyed to the developer's own tools — not a payer-subject minimization.
2. **Settlement logs → stdout + Sentry.** `reconcile.ts:704-710`
   (`reconcile.expired_nonce_consumed_quarantined`, ERROR level) logs `operationId` (= payer+nonce),
   `from: parsed.eip3009.from` (raw payer), AND `nonce: parsed.eip3009.nonce`; `logger.ts` mirrors
   error-level logs into `Sentry.captureMessage(msg, { extra: meta })`. Plus ~32 op_id-logging sites
   across the settlement subsystem (each emits payer+nonce via the un-anonymized op_id). Sentry
   retention is independent of `LEDGER_PAYER_ANONYMIZE_AFTER_DAYS`. (The DC-18 expiry pager + the
   `reconcile.expiry_pass` summary ARE clean — counts/buckets only.)

**Impact on the SHIPPED artifact:** NONE to correctness. The LIVE (flag-OFF) disclosure
(`retainedUnscrubbedNote`) honestly says the two ledger columns are "retained un-scrubbed … counsel
pending" and makes no completeness claim. **Impact on ENABLE:** the flag-ON disclosure
(compliance.ts:916-921) emits `minimized:[ledger_entries.operation_id, ledger_entries.metadata.payer]`
+ a `minimizedNote` that "SettleGrid minimizes its DIRECT retention of [the payer's raw EVM address]."
Read against the gap, that creates a misleading impression of address-level minimization while ≥2
controllable copies (invocations metadata; error logs/Sentry) persist un-minimized — the exact
DC-16 over-statement class V-N3 exists to avoid. The runtime strings are literally scoped to the two
columns (so the dark artifact does not lie today), but **flipping the flag ON without resolving the
completeness would be a new DC-16 over-statement.** This is a pre-ENABLE blocker, not a footnote.

Why not fixed under this seal: `reconcile.ts` is a FROZEN surface (handoff §8) and the
log-redaction is a separate pre-existing concern; `invocations` minimization is outside V-N3's
Option-B scope; and the disclosure remedy (extend minimization vs. disclose-as-retained) is a
COUNSEL-gated decision (the whole V-N3 lawful basis is counsel-pending). Pulling any of these in
would violate the ③ no-deferred-work / no-frozen-surface rule and presuppose the counsel call.

This also CORRECTS the SLICE-1-③ DC-16 ruling ("exactly two columns holds") — that ruling was
scoped to `ledger_entries` columns (description/external_ref/authorization_artifact) and did not
cover the sibling table (`invocations`) or the observability sinks. The census-miss class recurred.

## Other findings — re-confirmed residuals (none seal-breaking, none requiring a dark-merge fix)
- **Test coverage of the SQL pre-filter (LOW, → enable).** The unit-test db mock discards the
  WHERE, so a zero-selecting regex / a deleted SQL carve-out would pass every test green; the F6
  "byte-unchanged" pin proves the TS gate, not the SQL filter. Safe-direction (under-minimization,
  detectable at enable via the `anonymized` count). A sharpened restatement of the ②-accepted
  "inspection-proven, not integration-proven" residual. Route the regex pin / a real-PG integration
  test to the enable work.
- **Scalar-jsonb metadata → 22023 cron wedge (INFO, corruption-only).** A jsonb-scalar metadata on
  a payer-op_id row would make `metadata - 'payer'` raise SQLSTATE 22023 and abort the run (no
  per-row try/catch), re-throwing every run. UNREACHABLE by current writers (settlement metadata is
  always object-or-NULL). Deliberately NOT "fixed": a loud fail-stop on a corrupt row is the
  defensible default for an unattended irreversible compliance job (a silent skip would be worse).
  Recorded as an operational note.
- **F-B `completed:false` at an exact `maxBatches×batchSize` drain (LOW).** Confirmed benign +
  self-healing (next run finds nothing → `completed:true`); a backlog/alert keyed on
  `completed:false ⇒ residual` gets a false negative only at the 1,000,000-row boundary. Reporting
  precision, not data safety.
- **Frozen surfaces (CLEAN).** `git` confirms only the sanctioned `env.ts` (+2 getters) and
  `compliance.ts` (+disclosure) edits; `x402OperationId`/`circleNanoOperationId`, the live
  write/flip path, `external_ref`, the PK/`settlementEntryId`, `getCronSecret`/`verifyCronAuth`,
  `data-retention`, `reconcile.ts`, `schema.ts` all untouched. `tools/page.tsx` excluded from the
  seal commit (unrelated slug-autofill carry-forward).
- **Compliance data-EXPORT side (CLEAN, flag-independent).** `collectDeveloperData` selects
  `invocations` with an explicit column list that excludes `metadata`; `ledger_entries` is in no
  export category. No export returns the payer address; flipping the flag changes no export output.

## HARDENED ENABLE-RUNBOOK (counsel-gated; NOT part of any build)
Flipping `LEDGER_PAYER_ANONYMIZE_ENABLED` ON is BLOCKED until the DC-16 completeness is resolved.
Before enable, in addition to the ②-recorded steps:
- **(DC-16 BLOCKER — new)** EITHER (a) extend minimization to `invocations.metadata.payer` /
  `.payerIdentifier` for x402/circle-nano AND redact `from`/`nonce`/`operation_id` from the
  settlement logs + Sentry (`reconcile.ts:704-710` and the ~32 op_id-logging sites), OR (b) amend
  the flag-ON disclosure (`minimizedNote` / `retainedUnscrubbedNote`) to HONESTLY disclose those
  surfaces as retained residuals — so the `minimized` claim is not a DC-16 over-statement. Counsel
  reviews the chosen framing. (Recommend a follow-up chunk: "payer-PII minimization — invocations
  metadata + settlement logs/Sentry.")
- **(②-carried)** Move `compliance-deletion-auth.test.ts:792` (`retainedUnscrubbed ∋
  ledger_entries.operation_id`) to `minimized`; add a flag-ON disclosure regression pin (also pin
  the SQL pre-filter regex / add a real-PG integration test — closes the test-coverage residual).
- **(②-carried)** Wire the cron schedule into `vercel.json`; set `LEDGER_PAYER_ANONYMIZE_ENABLED=true`.
- **(②-carried)** Run the backfill route until `completed:true`.

## Defect-class ledger
`.audit/defect-ledger/DC-16-public-claim-content-integrity.md` updated with the V-N3-erasure ③
instance: a minimization/erasure honesty claim certified against an INCOMPLETE surface census
(sibling table `invocations.metadata` + observability sinks logs/Sentry), correcting the
ledger_entries-scoped "exactly two columns holds" ruling. Sharpened detection cue: before certifying
a data-minimization/erasure claim, census the WHOLE codebase for EVERY persistence AND egress of the
subject identifier (other tables, logs, Sentry, webhooks, exports) — not just the named target
columns. No NEW class. SEAM + LITERAL-EXECUTION recurred only as clean/nits.

## Gate (re-run clean, this session)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (8
pre-existing warns) · vitest 202 files / 4631 tests / 0 failed. Seal-subject shasums byte-identical
to the ② seal record (no code change folded).
