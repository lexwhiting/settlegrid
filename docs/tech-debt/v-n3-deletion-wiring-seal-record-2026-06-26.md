# V-N3-deletion-wiring — ② SEAL-GATING REVIEW RECORD — 2026-06-26

**Verdict: CLEAN SEAL (review PASSED).** Gate green; zero HIGH-severity findings open; reviewers'
evidence supports it. One HIGH was found, reproduced RED→GREEN, fixed, and re-verified during this
review; four MED were fixed; one MED (re-run disclosure under-disclosure) was consciously ACCEPTED by
the operator and ledgered to ③ — the hard moat (no PII escape, no fail-open, data fully erased) is
intact. **Claude cannot self-seal — awaiting operator `/seal-go` to commit (path-scoped, EXCLUDING
`tools/page.tsx`).**

Tier: **HIGH-STAKES** (re-confirmed against the realized diff — not escalated; the diff opened the
destructive deletion boundary + touched the sealed `processDataDeletion` exactly as the §13 plan
predicted). Doc-of-record for the build: `docs/tech-debt/v-n3-deletion-wiring-handoff-2026-06-25.md`
(§0–§13 BINDING).

---

## 1. Scope reviewed (the built diff)
In-scope (to be staged at `/seal-go`):
- **NEW** `apps/web/src/app/api/dashboard/developer/account/route.ts` + `__tests__/route.test.ts` (the endpoint + 18 tests)
- `apps/web/src/lib/settlement/compliance.ts` (F-B1 pre-commit + status-machine docstring + `anonymizedNote` + ② fixes)
- `apps/web/src/app/api/cron/data-retention/route.ts` (recovery re-driver + ② compare-and-set fix)
- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` (UI wire: real fetch + step-up password field + sign-out redirect)
- `apps/web/src/lib/email.ts` (banner reword) ; `apps/web/src/app/docs/page.tsx` (FAQ "deleted"→"revoked" census)
- `apps/web/src/lib/__tests__/compliance-deletion-cascade.integration.test.ts` (F-B1 forced-rollback non-vacuity test)
- `apps/web/src/lib/__tests__/compliance-honesty-regression.test.ts` (honesty pins + ② fail→pass pins)
- `apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` (step-8 disambiguation for the new pre-commit tools-delete)
- `docs/tech-debt/v-n3-erasure-enable-runbook-2026-06-20.md` (citation → semantic anchor, §13.12)
- the build handoff + **this seal record** + **the ③ handoff** (docs/tech-debt)

**EXCLUDE from the commit (carry-forward, NOT this chunk):** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`
(slugify auto-fill — unrelated; confirmed no shared symbols/imports with the deletion change). `.claude/`
(local, untracked), `.audit/` (gitignored — the DC ledger update stays local).

## 2. Build-evidence check (→ RE-RAN FROM SCRATCH)
No discoverable build-evidence artifact (no build-report file, no interval self-verify digest, no manifest).
Per the ② rule an evidence-free green is treated as **RED** → the gate was re-run from scratch in clean
isolated runs (this session), **twice** (pre-fix baseline + post-fix). Those are the authoritative results.

## 3. Gate (clean isolated re-run, post-② fixes)
From `apps/web`: `npx tsc --noEmit` → **0**; `npm run lint` → **0 errors** (pre-existing unrelated warnings
only); `npx vitest run` → **209 files / 4780 tests pass**. The pglite F-B1 forced-rollback integration test
genuinely executed (real wasm-Postgres spun up, ~2s — non-vacuous, not a 0ms skip). Pre-fix baseline 4778;
**+2** from the ② regression pins (the audit-row PII pin + the docstring-scoping pin).

## 4. Review fan-out (Agent-tool spawns — Path-1 unavailable forced this)
Mixed-effort needed (max core-invariant + xhigh reviewers). **PATH 1 unavailable** — no `.claude/agents/`
effort-bearing subagent definitions exist, and a running agent cannot self-author one mid-run and rely on
load. A single workflow can't realize mixed effort either → **Agent-tool spawns**, model `claude-opus-4-8`.
Env clean (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL all UNSET); session xhigh (settings verified).
Allowlist GREEN (Read/Grep/Glob + `tsc`/`vitest`/`git` Bash). Operator chose **Path 2** (xhigh fan-out +
integrate, then a `/effort max` core-invariant pass).

