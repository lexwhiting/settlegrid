# ③ POST-SEAL DEEP-AUDIT RECORD — V-N3-deletion-stepup-mfa — 2026-06-27

**Tier: HIGH-STAKES** (re-confirmed: auth/step-up control on an irreversible PII/GDPR Art.17 op +
the never-block invariant) → ③ warranted.
**Verdict: RE-CERTIFIED (hardened).** The ② seal's core invariants STAND; ③ closed 5 in-scope
findings fix-first + 1 documentation hardening, all live-reproduced, none perturbing a frozen
surface or pulling in deferred work. 2 real out-of-scope/frozen residuals recorded + routed as
follow-ups.

Scope = the INTEGRATED WHOLE on the ②-sealed commit `f28190f8` (distinct from the ② diff-scoped
review). Inputs: the ③ handoff (`…-postseal-deepaudit-handoff-2026-06-27.md`), the ② seal record,
the build handoff §3/§5/§6.

---

## 1. Mechanical pre-flight (scripted; handed to the reviewers so none re-derived checkable facts)

- **Gate GREEN on the committed tree `f28190f8`** (from `apps/web`): `npx tsc --noEmit` 0 errors;
  `npm run lint` 0 errors (only pre-existing warnings in `logo.tsx` / `academy-lessons.test.ts`,
  none in the touched files); `npx vitest run` **209 files / 4792 tests** (= seal).
- **Invariants re-derived from source (all hold):** INV-1 freshness/no-AAL2-bypass (fresh
  `challenge`+`verify` per request; `getAAL().currentLevel` never read); INV-2 never-block every
  account shape; INV-3 fixed-string no-leak; INV-4 server-derived factorId (never from body);
  INV-5 no-op `setAll` (no elevated cookie).
- **Hostile-input battery (all fail-closed):** non-string `mfaCode`/`password`→undefined; body
  `factorId` ignored; malformed code → `/^\d{6}$/` → REAUTH_REQUIRED; empty/non-JSON body → 422;
  password+MFA → MFA terminal; throw-path → generic 500, `internalErrorResponse` (api.ts:100-111)
  emits a FIXED `'Internal server error'` (raw error only to logger — no client leak).
- **SEAM re-validated at source:** compliance step 5 (`compliance.ts:914-917`) nulls
  `ipAddress/userAgent/details` on every `developerId`-keyed audit row → the `security.mfa_disabled`
  unenroll row (`mfa/route.ts:220-228`) IS self-scrubbed (incl. `details.factorId`); R1 bypass is
  OAuth+MFA-scoped (password+MFA → password branch post-unenroll); step-up strictly precedes scrub;
  no-op vs real `setAll` clients correctly separated. `compliance_exports` has only a NON-unique
  `(entity_id, entity_type)` index (schema.ts:1199) — no serialization constraint (G2 premise).

## 2. Fan-out (Agent-tool spawns; operator-confirmed orchestration + "proceed at current effort")

Realized via **Agent-tool spawns** (operator opt-in this turn), NOT a workflow — allowlist GREEN
(`git`/`npx tsc`/`npx vitest`/`npm run lint` in `.claude/settings.local.json`) moots the workflow
loud-pause edge, the 3-file surface fits in context (off-context isolation marginal), lower token
cost. Env traps all unset (`FORK_SUBAGENT`/`SUBAGENT_MODEL`/`EFFORT_LEVEL`); no model pin.

6 reviewers, ALL reported `claude-opus-4-8[1m]`:
- **5 lens reviewers (concurrent):** correctness/determinism · spec-conformance · SEAM ·
  literal-execution · integration-seam.
- **1 collective-miss critic (final pass).**

*Effort report-back caveat:* each self-reported "high"/inherited — effort is not a model-readable
value; ad-hoc spawns inherit the operator-confirmed session effort. Operator chose **"proceed at
current effort"** (≥ xhigh; the session was left at `/effort max` from ② with the revert deferred),
so reviewers + the collective-miss critic ran at the inherited session effort (≥ xhigh, plausibly
max). The optional supra-baseline **`max` critic bump was NOT taken as a separate switch** — it was
subsumed by "proceed at current effort." Treated as xhigh-floor-met with the self-report noted.

