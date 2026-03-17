import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  tryRedis: async (fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } catch {
      return null
    }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  sdkLimiter: {},
}))

import { GET } from '@/app/api/stream/route'
import { NextRequest } from 'next/server'

// ─── Helpers ────────────────────────────────────────────────────────────────

function createRequest(params: Record<string, string>, headers?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3005/api/stream')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url, {
    headers: headers ?? {},
  })
}

async function readFirstChunk(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No body')
  const { value } = await reader.read()
  reader.cancel()
  return new TextDecoder().decode(value)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SSE streaming endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedis.get.mockResolvedValue(null)
  })

  it('returns text/event-stream content type', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve(10000)
      if (key.includes('spent')) return Promise.resolve(1000)
      if (key.includes('reserved')) return Promise.resolve(500)
      return Promise.resolve(null)
    })

    const request = createRequest({
      apiKey: 'test-key-123',
      sessionId: 'sess-abc',
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
  })

  it('requires API key', async () => {
    const request = createRequest({ sessionId: 'sess-abc' })
    const response = await GET(request)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('API key required')
    expect(body.code).toBe('AUTH_REQUIRED')
  })

  it('accepts API key from x-api-key header', async () => {
    const request = createRequest(
      { sessionId: 'sess-abc' },
      { 'x-api-key': 'header-key-456' }
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('requires sessionId query parameter', async () => {
    const request = createRequest({ apiKey: 'test-key' })
    const response = await GET(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('sessionId')
    expect(body.code).toBe('MISSING_SESSION_ID')
  })

  it('sends initial session.state event as JSON', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve(5000)
      if (key.includes('spent')) return Promise.resolve(1000)
      if (key.includes('reserved')) return Promise.resolve(200)
      return Promise.resolve(null)
    })

    const request = createRequest({
      apiKey: 'test-key',
      sessionId: 'sess-xyz',
    })

    const response = await GET(request)
    expect(response.status).toBe(200)

    const firstChunk = await readFirstChunk(response)

    // SSE format: "data: {json}\n\n"
    expect(firstChunk).toContain('data: ')
    expect(firstChunk).toContain('"type":"session.state"')
    expect(firstChunk).toContain('"sessionId":"sess-xyz"')
    expect(firstChunk).toContain('"budgetCents":5000')
    expect(firstChunk).toContain('"spentCents":1000')
    expect(firstChunk).toContain('"reservedCents":200')
    expect(firstChunk).toContain('"remainingCents":3800')
    expect(firstChunk).toContain('"timestamp"')
  })

  it('SSE event data is valid JSON', async () => {
    mockRedis.get.mockResolvedValue(0)

    const request = createRequest({
      apiKey: 'test-key',
      sessionId: 'sess-json',
    })

    const response = await GET(request)
    const firstChunk = await readFirstChunk(response)

    // Extract JSON from "data: {json}\n\n"
    const dataMatch = firstChunk.match(/^data: (.+)$/m)
    expect(dataMatch).not.toBeNull()

    const parsed = JSON.parse(dataMatch![1])
    expect(parsed.type).toBe('session.state')
    expect(typeof parsed.timestamp).toBe('string')
  })
})
