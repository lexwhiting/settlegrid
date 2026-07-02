import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Shared account-deletion controls for the GDPR Art. 17 erasure doors.
 *
 * These helpers are the SECURITY-CRITICAL controls that guard the (single,
 * ③-certified) `processDataDeletion` pipeline. They are extracted here so BOTH
 * erasure doors reuse the EXACT SAME control — never a re-implementation that
 * could silently drift weaker (the SEAM / DC-24 "toothless duplicate control"
 * hazard):
 *   - `DELETE /api/dashboard/developer/account` (the developer self-service door)
 *   - `DELETE /api/consumer/account` (the consumer-facing door, G5-3 — every
 *     authenticated consumer is a developer-twin sharing ONE Supabase auth user,
 *     so the consumer door drives the SAME developer-deletion that erases both
 *     halves; see docs/tech-debt/gdpr-access-consumer-erase-handoff-2026-07-02.md
 *     FOLD 1).
 *
 * The step-up guardrail is FORCE re-auth, NEVER BLOCK erasure, NEVER mandate
 * pre-enrolled MFA (GDPR Art. 17). Do NOT add a `requireEmailVerified` gate on
 * erasure (FOLD 2 — it would THROW for OAuth-unverified/drifted-email subjects
 * and BLOCK a right).
 */

/**
 * Explicit same-origin (CSRF) check (§13.8a). Prefers the `Sec-Fetch-Site`
 * metadata header (modern browsers send it on every request); falls back to an
 * Origin-vs-Host comparison for clients that omit it. A cross-site request is
 * rejected; a request with neither header (non-browser) is also rejected — this
 * is a UI-driven endpoint.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (secFetchSite) return secFetchSite === 'same-origin'
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  return false
}

export type StepUpResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string }

/**
 * Fresh step-up re-authentication for the irreversible account-deletion op
 * (§13.8b). Capability-keyed + TERMINAL precedence — the GDPR Art. 17 guardrail is
 * FORCE re-auth, NEVER BLOCK erasure, NEVER mandate pre-enrolled MFA:
 *
 *   1. hasVerifiedMfa (any provider, incl. OAuth) → a fresh `mfaCode` is REQUIRED,
 *      re-proven by a NEW challenge+verify on THIS request (freshness — an already-
 *      AAL2 session does NOT bypass; we never read `getAAL().currentLevel`).
 *      TERMINAL: a correct password must NOT satisfy an MFA-enrolled account (else a
 *      breached password without the authenticator downgrades MFA — sec-3).
 *   2. else isPasswordUser (an 'email' identity) → the password is REQUIRED and
 *      re-verified via a throwaway `signInWithPassword` against `user.email` (no
 *      session is persisted — `setAll` is a no-op).
 *   3. else (pure-OAuth no-MFA, OR the irreducible no-identities-evidence +
 *      no-verified-MFA residual) → ACCEPT: the live same-origin session + the typed
 *      confirmation are the control. We must NOT force a password an OAuth user lacks.
 *
 * Capability is SERVER-DERIVED only: the factor list comes from `listFactors()`
 * (the factorId is NEVER taken from the request body/query), and password-capability
 * is the authoritative `user.identities`, NOT `app_metadata` (which can fail to
 * hydrate and silently skip step-up — sec-3a; MFA-first ordering closes that hole
 * for MFA users, and the residual no-evidence shape ACCEPTS by design). Every error
 * body is a FIXED string — never a raw SDK message, factorId, or challengeId (this
 * endpoint's no-raw-error / no-UUID contract).
 *
 * ONLINE BRUTE-FORCE BACKSTOP: a 6-digit `mfaCode` has only 10^6 values, so over the
 * 30-day Art.17 window the endpoint's FROZEN 5/min `authLimiter` (IP+uid, consumed
 * before step-up) does not BY ITSELF make guessing a single victim's code infeasible.
 * The load-bearing backstop is GoTrue's own server-side MFA challenge/verify lockout
 * (and the rate-limit posture is intentionally `failMode:'open'` for Art.17 — on a
 * rate-store outage GoTrue's limit is the ONLY throttle). Ops MUST keep that hosted
 * limit enabled. Do NOT add a stricter local bucket here (the rate-limit posture is
 * frozen — see §6); a dedicated step-up-failure throttle is a separate chunk.
 *
 * RESIDUALS (deferred — flagged, NOT closed here):
 *  - **Pure-OAuth NO-MFA** gets no fresh proof-of-possession (forced-IdP-reauth via
 *    OIDC `prompt=login`/`max_age` + a short-TTL deletion-sudo marker is a separate
 *    redirect chunk). This shape steps up via session + same-origin + typed confirm.
 *  - **MFA-unenroll-session-only** (§5): `DELETE /api/auth/mfa` has no step-up. An
 *    attacker on a hijacked live OAuth+MFA session can unenroll the factor FIRST
 *    (silent + self-scrubbing audit row — no email/notification), dropping the
 *    victim to the OAuth-no-MFA ACCEPT path, then delete — bypassing THIS branch for
 *    the OAuth+MFA subset (a password+MFA victim still hits the password branch).
 *    Step-up-on-unenroll is the recommended IMMEDIATE next chunk and must preserve a
 *    lost-authenticator recovery path (so erasure stays completable).
 */
