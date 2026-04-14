import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import {
  parseBody,
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'
import { authLimiter, checkRateLimit } from '@/lib/rate-limit'
import { requireDeveloper } from '@/lib/middleware/auth'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'

export const maxDuration = 30

// ─── Validation ─────────────────────────────────────────────────────────────

/** Claim tokens are exactly 48 hex characters (24 bytes) */
const CLAIM_TOKEN_RE = /^[a-f0-9]{48}$/

const claimSchema = z.object({
  token: z
    .string()
    .min(1, 'Token is required')
    .max(64, 'Token too long')
    .regex(CLAIM_TOKEN_RE, 'Invalid claim token format'),
})

// ─── POST /api/tools/claim ──────────────────────────────────────────────────

/**
 * Claims an unclaimed tool by transferring ownership to the authenticated developer.
 *
 * Body: { token: string }
 * Auth: Required (Supabase session)
 *
 * Flow:
 * 1. Validate the claim token
 * 2. Look up the tool by claim token
 * 3. Verify tool is still unclaimed
 * 4. Transfer ownership to the authenticated developer
 * 5. Update status to 'draft' (developer must set pricing before going active)
 * 6. Clear the claim token
 * 7. Return tool data with redirect URL
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    // Rate limit: use authLimiter (5/min) to prevent brute-force token guessing
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(authLimiter, `tools-claim:${ip}`)
    if (!rl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
        requestId
      )
    }

    // Validate Content-Type
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return errorResponse(
        'Content-Type must be application/json',
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        requestId
      )
    }

    // Authenticate the developer
    let auth: { id: string; email: string }
    try {
      auth = await requireDeveloper(request)
    } catch {
      return errorResponse(
        'Authentication required. Please sign in to claim this tool.',
        401,
        'UNAUTHORIZED',
        requestId
      )
    }

    // Parse and validate the body
    const body = await parseBody(request, claimSchema)

    // Look up tool by claim token (include toolType + sourceEcosystem to preserve on claim)
    const [tool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        status: tools.status,
        developerId: tools.developerId,
        sourceRepoUrl: tools.sourceRepoUrl,
        toolType: tools.toolType,
        sourceEcosystem: tools.sourceEcosystem,
      })
      .from(tools)
      .where(eq(tools.claimToken, body.token))
      .limit(1)

    if (!tool) {
      return errorResponse(
        'Invalid or expired claim token.',
        404,
        'TOKEN_NOT_FOUND',
        requestId
      )
    }

    // Verify tool is still unclaimed
    if (tool.status !== 'unclaimed') {
      return errorResponse(
        'This tool has already been claimed.',
        409,
        'ALREADY_CLAIMED',
        requestId
      )
    }

    // Transfer ownership: update developerId, status, clear claim token,
    // and explicitly preserve marketplace visibility through the transition
    // (P2.INTL2). Without listedInMarketplace=true the freshly-claimed tool
    // would drop from /marketplace until the developer publishes — which
    // requires Stripe — which is exactly the blocker for unsupported corridors.
    const [updated] = await db
      .update(tools)
      .set({
        developerId: auth.id,
        status: 'draft',
        claimToken: null,
        listedInMarketplace: true,
        updatedAt: new Date(),
      })
      .where(and(eq(tools.id, tool.id), eq(tools.status, 'unclaimed')))
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        status: tools.status,
        sourceRepoUrl: tools.sourceRepoUrl,
        toolType: tools.toolType,
        sourceEcosystem: tools.sourceEcosystem,
      })

    if (!updated) {
      // Race condition: someone else claimed it between our check and update
      return errorResponse(
        'This tool has already been claimed.',
        409,
        'ALREADY_CLAIMED',
        requestId
      )
    }

    // Audit log
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.claimed',
      resourceType: 'tool',
      resourceId: updated.id,
      details: {
        name: updated.name,
        slug: updated.slug,
        sourceRepoUrl: updated.sourceRepoUrl,
        toolType: updated.toolType,
        sourceEcosystem: updated.sourceEcosystem,
      },
      ipAddress: ip,
    }).catch(() => {})

    logger.info('tool.claimed', {
      developerId: auth.id,
      toolId: updated.id,
      slug: updated.slug,
      requestId,
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://settlegrid.ai'
    const settingsUrl = `${baseUrl}/dashboard/tools`

    return successResponse(
      {
        tool: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          status: updated.status,
          toolType: updated.toolType,
          sourceEcosystem: updated.sourceEcosystem,
        },
        redirectUrl: settingsUrl,
      },
      200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
