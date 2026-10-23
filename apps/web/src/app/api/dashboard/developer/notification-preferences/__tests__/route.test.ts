/**
 * Tests for PATCH /api/dashboard/developer/notification-preferences.
 *
 * The body the Settings page sends (every SETTINGS_NOTIFICATION_EVENTS key)
 * must validate, and the result is merged into the stored preferences.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit, mockWriteAuditLog } = vi.hoisted(() => {
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
    mockRequireDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockWriteAuditLog: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: { id: 'id', notificationPreferences: 'notification_preferences' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ eq: [a, b] })) }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '1.2.3.4',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: mockWriteAuditLog }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { PATCH } from '../route'
import { SETTINGS_NOTIFICATION_EVENTS, MARKETING_PREFERENCE_KEY } from '@/lib/notification-events'

function patchReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/developer/notification-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.update.mockReturnThis()
  mockDb.set.mockReturnThis()
  mockDb.limit.mockReset().mockResolvedValue([{ notificationPreferences: { onboarding_tips: false } }])
  mockDb.returning.mockReset().mockImplementation(async () => [
    { notificationPreferences: mockDb.set.mock.calls[0]?.[0]?.notificationPreferences },
  ])
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-1', email: 'dev@example.com' })
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockWriteAuditLog.mockResolvedValue(undefined)
})

describe('PATCH /api/dashboard/developer/notification-preferences', () => {
  it('accepts the full set of keys the Settings page sends and merges them', async () => {
    const body: Record<string, boolean> = {}
    for (const e of SETTINGS_NOTIFICATION_EVENTS) body[e.key] = true
    body.quality_alert = false

    const res = await PATCH(patchReq(body))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.preferences).toMatchObject({ ...body, onboarding_tips: true })
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ notificationPreferences: { ...body, onboarding_tips: true } }),
    )
  })

  it('accepts the marketing toggle on its own', async () => {
    const res = await PATCH(patchReq({ [MARKETING_PREFERENCE_KEY]: false }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.preferences).toEqual({ onboarding_tips: false, marketing_updates: false })
  })

  it('rejects an unknown key', async () => {
    const res = await PATCH(patchReq({ not_a_real_event: true }))
    expect(res.status).toBe(422)
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean value', async () => {
    const res = await PATCH(patchReq({ monthly_summary: 'yes' }))
    expect(res.status).toBe(422)
  })

  it('401 when unauthenticated', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required. Please sign in.'))
    const res = await PATCH(patchReq({ monthly_summary: false }))
    expect(res.status).toBe(401)
  })
})
