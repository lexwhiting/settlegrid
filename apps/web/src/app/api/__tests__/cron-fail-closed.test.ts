import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockCheckRateLimit, mockGetCronSecret } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
  mockGetCronSecret: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/env', () => ({
  getCronSecret: mockGetCronSecret,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/alert-email', () => ({
  sendAlertEmail: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  consumerAlerts: { id: 'id', consumerId: 'consumer_id', toolId: 'tool_id', alertType: 'alert_type', status: 'status', lastTriggeredAt: 'last_triggered_at', threshold: 'threshold', channel: 'channel' },
  consumerToolBalances: { consumerId: 'consumer_id', toolId: 'tool_id', balanceCents: 'balance_cents', currentPeriodSpendCents: 'current_period_spend_cents', spendingLimitCents: 'spending_limit_cents' },
  consumers: { id: 'id', email: 'email' },
  tools: { id: 'id', name: 'name', status: 'status' },
  invocations: { consumerId: 'consumer_id', toolId: 'tool_id', createdAt: 'created_at' },
  organizations: { id: 'id' },
  organizationMembers: { orgId: 'org_id', userId: 'user_id', role: 'role' },
  costAllocations: {},
  webhookDeliveries: { id: 'id', endpointId: 'endpoint_id', event: 'event', payload: 'payload', attempts: 'attempts', maxAttempts: 'max_attempts', status: 'status', nextRetryAt: 'next_retry_at' },
  webhookEndpoints: { id: 'id', url: 'url', secret: 'secret', status: 'status' },
  toolHealthChecks: { toolId: 'tool_id', status: 'status', responseTimeMs: 'response_time_ms', checkedAt: 'checked_at' },
}))

vi.mock('@/lib/settlement/sessions', () => ({
  expireStaleSessionsBatch: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/webhooks', () => ({
  attemptWebhookDelivery: vi.fn(),
  computeNextRetryAt: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(vi.fn().mockReturnValue('sql'), { join: vi.fn(), raw: vi.fn() }),
  lte: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn(),
  desc: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string, authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers.authorization = authHeader
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers })
}

// ─── Alert-check cron fail-closed ────────────────────────────────────────────

describe('cron alert-check fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/alert-check/route')
    const response = await GET(makeRequest('/api/cron/alert-check'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('CONFIG_ERROR')
  })

  it('returns 401 with wrong authorization', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')

    const { GET } = await import('@/app/api/cron/alert-check/route')
    const response = await GET(makeRequest('/api/cron/alert-check', 'Bearer wrong-secret'))

    expect(response.status).toBe(401)
  })
})

// ─── Expire-sessions cron fail-closed ────────────────────────────────────────

describe('cron expire-sessions fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/expire-sessions/route')
    const response = await GET(makeRequest('/api/cron/expire-sessions'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('CONFIG_ERROR')
  })

  it('returns 401 with wrong authorization', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')

    const { GET } = await import('@/app/api/cron/expire-sessions/route')
    const response = await GET(makeRequest('/api/cron/expire-sessions', 'Bearer wrong-secret'))

    expect(response.status).toBe(401)
  })
})

// ─── Health-checks cron fail-closed ──────────────────────────────────────────

describe('cron health-checks fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/health-checks/route')
    const response = await GET(makeRequest('/api/cron/health-checks'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('CONFIG_ERROR')
  })

  it('returns 401 with wrong authorization', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')

    const { GET } = await import('@/app/api/cron/health-checks/route')
    const response = await GET(makeRequest('/api/cron/health-checks', 'Bearer wrong-secret'))

    expect(response.status).toBe(401)
  })
})

// ─── Webhook-retry cron fail-closed ──────────────────────────────────────────

describe('cron webhook-retry fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/webhook-retry/route')
    const response = await GET(makeRequest('/api/cron/webhook-retry'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('CONFIG_ERROR')
  })

  it('returns 401 with wrong authorization', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')

    const { GET } = await import('@/app/api/cron/webhook-retry/route')
    const response = await GET(makeRequest('/api/cron/webhook-retry', 'Bearer wrong-secret'))

    expect(response.status).toBe(401)
  })
})
