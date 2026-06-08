/**
 * POST /api/sessions/[id]/hop — API-layer test (the (H) "missing hop API test").
 * The route had NO test today. Covers: 200 success + rate-limit on the F1
 * sessionLimiter (the high-frequency in-session route), 429, 402 BUDGET_EXCEEDED,
 * 404 SESSION_NOT_FOUND, and 422 on a zod-invalid body (parseBody → ParseBodyError).
 *
 * The limiter-identity assertion FAILS PRE-FIX (the route still uses sdkLimiter
 * before F1 rewires it to sessionLimiter).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRecordHop, mockCheckRateLimit } = vi.hoisted(() => ({
  mockRecordHop: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}))

vi.mock('@/lib/settlement/sessions', () => ({ recordHop: mockRecordHop }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: { __id: 'sdkLimiter' },
  sessionLimiter: { __id: 'sessionLimiter' },
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/middleware/cors', () => ({
  addCorsHeaders: (res: unknown) => res,
  OPTIONS: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { POST as hopRoute } from '@/app/api/sessions/[id]/hop/route'
import { sessionLimiter } from '@/lib/rate-limit'

function makeRequest(url: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const validBody = { serviceId: 'svc-1', toolId: '550e8400-e29b-41d4-a716-446655440000', method: 'GET', costCents: 100 }

describe('POST /api/sessions/[id]/hop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5000, remaining: 4999, reset: 0 })
  })

  it('records a hop (200) and rate-limits on the sessionLimiter (F1 — high-frequency in-session route)', async () => {
    mockRecordHop.mockResolvedValue({ hopId: 'hop-1', remainingBudgetCents: 9900 })
    const res = await hopRoute(makeRequest('/api/sessions/sess-1/hop', validBody), ctx('sess-1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.hopId).toBe('hop-1')
    expect(data.remainingBudgetCents).toBe(9900)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(sessionLimiter, expect.stringContaining('session-hop:'))
  })

  it('returns 429 when rate limited (and does not record the hop)', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 5000, remaining: 0, reset: 60 })
    const res = await hopRoute(makeRequest('/api/sessions/sess-1/hop', validBody), ctx('sess-1'))
    expect(res.status).toBe(429)
    expect(mockRecordHop).not.toHaveBeenCalled()
  })

  it('maps insufficient session budget to 402 BUDGET_EXCEEDED', async () => {
    mockRecordHop.mockRejectedValue(new Error('Insufficient session budget: need 100, available 0'))
    const res = await hopRoute(makeRequest('/api/sessions/sess-1/hop', validBody), ctx('sess-1'))
    expect(res.status).toBe(402)
  })

  it('maps an inactive/missing session to 404 SESSION_NOT_FOUND', async () => {
    mockRecordHop.mockRejectedValue(new Error('Session not found or not active'))
    const res = await hopRoute(makeRequest('/api/sessions/sess-1/hop', validBody), ctx('sess-1'))
    expect(res.status).toBe(404)
  })

  it('returns 422 on a zod-invalid body (parseBody → ParseBodyError), without calling recordHop', async () => {
    const res = await hopRoute(
      makeRequest('/api/sessions/sess-1/hop', { serviceId: '', toolId: 'not-a-uuid', method: '', costCents: -1 }),
      ctx('sess-1'),
    )
    expect(res.status).toBe(422)
    expect(mockRecordHop).not.toHaveBeenCalled()
  })
})
