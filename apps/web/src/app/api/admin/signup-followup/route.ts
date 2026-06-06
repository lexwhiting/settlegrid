/**
 * P4.8 — Signup follow-up tracker.
 *
 * Surfaces recent developer signups + their interview-pipeline status
 * so the founder can work the list manually. Reads/writes status via
 * the existing `audit_logs` table — no new schema, append-only history,
 * latest-row-wins semantics for the rendered status.
 *
 * ## Status state machine
 *
 *   not_sent → sent → scheduled → interviewed
 *
 * Skipped is also a valid leaf (signup didn't fit the prioritization
 * rules in scheduling-script.md). The route validates transitions
 * loosely — the founder can move a row in any direction (e.g.,
 * sent → not_sent if the email bounced and we want to re-try). This
 * is deliberate; over-strict transition rules slow the founder down
 * during launch week.
 *
 * ## Auth
 *
 * Same gate as `/api/admin/stats` and `/api/admin/launch-metrics`:
 * IP-rate-limit, `requireDeveloper`, ADMIN_EMAILS allowlist. Returns
 * 401/403 to non-admins.
 *
 * ## Storage
 *
 * Status mutations are written as `audit_logs` rows with action
 * `signup_followup.update`, resourceType `developer_signup`,
 * resourceId = developer.id, details = `{ status, note? }`. To read
 * the latest status per developer, the GET handler joins developers
 * to a "latest signup_followup row per developer" subquery.
 *
 * @packageDocumentation
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 30
/**
 * No revalidate — the founder marks status interactively and expects
 * the next page load to reflect the write.
 */
export const dynamic = 'force-dynamic'

// Pure helpers + types live in `./helpers` because Next.js App Router
// rejects any export from route.ts that isn't an HTTP method handler
// or recognized config export.
import {
  SIGNUP_LIMIT,
  SIGNUP_FOLLOWUP_STATUSES,
  isValidStatus,
  toIso,
  type SignupFollowupListResponse,
  type SignupFollowupRow,
} from './helpers'

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/** POST body schema. Validates at the boundary via Zod. */
const PostBodySchema = z.object({
  developerId: z.string().uuid(),
  status: z.enum(SIGNUP_FOLLOWUP_STATUSES),
  note: z
    .string()
    .max(500, 'note must be 500 characters or fewer')
    .optional(),
})

/**
 * Common auth gate. Returns either the `auth` payload (success) or a
 * NextResponse with the right error code for the caller to short-
 * circuit on. Sharing this between GET + POST keeps the two handlers
 * trivially in sync if one ever evolves.
 */
async function requireAdmin(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rateLimit = await checkRateLimit(apiLimiter, `admin-signup-followup:${ip}`)
  if (!rateLimit.success) {
    return {
      ok: false as const,
      response: errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      ),
    }
  }
  let auth
  try {
    auth = await requireDeveloper(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication required'
    return { ok: false as const, response: errorResponse(message, 401, 'UNAUTHORIZED') }
  }
  const userRl = await checkRateLimit(apiLimiter, `admin-signup-followup:uid:${auth.id}`)
  if (!userRl.success) {
    return {
      ok: false as const,
      response: errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      ),
    }
  }
  if (!ADMIN_EMAILS.includes(auth.email)) {
    return {
      ok: false as const,
      response: errorResponse('Forbidden. Admin access required.', 403, 'FORBIDDEN'),
    }
  }
  return { ok: true as const, auth }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdmin(request)
    if (!gate.ok) return gate.response

    // Latest signup_followup audit_logs row per developer, joined to
    // the developers table. Use a CTE + DISTINCT ON for a single
    // round-trip. The CTE filters audit_logs to just the action we
    // care about so the DISTINCT ON has a small input set.
    //
    // Defensive: if a developer has zero audit_logs rows for this
    // action, the LEFT JOIN yields NULLs and we render status as
    // 'not_sent' (default). This means brand-new signups always
    // appear in the "needs attention" bucket without any backfill.
    const rowsRaw = await db.execute<{
      developer_id: string
      email: string
      name: string | null
      signed_up_at: string
      latest_action: string | null
      latest_details: { status?: string; note?: string } | null
      latest_at: string | null
    }>(sql`
      WITH latest_followup AS (
        SELECT DISTINCT ON (developer_id)
          developer_id,
          action,
          details,
          created_at
        FROM audit_logs
        WHERE action = 'signup_followup.update'
          AND developer_id IS NOT NULL
        ORDER BY developer_id, created_at DESC
      )
      SELECT
        d.id            AS developer_id,
        d.email         AS email,
        d.name          AS name,
        d.created_at    AS signed_up_at,
        lf.action       AS latest_action,
        lf.details      AS latest_details,
        lf.created_at   AS latest_at
      FROM ${developers} AS d
      LEFT JOIN latest_followup lf
        ON lf.developer_id = d.id
      ORDER BY d.created_at DESC
      LIMIT ${SIGNUP_LIMIT}
    `)

    // db.execute returns shape varies by driver; normalize to array.
    const rows = Array.isArray(rowsRaw)
      ? (rowsRaw as Array<Record<string, unknown>>)
      : (((rowsRaw as { rows?: Array<Record<string, unknown>> }).rows ??
          []) as Array<Record<string, unknown>>)

    const out: SignupFollowupRow[] = rows.map((r) => {
      const details = r.latest_details as
        | { status?: string; note?: string }
        | null
      const status = isValidStatus(details?.status)
        ? details.status
        : 'not_sent'
      return {
        developerId: String(r.developer_id),
        email: String(r.email),
        name: r.name == null ? null : String(r.name),
        signedUpAt: toIso(r.signed_up_at),
        status,
        statusUpdatedAt: r.latest_at ? toIso(r.latest_at) : null,
        note: details?.note ?? null,
      }
    })

    return successResponse<SignupFollowupListResponse>({
      total: out.length,
      rows: out,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdmin(request)
    if (!gate.ok) return gate.response

    const body = await parseBody(request, PostBodySchema)

    // Confirm the developer exists. If a typo'd UUID slips through
    // (the founder pasted from one row, edited the wrong cell), we
    // 404 instead of writing an orphan audit row.
    const [dev] = await db
      .select({ id: developers.id })
      .from(developers)
      .where(sql`${developers.id} = ${body.developerId}`)
      .limit(1)
    if (!dev) {
      return errorResponse('Developer not found', 404, 'NOT_FOUND')
    }

    await writeAuditLog({
      developerId: body.developerId,
      action: 'signup_followup.update',
      resourceType: 'developer_signup',
      resourceId: body.developerId,
      details: {
        status: body.status,
        note: body.note ?? null,
        actor_email: gate.auth.email,
      },
    })
    logger.info('admin.signup_followup.updated', {
      developerId: body.developerId,
      status: body.status,
      actor: gate.auth.email,
    })

    return successResponse({ ok: true, status: body.status })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

