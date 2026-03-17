// POST /api/agents — Register a new agent identity
// GET /api/agents — List agent identities for the authenticated provider

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { checkRateLimit, sdkLimiter } from '@/lib/rate-limit'
import { registerAgent, listAgentsByProvider } from '@/lib/settlement/identity'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 30
export { corsOptions as OPTIONS }

const registerSchema = z.object({
  agentName: z.string().min(1).max(200),
  identityType: z.enum(['api-key', 'did:key', 'jwt', 'x509', 'tap-token']),
  publicKey: z.string().optional(),
  capabilities: z.object({
    tools: z.array(z.string()),
    methods: z.array(z.string()),
    pricing: z.record(z.unknown()),
    protocols: z.array(z.string()),
  }).optional(),
  spendingLimitCents: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(sdkLimiter, `agents-register:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const providerId = request.headers.get('x-provider-id')
    if (!providerId) {
      return errorResponse('Provider authentication required.', 401)
    }

    const body = await parseBody(request, registerSchema)

    const agent = await registerAgent({
      providerId,
      ...body,
      capabilities: body.capabilities as RegisterAgentParams['capabilities'],
    })

    return successResponse(agent, 201)
  } catch (error) {
    if (error instanceof Error && error.message.includes('already registered')) {
      return errorResponse(error.message, 409)
    }
    return internalErrorResponse(error)
  }
})

export const GET = withCors(async function GET(request: NextRequest) {
  try {
    const providerId = request.headers.get('x-provider-id')
    if (!providerId) {
      return errorResponse('Provider authentication required.', 401)
    }

    const agents = await listAgentsByProvider(providerId)

    return successResponse({ agents })
  } catch (error) {
    return internalErrorResponse(error)
  }
})

// Re-import type for the cast
import type { RegisterAgentParams } from '@/lib/settlement/identity'
