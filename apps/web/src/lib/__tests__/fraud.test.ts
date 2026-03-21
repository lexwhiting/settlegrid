import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedis, mockTryRedis } = vi.hoisted(() => {
  const mockRedis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    sadd: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(1),
    incrbyfloat: vi.fn().mockResolvedValue(0),
    lpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue('OK'),
    lrange: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(),
  }
  mockRedis.pipeline.mockReturnValue({
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    scard: vi.fn().mockReturnThis(),
    incrbyfloat: vi.fn().mockReturnThis(),
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

import {
  detectFraud,
  cleanupMemoryCounters,
  trackFailedAuth,
  isIpBlocked,
  flagChargeback,
  hasChargebackHistory,
  checkSessionDepth,
  FraudSignal,
} from '@/lib/fraud'
import type { FraudResult } from '@/lib/fraud'

function resetMocks() {
  vi.clearAllMocks()
  cleanupMemoryCounters()

  mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } catch {
      return null
    }
  })

  const pipelineMock = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    scard: vi.fn().mockReturnThis(),
    incrbyfloat: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([1, true]),
  }
  mockRedis.pipeline.mockReturnValue(pipelineMock)
  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.lrange.mockResolvedValue([])
  mockRedis.lpush.mockResolvedValue(1)
  mockRedis.ltrim.mockResolvedValue('OK')
  mockRedis.expire.mockResolvedValue(true)

  return pipelineMock
}

