import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrganization, addMember, listMembers } from '@/lib/settlement/organizations'
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
    const rl = await checkRateLimit(apiLimiter, `orgs:members:get:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const org = await getOrganization(id)
    if (!org) {
      return errorResponse('Organization not found', 404, 'NOT_FOUND', requestId)
    }

    // RBAC: viewer+ can list members
    const allowed = await checkPermission(id, developer.id, 'org.view_analytics')
    if (!allowed) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', requestId)
    }

    const members = await listMembers(id)
    return successResponse(members, 200, requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}

const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional().default('member'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const developer = await requireDeveloper(request)
    const { id } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `orgs:members:post:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const org = await getOrganization(id)
    if (!org) {
      return errorResponse('Organization not found', 404, 'NOT_FOUND', requestId)
    }

    // RBAC: admin+ can manage members
    const allowed = await checkPermission(id, developer.id, 'org.manage_members')
    if (!allowed) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', requestId)
    }

    const body = await parseBody(request, addMemberSchema)
    const member = await addMember(id, body.userId, body.role)

    return successResponse(member, 201, requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse('User is already a member of this organization', 409, 'MEMBER_EXISTS', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}
