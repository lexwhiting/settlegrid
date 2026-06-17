import { db } from '@/lib/db'
import {
  complianceExports,
  developers,
  consumers,
  tools,
  invocations,
  apiKeys,
  developerApiKeys,
  payouts,
  webhookEndpoints,
  referrals,
  auditLogs,
  toolReviews,
  waitlistSignups,
} from '@/lib/db/schema'
import { eq, and, gte, desc, inArray, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { deleteSupabaseAuthUser } from '@/lib/supabase/admin'

// ---- Types ------------------------------------------------------------------

export type ComplianceRequestType = 'data-export' | 'data-deletion'
export type ComplianceEntityType = 'customer' | 'provider'
export type ComplianceStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ---- GDPR Data Export -------------------------------------------------------

export async function requestDataExport(
  entityType: ComplianceEntityType,
  entityId: string
): Promise<{ id: string; status: ComplianceStatus }> {
  const [record] = await db
    .insert(complianceExports)
    .values({
      requestType: 'data-export',
      entityType,
      entityId,
      status: 'pending',
    })
    .returning({ id: complianceExports.id, status: complianceExports.status })

  logger.info('compliance.data_export_requested', {
    exportId: record.id,
    entityType,
    entityId,
  })

  return { id: record.id, status: record.status as ComplianceStatus }
}

// ---- GDPR Data Deletion (Right to Erasure) ----------------------------------

export async function requestDataDeletion(
  entityType: ComplianceEntityType,
  entityId: string
): Promise<{ id: string; status: ComplianceStatus }> {
  const [record] = await db
    .insert(complianceExports)
    .values({
      requestType: 'data-deletion',
      entityType,
      entityId,
      status: 'pending',
    })
    .returning({ id: complianceExports.id, status: complianceExports.status })

  logger.info('compliance.data_deletion_requested', {
    exportId: record.id,
    entityType,
    entityId,
  })

  return { id: record.id, status: record.status as ComplianceStatus }
}

// ---- Status Check -----------------------------------------------------------

export async function getExportStatus(
  exportId: string
): Promise<{
  id: string
  requestType: string
  entityType: string
  entityId: string
  status: ComplianceStatus
  resultUrl: string | null
  completedAt: Date | null
  createdAt: Date
} | null> {
  const [record] = await db
    .select()
    .from(complianceExports)
    .where(eq(complianceExports.id, exportId))
    .limit(1)

  if (!record) return null

  return {
    id: record.id,
    requestType: record.requestType,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status as ComplianceStatus,
    resultUrl: record.resultUrl,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
  }
}

// ---- Collect Developer Data (GDPR Article 20) --------------------------------

/**
 * Query all developer data from the database for a GDPR data export.
 * Returns a structured JSON object with profile, tools, invocations (last 90 days),
 * payouts, webhooks, referrals, and audit logs.
 */
/** Valid category keys for selective data export */
export type ExportCategory = 'profile' | 'tools' | 'invocations' | 'payouts' | 'webhooks' | 'audit_logs'

export const ALL_EXPORT_CATEGORIES: ExportCategory[] = [
  'profile', 'tools', 'invocations', 'payouts', 'webhooks', 'audit_logs',
]

export async function collectDeveloperData(
  developerId: string,
  categories?: ExportCategory[],
  days?: number,
): Promise<Record<string, unknown>> {
  const lookbackDays = days ?? 90
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

  const cats = new Set(categories ?? ALL_EXPORT_CATEGORIES)

  // Build parallel query array based on requested categories
  const queries: Promise<unknown>[] = []
  const queryKeys: string[] = []

  if (cats.has('profile')) {
    queryKeys.push('profile')
    queries.push(db.select().from(developers).where(eq(developers.id, developerId)).limit(1))
  }

  if (cats.has('tools')) {
    queryKeys.push('tools')
    queries.push(db.select().from(tools).where(eq(tools.developerId, developerId)).orderBy(desc(tools.createdAt)))
  }

  if (cats.has('invocations')) {
    queryKeys.push('invocations')
    queries.push(
      db
        .select({
          id: invocations.id,
          toolId: invocations.toolId,
          consumerId: invocations.consumerId,
          method: invocations.method,
          costCents: invocations.costCents,
          latencyMs: invocations.latencyMs,
          status: invocations.status,
          isTest: invocations.isTest,
          createdAt: invocations.createdAt,
        })
        .from(invocations)
        .innerJoin(tools, eq(invocations.toolId, tools.id))
        .where(and(eq(tools.developerId, developerId), gte(invocations.createdAt, sql`${cutoffDate.toISOString()}::timestamptz`)))
        .orderBy(desc(invocations.createdAt))
        .limit(10000)
    )
  }

  if (cats.has('payouts')) {
    queryKeys.push('payouts')
    queries.push(db.select().from(payouts).where(eq(payouts.developerId, developerId)).orderBy(desc(payouts.createdAt)))
  }

  if (cats.has('webhooks')) {
    queryKeys.push('webhooks')
    queries.push(
      db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.developerId, developerId))
        .orderBy(desc(webhookEndpoints.createdAt))
    )
  }

  // Referrals are included whenever profile or tools are requested
  if (cats.has('profile') || cats.has('tools')) {
    queryKeys.push('referrals')
    queries.push(db.select().from(referrals).where(eq(referrals.referrerId, developerId)).orderBy(desc(referrals.createdAt)))
  }

  if (cats.has('audit_logs')) {
    queryKeys.push('audit_logs')
    queries.push(
      db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.developerId, developerId), gte(auditLogs.createdAt, sql`${cutoffDate.toISOString()}::timestamptz`)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(5000)
    )
  }

  const results = await Promise.all(queries)

  // Build result map keyed by queryKeys
  const resultMap = new Map<string, unknown>()
  for (let i = 0; i < queryKeys.length; i++) {
    resultMap.set(queryKeys[i], results[i])
  }

  const output: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.1',
    categories: [...cats],
    lookbackDays,
  }

  if (resultMap.has('profile')) {
    const profileRows = resultMap.get('profile') as typeof developers.$inferSelect[]
    output.profile = profileRows[0]
      ? { ...profileRows[0], passwordHash: undefined }
      : null
  }
  if (resultMap.has('tools')) {
    output.tools = resultMap.get('tools')
  }
  if (resultMap.has('invocations')) {
    output.invocations = resultMap.get('invocations')
  }
  if (resultMap.has('payouts')) {
    output.payouts = resultMap.get('payouts')
  }
  if (resultMap.has('webhooks')) {
    const webhookRows = resultMap.get('webhooks') as typeof webhookEndpoints.$inferSelect[]
    output.webhookEndpoints = webhookRows.map((w) => ({
      ...w,
      secret: '[REDACTED]',
    }))
  }
  if (resultMap.has('referrals')) {
    output.referrals = resultMap.get('referrals')
  }
  if (resultMap.has('audit_logs')) {
    output.auditLogs = resultMap.get('audit_logs')
  }

  return output
}

