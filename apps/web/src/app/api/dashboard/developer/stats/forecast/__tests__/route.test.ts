import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The forecast must not read a trend into a handful of days (one day of revenue
// used to show "-100% declining").
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-1' }) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '1.2.3.4',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/tier-config', () => ({ hasFeature: () => true }))

import { GET } from '../route'

const req = () => new NextRequest('http://localhost/api/dashboard/developer/stats/forecast')
const day = (i: number, cents: number) => ({ date: `2026-11-${String(i).padStart(2, '0')}`, revenueCents: cents })

describe('GET /api/dashboard/developer/stats/forecast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of ['select', 'from', 'where', 'groupBy', 'orderBy'] as const) mockDb[k].mockReturnThis()
  })

  it('reports not enough data instead of a trend for fewer than 7 days of revenue', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'scale', isFoundingMember: true }])
      .mockResolvedValueOnce([{ id: 'tool-1' }])
      .mockResolvedValueOnce([day(1, 1)]) // one day, one cent
    const data = await (await GET(req())).json()
    expect(data.insufficientData).toBe(true)
    expect(data.trend).toBe('stable')
    expect(data.growthRate).toBe(0)
    expect(data.projectedNextMonthCents).toBe(0)
    expect(data.dailyDataPoints).toBe(1)
  })

  it('computes a trend once there are at least 7 days', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ tier: 'scale', isFoundingMember: true }])
      .mockResolvedValueOnce([{ id: 'tool-1' }])
      .mockResolvedValueOnce([1, 2, 3, 4, 5, 6, 7, 8].map((i) => day(i, i * 100))) // rising
    const data = await (await GET(req())).json()
    expect(data.insufficientData).toBeUndefined()
    expect(data.trend).toBe('growing')
    expect(data.projectedNextMonthCents).toBeGreaterThan(0)
  })
})