**Tier 1 — 6 lens-distinct xhigh reviewers** (all `claude-opus-4-8[1m]`; all self-reported effort "high" =
the known Opus introspection under-report; actual session dial **xhigh**):
1. **Correctness/determinism** — surfaced the cron stale-reset TOCTOU, find-or-reuse true-concurrency, the disclosure non-idempotence, poison-pill cap-starvation.
2. **Spec-conformance/scope** — CONFIRMED F-B1 placement (own txn, after `toolIds` capture, reuses captured ids/toolIds, both gates, status-only tools), frozen surfaces intact, NO tier gate, self-scope, no scope creep/gold-plating; surfaced the **audit-IP/UA HIGH** + the `tools/page.tsx` exclusion.
3. **SEAM** — all load-bearing claims CONFIRMED at source (proxy `maxDuration=90`; both-gate necessity; SDK key-gate closes the meter paths; step-1 email format matches the non-vacuity collider; step-up no-session-persist).
4. **Literal-execution** — surfaced the **"DEACTIVATED, not live" overstatement** (3 sites) + the **`logRetentionDays=0` note overstatement**; all other prose↔code claims MATCH.
5. **DC-16 honesty** — independently surfaced the **audit-IP/UA HIGH** + both overstatements; confirmed the email/docs rewords honest, the `anonymizedNote` bound honest, no banned legal conclusion.
6. **DC-03 security + DC-08 fail-mode** — destructive boundary SOUND (auth/self-scope/CSRF same-origin/step-up-for-password/info-leak/no "success-while-live"); surfaced the **OAuth-only step-up gap** + the daily-cron recovery latency + no recovery-test.

**Tier 2 — core-invariant lens at `effort=maximum`** (operator `/effort max`, Path 2; subagent self-reported
`effort=maximum`, inheriting the operator-set max session — a legitimate max pass): the **hard moat CONFIRMED
intact** (every `invocations` insert path gates on `api_key.status`/`tool.status`, both pre-committed;
`apiKeys.consumerId`/`toolId` NOT NULL kills the hypothesized null-consumerId escape; `completed` set only
inside the scrub txn; revoke-not-delete preserves the FK target; self-scope on `auth.id`). It **refuted** that
FIX 4 fully closed the disclosure non-idempotence — the deeper root remains (see §5, accepted MED).

## 5. Findings triage

