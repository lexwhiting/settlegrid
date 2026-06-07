import { createHash, randomBytes } from 'crypto'

const API_KEY_PREFIX = 'sg_live_'
export const PUBLISHER_API_KEY_PREFIX = 'sg_pub_'

/**
 * Generates a new API key with the sg_live_ prefix, its SHA-256 hash, and a display prefix.
 * The full key is returned once and should never be stored in plaintext.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex')
  const key = `${API_KEY_PREFIX}${random}`
  const hash = hashApiKey(key)
  const prefix = key.slice(0, 8)

  return { key, hash, prefix }
}

/**
 * Generates a new publisher API key with the sg_pub_ prefix, its SHA-256 hash,
 * and a display prefix. Used for programmatic tool publishing via
 * PUT /api/tools/publish — distinct from the consumer-side sg_live_ keys.
 * The full key is returned once and should never be stored in plaintext.
 */
export function generatePublisherApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex')
  const key = `${PUBLISHER_API_KEY_PREFIX}${random}`
  const hash = hashApiKey(key)
  const prefix = key.slice(0, 11) // 'sg_pub_' + first 4 hex chars

  return { key, hash, prefix }
}

/**
 * Returns the SHA-256 hex digest of an API key string.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