describe('Fraud Detection', () => {
  let pipelineMock: ReturnType<typeof resetMocks>

  beforeEach(() => {
    pipelineMock = resetMocks()
  })

  // ── Signal 1: Rate Spike ────────────────────────────────────────────────────
  describe('Signal 1: Rate Spike', () => {
    it('returns no flags for normal invocation', async () => {
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.flagged).toBe(false)
      expect(result.reasons).toHaveLength(0)
      expect(result.signals).toHaveLength(0)
      expect(result.riskScore).toBe(0)
    })

    it('flags rate spike when >50 invocations in 60s', async () => {
      pipelineMock.exec.mockResolvedValue([55, true])

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.flagged).toBe(true)
      expect(result.signals).toContain(FraudSignal.RATE_SPIKE)
      expect(result.reasons[0]).toContain('Rate spike')
      expect(result.riskScore).toBeGreaterThanOrEqual(50)
    })

    it('adds elevated risk for >30 invocations', async () => {
      pipelineMock.exec.mockResolvedValue([35, true])

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.flagged).toBe(false)
      expect(result.riskScore).toBe(15)
    })
  })

  // ── Signal 2: New Key High Value ────────────────────────────────────────────
  describe('Signal 2: New Key High Value', () => {
    it('flags new key high value invocation', async () => {
      const keyCreatedAt = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1h ago

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 1500,
        ip: '1.2.3.4',
        keyCreatedAt,
      })
      expect(result.signals).toContain(FraudSignal.NEW_KEY_HIGH_VALUE)
      expect(result.reasons.some(r => r.includes('New key high value'))).toBe(true)
      expect(result.riskScore).toBe(40)
    })

    it('does not flag old keys with high value invocations', async () => {
      const keyCreatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48h ago

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5000,
        ip: '1.2.3.4',
        keyCreatedAt,
      })
      expect(result.signals).not.toContain(FraudSignal.NEW_KEY_HIGH_VALUE)
    })
  })

  // ── Signal 3: Rapid Duplicate ───────────────────────────────────────────────
  describe('Signal 3: Rapid Duplicate', () => {
    it('flags rapid duplicate invocations', async () => {
      mockRedis.get.mockResolvedValueOnce(null)
      await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })

      mockRedis.get.mockResolvedValueOnce('1')
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.signals).toContain(FraudSignal.RAPID_DUPLICATE)
      expect(result.riskScore).toBeGreaterThanOrEqual(30)
    })
  })

  // ── Signal 4: Hourly Velocity ───────────────────────────────────────────────
  describe('Signal 4: Hourly Velocity', () => {
    it('flags when >500 invocations in 1 hour', async () => {
      // Pipeline is called multiple times; we track call count
      let callIndex = 0
      pipelineMock.exec.mockImplementation(async () => {
        callIndex++
        // The 2nd pipeline call is the hourly velocity check (1st is rate spike)
        if (callIndex === 2) return [510, true]
        return [1, true]
      })

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.signals).toContain(FraudSignal.HOURLY_VELOCITY)
      expect(result.reasons.some(r => r.includes('Hourly velocity'))).toBe(true)
    })

    it('does not flag normal hourly volume', async () => {
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.signals).not.toContain(FraudSignal.HOURLY_VELOCITY)
    })
  })

  // ── Signal 5: IP Velocity ──────────────────────────────────────────────────
  describe('Signal 5: IP Velocity', () => {
    it('flags when >100 requests per minute from single IP', async () => {
      let callIndex = 0
      pipelineMock.exec.mockImplementation(async () => {
        callIndex++
        // The 3rd pipeline call is IP velocity (1=rate spike, 2=hourly, 3=ip)
        if (callIndex === 3) return [110, true]
        return [1, true]
      })

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '10.0.0.1',
      })
      expect(result.signals).toContain(FraudSignal.IP_VELOCITY)
      expect(result.reasons.some(r => r.includes('IP velocity'))).toBe(true)
    })
  })

  // ── Signal 6: Spending Velocity ────────────────────────────────────────────
  describe('Signal 6: Spending Velocity', () => {
    it('flags when accumulated spend exceeds $50/hour', async () => {
      let callIndex = 0
      pipelineMock.exec.mockImplementation(async () => {
        callIndex++
        // The 4th pipeline call is spending velocity
        if (callIndex === 4) return [5500, true]
        return [1, true]
      })

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 500,
        ip: '1.2.3.4',
      })
      expect(result.signals).toContain(FraudSignal.SPENDING_VELOCITY)
      expect(result.reasons.some(r => r.includes('Spending velocity'))).toBe(true)
    })

    it('does not flag normal spending levels', async () => {
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 100,
        ip: '1.2.3.4',
      })
      expect(result.signals).not.toContain(FraudSignal.SPENDING_VELOCITY)
    })
  })

  // ── Signal 7: Multi-IP Key ─────────────────────────────────────────────────
  describe('Signal 7: Multi-IP Key', () => {
    it('flags when key is used from >5 unique IPs in 5 min', async () => {
      let callIndex = 0
      pipelineMock.exec.mockImplementation(async () => {
        callIndex++
        // The 5th pipeline call (after rate spike, hourly, IP velocity, spending) is multi-IP key
        if (callIndex === 5) return [1, 7, 300]
        return [1, true]
      })

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
        keyId: 'key-1',
      })
      expect(result.signals).toContain(FraudSignal.MULTI_IP_KEY)
      expect(result.reasons.some(r => r.includes('Multi-IP key'))).toBe(true)
      expect(result.riskScore).toBeGreaterThanOrEqual(25)
    })

    it('flags with higher risk for >10 unique IPs', async () => {
      let callIndex = 0
      pipelineMock.exec.mockImplementation(async () => {
        callIndex++
        if (callIndex === 5) return [1, 12, 300]
        return [1, true]
      })

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
        keyId: 'key-1',
      })
      expect(result.signals).toContain(FraudSignal.MULTI_IP_KEY)
      expect(result.reasons.some(r => r.includes('threshold: 10'))).toBe(true)
    })

    it('does not check multi-IP when keyId is not provided', async () => {
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.signals).not.toContain(FraudSignal.MULTI_IP_KEY)
    })
  })

  // ── Signal 8: Dormant Key Reactivation ─────────────────────────────────────
  describe('Signal 8: Dormant Key Reactivation', () => {
    it('flags key dormant >90 days with any cost', async () => {
      const keyLastUsedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
        keyLastUsedAt,
      })
      expect(result.signals).toContain(FraudSignal.DORMANT_KEY)
      expect(result.reasons.some(r => r.includes('Dormant key reactivation'))).toBe(true)
      // 90+ day dormant = +30
      expect(result.riskScore).toBeGreaterThanOrEqual(30)
    })

    it('flags key dormant >30 days with costCents >500', async () => {
      const keyLastUsedAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) // 45 days ago

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 600,
        ip: '1.2.3.4',
        keyLastUsedAt,
      })
      expect(result.signals).toContain(FraudSignal.DORMANT_KEY)
      expect(result.riskScore).toBeGreaterThanOrEqual(25)
    })

    it('does not flag key dormant >30 days with low cost', async () => {
      const keyLastUsedAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 100,
        ip: '1.2.3.4',
        keyLastUsedAt,
      })
      expect(result.signals).not.toContain(FraudSignal.DORMANT_KEY)
    })

    it('does not flag key used recently', async () => {
      const keyLastUsedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5000,
        ip: '1.2.3.4',
        keyLastUsedAt,
      })
      expect(result.signals).not.toContain(FraudSignal.DORMANT_KEY)
    })

    it('does not flag when keyLastUsedAt is null', async () => {
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5000,
        ip: '1.2.3.4',
        keyLastUsedAt: null,
      })
      expect(result.signals).not.toContain(FraudSignal.DORMANT_KEY)
    })
  })

  // ── Signal 9: Unusual Amount ───────────────────────────────────────────────
  describe('Signal 9: Unusual Amount', () => {
    it('flags cost >5x median of recent amounts', async () => {
      // Simulate: pushed 500, then existing amounts [100, 100, 100, 100]
      mockRedis.lrange.mockResolvedValue([500, 100, 100, 100, 100])

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 500,
        ip: '1.2.3.4',
      })
      // median of [100, 100, 100, 100] = 100, cost 500 = 5x median
      // Need strictly >5x, so 500 is not >5*100=500
      expect(result.signals).not.toContain(FraudSignal.UNUSUAL_AMOUNT)
    })

    it('flags cost strictly >5x median', async () => {
      // Cost 600, prior amounts [100, 100, 100, 100] -> median 100, 600 > 500
      mockRedis.lrange.mockResolvedValue([600, 100, 100, 100, 100])

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 600,
        ip: '1.2.3.4',
      })
      expect(result.signals).toContain(FraudSignal.UNUSUAL_AMOUNT)
      expect(result.reasons.some(r => r.includes('Unusual amount'))).toBe(true)
    })

    it('does not flag when insufficient history', async () => {
      mockRedis.lrange.mockResolvedValue([500])

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 500,
        ip: '1.2.3.4',
      })
      expect(result.signals).not.toContain(FraudSignal.UNUSUAL_AMOUNT)
    })

    it('does not flag zero-cost invocations', async () => {
      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 0,
        ip: '1.2.3.4',
      })
      expect(result.signals).not.toContain(FraudSignal.UNUSUAL_AMOUNT)
    })
  })

  // ── Signal 10: Chargeback History ──────────────────────────────────────────
  describe('Signal 10: Chargeback History', () => {
    it('flags consumer with chargeback history', async () => {
      mockRedis.get
        .mockResolvedValueOnce(null) // duplicate check returns null
        .mockResolvedValueOnce('1')   // chargeback check returns '1'

      const result = await detectFraud({
        consumerId: 'con-chargeback',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.signals).toContain(FraudSignal.CHARGEBACK_HISTORY)
      expect(result.reasons.some(r => r.includes('Chargeback history'))).toBe(true)
      expect(result.riskScore).toBeGreaterThanOrEqual(30)
    })

    it('does not flag consumer without chargeback history', async () => {
      const result = await detectFraud({
        consumerId: 'con-clean',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.signals).not.toContain(FraudSignal.CHARGEBACK_HISTORY)
    })
  })

  // ── Combined signals ───────────────────────────────────────────────────────
  describe('Combined Signals', () => {
    it('combines multiple risk factors', async () => {
      pipelineMock.exec.mockResolvedValue([60, true])
      const keyCreatedAt = new Date(Date.now() - 30 * 60 * 1000) // 30min ago

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 2000,
        ip: '1.2.3.4',
        keyCreatedAt,
      })
      expect(result.flagged).toBe(true)
      expect(result.riskScore).toBeGreaterThanOrEqual(90)
      expect(result.signals.length).toBeGreaterThanOrEqual(2)
    })

    it('caps risk score at 100', async () => {
      pipelineMock.exec.mockResolvedValue([100, true])
      mockRedis.get
        .mockResolvedValueOnce('1') // duplicate
        .mockResolvedValueOnce('1') // chargeback
      const keyCreatedAt = new Date(Date.now() - 10 * 60 * 1000)

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5000,
        ip: '1.2.3.4',
        keyCreatedAt,
      })
      expect(result.riskScore).toBeLessThanOrEqual(100)
    })

    it('returns typed signals array', async () => {
      pipelineMock.exec.mockResolvedValue([55, true])

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(Array.isArray(result.signals)).toBe(true)
      for (const s of result.signals) {
        expect(Object.values(FraudSignal)).toContain(s)
      }
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────────
  describe('Error Handling', () => {
    it('handles Redis failure gracefully', async () => {
      mockTryRedis.mockResolvedValue(null)
      mockRedis.pipeline.mockImplementation(() => { throw new Error('Redis down') })

      const result = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result.flagged).toBe(false)
      expect(result.riskScore).toBe(0)
      expect(result.signals).toHaveLength(0)
    })
  })

  // ── FraudResult interface ──────────────────────────────────────────────────
  describe('FraudResult Interface', () => {
    it('includes all required fields', async () => {
      const result: FraudResult = await detectFraud({
        consumerId: 'con-1',
        toolId: 'tool-1',
        costCents: 5,
        ip: '1.2.3.4',
      })
      expect(result).toHaveProperty('flagged')
      expect(result).toHaveProperty('reasons')
      expect(result).toHaveProperty('signals')
      expect(result).toHaveProperty('riskScore')
      expect(typeof result.flagged).toBe('boolean')
      expect(Array.isArray(result.reasons)).toBe(true)
      expect(Array.isArray(result.signals)).toBe(true)
      expect(typeof result.riskScore).toBe('number')
    })
  })
})

