# V-N3-erasure — ② SEAL-GATING REVIEW — VERDICT (2026-06-19)

> Subject: the BUILT data-minimization path (DARK by default) — `anonymize-payer.ts`
> transform/predicate/runner + the cron + admin-backfill routes + `env.ts` getters +
> `compliance.ts` disclosure. Doc of record for intent/scope: `v-n3-erasure-handoff-2026-06-18.md`
> (binding fixes §6.5 F1–F12). This review DECIDES the seal; scope = built code only.

## Verdict: CLEAN — ready for operator `/seal-go`
Gate green, **zero high-severity and zero open medium-severity findings**, six fresh-context
lenses converge, the one sustained MEDIUM (F-A) was fixed + live-reproduced (RED→GREEN) + pinned.
The actual seal is the operator manual gate `/seal-go` (Claude cannot self-seal). High-stakes ⇒
③ post-seal deep audit follows.

## Tier — HIGH-STAKES (re-confirmed against the realized diff)
The realized diff lands an **irreversible** mutation of the money-rail idempotency key
(`operation_id`) and opens **two new public route boundaries** (cron GET + admin backfill POST).
No frozen surface (handoff §8) was modified — `git` shows only `env.ts` (+29, two getters,
sanctioned §7) and `compliance.ts` (+disclosure, sanctioned §3(e)/F4); `x402OperationId` /
`circleNanoOperationId` / `ledger.ts` / `cron-auth.ts` / `reconcile.ts` / `schema.ts` /
`data-retention` all untouched. Not escalated beyond high-stakes (matches plan prediction).

## Gate (re-run clean + isolated, this session, AFTER the F-A fix)
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors (8 pre-existing warns, none in V-N3 scope).
- `npx vitest run` → **202 files / 4631 tests / 0 failed.** Accounting: 4597 pre-build baseline
  → +32 V-N3 build pins (4629) → +2 ②-review pins (F-A losslessness + F-A projection guard) = 4631.
- Seal-subject digests (sha256, post-fix):
  - `anonymize-payer.ts` = `e027f990a326fbb1751cdc96aecdf8e63cd8b3cbdc6a98b094cc3f2ea2310ed0`
  - `cron/payer-anonymize/route.ts` = `496ba927383cdf10a5fe475966bb563beab33d5f855a1223de4def7c7b91797a`
  - `admin/payer-anonymize-backfill/route.ts` = `e0d377859a194db2c395c8f95e00c51b61123810ad23b343c0e1a6b13ed12a37`

## Orchestration / policy
- Mode bypassPermissions; session model `claude-opus-4-8[1m]`, session effort `xhigh`; env traps
  (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL) all UNSET. Allowlist GREEN (git/tsc/vitest/lint/npm).
