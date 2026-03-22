import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    mockDb,
    mockRequireDeveloper: vi.fn().mockResolvedValue({ id: 'dev-123', email: 'dev@example.com' }),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    name: 'name',
    tier: 'tier',
    revenueSharePct: 'revenue_share_pct',
    stripeConnectStatus: 'stripe_connect_status',
    balanceCents: 'balance_cents',
    payoutSchedule: 'payout_schedule',
    payoutMinimumCents: 'payout_minimum_cents',
    publicProfile: 'public_profile',
    publicBio: 'public_bio',
    avatarUrl: 'avatar_url',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    supabaseUserId: 'supabase_user_id',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: mockRequireDeveloper,
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

import { GET as getMe } from '@/app/api/auth/developer/me/route'
import { PATCH as patchProfile } from '@/app/api/dashboard/developer/profile/route'
import { PATCH as patchPayoutSettings } from '@/app/api/dashboard/developer/payout-settings/route'

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(`http://localhost:3005${url}`, init)
}

// ─── GET /api/auth/developer/me ─────────────────────────────────────────────

describe('GET /api/auth/developer/me — extended fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('returns profile with tier, revenueSharePct, publicProfile, publicBio', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'dev-123',
      email: 'dev@example.com',
      name: 'Jane',
      tier: 'standard',
      revenueSharePct: 95,
      stripeConnectStatus: 'active',
      balanceCents: 5000,
      payoutSchedule: 'monthly',
      payoutMinimumCents: 2500,
      publicProfile: true,
      publicBio: 'Hi there',
      createdAt: '2026-01-01T00:00:00Z',
    }])

    const request = makeRequest('/api/auth/developer/me')
    const response = await getMe(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.developer.tier).toBe('standard')
    expect(data.developer.revenueSharePct).toBe(95)
    expect(data.developer.publicProfile).toBe(true)
    expect(data.developer.publicBio).toBe('Hi there')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
    const request = makeRequest('/api/auth/developer/me')
    const response = await getMe(request)
    expect(response.status).toBe(401)
  })

  it('returns 404 when developer not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const request = makeRequest('/api/auth/developer/me')
    const response = await getMe(request)
    expect(response.status).toBe(404)
  })
})

// ─── PATCH /api/dashboard/developer/profile ─────────────────────────────────

describe('PATCH /api/dashboard/developer/profile — with name field', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('updates name, publicBio, and publicProfile', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      name: 'New Name',
      publicProfile: true,
      publicBio: 'Updated bio',
      avatarUrl: null,
      updatedAt: new Date(),
    }])

    const request = makeRequest('/api/dashboard/developer/profile', 'PATCH', {
      name: 'New Name',
      publicBio: 'Updated bio',
      publicProfile: true,
    })
    const response = await patchProfile(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profile.name).toBe('New Name')
    expect(data.profile.publicProfile).toBe(true)
    expect(data.profile.publicBio).toBe('Updated bio')
  })

  it('updates only name when other fields not provided', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      name: 'Only Name',
      publicProfile: false,
      publicBio: null,
      avatarUrl: null,
      updatedAt: new Date(),
    }])

    const request = makeRequest('/api/dashboard/developer/profile', 'PATCH', {
      name: 'Only Name',
    })
    const response = await patchProfile(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profile.name).toBe('Only Name')
  })

  it('rejects name longer than 100 chars', async () => {
    const request = makeRequest('/api/dashboard/developer/profile', 'PATCH', {
      name: 'A'.repeat(101),
    })
    const response = await patchProfile(request)
    expect(response.status).toBe(422)
  })

  it('rejects bio longer than 500 chars', async () => {
    const request = makeRequest('/api/dashboard/developer/profile', 'PATCH', {
      publicBio: 'B'.repeat(501),
    })
    const response = await patchProfile(request)
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
    const request = makeRequest('/api/dashboard/developer/profile', 'PATCH', { name: 'Test' })
    const response = await patchProfile(request)
    expect(response.status).toBe(401)
  })

  it('returns 404 when developer not found', async () => {
    mockDb.returning.mockResolvedValueOnce([])
    const request = makeRequest('/api/dashboard/developer/profile', 'PATCH', { name: 'Ghost' })
    const response = await patchProfile(request)
    expect(response.status).toBe(404)
  })
})

