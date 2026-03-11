import { randomUUID } from 'crypto'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Reads the `x-request-id` header from the incoming request.
 * If the header is missing or not a valid UUID v4, generates a new one.
 */
export function getOrCreateRequestId(request: Request): string {
  const existing = request.headers.get('x-request-id')

  if (existing && UUID_V4_RE.test(existing)) {
    return existing
  }

  return randomUUID()
}
