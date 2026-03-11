import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey } from '../crypto'

describe('generateApiKey (extended)', () => {
  it('key starts with sg_live_ prefix', () => {
    const { key } = generateApiKey()
    expect(key.startsWith('sg_live_')).toBe(true)
  })

  it('key has 72 characters total (8 prefix + 64 hex)', () => {
    const { key } = generateApiKey()
    // sg_live_ = 8 chars, 32 bytes hex = 64 chars
    expect(key.length).toBe(8 + 64)
  })

  it('hash is a 64-character hex string (SHA-256)', () => {
    const { hash } = generateApiKey()
    expect(hash.length).toBe(64)
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true)
  })

  it('prefix is first 8 characters of the key', () => {
    const { key, prefix } = generateApiKey()
    expect(prefix).toBe(key.slice(0, 8))
    expect(prefix).toBe('sg_live_')
  })

  it('generates unique keys each time', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 50; i++) {
      keys.add(generateApiKey().key)
    }
    expect(keys.size).toBe(50)
  })

  it('generates unique hashes each time', () => {
    const hashes = new Set<string>()
    for (let i = 0; i < 50; i++) {
      hashes.add(generateApiKey().hash)
    }
    expect(hashes.size).toBe(50)
  })

  it('hash matches hashApiKey of the key', () => {
    const { key, hash } = generateApiKey()
    expect(hashApiKey(key)).toBe(hash)
  })

  it('key contains only valid hex characters after prefix', () => {
    const { key } = generateApiKey()
    const randomPart = key.slice(8)
    expect(/^[a-f0-9]+$/.test(randomPart)).toBe(true)
  })
})

describe('hashApiKey (extended)', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = hashApiKey('sg_live_test123')
    const hash2 = hashApiKey('sg_live_test123')
    expect(hash1).toBe(hash2)
  })

  it('returns different hash for different input', () => {
    const hash1 = hashApiKey('sg_live_key_a')
    const hash2 = hashApiKey('sg_live_key_b')
    expect(hash1).not.toBe(hash2)
  })

  it('returns 64 character hex string', () => {
    const hash = hashApiKey('anything')
    expect(hash.length).toBe(64)
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true)
  })

  it('handles empty string', () => {
    const hash = hashApiKey('')
    expect(hash.length).toBe(64)
  })

  it('handles long strings', () => {
    const longKey = 'sg_live_' + 'a'.repeat(10000)
    const hash = hashApiKey(longKey)
    expect(hash.length).toBe(64)
  })

  it('handles special characters', () => {
    const hash = hashApiKey('sg_live_!@#$%^&*()')
    expect(hash.length).toBe(64)
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true)
  })

  it('is case sensitive', () => {
    const hash1 = hashApiKey('ABC')
    const hash2 = hashApiKey('abc')
    expect(hash1).not.toBe(hash2)
  })
})
