# V-N3 (compliance-honesty SLICE 4) — consumer-side normalization + financial-linkage erasure → SEALED (2026-06-18)

> ② seal-gating review PASSED; operator `/seal-go` confirmed → cadence phase `sealed`. LOCAL only,
> **NOT pushed, NOT yet committed** (founder-close is a single path-scoped LOCAL commit bundled after ③;
> `/push-go` is a separate explicit gate). Base = `main` @ `075115d7` (SLICE 3 sealed + ③ RE-CERTIFIED +
> PUSHED); the SLICE-4 work is uncommitted on top. Predecessor handoff:
> `v-n3-compliance-honesty-slice4-consumer-normalization-handoff-2026-06-17.md` (① build + folded pre-build
> PLAN audit); build report: `v-n3-compliance-honesty-slice4-consumer-normalization-BUILD-REPORT-2026-06-17.md`.
> DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.
> **This chunk CLOSES the consumer-twin normalization-miss travel item that SLICE-3's seal routed forward
> to "the consumer-side normalization chunk."**

## Verdict
**SEALED** — gate green, zero high-severity findings open, reviewers' evidence supports it (4 fresh-context
lens-distinct Opus-4.8 reviewers + the integrator's own DC-16 claim-honesty / core-invariant pass at
confirmed `/effort max` in the main session). The one reviewer-rated HIGH (F-1) was reproduced-by-analysis
as a **pre-existing, not-worsened, conditional** under-deletion of the single-row twin model and reclassified
non-blocking → scoped forward; no high-severity finding remains open.

## What shipped (one line)
`processDataDeletion` (`apps/web/src/lib/settlement/compliance.ts`) — A/B/C/D of the hardened plan, all
INSIDE the existing `db.transaction`, gated on `consumerRecord`: **(A)** a normalization-robust,
**byte-exact-first DETERMINISTIC** consumer-twin lookup — `WHERE lower(email)=lower+trim(dev.email)` +
`ORDER BY (email=dev.email) DESC, id ASC` + `.limit(1)`, **IDENTICAL** at the pre-txn auth lookup (:510-512)
and the step-2 anonymize lookup (:583-585), so a cross-path mixed-case twin is reliably + consistently
resolved (closes the SLICE-3 byte-exact `eq()` miss); **(B)** the step-2 `.set()` now also nulls
`stripeCustomerId`/`defaultPaymentMethodId`/`referralCode`; **(C)** deletes the twin's OWN `apiKeys`
(consumerId-keyed) + `consumerSchedules`, and nulls `conversionEvents.metadata` (all consumerId-keyed);
**(D)** the three financial paths + `consumer_schedules` + `conversion_events.metadata` MOVE from
`retainedUnscrubbed`→`anonymized` (gated identically to their scrub); `api_keys` disclosure gate broadened
to `toolIds>0 || consumerRecord`; the false "referral_code anchors referral attribution" rationale REMOVED
from both the docstring and the `retainedUnscrubbedNote`. RULED at source: `conversion_events.metadata` →
SCRUB+disclose (reliable `consumers.id` FK); `outcome_verifications.dispute_reason` → NO-ACTION (its
`consumer_id` is a tool-supplied opaque string, not `consumers.id` — scrubbing would no-op and disclosing
would be a false DC-16 claim).

## Gate (re-verified clean isolated, this session — at review AND re-confirmed at seal time)
apps/web `tsc` 0 · `lint` 0 err (8 pre-existing `<img>`/react-hooks/unused-disable WARNINGS only, none in
touched files) · **`vitest` 4566 / 197 / 0** (baseline @ `075115d7` = 4557 → delta **+9** net new SLICE-4
tests; the old 2-test F-3/4/5 retained-disclosure block was REPLACED by an 11-test SLICE-4 block). `tsc`
re-run exit 0; full suite re-run 4566/4566 0-failed/0-skipped — exact match to the build report's reported
digest. `compliance.ts` shasum `724e1a2719b01043e50c8c2ac8aa805a1344dd9f` matched the build's reported
digest at review AND was UNCHANGED at seal time. packages/mcp UNTOUCHED.

