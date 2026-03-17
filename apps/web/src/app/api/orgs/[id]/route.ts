import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrganization, updateOrgSettings } from '@/lib/settlement/organizations'
import { requireDeveloper } from '@/lib/middleware/auth'
import { checkPermission } from '@/lib/settlement/rbac'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 10

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const developer = await requireDeveloper(request)
    const { id } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `orgs:get:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const org = await getOrganization(id)
    if (!org) {
      return errorResponse('Organization not found', 404, 'NOT_FOUND', requestId)
    }

    // RBAC: viewer+ can read org details
    const allowed = await checkPermission(id, developer.id, 'org.view_analytics')
    if (!allowed) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', requestId)
    }

    return successResponse(org, 200, requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}

const updateSettingsSchema = z.object({
  settings: z.record(z.unknown()),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const developer = await requireDeveloper(request)
    const { id } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `orgs:patch:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const org = await getOrganization(id)
    if (!org) {
      return errorResponse('Organization not found', 404, 'NOT_FOUND', requestId)
    }

    // RBAC: only owner can manage org settings
    const allowed = await checkPermission(id, developer.id, 'org.manage')
    if (!allowed) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', requestId)
    }

    const body = await parseBody(request, updateSettingsSchema)
    const updated = await updateOrgSettings(id, body.settings)

    return successResponse(updated, 200, requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}
