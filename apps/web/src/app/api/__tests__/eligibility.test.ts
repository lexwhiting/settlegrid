/**
 * P3.RAIL1 — /api/eligibility route tests.
 *
 * Validates the contract:
 *   - eligible developers (US, USD, individual) → 200 { eligible: true,
 *     accountType: 'express' }
 *   - Sandeep case (IN individual, no scale-tier opt-in) → 200
 *     { eligible: false, waitlistReason: 'country_not_supported_for_entity_type' }
 *   - structurally-invalid country ('USA' 3-letter) → 400 INVALID_INPUT
 *   - rate-limited → 429 RATE_LIMIT_EXCEEDED
 *   - hostile bypass attempt: client-side mutation cannot trick the
 *     server-side decision (the server runs `routeDeveloper` against
 *     the bundled matrix, not against any client-supplied list).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi
    .fn()
    .mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

import { POST as eligibilityPost } from '@/app/api/eligibility/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/eligibility', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/eligibility', () => {
  beforeEach(() => {
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 0,
    })
  })

  it('returns eligible=true with express for US individual + USD', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(true)
    expect(body.accountType).toBe('express')
    expect(body.countryIso).toBe('US')
    expect(body.entityType).toBe('individual')
  })

  it('returns eligible=true with express for company in supported country', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'DE',
        entityType: 'company',
        preferredCurrency: 'EUR',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(true)
    expect(body.accountType).toBe('express')
  })

  it('returns eligible=false for Sandeep case (IN individual, no upgrade) → waitlist hint', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'IN',
        entityType: 'individual',
        preferredCurrency: 'INR',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(false)
    expect(body.waitlistReason).toBe('country_not_supported_for_entity_type')
    expect(body.countryIso).toBe('IN')
    expect(body.entityType).toBe('individual')
  })

  it('returns eligible=true with standard for IN individual when scale-tier opts in', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'IN',
        entityType: 'individual',
        preferredCurrency: 'INR',
        tier: 'scale',
        requestsSelfManaged: true,
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(true)
    expect(body.accountType).toBe('standard')
  })

  it('returns eligible=false for unsupported country', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'ZZ',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(false)
    expect(body.waitlistReason).toBe('country_not_supported_for_entity_type')
  })

  it('returns eligible=false with currency reason for unsupported currency', async () => {
    // 'CNY' is structurally valid but not in payoutCurrencies.
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'CNY',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(false)
    expect(body.waitlistReason).toBe('preferred_currency_not_supported')
  })

  it('returns 400 for structurally-invalid country code (3 letters)', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'USA',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_INPUT')
  })

  it('returns 422 for missing countryIso (Zod validation)', async () => {
    const res = await eligibilityPost(
      makeRequest({
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 for unknown entityType (Zod enum guard)', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'US',
        entityType: 'sole-proprietor',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(422)
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('rate-limit identifier uses x-forwarded-for first hop', async () => {
    const req = new NextRequest('http://localhost:3005/api/eligibility', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      },
      body: JSON.stringify({
        countryIso: 'US',
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    })
    await eligibilityPost(req)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'eligibility:203.0.113.7',
    )
  })

  it('does NOT echo client-supplied request body in error responses (no info leak)', async () => {
    // The request body contains a string the client could try to
    // smuggle through error-message reflection. Verify it doesn't
    // appear in the response body.
    const sentinel = '__CLIENT_PROVIDED_SENTINEL_42__'
    const res = await eligibilityPost(
      makeRequest({
        countryIso: sentinel,
        entityType: 'individual',
        preferredCurrency: 'USD',
      }),
    )
    const body = await res.text()
    expect(body).not.toContain(sentinel)
  })

  it('hostile bypass: server-side decision is independent of client-supplied "eligible" claim', async () => {
    // The /api/eligibility contract does NOT accept an "eligible"
    // input — even if a malicious client tries to inject one, the
    // route ignores it (Zod strips unknown keys) and runs
    // routeDeveloper against the server-side matrix. This test
    // verifies that the unsupported case still returns eligible=false
    // even when the client smuggles eligible=true.
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'ZZ',
        entityType: 'individual',
        preferredCurrency: 'USD',
        eligible: true, // ← attacker injection; should be ignored
        accountType: 'express', // ← attacker injection; should be ignored
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(false)
  })

  it('handles malformed JSON body with 400 ParseBody error', async () => {
    const req = new NextRequest('http://localhost:3005/api/eligibility', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })
    const res = await eligibilityPost(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('preferredCurrency defaults to USD when omitted', async () => {
    const res = await eligibilityPost(
      makeRequest({
        countryIso: 'US',
        entityType: 'individual',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eligible).toBe(true)
  })
})