## Review shape
4 fresh-context, lens-distinct Opus-4.8 reviewers on the real diff (correctness/determinism ·
spec-conformance · SEAM · literal-execution/test-vacuity — via Agent-tool spawns) **+ the integrator's own
DC-16 claim-honesty / core-invariant pass at confirmed `/effort max` in the main session.** All 4 reviewers
self-reported `claude-opus-4-8[1m]`. **0 high open · the 3 sustained findings (F-1/F-2/F-3) share one
pre-existing root cause and are scoped forward (below).**

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) unavailable — no
`.claude/agents/` pool carries `effort:` frontmatter, and a running agent cannot stand one up mid-run. A
`max` core-invariant lens forces Agent-tool territory and a single workflow cannot host a mixed-effort
fan-out, so the fan-out ran as Agent-tool spawns (allowlist GREEN mooted a workflow's loud-pause edge).
Operator elected `/effort max`; the **integrator personally ran the decisive DC-16 claim-honesty /
core-invariant adjudication in the confirmed-max main session** (the 4 reviewers self-reported `high`, treated
as ≥`high`, not credited as confirmed-max). Allowlist pre-flight GREEN (git/tsc/lint/vitest in caps;
`settlegrid-discovery` MCP enabled; no WebFetch needed). Env clean (FORK_SUBAGENT / SUBAGENT_MODEL /
EFFORT_LEVEL all unset).

## The decisive core-invariant adjudication (DC-16 claim-honesty, at `/effort max`)
The one thing this build newly introduces is the **`retainedUnscrubbed`→`anonymized` posture move** on the
three consumer financial fields. The max pass adjudicated whether that, combined with the `LIMIT 1`
single-row twin scrub, creates a DC-16 false/incomplete public claim materially WORSE than the SLICE-3
baseline. **Ruled: NO — SEAL.** Load-bearing facts, ground-truthed at source this session:
- **FACT 1 — the S2 (coexisting mixed-case rows) incomplete-claim class is PRE-EXISTING and already
  SEALED.** `compliance.ts:805` `...(consumerRecord ? ['consumers'] : [])` and `:835`
  `...(consumerRecord ? ['tool_reviews'] : [])` are SLICE-3 (context, not SLICE-4) entries — SLICE-3 already
  disclosed `consumers` as *anonymized*, gated on twin-existence, backed by a single-row `eq().limit(1)`
  scrub. SLICE-4 extends the SAME pattern to the financial fields; it invents no new dishonesty class.
- **FACT 2 — zero disclose-without-scrub.** Every anonymized consumer path (:813-817, :828) has a backing
  scrub (:605-607, :616, :621-623, :635-638) under the LITERALLY IDENTICAL `consumerRecord` gate. In S0
  (no twin) and S1 (single twin — incl. the cross-path lowercased-only row this slice exists to fix), every
  claim is fully true.
- **FACT 3 — `referral_code = SCRUB` is sound; the removed rationale was genuinely false.** Independent
  grep of every reader: the ONLY behavioral resolver of `consumers.referralCode` is
  `consumer/referral/apply:82` (a new referee redeeming an inbound code — correctly blocked for a deleted
  account); `consumer/referral/route.ts:36` is a self-display read; `metering.ts:266` keys off
  `referrals.referralCode` (NEVER `consumers.referralCode`); `newsletter/subscribe:64` is a comment. Nulling
  breaks nothing → SLICE-4 net **REMOVES** a DC-16 false claim.
- **Why not blocking:** SLICE-4 is **strictly more protective than SLICE-3 in every scenario** (it scrubs
  the financial fields SLICE-3 retained on all rows; it never retains more). The S2 incompleteness is the
  pre-existing single-row-twin class (old `eq().limit(1)`, confirmed not-worsened), conditional, on a
  DORMANT path (no prod HTTP caller), and bounded by the explicit "column PATHS only — never row values"
  coverage contract. The only S2 "fix" is the all-rows scrub, which the handoff did NOT authorize (it
  prescribed `LIMIT 1`; the prior PLAN audit adjudicated the sibling as MED-conditional-scope-forward) —
  forcing it = unauthorized scope + strictly LESS erasure. → routed forward.

## Verified at source (load-bearing — ground-truthed, NOT inspected)
- **The moat invariant holds for the new ops:** `completed` is written ONLY at the final step inside the
  txn; all new scrubs (step-2 `.set()`, the two consumerId-keyed deletes, the metadata null) are INSIDE the
  same txn → atomic, and idempotent on a `failed` retry (rollback preserves the original email, so the
  normalized lookup re-finds + re-scrubs; `completed` → early no-op). `completed ⇒ (auth deleted ∧ found-twin
  anonymized ∧ all consumer scrubs applied)` holds for the resolved row.
- **Determinism is a TOTAL order:** `ORDER BY (email=raw) DESC, id ASC` over a NOT-NULL UUID PK can never
  tie on `id`; `(email=$1)` is a sortable boolean (PG `TRUE>FALSE`, DESC ⇒ byte-exact first). The WHERE
  binds the normalized value, the ORDER BY binds the raw value — two distinct params, intentional. Pinned in
  test by `sql.strings` (asserts `lower(`/`=`/`DESC`/`ASC`, NOT `upper(`/`<>`) + both lookups byte-identical.
- **Schema ground-truth:** `consumers.{stripeCustomerId,defaultPaymentMethodId,referralCode}` (schema:169/
  171/173, nullable text), `apiKeys.consumerId`, `consumerSchedules.consumerId`, and
  `conversionEvents.consumerId` (a real uuid FK → `consumers.id`, schema:508 `onDelete:'set null'`) all
  exist. `outcomeVerifications.consumerId` is bare `text` with NO FK (schema:1211) — confirms the NO-ACTION
  ruling. `consumers.email` UNIQUE is on the RAW value with no `lower(email)` functional index (migrations +
  schema grep empty) — so case-variant rows can coexist (the determinism rationale holds).
- **`.set()` uses literal `null`** (not `undefined`, which drizzle would omit) → the columns are actually
  written. `api_keys` is emitted EXACTLY ONCE in `anonymized` (:824 emits only `invocations.metadata`; :828
  emits `api_keys` once under the widened gate) — no duplicate.

## Frozen-surface compliance
Diff = `compliance.ts` (the 6 authorized hunks: imports +2; pre-txn + step-2 deterministic lookups; step-2
financial `.set()` + apiKeys/consumerSchedules deletes + conversion metadata scrub; disclosure
anonymized/retainedUnscrubbed/note; docstring DEFERRED block) + 2 test files only. UNCHANGED: developer
steps 1/1b/2b/3-8 beyond the consumer-twin-gated additions, the status machine
(pending→processing→completed|failed), the idempotent-`completed` no-op, the `catch`→`failed`,
`tools.name/slug` retention, `organizations`/`organization_members` deferral, the `ledger_entries` payer
scrub (V-N3-erasure), the `data-retention` cron, `packages/mcp`. The org/ledger `retainedUnscrubbed`
disclosures + note are preserved verbatim (org/ledger clauses untouched).

## Open residuals (NON-BLOCKING → travel forward)
- **F-1/F-2/F-3 (MED, one root cause: the single-row `LIMIT 1` twin model) → a follow-up consumer-twin
  all-rows-erasure hardening chunk.** When two+ case-variant `consumers` rows for the SAME subject coexist
  (`Bob@X.com` raw via OAuth + `bob@x.com` via ask/capture — reachable since the UNIQUE is on raw), the
  deterministic lookup scrubs exactly ONE (byte-exact first) and **leaves the sibling** (F-1 under-deletion);
  the pre-txn auth-delete de-references only the resolved row's `supabaseUserId`, so a sibling's auth user
  can orphan (F-2); and the pre-txn (`db`) vs step-2 (`tx`) reads are separate snapshots under READ
  COMMITTED, so a concurrent insert between them could split the resolution (F-3). All three are
  **PRE-EXISTING** (SLICE-3's `eq().limit(1)` had the same single-row structure), **not worsened** (SLICE-4
  strictly improves the common cross-path single-row case), conditional, and DORMANT. **Coherent fix:**
  resolve `ids = SELECT id FROM consumers WHERE lower(email)=norm` and key every consumer-scoped write +
  the auth-delete on `inArray(consumers.id, ids)` (the SET, not a single picked row) — makes the
  `anonymized` path-claims universally complete. Mirrors how SLICE-3 routed the twin normalization-miss into
  THIS chunk.
- **F-4 (LOW) → fold into the same follow-up:** `dev.email=''` (NOT NULL allows `''`) would make
  `lower(email)=''` match an unrelated empty-email consumer. Practically impossible (auth populates a real
  email) + dormant path; a one-line `if (norm==='') skip` guard is the fix — not applied here (gold-plating
  a dormant edge under seal).
- **DC-05/DC-10 unit-mock limitation (accepted, inherent):** the drizzle test doubles do NOT evaluate SQL —
  `makeSelectBuilder` returns the queued row regardless of predicate. So the determinism/no-split/
  left-behind-sibling RESOLUTION is **construction-pinned only** (the `sql.strings`/byte-identical pins are
  real and catch a `lower→upper`/`=→<>`/dropped-ORDER-BY SOURCE regression, but the two-row BEHAVIOR is
  untestable without real Postgres). Mitigated by tsc 0 + direct schema confirmation. Not introduced here.
- **SEAM (gating convention, LOW):** `consumer_schedules`/`conversion_events.metadata`/consumer `api_keys`
  are disclosed gated on twin-EXISTENCE, not rows-MATCHED (unlike `waitlist_signups`' `deletedWaitlist`
  gate). Under the explicit "column PATHS only" contract this is NOT a false claim and it matches the
  dominant pre-existing convention (`tool_reviews`, `invocations.metadata`). Optional uniformity hardening
  (gate all consumer paths on `.returning()`-derived rows-matched) → ③/follow-up.
- **`tools/page.tsx` (out-of-scope tree noise) → EXCLUDE at founder-close.** A `slugify` name→slug auto-fill
  UI change unrelated to GDPR erasure, present + staged in the working tree but NOT authorized by this
  handoff (subject = `compliance.ts` + its 2 test files). The post-③ founder-close must be path-scoped to
  exclude it.
- **Pre-existing:** `processDataDeletion` has NO prod HTTP caller (DORMANT); the `cron/data-retention`
  30-day purge of `compliance_exports` rows still erases the `resultUrl` erasure-proof artifact (N4).

## Defect-class ledger
**DC-16** — the consumer-twin normalization-miss that SLICE-3 routed to "the consumer-side normalization
chunk" → **CLOSED for the single-row cross-path case** (the normalized byte-exact-first deterministic lookup
now finds the lowercased-only twin; the financial/referral/sibling scrubs complete the consumer-side
erasure; the false "referral_code anchors attribution" claim REMOVED — a net claim-honesty improvement). New
sibling recorded: the **single-row `LIMIT 1` twin model under-deletes a coexisting case-variant SIBLING**
(F-1/F-2/F-3) — a DC-16 disclosure-completeness + GDPR under-deletion TRAVEL item, pre-existing &
not-worsened, routed to an all-rows-erasure follow-up. Touchpoints: **DC-11** (`resultUrl` paths-only — every
new entry a column PATH, never a row value); **DC-13** (over-scrub guard — financial/sibling tables ruled,
no blanket delete of product/financial tables; `outcome_verifications` NO-ACTION avoids a false claim);
**DC-14** (the unapplied `UNIQUE(supabase_user_id)` + Clerk-era frozen migrations — the code correctly does
NOT rely on the constraint, using the deterministic ORDER-BY tie-break); **DC-15** (docstring/note/test kept
in sync; the false referral rationale removed from BOTH docstring and note); **DC-17** (every new
delete/null-set idempotent on a `failed` retry); **DC-05/DC-10** (mock schemas gained `consumerId`; the
determinism test pins the `lower()`/`ORDER BY` SQL literal, not just the bound value — but the constant-mock
cannot exercise the two-row RESOLUTION, recorded as the accepted limitation above).
**SEAM recurrence:** twin-existence-vs-rows-matched disclosure gating — ruled non-false under the
column-paths contract (matches precedent), uniformity hardening optional. **LITERAL-EXECUTION recurrence:**
determinism is SQL-CONSTRUCTION-pinned, not RESOLUTION-tested (non-evaluating drizzle mock) — the durable
guard for the two-row behavior is a real-Postgres integration test (the construction pins remain valuable
for source-regression). **Process lesson:** a "make the lookup reliable" slice that keeps `LIMIT 1` closes
the *miss* (0→1 row found) but not the *under-deletion* (N>1 rows → 1 scrubbed); the two are distinct and
the second needs a set-based scrub.

## Next
HIGH-STAKES → **③ post-seal deep audit** (handoff:
`v-n3-compliance-honesty-slice4-post-seal-deep-audit-handoff-2026-06-18.md`): integrated-whole audit (the
diff-scoped ② cannot see adjacent untouched surfaces — the SLICE-1/2 ③ census-miss class), with a dedicated
`/effort max` DC-16 claim-honesty lens, a **complete consumer-keyed-PII deletion-surface census** (is the
handoff §2C census exhaustive, or is there an un-enumerated consumer-keyed PII table neither scrubbed nor
disclosed?), the single-row-twin all-rows-erasure follow-up as a tracked input, and a collective-miss
critic. Founder-close is a single path-scoped LOCAL commit (compliance.ts + the 2 test files + the slice-4
docs; **EXCLUDE `tools/page.tsx`**) bundled after ③; `/push-go` is a separate explicit gate.
