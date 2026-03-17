// GET /api/sessions/:id — Get session state

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getSessionState } from '@/lib/settlement/sessions'
import { addCorsHeaders } from '@/lib/middleware/cors'

export const maxDuration = 10

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return addCorsHeaders(errorResponse('Session ID required.', 400))
    }

    const session = await getSessionState(id)

    if (!session) {
      return addCorsHeaders(errorResponse('Session not found.', 404))
    }

    return addCorsHeaders(successResponse(session))
  } catch (error) {
    return addCorsHeaders(internalErrorResponse(error))
  }
}
