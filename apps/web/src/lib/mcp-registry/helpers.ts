/**
 * MCP Sub-Registry Shared Helpers
 *
 * Cursor encoding, pagination clamping, CORS/cache headers, and validation.
 */

import { NextResponse } from 'next/server'
import {
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
  MIN_PAGE_LIMIT,
  PUBLIC_CACHE_CONTROL,
  CORS_HEADERS,
  SEMVER_PATTERN,
  MAX_SEARCH_LENGTH,
  MAX_TAG_LENGTH,
  MAX_CATEGORY_LENGTH,
  VALID_CATEGORIES,
} from './constants'

// ─── Cursor Encoding ─────────────────────────────────────────────────────────

/**
 * Encodes an opaque cursor from the last item ID.
 * Uses base64url encoding to avoid URL-unsafe characters.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf-8').toString('base64url')
}

/**
 * Decodes an opaque cursor back to the original ID.
 * Returns null if the cursor is malformed or empty.
 */
export function decodeCursor(cursor: string): string | null {
  try {
    if (!cursor || cursor.length > 256) return null
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
    // Must be a non-empty string that looks like a UUID
    if (!decoded || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

// ─── Pagination ──────────────────────────────────────────────────────────────

/**
 * Clamps the limit parameter to valid bounds.
 */
export function clampLimit(raw: string | null): number {
  const parsed = parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT
  return Math.min(Math.max(parsed, MIN_PAGE_LIMIT), MAX_PAGE_LIMIT)
}

// ─── Response Helpers ────────────────────────────────────────────────────────

/**
 * Attaches CORS and Cache-Control headers to a NextResponse.
 */
export function withMcpHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  response.headers.set('Cache-Control', PUBLIC_CACHE_CONTROL)
  return response
}

/**
 * Builds a CORS-enabled JSON success response.
 */
export function mcpSuccessResponse<T>(data: T, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status })
  return withMcpHeaders(response)
}

/**
 * Builds a CORS-enabled JSON error response.
 */
export function mcpErrorResponse(
  message: string,
  status: number,
  code?: string,
): NextResponse {
  const body: Record<string, unknown> = { error: message }
  if (code) body.code = code
  const response = NextResponse.json(body, { status })
  // Set CORS but skip caching for errors
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/**
 * Returns a standard OPTIONS response for CORS preflight.
 */
export function mcpOptionsResponse(): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

// ─── Input Sanitization ──────────────────────────────────────────────────────

/**
 * Escapes SQL LIKE pattern metacharacters in user-supplied search strings.
 * Prevents wildcard injection via '%' and '_'.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, (ch) => `\\${ch}`)
}

/**
 * Validates and constrains a search parameter.
 * Returns null if empty, or a truncated/escaped version.
 */
export function sanitizeSearch(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_SEARCH_LENGTH)
}

/**
 * Validates a category filter.
 * Returns the category if valid, or an error string if invalid.
 */
export function validateCategory(raw: string | null): { valid: true; value: string } | { valid: false; error: string } | null {
  if (!raw) return null
  const trimmed = raw.trim().slice(0, MAX_CATEGORY_LENGTH)
  if (!trimmed) return null
  if (!VALID_CATEGORIES.has(trimmed)) {
    const validList = Array.from(VALID_CATEGORIES).join(', ')
    return { valid: false, error: `Invalid category "${trimmed}". Valid categories: ${validList}` }
  }
  return { valid: true, value: trimmed }
}

/**
 * Validates a tag filter.
 * Returns null if empty, or the truncated tag string.
 */
export function sanitizeTag(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_TAG_LENGTH)
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that a version string is either "latest" or a valid semver.
 */
export function isValidVersion(version: string): boolean {
  return version === 'latest' || SEMVER_PATTERN.test(version)
}

/**
 * Validates and parses an ISO 8601 datetime string.
 * Returns the Date object if valid, or null if invalid.
 * Rejects dates more than 1 minute in the future to prevent misuse.
 */
export function parseUpdatedSince(raw: string | null): Date | null {
  if (!raw) return null
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return null
  // Reject future dates (with 1 minute clock skew tolerance)
  const ONE_MINUTE_MS = 60_000
  if (date.getTime() > Date.now() + ONE_MINUTE_MS) return null
  return date
}

/**
 * Validates a server name length to prevent abuse.
 * Server names should not exceed a reasonable length.
 */
export function isServerNameLengthValid(serverName: string): boolean {
  // ai.settlegrid/ = 15 chars, slug max ~100 chars
  return serverName.length <= 150
}
