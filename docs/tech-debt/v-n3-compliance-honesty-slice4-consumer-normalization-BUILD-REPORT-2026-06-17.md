# V-N3 compliance-honesty SLICE 4 — consumer-side normalization + financial-linkage erasure — ① BUILD REPORT (2026-06-17)

> Build of `docs/tech-debt/v-n3-compliance-honesty-slice4-consumer-normalization-handoff-2026-06-17.md`
> (the HARDENED plan). Base = `main` @ `075115d7`. LOCAL only — not committed/pushed.
> **Status: gate GREEN, independently verified (gate-runner ≠ verifier ≠ builder). Ready for ② seal-gating review.**

## 1. What was built (handoff §2 A/B/C/D)

Subject: `apps/web/src/lib/settlement/compliance.ts` `processDataDeletion`. All new scrubs are INSIDE the
existing `db.transaction`, gated on `consumerRecord`. Frozen surfaces (handoff §3) untouched.

**(A) Byte-exact-first DETERMINISTIC twin lookup — built at BOTH lookups, IDENTICAL.**
- Pre-txn auth lookup (`consumerForAuth`) and step-2 anonymize lookup (`consumerRecord`) now use the SAME
  predicate + ORDER BY:
  - `WHERE sql\`lower(${consumers.email}) = ${dev.email.toLowerCase().trim()}\``  (normalized match)
  - `ORDER BY sql\`(${consumers.email} = ${dev.email}) DESC, ${consumers.id} ASC\``  (byte-exact twin first, then a
    stable id key → a TOTAL order, deterministic even when no row byte-matches).
- Closes the SLICE-3 ③ sibling: a cross-path mixed-case twin (`ask/capture` + `consumer/academic` store
  `lower()+trim()`; OAuth/newsletter store RAW) was MISSED by the byte-exact `eq()`. The DESC tie-break makes
  the auth-delete and the DB anonymize resolve the SAME row (no split; no left-behind case-variant sibling;
  the real twin's `supabaseUserId` is captured). Does NOT rely on the (unapplied, DC-14) `UNIQUE(supabase_user_id)`.

**(B) Financial/referral linkage scrub** — step-2 `.set()` now also nulls `stripeCustomerId`,
`defaultPaymentMethodId`, `referralCode` (was: email/supabaseUserId/passwordHash only).

**(C) Consumer-keyed completeness (all gated on `consumerRecord`, all idempotent on a failed retry):**
- `tx.delete(apiKeys).where(eq(apiKeys.consumerId, consumerRecord.id))` — the twin's OWN keys (consumer/keys
  inserts with `consumerId=auth.id`); step 3 only deletes toolId-keyed keys, so these would survive + still
  authenticate/bill. Mirror of developer step 1b.
- `tx.delete(consumerSchedules).where(eq(consumerSchedules.consumerId, consumerRecord.id))` — cron jobs whose
  `payload` jsonb is unvalidated free-form; no financial-retention basis (mirror webhook_endpoints step 6).
- `tx.update(conversionEvents).set({ metadata: null }).where(eq(conversionEvents.consumerId, consumerRecord.id))`
  — see ruling below.

**(D) Disclosure + docstring sync (DC-16/DC-11/DC-15):**
- The 3 financial/referral paths + `consumer_schedules` + `conversion_events.metadata` MOVED to `anonymized`
  (consumerRecord-gated, identical to their scrubs). `api_keys` gate broadened to
  `(toolIds.length > 0 || consumerRecord)` — honest under EITHER delete; emitted once (no duplicate; the real
  table name, not a synthetic `consumer_api_keys` path).
- `retainedUnscrubbed` consumer block REMOVED; `retainedUnscrubbedNote` consumer sentence (incl. the false
  "referral_code anchors referral attribution") REMOVED. Ledger + org deferrals untouched.
- Docstring DEFERRED-consumer paragraph rewritten to the now-scrubbed behavior (no false referral rationale).
- Every `resultUrl` entry remains a column PATH (DC-11). Banned-legal-conclusion / comprehensive-scrub classes clean.

## 2. The two load-bearing decisions — built as RESOLVED (handoff §1)

- **#1 `referral_code` = SCRUB.** `consumers.referralCode` anchors NO commission/attribution (developer
  commission keys off `referrals.referralCode` + `invocations.referralCode`, NEVER `consumers.referralCode`;
  already-granted peer credits live in other consumers' `globalBalanceCents` + `referredByConsumerId` id
  back-link). Nulling only blocks a NEW referee redeeming a deleted code (correct). Moved retained→anonymized;
  false docstring/note clause deleted.
- **#2 twin lookup = byte-exact-first DETERMINISTIC** (built as §1 #2; pinned by the SQL-literal test below).

## 3. The two RULED-ON columns (handoff §2 C "scrub-or-disclose") — rulings + evidence

- **`conversion_events.metadata` → SCRUB (null), disclosed in `anonymized`.** Writer
  `api/consumer/conversion-events/route.ts:77,82` sets `consumerId: auth.id` (a uuid FK to `consumers.id`,
  schema:613–615) and `metadata: body.metadata` (free-form `z.record(z.unknown())`). RELIABLY consumer-keyed →
  a `consumers.id`-keyed null is honest. Mirrors `invocations.metadata` (step 4); row analytics retained.