// ── trackFailedAuth / isIpBlocked ────────────────────────────────────────────

describe('Failed Auth Tracking', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('tracks a failed auth attempt', async () => {
    await trackFailedAuth('10.0.0.1')
    // Should call pipeline.incr and pipeline.expire
    expect(mockRedis.pipeline).toHaveBeenCalled()
  })

  it('blocks IP after >5 failures', async () => {
    const pMock = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([6, true]),
    }
    mockRedis.pipeline.mockReturnValue(pMock)

    await trackFailedAuth('10.0.0.1')

    // Should have attempted to set the block key
    expect(mockTryRedis).toHaveBeenCalledTimes(2) // once for incr, once for set block
  })

  it('isIpBlocked returns false for non-blocked IP', async () => {
    mockRedis.get.mockResolvedValue(null)
    const blocked = await isIpBlocked('10.0.0.1')
    expect(blocked).toBe(false)
  })

  it('isIpBlocked returns true for blocked IP', async () => {
    mockRedis.get.mockResolvedValue('1')
    const blocked = await isIpBlocked('10.0.0.1')
    expect(blocked).toBe(true)
  })

  it('isIpBlocked returns false on Redis error', async () => {
    mockTryRedis.mockResolvedValue(null)
    mockRedis.get.mockRejectedValue(new Error('Redis down'))
    const blocked = await isIpBlocked('10.0.0.1')
    expect(blocked).toBe(false)
  })
})

