# containment-hardening — ② SEAL record — 2026-07-02

> **Chunk:** `containment-hardening` · **Closes launch-gate blockers:** **G4-3** (auth limiters fail-open) + **G4-4** (no-rollback DDL substrate / money-column drift) · **Tier:** **HIGH-STAKES** (NOT escalated — realized diff matched the plan) · **Seal:** operator `/seal-go` 2026-07-02, explicit-pathspec commit (see git log), **UNPUSHED** (push gated on `/push-go`).
> **Base:** local `main` HEAD `c32c9293` (billing-correctness G3-5 ② seal) = `origin/main`. Disjoint files from every other track.
> **Handoff (build spec + folds):** `docs/tech-debt/containment-hardening-handoff-2026-07-02.md`.

---

## 1. What was sealed (the diff)

**G4-3 — flip 5 credential-brute-force `checkRateLimit` call-sites fail-open → fail-closed** (`{ failMode: 'closed' }`, per-call-site, additive; a store REJECTION now blocks instead of silently allowing):
- `apps/web/src/app/api/auth/mfa/route.ts` — `mfa-verify` ip (`:119`) + uid (`:132`) (TOTP-code verify PUT).
- `apps/web/src/app/api/tools/claim/route.ts` — `tools-claim` ip (`:65`) + uid (`:100`).
- `apps/web/src/app/api/gate/route.ts` — `gate:${ip}` (`:26`, pre-auth, one bucket — §6 FOLD 1, the 3-lens-convergent missed surface).
- Each site carries the LBD-2 residual comment (rejection-path-only; a HANGING store still fails OPEN via Upstash's built-in 5s timeout race) with a per-surface backstop rationale (mfa→GoTrue throttle, claim→192-bit entropy, gate→no backstop but recoverable + removed at launch).
- **Frozen-open kept open (verified untouched):** `account-delete` both buckets (Art.17 GDPR never-block), all LLM/cost paths (`/api/ask*`, `/api/chat`), `mfa-status`/`enroll`/`unenroll`.

**G4-4 — money-column drift tripwire (DC-14)** on the no-rollback `drizzle-kit push` substrate:
- `apps/web/src/lib/db/money-schema-manifest.ts` (NEW) — 13 load-bearing money columns + 2 value-range CHECKs (`ledger_entries_amount_positive`, `ledger_entries_take_cents_nonneg`) + the `payouts_one_processing_per_dev` partial-unique mutex (name + predicate).
- `apps/web/src/lib/db/money-schema-check.ts` (NEW) — `verifyMoneySchema(db)` introspects `information_schema.columns` + `pg_constraint` + `pg_indexes`, returns `SchemaDrift[]` with drizzle↔information_schema default/type/nullability NORMALIZATION (§6 FOLD 7).
- `apps/web/src/instrumentation.ts` — wired into `register()`: nodejs + prod only, DYNAMIC import inside the guard (FOLD 3), fire-and-forget with a self-contained try/catch (FOLD 4), once-per-warm-instance; DRIFT → `logger.error('schema.money_column_drift')` (pages), CHECK-FAILED → `logger.warn('schema.check_unavailable')` (non-money-loss, FOLD 5), never throws.
- `apps/web/src/lib/logger.ts` — `'schema.money_column_drift'` added to `MONEY_LOSS_KEYS` (pages); `'schema.check_unavailable'` deliberately excluded.
- Tests: `lib/db/__tests__/money-schema.test.ts` (NEW, 27) + `api/__tests__/credential-limiters-fail-closed.test.ts` (NEW, 3) + one `it.each` paging case in `lib/__tests__/logger.test.ts`.

**② fold (LOW):** `apps/web/src/lib/rate-limit.ts` — corrected the now-stale `checkRateLimit` doc comment ("(none do today; hook only)" → names the 5 G4-3 fail-closed surfaces + the hang residual). The one file beyond the handoff §9 pathspec — comment-only, zero behavior change, staleness directly caused by this chunk.

**No migration** — `drizzle/` and `schema.ts` untouched; `drizzle-kit` not run.

---

## 2. Review provenance (② seal-gating)

5 lens-distinct fresh-context reviewers, all `claude-opus-4-8[1m]`, driving the REAL diff + live code, coverage-mode:
- **4× xhigh-tier Agent-tool Path-2 spawns** (batched concurrent): G4-3 fail-mode/scope-precision · G4-4 drift-correctness/spec-conformance · **SEAM** · **literal-execution/test-teeth**. (Reviewer A's first spawn returned empty — recovered by one re-spawn.)
- **1× max-session core-invariant pass** (operator `/effort max`, Path-2 sequential-after) over the FIXED moat — dual purpose: the fresh re-review of the fix class + the high-stakes core lens.
- **Integrator (main session):** reproduced every HIGH/MED fail-then-pass, discharged FOLD 12 (both teeth sets live), byte-verified every fix against the real migration SQL + the postgres-js driver shape, ran the gate at every stage.

**Effort report-back caveat (recorded):** all 5 reviewers self-reported effort "high" — the model self-report is policy-flagged unreliable (it is NOT credited as ground truth). The max-tier core assurance rests NOT on the self-report but on: the max pass's corroborating depth (~2× the xhigh lenses' tokens/duration, max-tier analysis), the main-session (operator-confirmed `/effort max`) byte-verification, and the pending high-stakes ③ integrated re-certification.

**Orchestration:** Agent-tool spawns (NOT a workflow) — a `max` core-invariant lens forces the mixed-effort fan-out onto Agent-tool Path-1/2, mutually exclusive with a single-effort workflow. Path-1 pool absent (no `.claude/agents`) → Path-2 (xhigh fan-out at session effort + operator `/effort max` sequential core pass). Allowlist GREEN (reviewers Read/Grep only; gate foreground main session). Env traps unset (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL).

---

## 3. Findings + dispositions

**One HIGH + two MED — all FIXED with live fail-then-pass reproduction; zero HIGH/MED open at seal.**

### HIGH — G4-4 index-predicate assertion was VACUOUS (DC-24 recurrence)
`money-schema-check.ts` matched `predicateContains` (`['processing','unknown']`) against the WHOLE `pg_indexes.indexdef`, which EMBEDS the index name `payouts_one_processing_per_dev` — itself containing the substring `processing`. So `def.includes('processing')` was **always true regardless of the real WHERE predicate**. A `drizzle-kit push` recreating the mutex as `WHERE status = 'unknown'` (drops `'processing'`, keeps `'unknown'`) → both literals "present" → **zero drift, no page** → the payout double-pay hole (two concurrent `'processing'` payouts per dev) reopens silently. This defeats §6 FOLD 10's whole purpose (assert the PREDICATE, not the name) on the PRIMARY mutex invariant.
**FIX:** isolate the WHERE-clause before matching — `const whereAt = def.search(/\bWHERE\b/i); const predicate = whereAt >= 0 ? def.slice(whereAt) : ''` — so the name can never satisfy a predicate literal; a non-partial (no-WHERE) drift → empty predicate → both literals missing → correct drift.
**Repro:** new test "loses 'processing'" RED against buggy bytes → GREEN after fix. Max pass re-validated both directions vs the real drizzle/0010 rendering (`WHERE "status" IN ('processing','unknown')`).

### MED — `take_cents_nonneg` money-invariant CHECK cited but unguarded
The manifest justified including `ledger_entries.take_cents` partly for its nonneg CHECK, but `MONEY_CHECKS` held only `amount_positive`. A push dropping `ledger_entries_take_cents_nonneg` (schema.ts:998-1000; migrated drizzle/0005:155 — identical provenance to amount_positive) → a negative `take_cents` corrupts the reconciliation SUM silently.
**FIX:** added it to `MONEY_CHECKS` (`definitionContains: ['take_cents >= 0']`, anchored) + a clean-fixture row + a drop test. Value-range CHECKs on guarded cents columns is the principled inclusion boundary (tax-pairing / bps-range / status-enum CHECKs are a different invariant class, documented excluded). No incremental prod false-page risk — same drizzle/0005 provenance as the already-shipped amount_positive.
**Repro:** drop test RED → GREEN after fix.

### MED — `<> 0` false-passed the `> 0` substring
`definitionContains: ['amount_cents', '> 0']` — a weakened `CHECK (amount_cents <> 0)` (permits negatives) renders the substring `<> 0`, which contains `> 0` → false-pass.
**FIX:** anchored to the operand `['amount_cents > 0']`; `<> 0`/`>= 0`/`> -1` weakenings no longer contain it → all detected.
**Repro:** `<> 0` test RED → GREEN after fix.

### LOWs — recorded, dispositioned, none an active defect
- rate-limit.ts:46 stale comment (SEAM, me + reviewer C) → **② fold FIXED** (comment).
- `referrals.total_earned_cents` (creditReferralCommission counter) + `outcome_verifications.settled_price_cents` — reviewer-flagged as unnamed in the exclusion rationale; both CONFIRMED not-a-live-owed-balance (no reconciliation/payout/ledger read) → correctly excluded under existing categories (denormalized-rollup / price-record); **name explicitly in a future touch** (③ roadmap) if a payout is ever wired to them.
- CHECK-introspection query lacks `contype='c'`/`connamespace` scoping (asymmetric with the index query) — theoretical (single public schema, table-prefixed names) → ③ roadmap.
- Additive CHECK weakening (`(x>0) OR (bypass)`), superstring literal (`'unknownx'`), COALESCE-default edge in `normalizeLiveDefault` — all NOT realistic `drizzle-kit push` outputs → informational.
- Test fragilities: `makeDb` by-call-order coupling; teeth-A `spec.col` not bound to `spec.table` (overlapping-shape columns); `MONEY_COLUMNS.length` locks count-not-identity; ip/uid masking vector (both buckets fail-closed) — all latent-only (no active false-green on current bytes) → ③ roadmap.
- mfa-verify comment slightly overstates the threat (PUT is enrollment-activation, not login step-up — login MFA is client-side GoTrue); GoTrue external backstop is asserted-not-versioned; SENTRY_DSN must be set in prod for the drift to page — all §P/awareness.

**Load-bearing confirmations (moats HOLD at max scrutiny):** G4-3 flip is per-call-site and cannot perturb shared-limiter co-tenants (account-delete Art.17 safe); block behavior correct on all 3 store outcomes; hang residual honest. G4-4 detects the full realistic drift space (column drop/rename/retype/nullability/default, CHECK drop/weaken, index drop/predicate-drop) with correct normalization; zero-drift-on-healthy-prod holds (all 13 specs match schema.ts; teeth-A enforces manifest==schema.ts at CI); postgres-js RowList driver shape matches the checker cast (no boot false-page); paging wiring byte-exact.

---

## 4. Evidence (integrator-verified, this session)

- **Seal-time gate — clean isolated run, cwd=`apps/web` (= web-ci):** `tsc 0 · lint 0 (0 errors) · vitest 225 files / 5143 passed / 0 skip / 0 fail`.
- **Reconciliation:** 5112 baseline (HEAD c32c9293) → build +28 (money-schema 24 + credential 3 + logger 1) = 5140 → ② fix **+3** money-schema teeth (loses-'processing' + `<>0` + take_cents-drop) = **5143**. Files 225 (build +2 test files vs 223 baseline; ② +0 new files). No migration.
- **Live fail-then-pass** reproduced for the HIGH + both MEDs.
- **FOLD 12 dual teeth reproduced live:** G4-3 — reverting the mfa-ip `failMode` logged `rate_limit.fail_open` → mfa test 401≠429 RED while claim/gate stayed `fail_closed` GREEN; restored. G4-4 — manifest `developers.balance_cents` default 0→5 → teeth-A RED (manifest≠schema.ts); restored.
- **Fixes verified vs ground truth:** predicate isolation ↔ drizzle/0010 `WHERE status IN ('processing','unknown')`; both anchored CHECKs ↔ drizzle/0005 renderings; driver RowList ↔ checker cast.

---

## 5. Residuals — NOT code-closeable this seal (route to §P / ③)

- **§P live-prod-schema verification** (the unit tests MOCK introspection — they prove manifest↔schema.ts, NOT manifest↔live-prod): before trusting the tripwire, confirm all 13 columns + BOTH CHECKs + the index-with-predicate exist in the live prod DB. Both CHECKs share drizzle/0005 provenance; the index prod-presence + predicate already operator-verified 2026-06-30 (roadmap §P:137). The check only PAGES (never throws/blocks), so a first-boot false-page (if a guarded object were absent) is loud + recoverable, not an outage.
- **§P** GATE_PASSWORD set in prod? (gate flip is the highest-value credential surface if the beta wall is active; harmless/inert if permanently unset) · SENTRY_DSN present in prod (else a real drift logs a stderr line but does NOT page) · Supabase-Auth rate-limit confirmed note (F7 — no login/reset code route to flip).
- **③ roadmap:** name total_earned_cents / settled_price_cents in the exclusion rationale; CHECK-query contype/namespace scoping; the test-fragility notes (makeDb order-coupling, col↔table binding, count-not-identity, ip/uid masking).

---

## 6. Defect-class ledger recurrences (filed LOCAL)

- **DC-24 (false-green / toothless-control) — ② recurrence:** the vacuous index-predicate check — a control that ADVERTISED asserting the mutex predicate but, executed literally, could never fail on the primary literal (the index name contained it). Sibling: the `<> 0` superstring false-pass. Detection cue reinforced: **a substring-match control must match against the ISOLATED semantic region (the WHERE predicate / the operand), never the whole rendered object whose name/structure can satisfy the literal.**
- **LITERAL-EXECUTION recurrence (standing lens):** `def.includes('processing')` does EXACTLY what it says when executed literally (the name contains 'processing') — the imperative was sound, the CHOICE of match target was wrong. Cue: for any `.includes(literal)` guard, ask "what ELSE in this string contains the literal for a non-semantic reason?"
- **SEAM recurrence (standing lens):** rate-limit.ts:46's "(none do today)" contradicted its own 5 new call-sites in the same working tree (a primitive's doc drifting from its callers the moment the callers land). Cue: when a change creates the FIRST users of a previously-dormant option, grep the primitive's own doc for "none/never/no caller/today".
- **DC-08 (implicit-wrong-fail-mode) — CONFIRMED CLEAN** (the G4-3 class): the flip landed on exactly the surfaces where blocking-on-outage is the right tradeoff; no false recurrence.
- **DC-14 (schema-db-migration-divergence) — the G4-4 charter:** the tripwire now genuinely guards the full realistic drift space after the HIGH fix.

---

## 7. Next

**③ post-seal deep audit** (high-stakes-warranted) — integrated-whole re-certification of the sealed bytes in the context of the money rails + the schema substrate. Then `/push-go` (separate gate) for the local commits.
