import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
    decrby: vi.fn().mockResolvedValue(100),
    incrby: vi.fn().mockResolvedValue(100),
  })),
}))

vi.mock('@/lib/env', () => ({
  getRedisUrl: vi.fn().mockReturnValue('https://test.upstash.io'),
  getUpstashRedisRestToken: vi.fn().mockReturnValue('test-token'),
}))

describe('Redis client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports getRedis function', async () => {
    const { getRedis } = await import('../redis')
    expect(getRedis).toBeDefined()
    expect(typeof getRedis).toBe('function')
  })

  it('returns a Redis instance', async () => {
    const { getRedis } = await import('../redis')
    const redis = getRedis()
    expect(redis).toBeDefined()
  })

  it('returns the same instance on subsequent calls (singleton)', async () => {
    const { getRedis } = await import('../redis')
    const r1 = getRedis()
    const r2 = getRedis()
    expect(r1).toBe(r2)
  })

  it('tryRedis returns value on success', async () => {
    const { tryRedis } = await import('../redis')
    const result = await tryRedis(() => Promise.resolve(42))
    expect(result).toBe(42)
  })

  it('tryRedis returns null on error', async () => {
    const { tryRedis } = await import('../redis')
    const result = await tryRedis(() => Promise.reject(new Error('fail')))
    expect(result).toBeNull()
  })

  it('tryRedis handles async functions', async () => {
    const { tryRedis } = await import('../redis')
    const result = await tryRedis(async () => 'hello')
    expect(result).toBe('hello')
  })
})
