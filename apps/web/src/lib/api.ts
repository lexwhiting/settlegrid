import { NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { logger } from '@/lib/logger'

/**
 * Returns a JSON success response with the given data and status code.
 * Optionally attaches `x-request-id` header when a requestId is provided.
 */
export function successResponse<T>(data: T, status: number = 200, requestId?: string): NextResponse {
  const response = NextResponse.json(data, { status })

  if (requestId) {
    response.headers.set('x-request-id', requestId)
  }

  return response
}

/**
 * Returns a JSON error response with a message, HTTP status code, and optional error code.
 * Optionally attaches `x-request-id` header when a requestId is provided.
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  requestId?: string,
  extra?: Record<string, unknown>
): NextResponse {
  const body: Record<string, unknown> = { error: message }

  if (code) {
    body.code = code
  }

  if (extra) {
    Object.assign(body, extra)
  }

  const response = NextResponse.json(body, { status })

  if (requestId) {
    response.headers.set('x-request-id', requestId)
  }

  return response
}

/**
 * Parses and validates a request body against a Zod schema.
 * Throws a descriptive error if the body is not valid JSON or fails validation.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    throw new ParseBodyError('Request body must be valid JSON.', 400)
  }

  try {
    return schema.parse(raw)
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors.map((e) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : ''
        return `${path}${e.message}`
      })
      throw new ParseBodyError(
        `Validation failed: ${messages.join('; ')}`,
        422
      )
    }
    throw err
  }
}

/**
 * Custom error class for parseBody failures, carrying an HTTP status code.
 */
export class ParseBodyError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ParseBodyError'
    this.statusCode = statusCode
  }
}

/**
 * Catches unknown errors and returns a sanitized 500 response.
 * Logs the full error for server-side debugging.
 * Optionally attaches `x-request-id` header when a requestId is provided.
 */
export function internalErrorResponse(error: unknown, requestId?: string): NextResponse {
  if (error instanceof ParseBodyError) {
    return errorResponse(error.message, error.statusCode, 'VALIDATION_ERROR', requestId)
  }

  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred'

  logger.error('internal_error', { message, ...(requestId ? { requestId } : {}) }, error)

  return errorResponse('Internal server error', 500, 'INTERNAL_ERROR', requestId)
}