## 3. Findings & dispositions

### FIXED (fix-first, live-reproduced RED→GREEN, in-scope authorized surfaces)

| # | Finding | Lens(es) | Sev | Fix + evidence |
|---|---------|----------|-----|----------------|
| **A** | `verifyStepUp` probe-error guard `if (!listed \|\| listed.error)` did NOT guard `{data:null,error:null}` → for an OAuth user it fell through to residual ACCEPT and the scrub ran with NO fresh proof (latent fail-OPEN on an irreversible op — the dangerous direction) | correctness-F3, literal-F5 | MED | `route.ts:313` → `\|\| !listed.data` (fail-CLOSED-retryable). Test **G-A** RED→GREEN. SDK-contract caveat: `{data:null,error:null}` is non-contractual (SEAM-verified data XOR error), so latent — fixed as defense-in-depth on the dangerous direction. |
| **B1** | `getUser()` had no `.catch` → an infra throw surfaced a raw 500, inconsistent with the `listFactors().catch` two lines below and with `requireDeveloper` (both fail-closed-retryable) | integration-seam-F2 | LOW | `route.ts:292-305` try/catch → throw=REAUTH_FAILED-retryable, distinct from no-user=UNAUTHORIZED. Test **G-B1** RED→GREEN (DC-08). |
| **B2** | `mfa.challenge`/`mfa.verify` THROW (not error-return) escaped the iterate loop → outer catch → status-inconsistent 500 (the handoff §3-ledgered low) | handoff §3 / DC-08 | LOW | `route.ts:347-366` per-factor try/catch → `continue` on throw (a throw can NEVER become an accept — only `!verifyError` returns ok). Tests **G-B2** (challenge + verify) RED→GREEN. |
| **C** | Delete-section UI: `mfaHasVerifiedFactor` defaults `false` on a mount-fetch FAILURE (network throw OR non-ok 500/429/401) → a verified-MFA developer is shown ONLY the password field while the server (live `listFactors`) demands a code → REAUTH_REQUIRED naming a field the UI never rendered = a dead-end (reload-recoverable, fail-closed, but degrades Art.17 control availability). The `:346-351` comment's "never goes stale" claim was false. | correctness-F1, literal-F2, integration-F1 (cross-lens) | MED | `settings/page.tsx` — added `mfaStatusKnown` (false until a successful GET); render shows the code field when `mfaHasVerifiedFactor \|\| !mfaStatusKnown` and the password field when `!mfaHasVerifiedFactor \|\| !mfaStatusKnown` → both fields + an amber note when status is unknown. Corrected the false comments. **UI not unit-tested per repo convention (§4.4)** → verified by tsc 0 / lint 0 + inspection (same caveat as the ② M2 fix). |
| **D** | sec-3a "capability from `user.identities`, NOT `app_metadata`" — the load-bearing hardening — was NOT pinned by any discriminating test (every fixture had `app_metadata` ≡ `identities`; a regression to `app_metadata.providers` would ship green). The exact M1 "collapsed-distinct-values vacuity" class (DC-05). | spec-conformance-F1 | MED | `route.test.ts` — added `HYDRATION_GAP_USER` (`app_metadata:{}`, `identities:[{email}]`) + test **G-D**. Proven non-vacuous LIVE: GREEN vs correct production; mutated `route.ts:347` to `app_metadata.providers` → **only G-D went RED** → reverted. Production needed NO change. |
| **G1-doc** | The 6-digit step-up's online brute-force resistance over the 30-day Art.17 window rests on GoTrue's server-side MFA-verify lockout (the frozen 5/min `authLimiter` alone is insufficient: ≈19–48% cumulative over a sustained hijacked session) — undocumented in `verifyStepUp`. | collective-miss-G1 | MED | Doc-only: `verifyStepUp` now names the GoTrue lockout as the load-bearing backstop + the `failMode:'open'` Art.17 trade-off + "do NOT add a local bucket (frozen)". Code/posture unchanged (rate-limit frozen). The ops-confirm + math are flagged §5. |

