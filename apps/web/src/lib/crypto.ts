import { createHash, createHmac, randomBytes } from 'crypto'
import { getApiKeyPepper } from './env'

const API_KEY_PREFIX = 'sg_live_'
export const PUBLISHER_API_KEY_PREFIX = 'sg_pub_'

/**
 * The key class bound into the HMAC so a consumer key can never be replayed
 * against the publisher keyspace or vice-versa. 'live' = consumer (sg_live_,
 * api_keys); 'pub' = publisher (sg_pub_, developer_api_keys).
 */
export type ApiKeyDomain = 'live' | 'pub'

/**
 * Generates a new API key with the sg_live_ prefix, its keyed HMAC hash, and a
 * display prefix. The full key is returned once and should never be stored in
 * plaintext. (K): the stored hash is HMAC-SHA256(pepper, 'live:'+key) — see
 * hashApiKeyHmac — not bare SHA-256.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex')
  const key = `${API_KEY_PREFIX}${random}`
  const hash = hashApiKeyHmac(key, 'live')
  const prefix = key.slice(0, 8)

  return { key, hash, prefix }
}

/**
 * Generates a new publisher API key with the sg_pub_ prefix, its keyed HMAC
 * hash, and a display prefix. Used for programmatic tool publishing via
 * PUT /api/tools/publish — distinct from the consumer-side sg_live_ keys.
 * The full key is returned once and should never be stored in plaintext.
 * (K): the stored hash is HMAC-SHA256(pepper, 'pub:'+key).
 */
export function generatePublisherApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex')
  const key = `${PUBLISHER_API_KEY_PREFIX}${random}`
  const hash = hashApiKeyHmac(key, 'pub')
  const prefix = key.slice(0, 11) // 'sg_pub_' + first 4 hex chars

  return { key, hash, prefix }
}

/**
 * Returns the bare SHA-256 hex digest of an API key string. LEGACY (pre-(K)):
 * existing key_hash rows were written with this, and the raw key is never
 * stored, so they can NEVER be re-hashed to HMAC — dual-read matches them via
 * this function. Kept verbatim. Do NOT domain-tag it: legacy rows are bare
 * sha256(key) with no domain.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Returns HMAC-SHA256(serverPepper, domain + ':' + key) as hex — the keyed,
 * domain-separated hash for keys issued at/after (K). The pepper is a
 * FAIL-CLOSED server secret (getApiKeyPepper throws if API_KEY_PEPPER is unset),
 * so a missing pepper can never silently degrade to the unkeyed legacy hash. A
 * DB-only disclosure of key_hash is useless without the pepper.
 */
export function hashApiKeyHmac(key: string, domain: ApiKeyDomain): string {
  return createHmac('sha256', getApiKeyPepper()).update(`${domain}:${key}`).digest('hex')
}

/**
 * The set of stored key_hash values a presented key may legitimately match
 * under dual-read: the legacy bare SHA-256 (domain-less — matches pre-(K) rows)
 * AND the new domain-separated HMAC (matches rows issued at/after (K)). Verify
 * sites look up `key_hash IN (candidates)`. Centralizes the dual-read scheme so
 * no verify site can diverge (e.g. the formerly-inlined publisher hash).
 */
export function apiKeyHashCandidates(key: string, domain: ApiKeyDomain): string[] {
  return [hashApiKey(key), hashApiKeyHmac(key, domain)]
}