// ---- Process Data Export (GDPR Article 20) ----------------------------------

/**
 * Process a data export request.
 * Queries all developer data from the database, encodes it as a base64 data URL,
 * and stores the result in the compliance_exports record.
 *
 * Status machine ((E), 2026-06-05): pending → processing → completed | failed.
 * - 'completed': re-runs are an idempotent NO-OP — returns the stored resultUrl
 *   (symmetry with processDataDeletion; GDPR Art. 20 processors retry).
 * - 'failed': RETRYABLE. processDataExport performs NO destructive write —
 *   collectDeveloperData is read-only and the only state is this export's own
 *   status row — so 'failed' implies nothing was persisted and a retry re-collects
 *   fresh. NB: unlike processDataDeletion there is NO db.transaction here; the
 *   retry-safety proof rests on read-only collection, not transactional atomicity.
 * - 'processing': guarded (throws) — another run is, or appears to be, in flight.
 */
export async function processDataExport(
  exportId: string,
  categories?: ExportCategory[],
  days?: number,
): Promise<{ status: ComplianceStatus; resultUrl: string | null }> {
  const [record] = await db
    .select()
    .from(complianceExports)
    .where(eq(complianceExports.id, exportId))
    .limit(1)

  if (!record) {
    throw new Error(`Export request not found: ${exportId}`)
  }

  if (record.requestType !== 'data-export') {
    throw new Error(`Not a data-export request: ${record.requestType}`)
  }

  if (record.status === 'completed') {
    // (E) idempotent no-op — the export already ran to completion. Re-runs
    // must not throw (symmetry with processDataDeletion). Returns the stored URL.
    logger.info('compliance.data_export_already_completed', { exportId })
    return { status: 'completed', resultUrl: record.resultUrl ?? null }
  }

  if (record.status === 'processing') {
    // Concurrency guard: another run is (or appears to be) in flight.
    throw new Error(`Export already in progress: ${exportId}`)
  }

  // 'pending' (first run) and 'failed' (retry) both proceed. Retry safety:
  // processDataExport performs NO destructive write — collectDeveloperData is
  // read-only and the only state is this export's own status row — so 'failed'
  // implies nothing was persisted and a retry re-collects fresh. (No db.transaction;
  // proof differs from processDataDeletion's atomicity proof — see build plan §1.6.)

  // Mark as processing
  await db
    .update(complianceExports)
    .set({ status: 'processing' })
    .where(eq(complianceExports.id, exportId))

  try {
    // Collect developer data (optionally filtered by categories and time range)
    const exportData = await collectDeveloperData(record.entityId, categories, days)

    // Encode the JSON as a base64 data URL for storage in the DB
    const jsonString = JSON.stringify(exportData, null, 2)
    const base64 = Buffer.from(jsonString, 'utf-8').toString('base64')
    const resultUrl = `data:application/json;base64,${base64}`

    await db
      .update(complianceExports)
      .set({
        status: 'completed',
        resultUrl,
        completedAt: new Date(),
      })
      .where(eq(complianceExports.id, exportId))

    logger.info('compliance.data_export_completed', {
      exportId,
      entityType: record.entityType,
      entityId: record.entityId,
      dataSizeBytes: jsonString.length,
    })

    return { status: 'completed', resultUrl }
  } catch (err) {
    await db
      .update(complianceExports)
      .set({ status: 'failed' })
      .where(eq(complianceExports.id, exportId))

    logger.error('compliance.data_export_failed', { exportId }, err)
    return { status: 'failed', resultUrl: null }
  }
}

