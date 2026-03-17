import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockGetOutcomesByTool, mockCheckRateLimit } = vi.hoisted(() => ({
  mockGetOutcomesByTool: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
}))

vi.mock('@/lib/settlement/outcomes', () => ({
  createOutcomeVerification: vi.fn(),
  getOutcomesByTool: mockGetOutcomesByTool,
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/middleware/cors', () => ({
  withCors: (handler: (...args: unknown[]) => Promise<Response>) => handler,
  OPTIONS: vi.fn(),
  addCorsHeaders: (res: unknown) => res,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET } from '@/app/api/outcomes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET' })
}

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const mockResult = {
  toolId: VALID_UUID,
  totalCount: 5,
  passedCount: 3,
  failedCount: 1,
  pendingCount: 1,
  disputedCount: 0,
  passRate: 75,
  avgScore: 85,
  totalSettledCents: 500,
  outcomes: [],
}

// ─── GET /api/outcomes Tests ────────────────────────────────────────────────

describe('GET /api/outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns outcomes for a valid toolId', async () => {
    mockGetOutcomesByTool.mockResolvedValue(mockResult)

    const request = makeRequest(`/api/outcomes?toolId=${VALID_UUID}`)
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.toolId).toBe(VALID_UUID)
    expect(data.totalCount).toBe(5)
    expect(data.passRate).toBe(75)
    expect(mockGetOutcomesByTool).toHaveBeenCalledWith(VALID_UUID, 50)
  })

  it('respects custom limit param', async () => {
    mockGetOutcomesByTool.mockResolvedValue(mockResult)

    const request = makeRequest(`/api/outcomes?toolId=${VALID_UUID}&limit=10`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockGetOutcomesByTool).toHaveBeenCalledWith(VALID_UUID, 10)
  })

  it('clamps limit to max 200', async () => {
    mockGetOutcomesByTool.mockResolvedValue(mockResult)

    const request = makeRequest(`/api/outcomes?toolId=${VALID_UUID}&limit=999`)
    await GET(request)

    expect(mockGetOutcomesByTool).toHaveBeenCalledWith(VALID_UUID, 200)
  })

  it('returns 400 without toolId', async () => {
    const request = makeRequest('/api/outcomes')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid toolId format', async () => {
    const request = makeRequest('/api/outcomes?toolId=not-a-uuid')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest(`/api/outcomes?toolId=${VALID_UUID}`)
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
