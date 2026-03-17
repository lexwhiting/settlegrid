import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrganization, removeMember } from '@/lib/settlement/organizations'
import { requireDeveloper } from '@/lib/middleware/auth'
import { checkPermission } from '@/lib/settlement/rbac'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 10

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const developer = await requireDeveloper(request)
    const { id, userId } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `orgs:members:delete:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const org = await getOrganization(id)
    if (!org) {
      return errorResponse('Organization not found', 404, 'NOT_FOUND', requestId)
    }

    // RBAC: admin+ can remove members
    const allowed = await checkPermission(id, developer.id, 'org.manage_members')
    if (!allowed) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', requestId)
    }

    const removed = await removeMember(id, userId)
    if (!removed) {
      return errorResponse('Member not found', 404, 'MEMBER_NOT_FOUND', requestId)
    }

    return successResponse({ success: true }, 200, requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}