**Gate after the fix-fold (hardened tree): `tsc` 0 / `lint` 0 / `vitest` 209 files / 4797 tests**
(4792 baseline + 5 new ③ hardening tests). Account suite 34/34.

### ACCEPTED RESIDUALS (recorded; NOT fixed — frozen / out-of-scope / low-reachability)

| # | Finding | Lens | Sev | Why not fixed |
|---|---------|------|-----|---------------|
| **G2** | Concurrent same-subject double-submit (cross-`exportId` TOCTOU): both requests' find-or-reuse SELECT runs before either inserts → two fresh `exportId`s → the per-`exportId` processing guard doesn't serialize them → request B hits `processDataDeletion`'s already-erased guard (returns completed, NO re-scrub) → the endpoint takes the SUCCESS path and sends a **DUPLICATE** `accountDeletedEmail` + writes a **duplicate** completion-audit row (DC-17 violated outside the find-or-reuse path); a deadlock-aborted B can also emit a spurious 500 + false fail-alert. Scrub data stays correct. | collective-miss-G2, integration-seam | MED | **REAL latent defect, but FROZEN surface** (find-or-reuse / already-erased guard / email / completion-audit row — §5/§6) and **owned by the sealed predecessor** V-N3-deletion-wiring ③. This chunk does NOT worsen it (step-up runs before the machinery; for MFA users TOTP single-use rejection slightly SHRINKS the window). **RECOMMENDED follow-up:** gate email/audit on "freshly-completed" vs "already-erased/idempotent-completed", or add a partial-unique index `(entity_id) WHERE request_type='data-deletion' AND status IN ('pending','processing')`. |
| **G3** | The multi-factor iterate loop charges a failed attempt against EVERY verified factor's GoTrue counter per wrong code (~2N GoTrue calls per rate token) | collective-miss-G3 | LOW | Bounded (GoTrue caps factors ~10); critic itself ruled "accept". Optional: short-circuit on a GoTrue rate-limit signal. |
| **G4** | Rate-limit `failMode:'open'` removes the step-up's only attempt throttle on a Redis outage (compounds G1) | collective-miss-G4 | LOW | FROZEN + DELIBERATE (Art.17: `failMode:'closed'` would BLOCK erasure on outage — §6). Backstop = GoTrue (same as G1). |
| **SEAM-F1** | Step-up detects MFA via `listFactors().totp` only; getAAL/SDK count a verified `phone`/`webauthn` as AAL2 too → such a 2nd-factor-only account would be treated as non-MFA | SEAM | LOW | LATENT/UNREACHABLE — `mfa POST` enrolls `factorType:'totp'` exclusively; no phone/webauthn enroll path exists. Future note: broaden to `.all.filter(verified)` IF phone/webauthn enrollment is ever added. |
| **SEAM-F3** | The password-branch `signInWithPassword` mints a real GoTrue refresh token the no-op `setAll` cannot reclaim (orphaned, not leaked) | SEAM | LOW | Harmless side-effect; no client-side admin revoke available; standard cost of password-reauth. |
| **literal-F6** | `DELETE /api/auth/mfa` (unenroll) lacks the explicit same-origin check the account route has | literal-exec | LOW | FROZEN (CSRF list) + mitigated by `sameSite:'lax'` (not the R1 vector — R1 is session-hijack, not CSRF). Natural to add when step-up-on-unenroll (R1) is built. |
| **UI multi-factor desync** | `mfaFactorId` seeded from `factors[0]` regardless of status; `handleDisableMfa` sets `mfaHasVerifiedFactor=false` after one unenroll | correctness-F2/F5, literal-F3 | LOW | Requires out-of-band multi-enroll (stock UI hides Enable once enrolled); reload-recoverable; fail-closed. |
| **UI cross-tab staleness** | A snapshot flag can be stale-TRUE/FALSE vs a cross-tab MFA change | correctness-F4, integration-F1 | LOW | Reload-recoverable; server fail-closed. The C fix covers the fetch-FAILURE case; cross-tab known-but-stale remains accepted (a panel-open refetch would close it — optional future hardening). |

