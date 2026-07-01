# consumer-abuse-hardening — ② seal-gating review + seal record — 2026-07-01

> **Chunk:** `consumer-abuse-hardening` · **Closes:** launch-gate **G3-1** (unauth $500 academic mint) + **G3-2** (referral double-credit TOCTOU) · **Tier:** **HIGH-STAKES** (re-confirmed against the realized diff; NOT escalated).
> **Base:** local `main` HEAD `e648e7fe` (secrets-config-hardening seal, unpushed; `web-ci` gate LIVE).
> **Verdict:** ✅ **SEAL-READY** — gate GREEN on post-fold bytes, **ZERO HIGH-severity findings open**, reviewers' evidence supports it. Awaiting operator **`/seal-go`** (Claude cannot self-seal). ③ post-seal deep audit warranted (high-stakes).

---

## 1. Build-evidence reconciliation (the build left NO self-verification manifest)

The cadence JSON was still the ① plan-audit snapshot ("No build code yet"); `phase` was flipped to `review` but no build digest/manifest was recorded. Per ② protocol an **evidence-free green = RED** → the integrator re-ran the full gate from a clean isolated run (`cwd=apps/web`, matching `web-ci` `working-directory`) as the authoritative evidence.

**Pre-fold gate (as-built):** `tsc=0 · lint=0 · vitest=0` → **220 files / 5072 passed / 0 skip / 0 fail** (academic 11 ✓, referral 6 ✓). Reconciles to the prior sealed baseline (5055) **+17** (11+6 new), nothing else moved.

**Post-fold gate (authoritative sealed bytes):** `tsc=0 · lint=0 · vitest=0` → **221 files / 5085 passed / 0 skip / 0 fail** (academic **12 ✓**, referral **6 ✓**, **auth-email-verify 12 ✓** — new). Reconciles: 5072 **+12** (mailbox-proof unit) **+1** (double-`@`) = **5085**.

Migration integrity: `sha256(0017_academic_granted_at.sql)` = `46802cb3294b44d5ea16f687a3f34a31d87688cf4dd6e7a7e4e2187826ef9686` = the seeded `__drizzle_migrations` hash (re-seeded after the FOLD-4 comment edit; MATCH ✓). `drizzle/meta/` untouched (idx 0/1/8 only) — no `drizzle-kit generate` misfire.

## 2. Review setup

- **Orchestration:** operator-selected **Agent-tool spawns** (Path-1 pool absent — no `.claude/agents`; a concurrent mixed-effort fan-out unavailable in-session). **5 lens-distinct fresh-context reviewers**, all `model: opus` (claude-opus-4-8), Read-only, coverage-mode, run concurrently against the warmed prefix. Integration/seal decision kept in the main session.
- **Effort:** session `xhigh`; **all 5 reviewers self-reported `high`** (model-reported effort is unreliable — same caveat as the prior chunk; the operator-chosen `xhigh` is not independently confirmable). The **`max` core-invariant depth is DEFERRED to ③** (Path-1 absent → no concurrent `max` lens; a Path-2 `/effort max` pass was not run — the money invariant is provably analyzable at this tier and 4 lenses independently confirmed it sound).
- **Lenses:** (1) atomicity/concurrency/determinism · (2) spec-conformance · (3) core-invariant money/authorization security · (4) SEAM · (5) literal-execution + test-teeth.
- **Env traps unset** (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL). **Allowlist GREEN** (git/tsc/vitest/lint present; reviewers Read-only; the gate ran foreground in the main session). No MCP/WebFetch needed.

## 3. Core verdict — the money invariant is SOUND (zero money-loss HIGH)

