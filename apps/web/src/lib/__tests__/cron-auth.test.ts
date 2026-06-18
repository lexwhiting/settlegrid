/**
 * DC-03 — cron-auth constant-time bearer check. Unit tests run against REAL
 * node:crypto (the helper is NOT mocked); only getCronSecret() is mocked so each
 * case can drive the secret. These pins lock the load-bearing properties:
 *   • LB-1: hash-to-fixed-length compare never throws (wrong-length / missing /
 *     over-cap header all return 'unauthorized', never a RangeError → 500).
 *   • S-D17 + no-lockout: a whitespace-padded secret still authenticates (the
 *     SYMMETRIC trim), and a header with surrounding whitespace is accepted.
 *   • DC-08 fail-closed: unset / empty / whitespace-only secret → 'no-secret'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetCronSecret } = vi.hoisted(() => ({
  mockGetCronSecret: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  getCronSecret: mockGetCronSecret,
}))

import { verifyCronAuth } from '@/lib/cron-auth'

function headers(auth?: string): Headers {
  const h = new Headers()
  if (auth !== undefined) h.set('authorization', auth)
  return h
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('verifyCronAuth', () => {
  it("returns 'ok' for the exact Bearer token", () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    expect(verifyCronAuth(headers('Bearer correct-secret'))).toBe('ok')
  })

  it("returns 'unauthorized' for a wrong token", () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    expect(verifyCronAuth(headers('Bearer wrong-secret'))).toBe('unauthorized')
  })

  it("returns 'no-secret' when CRON_SECRET is unset", () => {
    mockGetCronSecret.mockReturnValue(undefined)
    expect(verifyCronAuth(headers('Bearer anything'))).toBe('no-secret')
  })

  it("returns 'no-secret' for an empty-string secret", () => {
    mockGetCronSecret.mockReturnValue('')
    expect(verifyCronAuth(headers('Bearer '))).toBe('no-secret')
  })

  it("returns 'no-secret' for a whitespace-only secret", () => {
    mockGetCronSecret.mockReturnValue('   \n  ')
    expect(verifyCronAuth(headers('Bearer    '))).toBe('no-secret')
  })

  // S-D17 + no-lockout pin: a CRON_SECRET carrying a stray trailing newline (the
  // documented Vercel-env hazard) is injected RAW into the header as
  // `Bearer <secret>\n`. The SYMMETRIC trim accepts it — the old exact-match would
  // 401 every cron. This is the intentional, flagged behavior broadening.
  it('authenticates a whitespace-padded secret via the symmetric trim (no Vercel lockout)', () => {
    mockGetCronSecret.mockReturnValue('padded-secret\n')
    // Vercel injects `Bearer ` + the raw (newline-carrying) env value:
    expect(verifyCronAuth(headers('Bearer padded-secret\n'))).toBe('ok')
    // …and a client that already sends the clean token also authenticates:
    expect(verifyCronAuth(headers('Bearer padded-secret'))).toBe('ok')
  })

  it('accepts a correct token with surrounding whitespace on the header', () => {
    mockGetCronSecret.mockReturnValue('clean-secret')
    expect(verifyCronAuth(headers('  Bearer clean-secret  '))).toBe('ok')
  })

  it("returns 'unauthorized' (no throw) for a missing authorization header", () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    expect(() => verifyCronAuth(headers())).not.toThrow()
    expect(verifyCronAuth(headers())).toBe('unauthorized')
  })

  // LB-1 pin: a token whose length differs from `Bearer <secret>` must NOT throw
  // a RangeError (the raw-buffer-timingSafeEqual trap → 500-not-401). Hashing both
  // sides to 32 bytes makes the lengths always equal.
  it("returns 'unauthorized' (no RangeError) for a wrong-LENGTH token", () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    expect(() => verifyCronAuth(headers('Bearer x'))).not.toThrow()
    expect(verifyCronAuth(headers('Bearer x'))).toBe('unauthorized')
  })

  it("returns 'unauthorized' for an over-MAX_AUTH_HEADER_LEN header (no throw)", () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    const huge = `Bearer ${'x'.repeat(5000)}`
    expect(() => verifyCronAuth(headers(huge))).not.toThrow()
    expect(verifyCronAuth(headers(huge))).toBe('unauthorized')
  })

  // Cap-uniqueness pin: the previous case uses a WRONG over-cap token, so it is
  // 'unauthorized' even if the length cap were removed (the hash compare rejects it
  // anyway) — it does NOT prove the cap exists. This case sends an OTHERWISE-CORRECT
  // token whose length exceeds MAX_AUTH_HEADER_LEN: it authenticates iff the cap is
  // gone, so it uniquely kills a silent removal of `raw.length > MAX_AUTH_HEADER_LEN`.
  it('rejects an otherwise-correct token that exceeds the cap (uniquely pins MAX_AUTH_HEADER_LEN)', () => {
    const longSecret = 'a'.repeat(4090) // `Bearer ` (7) + secret === 4097 > 4096
    mockGetCronSecret.mockReturnValue(longSecret)
    const exactButOverCap = `Bearer ${longSecret}`
    expect(exactButOverCap.length).toBeGreaterThan(4096)
    // Without the cap this exact token would hash-match → 'ok'; the cap rejects it first.
    expect(verifyCronAuth(headers(exactButOverCap))).toBe('unauthorized')
  })
})
