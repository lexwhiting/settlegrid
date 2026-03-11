import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedis, mockTryRedis } = vi.hoisted(() => {
  const mockRedis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    pipeline: vi.fn(),
  }
  mockRedis.pipeline.mockReturnValue({
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([1, true]),
  })

  const mockTryRedis = vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } catch {
      return null
    }
  })

  return { mockRedis, mockTryRedis }
})

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn().mockReturnValue(mockRedis),
  tryRedis: mockTryRedis,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { detectFraud, cleanupMemoryCounters } from '@/lib/fraud'

describe('Fraud Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanupMemoryCounters()

    // Re-set tryRedis implementation after clearAllMocks
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try {
        return await fn()
      } catch {
        return null
      }
    })

    // Reset pipeline mock
    mockRedis.pipeline.mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([1, true]),
    })
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
  })

  it('returns no flags for normal invocation', async () => {
    const result = await detectFraud('con-1', 'tool-1', 5, '1.2.3.4')
    expect(result.flagged).toBe(false)
    expect(result.reasons).toHaveLength(0)
    expect(result.riskScore).toBe(0)
  })

  it('flags rate spike when >50 invocations in 60s', async () => {
    mockRedis.pipeline.mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([55, true]),
    })

    const result = await detectFraud('con-1', 'tool-1', 5, '1.2.3.4')
    expect(result.flagged).toBe(true)
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.reasons[0]).toContain('Rate spike')
    expect(result.riskScore).toBeGreaterThanOrEqual(50)
  })

  it('flags new key high value invocation', async () => {
    const keyCreatedAt = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1h ago

    const result = await detectFraud('con-1', 'tool-1', 1500, '1.2.3.4', keyCreatedAt)
    expect(result.reasons.some(r => r.includes('New key high value'))).toBe(true)
    expect(result.riskScore).toBe(40)
  })

  it('flags rapid duplicate invocations', async () => {
    // First call: set the key in Redis
    mockRedis.get.mockResolvedValueOnce(null)
    await detectFraud('con-1', 'tool-1', 5, '1.2.3.4')

    // Second call: Redis returns existing key (duplicate)
    mockRedis.get.mockResolvedValueOnce('1')
    const result = await detectFraud('con-1', 'tool-1', 5, '1.2.3.4')
    expect(result.reasons.some(r => r.includes('Rapid duplicate'))).toBe(true)
    expect(result.riskScore).toBeGreaterThanOrEqual(30)
  })

  it('combines multiple risk factors', async () => {
    // Rate spike + new key high value
    mockRedis.pipeline.mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([60, true]),
    })
    const keyCreatedAt = new Date(Date.now() - 30 * 60 * 1000) // 30min ago

    const result = await detectFraud('con-1', 'tool-1', 2000, '1.2.3.4', keyCreatedAt)
    expect(result.flagged).toBe(true)
    expect(result.riskScore).toBeGreaterThanOrEqual(90)
    expect(result.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('caps risk score at 100', async () => {
    // Trigger all three checks
    mockRedis.pipeline.mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([100, true]),
    })
    mockRedis.get.mockResolvedValueOnce('1') // duplicate
    const keyCreatedAt = new Date(Date.now() - 10 * 60 * 1000) // 10min ago

    const result = await detectFraud('con-1', 'tool-1', 5000, '1.2.3.4', keyCreatedAt)
    expect(result.riskScore).toBeLessThanOrEqual(100)
  })

  it('does not flag old keys with high value invocations', async () => {
    const keyCreatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48h ago

    const result = await detectFraud('con-1', 'tool-1', 5000, '1.2.3.4', keyCreatedAt)
    expect(result.reasons.some(r => r.includes('New key high value'))).toBe(false)
  })

  it('handles Redis failure gracefully', async () => {
    // Make tryRedis always return null (simulating Redis failure)
    mockTryRedis.mockResolvedValue(null)
    // Also make getRedis methods throw to trigger the catch in detectFraud
    mockRedis.pipeline.mockImplementation(() => { throw new Error('Redis down') })

    const result = await detectFraud('con-1', 'tool-1', 5, '1.2.3.4')
    expect(result.flagged).toBe(false)
    expect(result.riskScore).toBe(0)
  })
})
