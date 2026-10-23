/**
 * GET /api/dashboard/developer/fraud/signals — response shape.
 * Storage key names and fallback internals stay server-side.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: { id: 'id', developerId: 'developer_id' },
  invocations: { createdAt: 'created_at', toolId: 'tool_id', isFlagged: 'is_flagged' },
  developers: { id: 'id', tier: 'tier', isFoundingMember: 'is_founding_member' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  gte: vi.fn((a, b) => ({ gte: [a, b] })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
  sql: vi.fn(() => ({})),
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '1.2.3.4',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/redis', () => ({ getRedis: () => ({ ping: vi.fn().mockResolvedValue('PONG') }) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { GET } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-1', email: 'dev@example.com' })
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockDb.limit
    .mockReset()
    .mockResolvedValueOnce([{ tier: 'scale', isFoundingMember: false }]) // tier gate
    .mockResolvedValueOnce([]) // no tools
})

describe('GET /api/dashboard/developer/fraud/signals', () => {
  it('returns signals and a summary without storage key names or fallback internals', async () => {
    const res = await GET(new NextRequest('http://localhost/api/dashboard/developer/fraud/signals'))
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.signals.length).toBeGreaterThan(0)
    for (const signal of json.signals) {
      expect(signal).not.toHaveProperty('redisKeyPattern')
      expect(signal).not.toHaveProperty('fallbackBehavior')
    }
    expect(json.summary).not.toHaveProperty('redisHealthy')
    expect(json.summary).toMatchObject({
      totalSignals: json.signals.length,
      scannedToday: 0,
      flaggedThisWeek: 0,
    })
    expect(JSON.stringify(json)).not.toContain('fraud:')
  })
})
