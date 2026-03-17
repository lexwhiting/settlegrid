// DELETE /api/agents/:id — Revoke an agent identity
// PATCH  /api/agents/:id — Update agent capabilities/settings

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { revokeAgent, updateAgent } from '@/lib/settlement/identity'
import { addCorsHeaders, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import type { RegisterAgentParams } from '@/lib/settlement/identity'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const updateAgentSchema = z.object({
  agentName: z.string().min(1).max(200).optional(),
  capabilities: z.object({
    tools: z.array(z.string()),
    methods: z.array(z.string()),
    pricing: z.record(z.unknown()),
    protocols: z.array(z.string()),
  }).optional(),
  spendingLimitCents: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `agents-revoke:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const providerId = request.headers.get('x-provider-id')
    if (!providerId) {
      return addCorsHeaders(errorResponse('Provider authentication required.', 401))
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return addCorsHeaders(errorResponse('Invalid agent ID.', 400, 'INVALID_ID'))
    }

    const revoked = await revokeAgent(id, providerId)

    if (!revoked) {
      return addCorsHeaders(errorResponse('Agent not found or already revoked.', 404, 'NOT_FOUND'))
    }

    return addCorsHeaders(successResponse({ revoked: true }))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `agents-update:${ip}`)
    if (!rl.success) {
      return addCorsHeaders(errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED'))
    }

    const providerId = request.headers.get('x-provider-id')
    if (!providerId) {
      return addCorsHeaders(errorResponse('Provider authentication required.', 401))
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return addCorsHeaders(errorResponse('Invalid agent ID.', 400, 'INVALID_ID'))
    }

    const body = await parseBody(request, updateAgentSchema)

    const agent = await updateAgent(id, providerId, {
      agentName: body.agentName,
      capabilities: body.capabilities as RegisterAgentParams['capabilities'],
      spendingLimitCents: body.spendingLimitCents,
      metadata: body.metadata,
    })

    if (!agent) {
      return addCorsHeaders(errorResponse('Agent not found or no fields to update.', 404, 'NOT_FOUND'))
    }

    return addCorsHeaders(successResponse(agent))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
