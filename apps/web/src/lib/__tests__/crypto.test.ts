import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey } from '@/lib/crypto'

describe('generateApiKey', () => {
  it('returns key, hash, and prefix', () => {
    const result = generateApiKey()
    expect(result.key).toBeDefined()
    expect(result.hash).toBeDefined()
    expect(result.prefix).toBeDefined()
  })

  it('generates key with sg_live_ prefix', () => {
    const { key } = generateApiKey()
    expect(key.startsWith('sg_live_')).toBe(true)
  })

  it('generates key with correct total length', () => {
    const { key } = generateApiKey()
    // sg_live_ (8 chars) + 64 hex chars = 72 chars
    expect(key.length).toBe(72)
  })

  it('generates unique keys each time', () => {
    const key1 = generateApiKey()
    const key2 = generateApiKey()
    expect(key1.key).not.toBe(key2.key)
    expect(key1.hash).not.toBe(key2.hash)
  })

  it('prefix is first 8 characters of key', () => {
    const { key, prefix } = generateApiKey()
    expect(prefix).toBe(key.slice(0, 8))
  })

  it('hash is valid SHA-256 hex digest (64 chars)', () => {
    const { hash } = generateApiKey()
    expect(hash.length).toBe(64)
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true)
  })

  it('hash matches hashApiKey output for same key', () => {
    const { key, hash } = generateApiKey()
    expect(hashApiKey(key)).toBe(hash)
  })
})

describe('hashApiKey', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = hashApiKey('sg_live_test123')
    const hash2 = hashApiKey('sg_live_test123')
    expect(hash1).toBe(hash2)
  })

  it('returns different hash for different input', () => {
    const hash1 = hashApiKey('sg_live_test123')
    const hash2 = hashApiKey('sg_live_test456')
    expect(hash1).not.toBe(hash2)
  })

  it('returns 64-char hex string', () => {
    const hash = hashApiKey('sg_live_anything')
    expect(hash.length).toBe(64)
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true)
  })
})
