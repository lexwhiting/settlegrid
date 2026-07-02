# gdpr-access-consumer-erase — ② SEAL record — 2026-07-02

> **Chunk:** `gdpr-access-consumer-erase` · **Closes:** **G5-2** (Art.15/20 developer export un-paywalled) + **G5-3** (consumer Art.17 erasure door). **G5-1** = code already live; ticks on the operator §4.5 TOTP smoke only. · **Tier:** **HIGH-STAKES** (re-confirmed vs the realized diff; **NOT escalated**). · **Base:** local `main` = `origin/main` = `0a28d9de`. · **Seal commit:** explicit-pathspec (UNPUSHED — push gated on `/push-go`).
> Handoff (build spec + folds): `docs/tech-debt/gdpr-access-consumer-erase-handoff-2026-07-02.md`.

---

## 1. What sealed

**G5-2 — un-paywall the developer GDPR Art.15/20 data-export (FOLD 3/4).** Removed the `hasFeature(…,'data_export',…)` tier gate + the now-dead `developer` DB lookup in `data-export/route.ts`; pruned the 4 orphaned imports (`eq`, `db`, `developers`, `hasFeature`); KEPT both rate limits (`data-export:${ip}` + `:uid`). `stats/export/route.ts` (the paid CSV analytics export) and `tier-config.ts` **untouched** — the paid CSV stays gated. Reconciled all 5 published copy surfaces (`pricing:162` + JSON-LD `:83`, `pricing-section:34`, `academic/page:50`, `consumer/academic:135`) from "Data export (GDPR)"/"data export" → "CSV analytics export" (truthful for what a Scale customer still gets).

**G5-3 — a consumer Art.17 erasure DOOR (FOLD 1/2/6), NOT a standalone engine.** Every authenticated consumer is a developer-TWIN sharing ONE Supabase auth user (`auth/callback` creates both rows with the same `supabase_user_id`), so the new `DELETE /api/consumer/account`:
- Applies the SAME controls as the developer door (dedicated `authLimiter` IP+uid, `isSameOriginRequest` CSRF, DELETE-not-GET, `confirm:'DELETE'` typed friction, the SHARED `verifyStepUp`).
- Resolves the developer twin (`resolveOrCreateDeveloperId`: by `supabaseUserId` → by-email relink → insert; FOLD-6 partial-callback edge handled — no 404) and drives the EXISTING ③-certified `requestDataDeletion('provider', …)` + `processDataDeletion` pipeline, which anonymizes BOTH halves in place (revoke-not-delete; foreign invocation/financial rows survive) and hard-deletes the shared auth user ONCE.
- NO `requireEmailVerified` gate (FOLD 2 — Art.17 never-block); does NOT null `academicGrantedAt` (FOLD 2 — grant-key scrub deferred). **NO migration.**
- Consumer settings UI (`(dashboard)/consumer/page.tsx`) adds a "Delete My Account" danger-zone control + the `privacy@settlegrid.ai` mailto backstop.

**Realized-diff shape note (surfaced + adjudicated, tier NOT silently lowered).** The builder realized FOLD-6 option 4b by **extracting** `isSameOriginRequest`/`verifyStepUp`/`createRequestSupabase` (+ `StepUpResult`) out of the ③-certified `account/route.ts` into a shared `lib/account-deletion.ts` that BOTH doors import — beyond §9's literal INCLUDE list (added `account/route.ts` + `account-deletion.ts`). This perturbs a near-frozen surface, so the SEAM lens ran a **byte-level mechanical diff**: the move is behavior-preserving (one benign doc-comment-pluralization hunk; every security path in `verifyStepUp` is byte-identical to the certified original). The dev-delete handler body is untouched; no external importer depended on the module-private helpers. This is the faithful, arguably-superior realization ("SAME control, never a re-implementation that could drift weaker"). Tier stays HIGH-STAKES, NOT escalated (no behavior change to the frozen surface, no migration, the one new boundary was planned + hostilely reviewed).

---

## 2. Review — 5 lens-distinct fresh-context reviewers (all `claude-opus-4-8[1m]`)

Path-1 pool ABSENT (no `.claude/agents`) → Agent-tool Path-2 spawns. Reviewers Read/Grep-only; the gate + every live repro ran FOREGROUND in the main session (allowlist GREEN: git/tsc/vitest/lint). 4 seal lenses batched concurrent, then the core-invariant lens SEQUENTIAL after the operator `/effort max` switch.