- **`outcome_verifications.dispute_reason` → NO-ACTION (not scrubbed, not disclosed).** Its `consumerId` is a
  **tool-supplied opaque string** — `api/outcomes/route.ts:47` `consumerId: z.string().min(1)` taken verbatim
  from `body.consumerId` (`createOutcomeVerification` writes `params.consumerId`), TEXT column, NO FK, SDK/IP-auth
  endpoint with no consumer auth binding. `disputeReason` is written via `api/outcomes/[id]/dispute` (also
  SDK-keyed). Because the column is NOT provably `consumers.id`, a `consumers.id`-keyed scrub would generally
  **no-op** while a disclosure of it as "anonymized" would be a **false DC-16 claim** — the exact
  "passes-tests-yet-wrong" trap. Ruled out of scope; any erasure needs an external-identifier mapping (not this
  consumers.id-keyed path). Documented in-code at `compliance.ts` step-2d comment.

## 4. Test changes (DC-05 mock-surface + DC-10/DC-05 SQL-literal pins)

- `compliance-deletion-auth.test.ts`: mock schema `apiKeys` gains `consumerId`; added `consumerSchedules` +
  `conversionEvents` stubs; `makeSelectBuilder` now records each SELECT's `.where`/`.orderBy` (+ supports
  `.orderBy`) into a shared `selectCalls`; imports the mocked `apiKeys`/`consumerSchedules` to disambiguate the
  identical `eq(consumerId,id)` deletes by table IDENTITY. The old F-3/4/5 retained-disclosure block (RED on the
  scrub) was REWRITTEN into an 11-test SLICE-4 block: determinism SQL-literal pin (asserts `sql.strings` has
  `lower(`/`=`, NOT `upper(`/`<>`, and the ORDER BY has `DESC`/`=`/`ASC`; both lookups byte-identical; WHERE binds
  the normalized value, ORDER BY binds the RAW value), same-twin-resolved, the `.set()` financial nulls, the two
  consumer deletes, the conversion scrub, the outcome NO-ACTION (absent from disclosure + unscrubbed), gate-holds,
  and disclosure gating (financial/sibling paths in `anonymized` only when a twin exists; `api_keys` on either gate).
- `settlement-moat.test.ts`: `apiKeys` mock gains `consumerId`; added `consumerSchedules`/`conversionEvents`
  stubs + the 3 consumer financial columns; the step-2 tx.select mock chain gained `.orderBy` (required — the
  new lookup calls it). Its no-twin/no-tools delete-count (3) is unchanged (consumer gate never fires there).
- `compliance-honesty-regression.test.ts`: UNCHANGED and still GREEN — its note pins cover only the ledger
  sentence + the org distinct-entity framing (both frozen here); no stale consumer-field comment existed.

## 5. DC-14 observation (pre-existing, repo-wide — NOT introduced here, NOT a blocker)
`consumer_schedules` / `outcome_verifications` / `consumers.supabase_user_id` have NO `CREATE TABLE`/column in the
`drizzle/*.sql` migrations (only `api_keys.consumer_id` + `conversion_events` are migration-backed). The 18
migrations are stale vs `schema.ts` (the repo is `schema.ts`-as-source-of-truth / push-based — the ALREADY-SEALED
SLICE-1/2/3 code references `consumers.supabaseUserId` the same way). `processDataDeletion` is DORMANT (no prod
HTTP caller), so no prod-500 risk today. My new refs are NO MORE divergent than the sealed code. Flagged for ②.

## 6. Executable gate — GREEN, independently verified
Command: `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run`.
- **tsc: exit 0, 0 errors.**
- **lint: exit 0, 0 errors** (warnings only — all in pre-existing untouched files: img/next-image, react-hooks,
  one unused eslint-disable).
- **vitest: exit 0 — Test Files 197/197, Tests 4566/4566, 0 failed/0 skipped** (baseline 4557 + 9 net new
  SLICE-4 tests; the old 2-test F-3/4/5 block was replaced by the 11-test block).
- **Non-vacuity PROVEN (verifier, single-agent, backup-restore):** mutating `lower(`→`upper(` at BOTH consumer
  lookups turns the determinism test RED (`expected 'upper() = ' to match /lower\s*\(/i`); restore is
  byte-identical (`shasum 724e1a2719b01043e50c8c2ac8aa805a1344dd9f` before == after).
- Evidence chain: builder (me) iterated to green; a fresh **gate-runner** subagent independently re-ran →
  GREEN digest above; a separate fresh **verifier** subagent independently re-ran + proved non-vacuity +
  read-audited the disclosure honesty → CONFIRMED. Three distinct agents.

## 7. Diff manifest
- `apps/web/src/lib/settlement/compliance.ts` — +128/−… (imports +2; pre-txn + step-2 deterministic lookups;
  step-2 financial `.set()` + apiKeys/consumerSchedules deletes + conversion metadata scrub; disclosure
  anonymized/retainedUnscrubbed/note; docstring DEFERRED block).
- `apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` — mock-surface + SLICE-4 block rewrite.
- `apps/web/src/lib/__tests__/settlement-moat.test.ts` — mock-surface + tx.select `.orderBy`.
- `git diff --stat`: 3 files, +314/−55.

## 8. Open items for ② (none blocking the build)
- Confirm the conversion-vs-outcome ruling (§3) — the load-bearing "silently-wrong" point: the
  `outcome_verifications.consumerId` opaque-id finding is what makes NO-ACTION the honest call (scrub+disclose
  would be a false claim). 4 fresh-context traces (census + 3 direct route reads) agree.
- DC-14 (§5): repo-wide stale-migration posture — acknowledge, route to the migration-regeneration debt if desired.
- The on-chain payer-address erasure + `organizations.billing_email` remain DEFERRED/disclosed-as-retained
  (frozen here). No banned legal conclusion introduced.