- **Operator opt-in (one up-front pause): Agent-tool spawns at xhigh** (recommended default — focused
  diff; bypassPermissions moots the workflow loud-pause edge; Path-1 effort-bearing definitions absent
  so a mixed-effort/`max` lens can't run in a workflow anyway). Core-invariant lens ran at xhigh now;
  **`max`-depth reserved for ③** (operator-chosen). 5 baseline lenses spawned concurrently (model pinned
  `claude-opus-4-8`, inherit session xhigh); collective-miss critic after, against the assembled findings.
  Integrator/verdict in the main session.
- All 6 reviewers self-reported `claude-opus-4-8[1m]` (effort self-report unreliable per policy;
  ground-truth = inherited session xhigh).

## Six-lens fan-out — findings
- **L1 core-invariant (money/data):** NO money/data defect. Every `operation_id` reader cleared
  (pending-only, replay-window-EXPIRED-before-read, or `settled∧credited_at NULL` carve-out-protected,
  incl. the proxy credit-marker). De-identification holds (nonce only in op_id; nothing FKs the PK).
  Worst case (re-sign + nonce reuse AFTER anonymize) traced to a **fail-CLOSED** terminus for BOTH rails
  (deterministic-PK `onConflictDoNothing` → `refreshPendingValidBefore` miss → `PREVIOUSLY_FAILED`, no
  forward/credit). 2 INFO (fail-safe). Flagged the re-sign/nonce-reuse path for `max` re-derivation at ③.
- **L2 correctness/determinism:** ONE **MEDIUM F-A** (keyset-cursor µs-truncation — see below) + one
  benign LOW (F-B `completed` false-negative at an exact maxBatches-multiple drain; self-healing,
  no fix). SQL-vs-TS authority PROVEN one-directional-safe; cross-run idempotency/monotonicity sound.
- **L3 spec-conformance:** F1–F12 + DC-16 honesty + scope-leak guard ALL SATISFIED, file:line evidence;
  F6 predicate test confirmed NON-vacuous (revert proof). Flagged the unrelated `tools/page.tsx` dirty
  file to exclude from the seal commit.
- **L4 SEAM:** all 8 load-bearing claims CONFIRMED against the live codebase (nonce stored only in op_id;
  nothing FKs `ledger_entries.id`; SQL regex mirrors reconciler regex — verified vs live Postgres `~`,
  no over-match; voided/reversed truly dead; only x402/circle-nano carry payer; V-N1 cap +
  EXPIRED-before-read; 7h margin ≤ 1-day floor ≥ all reconcile windows; partial-index alignment). Zero
  contradictions.
- **L5 literal-execution/hostile-input:** auth fail-closed (matches reference cron exactly), dark gate
  undefeatable by request input, ZERO DB touch while dark, fail-closed on a sub-floor window (500, no
  partial anonymize), no PII in logs, no injection/cast-DoS. No HIGH/MED.
- **L6 collective-miss critic:** NO SEAL-BREAKING MISS. Independently re-confirmed the F-A fix
  (`::text` round-trip is instant-exact regardless of session TZ — explicit offset always emitted).
  Notes (LOW/INFO): compliance flag-ON disclosure pins are unwritten (→ enable-runbook); the runner had
  no end-to-end coverage of the F-A projection (→ FIXED by the added projection-guard pin); env getter
  leniency is caught by the floor assert; "partial-index" framing is a doc nuance (the anonymize SELECT
  uses the plain `created_at` index — batch/budget caps make a large-backlog seq-scan safe across runs).

## F-A — the one MEDIUM, FIXED + reproduced + pinned
- **Defect:** the keyset-pagination cursor anchor was `row.createdAt.toISOString()`. postgres.js parses
  `timestamptz` → JS `Date` (millisecond precision), so the anchor TRUNCATED sub-millisecond microseconds.
  The keyset `(created_at, id) > (anchor::timestamptz, anchor.id)` would then re-qualify a row whose
  stored `created_at` carries microseconds on the `created_at` element alone — the `id` tiebreaker never
  engages → cursor stalls on that bucket (bounded by batch/budget caps) AND silently skips later rows,
  on a money-handling table.
- **LATENT today, real:** every in-scope settlement row gets a millisecond-precise `created_at`
  (`recordSettlementEntry` → `new Date(input.createdAt ?? new Date().toISOString())`); the only
  microsecond `defaultNow()` path is the legacy double-entry `rail IS NULL` rows, excluded by the rail
  filter. So not triggerable by current data — but an unasserted invariant (a future writer omitting
  `createdAt`, or a migration re-stamping it via `now()`, re-arms it). Discharged rather than carried.
- **Fix (in-scope, no frozen-surface touch):** project the anchor losslessly —
  `cursorCreatedAt: sql<string>\`${ledgerEntries.createdAt}::text\`` (a read-only SELECT projection,
  full µs precision) + a pure exported helper `rowKeysetCursor(row) = { createdAt: row.cursorCreatedAt,
  id: row.id }`. For ms-precise rows the new anchor parses to the IDENTICAL instant as the old one → no
  pagination regression; WHERE/ORDER BY unchanged → index usage unchanged; UPDATE/write path untouched.
- **Live reproduction:** RED — the losslessness pin failed against the truncating behavior
  (`'2030-01-01T00:00:00.123Z'` ≠ `'2030-01-01 00:00:00.123456+00'`). GREEN — passes after the fix; tsc 0.
- **Pins added (2):** the µs-losslessness pin on `rowKeysetCursor`, and a non-vacuous projection guard
  (the candidate SELECT must project `cursorCreatedAt`; dropping the projection → RED).
- **Re-review of the fix class (proportionate):** localized, mechanical; full gate green; collective-miss
  critic vetted the `::text` TZ round-trip / undefined-at-runtime / query-plan concerns — all clear.

## Residuals (NONE block the dark seal)
- **LOW (F-B):** `completed:false` at an exact maxBatches-multiple drain — self-healing (re-run finds
  nothing). No fix.
- **INFO:** L1 post-anonymize re-sign returns `PREVIOUSLY_FAILED` (402) instead of `alreadySettled` —
  liveness/UX only, fails strictly safe; degenerate trigger.
- **INFO:** `getLedgerPayerAnonymizeAfterDays` `Number()` leniency (hex/whitespace/Infinity) — all
  non-floor values rejected at resolve time. No money risk.
- **The db mock ignores WHERE** ⇒ the SQL filter / keyset advance / multi-batch drain are
  inspection-proven, not integration-proven. Accepted for a dark-shipped TS-authoritative design.

## For ③ (post-seal deep audit, high-stakes) + the enable-runbook
- **③ `max`-effort focus:** the re-sign/nonce-reuse-AFTER-anonymize chain (its safety rests on the
  *interaction* of deterministic-PK `onConflictDoNothing` + `refreshPendingValidBefore`-miss fail-closed
  + the on-chain nonce backstop — the subtlest seam). Second independent trace at `max`.
- **③ also:** re-derive the F-A fix once more at depth; confirm no integration-test gap matters.
- **Enable-runbook (NOT this dark merge — counsel-gated):** when the flag flips ON, (a)
  `compliance-deletion-auth.test.ts:792` (`retainedUnscrubbed ∋ ledger_entries.operation_id`) goes RED —
  move it to `minimized`; (b) the flag-ON disclosure branch (`minimized`/`minimizedNote`, the flag-ON
  `retainedUnscrubbedNote`) is currently UNPINNED — add a flag-ON regression pin; (c) wire the cron
  schedule into `vercel.json` + set `LEDGER_PAYER_ANONYMIZE_ENABLED=true`; (d) run the backfill route.

## Commit hygiene
The seal commit must stage ONLY the V-N3 files (transform + 2 routes + 3 test files + env.ts +
compliance.ts + these docs). EXCLUDE `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (unrelated
slug-autofill carry-forward, same as DC-03). `.claude/` stays untracked (project convention).
