import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDbExecute } = vi.hoisted(() => {
  return {
    mockDbExecute: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    execute: mockDbExecute,
  },
}))

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() }
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 }),
}))

// Mock global fetch for Redis health check
const originalFetch = global.fetch

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3005/api/health', {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
}

import { GET } from '@/app/api/health/route'

describe('Health Check (GET /api/health)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env
    delete process.env.REDIS_URL
    delete process.env.REDIS_TOKEN
    global.fetch = originalFetch
  })

  it('returns healthy when DB is up', async () => {
    mockDbExecute.mockResolvedValueOnce(undefined)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.components.database.status).toBe('healthy')
    expect(data.timestamp).toBeDefined()
  })

  it('returns unhealthy when DB is down', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('Connection refused'))

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.components.database.status).toBe('unhealthy')
  })

  it('reports redis as not_configured when no REDIS_URL', async () => {
    mockDbExecute.mockResolvedValueOnce(undefined)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.components.redis.status).toBe('not_configured')
  })

  it('returns healthy with redis when both are up', async () => {
    mockDbExecute.mockResolvedValueOnce(undefined)
    process.env.REDIS_URL = 'https://redis.example.com'
    process.env.REDIS_TOKEN = 'test-token'

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
    })

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.components.redis.status).toBe('healthy')
  })

  it('returns degraded when redis fails', async () => {
    mockDbExecute.mockResolvedValueOnce(undefined)
    process.env.REDIS_URL = 'https://redis.example.com'
    process.env.REDIS_TOKEN = 'test-token'

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection timeout'))

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.components.redis.status).toBe('unhealthy')
  })

  it('includes latency measurements', async () => {
    mockDbExecute.mockResolvedValueOnce(undefined)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.components.database.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
