import { NextRequest } from 'next/server'
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
// The CSRF + step-up controls are SHARED with the consumer erasure door
// (DELETE /api/consumer/account) so both drive the SAME certified controls —
// see @/lib/account-deletion.
import { isSameOriginRequest, verifyStepUp } from '@/lib/account-deletion'

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