export async function verifyStepUp(
  request: NextRequest,
  password: string | undefined,
  mfaCode: string | undefined,
): Promise<StepUpResult> {
  const client = createRequestSupabase(request)
  // getUser is an identity PROBE. A genuine no-session → UNAUTHORIZED, but a transient
  // THROW (network/SDK blip) → fail-CLOSED-retryable REAUTH_FAILED, mirroring the
  // listFactors().catch policy below — never a raw 500 on this Art.17 path (DC-08).
  let user
  try {
    user = (await client.auth.getUser()).data.user
  } catch {
    return {
      ok: false,
      status: 401,
      code: 'REAUTH_FAILED',
      message: 'Could not verify your session right now. Please try again.',
    }
  }
  if (!user) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' }
  }

  // ── (1) MFA/AAL2 branch (LB-1). Server-derived verified TOTP factors ONLY — the
  //    factorId is never taken from the request. `listFactors().totp` is verified-
  //    only at the SDK level; the explicit `status==='verified'` filter is defensive
  //    AND makes an enrolling-only ('unverified') factor invisible — it is NOT MFA,
  //    so it falls through to password/accept, never blocked or challenged. ──
  const listed = await client.auth.mfa.listFactors().catch(() => null)
  if (!listed || listed.error || !listed.data) {
    // DC-08 probe-error → fail-CLOSED-retryable, NOT accept: an errored/throwing
    // listFactors() for an OAuth+MFA user must not silently skip the very control. A
    // transient retryable block is Art.17-compliant (the 30-day window accommodates a
    // retry); silently accepting on infra error is the wrong fail-mode. The `!listed.data`
    // arm also fail-CLOSES a non-contractual `{data:null,error:null}` return (the SDK
    // contract is data XOR error) so a malformed payload cannot downgrade an OAuth+MFA
    // account to the residual ACCEPT — fail-OPEN is the dangerous direction on an
    // irreversible op.
    return {
      ok: false,
      status: 401,
      code: 'REAUTH_FAILED',
      message: 'Could not verify your authenticator right now. Please try again.',
    }
  }
  const verifiedFactors = (listed.data?.totp ?? []).filter((f) => f.status === 'verified')

  if (verifiedFactors.length > 0) {
    // Shape guard BEFORE any SDK round-trip (mirrors the PUT mfa-verify zod schema).
    if (!mfaCode || !/^\d{6}$/.test(mfaCode)) {
      return {
        ok: false,
        status: 401,
        code: 'REAUTH_REQUIRED',
        message: 'Enter your 6-digit authenticator code.',
      }
    }
    // A 6-digit code is opaque — we cannot tell which factor it belongs to. ITERATE a
    // FRESH challenge+verify across ALL verified factors; accept on the first clean
    // verify (positive = `!challengeError && !verifyError`; there is NO data.user.id
    // cross-check — the factorId is drawn from the user's own listFactors(), which IS
    // the cross-user binding). Reject only if every verified factor fails (a fixed-
    // first challenge would false-REJECT a second-authenticator code = an Art.17 block).
    for (const factor of verifiedFactors) {
      try {
        const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({
          factorId: factor.id,
        })
        if (challengeError || !challengeData) continue
        const { error: verifyError } = await client.auth.mfa.verify({
          factorId: factor.id,
          challengeId: challengeData.id,
          code: mfaCode,
        })
        if (!verifyError) return { ok: true }
      } catch {
        // Infra THROW on this factor (network/SDK blip) → treat as a failed attempt and
        // try the next; a throw can NEVER become an accept (the only ok:true is the clean
        // !verifyError above). If every verified factor fails/throws we fall to the fixed
        // REAUTH_FAILED below — fail-CLOSED-retryable, harmonizing with listFactors (DC-08;
        // pre-③ an uncaught throw surfaced a status-inconsistent 500 instead).
        continue
      }
    }
    return {
      ok: false,
      status: 401,
      code: 'REAUTH_FAILED',
      message: 'Incorrect or expired code. Please try again.',
    }
  }

  // ── (2) Password branch (sec-3a-hardened LB-2). Password-capability is the
  //    AUTHORITATIVE `user.identities` (NOT app_metadata). `user.email` is the
  //    Supabase auth email already loaded above — NOT the passed developers.email —
  //    closing the literal-2 drift edge. A password identity with no resolvable
  //    email cannot complete a password proof → falls through to ACCEPT rather than
  //    BLOCK (Art.17). ──
  const passwordEmail = Array.isArray(user.identities) && user.identities.some((i) => i.provider === 'email')
    ? user.email
    : undefined

  if (passwordEmail) {
    if (!password) {
      return {
        ok: false,
        status: 401,
        code: 'REAUTH_REQUIRED',
        message: 'Please re-enter your password to confirm account deletion.',
      }
    }
    // Re-verify WITHOUT clobbering the live session (no-op setAll discards it).
    const { data, error } = await client.auth.signInWithPassword({ email: passwordEmail, password })
    if (error || data?.user?.id !== user.id) {
      return {
        ok: false,
        status: 401,
        code: 'REAUTH_FAILED',
        message: 'Incorrect password. Please try again.',
      }
    }
    return { ok: true }
  }

  // ── (3) Residual ACCEPT (LB-2): pure-OAuth no-MFA, OR the irreducible
  //    no-identities-evidence + no-verified-MFA shape (sec-3a closes only PARTIALLY,
  //    by design). Session + same-origin + typed confirm is the control. See the
  //    RESIDUALS note in the doc comment above. ──
  return { ok: true }
}

/**
 * A Supabase server client bound to the request cookies whose `setAll` is a
 * no-op: the deletion routes either end the session (deletion) or only READ
 * identity / verify a password, so they must never write refreshed/new session
 * cookies.
 */
export function createRequestSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          /* no-op: never persist a refreshed or freshly-signed-in session here */
        },
      },
    },
  )
}
