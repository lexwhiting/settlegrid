import { NextRequest } from 'next/server'
import { z } from 'zod'
import { TOOL_REGISTRY } from '@/lib/tool-registry'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const callSchema = z.object({
  method: z.string().min(1).max(100),
  args: z.record(z.unknown()).optional().default({}),
})

/** POST /api/tools/by-slug/[slug]/call — execute a showcase tool method */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-call:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { slug } = await params
    const body = await parseBody(request, callSchema)

    // Look up tool
    const tool = TOOL_REGISTRY[slug]
    if (!tool) {
      return errorResponse(`Tool "${slug}" not found.`, 404, 'TOOL_NOT_FOUND')
    }

    // Look up method
    const methodDef = tool.methods[body.method]
    if (!methodDef) {
      const available = Object.keys(tool.methods).join(', ')
      return errorResponse(
        `Method "${body.method}" not found on tool "${slug}". Available: ${available}`,
        400,
        'METHOD_NOT_FOUND'
      )
    }

    // Execute
    const start = Date.now()
    const result = await methodDef.handler(body.args ?? {})
    const durationMs = Date.now() - start

    logger.info('tool_call.success', {
      slug,
      method: body.method,
      durationMs,
      ip,
    })

    return successResponse({
      tool: slug,
      method: body.method,
      result,
      durationMs,
    })
  } catch (error) {
    // Surface handler errors as 400 (user input / upstream failures)
    if (error instanceof Error && !error.message.includes('Internal')) {
      logger.warn('tool_call.handler_error', {
        message: error.message,
      })
      return errorResponse(error.message, 400, 'HANDLER_ERROR')
    }
    return internalErrorResponse(error)
  }
}
