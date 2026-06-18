# V-N3 compliance-honesty SLICE 5 — all-rows consumer-twin erasure — ① BUILD HANDOFF (2026-06-18)

> Standalone handoff for the FRESH build agent. READ THIS FIRST, before any code. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). This chunk closes
> the single-row `LIMIT 1` twin-model under-deletion (F-1/F-2/F-3) that the SLICE-4 seal + ③ post-seal
> deep audit confirmed PRE-EXISTING & not-worsened and routed forward. Base = `main` @ `25fd6f6d`
> (SLICE-4 sealed + ③ SEAL STANDS + PUSHED to origin/main). DC-16 ledger:
> `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`; DC-05 (test fidelity), DC-11
> (paths-only), DC-13 (over-scrub), DC-14 (schema/migration divergence), DC-15 (docstring/disclosure
> sync), DC-17 (idempotent retry). Predecessor docs (read for context):
> `v-n3-compliance-honesty-slice4-seal-2026-06-18.md` + `…-post-seal-deep-audit-2026-06-18.md`.

## 0. Intent, tier, lifecycle
- **WHY:** SLICE-4 made the consumer-twin lookup normalization-robust + DETERMINISTIC (byte-exact-first
  `ORDER BY … LIMIT 1`), which FOUND the lowercased-only cross-path twin (the SLICE-3 miss) — but it kept
  `LIMIT 1`, so it still scrubs exactly ONE row. When **two or more case-variant `consumers` rows for the
  SAME subject coexist** (`Bob@X.com` raw via OAuth + `bob@x.com` via ask/capture — reachable: the
  `consumers.email` UNIQUE is on the RAW value, schema:166, and there is NO functional `lower(email)`
  index), the deletion scrubs the byte-exact row and **LEAVES the sibling** (F-1 under-deletion),
  de-references only the resolved row's `supabaseUserId` so the sibling's Supabase auth user can orphan
  (F-2), and the pre-txn (`db`) vs step-2 (`tx`) reads are separate READ-COMMITTED snapshots that could
  split (F-3). This chunk makes the erasure operate on the **SET of all matching rows**, so the
  `anonymized` disclosure becomes universally complete (not just for the single-row case).
- **WHO CONSUMES IT:** `processDataDeletion` (`apps/web/src/lib/settlement/compliance.ts`) is the GDPR
  Art-17 erasure path. Still DORMANT — **no prod HTTP caller** (a future deletion route will call it; the
  ③ deep audit re-confirmed zero non-test callers). The persisted `resultUrl` JSON is the erasure-proof
  artifact whose `anonymized`/`retained` arrays must stay honest (column PATHS only — DC-11).
- **TIER: HIGH-STAKES.** PII/financial erasure boundary; rewrites the deletion txn's identity resolution
  (single-row → set-based) AND the auth-user delete set; changes disclosure gating semantics; introduces a
  NEW way to violate `UNIQUE(consumers.email)` (multi-row anonymize); DC-16/DC-11/DC-14/DC-17
  recurrence-prone. Uncertain→high-stakes, and this is squarely a correctness/PII-boundary change.
