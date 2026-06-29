/**
 * Unit matrix for the redirect validator (launch-gate G2-3). Tests the PURE
 * functions directly — the `auth/callback` GET handler is un-mockable in the
 * gate, but the validation logic lives here and is exercised in isolation.
 */
import { describe, it, expect } from 'vitest'
import { safeRelativePath, isSafeRelativePath } from '@/lib/safe-redirect'

describe('safeRelativePath', () => {
  // [input, expected] — anything not a single-leading-slash same-origin path
  // must fall back to '/dashboard'.
  const REJECTED: [string, string][] = [
    ['@evil.com', '/dashboard'],
    ['.evil.com', '/dashboard'],
    ['//evil.com', '/dashboard'],
    ['/\\evil.com', '/dashboard'], // backslash → browsers treat as protocol-relative
    ['https://evil.com', '/dashboard'],
    ['\tmalicious', '/dashboard'], // leading TAB control char
    ['\n/dashboard', '/dashboard'], // leading newline
    ['evil.com', '/dashboard'], // no leading slash
    ['', '/dashboard'], // empty
  ]

  const ACCEPTED: string[] = [
    '/dashboard',
    '/settings?tab=1',
    '/dashboard/tools',
    '/', // bare root is same-origin
    '/path#frag',
  ]

  it.each(REJECTED)('rejects %j → falls back', (input, expected) => {
    expect(safeRelativePath(input)).toBe(expected)
    expect(isSafeRelativePath(input)).toBe(false)
  })

  it.each(ACCEPTED)('keeps safe path %j', (input) => {
    expect(safeRelativePath(input)).toBe(input)
    expect(isSafeRelativePath(input)).toBe(true)
  })

  it('falls back on null / undefined / missing', () => {
    expect(safeRelativePath(null)).toBe('/dashboard')
    expect(safeRelativePath(undefined)).toBe('/dashboard')
    expect(isSafeRelativePath(null)).toBe(false)
  })

  it('rejects an embedded CRLF (header-injection defense-in-depth)', () => {
    expect(safeRelativePath('/ok\r\nSet-Cookie: x=1')).toBe('/dashboard')
  })

  it('honors a custom (trusted) fallback', () => {
    expect(safeRelativePath('//evil.com', '/login')).toBe('/login')
  })
})
