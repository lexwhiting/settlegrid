import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrganization, getCostAllocations } from '@/lib/settlement/organizations'
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
    const rl = await checkRateLimit(apiLimiter, `orgs:allocations:get:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const org = await getOrganization(id)
    if (!org) {
      return errorResponse('Organization not found', 404, 'NOT_FOUND', requestId)
    }

    // RBAC: viewer+ can view allocations
    const allowed = await checkPermission(id, developer.id, 'org.view_analytics')
    if (!allowed) {
      return errorResponse('Forbidden', 403, 'FORBIDDEN', requestId)
    }

    // Parse period query param (e.g. ?period=2026-03)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')

    let periodStart: Date
    let periodEnd: Date

    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const [year, month] = period.split('-').map(Number)
      periodStart = new Date(year, month - 1, 1)
      periodEnd = new Date(year, month, 1)
    } else {
      // Default to current month
      const now = new Date()
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }

    const allocations = await getCostAllocations(id, periodStart, periodEnd)

    return successResponse(
      {
        orgId: id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        allocations,
      },
      200,
      requestId
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}