All four non-test lenses independently confirm **"grant exactly once, atomically, only to an entitled caller"** holds:
- **Academic exactly-once:** the conditional `UPDATE … WHERE id=:auth AND academic_granted_at IS NULL RETURNING {id}`, gated on `length===1`, is provably once-only under PG READ COMMITTED (EvalPlanQual re-evaluates the WHERE against the committed row → concurrent loser matches 0 rows). No DC-06 matched-vs-changed trap on postgres-js (`.returning().length` == affected rows). Mirrors the `cron/process-payouts:231-254` precedent exactly. DB-side `col + X` arithmetic is safe vs concurrent proxy debits (no app read-modify-write).
- **Referral double-credit closed:** both updates inside one `db.transaction`; referee null-gated + rowCount-checked; referrer credited only after a 1-row referee update and itself rowCount-gated (throw → rollback → credit-both-or-neither).
- **`body.email` fully inert** for eligibility AND as email recipient (proven: 422 on academic body-email; welcome mail → `auth.verifiedEmail`).
- **Idempotency/replay sound**; no consumer self-delete endpoint → no delete-and-reclaim double-mint. Backfill closes the `auth/callback` shadow-consumer double-claim.
- **Spec-conformance CONFORMS:** all §5.5 folds (C1–C3, F4–F10) implemented as specified; no scope creep; no frozen surface touched; the §8 EXCLUDE set (`dashboard/tools`, `SECURITY-INCIDENT`) is pre-existing/unrelated (grep-empty of chunk content). The `requireConsumer` overload leaves all 35 existing callers unchanged.

## 4. Findings + disposition

### Sustained HIGH — adjudicated, none left open
- **SEAM [HIGH] `isAcademicEmail` `uni-`/`univ-` SLD branch is not TLD-constrained** (`uni-grant.com`, `univ-x.io` admitted, not only `.de`/`.fr`). **Reproduced** (`node` eval: `uni-grant.com`→true, `myuni-hack.com`→false, `uni-hack.attacker.com`→false). **Adjudication: this is the founder-accepted DOCUMENTED RESIDUAL, not a new hole** — it implements authoritative FOLD 8 verbatim, and the exploit (register a ~$10 `uni-*` domain + control a mailbox → $500) is economically identical whether `.de` or `.com` (both freely-registrable ~$10). The residual is now documented **in-code** (route comment) and remediated by the **fast-follow allowlist row** (§7). NOT a seal-blocking open HIGH.
- **Literal-exec [HIGH] the academic idempotency gate was UNPINNED by any test** — the "does NOT double-grant" test stubbed `returning → []`, so deleting `isNull(academic_granted_at)` from the WHERE still passed 11/11. **FOLDED** (see §5, FOLD 1; fail-then-pass reproduced live).
- **Literal-exec [HIGH] the mailbox-proof predicates (`currentEmailIsVerified`, `emailAutoConfirmSuspected`) were UNTESTED anywhere** (route tests mock `requireConsumer` wholesale). **FOLDED** (§5, FOLD 2 — 12 unit tests).

### MED — fail-closed / config-dependent on a live-Supabase primitive → routed to BLOCKING §P/§S (§6), NOT seal-blocking
- **Auto-confirm tripwire false-positive on OAuth** (Lens 1 + 4): consumer Google/GitHub OAuth IS live (`signInWithOAuth` in register/login/start; `auth/callback` creates consumer rows). If OAuth instant-confirm makes `email_confirmed_at === created_at`, a legit Google-Workspace `.edu` student (the *primary* intended user) gets a false 403 + a false `money_loss` alert. Fails CLOSED (no money hole). Runtime trigger unverifiable here (MED confidence). → §S live smoke + fast-follow (gate the tripwire on `provider === 'email'`).
- **`currentEmailIsVerified` DOA risk** (Lens 4 + 5): relies on `identity_data.email_verified === true`, an untested first-use of a GoTrue runtime field (`@supabase/auth-js` types `identity_data` as `{[k]:any}`). If GoTrue doesn't reliably populate it for confirmed email/password users, the feature is fail-closed DOA. → §S live smoke (a real confirmed password `.edu` user must be able to claim).
- **Auto-confirm tripwire evadable + likely toothless** (Lens 3 + 4 + 5): post-signup email-change advances `email_confirmed_at` off `created_at` (silent); the two timestamps come from different writers (rarely byte-equal). Consistent with the handoff's own C2 framing ("§P Confirm-email=REQUIRED is the real control, this is the backstop"). Documented-by-design.
- **Federated-IdP trust** (Lens 3): an attacker-self-asserting OIDC/SAML provider (if ever enabled) could assert `email_verified:true` for a `.edu` it doesn't control → mint. With the currently-enabled providers (email + Google + GitHub, which verify their own emails) the invariant holds. → §P (do not enable an untrusted self-asserting consumer IdP).

