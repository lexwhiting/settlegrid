# V-N3 (compliance-honesty SLICE 5) — all-rows consumer-twin erasure → SEALED (2026-06-18)

> ② seal-gating review PASSED; operator `/seal-go` confirmed → cadence phase `sealed`. LOCAL only,
> **NOT pushed, NOT yet committed** (founder-close is a single path-scoped LOCAL commit bundled after ③;
> `/push-go` is a separate explicit gate). Base = `main` @ `25fd6f6d` (SLICE 4 sealed + ③ SEAL STANDS +
> PUSHED); the SLICE-5 work is uncommitted on top. Predecessor (① build + folded pre-build PLAN audit):
> `v-n3-compliance-honesty-slice5-allrows-twin-erasure-handoff-2026-06-18.md`.
> DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.
> **This chunk CLOSES the single-row `LIMIT 1` twin under-deletion (F-1/F-2/F-3 + F-4 + the SLICE-4-③
> column-side-`lower()`-without-`trim()` SEAM nit) that the SLICE-4 seal + ③ routed forward to "an
> all-rows-erasure follow-up."**

## Verdict
**SEALED** — gate green, zero high-severity findings open, zero medium-severity findings open, reviewers'
evidence supports it. **5 fresh-context lens-distinct Opus-4.8 reviewers** (correctness/atomicity ·
disclosure-honesty DC-16/DC-11/DC-15 + scope/frozen · SEAM · literal-execution + test-fidelity — via
Agent-tool spawns at the `xhigh` session-inherited floor) **+ the data-integrity MOAT lens at the operator
`/effort max` session + the integrator's own source-level ground-truth.** ALL FIVE CONVERGED with zero
sustained high/med findings. No fix was required; nothing was reproduced-then-fixed because nothing
sustained needed fixing.

## What shipped (one line)
`processDataDeletion` (`apps/web/src/lib/settlement/compliance.ts`) — the hardened all-rows plan (A–F),
replacing the single-row `LIMIT 1` consumer-twin model with a **SET-based erasure**: **(A)** ONE pre-txn
capture of ALL rows whose `lower(trim(consumers.email)) = dev.email.toLowerCase().trim()` (symmetric
`trim()` on BOTH sides — closes the SLICE-4-③ whitespace SEAM nit; NO `ORDER BY` / NO `LIMIT` — the
byte-exact-first tie-break is removed because the set takes every row); **(B)** an F-4 empty-email guard
that gates the CAPTURE itself (`norm === '' ? [] : await db.select(...)`), so an empty `norm` can never
pull an unrelated empty-email row's `supabaseUserId` into the irreversible pre-txn auth-delete; **(C)** the
auth-delete set spans `[dev.supabaseUserId, ...matchingConsumers.map(c => c.supabaseUserId)]` (deduped,
non-null) — no sibling's auth user orphans (closes F-2); **(D)** every consumer-scoped write re-keyed
`eq(col, id)` → `inArray(col, ids)`, all gated inside `if (consumerMatched)` (`consumerMatched = ids.length
> 0`): the consumers anonymize is a **per-row loop** writing `deleted-<THIS row's id>@deleted.settlegrid.ai`
(decision #1 — a single shared id across N rows would collide on the RAW `UNIQUE(email)` → whole-txn
rollback → silent failed deletion), plus `apiKeys` / `consumerSchedules` deletes and
`conversionEvents.metadata` / step-5b `auditLogs` / step-7 `toolReviews` nulls over the set; **(E)** the
disclosure manifest gates flip `consumerRecord` → `consumerMatched` (the `api_keys` OR-gate becomes
`toolIds.length > 0 || consumerMatched`); column PATHS only (DC-11), the DROPPED optional per-table
`.returning()` gating NOT built (handoff §6); **(F)** docstring + the stale single-row rationale comments
rewritten to the set-based model. The SAME captured `ids` drive BOTH the pre-txn auth-delete AND every
in-txn scrub, so they cannot split (closes F-3). `outcome_verifications.dispute_reason` remains NO-ACTION
(opaque non-FK `consumer_id`).

