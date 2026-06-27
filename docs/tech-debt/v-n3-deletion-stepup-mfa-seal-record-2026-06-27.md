# ② SEAL RECORD — V-N3-deletion-stepup-mfa — 2026-06-27

**Decision: SEAL — PASS (pending the operator's manual `/seal-go` to commit).**
**Tier: HIGH-STAKES** (re-confirmed against the realized diff — edits the step-up auth control on an
irreversible PII/GDPR op + the Art.17 never-block invariant). NOT escalated, NOT lowered.

Base = origin/main `20baa023` (V-N3-deletion-wiring ③). No commit yet for THIS chunk; `/seal-go` commits it.

---

## 1. Gate evidence (integrator's own clean isolated re-run, POST-FIX)

The build session emitted NO self-verification digest (cadence-state descriptive fields were stale plan-phase
text — "no build code exists yet" — while the working tree carried the full build). Per the ② protocol an
evidence-free "green" is treated as RED, so the gate was re-run from scratch on the FIXED tree:

- `npx tsc --noEmit` (from `apps/web`) → **0 errors**.
- `npm run lint` → **0 errors** (only pre-existing warnings: `<img>`/exhaustive-deps/unused-eslint-disable;
  none in the three touched files).
- `npx vitest run` → **209 files / 4792 tests passed** (clean run, exit 0). Baseline was 4781; this chunk's
  +11 MFA-branch tests = 4792. The M1 fix modified an existing test (no count change); M2 added none.
- Account suite alone: `route.test.ts` **29/29**.

(stderr `logger.error`/`audit.write_failed` lines during the full run are EXPECTED output inside passing
negative-path tests — billing/tools/stripe/payouts suites assert graceful handling of injected failures.)

## 2. Scope of THIS chunk (what ② reviewed)

IN: `apps/web/src/app/api/dashboard/developer/account/route.ts` (+170, `verifyStepUp` + DELETE body parse),
its `__tests__/route.test.ts` (+179), `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` (+79, the
delete-flow step-up UI). OUT (excluded carry-forward, NOT reviewed): `tools/page.tsx` (+24/-2), local `.claude/`,
`.audit/`.

## 3. Review fan-out (Path-2 mixed effort; all `claude-opus-4-8`)

Realized via **Agent-tool spawns** (NOT a workflow): a `max` core-invariant lens cannot run inside a single
workflow (which runs every agent at one session effort), and Path-1 effort-bearing named subagents were absent,
so the mix was realized as the sanctioned Path-2 sequence. Allowlist pre-flight GREEN (`tsc/vitest/lint/git` all
in `permissions.allow`); env traps all unset (`FORK_SUBAGENT`/`SUBAGENT_MODEL`/`EFFORT_LEVEL`).

- **xhigh tier (4 lenses, session xhigh, concurrent):** correctness/determinism, spec-conformance, SEAM,
  literal-execution. *Effort report-back caveat:* each self-reported "high" — model self-reports of effort are
  unreliable (effort is not a model-readable value; ad-hoc spawns inherit the operator-confirmed xhigh session).
  Work quality was xhigh-caliber (4 source mutations to prove test non-vacuity; SDK-source verification at
  `@supabase/auth-js`; live probes). Treated as xhigh-inherited with the self-report noted.
- **max tier (1 lens, after operator `/effort max`, sequential):** core-invariant security + GDPR-Art.17 +
  data-integrity moat. Reported `EFFORT: maximum`, `claude-opus-4-8[1m]`. Ran 12 adversarial repros (all
  defended). Realized via the operator session switch then a single inheriting spawn (Path-2).

Integrator/seal decision stayed in the main session.

## 4. Findings & dispositions

| # | Finding | Lens(es) | Sev | Disposition |
|---|---------|----------|-----|-------------|
| **M1** | `literal-2` test vacuous — fixture rigged `PASSWORD_USER.email === DEV.email`, so the "verifies against the user's OWN email" pin could not discriminate `user.email` from `developers.email` (prod CORRECT; test toothless) | correctness-F4, spec-F1 | MED | **FIXED + reproduced RED→GREEN** |
| **M2** | Delete-flow `mfaHasVerifiedFactor` UI flag set only on mount; `handleVerifyMfa`/`handleDisableMfa` didn't re-sync it → in-session enroll/disable shows the WRONG credential field → reload-recoverable dead-end on the Art.17 flow | literal-F1, correctness-F5, spec-F3 | MED | **FIXED** (synced both handlers + corrected false comment) |
| R1 | §5 MFA-unenroll-session-only bypass (OAuth+MFA subset): `DELETE /api/auth/mfa` has no step-up | max core-invariant | MED | **ACCEPTED residual** — out-of-scope (different endpoint), operator-deferred, honestly documented in code+handoff; net posture IMPROVED. **Recommend as the IMMEDIATE next chunk.** |
| R2 | Pure-OAuth-no-MFA accepts on session+same-origin+confirm (no fresh proof-of-possession) | max core-invariant | MED→LOW | **ACCEPTED residual** — by design (record §6), documented |
| 6 SEAM claims | listFactors verified-only; TOTP challenge no-OOB; verify `{error}`=success; **`setAll` no-op = no elevated cookie**; GET returns `factors[].status`; unenroll no-step-up/no-notify | SEAM | — | **VERIFIED** at SDK source (`GoTrueClient.js:2685`, `ssr/cookies.js`, `mfa/route.ts`) |
| L: challenge/verify THROW → 500 (not REAUTH_FAILED) | correctness-F1 | LOW | **ACCEPTED → ③** — still fail-CLOSED + no leak (DC-08 note; inconsistent status only) |
| L: mock puts `unverified` factor in `.totp` (impossible real shape) | literal-F3, SEAM | LOW | **ACCEPTED → ③** — exercises the defensive filter; prod correct either way |
| L: `user.email`-unset+email-identity → ACCEPT; `!user` 401; all-challenges-error → REAUTH_FAILED — unpinned | literal-F5/F6, max-T2 | LOW | **ACCEPTED → ③** (optional test-hardening; behaviors verified by max-lens repro) |
| L: `clearAllMocks` doesn't drain the Once-queue | literal-F7 | LOW | **ACCEPTED → ③** — latent only; already DC-05-classed |
| L: U1 cross-tab/fetch-fail staleness; U2 fetch-fail disables unenroll UI; U3 "leave blank" hint misleads linked accts | max U1-U3 | LOW | **ACCEPTED → ③** — reload-recoverable, server fail-safe; U3 pre-existing |

**Zero HIGH open. Zero in-scope MED defect open** (M1/M2 fixed; R1/R2 are deferred-documented residuals with no
fix to land).

### M1 fix — live reproduction (the seal's filter)
Changed `PASSWORD_USER.email` to `auth-user-1@x.com` (distinct from `DEV.email='dev@x.com'`); with the SHIPPED
assertion still `{email: DEV.email}` the test went **RED** (`expected dev@x.com … received auth-user-1@x.com`)
— proving production calls `signInWithPassword` with `user.email` (CORRECT) and the old test was green only
because the fixture rigged the two equal. Retargeted the assertion to `PASSWORD_USER.email` +
`.not.toHaveBeenCalledWith({email: DEV.email})` → **GREEN**. Full suite re-confirmed 4792.

### M2 fix — what changed
`setMfaHasVerifiedFactor(true)` added in `handleVerifyMfa` (`settings/page.tsx:786`) and `(false)` in
`handleDisableMfa` (`:816`), mirroring the already-synced `mfaEnrolled`; the misleading "mfaEnrolled counts
unverified" comment corrected (the GET endpoint derives `enrolled` from the verified-only `totp` list, so the
flag must mirror it). Reproduction was by code inspection (the state-mutation-site census showed the setter only
at the mount fetch); the fix is independently corroborated by the max core-invariant lens, which re-read the
handlers and confirmed "kept in sync in-session on enroll/disable — good". The UI is not unit-tested per repo
convention (handoff §4.4) — so "tests green" does NOT prove the UI path; this fix rests on inspection + the
max-lens re-read + the green tsc/lint.

