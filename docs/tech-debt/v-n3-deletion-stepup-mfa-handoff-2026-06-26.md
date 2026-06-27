# ① BUILD HANDOFF — V-N3-deletion-stepup-mfa — 2026-06-26

**Tier: HIGH-STAKES** (trigger: edits a security/auth control — the step-up re-auth gate on an
IRREVERSIBLE PII/GDPR destructive op — AND carries a correctness invariant, the GDPR Art. 17
accessibility guardrail "FORCE re-auth, never BLOCK erasure"). Initial tier; ② may escalate, not
de-escalate.

Lifecycle: scope-confirm ✓ → draft plan (this file) → **pre-build plan audit (THIS session, closes
before any build code)** → build (fresh single-writer agent) → gate → ② seal-gating review → seal.

---

## 0. READ FIRST (step zero, before any code)
1. **This handoff** (stand-alone spec).
2. **The binding design + threat model:** `docs/tech-debt/v-n3-deletion-wiring-post-seal-deep-audit-2026-06-26.md` §6
   (the ③ deep-audit's OAuth-step-up design — the operator chose "CLOSE MFA/AAL2 inline + sec-3a hardening
   as a small chunk; ACCEPT/defer pure-OAuth-no-MFA"). This is the authoritative intent.
3. **The surface to extend:** `apps/web/src/app/api/dashboard/developer/account/route.ts` — `verifyStepUp`
   (~243-288), `createRequestSupabase` (~295-310, the NO-OP `setAll` client), the DELETE body parse (~72-89).
4. **The MFA primitives:** `apps/web/src/app/api/auth/mfa/route.ts` — note the PUT handler's established
   pattern: `mfa.challenge({factorId})` → `mfa.verify({factorId, challengeId, code})` → reject on
   `verifyError`; `mfa.getAuthenticatorAssuranceLevel()` → `{currentLevel,nextLevel}`; `mfa.listFactors()`
   → `{totp:[{id,status,…}]}` (status `'verified'` for active factors).
5. **The UI to wire:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` — existing MFA state
   (`mfaEnrolled` ~345, fetched from `/api/auth/mfa` ~715), `handleDeleteAccount` (~989), the delete-section
   render (~2137-2175, the confirm-text input + the password input "leave blank if you sign in with Google
   or GitHub").
6. **The tests to preserve + extend:** `apps/web/src/app/api/dashboard/developer/account/__tests__/route.test.ts`
   — the "step-up re-auth (§13.8b)" describe (~177-207). The mock is `mockSupabaseAuth` (~51) — extend it
   with the mfa methods for the new branch.

## 1. INTENT — why this is built, who consumes it
The ③ deep audit (record §6) found the deletion endpoint's step-up re-auth covers password accounts but
NOT pure-OAuth accounts — a pure-OAuth user gets NO fresh proof-of-possession before the single most
irreversible op in the app (hard-deletes the Supabase auth user + anonymizes PII). The operator decided to
CLOSE the cheap, high-coverage half NOW: a **provider-agnostic MFA/AAL2 step-up branch** that covers every
MFA-enrolled user (incl. OAuth users who opted into 2FA — the security-conscious subset most likely to
care), using the in-tree `auth/mfa` primitives, inline in `verifyStepUp`. Plus the **sec-3a fail-open
hardening** (the `isPasswordUser` default skips step-up when provider metadata is absent). Consumer: the
human running the dashboard delete flow + the DELETE endpoint. Output: a deletion that demands a FRESH
credential (password OR MFA) from every account that HAS one, while never blocking an account that has
neither.

## 2. SCOPE (explicit — what's IN, what's OUT)
**IN (this chunk):**
- (a) Extend `verifyStepUp` with an **MFA/AAL2 branch**: an MFA-enrolled account (a `'verified'` TOTP
  factor exists) must supply a fresh `mfaCode` that passes a NEW `challenge`+`verify` on THIS request.
- (b) **sec-3a fail-open hardening (PARTIAL closure, by design):** derive password-capability from the
  authoritative `user.identities`, and order MFA-first — so a "password user whose `app_metadata` didn't
  hydrate" no longer silently skips step-up. The framing is "don't skip a user for whom a COMPLETABLE proof
  EXISTS," NOT "force a credential when none is determinable": the irreducible residual (no `identities`
  evidence AND no verified MFA) must ACCEPT, never force a password an OAuth user lacks (§3 LB-2). Document
  this residual in the `verifyStepUp` comment.
- (c) Wire the **settings UI**: show an MFA-code input in the delete section when `mfaEnrolled`; include
  `mfaCode` in the DELETE body; update the password-field hint to reflect the MFA path.
- (d) **Tests:** extend `route.test.ts` step-up coverage (MFA-required / wrong-code / correct-code /
  OAuth+MFA / password+MFA precedence / OAuth-no-MFA still accepts / sec-3a edge), PRESERVING every
  existing step-up test green.

**OUT (deferred — do NOT build; do NOT pull in):**
- Pure-OAuth, NO-MFA forced-IdP-reauth (OIDC `prompt=login`/`max_age` + sudo-marker redirect chunk) —
  ACCEPTED residual per record §6; this account shape continues to step-up via session + same-origin +
  typed confirm. A `verifyStepUp` comment must name it as the remaining residual.
- Platform-wide step-up on other ops (data-export, key rotate, webhooks).
- **MFA-unenroll-session-only** (`DELETE /api/auth/mfa` has no step-up) — see §5 SEAM; flag, do NOT fix here.
- Do NOT change the password branch's behavior for non-MFA password users (those existing tests stay green).

**Scoping decision:** stays as the operator-planned SMALL chunk — NOT merged with the other OPEN ③-routed
items (integ-1 badge leak, integ-3 stale SSG, integ-5 30-day purge, miss-1 prod-DDL CI assertion): those are
UNRELATED seams (public readers / cron purge / CI) and merging an incremental reader-fix into a high-stakes
auth-control chunk is forbidden (keep the auth audit focused on the auth seam).

## 3. THE TWO LOAD-BEARING DECISIONS (where audit judgment concentrates) — RESOLVED by the plan audit

The plan audit (4 lenses, all `claude-opus-4-8` @ xhigh, 2026-06-26) confirmed the DESIGN sound and pinned
the exact resolutions below. Source facts verified live: `listFactors().totp` is **verified-only**
(`GoTrueClient.js:2685 if (factor.status==='verified')`); `getAAL().nextLevel` counts phone/webauthn too
(`:2712/:2742`) → NOT the gate signal; the PUT `/api/auth/mfa` echoes raw `error.message` (`:139/:150`) →
mirror its FLOW, not its bodies; the no-op-`setAll` client completes challenge→verify fine (the `challengeId`
flows in-band, not via cookie — `_challenge`/`_verify`).

### LB-1 — MFA step-up FRESHNESS + verify semantics (fail-CLOSED, no session-AAL2 bypass)
A NEW `challenge`+`verify` on THIS request; an already-AAL2 session must NOT bypass (freshness = a code
entered now). Use the request-bound `createRequestSupabase` (NO-OP `setAll`) — verification is the control,
the elevated session is intentionally discarded. RESOLVED specifics:
- **Factor source (server-derived, NEVER from the body):** `const verified = (await
  client.auth.mfa.listFactors()).data?.totp?.filter(f => f.status==='verified') ?? []`. `hasVerifiedMfa =
  verified.length > 0`. Challenge `verified[0].id`. **Do NOT** use `getAAL()` for the gate (broader; no
  factorId), and **do NOT** read `getAAL().currentLevel` (that's the session-AAL2-bypass trap). The factorId
  is ALWAYS server-derived; never accept a body/query `factorId`.
- **Multiple verified factors:** a 6-digit code is opaque — you cannot tell which factor it belongs to.
  ITERATE `challenge`+`verify` across ALL `verified` factors; accept on the FIRST clean verify; reject only
  if every verified factor fails. (Single-factor is the common case, but the SDK allows >1 → a fixed-first
  challenge would false-REJECT a second-authenticator code = an LB-2 block.)
- **Positive check = `!challengeError && !verifyError`** (optionally `&& !!verifyData?.access_token`). There
  is NO `data.user.id` cross-check on the MFA path (verify is session-bound + the factorId is drawn from the
  user's own `listFactors()` — that binding IS the cross-user guard). Do NOT invent a `data.user` assertion
  (verify's data has no `user` → would false-reject → BLOCK).
- **Fail-CLOSED, retryable, NO leak:** mirror the PUT *control flow* (challenge → check `challengeError` →
  verify → check `verifyError`), but return FIXED strings — NEVER `error.message`, `factorId`, or
  `challengeId` (the deletion endpoint's no-raw-error/no-UUID contract). `REAUTH_REQUIRED` "Enter your 6-digit
  authenticator code." (missing/malformed code); `REAUTH_FAILED` "Incorrect or expired code." (challengeError
  or verifyError).
- **Probe-error = fail-CLOSED-retryable, NOT accept (DC-08):** if `listFactors()` itself ERRORS (network/SDK
  blip), do NOT default to "no MFA → accept" — for an OAuth+MFA user that silently skips the very control.
  Return a retryable `REAUTH_FAILED` ("Could not verify right now, try again"). A transient retryable block is
  Art.17-compliant (the 30-day window accommodates a retry); silently accepting on infra error is the wrong
  fail-mode.
- **Server-side shape guard:** validate `mfaCode` is `/^\d{6}$/` before any SDK call; malformed/empty →
  `REAUTH_REQUIRED` (don't waste a challenge round-trip; mirrors PUT's zod `verifySchema`).

### LB-2 — GDPR Art. 17 accessibility guardrail: FORCE re-auth, NEVER BLOCK erasure — CAPABILITY-KEYED + TERMINAL
The precedence keys on **server-derived capability**, and each branch is **TERMINAL** (a client cannot elect
a weaker proof):
- **`hasVerifiedMfa` (any provider) → require a fresh `mfaCode`; this branch is TERMINAL.** A correct password
  must NOT satisfy the gate for an MFA-enrolled account (else an attacker with the breached password but no
  authenticator bypasses MFA — sec-3 downgrade). password is ignored for MFA users.
- **else `isPasswordUser` → require the password** (built; unchanged for non-MFA password users). **Use
  `user.email`** (the Supabase auth email, already loaded in `verifyStepUp`) for `signInWithPassword`, NOT the
  passed `developers.email` — closes the routed literal-2 drift-block edge in its natural venue (record §4).
- **else (pure-OAuth no-MFA, OR the irreducible no-identities-no-MFA residual) → ACCEPT** (deferred residual;
  session+same-origin+confirm).

**Resolved traps:** (i) an `'unverified'`/enrolling-only factor is NOT MFA (the `status==='verified'` filter
makes it invisible) → falls to password/accept, never blocked/challenged; (ii) **sec-3a is only PARTIALLY
closed, by design:** deriving capability MFA-first + from the authoritative `user.identities` closes the
"password user whose `app_metadata` didn't hydrate" hole; the residual "no-`identities`-evidence AND no
verified MFA" must ACCEPT (never force a password an OAuth user lacks) — same residual class as
pure-OAuth-no-MFA. §2(b) means "don't skip a user for whom a completable proof EXISTS," NOT "force a
credential when none is determinable." (iii) NEVER mandate pre-enrolled MFA. **Every account shape gets a
per-shape test asserting none is BLOCKED — this invariant is the chunk's correctness core; ② re-derives it.**

**Lost-authenticator accessibility (MFA-first introduces it):** an MFA-enrolled user who lost their
authenticator is blocked by the terminal MFA branch; today their only completable path is to unenroll the
factor first (Security section). The UI delete-section MUST surface a "Lost your authenticator? Disable 2FA
in Settings → Security first." affordance so erasure stays completable (and §5's future unenroll-step-up must
preserve a recovery path).

## 4. BUILD SEQUENCE
1. `verifyStepUp(request, password, mfaCode?)` (drop the `email` param — use `user.email` inside; see LB-2):
   `getUser()`; compute `verified` + `hasVerifiedMfa` + the iterating MFA challenge/verify exactly per LB-1
   (server-derived factorId, fixed-string errors, probe-error fail-closed-retryable, `/^\d{6}$/` guard);
   derive `isPasswordUser` from `user.identities` with the sec-3a hardening; apply the LB-2 capability-keyed
   TERMINAL precedence. Return the existing `StepUpResult` shape (`{ok:true}` | `{ok:false,status,code,
   message}`). Reuse `REAUTH_REQUIRED`/`REAUTH_FAILED` codes. Add a `verifyStepUp` comment naming BOTH
   residuals (pure-OAuth-no-MFA AND the §5 session-only-unenroll bypass).
2. DELETE body parse (~72): add `mfaCode?` (read like `password`; `typeof===string`). Pass `password` +
   `mfaCode` to `verifyStepUp`. factorId is NEVER read from the body.
3. Settings UI delete section (~2137): add a DEDICATED `deleteMfaCode`/`setDeleteMfaCode` state (do NOT reuse
   the enrollment `mfaCode` state — that's an out-of-scope surface). Derive "has verified factor" for the UI
   from the GET `/api/auth/mfa` per-factor `status` (`factors.some(f=>f.status==='verified')`), NOT the
   `mfaEnrolled` length>0 signal (which counts unverified). When a verified factor exists: show ONLY the
   6-digit code input (hide/subordinate the password input) + the "Lost your authenticator? Disable 2FA in
   Settings → Security first." affordance; password input for non-MFA password users; both-blank hint for
   OAuth-no-MFA. Include `deleteMfaCode` in the DELETE body (~999, spread like `password`). Add `deleteMfaCode`
   to the Cancel reset (~2173). Keep the confirm-text gate.
4. Tests (`route.test.ts`) — extend `mockSupabaseAuth` with `mfa.listFactors`/`mfa.challenge`/`mfa.verify`
   (and `getAuthenticatorAssuranceLevel` only if used). **The `beforeEach` DEFAULT MUST be no-verified-MFA:**
   `mfa.listFactors` → `{data:{totp:[],phone:[],webauthn:[],all:[]},error:null}`, `mfa.challenge`/`mfa.verify`
   default to clean success; per-test override with `mockResolvedValueOnce`. PRESERVE the 4 existing step-up
   tests green (they assert the no-MFA defaults). ADD, each pinning a load-bearing claim:
   - MFA-enrolled, omit code → `REAUTH_REQUIRED`; wrong code → `REAUTH_FAILED` (fixed string, no factorId/raw
     leak); correct code → success + the scrub runs.
   - **Freshness (spec-1):** MFA-enrolled, session already AAL2 (`getAAL().currentLevel='aal2'`), omit/wrong
     code → STILL rejected AND `mfa.challenge`+`mfa.verify` were invoked (pins no-session-AAL2-bypass).
   - **Capability-terminal (sec-3/spec-6):** password+verified-MFA, sends a CORRECT password but no `mfaCode`
     → `REAUTH_REQUIRED` and `signInWithPassword` NOT called (the password must not satisfy an MFA account).
   - **Unverified-factor non-block (spec-2):** only an `'unverified'` factor → treated as non-MFA, NOT
     challenged, NOT blocked.
   - **Probe-error (sec-2):** `mfa.listFactors` rejects/errors → NOT accepted (retryable reject), for an
     OAuth-identity user.
   - **Multi-factor (literal-3):** two verified factors, code matches the SECOND → success (iteration).
   - OAuth-no-MFA → success without anything (LB-2 accept, `signInWithPassword` NOT called).
   - **sec-3a (spec-7):** ambiguous/empty `identities` + no MFA → ACCEPT (not forced-password / not blocked).
   - literal-2: a password user verifies against `user.email` (assert `signInWithPassword({email:user.email})`).
   (The settings-page UI wiring is not unit-tested per repo convention — note it in the seal record so "done"
   isn't read as proving the UI path; optionally a tiny assertion that `mfaCode` is spread only when present.)
5. Interval self-verification + gate (see kickoff directives). Plus a ONE-TIME manual live smoke (NOT gated;
   the unit suite fully mocks `@supabase/ssr` so no test exercises the real challenge/verify/no-op-setAll
   path): enroll a real TOTP factor, run the delete flow with correct code → succeeds, wrong code →
   `REAUTH_FAILED`, no code while enrolled → `REAUTH_REQUIRED`, confirming no elevated session cookie is
   written. Record the smoke result for ②.

## 5. SEAM — MFA-unenroll-session-only (flag, do NOT fix here) — risk framing CORRECTED by the plan audit
`DELETE /api/auth/mfa` (mfa/route.ts:179-234) unenrolls a factor on the bare session (no step-up). An
attacker holding a hijacked live session of an OAuth+MFA victim can unenroll FIRST, dropping the victim to the
OAuth-no-MFA ACCEPT path, then delete — bypassing this chunk's MFA step-up for exactly that subset (a
password+MFA victim still hits the password branch post-unenroll, so the bypass is OAuth+MFA-specific).
**CORRECTION (the draft over-stated the mitigant — verified at source):** the unenroll writes ONLY a
`security.mfa_disabled` audit ROW (`writeAuditLog` = a bare `db.insert`); it sends **NO email/notification**
(the mfa route never calls `notifyDeveloper`; grep-confirmed), AND `processDataDeletion` then NULLs that
row's `ipAddress/userAgent/details` (compliance.ts step 5) — so the unenroll is effectively **SILENT +
self-scrubbing** to the victim, not "notified." **Disposition:** still scope-deferred per the operator
(record §6 "track alongside"; distinct endpoint+op; closing it here expands scope), BUT framed honestly as
"raises the bar by one audited-but-silent step," NOT "closes step-up for MFA users." Recommend step-up-on-
MFA-unenroll as the **IMMEDIATE** next chunk (not merely "alongside"); a cheap independent interim mitigant
is to have `DELETE /api/auth/mfa` call `notifyDeveloper(..., critical)` so the bypass is at least detectable
out-of-band. That follow-up MUST preserve a lost-authenticator recovery path (§3 LB-2) so erasure stays
completable. The `verifyStepUp` residual comment names this bypass alongside pure-OAuth-no-MFA.

## 6. FROZEN / DO-NOT-PERTURB
The deletion endpoint's other controls are sealed and out of scope: the IP/uid rate-limit, the CSRF
same-origin check, self-scope on `auth.id`, find-or-reuse, `processDataDeletion` and its already-erased
guard, the email, the completion audit row. Touch ONLY `verifyStepUp` (signature: drop `email`, add
`mfaCode?`) + the DELETE body parse (additively), the settings UI delete section, and `route.test.ts`. No
schema change. No new endpoint.
**Rate-limit posture (do NOT change):** the endpoint's `authLimiter` (5/min IP+uid, runs BEFORE step-up so
every guess consumes a token) already bounds MFA-code brute-force (10⁶ space / 5-per-min ≈ 138 days) and is
intentionally STRICTER than the PUT mfa-verify's 100/min — do NOT "harmonize" it. It is `failMode:'open'` by
design; do **NOT** switch the deletion endpoint to `failMode:'closed'` (that would BLOCK erasure during a
rate-store outage = Art.17 denial). On a store outage the brute-force backstop degrades to GoTrue's own
server-side MFA challenge-and-verify limit — acceptable; just confirm that hosted limit is enabled (ops).

## 7. GATE
From `apps/web`: `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `npx vitest run` → all pass (current
baseline 209 files / 4781; this chunk ADDS step-up tests). The route.test is mock-based (fast); no pglite
needed for this chunk. Allowlisted: `Bash(npx tsc *)`, `Bash(npx vitest *)`, `Bash(npm run lint)`,
`Bash(git *)`.

## 8. DEFECT-CLASS LEDGER (fold into build awareness)
- **DC-03** (unauthenticated/forgeable mutation): the step-up IS a DC-03 control — fail-closed, self-scoped.
- **DC-08** (implicit wrong fail-mode): LB-1 fail-CLOSED on verify; LB-2 the Art.17 "never block" is the
  OPPOSITE fail-mode for accessibility — the build must get BOTH directions right (reject a bad proof; never
  block a legitimate erasure).
- **DC-12** (incomplete boundary guard): cover every account shape (the LB-2 matrix).
- **SEAM**: §5 (MFA-unenroll bypass) + LB-1 (match the PUT mfa verify pattern).
No NEW class expected; ② folds at bookkeeping.