## Gate (re-verified clean isolated, this session — at review AND re-confirmed at seal time)
apps/web `tsc --noEmit` 0 · `lint` 0 err (8 pre-existing `<img>`/react-hooks/unused-disable WARNINGS only,
none in touched files) · **`vitest run` 4572 / 197 / 0** (baseline @ `25fd6f6d` = 4566 → **+6** net new
SLICE-5 tests: decision-#1 per-row email, decision-#2 multi/dedup auth-set ×2, inArray re-key, F-4
empty-email guard, T-d DC-11 ≥2-row path-shape). The build session emitted NO self-verification evidence
digest → the integrator treated the reported green as RED and **re-ran the full gate from scratch** in a
clean isolated run (this is the durable evidence), then ran a **6× full-suite flake-characterization loop =
6/6 GREEN**. `tsc` re-run exit 0 at seal time; full suite 4572/4572 0-failed. `compliance.ts` shasum
`15df048ea7589ddeae3ecf7e6b23c04acc5937ff` (UNCHANGED at seal time). In-scope diff = `compliance.ts`
(120+/96−) + `compliance-deletion-auth.test.ts` (259+/77−) + `settlement-moat.test.ts` (8+/13−).
`packages/mcp` UNTOUCHED. `tools/page.tsx` out-of-scope (EXCLUDE at founder-close).

## Review shape
5 fresh-context, lens-distinct Opus-4.8 reviewers on the real diff + live code, all model-pinned
`claude-opus-4-8` and all self-reporting `claude-opus-4-8[1m]`:
- **L1 correctness / atomicity / determinism / idempotency** (xhigh) — CLEAN.
- **L2 disclosure-honesty DC-16/DC-11/DC-15 + scope/frozen** (xhigh) — CLEAN.
- **L3 SEAM** (xhigh) — all 7 load-bearing claims HOLD at source.
- **L4 literal-execution + test-fidelity DC-05/DC-10** (xhigh) — CLEAN; every test pin MUTATION-TESTED to RED.
- **L5 data-integrity MOAT** (operator `/effort max` session) — no defect exhibitable.

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) unavailable — no
`.claude/agents/` pool. The fan-out is MIXED-EFFORT (xhigh seal reviewers + a max core-invariant lens), so a
single workflow cannot host it; it ran as **Agent-tool spawns** (Path-2), allowlist GREEN
(git/tsc/lint/vitest/npm-test in caps; `settlegrid-discovery` MCP enabled; no WebFetch needed), env clean
(FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL all unset). Lenses 1–4 ran concurrently at the `xhigh`
session; L5 (the moat) ran as the dedicated `/effort max` pass after the xhigh tier integrated. **EFFORT
COVERAGE NOTE:** the 4 xhigh reviewers self-reported `high` (the same "can't read the knob" introspection
artifact the plan phase recorded — Agent-tool spawns inherit the xhigh session but Opus 4.8 cannot reliably
self-report its effort dial); L5 ran at the confirmed-max session and self-reported max. The real assurance
is **5-lens convergence + L4's mutation-to-RED of every test pin + L5's UNREACHABILITY proof of the
decision-#1 collision + the integrator's source-level ground-truth (greps/reads/gate re-runs)** — NOT the
self-reported labels.