## 5. OUTSTANDING non-gated manual verification (surfaced, not silently dropped)

The handoff **§4.5 manual live-smoke** (enroll a real TOTP factor; run the delete flow with correct/wrong/no
code against REAL GoTrue; confirm no elevated session cookie is written) has **no recorded evidence** and could
not be run in this review (no live Supabase here). The unit suite fully mocks `@supabase/ssr`, so **no automated
test exercises the real challenge/verify/no-op-`setAll` path** (max-lens T1). The code's real-path correctness is
otherwise strongly evidenced (SEAM SDK-source verification of the exact GoTrueClient/ssr cookie mechanics; the
max lens's reasoning that GoTrue's `verify` validates the TOTP against the factor secret, not session AAL). This
does NOT block the ② code seal (the smoke is explicitly non-gated and the code is independently certified), but
**the operator must run the §4.5 smoke before production reliance — recommended before `/push-go`.**

## 6. Frozen surfaces — confirmed UNPERTURBED

Rate-limit posture (`authLimiter`, `failMode:'open'`, runs before step-up), CSRF same-origin check, self-scope on
`auth.id`, find-or-reuse, `processDataDeletion` + its already-erased guard, the email, the completion audit row —
all unchanged. The ONLY signature change is `verifyStepUp` (drop `email`, add `mfaCode?`) + the additive
`mfaCode` body field. No schema change, no new endpoint. (The password branch now reuses the single
request-bound client instead of a second `createRequestSupabase` — behavior-preserving given the no-op `setAll`,
within the authorized `verifyStepUp` rewrite.)

## 7. Defect-class ledger fold

- **DC-05** (test-double surface divergence) — NEW evidence: M1, the "collapsed-distinct-values vacuity" face
  (a fixture rigging two distinct real values equal so a discriminating assertion is toothless). Count 9→10.
  The `clearAllMocks` Once-queue low re-observed (already DC-05-classed, latent only).
- **DC-08** (implicit/wrong fail-mode) — note: the build got the named probe-error case right (listFactors
  error → fail-CLOSED-retryable); the challenge/verify-throw→500 residual is fail-CLOSED but status-inconsistent
  (ledgered to ③, not a wrong fail-mode).
- **M2** recorded as a one-off UI client-derived-gate state-sync fix (no new cross-cutting class — handoff §8's
  "no new class expected" holds).

## 8. What `/seal-go` commits

Path-scoped to the three in-scope files ONLY:
`account/route.ts`, `account/__tests__/route.test.ts`, `settings/page.tsx`. EXCLUDE `tools/page.tsx`
(carry-forward), `.claude/`, `.audit/` working-tree noise. Per cadence (prior chunks bundled ②+③), **push WAITS
for ③** (`/push-go` gates it).

▶ NEXT (high-stakes): paste the ③ post-seal deep-audit kickoff →
`docs/tech-debt/v-n3-deletion-stepup-mfa-postseal-deepaudit-handoff-2026-06-27.md`.
