# V-N3-deletion-cascade-correctness — ② SEAL-GATING REVIEW RECORD — 2026-06-25

**Verdict: CLEAN SEAL (review PASSED).** Gate green, zero high/medium-severity findings open, reviewers' evidence supports it. One HIGH finding was found, reproduced RED→GREEN, fixed, and re-reviewed clean during this review. **Claude cannot self-seal — awaiting operator `/seal-go` to commit.**

Tier: **HIGH-STAKES** (re-confirmed against the realized diff — not escalated; see §6). Doc-of-record for the build: the handoff `docs/tech-debt/v-n3-deletion-invocations-cascade-correctness-handoff-2026-06-25.md` (§0–§11).

---

## 1. Scope reviewed (the built diff)
In-scope (the chunk — to be staged at `/seal-go`):
- `apps/web/src/lib/settlement/compliance.ts` (revoke-not-delete steps 2-3 + §4 disclosure + ② fix) — +99/−… 
- `apps/web/src/lib/__tests__/compliance-deletion-cascade.integration.test.ts` (NEW — pglite keystone, 2 tests)
- `apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` (mock-suite revoke conversion + step-3 pin)
- `apps/web/src/lib/__tests__/compliance-honesty-regression.test.ts` (source-text pins + ② metadata pin)
- `apps/web/src/lib/__tests__/settlement-moat.test.ts` (stub + delete-count pins)
- `apps/web/package.json` (@electric-sql/pglite devDep + benign alpha-reorder of @settlegrid/*)

Final in-scope diff stat: **5 modified + 1 new; 262 insertions / 39 deletions.**

**EXCLUDE from the commit (carry-forward, NOT this chunk):** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (slugify auto-fill). `.claude/` (local-only, untracked), `.audit/` (gitignored — the DC-16 ledger update stays local), `.env*` per the repo standing order.

**`package-lock.json` — INCLUDED (correction to the pre-seal note).** Investigation at `/seal-go` showed the lock diff is the pglite addition PLUS a drift-correction (`@settlegrid/cli`→`settlegrid` 0.2.0, `@settlegrid/mcp` 0.3.0, an `extraneous` cleanup) — and those workspace versions are ALREADY committed in HEAD (`packages/settlegrid-cli`/`packages/mcp` package.json unmodified). The old committed lock was STALE; the pglite `npm install` re-synced it, so committing the full lock is correct (keeps `npm ci` consistent), not carry-forward. (The earlier "exclude lock churn" note was a surface read, now corrected.) The sealed commit bundles the 6 code/test files + `package.json` + `package-lock.json` + the 3 docs/tech-debt artifacts = 10 files, +718/−47.

## 2. Build-evidence check (→ RE-RAN FROM SCRATCH)
No discoverable build-evidence artifact (no build-report file, no interval self-verify digest, no manifest) — per the ② rule an evidence-free green is treated as **RED**. The gate was therefore re-run from scratch in a clean isolated run (this session), which is the authoritative result below.

## 3. Gate (clean isolated re-run, post-② fix)
From `apps/web`: `npx tsc --noEmit` → **0**; `npm run lint` → **0 errors** (1 pre-existing unrelated warning, academy-lessons.test.ts); `npx vitest run` → **208 files / 4753 tests pass**. The pglite integration test genuinely executed (real wasm-Postgres spun up, 3.6s — non-vacuous, not a 0ms skip). Pre-fix baseline was 4752; +1 from the ② metadata regression pin.

## 4. Review fan-out (Agent-tool spawns — Path-1 unavailable forced this)
Mixed-effort fan-out needed (max core-invariant + xhigh reviewers). **PATH 1 unavailable** — no `.claude/agents/` effort-bearing subagent definitions exist, and a running agent cannot self-author one mid-run and rely on load. A single workflow cannot realize mixed effort either → **Agent-tool spawns** (model `claude-opus-4-8`, inheriting session effort **xhigh**, `CLAUDE_EFFORT=xhigh` verified). Env clean (no FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL override). Allowlist GREEN (tsc/vitest/lint/git/grep present). Operator chose (AskUserQuestion) **xhigh-now + defer the max core-invariant pass to ③** (the recommended option; ③ is the designated home for the max-tier core-invariant pass).

Six lens-distinct, fresh-context, hostile reviewers in coverage mode (all reported running on `claude-opus-4-8[1m]`; all self-reported effort "high" = the known Opus introspection under-report — actual session dial xhigh):
1. **Core-invariant / data-integrity** — invariant HOLDS. Proven by **live mutation** (reviewer reverted step 2 to `tx.delete(apiKeys)` → integration test FAILED, foreign-tool invocation cascade-killed → restored). All 3 cascade vectors into `invocations` independently inert (apiKey revoked; consumer/tool anonymized-not-deleted). 5 auth paths + a 6th (developerApiKeys/publish) reject `status!=='active'`.
2. **Spec-conformance** — F1–F7 all CONFIRMED implemented exactly (F5 = the sanctioned deviation, see §5). No deferred/frozen surface pulled in; no gold-plating. Flagged the two carry-forward files (§1).
3. **Correctness/determinism** — empty-array inArray gated safely (drizzle `inArray(col,[])`→`sql\`false\``; both call sites gated); revoke idempotent; disclosure gating correct; new test pins non-tautological; integration test deterministic. Surfaced the metadata finding (§5).
4. **SEAM** — all 9 load-bearing claims CONFIRMED at source (keyHash/keyPrefix NOT NULL + keyHash UNIQUE; ipAllowlist nullable jsonb; status free-text accepts 'revoked'; no 6th admitting auth path; revokedAt absent on apiKeys; migrations stale / FK byte-identical; developerApiKeys leaf; tools/consumers anonymized). Ruled the single-bucket *string* invariant holds but flagged the substantive metadata-honesty breach (§5).
5. **Literal-execution** — `.set()` typechecks; pushSchema+res.apply() materializes 37 tables incl. the FK with delete_rule=CASCADE (verified via throwaway probe); the FK `LIKE '%invocations%api_key%'` matches exactly ONE constraint deterministically; all `region()` markers uniquely bracket their spans (non-vacuous). Noted `status` is `text` not enum (a typo would compile — pinned by tests; schema migration is OUT of scope).
6. **DC-16 disclosure-honesty** — ruled the metadata finding a REAL DC-16 false-claim + comment-accuracy defect (§5); all other honesty checks PASS (no banned legal conclusion, no "PII-free", frozen payer sentence verbatim, paths-not-values, single-bucket).

## 5. Findings triage
### SUSTAINED — HIGH — FIXED + re-verified during this review
**`invocations.metadata` disclosure honesty gap** (3 independent lenses: correctness, SEAM, DC-16). Step 4 nulls `invocations.metadata` only on the subject's OWN tools; revoke-not-delete now makes FOREIGN-tool invocation rows survive with `metadata` un-scrubbed — and that metadata can hold the captured on-chain payer (the subject's own EVM address). The disclosure listed `invocations.metadata` solely under `anonymized` (a "scrubbed" claim) while a code comment (`:977-980`) claimed the retention was "covered in retainedUnscrubbedNote prose only" — but the note never named metadata. So a column reported anonymized was retained-on-foreign-rows and disclosed nowhere; the comment was false.
- **RED→GREEN reproduction:** added a regression pin to `compliance-honesty-regression.test.ts` (the note must disclose foreign-tool metadata retention) → ran RED against the built code → applied the fix → ran GREEN.
- **Fix (prose/comment only — no logic change; single-bucket preserved):** extended BOTH `retainedUnscrubbedNote` branches with a metadata-retention clause ("invocations.metadata is nulled (step 4) only on the subject's own tools, so on other developers' tools it is retained un-scrubbed and may hold the captured on-chain payer (the subject's own EVM address) and free-form caller context — still personal data, not erased"); the `:977-980` comment is now true; docstring corrected to "surviving own-tool rows" + foreign-tool metadata pointer; stale `anonymized` api_keys "deleted"→"revoked" comment corrected.
- **Fresh DC-16 re-review of the fix:** items 1–10 PASS — honest + complete, no banned legal/scrub language (resultUrl BANNED_LEGAL_CONCLUSIONS + docstring BANNED_COMPREHENSIVE_SCRUB both clean), single-bucket preserved (metadata still in `anonymized` array only — prose-only foreign-tool disclosure), frozen payer sentence verbatim, comment now true, new pin non-vacuous (anchored to the new text), no new self-contradiction.

### OPEN — LOW — noted, routed to ③ (do not block the seal; conservative direction; DORMANT function)
- **F1** (MED-conf/LOW-sev): the note's invocation sentence is unconditional while the `retainedUnscrubbed` array entries are gated on `consumerMatched` → for a no-twin subject the note describes retention/step-2 pseudonymization that didn't occur. Over-discloses retention, never claims false erasure; parallels the accepted unconditional `organizations.billing_email` note treatment. Not fixed at ② to avoid churning the frozen note string (+ the verbatim-payer-sentence and runtime pins) for a low-sev nit; routed to ③ as a disclosure-precision candidate (gate the note clause on `consumerMatched`, or general-phrase it).
- **F2** (LOW-conf/LOW-sev): the metadata clause doesn't condition on `INVOCATIONS_PAYER_MINIMIZE_ENABLED` (live in prod) — but the "**may** hold the captured on-chain payer" hedge is accurate whether or not the flag minimized the payer. Reviewer confirmed "not a falsehood." Note only.

### NOTED — no fix (per-design or out-of-scope)
- Integration test de-auth assertion (iv) is data-state-only ("assert the gate" = the explicit **F2** design choice); all 6 lenses independently confirmed the 5 auth paths reject `status!=='active'` live.
- Integration test doesn't isolate step 3 (KEY_OWN is also consumerId-keyed) — covered at the mock level by the new toolId-keyed revoke pin (F6).
- `apiKeys.status` is `text` not a pgEnum (a typo literal would compile) — pre-existing schema design; schema migration is OUT per §6; the exact literal is pinned by source-text + runtime tests.
- Mock revoke pins key on `vals.status==='revoked'` not table identity — mandated by F6 (the update-mock doesn't record the table arg); selective today; the cascade-safety leg keys on real table identity.

### ② RULING on the build's flagged F5 deviation: **ACCEPTED**
The build materialized the pglite schema via `drizzle-kit pushSchema` from `schema.ts` (not the `drizzle/*.sql` migrations F5 named), flagging it "for ②". Reviewers independently verified the justification at source: only 3 of 18 migrations tracked in `drizzle/meta/_journal.json`; migrations stale vs schema.ts (`developers` has `clerk_user_id`, lacks `slug`/`supabase_user_id`/…); no `db:migrate`/`db:push` script; `drizzle.config` points at schema.ts; and the load-bearing api_key→invocation FK `ON DELETE CASCADE` is byte-identical in schema.ts:325-327 and migration 0000:260. The test validates schema/migration INTENT (non-vacuous: structural FK delete_rule=CASCADE + behavioral raw-DELETE cascade gate), not live-prod-DDL parity. Residual (DC-14 prod-DDL parity not proven by this test; "prod uses push" inferred not script-proven) is appropriately documented in the test docstring and cannot mask the cascade. ACCEPTED as the ② ruling.

## 6. Tier re-confirmation
HIGH-STAKES holds, not escalated: shipped GDPR-deletion behavior on a PII/compliance + financial-record boundary; new invariant "invocations survive deletion"; DC-16 disclosure surface; correctness-critical test infra. The realized diff touched no additional frozen surface and opened no new input boundary beyond what the handoff predicted (the function remains DORMANT — zero prod callers, re-verified).

## 7. Defect-class ledger updates
- **DC-16** (public-claim content integrity): NEW instance — the `invocations.metadata` foreign-tool retention reported as `anonymized` with the retention disclosed nowhere; caught at ② by the correctness/SEAM/DC-16 lenses, fixed in-review. Recurrence note: the **SEAM single-bucket check passed at the string level while the substantive honesty failed** — the string-uniqueness invariant is necessary but not sufficient; future disclosure reviews must check column-granular partial scrub (own-tool nulled vs foreign-tool retained) against the bucket claim, not just path-uniqueness.
- **DC-15** (plan/handoff/comment drift): minor instance — the `anonymized` api_keys comment + docstring "surviving rows" drifted from the realized revoke behavior; corrected in-review.

## 8. Policy line
Applied. Tier high-stakes (not escalated). Effort: xhigh fan-out (Agent-tool Path-1-forced spawns); max core-invariant pass deferred to ③ per operator choice — recorded as a deliberate coverage decision, NOT a silent gap. Allowlist GREEN. Model `claude-opus-4-8` (config-dir pin is `opus[1m]` — SessionStart WARN; this session ran on Opus 4.8; recommend repinning to the full id `claude-opus-4-8` to avoid a restart downgrade).

## 9. Seal decision
**CLEAN SEAL — PASSED, then SEALED + COMMITTED at operator `/seal-go` (2026-06-25).** Local commit on `main` (this commit); `tools/page.tsx` excluded; `.claude/`/`.audit/` not committed; gate re-confirmed green immediately before commit (tsc 0 / lint 0-err / vitest 208f / 4753; integration test executed). **NOT pushed** — `/push-go` is the separate explicit push gate. Next: ③ (post-seal deep audit, HIGH-STAKES) — handoff `docs/tech-debt/v-n3-deletion-cascade-correctness-postseal-deepaudit-handoff-2026-06-25.md` (carries the deferred max core-invariant pass + F1/F2 LOWs).
