import { describe, it, expect, vi } from 'vitest'
import {
  generateApiKey,
  generatePublisherApiKey,
  hashApiKey,
  hashApiKeyHmac,
  apiKeyHashCandidates,
} from '@/lib/crypto'

// (K) HMAC-pepper: the keyed, domain-separated hash + the dual-read candidate
// set (register DEBT #3). The test-env pepper is injected via vitest.config.ts
// `test.env.API_KEY_PEPPER`; the fail-closed + pepper-dependent cases stub it.

describe('hashApiKeyHmac', () => {
  it('is HMAC, not the legacy bare SHA-256, for the same key', () => {
    const key = 'sg_live_abc123'
    expect(hashApiKeyHmac(key, 'live')).not.toBe(hashApiKey(key))
  })

  it('is a 64-char lowercase hex digest (== SHA width; key_hash index unaffected)', () => {
    expect(/^[a-f0-9]{64}$/.test(hashApiKeyHmac('sg_live_abc123', 'live'))).toBe(true)
  })

  it('is deterministic for a fixed pepper + domain + key', () => {
    expect(hashApiKeyHmac('sg_live_x', 'live')).toBe(hashApiKeyHmac('sg_live_x', 'live'))
  })

  it('separates domains: live and pub differ for the same key', () => {
    const key = 'sg_collide_same_raw_key'
    expect(hashApiKeyHmac(key, 'live')).not.toBe(hashApiKeyHmac(key, 'pub'))
  })

  it('is pepper-dependent: a different pepper yields a different hash', () => {
    const key = 'sg_live_peppertest'
    const withConfigPepper = hashApiKeyHmac(key, 'live')
    vi.stubEnv('API_KEY_PEPPER', 'a_completely_different_test_pepper_value')
    try {
      expect(hashApiKeyHmac(key, 'live')).not.toBe(withConfigPepper)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('FAILS CLOSED: throws when the pepper is empty (never falls back to SHA)', () => {
    vi.stubEnv('API_KEY_PEPPER', '')
    try {
      expect(() => hashApiKeyHmac('sg_live_x', 'live')).toThrow()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('apiKeyHashCandidates (dual-read scheme)', () => {
  it('returns exactly [legacy SHA-256, new HMAC] — two distinct candidates, SHA branch domain-less', () => {
    const key = 'sg_live_dualread'
    const cands = apiKeyHashCandidates(key, 'live')
    expect(cands).toHaveLength(2)
    expect(cands[0]).toBe(hashApiKey(key)) // domain-LESS legacy → matches pre-(K) rows
    expect(cands[1]).toBe(hashApiKeyHmac(key, 'live'))
    expect(cands[0]).not.toBe(cands[1])
  })

  it('legacy regression: a pre-(K) SHA-256 row value is in the candidate set', () => {
    const key = 'sg_live_legacyrow'
    const legacyStored = hashApiKey(key) // how a pre-(K) row was written
    expect(apiKeyHashCandidates(key, 'live')).toContain(legacyStored)
  })

  it('a new-(K) HMAC row value is in the candidate set', () => {
    const key = 'sg_live_newrow'
    const newStored = hashApiKeyHmac(key, 'live') // how a new row is written
    expect(apiKeyHashCandidates(key, 'live')).toContain(newStored)
  })

  it('wrong domain does NOT match a key issued under the other domain', () => {
    const key = 'sg_pub_xyz'
    const pubStored = hashApiKeyHmac(key, 'pub')
    expect(apiKeyHashCandidates(key, 'live')).not.toContain(pubStored)
  })
})

describe('generateApiKey / generatePublisherApiKey emit HMAC (new keys)', () => {
  it('consumer key hash === HMAC(live) and !== legacy SHA', () => {
    const { key, hash } = generateApiKey()
    expect(hash).toBe(hashApiKeyHmac(key, 'live'))
    expect(hash).not.toBe(hashApiKey(key))
  })

  it('publisher key hash === HMAC(pub) and !== legacy SHA', () => {
    const { key, hash } = generatePublisherApiKey()
    expect(hash).toBe(hashApiKeyHmac(key, 'pub'))
    expect(hash).not.toBe(hashApiKey(key))
  })
})
