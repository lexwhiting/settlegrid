/**
 * MCP Sub-Registry Constants
 */

/** Maximum items per page in list endpoints */
export const MAX_PAGE_LIMIT = 100

/** Default items per page in list endpoints */
export const DEFAULT_PAGE_LIMIT = 20

/** Minimum items per page */
export const MIN_PAGE_LIMIT = 1

/** Cache-Control header for public GET endpoints */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=300'

/** CORS headers for cross-origin MCP consumption */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
}

/** Valid semver pattern */
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/

/** Maximum recent reviews to return in extension endpoints */
export const MAX_RECENT_REVIEWS = 20

/** Rate limit key prefix for MCP registry endpoints */
export const RATE_LIMIT_PREFIX = 'mcp-registry'

/** Maximum length for search query strings */
export const MAX_SEARCH_LENGTH = 200

/** Maximum length for tag filter values */
export const MAX_TAG_LENGTH = 100

/** Maximum length for category filter values */
export const MAX_CATEGORY_LENGTH = 50

/** Valid category slugs (matches discover/categories) */
export const VALID_CATEGORIES = new Set([
  'data',
  'nlp',
  'image',
  'code',
  'search',
  'finance',
  'productivity',
  'analytics',
  'security',
  'other',
])

/** Maximum changelog entries returned in server detail */
export const MAX_CHANGELOG_ENTRIES = 50
