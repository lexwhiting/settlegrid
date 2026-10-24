/**
 * GET /api/v1/discover/developers/:slug — the cached reputation uptime is
 * only returned when the developer has health checks; otherwise null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, HAS_CHECKS } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    orderBy: vi.fn(),
  }
  return { mockDb, HAS_CHECKS: { hasRecentHealthChecks: true } }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id', name: 'name', slug: 'slug', publicBio: 'public_bio', avatarUrl: 'avatar_url',
    publicProfile: 'public_profile', createdAt: 'created_at',
  },
  tools: {
    name: 'name', slug: 'slug', description: 'description', category: 'category',
    currentVersion: 'current_version', totalInvocations: 'total_invocations',
    developerId: 'developer_id', status: 'status',
  },
  developerReputation: {
    developerId: 'developer_id', score: 'score', uptimePct: 'uptime_pct', reviewAvg: 'review_avg',
    totalTools: 'total_tools', totalConsumers: 'total_consumers',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
}))
vi.mock('@/lib/developer-health', () => ({
  hasRecentHealthChecksSql: vi.fn(() => HAS_CHECKS),
}))
vi.mock('@/lib/marketplace-visibility', () => ({
  excludeInternalTestToolsSql: vi.fn(() => ({ excludeInternalTestTools: true })),
}))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  getClientIp: () => '203.0.113.5',
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { GET } from '../route'
import { hasRecentHealthChecksSql } from '@/lib/developer-health'

const DEVELOPER = {
  id: 'dev-1', name: 'Ada', slug: 'ada', bio: null, avatarUrl: null, publicProfile: true,
  createdAt: new Date('2026-01-01'),
}
const REPUTATION = { score: 40, uptimePct: 0, reviewAvg: 0, totalTools: 1, totalConsumers: 0 }

function call() {
  return GET(new NextRequest('http://localhost/api/v1/discover/developers/ada'), {
    params: Promise.resolve({ slug: 'ada' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.orderBy.mockResolvedValue([])
})

describe('GET /api/v1/discover/developers/:slug', () => {
  it('returns uptimePct null when the developer has no health checks', async () => {
    mockDb.limit
      .mockResolvedValueOnce([DEVELOPER])
      .mockResolvedValueOnce([{ ...REPUTATION, hasChecks: false }])

    const res = await call()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(hasRecentHealthChecksSql).toHaveBeenCalledWith('dev-1')
    expect(mockDb.select).toHaveBeenCalledWith(expect.objectContaining({ hasChecks: HAS_CHECKS }))
    expect(body.developer.reputation.uptimePct).toBeNull()
  })

  it('returns the cached uptimePct when health checks exist (including a real 0%)', async () => {
    mockDb.limit
      .mockResolvedValueOnce([DEVELOPER])
      .mockResolvedValueOnce([{ ...REPUTATION, uptimePct: 0, hasChecks: true }])

    const body = await (await call()).json()

    expect(body.developer.reputation.uptimePct).toBe(0)
  })

  it('leaves out tools owned by internal test accounts', async () => {
    mockDb.limit
      .mockResolvedValueOnce([DEVELOPER])
      .mockResolvedValueOnce([{ ...REPUTATION, hasChecks: false }])

    await call()

    expect(mockDb.where).toHaveBeenCalledWith({
      and: [
        { eq: ['developer_id', 'dev-1'] },
        { eq: ['status', 'active'] },
        { excludeInternalTestTools: true },
      ],
    })
  })
})
