import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { validateToolForActivation } from '@/lib/quality-gates'

export const maxDuration = 60


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const statusSchema = z.object({
  status: z.enum(['active', 'draft'], {
    errorMap: () => ({ message: "Status must be 'active' or 'draft'" }),
  }),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `tool-status:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `tool-status:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }
    const body = await parseBody(request, statusSchema)

    // Verify tool belongs to developer and is not deleted
    const [existing] = await db
      .select({ id: tools.id, status: tools.status })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (existing.status === 'deleted') {
      return errorResponse('Cannot change status of a deleted tool.', 400, 'TOOL_DELETED')
    }

    // ── Quality gate: enforce checks when activating ─────────────────────────
    if (body.status === 'active') {
      const gateResult = await validateToolForActivation(id, auth.id)
      if (!gateResult.passed) {
        return errorResponse(
          'Tool does not meet quality requirements for the Showcase',
          400,
          'QUALITY_GATE_FAILED',
          undefined,
          { failures: gateResult.failures }
        )
      }
    }

    // Producer-audit #7 — defense-in-depth: re-verify ownership in the
    // UPDATE WHERE clause (not just the SELECT above) so a concurrent
    // ownership change between SELECT and UPDATE can't let a non-owner
    // flip status. Matches the pattern in
    // /api/tools/[id]/route.ts (DELETE) and [id]/listed-in-marketplace.
    const [tool] = await db
      .update(tools)
      .set({ status: body.status, updatedAt: new Date() })
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        status: tools.status,
        updatedAt: tools.updatedAt,
      })

    if (!tool) {
      // Race: ownership changed between SELECT and UPDATE. Treat as 404
      // so the caller re-fetches and sees the new state, same as the
      // listed-in-marketplace route's handling.
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Audit log: tool status changed
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.status_changed',
      resourceType: 'tool',
      resourceId: id,
      details: { fromStatus: existing.status, toStatus: body.status },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ tool })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