// ---- Process Data Deletion (GDPR Article 17) --------------------------------

/**
 * Process a pending data deletion request.
 *
 * Deletes the developer's Supabase AUTH user (the `auth.users` row holding the
 * email/login identity) — BEFORE the DB transaction, since that is an external
 * call that cannot be transactional — then anonymizes the requesting developer's
 * own identifying PII at its source — the `developers` row (step 1: name, email,
 * bio, avatar, auth/Stripe linkage, notification webhooks) — and scrubs or
 * deletes the related consumer, API-key, invocation-metadata, audit-log
 * (IP/UA/details — across the developer's own rows, the consumer twin's
 * consumerId-keyed rows, and cross-principal rows that name the developer as
 * their 'developer'/'developer_signup' resource), webhook, marketing-waitlist,
 * review (the consumer twin's comments + the developer's own review responses),
 * and tool rows (including each tool's source-repo/proxy/crawl-metadata infra
 * fields), in a single transaction. The Supabase auth user holds the email, so a deletion that only
 * nulled `developers.supabaseUserId` would leave the login identity alive; this
 * hard-deletes it (see {@link deleteSupabaseAuthUser}).
 *
 * Financial records (payouts, purchases, ledger_entries, settlement_batches) are
 * RETAINED for 7-year IRS / Stripe bookkeeping and are NOT rewritten here. They
 * reference the developer only by an internal developer ID — directly, via the
 * owning tool, or denormalized into a row's JSON (e.g. settlement_batches'
 * `disbursements`) — which now resolves to the anonymized `developers` row, so
 * they carry no developer-identifying PII of their own.
 *
 * KNOWN GAP — `ledger_entries` additionally persists the anonymous on-chain
 * PAYER's raw EVM address in `operation_id` ({rail}:{network}:{payer}:{nonce})
 * and `metadata.payer`. This deletion does NOT touch those columns, so that
 * address is retained UN-scrubbed. Its lawful basis and any erasure/tombstoning
 * path are unsettled and routed to the V-N3-erasure chunk (counsel pending); see
 * docs/tech-debt/v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md.
 *
 * DEFERRED — a developer-owned organization's `organizations.billing_email` is
 * likewise retained un-scrubbed here: it is a DISTINCT entity's data (an org that
 * may have other members), and whether/how to scrub organization data on member
 * deletion is unsettled, routed separately. It is disclosed in the resultUrl
 * `retainedUnscrubbed` (column path only) and this deletion does not touch
 * `organizations`/`organization_members`.
 *
 * DEFERRED — a developer-linked consumer account's financial/referral linkage
 * (`consumers.stripe_customer_id`, `consumers.default_payment_method_id`,
 * `consumers.referral_code`) is likewise retained un-scrubbed here: step 2
 * anonymizes only the consumer's email/supabaseUserId/passwordHash. The
 * consumer-side scrub is routed separately, and `referral_code` anchors referral
 * attribution. Disclosed in the resultUrl `retainedUnscrubbed` (column paths
 * only), gated on a consumer twin existing.
 *
 * Status machine (H1, 2026-06-05): pending → processing → completed | failed.
 * - 'completed': re-runs are an idempotent NO-OP (returns completed; GDPR
 *   Art. 17 processors retry). 'completed' is set ONLY inside the transaction
 *   below, AFTER a successful (or idempotent-already-done) auth-user delete, so
 *   'completed' ⇒ (Supabase auth user deleted ∧ DB anonymized).
 * - 'failed': RETRYABLE. Two writes happen: (a) the pre-txn Supabase
 *   auth-user delete, then (b) the atomic anonymization transaction, with
 *   'completed' set INSIDE the txn. The auth-delete is IDEMPOTENT (a not-found
 *   user is treated as already-deleted), so a 'failed' retry is safe whether it
 *   failed before or after the auth user was removed: a retry that finds the
 *   auth user already gone succeeds, and the txn either never committed (so the
 *   DB is pristine) or — being the only path that sets 'completed' — already
 *   ran, in which case the idempotent-completed no-op short-circuits. Thus
 *   'failed' implies the txn never committed and a retry sees pristine DB data.
 *   (Transient window: auth deleted, DB pristine, status 'failed' — erasure
 *   eagerly removed the auth identity; the retry finishes the DB anonymization.)
 * - 'processing': guarded (throws) — another run is, or appears to be, in
 *   flight. A run that crashed mid-flight may have ALREADY deleted the Supabase
 *   auth user (the auth-delete is pre-txn + idempotent, so this is safe to
 *   retry) and needs a manual status reset (see the H1 capstone runbook note).
 */