### LOW — folded or documented
- **Double-`@` parsing** (Lens 3): `a@harvard.edu@evil.com` parsed `harvard.edu` as domain. **FOLDED** (§5, FOLD 3). (Hard to reach — GoTrue validates upstream — but it's a money-eligibility parser.)
- **Comment-accuracy (SEAM/LITERAL-EXEC recurrence):** "institutionName/useCase are logged metadata" (useCase is discarded, not logged); the `isAcademicEmail` SLD comment understated the generic-TLD residual; `0017` "idempotent" overstated (only the ALTER is; the backfill is one-shot). **All FOLDED** (§5, FOLD 4).
- **Documented / out-of-scope (no action):** mutual-referral deadlock → clean 500 (handoff A2b); per-referrer Sybil farming + referee has no email-verify (documented residual + fast-follow); rate-limit fail-open + XFF spoofable (handoff M7); referral txn-mock can't model rollback + academic per-user limit charged on no-op paths (test-fidelity / UX, no money impact); grant/email crash gap (UX only).

## 5. Folds landed (each re-entered its class at proportionate depth)

1. **[test teeth] Pin the academic idempotency gate** — added `import { isNull }` + `expect(isNull).toHaveBeenCalledWith('academic_granted_at')` to the fresh-grant test. **Fail-then-pass reproduced live:** with the gate removed the original suite passed 11/11; the improved assertion goes **RED** with the gate removed and **GREEN** with it restored.
2. **[test teeth] Mailbox-proof unit coverage** — exported `currentEmailIsVerified` + `emailAutoConfirmSuspected` (additive) and added `src/lib/middleware/__tests__/auth-email-verify.test.ts` (12 tests): M4 email-swap rejection, all fail-closed branches (no `email_confirmed_at`, `email_verified !== true`/absent, no identity, no email), case-insensitive match, and the auto-confirm signature. Documents the live-Supabase dependency for the §S smoke.
3. **[code hardening] Double-`@` guard** in `isAcademicEmail` (`if (email.split('@').length !== 2) return false`) + a regression test. No legit single-`@` email regresses.
4. **[comment accuracy] + hash re-seed** — corrected the three misleading comments (useCase, SLD residual, 0017 one-shot); the `0017` edit changed the file bytes, so the bootstrap seed hash was **recomputed and re-verified** (MATCH ✓). Executed SQL (ALTER + backfill) unchanged.

No fold pulled in deferred work, gold-plated, or perturbed a frozen surface. The verify-gate redesign (provider-gating the tripwire; loosening the `email_verified` reliance) was deliberately NOT folded — it depends on unverifiable GoTrue runtime behavior and belongs to the §S live smoke + fast-follow, not a seal fold.

## 6. BLOCKING pre-launch operator items (record at seal; G3-1 NOT fully closeable until confirmed)

**§P (config):**
1. **Supabase "Confirm email = REQUIRED"** on the consumer project — if auto-confirm is ON, the verify gate is toothless and $500 is mintable to `anyone@harvard.edu` (a live `register` password-signup exists). BLOCKING.
2. **Supabase "Secure email change = ENABLED"** — else the M4 email-swap passes an unconfirmed academic email.
3. **APPLY-THEN-DEPLOY `0017`** — paste the migration in the Supabase SQL Editor + seed the `__drizzle_migrations` row (`46802cb3…ef9686`) BEFORE the seal commit deploys (`main` auto-deploys; a missing column 500s the academic route). **Run the backfill exactly once — do NOT re-paste after go-live.**
4. **NEW — audit enabled consumer auth providers** — only `email` + trusted OAuth (Google/GitHub, which verify their own emails). Do NOT enable an untrusted self-asserting federated OIDC/SAML for consumers (Lens 3 federated-IdP mint).

**§S (live funnel smoke against the REAL consumer Supabase — resolves the two live-Supabase MEDs):**
5. A **confirmed email/password `.edu` user** successfully claims (proves `currentEmailIsVerified` passes — the feature is not fail-closed DOA).
6. A **Google-Workspace `.edu` user ("Sign in with Google")** successfully claims (proves the `emailAutoConfirmSuspected` tripwire does not false-fire on legit OAuth instant-confirm).

## 7. Fast-follow roadmap rows to file (founder-resolved DOCUMENTED residual + review follow-ups)

- **academic-domain allowlist + per-referrer referral cap / velocity** — the honest-minimum reduces but does not eliminate the entitlement/Sybil surface (any `uni-*` domain admitted; per-referrer farming uncapped; referee side has no email-verify). Roadmap-deferred, not a blocker for this seal.
- **Harden the auto-confirm tripwire** — gate `emailAutoConfirmSuspected` on `provider === 'email'` (kills the OAuth false-positive) and/or replace timestamp `===` with a parsed-epoch window; treat operator §P as the real control either way.

## 8. Defect-class ledger (`.audit/defect-ledger/`, local/gitignored)

- **DC-03** (unauthenticated/forgeable money mutation) — G3-1 unauth $500 mint **CLOSED** (authed + email-verified + atomic once-gate).
- **DC-02 / DC-17** (missing idempotency / non-idempotent rerun) — G3-2 double-credit TOCTOU **CLOSED**; G3-1 repeatable grant **CLOSED** (marker replay guard).
- **DC-06** (idempotent-writer-semantics trap) — validated NO trap (postgres-js `.returning().length` == matched rows).
- **SEAM / LITERAL-EXECUTION comment-accuracy sub-class RECURRED** (useCase-logged / 0017-idempotent / SLD-framing) — all three folded pre-seal. Third consecutive chunk with a comment-accuracy recurrence (cf. secrets-config-hardening env.ts:128-129). Consider a standing pre-seal comment-truth pass.

## 9. Seal actions (operator `/seal-go`)

**Explicit-pathspec commit (never `git add -A`):**
```
apps/web/src/lib/db/schema.ts
apps/web/drizzle/0017_academic_granted_at.sql
apps/web/scripts/bootstrap__drizzle_migrations.sql
apps/web/src/lib/middleware/auth.ts
apps/web/src/app/api/consumer/academic/route.ts
apps/web/src/app/api/consumer/referral/apply/route.ts
apps/web/src/app/academic/page.tsx
apps/web/src/app/api/consumer/academic/__tests__/route.test.ts
apps/web/src/app/api/consumer/referral/apply/__tests__/route.test.ts
apps/web/src/lib/middleware/__tests__/auth-email-verify.test.ts
docs/tech-debt/consumer-abuse-hardening-handoff-2026-07-01.md
docs/tech-debt/consumer-abuse-hardening-seal-record-2026-07-01.md
```
**EXCLUDE (leave untouched):** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`, `docs/SECURITY-INCIDENT-2026-06-15-*.md`, `.claude/`, `docs/tech-debt/launch-gate-queue.md`, `docs/tech-debt/v-n3-mfa-*`, `scripts/mfa-delete-smoke.sh`, `docs/tech-debt/ci-test-gate-postseal-deepaudit-*.md`, `docs/tech-debt/secrets-config-hardening-postseal-deepaudit-*.md`, and the unpushed `e648e7fe`.

**At seal:** tick **G3-1** (`:81`) + **G3-2** (`:82`) `☐→☑` in `LAUNCH-GATE-roadmap-2026-06-27.md` (gitignored → local cadence state; PostToolUse recount 15→13, gate still RED). Do NOT push (separate `/push-go`).

**Next:** ③ post-seal deep audit (high-stakes) — integrated-whole scope on the committed tree; the deferred **`max` core-invariant lens** lands there, and it should validate the live-Supabase MEDs' code posture + the §S smoke framing.
