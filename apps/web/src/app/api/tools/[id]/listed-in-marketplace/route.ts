import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 30

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  listedInMarketplace: z.boolean(),
})

/**
 * PATCH /api/tools/[id]/listed-in-marketplace — P2.INTL2
 *
 * Toggles whether a tool with status='draft' (claimed, not yet monetized)
 * appears in the public marketplace. The flag is consulted only for draft
 * tools — 'unclaimed' and 'active' tools are always in the marketplace
 * regardless of this value, but the column is still settable on them so
 * that re-claiming or re-publishing transitions don't reset visibility
 * preference unexpectedly.
 *
 * Auth: developer must own the tool.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-listed:${ip}`)
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

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }
    const body = await parseBody(request, bodySchema)

    // Verify tool belongs to developer
    const [existing] = await db
      .select({
        id: tools.id,
        status: tools.status,
        listedInMarketplace: tools.listedInMarketplace,
      })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (existing.status === 'deleted') {
      return errorResponse('Cannot change marketplace listing of a deleted tool.', 400, 'TOOL_DELETED')
    }

    const [tool] = await db
      .update(tools)
      .set({ listedInMarketplace: body.listedInMarketplace, updatedAt: new Date() })
      .where(eq(tools.id, id))
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        status: tools.status,
        listedInMarketplace: tools.listedInMarketplace,
        updatedAt: tools.updatedAt,
      })

    writeAuditLog({
      developerId: auth.id,
      action: 'tool.listed_in_marketplace_changed',
      resourceType: 'tool',
      resourceId: id,
      details: {
        fromListed: existing.listedInMarketplace,
        toListed: body.listedInMarketplace,
        status: existing.status,
      },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ tool })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
