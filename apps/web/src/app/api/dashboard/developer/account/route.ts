import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceExports } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { requestDataDeletion, processDataDeletion } from '@/lib/settlement/compliance'
import { accountDeletedEmail, sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'

// A normal single-developer scrub completes well within this budget; set
// explicitly so a serverless TIMEOUT mid-scrub is bounded + recoverable (the
// cron data-retention re-driver retries 'failed' rows and resets stale
// 'processing' rows older than this — see §13.7).
export const maxDuration = 60

/**
 * DELETE /api/dashboard/developer/account — authenticated developer self-service
 * GDPR Art. 17 erasure. Activates the (previously dormant) processDataDeletion.
 *
 * Method note: DELETE (POST would also be acceptable). NEVER GET — the Supabase
 * `sameSite:'lax'` session cookie is sent on top-level GET navigations, so a GET
 * deletion route would be a deletion-by-link CSRF (§13.8a).
 *
 * NO TIER GATE (§3.2 / §13.13): account deletion is a GDPR Art. 17 right and MUST
 * NOT be gated on `hasFeature(...)` — a free-tier developer can delete their
 * account. Do NOT "helpfully" copy the data-export route's tier gate here.
 *
 * Self-scope (DC-03): operates ONLY on the authenticated developer's own id
 * (`entityId = auth.id`). There is NO body/path-supplied target id — a destructive
 * route must be IDOR-safe.
 */
export async function DELETE(request: NextRequest) {
  try {
    // ── 1. IP rate limit (BEFORE auth) — tight dedicated bucket on the auth
    //    limiter (5/min) since this is destructive + irreversible (§13.11; a
    //    read-only 100/min apiLimiter would amplify the double-submit race). ──
    const ip = getClientIp(request.headers)
    const ipRl = await checkRateLimit(authLimiter, `account-delete:${ip}`)
    if (!ipRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // ── 2. CSRF: explicit same-origin check (§13.8a). The session cookie's
    //    implicit sameSite:'lax' is the ONLY other defense; add an explicit
    //    Origin / Sec-Fetch-Site check so a cross-site caller is rejected. ──
    if (!isSameOriginRequest(request)) {
      return errorResponse('Cross-origin request rejected.', 403, 'CSRF_REJECTED')
    }

    // ── 3. Authenticate + self-scope. auth.email is captured HERE, before the
    //    scrub anonymizes developers.email (step 1) — needed for the email. ──
    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // ── 4. Per-user rate limit. ──
    const uidRl = await checkRateLimit(authLimiter, `account-delete:uid:${auth.id}`)
    if (!uidRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // ── 5. Parse body + confirmation friction (defense-in-depth vs the client
    //    check; NOT a security control — see step 6). ──
    const body = (await request.json().catch(() => ({}))) as {
      confirm?: unknown
      password?: unknown
      mfaCode?: unknown
    }
    if (body?.confirm !== 'DELETE') {
      return errorResponse('Type DELETE to confirm account deletion.', 422, 'CONFIRMATION_REQUIRED')
    }
    const password = typeof body?.password === 'string' ? body.password : undefined
    // factorId is NEVER read from the body — it is server-derived in verifyStepUp.
    const mfaCode = typeof body?.mfaCode === 'string' ? body.mfaCode : undefined

    // ── 6. Step-up re-auth (§13.8b): `confirm:'DELETE'` is client-supplied and is
    //    NOT a security control. Require a FRESH credential re-verification before
    //    this irreversible op. verifyStepUp applies a capability-keyed TERMINAL
    //    precedence (MFA-enrolled → fresh `mfaCode` challenge+verify; else
    //    password-capable → fresh password sign-in; else ACCEPT), forcing a fresh
    //    credential from every account that HAS one while never blocking erasure
    //    (GDPR Art. 17). The deferred residuals (pure-OAuth-no-MFA forced-IdP-reauth
    //    + MFA-unenroll-session-only) are documented on verifyStepUp. ──
    const stepUp = await verifyStepUp(request, password, mfaCode)
    if (!stepUp.ok) {
      return errorResponse(stepUp.message, stepUp.status, stepUp.code)
    }

    // ── 7. Idempotency find-or-reuse (§13.4): requestDataDeletion ALWAYS inserts
    //    a fresh 'pending' row, so processDataDeletion's processing/completed
    //    guards (keyed on exportId) would never fire via this endpoint. Find an
    //    existing non-'failed' data-deletion row for this developer and reuse it,
    //    so the guard is real and double-submit maps to a sane status (§13.5):
    //    a raw re-throw would surface a 500 AND leak the exportId UUID. ──
    const [existing] = await db
      .select({ id: complianceExports.id, status: complianceExports.status })
      .from(complianceExports)
      .where(
        and(
          eq(complianceExports.entityType, 'provider'),
          eq(complianceExports.entityId, auth.id),
          eq(complianceExports.requestType, 'data-deletion'),
          ne(complianceExports.status, 'failed'),
        ),
      )
      .orderBy(desc(complianceExports.createdAt))
      .limit(1)

    if (existing?.status === 'completed') {
      // Idempotent: already erased. No re-run, no second email (DC-17).
      return successResponse({
        success: true,
        status: 'completed',
        alreadyDeleted: true,
        message: 'Your account has already been deleted.',
      })
    }
    if (existing?.status === 'processing') {
      // A run is (or appears to be) in flight — fixed string, no UUID leak.
      return errorResponse('Account deletion is already in progress.', 409, 'DELETION_IN_PROGRESS')
    }

    // Reuse a stranded 'pending' row (a prior run that crashed between create and
    // process), else create a fresh one.
    const exportId = existing?.status === 'pending'
      ? existing.id
      : (await requestDataDeletion('provider', auth.id)).id

    // ── 8. Run the deletion. processDataDeletion RETURNS {status} on the normal
    //    path but THROWS on a concurrent 'processing' race — map both without
    //    echoing the raw error (UUID leak / raw 500, §13.5). ──
    let result: { status: string }
    try {
      result = await processDataDeletion(exportId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/already in progress/i.test(msg)) {
        return errorResponse('Account deletion is already in progress.', 409, 'DELETION_IN_PROGRESS')
      }
      // Any other throw is an unexpected failure — alert + generic message.
      logger.error('compliance.account_deletion.alert_failed', { developerId: auth.id }, err)
      return errorResponse(
        'Account deletion could not be completed. Our team has been alerted and will retry; contact support@settlegrid.ai if this persists.',
        500,
        'DELETION_FAILED',
      )
    }

    if (result.status !== 'completed') {
      // FAIL-MODE ALERT (§13.7a): the scrub did not complete. If it failed at or
      // after the F-B1 pre-commit, the account is DEACTIVATED (api_keys revoked +
      // tools deleted) with the scrub incomplete; if it failed earlier (the pre-txn
      // auth-delete / capture), the account may still be live. Either way it is
      // retryable — the cron re-driver re-runs it idempotently; page now so it is
      // not silent.
      logger.error('compliance.account_deletion.alert_failed', { developerId: auth.id, status: result.status })
      return errorResponse(
        'Account deletion could not be completed. Our team has been alerted and will retry; contact support@settlegrid.ai if this persists.',
        500,
        'DELETION_FAILED',
      )
    }

    // ── 9. Notify + audit. The email uses the pre-deletion address (step 1
    //    anonymized developers.email). NO exportUrl: the deletion resultUrl is
    //    raw JSON and is NOT served (the data-export/[id] route 500s on a
    //    non-base64 URL) — do not offer a download link (§13.13). ──
    const template = accountDeletedEmail(auth.email)
    const emailSent = await sendEmail({ to: auth.email, subject: template.subject, html: template.html })
    if (!emailSent) {
      logger.error('compliance.account_deletion.email_failed', { developerId: auth.id })
    }

    // Audit AFTER the scrub completes (step 5 already ran), so this trail row
    // survives as a durable completion marker keyed to the retained pseudonymous
    // developerId. It MUST carry no field the deletion's `anonymized` disclosure
    // (and the public docs: "audit-log IP addresses are removed") claims is nulled:
    // this row post-dates step 5's audit scrub, so any ip_address / user_agent /
    // details set here would ESCAPE the scrub and falsify that positive "nulled"
    // claim (DC-16) — and re-introduce the erased user's IP. Record ONLY the non-PII
    // completion event (action + the compliance_exports row id). The emailSent
    // outcome lives in the logs above + the durable compliance_exports row.
    writeAuditLog({
      developerId: auth.id,
      action: 'privacy.account_deletion_completed',
      resourceType: 'compliance_export',
      resourceId: exportId,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({
      success: true,
      status: 'completed',
      emailSent,
      message: 'Your account has been deleted.',
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Explicit same-origin (CSRF) check (§13.8a). Prefers the `Sec-Fetch-Site`
 * metadata header (modern browsers send it on every request); falls back to an
 * Origin-vs-Host comparison for clients that omit it. A cross-site request is
 * rejected; a request with neither header (non-browser) is also rejected — this
 * is a UI-driven endpoint.
 */
function isSameOriginRequest(request: NextRequest): boolean {
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

type StepUpResult =
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
async function verifyStepUp(
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
 * no-op: this route either ends the session (deletion) or only READS identity /
 * verifies a password, so it must never write refreshed/new session cookies.
 */
function createRequestSupabase(request: NextRequest) {
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