export async function processDataDeletion(
  exportId: string
): Promise<{ status: ComplianceStatus }> {
  const [record] = await db
    .select()
    .from(complianceExports)
    .where(eq(complianceExports.id, exportId))
    .limit(1)

  if (!record) {
    throw new Error(`Deletion request not found: ${exportId}`)
  }

  if (record.requestType !== 'data-deletion') {
    throw new Error(`Not a data-deletion request: ${record.requestType}`)
  }

  if (record.status === 'completed') {
    // H1: idempotent no-op — the deletion already ran to completion.
    logger.info('compliance.data_deletion_already_completed', { exportId })
    return { status: 'completed' }
  }

  if (record.status === 'processing') {
    // Concurrency guard: another run is (or appears to be) in flight.
    throw new Error(`Deletion already in progress: ${exportId}`)
  }

  // 'pending' (first run) and 'failed' (retry) both proceed — see the
  // status-machine docstring for the retry-safety proof.

  const developerId = record.entityId

  // Mark as processing
  await db
    .update(complianceExports)
    .set({ status: 'processing' })
    .where(eq(complianceExports.id, exportId))

  try {
    // Look up developer to get email for consumer cross-reference. Also select
    // supabaseUserId BEFORE the txn — txn step 1 NULLs it, so it must be
    // captured first (it identifies the Supabase auth.users row to delete).
    const [dev] = await db
      .select({
        id: developers.id,
        email: developers.email,
        supabaseUserId: developers.supabaseUserId,
      })
      .from(developers)
      .where(eq(developers.id, developerId))
      .limit(1)

    if (!dev) {
      throw new Error(`Developer not found: ${developerId}`)
    }

    // Capture the consumer twin's supabaseUserId too, BEFORE the txn (the txn's
    // consumer lookup/anonymize NULLs it). Normally identical to the dev's (one
    // auth.users.id per email — auth/callback writes the same user.id to both),
    // but read both defensively in case a dev/consumer twin linked different
    // auth users.
    const [consumerForAuth] = await db
      .select({ supabaseUserId: consumers.supabaseUserId })
      .from(consumers)
      .where(eq(consumers.email, dev.email))
      .limit(1)

    // ── Delete the Supabase AUTH user(s) BEFORE the DB transaction ───────────
    // The auth-delete is an external network call that CANNOT be inside the DB
    // transaction. It MUST run before the txn so the only 'completed' write (set
    // INSIDE the txn) happens AFTER a successful (or idempotent-already-done)
    // auth-delete → 'completed' ⇒ (auth user deleted ∧ DB anonymized). A throw
    // here lands in the function's catch → status='failed' (retryable;
    // deleteSupabaseAuthUser is idempotent on a not-found user). A null/absent
    // id (API-key-only / seed developer who never linked Supabase auth) is
    // skipped — nothing to delete.
    const supabaseUserIds = [
      ...new Set(
        [dev.supabaseUserId, consumerForAuth?.supabaseUserId].filter(
          (id): id is string => !!id
        )
      ),
    ]
    const deletedAuthUser = supabaseUserIds.length > 0
    for (const supabaseUserId of supabaseUserIds) {
      await deleteSupabaseAuthUser(supabaseUserId)
    }

    // Get all tool IDs owned by this developer (needed for cascading deletes)
    const devTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, developerId))

    const toolIds = devTools.map((t) => t.id)

    await db.transaction(async (tx) => {
      // ── 1. Anonymize developer profile ─────────────────────────────
      await tx
        .update(developers)
        .set({
          name: '[Deleted]',
          email: `deleted-${developerId}@deleted.settlegrid.ai`,
          publicBio: null,
          avatarUrl: null,
          passwordHash: null,
          supabaseUserId: null,
          slug: null,
          stripeConnectId: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          notificationPreferences: {},
          // V-N3 SLICE 3: the developer's own Slack/Discord webhook URLs
          // ({ slack?, discord? }) are personal data — scrub alongside prefs.
          notificationWebhooks: {},
          publicProfile: false,
          updatedAt: new Date(),
        })
        .where(eq(developers.id, developerId))

      // ── 1b. Erase this developer's publisher API keys ──────────────
      // The developer row is anonymized (not deleted), so the ON DELETE
      // CASCADE on developer_api_keys never fires. Delete the credentials
      // explicitly — a "deleted" developer's publisher keys must not
      // remain able to authenticate PUT /api/tools/publish.
      await tx
        .delete(developerApiKeys)
        .where(eq(developerApiKeys.developerId, developerId))

      // ── 2. Anonymize consumer record with the same email (if any) ──
      const [consumerRecord] = await tx
        .select({ id: consumers.id })
        .from(consumers)
        .where(eq(consumers.email, dev.email))
        .limit(1)

      if (consumerRecord) {
        await tx
          .update(consumers)
          .set({
            email: `deleted-${consumerRecord.id}@deleted.settlegrid.ai`,
            supabaseUserId: null,
            passwordHash: null,
          })
          .where(eq(consumers.id, consumerRecord.id))
      }

      // ── 2b. Delete the developer's marketing-waitlist signups ──────
      //    waitlist_signups has no developer FK; it is keyed only by email.
      //    Match the writer's normalization (api/waitlist stores
      //    email.toLowerCase().trim()) so a mixed-case developer email still
      //    matches — a raw-case match would leave the row (and make the
      //    'waitlist_signups' disclosure a false claim). Keyed on the RAW
      //    dev.email captured pre-txn (developers.email is anonymized by step 1
      //    above, so it must NOT be re-selected here). DELETE (not anonymize):
      //    a marketing signup with no dependents. Idempotent on a failed retry
      //    (the txn rolled back ⇒ rows still present; already-gone ⇒ 0 rows).
      //    The one-email-per-identity assumption (shared by the consumer lookup)
      //    means this also covers the consumer twin's signup — no second capture.
      const deletedWaitlistRows = await tx
        .delete(waitlistSignups)
        .where(sql`lower(${waitlistSignups.email}) = ${dev.email.toLowerCase().trim()}`)
        .returning({ id: waitlistSignups.id })
      const deletedWaitlist = deletedWaitlistRows.length > 0

      // ── 3. Delete API keys for this developer's tools ──────────────
      if (toolIds.length > 0) {
        await tx
          .delete(apiKeys)
          .where(inArray(apiKeys.toolId, toolIds))
      }

      // ── 4. Null out PII metadata on invocations (keep financial data) ──
      if (toolIds.length > 0) {
        await tx
          .update(invocations)
          .set({ metadata: null })
          .where(inArray(invocations.toolId, toolIds))
      }

      // ── 5. Scrub IP/UA + details from audit logs ───────────────────
      //    V-N3 SLICE 3: `details` retains the developer's RAW EMAIL on
      //    auth.login rows ({ provider, email }) and may embed PII in other
      //    action shapes — null the whole column (SAFE-COMPLETE; every reader
      //    handles null) alongside ipAddress/userAgent, same developerId scope.
      await tx
        .update(auditLogs)
        .set({ ipAddress: null, userAgent: null, details: null })
        .where(eq(auditLogs.developerId, developerId))

      // ── 5b. Scrub the consumer twin's OWN audit rows (consumerId-keyed) ─
      //    V-N3 SLICE 3 RECOVERY (F-1): audit_logs has a `consumerId` column;
      //    consumer-keyed writers (e.g. consumer/budget, consumer/keys) hold the
      //    SUBJECT-as-consumer's IP/UA and may embed PII in `details`. Step 5
      //    keys on developerId ONLY, so these survive it — leaving the
      //    UNCONDITIONAL 'audit_logs.details' disclosure FALSE for a developer
      //    who also has a consumer account. When a twin exists, scrub its rows on
      //    the same whole-column basis (the twin is the same data subject).
      if (consumerRecord) {
        await tx
          .update(auditLogs)
          .set({ ipAddress: null, userAgent: null, details: null })
          .where(eq(auditLogs.consumerId, consumerRecord.id))
      }

      // ── 5c. Scrub CROSS-PRINCIPAL audit rows that NAME the subject ──
      //    V-N3 SLICE 3 RECOVERY (F-1, DC-16): a DIFFERENT principal (an admin)
      //    can write an audit row ABOUT this developer carrying the subject's
      //    raw email in `details` — CONFIRMED at admin/chargeback-watch/unpause
      //    (developerId=admin, resourceType='developer', resourceId=<subject>,
      //    details.targetDeveloperEmail=<subject email>). Such rows are keyed to
      //    the admin's developerId, so step 5 never reaches them — and the full
      //    audit_logs PII census (38 writers, all 3 keying paths) found this is
      //    the ONLY writer that puts a developer-subject's PII into a
      //    foreign-keyed row, always as the 'developer'/'developer_signup'
      //    resource. Null `details` on every row that names the subject as that
      //    resource, so the unconditional 'audit_logs.details' claim is TRUE.
      //    Only `details` is nulled here (NOT ip/ua): on a cross-principal row
      //    the IP/UA belong to the ACTING principal, not the subject — the
      //    subject's PII lives only in `details`. RULING (DC-13 over-scrub
      //    trade-off, handoff F-1 Option A): nulling the whole `details` also
      //    drops the admin's collateral (adminEmail/note) — ACCEPTED: GDPR
      //    erasure of the subject's PII dominates, and the admin's own email
      //    survives on their developerId-keyed rows. Subject-keyed 'developer'
      //    rows (the subject's own settings updates) are already nulled by
      //    step 5 — re-nulling them here is idempotent.
      await tx
        .update(auditLogs)
        .set({ details: null })
        .where(
          and(
            inArray(auditLogs.resourceType, ['developer', 'developer_signup']),
            eq(auditLogs.resourceId, developerId),
          ),
        )

      // ── 6. Delete webhook endpoints (may reveal infrastructure URLs) ─
      await tx
        .delete(webhookEndpoints)
        .where(eq(webhookEndpoints.developerId, developerId))

      // ── 7. Anonymize tool reviews written by the developer's consumer ─
      //    Reviews are authored by consumers, not the developer, but if the
      //    developer also has a consumer account, anonymize those reviews.
      if (consumerRecord) {
        await tx
          .update(toolReviews)
          .set({ comment: null })
          .where(eq(toolReviews.consumerId, consumerRecord.id))
      }

      // ── 7b. Anonymize the developer's OWN review responses ─────────
      //    V-N3 SLICE 3 RECOVERY (F-2): tool_reviews.developer_response +
      //    developer_responded_at hold free text the SUBJECT authored — the
      //    developer's public reply on reviews of THEIR OWN tools, written via
      //    dashboard/developer/reviews/[id]/respond (keyed via tools.developerId).
      //    These rows are keyed to the developer's TOOLS, not the consumer twin,
      //    so step 7's consumerId-scoped scrub never touches them and a
      //    '[Deleted]' developer's replies (which can embed contact info) would
      //    survive. Distinct WHERE from step 7 (keys on toolId ∈ toolIds). Null
      //    ONLY the response columns — rating/comment on these rows are OTHER
      //    consumers' authored data and are RETAINED. Idempotent (null-on-retry).
      if (toolIds.length > 0) {
        await tx
          .update(toolReviews)
          .set({ developerResponse: null, developerRespondedAt: null })
          .where(inArray(toolReviews.toolId, toolIds))
      }

      // ── 8. Mark tools as deleted, clear description/health endpoint ─
      //    V-N3 SLICE 3: also null the PII-linked infra fields — sourceRepoUrl
      //    (a github.com/<handle>/… URL embedding the dev's handle), proxyEndpoint
      //    (the dev's infra URL), crawlMetadata (jsonb that can embed crawled
      //    author/contact data). Product-safe on these status='deleted' rows: no
      //    developer-owned status='template' write path exists (so they are never
      //    a template-download target), and proxy/stats only COUNTs the endpoint,
      //    never returns its value. PRESERVE name/slug — product-artifact identity
      //    (over-scrub would break invocation/purchase/review history + the URL key).
      if (toolIds.length > 0) {
        await tx
          .update(tools)
          .set({
            status: 'deleted',
            description: null,
            healthEndpoint: null,
            sourceRepoUrl: null,
            proxyEndpoint: null,
            crawlMetadata: null,
            updatedAt: new Date(),
          })
          .where(inArray(tools.id, toolIds))
      }

      // ── 9. Mark compliance export as completed ─────────────────────
      await tx
        .update(complianceExports)
        .set({
          status: 'completed',
          resultUrl: JSON.stringify({
            anonymized: [
              'developers',
              // V-N3 SLICE 3: the developer's Slack/Discord webhook URLs, reset
              // to {} in step 1 (unconditional — the developer row always updates).
              'developers.notification_webhooks',
              // The Supabase auth.users row (email/login identity) was HARD
              // deleted pre-txn — gated on a linked auth-user id being present
              // (deletedAuthUser). An already-gone user is absorbed as a 404, so
              // this records the END STATE "no live auth user for this identity",
              // not which run performed the delete.
              ...(deletedAuthUser ? ['supabase_auth_user'] : []),
              'developer_api_keys',
              ...(consumerRecord ? ['consumers'] : []),
              // V-N3 SLICE 3: marketing-waitlist rows — gated on the DELETE having
              // matched rows (most developers never joined the waitlist), so this
              // never claims a scrub that did not happen.
              ...(deletedWaitlist ? ['waitlist_signups'] : []),
              ...(toolIds.length > 0 ? ['api_keys', 'invocations.metadata'] : []),
              'audit_logs.ip_address',
              'audit_logs.user_agent',
              // V-N3 SLICE 3: audit-log details (held the dev's raw login email),
              // nulled in step 5 (unconditional — same developerId scope as IP/UA).
              'audit_logs.details',
              'webhook_endpoints',
              ...(consumerRecord ? ['tool_reviews'] : []),
              // V-N3 SLICE 3 RECOVERY (F-2): the developer's OWN review responses
              // (tool_reviews.developer_response/developer_responded_at), nulled in
              // step 7b — gated on the dev owning tools (step 7b only runs then).
              // Distinct from the consumer-`comment` scrub ('tool_reviews' above).
              ...(toolIds.length > 0 ? ['tool_reviews.developer_response'] : []),
              // V-N3 SLICE 3: tool PII-infra fields — gated on the dev owning tools
              // (mirrors the existing 'tools' gating; step 8 only runs then).
              ...(toolIds.length > 0
                ? ['tools', 'tools.source_repo_url', 'tools.proxy_endpoint', 'tools.crawl_metadata']
                : []),
            ],
            retained: ['payouts', 'purchases', 'ledger_entries', 'settlement_batches'],
            // V-N3 honesty: ledger_entries ALSO persists the anonymous on-chain
            // payer's raw EVM address in the columns below; this deletion does NOT
            // scrub them. Column PATHS only — never row values. Lawful basis /
            // erasure unsettled, routed to V-N3-erasure (counsel pending).
            retainedUnscrubbed: [
              'ledger_entries.operation_id',
              'ledger_entries.metadata.payer',
              // V-N3 SLICE 3: a distinct entity's data, DEFERRED (not scrubbed
              // here). Column PATH only — never a row value. Factual posture, no
              // lawful-basis conclusion (see retainedUnscrubbedNote).
              'organizations.billing_email',
              // V-N3 SLICE 3 RECOVERY (F-3/4/5): a developer-linked consumer
              // account's financial/referral linkage is RETAINED un-scrubbed here
              // (step 2 anonymizes only email/supabaseUserId/passwordHash). Column
              // PATHS only — never row values (DC-11). Gated on a consumer twin
              // existing, so this never lists paths for a non-existent row. The
              // consumer-side scrub is deferred + routed separately; referral_code
              // anchors referral attribution (scrubbing it would orphan it).
              ...(consumerRecord
                ? [
                    'consumers.stripe_customer_id',
                    'consumers.default_payment_method_id',
                    'consumers.referral_code',
                  ]
                : []),
            ],
            retainedUnscrubbedNote:
              "The fields above retain the anonymous on-chain payer's EVM address; this deletion does not scrub them. Lawful basis and any erasure path are unsettled (counsel pending). organizations.billing_email belongs to a distinct entity (an organization, which may have other members) and is not scrubbed by this developer-deletion; whether and how to scrub organization data on member deletion is unsettled and routed separately. A developer-linked consumer account's stripe_customer_id, default_payment_method_id, and referral_code are also retained un-scrubbed here; the consumer-side financial/referral linkage is deferred and routed separately, and referral_code anchors referral attribution.",
            toolCount: toolIds.length,
          }),
          completedAt: new Date(),
        })
        .where(eq(complianceExports.id, exportId))
    })

    logger.info('compliance.data_deletion_completed', {
      exportId,
      entityType: record.entityType,
      entityId: developerId,
      toolCount: toolIds.length,
    })

    return { status: 'completed' }
  } catch (err) {
    await db
      .update(complianceExports)
      .set({ status: 'failed' })
      .where(eq(complianceExports.id, exportId))

    logger.error('compliance.data_deletion_failed', { exportId }, err)
    return { status: 'failed' }
  }
}
