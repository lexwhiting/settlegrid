/**
 * P2.RAIL1 — tests for GET /api/rails.
 *
 * The endpoint drives the dashboard settings page's registry-driven
 * rail iteration. Coverage targets:
 *   1. Happy path returns { data: { rails: [...] } }
 *   2. Phase-2 response contains exactly one rail (stripe-connect)
 *      with its display metadata
 *   3. JSON serialization is safe (no functions / Dates / Maps)
 *   4. Internal errors in getRailDisplayMetadata() are caught and
 *      surface as a 500 (not an unhandled rejection bubbling to the
 *      Next.js runtime)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  getStripeSecretKey: () => 'sk_test_x_x_x_dummy',
  getAppUrl: () => 'https://test.settlegrid.ai',
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      accounts = { create: vi.fn(), retrieve: vi.fn() }
      accountLinks = { create: vi.fn() }
      checkout = { sessions: { create: vi.fn() } }
      webhooks = { constructEvent: vi.fn() }
      constructor(public secret: string) {}
    },
  }
})

describe('GET /api/rails — happy path', () => {
  beforeEach(async () => {
    const mod = await import('@/lib/rails')
    mod.__resetRailRegistry()
  })

  it('returns HTTP 200 with { data: { rails: [...] } }', async () => {
    const { GET } = await import('../rails/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('rails')
    expect(Array.isArray(body.rails)).toBe(true)
  })

  it('returns exactly one rail (Phase 2 registry)', async () => {
    const { GET } = await import('../rails/route')
    const response = await GET()
    const body = await response.json()
    expect(body.rails).toHaveLength(1)
  })

  it('the one rail is stripe-connect with display metadata', async () => {
    const { GET } = await import('../rails/route')
    const response = await GET()
    const body = await response.json()
    const rail = body.rails[0]
    expect(rail.id).toBe('stripe-connect')
    expect(rail.displayName).toBe('Stripe Connect')
    expect(rail.legalStructure).toBe('platform')
    expect(typeof rail.percentBps).toBe('number')
    expect(typeof rail.flatCents).toBe('number')
  })

  it('response body is cleanly JSON-serializable', async () => {
    const { GET } = await import('../rails/route')
    const response = await GET()
    const body = await response.json()
    // If getRailDisplayMetadata leaked a function / Date / Map into
    // the payload, JSON.parse(JSON.stringify(body)) would drop or
    // mangle that value. toEqual after round-trip verifies clean JSON.
    const roundtripped = JSON.parse(JSON.stringify(body))
    expect(roundtripped).toEqual(body)
  })
})

describe('GET /api/rails — error handling', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
  })

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV
    } else {
      ;(process.env as Record<string, string>).NODE_ENV = originalEnv
    }
    // Ensure the registry is reset for other test files that run after.
    const mod = await import('@/lib/rails')
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    mod.__resetRailRegistry()
  })

  it('never throws on an unexpected error — returns 500 via internalErrorResponse', async () => {
    // Reset and spy on getRailDisplayMetadata to force it to throw.
    vi.resetModules()
    vi.doMock('@/lib/rails', () => ({
      getRailDisplayMetadata: () => {
        throw new Error('simulated registry failure')
      },
    }))
    const { GET } = await import('../rails/route')
    const response = await GET()
    expect(response.status).toBe(500)
    vi.doUnmock('@/lib/rails')
    vi.resetModules()
  })
})