### SUSTAINED — HIGH — FIXED + re-verified (BLOCKER, now closed)
**Audit-log IP/UA re-introduction** (DC-16; converged across spec-conformance + DC-16 lenses). The completion
`writeAuditLog` (route.ts) passed the erased developer's real `x-forwarded-for` IP + `user-agent`;
`writeAuditLog` (audit.ts) persists both; it runs AFTER `processDataDeletion`, so step-5's audit-scrub (inside
the already-committed scrub txn) never covers it → a surviving `audit_logs` row keyed to the anonymized
`developerId` carries the subject's real IP + UA, **falsifying** the frozen `anonymized:['audit_logs.ip_address',
'audit_logs.user_agent','audit_logs.details']` disclosure claim **and** the public docs "audit-log IP addresses
are removed" (docs:615/635). Same class §13.2 forced fixing for `invocations.metadata`, but **systematic** (every
deletion) and undisclosed.
- **RED→GREEN (live-demonstrated this session):** added a route.test pin (the completion audit call carries no ip/ua/details); ran it RED against the built code (the call carried `203.0.113.7`) → applied the fix → GREEN.
- **Fix:** the completion audit write records ONLY the non-PII completion event (`developerId` + `action` + `resourceType` + `resourceId`); no `ipAddress`/`userAgent`/`details`. The `anonymized: audit_logs.*` claim + the docs claim are TRUE again.

### SUSTAINED — MED — FIXED + re-verified
- **"DEACTIVATED, not live" overstatement** (DC-16/DC-08; literal-exec + DC-16). The status-machine docstring + the route fail-mode comment + the cron comment claimed a 'failed' deletion always leaves the account DEACTIVATED — false for a failure BEFORE the F-B1 pre-commit (the pre-txn auth-delete / capture throws → account still live). **Fix:** scoped the claim in all 3 sites (docstring edit §13.3-authorized) + a new honesty pin (`/still LIVE/` — fail→pass).
- **`anonymizedNote` "retained until purged" overstatement** (DC-16). The cron purge is gated `logRetentionDays > 0`; for a keep-forever (0) tool owner the in-flight residual metadata is never purged. **Fix:** qualified the note ("or kept indefinitely where the tool owner's log-retention is set to keep-forever") + a new honesty pin (`/keep-forever|indefinitely/` — fail→pass).
- **Cron reset UPDATE unguarded (TOCTOU)** (DC-17). The stale-`processing`→`failed` reset had no `AND status='processing'` → could revert a row that completed between the batch SELECT and the UPDATE. **Fix:** compare-and-set (`and(eq(id), eq(status,'processing'))`).

### SUSTAINED — MED — ACCEPTED (operator decision) + LEDGERED → ③ (NOT a blocker; hard moat intact)
**Re-run disclosure under-disclosure** (DC-13/DC-16/DC-17; core-invariant **max** lens). `processDataDeletion`
recomputes `consumerMatched`/`deletedAuthUser` from the LIVE developer row each call; a re-run that observes an
already-anonymized developer (cron re-driving a legitimately-`failed` row after a retry's second row completed
the scrub; or a rare reused-pending row concurrently re-driven) computes them `false` → persists a **degraded
`resultUrl`** omitting the `retainedUnscrubbed` foreign-tool clause, **under-disclosing** pseudonymized linkage
(`invocations.consumer_id/api_key_id/session_id/referral_code` on other developers' tools) that genuinely
persists. **Data is FULLY erased**; the breach is confined to a duplicate/recovered record-of-processing
under-stating retention — no PII escape, no fail-open, no false-erasure claim. The complete fix touches the
**sealed `processDataDeletion`** disclosure-idempotency (beyond this chunk's §5 authorization) + introduces new
idempotency semantics that warrant their own fresh review → **operator chose accept + ledger**; the HIGH-STAKES
③ deep audit (already warranted) is the authorized venue. FIX 4 (cron CAS) closes only the `completed`→`failed`
revert sub-path, not this root. **③ MUST address it (primary target).**

### OPEN — LOW — recorded (routed to ③ / accepted residuals)
- **OAuth-only step-up deferral** (self-disclosed §13.8b): an attacker holding a LIVE same-origin OAuth session can delete with no fresh re-auth (same risk class as any sensitive action on a hijacked live session; CSRF same-origin + typed `DELETE` remain). **Needs operator conscious-accept** (the build flagged it for ②). The richer OAuth re-consent / TOTP step-up is the ③/follow-up enhancement.
- Daily-cron (`0 3 * * *`) recovery → up to ~24h lockout-with-incomplete-erasure on a wedge (§13.7b directed reusing data-retention; **eventually completes — not fail-open**; within GDPR's 30-day SLA). Candidate: a more-frequent recovery tick.
- Cron staleness keyed on `createdAt` not processing-start (full fix = a `processingStartedAt`/`updatedAt` column = schema change, out of scope).
- True-concurrent double-submit → N scrubs + N "account deleted" emails (§13.4-accepted row-idempotency posture; bounded by the 5/min uid limiter).
- `catch`-without-CAS in `processDataDeletion`'s failure handler can flip `completed`→`failed` (self-heals; related to the re-run residual → ③).
- The recovery re-driver has **no test coverage** (the DC-08 safety net) — add a pglite wedge+recover test.
- Recovered-by-cron deletions skip the user email + completion audit log.
- Poison-pill / permanently-`failed` rows re-selected + re-alerted each cron run; no per-row attempt cap → `RECOVERY_CAP` starvation under >50 poison rows (DC-09).
- Rate-limiter fail-open on Redis outage (bounded by find-or-reuse idempotency + self-scope).
- Step-up `signInWithPassword` leaves an orphaned Supabase refresh token + spends GoTrue sign-in budget.
- email closing "contact support within 30 days if a mistake" implies recoverability of an irreversible op (LOW DC-16; §13.9 scoped only the banner).
- pre-existing stale "90 days" framings in settings/docs (NOT changed by this diff).

## 6. Defect-class ledger
DC-16 fold appended (the ② census — the audit-IP/UA HIGH + the three honesty fixes + the accepted re-run
under-disclosure residual). Cross-links: **DC-13** (the re-run springs on wiring), **DC-17** (status-machine
non-idempotent re-run), **DC-08** (the DEACTIVATED fail-mode scoping), **DC-09** (cron poison-pill starvation).
**No NEW defect class.** SEAM/LITERAL-EXECUTION: no new recurrence (every SEAM claim CONFIRMED at source; the
LITERAL-EXECUTION lens's "DEACTIVATED" prose↔code mismatch folds into the existing DC-16 honesty class).

## 7. Seal preconditions (met)
- Gate green (tsc 0 / lint 0 / vitest 209/4780; pglite non-vacuous). ✓
- Zero HIGH open (the 1 HIGH fixed + RED→GREEN verified live). ✓
- All sustained MED fixed (4) OR consciously accepted + ledgered by the operator (1, → ③). ✓
- Reviewers' evidence supports the seal (hard moat confirmed intact at max). ✓
- Frozen surfaces intact — only the §13.3 docstring + §13.2A `anonymizedNote` authorized edits + the chunk's own new code. ✓
- No deferred-work pull-in; no gold-plating. ✓

**→ Operator: run `/seal-go` to commit (path-scoped, EXCLUDING `tools/page.tsx`). Then `/push-go` gates the
push. The HIGH-STAKES ③ post-seal deep audit is the gated next step —
`docs/tech-debt/v-n3-deletion-wiring-postseal-deepaudit-handoff-2026-06-26.md` (primary target: the re-run
disclosure under-disclosure; plus the OAuth-step-up accept decision + the LOW residuals above).**
