import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 60

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Block private/internal IPs to prevent SSRF */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname.toLowerCase()
    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true
    // Block common internal hostnames
    if (hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) return true
    // Block private IPv4 ranges
    const parts = hostname.split('.').map(Number)
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      if (parts[0] === 10) return true // 10.0.0.0/8
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true // 172.16.0.0/12
      if (parts[0] === 192 && parts[1] === 168) return true // 192.168.0.0/16
      if (parts[0] === 169 && parts[1] === 254) return true // 169.254.0.0/16 (AWS metadata)
      if (parts[0] === 0) return true // 0.0.0.0/8
    }
    return false
  } catch {
    return true // invalid URL = block
  }
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
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
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
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
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
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
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