### RE-CERTIFIED (the seal's core, independently re-derived — NO break)

- INV-1…INV-5 all HOLD (see §1). No security bypass; no permanent Art.17 block of any account shape.
- **R1 MFA-unenroll-session-only bypass** (the headline residual): re-verified at SDK + DB source —
  OAuth+MFA-scoped, silent (no email/notify), self-scrubbing (compliance step 5 nulls the row's
  ip/ua/details). The `verifyStepUp` doc comment is literally accurate. The recommendation to make
  **step-up-on-unenroll the IMMEDIATE next chunk** (with a lost-authenticator recovery path) STANDS;
  the interim `notifyDeveloper(...,critical)` mitigant is sound-but-weaker (detect, not prevent).
- All 6 ② SEAM SDK-source claims re-confirmed at `@supabase/auth-js` (listFactors verified-only;
  challenge `data.id` always present; verify validates against the factor secret, not session AAL —
  the freshness foundation; no-op `setAll` breaks no flow — challengeId is in-band).
- **Frozen surfaces UNPERTURBED:** rate-limit posture, CSRF, self-scope, find-or-reuse,
  `processDataDeletion` + already-erased guard, email, completion-audit row — all unchanged. The only
  edits are within the authorized `verifyStepUp` + the settings delete-section UI + `route.test.ts`.

## 4. Defect-class ledger (③ fold)

- **DC-08 (implicit/wrong fail-mode)** — the dominant ③ theme. The step-up flow now fail-CLOSES-
  retryable on EVERY infra error path: listFactors (②), null-data (A), getUser (B1),
  challenge/verify throw (B2). The status-inconsistent 500s are eliminated; no fail-OPEN remains.
  DC-08 recurrence, fully harmonized — no new class.
- **DC-05 (test-double surface divergence / collapsed-distinct-values vacuity)** — SECOND instance of
  the M1 face (fixtures rigging two distinct real signals equal): the sec-3a `app_metadata ≡
  identities` vacuity (D). **Count 10 → 11.** CLOSED with `HYDRATION_GAP_USER`.
- **DC-03 (step-up control)** — re-affirmed fail-closed + self-scoped + the fail-OPEN hardening (A).
- **SEAM / LITERAL-EXECUTION** — re-validated; no new recurrence beyond the accepted LOW residuals.
- No NEW class minted.

## 5. OUTSTANDING (non-gated; operator / ops — surfaced, not silently dropped)

1. **§4.5 live TOTP smoke** — still un-run (no live Supabase; no automated test exercises the real
   `challenge`/`verify`/no-op-`setAll` GoTrue path). The only observation of the real integration.
   **Operator runs before `/push-go`.**
2. **G1 ops-confirm** — verify GoTrue's hosted MFA challenge/verify lockout is ENABLED (the
   load-bearing online-brute-force backstop, now documented in `verifyStepUp`). Confirm before
   production reliance.
3. **G2 follow-up** — recommend a concurrency-hardening chunk (duplicate email/audit + false
   fail-alert on concurrent same-subject submit), alongside/after the recommended step-up-on-unenroll
   (R1) chunk.

## 6. What ③ produced (working tree, awaiting operator commit + `/push-go`)

In-scope edits (path-scoped — stage ONLY these + this record; EXCLUDE `tools/page.tsx`
carry-forward, `.claude/`, `.audit/`):
- `apps/web/src/app/api/dashboard/developer/account/route.ts` (A + B1 + B2 + G1-doc)
- `apps/web/src/app/api/dashboard/developer/account/__tests__/route.test.ts` (+5 ③ tests, +1 fixture)
- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` (C)
- `docs/tech-debt/v-n3-deletion-stepup-mfa-postseal-deepaudit-2026-06-27.md` (this record)

Per cadence, push WAITS for ③; the next gate is `/push-go` (after the §4.5 smoke).
