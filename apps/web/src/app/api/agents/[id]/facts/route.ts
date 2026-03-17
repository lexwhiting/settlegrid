// GET /api/agents/:id/facts — Get AgentFacts profile

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { generateAgentFactsProfile } from '@/lib/settlement/identity'
import { addCorsHeaders } from '@/lib/middleware/cors'

export const maxDuration = 10

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return addCorsHeaders(errorResponse('Agent ID required.', 400))
    }

    const profile = await generateAgentFactsProfile(id)

    if (!profile) {
      return addCorsHeaders(errorResponse('Agent not found.', 404))
    }

    return addCorsHeaders(successResponse(profile))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