## The decisive core-invariant adjudication (data-integrity MOAT, at `/effort max` + integrator ground-truth)
The one thing this build newly introduces is a NEW way to violate `UNIQUE(consumers.email)` (multi-row
anonymize) and a NEW pre-txn auth-delete SET. The max pass + the integrator adjudicated each moat invariant
and ground-truthed at source:
- **H1 — `UNIQUE(email)` collision is UNREACHABLE (decision #1, the flagged "most likely silently wrong").**
  `consumers.email` is `notNull().unique()` on the RAW value (schema:166); `consumers.id` is a
  `uuid().primaryKey().defaultRandom()` (schema:165) → a SELECT over the PK yields distinct ids → the per-row
  loop writes distinct `deleted-<id>@…` strings (no intra-batch collision). A grep of EVERY `db.insert(consumers)`
  site (auth/callback, ask/capture, academic, newsletter, conversion-events, keys, schedules, alerts) confirms
  **none organically writes a `deleted-…@deleted.settlegrid.ai` email**, so no collision against an existing row;
  and a uuid PK can never equal another row's id, so no collision against a prior-deletion row. The
  whole-txn-rollback → silent `status='failed'` the handoff feared is not reachable.
- **H2 — F-2 auth-orphan completeness HOLDS.** `supabaseUserIds` spans the dev + every matching row's
  `supabaseUserId` (read from the SAME pre-txn snapshot as `ids`), deduped via `Set`, non-null filtered.
- **H3 — F-4 over-delete-of-a-stranger is GUARDED AT THE CAPTURE.** The `norm===''` ternary gates the SELECT
  itself; the predicate is parameterized (`sql\`lower(trim(${consumers.email})) = ${norm}\``, no concat / no
  LIKE), bounded to genuine normalized-email twins (DC-13).
- **H4 — PII set-completeness vs over-scrub HOLDS.** A full consumer-FK census (exactly **9**
  `references(() => consumers.id)` FKs — matches the SLICE-4 ③ census) confirms the set version re-keys EXACTLY
  the tables the single-row version scrubbed and no more; the intentionally-frozen consumer-keyed tables
  (financial/ledger, alerts = no PII, invocations = metadata via toolId path, `outcome_verifications` = opaque
  non-FK) carry stated reasons.
- **H5 — the intermittent test flake is a TEST-RIG artifact, NOT erasure-path concurrency.**
  `processDataDeletion` holds ZERO module-level/shared mutable state (every datum is a function local or comes
  from the injected `db`); it cannot produce a real `'failed'` under concurrent invocation. The flake lives in
  the rigs' module-level mutable arrays + vitest worker scheduling; non-reproducing in isolation; characterized
  6/6 GREEN by the integrator. Pre-existing rig pattern, not introduced by SLICE-5.
- **H6/H7 — atomicity/idempotency not worsened; the accepted residuals are the only ones, not worsened.**

## Verified at source (load-bearing — ground-truthed by the integrator, NOT inspected)
- **No stale single-row refs:** `grep consumerRecord|consumerForAuth|txSelectQueue` → **0** in `compliance.ts`.
- **All 6 consumer `inArray` writes lexically inside `if (consumerMatched)`** (blocks at :599 [per-row consumers
  loop + apiKeys :638 + consumerSchedules :643 + conversionEvents :658], :713 [auditLogs :717], :760
  [toolReviews :764]); the other `inArray` sites are toolId/resourceType-keyed (developer-side), correctly gated
  separately. `inArray(col, [])` renders `sql\`false\`` (match-NONE) at the installed **drizzle-orm 0.38.4**
  (conditions.js:75–76) — so the gate is defense-in-depth, NOT an anti-"match-all" guard (no false rationale in
  code/comments).
- **`api_keys` OR-gate** = `toolIds.length > 0 || consumerMatched` literally at :852 (G-d migrated, not missed).
- **`deletedAuthUser` = `supabaseUserIds.length > 0`** (:548) drives the `supabase_auth_user` disclosure (:825)
  — not desynced (G-c).
- **The `completed` write is ONLY at the final in-txn step**; `catch → failed`; the idempotent-`completed`
  no-op short-circuits BEFORE the pre-txn capture; a `failed` retry re-resolves the same `ids` (emails
  unchanged) and re-scrubs; `deleteSupabaseAuthUser` is idempotent on 404.
- **Test fidelity:** every SLICE-5 pin was mutation-tested to RED by L4 (per-row email; dual auth-set spans;
  inArray re-key; a re-added ORDER BY; the empty-email-guard-gates-CAPTURE; the moat call-#3 bare-await) — all
  bite, none vacuous; the in-txn re-select seeding is removed from both rigs; the moat call-#3 resolves on
  bare-await `.where()`.

## Frozen-surface compliance
Diff = `compliance.ts` (the authorized consumer-twin capture/scrub/auth-set/disclosure + its comments/
docstring) + the 2 test files only. UNCHANGED: developer steps 1/1b/2b/3–8 beyond the consumer-keyed re-keys,
the status machine (pending→processing→completed|failed), the idempotent-`completed` no-op, the
`catch`→`failed`, the atomicity contract, `tools.name/slug` retention, the developer audit scrubs (steps 5 +
5c, developerId/resourceId-keyed), `organizations`/`organization_members` deferral, the `ledger_entries`
payer scrub (→ V-N3-erasure), `outcome_verifications.dispute_reason` NO-ACTION, the `data-retention` cron,
`packages/mcp`. No new table scrubbed; `retained`/`retainedUnscrubbed` unchanged; no locking/serializable
added. `tools/page.tsx` untouched (EXCLUDE at founder-close).

## Open residuals (NON-BLOCKING → carried to ③ / travel)
- **Intermittent test flake (LOW, pre-existing, NOT SLICE-5-introduced):** the SLICE-5 auth-set tests + the
  moat retry test intermittently report `'failed'` vs `'completed'` (~1/30 under full-suite CPU load). Three
  reviewers + the integrator traced it to the auth-rig's shared module-level mutable arrays (`vi.hoisted`
  `selectQueue`/`selectCalls`/…) + vitest worker scheduling — NOT erasure logic (H5). Characterized 6/6 GREEN;
  non-reproducing in isolation. Travel item: the rig's module-global mutable-array pattern is a latent flake
  source (DC-05 family). Do NOT churn the rig under seal.
- **T-f — two-row RESOLUTION + `UNIQUE(email)`-collision avoidance are CONSTRUCTION-PINNED ONLY (accepted,
  inherent):** the drizzle test doubles do NOT evaluate SQL or enforce constraints, and NO real-Postgres /
  pglite / testcontainers harness exists in-repo (L4 confirmed at repo level — the lockfile's pglite hit is
  drizzle's optional peer, not installed). The `sql.strings`/inArray/per-row-id pins catch a SOURCE regression
  but cannot exercise real two-row Postgres behavior. The durable guard is a real-Postgres integration test —
  recorded as the integration-test gap for ③.
- **F-A — pre-existing DC-14 drizzle migration/snapshot divergence (informational, out of scope):** the
  `drizzle/meta` snapshot is badly stale vs `schema.ts` (Clerk-era `consumers`, no `supabase_user_id`/
  `referral_code`). Does NOT affect any verdict (runtime executes `schema.ts`-derived DDL + the live DB; all
  H1/H2 constraints live in `schema.ts`). Travel item, not fixed here.
- **Accepted data-integrity residuals (unchanged, not worsened):** a consumer row INSERTED after the pre-txn
  capture is not part of the run (a re-run catches it); `audit_logs.consumerId` is `onDelete:'set null'` (the
  lone non-cascade consumer FK, schema:508) → a concurrent hard-delete of a sibling between capture and step-5b
  could leave its audit rows un-nulled; `trim()` strips LEADING/TRAILING only → an internal-space/NBSP twin
  still escapes. All dormant (no prod caller, no concurrent consumer-delete path). Do NOT add
  locking/serializable.
- **`tools/page.tsx` (out-of-scope tree noise) → EXCLUDE at founder-close.** A `slugify` UI change unrelated to
  GDPR erasure, present in the working tree but NOT authorized by this handoff.
- **Pre-existing:** `processDataDeletion` has NO prod HTTP caller (DORMANT — re-confirmed: only the
  `settlement/index.ts:32` re-export + tests); the `cron/data-retention` 30-day purge of `compliance_exports`
  still erases the `resultUrl` erasure-proof artifact (N4).

## Defect-class ledger
**DC-16** — the single-row `LIMIT 1` twin **under-deletion** that SLICE-4's seal + ③ routed to "an
all-rows-erasure follow-up" → **CLOSED.** The erasure now operates on the SET of all matching consumer rows,
so the `anonymized` disclosure is universally complete (not just the single-row case); the auth-delete spans
every sibling (F-2 closed); ONE pre-txn capture reused in-txn closes the F-3 split; the F-4 empty-email guard
+ the symmetric `lower(trim(email))` (the SLICE-4-③ whitespace SEAM nit) are folded in. **Process lesson
realized:** "a `LIMIT 1` slice closes the *miss* (0→1 row found) but not the *under-deletion* (N>1 rows → 1
scrubbed); the fix must operate on the SET of matching rows" — SLICE-5 IS that set-based fix. Touchpoints:
**DC-11** (paths-only — the per-row `deleted-<id>@…` value provably never reaches the manifest; pinned T-d with
≥2 rows); **DC-13** (over-scrub guard — the set is bounded to `lower(trim(email))` matches; full 9-FK census
confirms no new table); **DC-14** (no functional `lower(email)` index — the set scan is correct + intended; the
stale `drizzle/meta` snapshot F-A re-surfaced, out of scope); **DC-15** (docstring/comment sync — set-based
rewrite, no surviving single-row rationale, no false "match-all" rationale on the gate); **DC-17** (idempotent
retry — the set re-resolves on a `failed` retry); **DC-05/DC-10** (mock gained the multi-row seed + inArray/
per-row-id pins, all mutation-verified non-vacuous — but the two-row RESOLUTION + UNIQUE-collision remain
CONSTRUCTION-PINNED ONLY; durable guard = a real-Postgres integration test). **SEAM:** no NEW contradiction —
all 7 load-bearing claims HOLD (UNIQUE-raw + multi-NULL, auth-delete-can't-be-in-txn, `inArray([])`→`false`,
FK `onDelete` per table, opaque non-FK `outcome_verifications`, dormant); the SLICE-4-③ column-side-`trim()`
SEAM nit is CLOSED. **LITERAL-EXECUTION:** no imperative-without-a-tool / mis-render; every drizzle op reads
correctly as Postgres. **No NEW defect class introduced.**

## Next
HIGH-STAKES → **③ post-seal deep audit** (handoff:
`v-n3-compliance-honesty-slice5-post-seal-deep-audit-handoff-2026-06-18.md`): integrated-whole audit (the
diff-scoped ② cannot see adjacent untouched surfaces), with a dedicated `/effort max` DC-16 claim-honesty
cross-surface census, a re-confirmation of the consumer-keyed-PII deletion-surface census (now that the
erasure is set-based), the construction-pin / real-Postgres integration-test gap as a tracked input, and a
collective-miss critic. Founder-close is a single path-scoped LOCAL commit (`compliance.ts` + the 2 test
files + the slice-5 docs; **EXCLUDE `tools/page.tsx`**) bundled after ③; `/push-go` is a separate explicit
gate.