// ── flagChargeback / hasChargebackHistory ─────────────────────────────────────

describe('Chargeback Flagging', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('flags a consumer chargeback in Redis', async () => {
    await flagChargeback('con-1')
    expect(mockTryRedis).toHaveBeenCalled()
  })

  it('hasChargebackHistory returns true when flagged', async () => {
    mockRedis.get.mockResolvedValue('1')
    const result = await hasChargebackHistory('con-1')
    expect(result).toBe(true)
  })

  it('hasChargebackHistory returns false when not flagged', async () => {
    mockRedis.get.mockResolvedValue(null)
    const result = await hasChargebackHistory('con-1')
    expect(result).toBe(false)
  })

  it('falls back to memory on Redis failure', async () => {
    // First flag in memory by calling flagChargeback with Redis working
    await flagChargeback('con-memory')

    // Now simulate Redis failure
    mockTryRedis.mockResolvedValue(null)
    mockRedis.get.mockRejectedValue(new Error('down'))

    const result = await hasChargebackHistory('con-memory')
    expect(result).toBe(true)
  })
})

// ── checkSessionDepth ────────────────────────────────────────────────────────

describe('Session Depth Check', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('allows depth <= 3 with no risk', async () => {
    const pMock = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([2, true]),
    }
    mockRedis.pipeline.mockReturnValue(pMock)

    const result = await checkSessionDepth('session-1')
    expect(result.allowed).toBe(true)
    expect(result.riskScore).toBe(0)
    expect(result.signal).toBeUndefined()
  })

  it('warns at depth 4 (>3) with risk +15', async () => {
    const pMock = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([4, true]),
    }
    mockRedis.pipeline.mockReturnValue(pMock)

    const result = await checkSessionDepth('session-2')
    expect(result.allowed).toBe(true)
    expect(result.depth).toBe(4)
    expect(result.riskScore).toBe(15)
    expect(result.signal).toBe(FraudSignal.SESSION_NESTING)
  })

  it('rejects depth >5', async () => {
    const pMock = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([6, true]),
    }
    mockRedis.pipeline.mockReturnValue(pMock)

    const result = await checkSessionDepth('session-3')
    expect(result.allowed).toBe(false)
    expect(result.depth).toBe(6)
    expect(result.riskScore).toBe(100)
    expect(result.signal).toBe(FraudSignal.SESSION_NESTING)
    expect(result.reason).toContain('exceeds maximum')
  })

  it('handles Redis failure gracefully', async () => {
    mockRedis.pipeline.mockImplementation(() => { throw new Error('Redis down') })
    mockTryRedis.mockResolvedValue(null)

    const result = await checkSessionDepth('session-4')
    expect(result.allowed).toBe(true)
    expect(result.riskScore).toBe(0)
  })
})

// ── FraudSignal Enum ─────────────────────────────────────────────────────────

describe('FraudSignal Enum', () => {
  it('has 11 signal values', () => {
    const values = Object.values(FraudSignal)
    expect(values).toHaveLength(11)
  })

  it('contains all expected signals', () => {
    expect(FraudSignal.RATE_SPIKE).toBe('rate_spike')
    expect(FraudSignal.NEW_KEY_HIGH_VALUE).toBe('new_key_high_value')
    expect(FraudSignal.RAPID_DUPLICATE).toBe('rapid_duplicate')
    expect(FraudSignal.HOURLY_VELOCITY).toBe('hourly_velocity')
    expect(FraudSignal.IP_VELOCITY).toBe('ip_velocity')
    expect(FraudSignal.SPENDING_VELOCITY).toBe('spending_velocity')
    expect(FraudSignal.MULTI_IP_KEY).toBe('multi_ip_key')
    expect(FraudSignal.DORMANT_KEY).toBe('dormant_key')
    expect(FraudSignal.UNUSUAL_AMOUNT).toBe('unusual_amount')
    expect(FraudSignal.CHARGEBACK_HISTORY).toBe('chargeback_history')
    expect(FraudSignal.SESSION_NESTING).toBe('session_nesting')
  })
})