// ─── PATCH /api/dashboard/developer/payout-settings ─────────────────────────

describe('PATCH /api/dashboard/developer/payout-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('updates payout schedule and minimum', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      payoutSchedule: 'weekly',
      payoutMinimumCents: 5000,
      updatedAt: new Date(),
    }])

    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutSchedule: 'weekly',
      payoutMinimumCents: 5000,
    })
    const response = await patchPayoutSettings(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payoutSettings.payoutSchedule).toBe('weekly')
    expect(data.payoutSettings.payoutMinimumCents).toBe(5000)
  })

  it('updates only payout schedule', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      payoutSchedule: 'daily',
      payoutMinimumCents: 2500,
      updatedAt: new Date(),
    }])

    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutSchedule: 'daily',
    })
    const response = await patchPayoutSettings(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payoutSettings.payoutSchedule).toBe('daily')
  })

  it('updates only minimum payout amount', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      payoutSchedule: 'monthly',
      payoutMinimumCents: 10000,
      updatedAt: new Date(),
    }])

    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutMinimumCents: 10000,
    })
    const response = await patchPayoutSettings(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.payoutSettings.payoutMinimumCents).toBe(10000)
  })

  it('rejects invalid payout schedule', async () => {
    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutSchedule: 'biweekly',
    })
    const response = await patchPayoutSettings(request)
    expect(response.status).toBe(422)
  })

  it('rejects minimum below $10 (1000 cents)', async () => {
    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutMinimumCents: 500,
    })
    const response = await patchPayoutSettings(request)
    expect(response.status).toBe(422)
  })

  it('rejects minimum above $500 (50000 cents)', async () => {
    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutMinimumCents: 60000,
    })
    const response = await patchPayoutSettings(request)
    expect(response.status).toBe(422)
  })

  it('rejects non-integer minimum', async () => {
    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutMinimumCents: 25.50,
    })
    const response = await patchPayoutSettings(request)
    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required.'))
    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutSchedule: 'daily',
    })
    const response = await patchPayoutSettings(request)
    expect(response.status).toBe(401)
  })

  it('returns 404 when developer not found', async () => {
    mockDb.returning.mockResolvedValueOnce([])
    const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
      payoutSchedule: 'weekly',
    })
    const response = await patchPayoutSettings(request)
    expect(response.status).toBe(404)
  })

  it('accepts all valid schedule values', async () => {
    for (const schedule of ['daily', 'weekly', 'monthly']) {
      vi.clearAllMocks()
      mockDb.update.mockReturnThis()
      mockDb.set.mockReturnThis()
      mockDb.where.mockReturnThis()
      mockDb.returning.mockResolvedValueOnce([{
        payoutSchedule: schedule,
        payoutMinimumCents: 2500,
        updatedAt: new Date(),
      }])

      const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
        payoutSchedule: schedule,
      })
      const response = await patchPayoutSettings(request)
      expect(response.status).toBe(200)
    }
  })

  it('accepts boundary values for minimum (1000 and 50000 cents)', async () => {
    for (const amount of [1000, 50000]) {
      vi.clearAllMocks()
      mockDb.update.mockReturnThis()
      mockDb.set.mockReturnThis()
      mockDb.where.mockReturnThis()
      mockDb.returning.mockResolvedValueOnce([{
        payoutSchedule: 'monthly',
        payoutMinimumCents: amount,
        updatedAt: new Date(),
      }])

      const request = makeRequest('/api/dashboard/developer/payout-settings', 'PATCH', {
        payoutMinimumCents: amount,
      })
      const response = await patchPayoutSettings(request)
      expect(response.status).toBe(200)
    }
  })
})