- **Lifecycle:** scope-confirm → (this handoff) → pre-build plan audit [runs in the ① orchestrator session,
  closes before any build code] → BUILD → executable gate → ② seal-gating review → seal + bookkeeping.
  Founder-close is a path-scoped LOCAL commit; push only on `/push-go`. **Carry-forward:** the working tree
  still has an uncommitted out-of-scope `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (slugify UI)
  — EXCLUDE it at founder-close, same as SLICE-4.

## 1. The subject + the load-bearing decisions (RESOLVED by the plan audit — build them as resolved)

**Subject:** `apps/web/src/lib/settlement/compliance.ts`, `processDataDeletion` (~lines 431-886, base
`25fd6f6d`). The change is confined to the consumer-twin identity resolution + the consumer-scoped scrubs +
the auth-delete set + the disclosure gating. Everything else is FROZEN (§3).

### Current (SLICE-4) shape you are replacing — exact anchors
- Pre-txn auth lookup `consumerForAuth` (`:507-512`): single-row `SELECT supabaseUserId … WHERE
  lower(email)=norm ORDER BY (email=raw) DESC, id ASC LIMIT 1`.
- `supabaseUserIds` set (`:523-529`): `[...new Set([dev.supabaseUserId, consumerForAuth?.supabaseUserId]
  .filter(Boolean))]`.
- Step-2 anonymize lookup `consumerRecord` (`:580-585`): IDENTICAL single-row lookup, `SELECT id … LIMIT 1`.
- Step-2 scrubs gated on `consumerRecord`: `.set({ email: \`deleted-${consumerRecord.id}@…\`, supabaseUserId,
  passwordHash, stripeCustomerId, defaultPaymentMethodId, referralCode = null }).where(eq(consumers.id,
  consumerRecord.id))` (`:599-609`); `tx.delete(apiKeys).where(eq(apiKeys.consumerId, consumerRecord.id))`
  (`:616`); `tx.delete(consumerSchedules).where(eq(consumerSchedules.consumerId, consumerRecord.id))`
  (`:621-623`); `tx.update(conversionEvents).set({metadata:null}).where(eq(conversionEvents.consumerId,
  consumerRecord.id))` (`:635-638`).
- Step 5b auditLogs scrub (`:692-697`): `.where(eq(auditLogs.consumerId, consumerRecord.id))`.
- Step 7 toolReviews comment scrub (`:738-743`): `.where(eq(toolReviews.consumerId, consumerRecord.id))`.
- Manifest disclosure (`:805`, `:811-819`, `:828`, `:835`): consumer paths gated on `consumerRecord`
  (twin EXISTENCE).

### LOAD-BEARING DECISION #1 — per-sibling email anonymization MUST be UNIQUE (the MOST likely silently-wrong).
`consumers.email` is `notNull().unique()` (schema:166). The single-row code sets one row's email to
`deleted-${consumerRecord.id}@deleted.settlegrid.ai`. **With ≥2 sibling rows, if you set them all to one
captured id's string they COLLIDE → UNIQUE violation → the WHOLE txn rolls back → the deletion never
`completed`s (status=failed).** A value-only unit test (the drizzle mock does NOT evaluate SQL or
constraints — DC-05/DC-10) passes anyway, so this is the exact "passes-tests-yet-wrong" trap.
**→ BUILD THIS:** anonymize each matching row with ITS OWN id. Recommended (minimal-risk) realization —
a per-row loop reusing the sealed single-row anonymize:
```
for (const id of ids) {
  await tx.update(consumers)
    .set({ email: `deleted-${id}@deleted.settlegrid.ai`, supabaseUserId: null, passwordHash: null,
           stripeCustomerId: null, defaultPaymentMethodId: null, referralCode: null })
    .where(eq(consumers.id, id))
}
```
(Each iteration is byte-identical to the SLICE-4 single-row form, so the `deleted-<id>@…` format and the
nulls are unchanged; `referralCode`/`supabaseUserId` are nullable-unique → multiple NULLs are permitted, so
ONLY `email` needs per-row uniqueness.) A single set-update with a per-row SQL expression
(`email = 'deleted-' || consumers.id::text || '@deleted.settlegrid.ai'`) is an acceptable alternative but
requires the explicit `uuid→text` cast and a literal-execution check — the loop avoids that. **The test MUST
pin per-row uniqueness** (the email set uses the per-row id, NOT one captured id) and the durable guard is a
real-Postgres integration test (§4).

### LOAD-BEARING DECISION #2 — capture the auth-delete set across ALL sibling rows (closes F-2).
The auth-delete must remove EVERY distinct Supabase auth user across ALL matching consumer rows + the dev's,
not just the resolved row's. **→ BUILD THIS:** capture the matching rows ONCE pre-txn and derive the full id
set:
```
const norm = dev.email.toLowerCase().trim()
const matchingConsumers = norm === '' ? [] : await db
  .select({ id: consumers.id, supabaseUserId: consumers.supabaseUserId })
  .from(consumers)
  .where(sql`lower(trim(${consumers.email})) = ${norm}`)
const ids = matchingConsumers.map((c) => c.id)
const supabaseUserIds = [...new Set(
  [dev.supabaseUserId, ...matchingConsumers.map((c) => c.supabaseUserId)].filter((x): x is string => !!x)
)]
```
Then delete each `supabaseUserId` (existing idempotent loop). No `ORDER BY`/`LIMIT` — the set takes ALL rows,
so the single-row non-determinism DISAPPEARS (the SLICE-4 byte-exact-first tie-break is no longer needed and
should be REMOVED, not preserved).

### LOAD-BEARING DECISION #3 — one pre-txn capture, reused inside the txn (closes F-3; keeps idempotency).
Use the SAME `ids` (captured pre-txn, decision #2) for BOTH the auth-delete AND every in-txn consumer-scoped
write (via `inArray`), instead of re-selecting inside the txn. This makes the auth-delete and the DB scrub
operate on the identical id set **by construction → they cannot split** (today's pre-txn `db` vs in-txn `tx`
re-select CAN split — F-3). Idempotency on a `failed` retry is PRESERVED: the txn rolled back ⇒ rows still
carry their original emails ⇒ the pre-txn `lower(trim(email))=norm` re-selects the same `ids` ⇒ re-scrubs;
a completed run leaves `deleted-<id>@…` emails that no longer match ⇒ re-run finds 0 ids (and the
idempotent-`completed` no-op short-circuits first anyway). **NB residual (accepted, NOT in scope):** a
consumer row INSERTED after the pre-txn capture is not part of this run — strictly the same class as today's
single-subject dormant-op residual, and a re-run would catch it; do NOT add locking/serializable-isolation
(over-engineering a dormant path). **The plan audit's SEAM lens must confirm:** the auth-delete genuinely
cannot be moved inside the txn (external network call), and using a pre-txn id list in the txn does not
break the atomicity/`completed`-only-at-end contract.

## 2. Build scope (the hardened plan — A/B/C/D/E/F)

**(A) Set-based, whitespace-symmetric twin resolution.** Replace BOTH single-row lookups with the ONE
pre-txn capture in decision #2 (`lower(trim(${consumers.email})) = ${norm}`, no ORDER BY / no LIMIT). Drop
the now-unneeded byte-exact-first ORDER BY. The trim on the COLUMN side closes the SLICE-4 ③ whitespace nit
(`lower()` was applied without `trim()`); `norm` already trims the dev side.

**(B) Empty-email guard (F-4).** `const norm = dev.email.toLowerCase().trim(); if (norm === '') …` — when
`norm` is empty, the matching set is empty (`ids = []`), so the entire consumer-twin block (auth-ids from
consumers, all scrubs, all consumer disclosures) is skipped. Prevents `lower(trim(email))=''` from matching
an unrelated empty-email consumer row. (`developers.email` is NOT NULL but `''` is theoretically storable;
dormant — but the guard is one line and removes the foot-gun.)

**(C) Auth-delete over the full set** (decision #2) — `supabaseUserIds` derived from ALL matching rows +
the dev's, deduped, non-null; existing idempotent delete loop unchanged.

**(D) Re-key EVERY consumer-scoped write to the set** (`inArray`), gated on `ids.length > 0`:
- consumers anonymize → the per-row loop (decision #1).
- `tx.delete(apiKeys).where(inArray(apiKeys.consumerId, ids))`.
- `tx.delete(consumerSchedules).where(inArray(consumerSchedules.consumerId, ids))`.
- `tx.update(conversionEvents).set({metadata:null}).where(inArray(conversionEvents.consumerId, ids))`.
- step 5b `tx.update(auditLogs).set({ipAddress:null,userAgent:null,details:null})
  .where(inArray(auditLogs.consumerId, ids))`.
- step 7 `tx.update(toolReviews).set({comment:null}).where(inArray(toolReviews.consumerId, ids))`.
Replace the `consumerRecord` variable throughout with `ids` / a `const consumerMatched = ids.length > 0`
boolean. (Schema anchors: `apiKeys.consumerId` :244, `auditLogs.consumerId` :508, `toolReviews.consumerId`
:545, `conversionEvents.consumerId` :613, `consumerSchedules.consumerId` :1266 — all FK→`consumers.id`.)
**Guard:** drizzle `inArray(col, [])` must NOT be emitted with an empty array (some drivers render invalid
SQL / match-all) — the `ids.length > 0` gate already prevents this; confirm every `inArray` site is inside
the `if (consumerMatched)` block.

**(E) Disclosure gating (DC-16/DC-11/DC-15).** Replace every `consumerRecord ? […] : []` gate in the
`resultUrl.anonymized` manifest with `consumerMatched ? […] : []` (rows-MATCHED at the consumer level — now
"≥1 consumer row erased", strictly truthful for the set). The `api_keys` OR-gate becomes
`toolIds.length > 0 || consumerMatched`. Column PATHS only (DC-11) — no row values, no ids.
**OPTIONAL (lowest priority — DECIDE in the plan audit, do NOT gold-plate):** the SLICE-4 ③ ruled the
per-sub-table existence-gating NON-FALSE under the "column PATHS only" contract (a path entry discloses the
column was processed, not that N rows existed; matches the `tool_reviews`/`invocations.metadata` precedent).
The uniformity hardening (gate each sub-path on its own `.returning()` rows-matched, like
`waitlist_signups`' `deletedWaitlist`) is OPTIONAL. Recommended default: gate on `consumerMatched` and STOP
— do not add per-table `.returning()` plumbing unless the plan audit judges the non-uniformity a live
honesty risk. Update the docstring (`:394-408`) to describe "all matching consumer rows" (set-based), not
"the twin" (single).

**(F) Tests (DC-05 mock-surface + DC-10/DC-05 predicate pins).** In
`apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` and `settlement-moat.test.ts`:
- Pin the predicate SHAPE: the consumer-scoped writes now key on `inArray(consumers.id|<col>.consumerId,
  ids)` NOT `eq(...)`; the lookup is `lower(trim(email))=norm` with NO `ORDER BY`/`LIMIT` (assert
  `sql.strings` contains `trim(`, and does NOT contain `order by`/`limit` on the consumer lookup).
- Pin DECISION #1: the consumers anonymize sets a PER-ROW email (the captured id list maps to distinct
  `deleted-<id>@…` emails) — assert the email written for each row uses THAT row's id, never one shared id.
- Pin DECISION #2: with two seeded sibling rows carrying two distinct `supabaseUserId`s, BOTH ids reach the
  auth-delete set (deduped).
- Pin (B): `norm===''` → zero consumer writes, zero consumer disclosures.
- Re-key the existing SLICE-4 assertions from `eq` to `inArray`.
- **DC-05/DC-10 LIMIT (state it in the build report, do NOT pretend otherwise):** the drizzle test doubles
  do NOT evaluate SQL or enforce constraints, so the two-row RESOLUTION + the UNIQUE-collision avoidance are
  **construction-pinned only** (the `sql.strings`/inArray/per-row-id pins catch a SOURCE regression but
  cannot exercise real two-row behavior). The durable guard is a real-Postgres integration test (seed two
  case-variant rows → run → assert BOTH anonymized with DISTINCT `deleted-<id>@…` emails, no unique
  violation, both `supabaseUserId`s deleted). If no integration harness exists, RECORD the gap for ② — do
  NOT fabricate coverage.

## 3. Frozen / unchanged (do NOT perturb)
Everything outside the consumer-twin resolution/scrub/auth-set/disclosure: the developer-side steps (1, 1b,
2b, 3-8 except the consumer-keyed writes re-keyed in (D)), the status machine
(pending→processing→completed|failed), the idempotent-`completed` no-op, the `catch`→`failed`, the
atomicity contract (`completed` set ONLY at the final step inside the txn), `tools.name/slug` retention,
the developer audit scrubs (steps 5 + 5c — keyed on `developerId`/`resourceId`, NOT consumer), the
`organizations`/`organization_members` deferral, the `ledger_entries` payer scrub (legal-gated →
V-N3-erasure), the `outcome_verifications.dispute_reason` NO-ACTION (opaque non-FK id — ③ re-verified at
source: no FK to consumers.id), the `data-retention` cron, `packages/mcp`. **Do NOT** scrub additional
tables, expand `retained`/`retainedUnscrubbed`, or touch the org/ledger clauses. **Do NOT** add
locking/serializable isolation for F-3 (accepted residual). `tools/page.tsx` stays untouched + excluded at
founder-close.

## 4. Gate + the named "silently-wrong" risks
- **Gate:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → `tsc` 0 · `lint` 0 err
  (8 pre-existing warns) · `vitest` ALL-pass. Baseline @ `25fd6f6d` = **4566/197/0**; this chunk ADDS tests
  (sibling-set resolution, per-row email, multi-auth-id, empty-email guard, inArray re-key). `${PIPESTATUS}`
  is empty under zsh — read the `Test Files`/`Tests` summary lines.
- **The decisions most likely silently wrong** (audit judgment concentrates here): **#1 the per-row UNIQUE
  email** (a single captured id for N rows → unique-violation rollback → deletion silently fails; the unit
  mock won't catch it); **#2 the auth-delete set** (missing a sibling's `supabaseUserId` → auth-user orphan,
  the F-2 harm); **#3 the pre-txn-capture-reused-in-txn** atomicity/idempotency (must not break
  `completed`-only-at-end or the failed-retry re-scrub). Build them as resolved (§1) and pin them per §2(F).
- **`inArray(col, [])` foot-gun:** never emit an empty-array `inArray` (gate on `ids.length>0`).

## 5. Defect classes in play
DC-16 (the disclosure becomes universally complete once the SET — not one row — is erased; the process
lesson the SLICE-4 ledger recorded: "a LIMIT-1 slice closes the *miss* but not the *under-deletion*; the
fix must operate on the SET of matching rows"); DC-11 (resultUrl paths-only — every entry a column PATH);
DC-13 (over-scrub guard — do NOT blanket-delete or add tables; the set is bounded to `lower(trim(email))`
matches); DC-14 (no `lower(email)` index — the set scan is correct + intended; do NOT rely on any
unapplied UNIQUE); DC-15 (docstring/note/test sync — update the docstring to "all matching rows"); DC-17
(idempotent retry — the set re-resolves on a failed retry); DC-05/DC-10 (mock gains nothing new; the
two-row RESOLUTION + UNIQUE-collision remain construction-pinned — real-Postgres integration test is the
durable guard). SEAM (auth-delete-can't-be-in-txn; UNIQUE(email) collision; `inArray([])`) + LITERAL-
EXECUTION (read each drizzle `inArray`/per-row update / any raw `sql` cast as Postgres) standing.

## 6. PLAN-AUDIT HARDENING (MANDATORY — 2026-06-18; SUPERSEDES any softer wording above)
The ① pre-build plan audit (5 fresh-context lens-distinct Opus-4.8 reviewers — correctness/atomicity · SEAM ·
literal-execution · DC-16 disclosure · scope+test-fidelity — at the xhigh floor) CONFIRMED the design (the 3
load-bearing decisions are sound and not breakable as specified) and produced these BINDING refinements.
Build ALL of them.

**RESOLVED decision:**
- **§2E optional per-table rows-matched gating → DROPPED (do NOT build it).** Gate every consumer disclosure
  path on `consumerMatched = ids.length > 0` and STOP. Under the binding "column PATHS only / a path means
  PROCESSED" contract, a path entry discloses the column was processed, not that N rows existed; the correct
  precedent is the already-sealed `conversion_events.metadata`/`tool_reviews` (consumerId-keyed, group-gated),
  NOT `waitlist_signups` (email-keyed standalone). Per-table `.returning()` plumbing would be DC-13
  gold-plating + a DC-15 intra-manifest inconsistency with the dev side. (Ruled definitively by 3 lenses.)

**CORRECTNESS / BUILD-FIDELITY guardrails (the highest-risk build-drift points):**
- **G-a (the empty-array gate):** keep `const consumerMatched = ids.length > 0` and ensure EVERY one of the 6
  consumer `inArray` writes (consumers loop, apiKeys, consumerSchedules, conversionEvents, step-5b auditLogs,
  step-7 toolReviews) is lexically inside `if (consumerMatched)` — NOTE steps 5b + 7 sit in SEPARATE
  `if (consumerRecord)` blocks today; ALL must become `if (consumerMatched)`. **RATIONALE CORRECTION (verified
  against the installed drizzle-orm 0.38.4 source by 2 lenses): `inArray(col, [])` renders `sql\`false\``
  (match-NONE, safe) — NOT invalid SQL, NOT match-all.** So the gate is defense-in-depth (disclosure-gating +
  per-row-loop short-circuit + parity with the `toolIds.length>0` idiom + version-defensiveness), NOT the thing
  preventing a malformed/over-delete render. Do NOT justify it in code/report as a "match-all hazard" — that
  hazard does not exist at 0.38.4 (a false rationale is a DC-15 nit).
- **G-b (empty-email guard placement — HIGH):** the `norm === ''` guard MUST gate the pre-txn CAPTURE itself
  (`const matchingConsumers = norm === '' ? [] : await db.select(...)`), NOT merely the writes. If the SELECT
  runs with `norm=''`, `lower(trim(email))=''` can match an UNRELATED empty-email consumer row and pull its
  `supabaseUserId` into the pre-txn (irreversible, non-rolled-back) auth-delete → over-delete of a stranger's
  auth user. This guard does DISTINCT work from G-a (it prevents a real Postgres match, not a drizzle artifact).
- **G-c:** after deriving `supabaseUserIds` from the new `matchingConsumers` set, KEEP
  `const deletedAuthUser = supabaseUserIds.length > 0` (the `supabase_auth_user` disclosure gates on it) — the
  refactor must not desync it.
- **G-d:** the `api_keys` disclosure is the ONE non-uniform gate — `toolIds.length > 0 || consumerRecord` must
  become `toolIds.length > 0 || consumerMatched` (a bare `consumerRecord ?` find/replace misses the
  `|| consumerRecord` term; tsc will catch an undefined var, but call it out).
- **G-e (DC-15 comment-sync):** when removing the byte-exact-first `ORDER BY … LIMIT 1`, ALSO rewrite the stale
  single-row rationale COMMENTS at compliance.ts ~:494-506 (the "(a)/(b)/(c) … non-deterministic … same row"
  justification) and the docstring ~:394-408 to the set-based model ("all matching rows", not "the twin"/"the
  SAME row"). A surviving single-row rationale comment beside set-based code is the exact
  partial-fix-leaves-a-sibling pattern this ledger tracks.

**ACCEPTED RESIDUALS (NOT in scope — record, do NOT fix):**
- `audit_logs.consumerId` is `onDelete:'set null'` (the only non-cascade consumer FK): a concurrent hard-delete
  of a sibling consumer between the pre-txn capture and the in-txn step-5b could leave that sibling's audit rows
  un-nulled — SAME class as the "row inserted after capture" residual (decision #3); dormant (no prod caller, no
  concurrent consumer-delete path). Add an explicit "also accepted" line; do NOT add locking.
- "whitespace-symmetric" means LEADING/TRAILING only — `trim()` does NOT strip internal spaces or a Unicode
  NBSP, so a `"bob @x.com"`/NBSP twin still escapes. SAME residual as today (not worsened); do NOT chase it.

**TEST-FIDELITY (§2F additions — REQUIRED; verified at source against BOTH rigs):**
- **T-a (decision #1's pin is single-row-VACUOUS without this):** the per-row UNIQUE-email pin only bites with
  ≥2 rows. The auth-test rig's pre-txn consumer seed is today a single `[{ supabaseUserId }]` with no `id`
  (`compliance-deletion-auth.test.ts:223-224`). Upgrade it to a MULTI-ROW, distinct-`id` array (e.g.
  `[{id:'c1',supabaseUserId:'a1'},{id:'c2',supabaseUserId:'a2'}]`) and assert the consumers
  `.update().set().where()` fires once per id with DISTINCT `email:'deleted-c1@…'`/`'deleted-c2@…'` — a
  `deleted-${ids[0]}@-for-all` bug must go RED. The SAME multi-row seed pins decision #2 (both `supabaseUserId`s
  reach the deduped auth set).
- **T-b (decision #3 ELIMINATES the in-txn re-select → rig change):** the consumer `ids` now come from the ONE
  pre-txn capture (selectQueue call #3) and are reused in-txn, so the in-txn consumer re-select is GONE. Remove
  the auth-test rig's `consumerInTxn`/`txSelectQueue` in-txn-consumer seeding (`:230`) and the moat rig's
  `txChain.select` consumer chain — the consumer rows now flow from the pre-txn seed.
- **T-c (the moat rig goes RED without this):** in `settlement-moat.test.ts setupDeletionRunMocks` (~:725-751),
  select call #3 (the consumer pre-txn lookup) resolves via `chain.limit.mockResolvedValue([])`. Under the plan
  that lookup is BARE-AWAITED (no `.limit()`) and the chain is NOT thenable → `.map()` throws → the two moat
  deletion tests go RED. Make call #3 resolve on bare-await (e.g. `chain.where.mockResolvedValue([…])`, mirroring
  the existing `else`/toolIds branch). The auth-test rig already exposes `.then` (`:66`) and survives.
- **T-d (DC-11 set-specific re-run):** with ≥2 sibling rows seeded, re-assert the existing DC-11 path-shape
  guard (every manifest entry matches `/^[a-z_]+(\.[a-z_]+)*$/` and no `deleted-<id>@…`/subject-email appears) —
  proves the per-row loop never leaks a per-id value into the manifest.
- **T-e (rewrite, don't break):** the existing SLICE-4 determinism test (`compliance-deletion-auth.test.ts`
  ~:619-656, which pins the `ORDER BY` on BOTH lookups and asserts they're equal) MUST be rewritten — there is
  now ONE consumer lookup, no ORDER BY/LIMIT; assert `sql.strings` contains `trim(` and does NOT contain
  `order by`/`limit`, and that the consumer-lookup count drops 2→1. Leaving the old test → false-RED; leaving
  the ORDER BY in source to keep it green → incomplete refactor.
- **T-f (no fabricated coverage):** the drizzle mocks do NOT evaluate SQL or enforce UNIQUE, and NO
  real-Postgres/pglite/testcontainers harness exists in-repo (3 lenses confirmed). So the two-row RESOLUTION +
  the UNIQUE(email)-collision avoidance are CONSTRUCTION-PINNED ONLY. State this in the build report and RECORD
  the integration-test gap for ② — do NOT fabricate unit coverage of the two-row behavior.
```
