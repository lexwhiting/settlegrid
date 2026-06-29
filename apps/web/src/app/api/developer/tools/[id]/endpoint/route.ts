import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { isPublicUrlString } from '@/lib/safe-egress'

export const maxDuration = 60

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Registration-time UX pre-check that the proxy endpoint isn't a private/
 * reserved literal or obvious internal host (delegates to the shared SSRF
 * guard, G2-2; supersedes the old string-prefix denylist). The load-bearing
 * block is L1+L2 in `safeFetch` at the proxy fetch. The https requirement is
 * enforced by a separate schema refine.
 */
function isPrivateUrl(urlStr: string): boolean {
  return !isPublicUrlString(urlStr)
}

const endpointSchema = z.object({
  endpointUrl: z
    .string()
    .url('Must be a valid URL')
    .max(2000, 'URL must not exceed 2000 characters')
    .refine(
      (u) => u.startsWith('https://'),
      'Endpoint URL must use HTTPS'
    )
    .refine(
      (u) => !isPrivateUrl(u),
      'Endpoint URL must not point to private or internal addresses'
    ),
})

/**
 * PUT /api/developer/tools/{id}/endpoint
 *
 * Registers or updates the proxy endpoint URL for a tool.
 * Only the tool owner (developer) can set the endpoint.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `dev-tool-endpoint:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-tool-endpoint:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID', requestId)
    }

    const body = await parseBody(request, endpointSchema)

    // Verify tool exists and belongs to the authenticated developer
    const [existing] = await db
      .select({ id: tools.id, slug: tools.slug })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    // Update the proxy endpoint
    const [updated] = await db
      .update(tools)
      .set({
        proxyEndpoint: body.endpointUrl,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, id))
      .returning({
        id: tools.id,
        slug: tools.slug,
        proxyEndpoint: tools.proxyEndpoint,
        updatedAt: tools.updatedAt,
      })

    // Audit log
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.proxy_endpoint_updated',
      resourceType: 'tool',
      resourceId: id,
      details: { endpointUrl: body.endpointUrl },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse(
      {
        message: 'Proxy endpoint registered successfully.',
        tool: {
          id: updated.id,
          slug: updated.slug,
          proxyEndpoint: updated.proxyEndpoint,
          proxyUrl: `https://settlegrid.ai/api/proxy/${updated.slug}`,
          updatedAt: updated.updatedAt,
        },
      },
      200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

/**
 * GET /api/developer/tools/{id}/endpoint
 *
 * Returns the current proxy endpoint configuration for a tool.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `dev-tool-endpoint:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-tool-endpoint:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID', requestId)
    }

    const [tool] = await db
      .select({
        id: tools.id,
        slug: tools.slug,
        proxyEndpoint: tools.proxyEndpoint,
        updatedAt: tools.updatedAt,
      })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    return successResponse(
      {
        tool: {
          id: tool.id,
          slug: tool.slug,
          proxyEndpoint: tool.proxyEndpoint,
          proxyUrl: tool.proxyEndpoint
            ? `https://settlegrid.ai/api/proxy/${tool.slug}`
            : null,
          updatedAt: tool.updatedAt,
        },
      },
      200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

/**
 * DELETE /api/developer/tools/{id}/endpoint
 *
 * Removes the proxy endpoint for a tool (disables the proxy).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `dev-tool-endpoint:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-tool-endpoint:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID', requestId)
    }

    // Verify ownership
    const [existing] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    await db
      .update(tools)
      .set({
        proxyEndpoint: null,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, id))

    // Audit log
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.proxy_endpoint_removed',
      resourceType: 'tool',
      resourceId: id,
      ipAddress: ip,
    }).catch(() => {})

    return successResponse(
      { message: 'Proxy endpoint removed successfully.' },
      200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
