import { NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'

/**
 * Returns a JSON success response with the given data and status code.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * Returns a JSON error response with a message, HTTP status code, and optional error code.
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse {
  const body: { error: string; code?: string } = { error: message }

  if (code) {
    body.code = code
  }

  return NextResponse.json(body, { status })
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
 */
export function internalErrorResponse(error: unknown): NextResponse {
  if (error instanceof ParseBodyError) {
    return errorResponse(error.message, error.statusCode, 'VALIDATION_ERROR')
  }

  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred'

  console.error('[SettleGrid Internal Error]', {
    message,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  })

  return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
}
