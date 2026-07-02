/**
 * G4-3 teeth (DC-08 / DC-24) — the credential-brute-force limiters fail CLOSED on a
 * rate-limit-store REJECTION.
 *
 * TEETH DESIGN (§6 FOLD 6 — do NOT template off webhook-checkout-retry.test.ts's
 * `checkRateLimit: vi.fn()` mock, which IGNORES the failMode arg and stays green
 * when the flip is deleted). Here we mock the LIMITER (its `.limit()` REJECTS,
 * modelling a store outage — conn-refused / DNS / auth / 5xx) and keep the REAL
 * `checkRateLimit`. We target the IP bucket, which runs BEFORE requireDeveloper:
 *   • WITH `{ failMode: 'closed' }` (shipped): real checkRateLimit catches the
 *     rejection → success:false → the route returns 429. ← asserted below.
 *   • WITHOUT it (reverted to the default fail-OPEN): checkRateLimit returns
 *     success:true → the request falls through the IP gate → 401/415/503 ≠ 429
 *     → these assertions go RED. That revert-sensitivity IS the teeth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual, // keep the REAL checkRateLimit + getClientIp
    apiLimiter: { limit: vi.fn().mockRejectedValue(new Error('store down')) },
    authLimiter: { limit: vi.fn().mockRejectedValue(new Error('store down')) },
  }
})

import { PUT as mfaVerify } from '@/app/api/auth/mfa/route'
import { POST as toolsClaim } from '@/app/api/tools/claim/route'
import { POST as gate } from '@/app/api/gate/route'
import { apiLimiter, authLimiter } from '@/lib/rate-limit'

const IP = '203.0.113.7'

function makeRequest(url: string, method: 'POST' | 'PUT'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'x-forwarded-for': IP, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
}

const limitOf = (l: unknown) => (l as { limit: ReturnType<typeof vi.fn> }).limit

describe('G4-3 credential limiters fail CLOSED on store rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks() // clears call history; keeps the mockRejectedValue implementation
  })

  it('mfa-verify (apiLimiter, ip bucket) → 429 when the store rejects', async () => {
    const res = await mfaVerify(makeRequest('http://localhost/api/auth/mfa', 'PUT'))
    expect(res.status).toBe(429)
    expect(limitOf(apiLimiter)).toHaveBeenCalledWith(`mfa-verify:${IP}`)
  })

  it('tools-claim (authLimiter, ip bucket) → 429 when the store rejects', async () => {
    const res = await toolsClaim(makeRequest('http://localhost/api/tools/claim', 'POST'))
    expect(res.status).toBe(429)
    expect(limitOf(authLimiter)).toHaveBeenCalledWith(`tools-claim:${IP}`)
  })

  it('gate (authLimiter, ip bucket) → 429 when the store rejects', async () => {
    const res = await gate(makeRequest('http://localhost/api/gate', 'POST'))
    expect(res.status).toBe(429)
    expect(limitOf(authLimiter)).toHaveBeenCalledWith(`gate:${IP}`)
  })
})