| Lens | Scope | Verdict |
|---|---|---|
| **A — core-invariant (erase/data-integrity)** @ **operator-confirmed `max`** | under/over-erasure, FOLD-6/relink, idempotency, fail-mode, ledger integrity | **1 MED (fixed before seal)** + 4 fast-follow residuals; door drives the pipeline correctly |
| B — G5-2 spec + scope | un-gate precision, copy reconcile, scope creep | CLEAN (no HIGH); MED = commit-hygiene (excludes dirty); 2 LOW out-of-scope residuals |
| C — SEAM + extraction byte-identity | extraction drift, control parity, invariant contradictions | **BYTE-CLEAN**; 1 LOW (disjoint rate buckets, not a real weakening) |
| D — literal-exec + test-teeth (DC-24) | branch trace, revert-RED teeth | all 3 tests have real teeth; LOWs (signInWithPassword-500, relink-untested, concurrent-FOLD6 500) + coverage gaps |
| E — security @ the new boundary | IDOR, relink attack, step-up bypass, CSRF, DoS, leak | no exploitable defect under standard config; MED (MFA-unenroll, inherited/deferred) + LOW (relink, conditional) |

Effort report-back (recorded): the 4 seal lenses ran at session **`high`** (the `/effort xhigh` switch was not applied before the fan-out — a recorded coverage note; `high` clears the never-below-high floor). The **core-invariant lens ran at operator-confirmed `/effort max`** (the main session saw the `/effort max` command immediately before the spawn — so max IS credited here, unlike containment's self-report-only max). Env traps unset (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL); no session model pin.

---

## 3. The one seal-blocking finding — FIXED + reproduced live (fail-then-pass)

**MED [core-invariant lens] — relink cross-identity OVER-erasure (NEW code, irreversible path).** In the FOLD-6 window, `resolveOrCreateDeveloperId`'s by-email branch *unconditionally* relinked a matched `developers` row to the caller's `supabaseUserId` and drove its erasure. Under a Supabase email-collision precondition (email-confirmation disabled, or an IdP returning an unverified email), a caller whose consumer email matched a *different* subject's developer row could erase the **victim's** account.

- **Live RED (built code):** the guard test returned **200 — victim developer relinked + anonymized** (`expect(409)` failed).
- **Fix (3 edits, all in the new `consumer/account/route.ts`; no frozen surface):** `resolveOrCreateDeveloperId` now selects `supabaseUserId` and throws a typed `DeveloperTwinConflictError` when the by-email row is bound to a **different non-null** auth user; the door maps it to a fixed-string **409 `ACCOUNT_RESOLUTION_CONFLICT`**. A legitimate FOLD-6 subject's own row is found by `supabaseUserId` (never reaches the branch) or carries a NULL link (relink permitted) → **zero legitimate false-positive**; an ambiguous collision routes to the `privacy@` manual runbook (Art.17 still honored).
- **Live GREEN (after fix):** 409 / victim untouched / no auth-user delete. +1 DC-24 tooth in the pglite integration test.

---

## 4. Residuals (recorded → fast-follow; none block the seal)

1. **[LOW-MED] Empty-email under-erasure (F-4 trade-off, inherited).** An `email=''` consumer twin (an IdP yielding a null email) is skipped by the pipeline's F-4 capture guard while its shared auth user IS deleted → PII strands, door returns 200. Inherited from the ③-certified developer door (same F-4 behavior); reachability gated on email-less auth being possible. Fast-follow: 422 an `email===''` self-delete (or repair-scrub by `consumer.id`).
2. **[LOW] Diverged-email under-erasure (unreachable in-app).** The pipeline keys the consumer capture off `dev.email`; the door authenticates by `supabaseUserId`; nothing enforces twin-email equality. Proven unreachable — **no app surface writes `email`** (no email-change flow is wired; `accountEmailChangedEmail` has zero callers). Fast-follow: assert `norm(dev.email)==norm(consumer.email)` post-resolution, or capture by `consumer.id`; and never land an email-change endpoint without syncing the twin.
3. **[LOW] `verifyStepUp` `signInWithPassword` unwrapped → raw 500 (inherited, fail-CLOSED).** Violates the module's own "no raw 500 on the Art.17 path (DC-08)" contract; byte-inherited from the certified developer door. Fast-follow: wrap → fixed `REAUTH_FAILED` like the sibling arms.
4. **[MED, INHERITED] MFA-unenroll → ACCEPT downgrade.** A hijacked live OAuth+MFA session can unenroll MFA (step-up-less `DELETE /api/auth/mfa`) then delete via the residual-ACCEPT branch. Byte-inherited + disclosed in `verifyStepUp`'s RESIDUALS note; the recommended **step-up-on-unenroll** next chunk (`docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md`). A password+MFA victim is unaffected.
5. **[LOW] Disjoint rate-limit buckets across the two doors** (`consumer-account-delete:*` vs `account-delete:*`; ~2× local budget for one twin). Not a real weakening — deletion idempotent; the load-bearing brute-force backstop is GoTrue's server-side MFA lockout keyed on the *shared* auth user (not doubled); the local limiter is `failMode:'open'` anyway.
6. **[LOW, out of scope] Pre-existing copy/UX drift** — the Builder-tier "CSV export" claim in `docs/page.tsx:442/594` + `llms.txt`/`llms-full.txt` (now more discoverable); the `dashboard/page.tsx` "Data Export" card treats the JSON export as a blob (newly reachable for free-tier). Separate tickets.
7. **Academic $500-recycle surviving-hash key** — DEFERRED to the consumer-abuse fast-follow (roadmap `:160` #2; operator-approved migration). Routing erasure through the MFA-gated dev-delete keeps friction at today's founder-accepted level (no new lower-friction faucet).
8. **The relink root** also lives in `auth/callback`'s login-time by-email relink (a frozen surface, out of this chunk); the same guard belongs there as the deeper fix — fast-follow.

**Defect-class ledger:** new instance recorded (cross-identity relink over-erasure — an IDOR-on-identity-resolution / over-erasure defect, sibling to the V-N3 erasure-completeness class). **No new SEAM or LITERAL-EXECUTION recurrence** (Lens C found the extraction byte-clean + no invariant contradiction; Lens D found no paper imperatives).

---

## 5. Gate evidence (seal-time, clean isolated run, cwd `apps/web` = web-ci)

The build session emitted NO self-verification digest (handoff §13 was empty) → its green was treated as evidence-free/RED and the gate was re-run FROM SCRATCH here:
- `npx tsc -p tsconfig.json --noEmit` → **exit 0**
- `npm run lint` → **0 errors** (pre-existing warnings only)
- `npx vitest run` → **exit 0 — 227 files / 5167 passed / 0 skip / 0 fail**

**Reconciliation:** base `0a28d9de` = 225 files / 5154. Build added the door + un-gate + copy + tests → 227 files / 5166 (+2 test files: consumer-account integration + data-export route; +12 tests = 6 consumer-door + 5 data-export + 1 stats-export-stays-gated). ② fix added +1 (the cross-identity guard DC-24 tooth) → **5167**. **NO migration** (`schema.ts` + `drizzle/` untouched).

---

## 6. Commit manifest (explicit pathspec — never `git add -A`)

**INCLUDE (11 code/test + 2 docs):**
```
apps/web/src/app/api/dashboard/developer/data-export/route.ts
apps/web/src/app/pricing/page.tsx
apps/web/src/components/marketing/pricing-section.tsx
apps/web/src/app/academic/page.tsx
apps/web/src/app/api/consumer/academic/route.ts
apps/web/src/app/api/dashboard/developer/account/route.ts        (extraction: import from lib)
apps/web/src/app/(dashboard)/consumer/page.tsx                   (delete UI control)
apps/web/src/app/api/__tests__/export.test.ts                    (stats/export stays-gated)
apps/web/src/lib/account-deletion.ts                             (NEW — extracted shared controls)
apps/web/src/app/api/consumer/account/route.ts + __tests__/route.integration.test.ts   (NEW)
apps/web/src/app/api/dashboard/developer/data-export/__tests__/route.test.ts            (NEW)
docs/tech-debt/gdpr-access-consumer-erase-handoff-2026-07-02.md  (§13 seal)
docs/tech-debt/gdpr-access-consumer-erase-seal-record-2026-07-02.md  (this file)
```
**EXCLUDE (pre-existing / other chunks / gitignored):** `dashboard/tools/page.tsx` · `SECURITY-INCIDENT-*.md` · `.claude/` · `launch-gate-queue.md` · `LAUNCH-GATE-roadmap-*` (gitignored) · `v-n3-mfa-unenroll-*` · `mfa-delete-smoke.sh` · `stats/export/route.ts` · `tier-config.ts` · other chunks' `*-deepaudit-*.md`. Verified via `git diff --cached --name-only` before commit.

---

## 7. Seal bookkeeping (§10) — operator/§P items (NOT code-closeable here)

- **G5-2 / G5-3** ticked ☐→☑ in the roadmap (gitignored; `.claude/launch-gate-check.sh` recount).
- **G5-1** ticks ONLY when the operator runs the §4.5 live TOTP smoke (`scripts/mfa-delete-smoke.sh`) — code already live/pushed.
- **§P (HARD co-requisite of G5-3, FOLD 5):** confirm `privacy@settlegrid.ai` is a MONITORED inbox + a documented manual-erasure runbook covering BOTH Art.17 erasure AND Art.15 access — for the no-login lead cohort (`ask/capture` + `newsletter/subscribe` rows have no `supabaseUserId` → cannot self-serve).
- **§C (counsel, parallel):** the DSAR-formality question ("is paywalled export a DSAR violation?") does not block the code.
- **LBD-3 consumer data-ACCESS residual** — OUT of code (not a blocker); the manual runbook covers Art.15 for consumers.

**Seal status:** gate GREEN on sealed bytes, zero HIGH open, the one seal-blocking MED FIXED + reproduced live, reviewers' evidence supports the seal. Operator ran `/seal-go`; integrator did the explicit-pathspec commit + bookkeeping (no self-seal). **③ post-seal deep audit is warranted (high-stakes) — NEXT.**
