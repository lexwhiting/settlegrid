import { NextRequest } from 'next/server'
import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceExports, consumers, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { authLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { requestDataDeletion, processDataDeletion } from '@/lib/settlement/compliance'
import { accountDeletedEmail, sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'
import { isSameOriginRequest, verifyStepUp, createRequestSupabase } from '@/lib/account-deletion'

// A normal single-subject scrub completes well within this budget; set
// explicitly so a serverless TIMEOUT mid-scrub is bounded + recoverable (the
// cron data-retention re-driver retries 'failed' rows). Matches the developer
// door's maxDuration.
export const maxDuration = 60

/**
 * DELETE /api/consumer/account — authenticated CONSUMER self-service GDPR Art. 17
 * erasure DOOR (G5-3).
 *
 * NOT a standalone consumer-erase engine. Every authenticated consumer is a
 * developer-TWIN sharing ONE Supabase auth user (auth/callback creates BOTH a
 * `developers` row and a `consumers` row with the same `supabase_user_id`), so
 * this door resolves the developer twin and drives the SAME ③-certified
 * `processDataDeletion` pipeline the developer door uses — which already erases
 * BOTH halves (captures the consumer by normalized email, anonymizes both rows,
 * hard-deletes the shared Supabase auth user ONCE) with the full anonymize-in-
 * place cascade + audit census. Building a separate consumer engine that deleted
 * the shared auth user would break the developer twin's login while leaving
 * developer PII un-erased (handoff FOLD 1).
 *
 * SAME CONTROLS as the developer door (account/route.ts): the tight authLimiter
 * IP+uid rate limit, the isSameOriginRequest CSRF check, DELETE-not-GET, the
 * `confirm:'DELETE'` typed friction, and the SHARED verifyStepUp re-auth.
 *
 * NO requireEmailVerified gate (FOLD 2): Art. 17 erasure must NEVER be blocked —
 * requireEmailVerified THROWS for OAuth-unverified/drifted-email subjects, so
 * gating on it would deny a right. Routing through the MFA-gated developer-delete
 * also keeps the academic $500-credit recycle friction at exactly today's
 * founder-accepted level (no new lower-friction self-serve faucet); the erasure-
 * surviving academic-grant key is DEFERRED to the consumer-abuse fast-follow.
 *
 * Method note: DELETE (POST would also be acceptable). NEVER GET — the Supabase
 * `sameSite:'lax'` session cookie is sent on top-level GET navigations, so a GET
 * deletion route would be a deletion-by-link CSRF.
 */
export async function DELETE(request: NextRequest) {
  try {
    // ── 1. IP rate limit (BEFORE auth) — tight dedicated bucket on the auth
    //    limiter (5/min) since this is destructive + irreversible. ──
    const ip = getClientIp(request.headers)
    const ipRl = await checkRateLimit(authLimiter, `consumer-account-delete:${ip}`)
    if (!ipRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // ── 2. CSRF: explicit same-origin check (shared with the developer door). ──
    if (!isSameOriginRequest(request)) {
      return errorResponse('Cross-origin request rejected.', 403, 'CSRF_REJECTED')
    }

    // ── 3. Authenticate + capture the shared Supabase auth user. We read the
    //    Supabase user directly (need `user.id` to resolve/ensure the developer
    //    twin) then confirm a consumers row exists (requireConsumer parity). ──
    let user
    try {
      user = (await createRequestSupabase(request).auth.getUser()).data.user
    } catch {
      return errorResponse('Authentication required. Please sign in.', 401, 'UNAUTHORIZED')
    }
    if (!user) {
      return errorResponse('Authentication required. Please sign in.', 401, 'UNAUTHORIZED')
    }

    const [consumer] = await db
      .select({ id: consumers.id, email: consumers.email })
      .from(consumers)
      .where(eq(consumers.supabaseUserId, user.id))
      .limit(1)
    if (!consumer) {
      return errorResponse('Consumer account not found. Please complete registration.', 401, 'UNAUTHORIZED')
    }

    // ── 4. Per-user rate limit. ──
    const uidRl = await checkRateLimit(authLimiter, `consumer-account-delete:uid:${user.id}`)
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

    // ── 6. Step-up re-auth (SHARED control): `confirm:'DELETE'` is client-supplied
    //    and is NOT a security control. Require a FRESH credential re-verification
    //    before this irreversible op — capability-keyed TERMINAL precedence that
    //    forces a fresh credential from every account that HAS one while NEVER
    //    blocking erasure (GDPR Art. 17). ──
    const stepUp = await verifyStepUp(request, password, mfaCode)
    if (!stepUp.ok) {
      return errorResponse(stepUp.message, stepUp.status, stepUp.code)
    }

    // ── 7. Resolve the developer TWIN (FOLD 1) — or ensure one (FOLD 6). A
    //    DeveloperTwinConflictError means the caller's email matches a developer
    //    row bound to a DIFFERENT live auth user (a cross-identity collision) —
    //    refuse with a safe 409 rather than relink + irreversibly erase a foreign
    //    account. This is NOT an Art.17 block of the CALLER's own erasure. ──
    let developerId: string
    try {
      developerId = await resolveOrCreateDeveloperId(user.id, consumer.email)
    } catch (err) {
      if (err instanceof DeveloperTwinConflictError) {
        return errorResponse(
          'We could not resolve your account for deletion. Please contact privacy@settlegrid.ai to complete your request.',
          409,
          'ACCOUNT_RESOLUTION_CONFLICT',
        )
      }
      throw err
    }

    // ── 8. Idempotency find-or-reuse (mirrors the developer door §13.4):
    //    requestDataDeletion ALWAYS inserts a fresh 'pending' row, so find an
    //    existing non-'failed' data-deletion row for this developer and reuse it,
    //    so processDataDeletion's processing/completed guards are real and a
    //    double-submit maps to a sane status without leaking the exportId UUID. ──
    const [existing] = await db
      .select({ id: complianceExports.id, status: complianceExports.status })
      .from(complianceExports)
      .where(
        and(
          eq(complianceExports.entityType, 'provider'),
          eq(complianceExports.entityId, developerId),
          eq(complianceExports.requestType, 'data-deletion'),
          ne(complianceExports.status, 'failed'),
        ),
      )
      .orderBy(desc(complianceExports.createdAt))
      .limit(1)

    if (existing?.status === 'completed') {
      // Idempotent: already erased. No re-run, no second email.
      return successResponse({
        success: true,
        status: 'completed',
        alreadyDeleted: true,
        message: 'Your account has already been deleted.',
      })
    }
    if (existing?.status === 'processing') {
      return errorResponse('Account deletion is already in progress.', 409, 'DELETION_IN_PROGRESS')
    }

    // Reuse a stranded 'pending' row (a prior run that crashed between create and
    // process), else create a fresh one.
    const exportId = existing?.status === 'pending'
      ? existing.id
      : (await requestDataDeletion('provider', developerId)).id

    // ── 9. Run the deletion. processDataDeletion RETURNS {status} on the normal
    //    path but THROWS on a concurrent 'processing' race — map both without
    //    echoing the raw error (UUID leak / raw 500). ──
    let result: { status: string }
    try {
      result = await processDataDeletion(exportId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/already in progress/i.test(msg)) {
        return errorResponse('Account deletion is already in progress.', 409, 'DELETION_IN_PROGRESS')
      }
      logger.error('compliance.consumer_account_deletion.alert_failed', { developerId }, err)
      return errorResponse(
        'Account deletion could not be completed. Our team has been alerted and will retry; contact support@settlegrid.ai if this persists.',
        500,
        'DELETION_FAILED',
      )
    }

    if (result.status !== 'completed') {
      logger.error('compliance.consumer_account_deletion.alert_failed', { developerId, status: result.status })
      return errorResponse(
        'Account deletion could not be completed. Our team has been alerted and will retry; contact support@settlegrid.ai if this persists.',
        500,
        'DELETION_FAILED',
      )
    }

    // ── 10. Notify + audit. The email uses the consumer's pre-deletion address
    //    (the scrub anonymized both the developer and consumer email rows). The
    //    completion audit row post-dates the scrub, so it MUST carry no ip/ua/
    //    details field (that would escape step 5's scrub + falsify the "audit-log
    //    IP addresses are removed" disclosure); record ONLY the non-PII event. ──
    const template = accountDeletedEmail(consumer.email)
    const emailSent = await sendEmail({ to: consumer.email, subject: template.subject, html: template.html })
    if (!emailSent) {
      logger.error('compliance.consumer_account_deletion.email_failed', { developerId })
    }

    writeAuditLog({
      developerId,
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

/**
 * Thrown by {@link resolveOrCreateDeveloperId} when the caller's email matches a
 * developer row already bound to a DIFFERENT non-null Supabase auth user — a
 * cross-identity collision. The door maps it to a safe 409: it must never
 * relink + erase a FOREIGN account. This is NOT an "Art.17 block" of the
 * caller's OWN erasure (that invariant governs the caller's own data only).
 */
class DeveloperTwinConflictError extends Error {}

/**
 * Resolve the developer TWIN for this authenticated identity, or (FOLD 6) ENSURE
 * one when the auth/callback developer-branch insert failed — a rare authenticated
 * consumer with NO developer row (the callback swallows a dev-insert dbErr and
 * still creates the consumer row). Do NOT 404 the erasure right for this cohort.
 *
 * The ensured row is keyed to the consumer's OWN email so processDataDeletion's
 * normalized-email capture erases THIS consumer (and hard-deletes the shared auth
 * user via the consumer-side supabaseUserId even if the fresh dev row's link is
 * new). Mirrors the auth/callback dev-ensure ladder (by supabaseUserId → by email →
 * insert) so it is robust against the developers.email / supabase_user_id UNIQUE
 * constraints.
 */
async function resolveOrCreateDeveloperId(supabaseUserId: string, email: string): Promise<string> {
  const [bySupabase] = await db
    .select({ id: developers.id })
    .from(developers)
    .where(eq(developers.supabaseUserId, supabaseUserId))
    .limit(1)
  if (bySupabase) return bySupabase.id

  // FOLD 6: no developer twin for this auth user. Ensure one, mirroring
  // auth/callback's by-email relink → insert ladder.
  const [byEmail] = await db
    .select({ id: developers.id, supabaseUserId: developers.supabaseUserId })
    .from(developers)
    .where(eq(developers.email, email))
    .limit(1)
  if (byEmail) {
    // CORE-INVARIANT GUARD: NEVER relink — and then irreversibly erase — a
    // developer row already bound to a DIFFERENT live auth user. In the FOLD-6
    // window, under a Supabase email-collision (email-confirmation disabled, or an
    // IdP returning an unverified email), an attacker's consumer row could share a
    // victim's email; relinking that victim's developer row to the attacker's
    // supabaseUserId and driving its deletion would be a cross-identity erasure.
    // A legitimate FOLD-6 subject's OWN dev row is found by supabaseUserId above
    // (never reaching here) or carries a NULL link (relink permitted).
    if (byEmail.supabaseUserId && byEmail.supabaseUserId !== supabaseUserId) {
      throw new DeveloperTwinConflictError()
    }
    await db
      .update(developers)
      .set({ supabaseUserId, updatedAt: new Date() })
      .where(eq(developers.id, byEmail.id))
    return byEmail.id
  }

  const [inserted] = await db
    .insert(developers)
    .values({ email, supabaseUserId, updatedAt: new Date() })
    .returning({ id: developers.id })
  return inserted.id
}
